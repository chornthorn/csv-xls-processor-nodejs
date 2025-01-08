const express = require("express");
const multer = require("multer");
const Bull = require("bull");
const winston = require("winston");
const path = require("path");

const app = express();

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = /csv|xlsx|xls/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype =
    file.mimetype.includes("csv") ||
    file.mimetype.includes("spreadsheetml") ||
    file.mimetype.includes("excel");

  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error("Only CSV and Excel files are allowed!"));
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5, // 5MB limit
  },
});

// Configure Redis queues
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const csvQueue = new Bull("csv-processing", REDIS_URL);
const excelQueue = new Bull("excel-processing", REDIS_URL);

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

// Helper function to determine file type and queue
function getQueueForFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".csv":
      return {
        queue: csvQueue,
        type: "csv",
      };
    case ".xlsx":
    case ".xls":
      return {
        queue: excelQueue,
        type: "excel",
      };
    default:
      throw new Error("Unsupported file type");
  }
}

// Upload endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded",
      });
    }

    const { queue, type } = getQueueForFile(req.file.originalname);

    const job = await queue.add({
      filePath: req.file.path,
      originalName: req.file.originalname,
      fileType: type,
      timestamp: Date.now(),
    });

    logger.info(`File queued for processing`, {
      jobId: job.id,
      fileName: req.file.originalname,
      fileType: type,
    });

    res.json({
      message: "File queued for processing",
      jobId: job.id,
      originalName: req.file.originalname,
      fileType: type,
    });
  } catch (error) {
    logger.error("Error in upload:", error);
    res.status(500).json({
      error: error.message || "Error processing upload",
    });
  }
});

// Helper function to get queue by worker type
function getQueueByWorkerType(workerType) {
  switch (workerType?.toLowerCase()) {
    case "csv":
      return { queue: csvQueue, type: "csv" };
    case "excel":
      return { queue: excelQueue, type: "excel" };
    default:
      return null;
  }
}

// Add a new endpoint to get all jobs from a specific queue
app.get("/jobs", async (req, res) => {
  try {
    const workerType = req.query.worker;
    const status = req.query.status || "active"; // active, completed, failed, delayed, waiting
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    if (!workerType) {
      return res.status(400).json({
        error: "Worker type is required. Use ?worker=csv or ?worker=excel",
      });
    }

    const queueInfo = getQueueByWorkerType(workerType);
    if (!queueInfo) {
      return res.status(400).json({
        error: "Invalid worker type. Use 'csv' or 'excel'",
      });
    }

    // Get jobs based on status
    let jobs;
    switch (status) {
      case "active":
        jobs = await queueInfo.queue.getActive();
        break;
      case "completed":
        jobs = await queueInfo.queue.getCompleted();
        break;
      case "failed":
        jobs = await queueInfo.queue.getFailed();
        break;
      case "delayed":
        jobs = await queueInfo.queue.getDelayed();
        break;
      case "waiting":
        jobs = await queueInfo.queue.getWaiting();
        break;
      default:
        return res.status(400).json({
          error: "Invalid status type",
        });
    }

    // Get queue stats
    const queueStats = await queueInfo.queue.getJobCounts();

    // Implement pagination
    const start = (page - 1) * pageSize;
    const paginatedJobs = jobs.slice(start, start + pageSize);

    const jobsData = await Promise.all(
      paginatedJobs.map(async (job) => ({
        jobId: job.id,
        state: await job.getState(),
        progress: job._progress,
        data: job.data,
        result: job.returnvalue,
        timestamps: {
          created: job.timestamp,
          started: job.processedOn,
          finished: job.finishedOn,
        },
      }))
    );

    res.json({
      queue: workerType,
      status,
      pagination: {
        page,
        pageSize,
        totalJobs: jobs.length,
        totalPages: Math.ceil(jobs.length / pageSize),
      },
      queueStats,
      jobs: jobsData,
    });
  } catch (error) {
    logger.error("Error fetching jobs:", error);
    res.status(500).json({
      error: "Error fetching jobs",
      details: error.message,
    });
  }
});

// Updated job status endpoint
app.get("/job/:jobId", async (req, res) => {
  try {
    const workerType = req.query.worker;
    let job = null;
    let queueType = null;

    // If worker type is specified
    if (workerType) {
      const queueInfo = getQueueByWorkerType(workerType);
      if (!queueInfo) {
        return res.status(400).json({
          error: "Invalid worker type. Use 'csv' or 'excel'",
        });
      }
      job = await queueInfo.queue.getJob(req.params.jobId);
      queueType = queueInfo.type;
    } else {
      // Try both queues if no worker type specified
      job = await csvQueue.getJob(req.params.jobId);
      queueType = "csv";

      if (!job) {
        job = await excelQueue.getJob(req.params.jobId);
        queueType = "excel";
      }
    }

    if (!job) {
      return res.status(404).json({
        error: workerType
          ? `Job not found in ${workerType} queue`
          : "Job not found in any queue",
      });
    }

    const state = await job.getState();
    const progress = job._progress;

    // Get additional queue stats
    const queueStats = await job.queue.getJobCounts();

    res.json({
      jobId: job.id,
      state,
      progress,
      queueType,
      data: job.data,
      result: job.returnvalue,
      queueStats: {
        waiting: queueStats.waiting,
        active: queueStats.active,
        completed: queueStats.completed,
        failed: queueStats.failed,
        delayed: queueStats.delayed,
      },
      timestamps: {
        created: job.timestamp,
        started: job.processedOn,
        finished: job.finishedOn,
      },
    });
  } catch (error) {
    logger.error("Error fetching job:", error);
    res.status(500).json({
      error: "Error fetching job status",
      details: error.message,
    });
  }
});

app.get("/metrics", async (req, res) => {
  try {
    const [csvMetrics, excelMetrics] = await Promise.all([
      csvQueue.getJobCounts(),
      excelQueue.getJobCounts(),
    ]);

    res.json({
      csv: {
        ...csvMetrics,
        processingRate: "X jobs/second",
      },
      excel: {
        ...excelMetrics,
        processingRate: "Y jobs/second",
      },
      totalActiveJobs: csvMetrics.active + excelMetrics.active,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date(),
    queues: {
      csv: "ready",
      excel: "ready",
    },
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File size is too large. Max size is 5MB",
      });
    }
  }

  logger.error("Application error:", error);
  res.status(500).json({
    error: error.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`API Server running on port ${PORT}`);
});
