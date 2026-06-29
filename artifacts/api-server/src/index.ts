import path from "node:path";
import fs from "node:fs";
import express from "express";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// LAN-binding host (default 0.0.0.0 so other PCs on the network can connect).
const host = process.env["HOST"] || "0.0.0.0";

// In single-port "Windows distribution" mode the Express server also serves the
// built React frontend. Set SERVE_STATIC_DIR to the absolute path of the build
// output (e.g. .../web). The /api router is already mounted in app.ts and takes
// precedence; everything else falls through to index.html (SPA history fallback).
const staticDir = process.env["SERVE_STATIC_DIR"];
if (!staticDir) {
  logger.warn("SERVE_STATIC_DIR is not set — frontend will not be served");
} else if (!fs.existsSync(staticDir)) {
  logger.error({ staticDir }, "SERVE_STATIC_DIR does not exist inside container — frontend will not be served. Check Docker build output.");
} else {
  logger.info({ staticDir }, "Serving frontend static assets");
  app.use(
    express.static(staticDir, {
      index: false,
      maxAge: "1h",
      setHeaders: (res, filePath) => {
        if (/\.(js|css|woff2?|png|jpe?g|webp|svg|ico)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );
  // SPA history fallback: any non-/api GET falls back to index.html
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/api/") || req.path === "/api") return next();
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

app.listen(port, host, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ host, port }, "Server listening");
});
