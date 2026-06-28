import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();

// ---------- Storage driver selection ----------
// Default: Replit GCS-backed object storage (cloud).
// STORAGE_DRIVER=local: write to a local folder (LOCAL_UPLOADS_DIR). Used by the
// Windows / on-prem distribution where there is no Replit sidecar.
const DRIVER = process.env.STORAGE_DRIVER === "local" ? "local" : "gcs";
const LOCAL_DIR = process.env.LOCAL_UPLOADS_DIR
  ? path.resolve(process.env.LOCAL_UPLOADS_DIR)
  : path.resolve(process.cwd(), "data", "uploads");

if (DRIVER === "local") {
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
}

const ALLOWED_EXTS = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif", "svg"]);
const SAFE_NAME = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9]{1,8})?$/;

function deriveExt(name?: string, contentType?: string): string | undefined {
  let ext = name?.match(/\.([A-Za-z0-9]{1,8})$/)?.[1]?.toLowerCase();
  if (!ext && /pdf/i.test(contentType || "")) ext = "pdf";
  if (ext && !ALLOWED_EXTS.has(ext)) ext = undefined;
  return ext;
}

// Lazily construct cloud client only when needed (avoids GCS sidecar errors on Windows).
let _gcs: ObjectStorageService | null = null;
function gcs(): ObjectStorageService {
  if (!_gcs) _gcs = new ObjectStorageService();
  return _gcs;
}

// ---------- POST /storage/uploads/request-url ----------
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }
  const { name, size, contentType } = parsed.data;
  const ext = deriveExt(name, contentType);

  try {
    if (DRIVER === "local") {
      const id = randomUUID();
      const filename = ext ? `${id}.${ext}` : id;
      // Client uploads via PUT to /api/storage/local-upload/<filename> with raw body.
      const uploadURL = `/api/storage/local-upload/${filename}`;
      const objectPath = `/objects/uploads/${filename}`;
      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
      return;
    }

    const uploadURL = await gcs().getObjectEntityUploadURL(ext);
    const objectPath = gcs().normalizeObjectEntityPath(uploadURL);
    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// ---------- PUT /storage/local-upload/:filename (LOCAL only) ----------
// Authenticated; writes the request body straight to the local uploads dir.
router.put("/storage/local-upload/:filename", async (req: Request, res: Response) => {
  if (DRIVER !== "local") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const { filename } = req.params;
  if (!filename || !SAFE_NAME.test(filename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  const ext = filename.split(".").pop()?.toLowerCase();
  if (filename.includes(".") && (!ext || !ALLOWED_EXTS.has(ext))) {
    res.status(400).json({ error: "Disallowed file type" });
    return;
  }
  const target = path.join(LOCAL_DIR, filename);
  try {
    await new Promise<void>((resolve, reject) => {
      const out = fs.createWriteStream(target);
      req.on("error", reject);
      out.on("error", reject);
      out.on("finish", () => resolve());
      req.pipe(out);
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    req.log.error({ err: error }, "Error writing local upload");
    res.status(500).json({ error: "Upload failed" });
  }
});

// ---------- GET /storage/public-objects/* (GCS only; no-op on local) ----------
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  if (DRIVER === "local") {
    res.status(404).json({ error: "Public objects not configured" });
    return;
  }
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await gcs().searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const response = await gcs().downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

// ---------- GET /storage/objects/* ----------
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;

    if (DRIVER === "local") {
      // Expect path like "uploads/<filename>"
      const parts = wildcardPath.split("/").filter(Boolean);
      if (parts.length !== 2 || parts[0] !== "uploads" || !SAFE_NAME.test(parts[1])) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      const filename = parts[1];
      const target = path.join(LOCAL_DIR, filename);
      if (!fs.existsSync(target)) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      const ext = filename.split(".").pop()?.toLowerCase();
      const contentType =
        ext === "pdf" ? "application/pdf"
        : ext === "png" ? "image/png"
        : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
        : ext === "webp" ? "image/webp"
        : ext === "gif" ? "image/gif"
        : ext === "svg" ? "image/svg+xml"
        : "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, max-age=3600");
      fs.createReadStream(target).pipe(res);
      return;
    }

    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await gcs().getObjectEntityFile(objectPath);
    const response = await gcs().downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
