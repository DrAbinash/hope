import { Router } from "express";
import { db } from "@workspace/db";
import {
  estimationsTable, patientsTable, doctorsTable, packagesTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

const router = Router();

function generateEstimationNo(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const num = Math.floor(1000 + Math.random() * 9000);
  return `EST${dateStr}${num}`;
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const surgeonsTable = doctorsTable;

router.get("/estimations", async (req, res) => {
  try {
    const sessionEntityId = req.session?.entityId;
    if (!sessionEntityId) return res.status(401).json({ error: "No active session entity" });
    const { type, patientId, status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conds = [eq(estimationsTable.entityId, sessionEntityId)] as any[];
    if (type) conds.push(eq(estimationsTable.type, type));
    if (patientId && !Number.isNaN(parseInt(patientId))) conds.push(eq(estimationsTable.patientId, parseInt(patientId)));
    if (status) conds.push(eq(estimationsTable.status, status));

    const rows = await db.select({
      id: estimationsTable.id,
      estimationNo: estimationsTable.estimationNo,
      type: estimationsTable.type,
      patientId: estimationsTable.patientId,
      patientName: patientsTable.name,
      uhid: patientsTable.uhid,
      surgeonId: estimationsTable.surgeonId,
      surgeonName: surgeonsTable.name,
      packageId: estimationsTable.packageId,
      procedureName: estimationsTable.procedureName,
      wardCategory: estimationsTable.wardCategory,
      expectedDays: estimationsTable.expectedDays,
      subtotal: estimationsTable.subtotal,
      discount: estimationsTable.discount,
      gstAmount: estimationsTable.gstAmount,
      totalAmount: estimationsTable.totalAmount,
      validUntil: estimationsTable.validUntil,
      status: estimationsTable.status,
      createdBy: estimationsTable.createdBy,
      createdAt: estimationsTable.createdAt,
    })
      .from(estimationsTable)
      .leftJoin(patientsTable, eq(estimationsTable.patientId, patientsTable.id))
      .leftJoin(surgeonsTable, eq(estimationsTable.surgeonId, surgeonsTable.id))
      .where(and(...conds))
      .orderBy(sql`${estimationsTable.createdAt} desc`)
      .limit(limitNum)
      .offset(offset);

    res.json({ estimations: rows, page: pageNum });
  } catch (err) {
    req.log.error({ err }, "Failed to list estimations");
    res.status(500).json({ error: "Failed to list estimations" });
  }
});

router.get("/estimations/:id", async (req, res) => {
  try {
    const sessionEntityId = req.session?.entityId;
    if (!sessionEntityId) return res.status(401).json({ error: "No active session entity" });
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [row] = await db.select({
      id: estimationsTable.id,
      estimationNo: estimationsTable.estimationNo,
      entityId: estimationsTable.entityId,
      type: estimationsTable.type,
      patientId: estimationsTable.patientId,
      patientName: patientsTable.name,
      uhid: patientsTable.uhid,
      patientPhone: patientsTable.phone,
      patientAge: patientsTable.age,
      patientGender: patientsTable.gender,
      patientAddress: patientsTable.address,
      surgeonId: estimationsTable.surgeonId,
      surgeonName: surgeonsTable.name,
      doctorId: estimationsTable.doctorId,
      packageId: estimationsTable.packageId,
      packageName: packagesTable.name,
      procedureName: estimationsTable.procedureName,
      wardCategory: estimationsTable.wardCategory,
      expectedDays: estimationsTable.expectedDays,
      items: estimationsTable.items,
      subtotal: estimationsTable.subtotal,
      discount: estimationsTable.discount,
      gstAmount: estimationsTable.gstAmount,
      totalAmount: estimationsTable.totalAmount,
      validityDays: estimationsTable.validityDays,
      validUntil: estimationsTable.validUntil,
      notes: estimationsTable.notes,
      status: estimationsTable.status,
      createdBy: estimationsTable.createdBy,
      createdAt: estimationsTable.createdAt,
    })
      .from(estimationsTable)
      .leftJoin(patientsTable, eq(estimationsTable.patientId, patientsTable.id))
      .leftJoin(surgeonsTable, eq(estimationsTable.surgeonId, surgeonsTable.id))
      .leftJoin(packagesTable, eq(estimationsTable.packageId, packagesTable.id))
      .where(and(eq(estimationsTable.id, id), eq(estimationsTable.entityId, sessionEntityId)));

    if (!row) return res.status(404).json({ error: "Estimation not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch estimation");
    res.status(500).json({ error: "Failed to fetch estimation" });
  }
});

router.post("/estimations", async (req, res) => {
  try {
    const {
      type, patientId, surgeonId, doctorId, packageId, wardCategory, expectedDays,
      procedureName, items, discount, gstAmount, validityDays, notes, status,
    } = req.body;

    if (!type || !["surgery", "ipd", "investigation", "general"].includes(type)) {
      return res.status(400).json({ error: "type must be one of surgery|ipd|investigation|general" });
    }
    if (!patientId) return res.status(400).json({ error: "patientId is required" });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one line item is required" });
    }
    if (status && !["draft", "sent", "accepted", "expired", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const pid = parseInt(patientId);
    if (Number.isNaN(pid)) return res.status(400).json({ error: "patientId must be a number" });
    const sessionEntityId = req.session?.entityId;
    if (!sessionEntityId) return res.status(401).json({ error: "No active session entity" });

    const lineItems = items.map((it: any) => {
      const qty = Math.max(0, Number(it.quantity) || 1);
      const rate = Math.max(0, Number(it.rate) || 0);
      const amount = +(qty * rate).toFixed(2);
      return {
        description: String(it.description || "").trim(),
        quantity: qty,
        rate,
        amount,
        billingHeadId: it.billingHeadId ?? null,
        category: it.category ?? null,
      };
    });

    if (lineItems.some((it) => !it.description)) {
      return res.status(400).json({ error: "Every line item needs a description" });
    }

    const subtotal = +lineItems.reduce((s, it) => s + it.amount, 0).toFixed(2);
    const disc = Math.max(0, Number(discount) || 0);
    const gst = Math.max(0, Number(gstAmount) || 0);
    const total = +(subtotal - disc + gst).toFixed(2);
    const valDays = Math.max(1, Math.min(365, Number(validityDays) || 7));
    const valid = addDays(new Date(), valDays);

    const estimationNo = generateEstimationNo();
    const createdBy = req.session?.username || null;
    const entityId = sessionEntityId;

    const [row] = await db.insert(estimationsTable).values({
      estimationNo,
      entityId,
      type,
      patientId: pid,
      surgeonId: surgeonId ? parseInt(surgeonId) : null,
      doctorId: doctorId ? parseInt(doctorId) : null,
      packageId: packageId ? parseInt(packageId) : null,
      wardCategory: wardCategory || null,
      expectedDays: expectedDays ? parseInt(expectedDays) : null,
      procedureName: procedureName || null,
      items: lineItems,
      subtotal: subtotal.toString(),
      discount: disc.toString(),
      gstAmount: gst.toString(),
      totalAmount: total.toString(),
      validityDays: valDays,
      validUntil: valid,
      notes: notes || null,
      status: status || "draft",
      createdBy,
    }).returning();

    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create estimation");
    res.status(500).json({ error: "Failed to create estimation" });
  }
});

router.put("/estimations/:id", async (req, res) => {
  try {
    const sessionEntityId = req.session?.entityId;
    if (!sessionEntityId) return res.status(401).json({ error: "No active session entity" });
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { status, notes } = req.body;
    const update: Record<string, any> = { updatedAt: new Date() };
    if (status) {
      if (!["draft", "sent", "accepted", "expired", "cancelled"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      update.status = status;
    }
    if (notes !== undefined) update.notes = notes;

    const [row] = await db.update(estimationsTable).set(update)
      .where(and(eq(estimationsTable.id, id), eq(estimationsTable.entityId, sessionEntityId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Estimation not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update estimation");
    res.status(500).json({ error: "Failed to update estimation" });
  }
});

export default router;
