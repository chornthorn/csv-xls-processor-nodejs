const express = require("express");
const multer = require("multer");
const Bull = require("bull");
const winston = require("winston");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Configure Redis
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
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

// Create Bull queue
const csvQueue = new Bull("csv-processing", REDIS_URL);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

// File upload endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const job = await csvQueue.add({
      filePath: req.file.path,
      originalName: req.file.originalname,
      timestamp: Date.now(),
    });

    logger.info(`Job created: ${job.id} for file: ${req.file.originalname}`);

    res.json({
      message: "File queued for processing",
      jobId: job.id,
      originalName: req.file.originalname,
    });
  } catch (error) {
    logger.error("Error in upload:", error);
    res.status(500).json({ error: "Error processing upload" });
  }
});

// Job status endpoint
app.get("/job/:jobId", async (req, res) => {
  try {
    const job = await csvQueue.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const state = await job.getState();
    const progress = job._progress;
    const result = job.returnvalue;

    res.json({
      jobId: job.id,
      state,
      progress,
      result,
      data: job.data,
    });
  } catch (error) {
    logger.error("Error fetching job:", error);
    res.status(500).json({ error: "Error fetching job status" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`API Server running on port ${PORT}`);
});
