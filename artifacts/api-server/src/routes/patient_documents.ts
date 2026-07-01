import { Router } from "express";
import multer from "multer";
import { db, patientDocumentsTable, patientsTable } from "@workspace/db";
import { eq, and, isNull, or, desc, inArray, ilike, gte, lte } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type"));
  },
});

function entityScope(entityId: number | null | undefined) {
  if (!entityId) return isNull(patientDocumentsTable.entityId);
  return or(eq(patientDocumentsTable.entityId, entityId), isNull(patientDocumentsTable.entityId));
}

function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// GET /patients/:patientId/documents - List documents with filtering
router.get("/patients/:patientId/documents", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const patientId = parseInt(req.params.patientId);
    if (Number.isNaN(patientId)) {
      return res.status(400).json({ error: "Invalid patientId" });
    }

    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId));
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    let query = db.select().from(patientDocumentsTable)
      .where(and(eq(patientDocumentsTable.patientId, patientId), entityScope(entityId), eq(patientDocumentsTable.isArchived, false)));

    // Filter by category
    if (req.query.category) {
      const categories = Array.isArray(req.query.category) ? req.query.category : [req.query.category];
      query = query.where(inArray(patientDocumentsTable.category, categories as string[]));
    }

    // Filter by department
    if (req.query.department) {
      query = query.where(eq(patientDocumentsTable.department, String(req.query.department)));
    }

    // Filter by tags
    if (req.query.tags) {
      const tags = Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags];
      for (const tag of tags) {
        query = query.where(ilike(patientDocumentsTable.tags, `%${tag}%`));
      }
    }

    // Filter by date range
    if (req.query.startDate) {
      query = query.where(gte(patientDocumentsTable.uploadedAt, new Date(String(req.query.startDate))));
    }
    if (req.query.endDate) {
      query = query.where(lte(patientDocumentsTable.uploadedAt, new Date(String(req.query.endDate))));
    }

    // Search in fileName and description
    if (req.query.search) {
      const searchTerm = String(req.query.search);
      query = query.where(or(
        ilike(patientDocumentsTable.fileName, `%${searchTerm}%`),
        ilike(patientDocumentsTable.description, `%${searchTerm}%`),
        ilike(patientDocumentsTable.category, `%${searchTerm}%`)
      ));
    }

    const documents = await query.orderBy(desc(patientDocumentsTable.uploadedAt));

    const mappedDocs = documents.map(doc => ({
      id: doc.id,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      fileType: doc.mimeType,
      uploadedAt: doc.uploadedAt,
      uploadedBy: doc.uploadedBy,
      category: doc.category,
      tags: doc.tags || [],
      description: doc.description,
      department: doc.department,
      module: doc.module,
      url: `/api/patients/${patientId}/documents/${doc.id}/download`,
    }));

    return res.json({
      documents: mappedDocs,
      total: documents.length,
      filtered: mappedDocs.length,
    });
  } catch (err) {
    req.log.error({ err }, "list patient documents failed");
    return res.status(500).json({ error: "Failed to list documents" });
  }
});

// POST /patients/:patientId/documents - Upload documents
router.post("/patients/:patientId/documents", (req, res, next) => {
  upload.array("files")(req, res, (err) => {
    if (err) {
      const code = (err as any).code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(code).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const userId = req.session.userId ?? null;
    const patientId = parseInt(req.params.patientId);
    if (Number.isNaN(patientId)) return res.status(400).json({ error: "Invalid patientId" });

    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId));
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const files = req.files as Express.Multer.File[] || [];
    if (!files.length) return res.status(400).json({ error: "No files provided" });

    let { category, description, tags, department, module } = req.body;
    if (!category) return res.status(400).json({ error: "Category is required" });

    // Parse tags if it's a JSON string
    if (typeof tags === "string") {
      try {
        tags = JSON.parse(tags);
      } catch {
        tags = tags ? [tags] : [];
      }
    }

    const uploadedDocuments = [];

    for (const file of files) {
      const fileHash = hashBuffer(file.buffer);

      // Check for duplicates
      const [existingDoc] = await db.select()
        .from(patientDocumentsTable)
        .where(and(
          eq(patientDocumentsTable.patientId, patientId),
          eq(patientDocumentsTable.fileHash, fileHash),
          eq(patientDocumentsTable.isArchived, false)
        ));

      if (existingDoc) {
        // Skip duplicate but log it
        continue;
      }

      const [doc] = await db.insert(patientDocumentsTable).values({
        entityId,
        patientId,
        documentDate: new Date().toISOString(),
        reportName: file.originalname,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileData: file.buffer,
        fileHash,
        category: category || null,
        tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
        description: description || null,
        department: department || null,
        module: module || null,
        version: 1,
        uploadedBy: userId,
      }).returning({
        id: patientDocumentsTable.id,
        fileName: patientDocumentsTable.fileName,
        fileSize: patientDocumentsTable.fileSize,
        mimeType: patientDocumentsTable.mimeType,
        uploadedAt: patientDocumentsTable.uploadedAt,
        uploadedBy: patientDocumentsTable.uploadedBy,
        category: patientDocumentsTable.category,
        tags: patientDocumentsTable.tags,
        description: patientDocumentsTable.description,
        department: patientDocumentsTable.department,
        module: patientDocumentsTable.module,
      });

      uploadedDocuments.push({
        id: doc.id,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        uploadedAt: doc.uploadedAt,
        uploadedBy: doc.uploadedBy,
        category: doc.category,
        tags: doc.tags || [],
        description: doc.description,
        department: doc.department,
        module: doc.module,
        url: `/api/patients/${patientId}/documents/${doc.id}/download`,
      });
    }

    return res.status(201).json({
      success: true,
      documents: uploadedDocuments,
    });
  } catch (err) {
    req.log.error({ err }, "upload patient documents failed");
    return res.status(500).json({ error: "Failed to upload documents" });
  }
});

