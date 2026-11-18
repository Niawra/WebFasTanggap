import { Router } from "express";

const router = Router();

/**
 * GET /api/health
 * Memeriksa status kesehatan server backend TanggapAI.
 */
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "TanggapAI Backend Service",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
  });
});

export default router;
