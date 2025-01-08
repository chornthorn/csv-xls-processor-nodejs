const Bull = require("bull");
const fs = require("fs");
const ExcelJS = require("exceljs");
const winston = require("winston");

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: "logs/worker2-error.log",
      level: "error",
    }),
    new winston.transports.File({ filename: "logs/worker2-combined.log" }),
  ],
});

const excelQueue = new Bull("excel-processing", REDIS_URL);

// Helper function to parse multiple values in a field
function parseMultiValueField(value) {
  if (!value) return [];

  // If value is already an array (some Excel cells might be pre-split)
  if (Array.isArray(value)) {
    return value.map((v) => v.toString().trim()).filter((v) => v);
  }

  // Convert to string and handle different formats
  const stringValue = value.toString();
  // Remove outer quotes if they exist
  const cleanValue = stringValue.replace(/^["'](.+)["']$/, "$1");
  // Split by comma or pipe, trim and filter empty values
  return cleanValue
    .split(/[,|]/)
    .map((v) => v.trim())
    .filter((v) => v);
}

async function processRecord(record, jobId) {
  try {
    // Define fields that might contain multiple values
    const multiValueFields = ["Tags", "Categories"];

    // Process multi-value fields
    const processedRecord = {
      ...record,
      // Process known multi-value fields
      ...Object.fromEntries(
        multiValueFields
          .filter((field) => record[field])
          .map((field) => [field, parseMultiValueField(record[field])])
      ),
    };

    console.log("Processing Record:", {
      jobId,
      original: record,
      processed: processedRecord,
      timestamp: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    logger.info(`Processed record for job ${jobId}: ${record.ProductID}`, {
      multiValues: Object.fromEntries(
        multiValueFields
          .filter((field) => processedRecord[field])
          .map((field) => [field, processedRecord[field]])
      ),
    });

    return { success: true, data: processedRecord };
  } catch (error) {
    logger.error(`Error processing record for job ${jobId}:`, {
      error: error.message,
      record,
    });
    throw error;
  }
}

async function parseExcel(filePath) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(1);
    const records = [];

    // Get headers
    const headers = worksheet.getRow(1).values.slice(1);

    // Validate required columns
    const requiredColumns = ["ProductID", "ProductName", "Price", "Quantity"];
    const missingColumns = requiredColumns.filter(
      (col) => !headers.includes(col)
    );

    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(", ")}`);
    }

    // Iterate through rows and create objects
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row

      const record = {};
      row.values.slice(1).forEach((value, index) => {
        const header = headers[index];
        // Handle rich text or other Excel-specific formats
        if (value && typeof value === "object" && value.richText) {
          record[header] = value.richText.map((t) => t.text).join("");
        } else if (value && value.text) {
          record[header] = value.text;
        } else {
          record[header] = value;
        }
      });
      records.push(record);
    });

    return records;
  } catch (error) {
    logger.error("Error parsing Excel:", error);
    throw error;
  }
}

excelQueue.process(async (job) => {
  const { filePath } = job.data;
  const results = {
    processed: 0,
    failed: 0,
    total: 0,
    records: [],
    summary: {
      multiValueFields: {}, // Will store statistics about multi-value fields
    },
  };

  try {
    logger.info(`Starting to process file: ${filePath}`);
    console.log(`Starting to process file: ${filePath}`);

    const records = await parseExcel(filePath);
    results.total = records.length;

    console.log(`Found ${results.total} records to process`);

    for (const record of records) {
      try {
        const processedRecord = await processRecord(record, job.id);
        results.processed++;
        results.records.push(processedRecord);

        // Collect statistics about multi-value fields
        Object.entries(processedRecord.data)
          .filter(([_, value]) => Array.isArray(value))
          .forEach(([field, values]) => {
            if (!results.summary.multiValueFields[field]) {
              results.summary.multiValueFields[field] = {
                totalValues: 0,
                uniqueValues: new Set(),
                maxValuesInField: 0,
              };
            }
            results.summary.multiValueFields[field].totalValues +=
              values.length;
            values.forEach((v) =>
              results.summary.multiValueFields[field].uniqueValues.add(v)
            );
            results.summary.multiValueFields[field].maxValuesInField = Math.max(
              results.summary.multiValueFields[field].maxValuesInField,
              values.length
            );
          });

        if (results.processed % 10 === 0) {
          console.log(
            `Progress Update - Processed: ${results.processed}, Failed: ${results.failed}, Total: ${results.total}`
          );
        }
      } catch (error) {
        results.failed++;
        logger.error(`Failed to process record`, { error, record });
      }

      const progress = Math.floor(
        ((results.processed + results.failed) / results.total) * 100
      );
      await job.progress(progress);
    }

    // Convert Sets to arrays in summary
    Object.keys(results.summary.multiValueFields).forEach((field) => {
      results.summary.multiValueFields[field].uniqueValues = Array.from(
        results.summary.multiValueFields[field].uniqueValues
      );
    });

    // Cleanup
    fs.unlinkSync(filePath);

    console.log("Processing Complete:", {
      jobId: job.id,
      totalProcessed: results.processed,
      totalFailed: results.failed,
      totalRecords: results.total,
      processingTime: `${Date.now() - job.timestamp}ms`,
      multiValueFieldStats: results.summary.multiValueFields,
    });

    logger.info(`Job ${job.id} completed`, results);
    return results;
  } catch (error) {
    logger.error(`Job ${job.id} failed:`, error);
    throw error;
  }
});

// Queue event handlers remain the same...

console.log("👷 Excel Worker started and waiting for jobs...");
logger.info("Excel Worker started");
