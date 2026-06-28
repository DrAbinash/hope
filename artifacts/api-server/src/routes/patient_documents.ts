import { Router } from "express";
import multer from "multer";
import { db, patientDocumentsTable, patientsTable } from "@workspace/db";
import { eq, and, isNull, or, desc } from "drizzle-orm";

const router = Router();

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB per screenshot
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF and Excel files are allowed"));
  },
});

// Scope: a doc is accessible if its entityId equals the session entity, OR the doc has no entity
// (legacy uploads). New uploads always stamp entityId.
function entityScope(entityId: number | null | undefined) {
  if (!entityId) return isNull(patientDocumentsTable.entityId);
  return or(eq(patientDocumentsTable.entityId, entityId), isNull(patientDocumentsTable.entityId));
}

router.get("/patient-documents", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const patientId = req.query.patientId ? parseInt(String(req.query.patientId)) : NaN;
    if (Number.isNaN(patientId)) {
      return res.status(400).json({ error: "patientId query param is required" });
    }
    const rows = await db
      .select({
        id: patientDocumentsTable.id,
        patientId: patientDocumentsTable.patientId,
        documentDate: patientDocumentsTable.documentDate,
        reportName: patientDocumentsTable.reportName,
        fileName: patientDocumentsTable.fileName,
        mimeType: patientDocumentsTable.mimeType,
        fileSize: patientDocumentsTable.fileSize,
        remark: patientDocumentsTable.remark,
        uploadedBy: patientDocumentsTable.uploadedBy,
        uploadedAt: patientDocumentsTable.uploadedAt,
      })
      .from(patientDocumentsTable)
      .where(and(eq(patientDocumentsTable.patientId, patientId), entityScope(entityId)))
      .orderBy(desc(patientDocumentsTable.uploadedAt));
    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list patient documents failed");
    return res.status(500).json({ error: "Failed to list documents" });
  }
});

router.post("/patient-documents", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      const code = (err as any).code === "LIMIT_FILE_SIZE" ? 413 : 400;
      res.status(code).json({ error: err.message });
      return;
    }
    next();
  });
}, async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const userId = req.session.userId ?? null;
    const { patientId, documentDate, reportName, remark } = req.body || {};
    if (!req.file) return res.status(400).json({ error: "File is required" });
    if (!patientId || !documentDate || !reportName) {
      return res.status(400).json({ error: "patientId, documentDate and reportName are required" });
    }
    const pid = parseInt(String(patientId));
    if (Number.isNaN(pid)) return res.status(400).json({ error: "Invalid patientId" });
    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, pid));
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const [row] = await db.insert(patientDocumentsTable).values({
      entityId,
      patientId: pid,
      documentDate: String(documentDate),
      reportName: String(reportName).trim(),
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      fileData: req.file.buffer,
      remark: remark ? String(remark).trim() : null,
      uploadedBy: userId,
    }).returning({
      id: patientDocumentsTable.id,
      patientId: patientDocumentsTable.patientId,
      documentDate: patientDocumentsTable.documentDate,
      reportName: patientDocumentsTable.reportName,
      fileName: patientDocumentsTable.fileName,
      mimeType: patientDocumentsTable.mimeType,
      fileSize: patientDocumentsTable.fileSize,
      remark: patientDocumentsTable.remark,
      uploadedAt: patientDocumentsTable.uploadedAt,
    });
    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "upload patient document failed");
    return res.status(500).json({ error: "Failed to upload document" });
  }
});

router.get("/patient-documents/:id/download", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [doc] = await db.select().from(patientDocumentsTable)
      .where(and(eq(patientDocumentsTable.id, id), entityScope(entityId)));
    if (!doc) return res.status(404).json({ error: "Document not found" });
    // ASCII fallback (strip control chars and quotes) + RFC 5987 UTF-8 form
    const safeAscii = doc.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    const utf8 = encodeURIComponent(doc.fileName);
    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("Content-Length", String(doc.fileSize));
    res.setHeader("Content-Disposition", `attachment; filename="${safeAscii}"; filename*=UTF-8''${utf8}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    return res.end(doc.fileData);
  } catch (err) {
    req.log.error({ err }, "download patient document failed");
    return res.status(500).json({ error: "Failed to download document" });
  }
});

router.delete("/patient-documents/:id", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const result = await db.delete(patientDocumentsTable)
      .where(and(eq(patientDocumentsTable.id, id), entityScope(entityId)))
      .returning({ id: patientDocumentsTable.id });
    if (result.length === 0) return res.status(404).json({ error: "Document not found" });
    return res.json({ success: true, id });
  } catch (err) {
    req.log.error({ err }, "delete patient document failed");
    return res.status(500).json({ error: "Failed to delete document" });
  }
});

export default router;
