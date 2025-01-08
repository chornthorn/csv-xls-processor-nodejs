const Bull = require("bull");
const fs = require("fs");
const csvParser = require("csv-parse"); // Changed this line
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
      filename: "logs/worker-error.log",
      level: "error",
    }),
    new winston.transports.File({ filename: "logs/worker-combined.log" }),
  ],
});

const csvQueue = new Bull("csv-processing", REDIS_URL);

async function processRecord(record, jobId) {
  try {
    console.log("Processing Record:", {
      jobId,
      record,
      timestamp: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    logger.info(`Processed record for job ${jobId}: ${record.ProductID}`);
    return { success: true, data: record };
  } catch (error) {
    logger.error(`Error processing record for job ${jobId}:`, {
      error: error.message,
      record,
    });
    throw error;
  }
}

async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];

    // Create parser
    const parser = csvParser({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    // Use the readable stream api to consume records
    parser.on("readable", function () {
      let record;
      while ((record = parser.read()) !== null) {
        records.push(record);
      }
    });

    // Catch any error
    parser.on("error", function (err) {
      logger.error("Error parsing CSV:", err);
      reject(err);
    });

    // When we're done, resolve with the records
    parser.on("end", function () {
      resolve(records);
    });

    // Read the file and pipe it to the parser
    fs.createReadStream(filePath)
      .on("error", (error) => reject(error))
      .pipe(parser);
  });
}

csvQueue.process(async (job) => {
  const { filePath } = job.data;
  const results = {
    processed: 0,
    failed: 0,
    total: 0,
    records: [],
  };

  try {
    logger.info(`Starting to process file: ${filePath}`);
    console.log(`Starting to process file: ${filePath}`);

    // Parse CSV content
    const records = await parseCSV(filePath);
    results.total = records.length;

    console.log(`Found ${results.total} records to process`);

    // Process records
    for (const record of records) {
      try {
        const processedRecord = await processRecord(record, job.id);
        results.processed++;
        results.records.push(processedRecord);

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

    // Cleanup
    fs.unlinkSync(filePath);

    console.log("Processing Complete:", {
      jobId: job.id,
      totalProcessed: results.processed,
      totalFailed: results.failed,
      totalRecords: results.total,
      processingTime: `${Date.now() - job.timestamp}ms`,
    });

    logger.info(`Job ${job.id} completed`, results);
    return results;
  } catch (error) {
    logger.error(`Job ${job.id} failed:`, error);
    throw error;
  }
});

// Queue event handlers
csvQueue.on("completed", (job, result) => {
  console.log(`✅ Job ${job.id} completed successfully`);
  logger.info(`Job ${job.id} completed`, result);
});

csvQueue.on("failed", (job, error) => {
  console.log(`❌ Job ${job.id} failed:`, error.message);
  logger.error(`Job ${job.id} failed:`, error);
});

csvQueue.on("progress", (job, progress) => {
  console.log(`📊 Job ${job.id} is ${progress}% complete`);
});

csvQueue.on("error", (error) => {
  console.log("Queue error:", error);
  logger.error("Queue error:", error);
});

console.log("👷 Worker started and waiting for jobs...");
logger.info("Worker started");