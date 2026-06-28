import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Liveness check (fast — no DB): used by Docker HEALTHCHECK CMD
router.get("/healthz", async (_req, res) => {
  // Verify database connectivity with a lightweight query
  try {
    await db.execute(sql`SELECT 1`);
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json(data);
  } catch {
    res.status(503).json({ status: "error", detail: "database unreachable" });
  }
});

// Alias for backward compat with Dockerfile HEALTHCHECK and Synology health probes
router.get("/api/health", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "error", detail: "database unreachable" });
  }
});

export default router;