// GET /patients/:patientId/documents/:docId - Get document details
router.get("/patients/:patientId/documents/:docId", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const patientId = parseInt(req.params.patientId);
    const docId = parseInt(req.params.docId);
    if (Number.isNaN(patientId) || Number.isNaN(docId)) {
      return res.status(400).json({ error: "Invalid patientId or docId" });
    }

    const [doc] = await db.select().from(patientDocumentsTable)
      .where(and(eq(patientDocumentsTable.id, docId), eq(patientDocumentsTable.patientId, patientId), entityScope(entityId)));
    if (!doc) return res.status(404).json({ error: "Document not found" });

    return res.json({
      id: doc.id,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      fileType: doc.mimeType,
      uploadedAt: doc.uploadedAt,
      uploadedBy: doc.uploadedBy,
      category: doc.category,
      tags: doc.tags || [],
      description: doc.description,
      department: doc.department,
      module: doc.module,
      url: `/api/patients/${patientId}/documents/${doc.id}/download`,
    });
  } catch (err) {
    req.log.error({ err }, "get document details failed");
    return res.status(500).json({ error: "Failed to get document details" });
  }
});

// PATCH /patients/:patientId/documents/:docId/metadata - Update metadata
router.patch("/patients/:patientId/documents/:docId/metadata", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const patientId = parseInt(req.params.patientId);
    const docId = parseInt(req.params.docId);
    if (Number.isNaN(patientId) || Number.isNaN(docId)) {
      return res.status(400).json({ error: "Invalid patientId or docId" });
    }

    const { description, tags, department, module } = req.body;

    const [updated] = await db.update(patientDocumentsTable)
      .set({
        description: description !== undefined ? description : undefined,
        tags: tags !== undefined ? tags : undefined,
        department: department !== undefined ? department : undefined,
        module: module !== undefined ? module : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(patientDocumentsTable.id, docId), eq(patientDocumentsTable.patientId, patientId), entityScope(entityId)))
      .returning({
        id: patientDocumentsTable.id,
        fileName: patientDocumentsTable.fileName,
        description: patientDocumentsTable.description,
        tags: patientDocumentsTable.tags,
        department: patientDocumentsTable.department,
        module: patientDocumentsTable.module,
        updatedAt: patientDocumentsTable.updatedAt,
      });

    if (!updated) return res.status(404).json({ error: "Document not found" });

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "update document metadata failed");
    return res.status(500).json({ error: "Failed to update metadata" });
  }
});

// GET /patients/:patientId/documents/:docId/download - Download document
router.get("/patients/:patientId/documents/:docId/download", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const patientId = parseInt(req.params.patientId);
    const docId = parseInt(req.params.docId);
    if (Number.isNaN(patientId) || Number.isNaN(docId)) {
      return res.status(400).json({ error: "Invalid patientId or docId" });
    }

    const [doc] = await db.select().from(patientDocumentsTable)
      .where(and(eq(patientDocumentsTable.id, docId), eq(patientDocumentsTable.patientId, patientId), entityScope(entityId)));
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const safeAscii = doc.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    const utf8 = encodeURIComponent(doc.fileName);
    const inline = req.query.inline === "true";

    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("Content-Length", String(doc.fileSize));
    res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${safeAscii}"; filename*=UTF-8''${utf8}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    return res.end(doc.fileData);
  } catch (err) {
    req.log.error({ err }, "download document failed");
    return res.status(500).json({ error: "Failed to download document" });
  }
});

