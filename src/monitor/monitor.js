const express = require("express");
const Bull = require("bull");
const winston = require("winston");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const csvQueue = new Bull("csv-processing", REDIS_URL);

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: "logs/monitor-error.log",
      level: "error",
    }),
    new winston.transports.File({ filename: "logs/monitor-combined.log" }),
  ],
});

app.get("/metrics", async (req, res) => {
  try {
    const [completed, failed, active, delayed, waiting] = await Promise.all([
      csvQueue.getCompleted(),
      csvQueue.getFailed(),
      csvQueue.getActive(),
      csvQueue.getDelayed(),
      csvQueue.getWaiting(),
    ]);

    const stats = await csvQueue.getJobCounts();

    res.json({
      stats,
      jobs: {
        completed: completed.slice(0, 10),
        failed: failed.slice(0, 10),
        active,
        delayed,
        waiting: waiting.slice(0, 10),
      },
    });
  } catch (error) {
    logger.error("Error fetching metrics:", error);
    res.status(500).json({ error: "Error fetching metrics" });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

const PORT = process.env.MONITOR_PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Monitor Server running on port ${PORT}`);
});
