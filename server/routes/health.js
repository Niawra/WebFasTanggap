import { Router } from "express";
import { getAiProviderChain } from "../services/ai/index.js";

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
    // Urutan provider AI dan apakah key-nya terpasang (tanpa membuka isi key).
    ai: getAiProviderChain().map((p) => ({ provider: p, key: Boolean(process.env[`${p.toUpperCase()}_API_KEY`]) })),
  });
});

export default router;