// DELETE /patients/:patientId/documents/:docId - Delete document
router.delete("/patients/:patientId/documents/:docId", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const patientId = parseInt(req.params.patientId);
    const docId = parseInt(req.params.docId);
    if (Number.isNaN(patientId) || Number.isNaN(docId)) {
      return res.status(400).json({ error: "Invalid patientId or docId" });
    }

    const result = await db.update(patientDocumentsTable)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(and(eq(patientDocumentsTable.id, docId), eq(patientDocumentsTable.patientId, patientId), entityScope(entityId)))
      .returning({ id: patientDocumentsTable.id });

    if (result.length === 0) return res.status(404).json({ error: "Document not found" });
    return res.json({ success: true, message: "Document deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "delete document failed");
    return res.status(500).json({ error: "Failed to delete document" });
  }
});

// POST /patients/:patientId/documents/batch - Batch operations
router.post("/patients/:patientId/documents/batch", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const patientId = parseInt(req.params.patientId);
    if (Number.isNaN(patientId)) return res.status(400).json({ error: "Invalid patientId" });

    const { action, documentIds, tags } = req.body;
    if (!action || !documentIds || !Array.isArray(documentIds)) {
      return res.status(400).json({ error: "action and documentIds array are required" });
    }

    let processed = 0;
    let failed = 0;

    if (action === "delete") {
      const result = await db.update(patientDocumentsTable)
        .set({ isArchived: true, updatedAt: new Date() })
        .where(and(
          inArray(patientDocumentsTable.id, documentIds),
          eq(patientDocumentsTable.patientId, patientId),
          entityScope(entityId)
        ))
        .returning({ id: patientDocumentsTable.id });
      processed = result.length;
    } else if (action === "tag") {
      for (const docId of documentIds) {
        try {
          const result = await db.update(patientDocumentsTable)
            .set({ tags, updatedAt: new Date() })
            .where(and(
              eq(patientDocumentsTable.id, docId),
              eq(patientDocumentsTable.patientId, patientId),
              entityScope(entityId)
            ))
            .returning({ id: patientDocumentsTable.id });
          if (result.length > 0) processed++;
          else failed++;
        } catch {
          failed++;
        }
      }
    } else if (action === "untag") {
      for (const docId of documentIds) {
        try {
          const [doc] = await db.select({ tags: patientDocumentsTable.tags })
            .from(patientDocumentsTable)
            .where(eq(patientDocumentsTable.id, docId));
          if (doc) {
            const newTags = (doc.tags || []).filter((t: string) => !tags.includes(t));
            const result = await db.update(patientDocumentsTable)
              .set({ tags: newTags, updatedAt: new Date() })
              .where(eq(patientDocumentsTable.id, docId))
              .returning({ id: patientDocumentsTable.id });
            if (result.length > 0) processed++;
            else failed++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

    return res.json({ success: true, processed, failed });
  } catch (err) {
    req.log.error({ err }, "batch operation failed");
    return res.status(500).json({ error: "Failed to process batch operation" });
  }
});

// GET /patients/:patientId/documents/stats - Document statistics
router.get("/patients/:patientId/documents/stats", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const patientId = parseInt(req.params.patientId);
    if (Number.isNaN(patientId)) return res.status(400).json({ error: "Invalid patientId" });

    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId));
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const documents = await db.select().from(patientDocumentsTable)
      .where(and(eq(patientDocumentsTable.patientId, patientId), entityScope(entityId), eq(patientDocumentsTable.isArchived, false)));

    const total = documents.length;
    const totalSize = documents.reduce((sum, d) => sum + d.fileSize, 0);

    const byCategory = Object.entries(
      documents.reduce((acc: Record<string, number>, d) => {
        const cat = d.category || "Uncategorized";
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {})
    ).map(([category, count]) => ({ category, count }));

    const byDepartment = Object.entries(
      documents.reduce((acc: Record<string, number>, d) => {
        const dept = d.department || "General";
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
      }, {})
    ).map(([department, count]) => ({ department, count }));

    const uploadedBySet = new Set(documents.map(d => String(d.uploadedBy || "Unknown")));
    const uploadedBy = Array.from(uploadedBySet);

    const sortedDocs = documents.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());

    return res.json({
      total,
      totalSize,
      byCategory,
      byDepartment,
      uploadedBy,
      oldestDocument: sortedDocs[0]?.uploadedAt || null,
      newestDocument: sortedDocs[sortedDocs.length - 1]?.uploadedAt || null,
    });
  } catch (err) {
    req.log.error({ err }, "get document statistics failed");
    return res.status(500).json({ error: "Failed to get statistics" });
  }
});

export default router;
