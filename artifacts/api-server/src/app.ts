import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { sessionMiddleware } from "./lib/session";

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// CORS: allow only explicitly configured origins.
// ALLOWED_ORIGINS is a comma-separated list, e.g. "http://192.168.1.100:5000,https://hms.hospital.lan"
// Defaults to same-origin only (no cross-origin requests) when not set.
const rawOrigins = process.env.ALLOWED_ORIGINS;
const allowedOrigins = rawOrigins
  ? rawOrigins.split(",").map((o) => o.trim()).filter(Boolean)
  : [];
app.use(
  cors({
    origin: allowedOrigins.length > 0
      ? (origin, cb) => {
          // Allow requests with no Origin (server-to-server, curl) and listed origins
          if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
          cb(new Error(`CORS: origin '${origin}' not allowed`));
        }
      : false,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public health endpoint (before session middleware) for Docker healthcheck
app.get("/api/health", async (_req, res) => {
  try {
    const { db } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "error", detail: "database unreachable" });
  }
});

app.get("/api/healthz", async (_req, res) => {
  try {
    const { db } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "error", detail: "database unreachable" });
  }
});

// Session middleware for authenticated endpoints
app.use(sessionMiddleware);

app.use("/api", router);

export default app;
