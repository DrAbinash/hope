import { Router } from "express";
import { db } from "@workspace/db";
import {
  diagnosticOrdersTable, patientsTable, doctorsTable, invoicesTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { invalidateClinicalMemory } from "./ai_assistant";

const router = Router();

function generateOrderNo(type: string): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const num = Math.floor(1000 + Math.random() * 9000);
  const prefix = type === "radiology" ? "RAD" : "LAB";
  return `${prefix}${dateStr}${num}`;
}

router.get("/diagnostic-orders", async (req, res) => {
  try {
    const { type, status, patientId } = req.query as Record<string, string>;
    const rows = await db.select({
      id: diagnosticOrdersTable.id,
      orderNo: diagnosticOrdersTable.orderNo,
      type: diagnosticOrdersTable.type,
      patientId: diagnosticOrdersTable.patientId,
      patientName: patientsTable.name,
      patientUhid: patientsTable.uhid,
      entityId: diagnosticOrdersTable.entityId,
      doctorId: diagnosticOrdersTable.doctorId,
      doctorName: doctorsTable.name,
      items: diagnosticOrdersTable.items,
      totalAmount: diagnosticOrdersTable.totalAmount,
      status: diagnosticOrdersTable.status,
      invoiceId: diagnosticOrdersTable.invoiceId,
      notes: diagnosticOrdersTable.notes,
      orderedAt: diagnosticOrdersTable.orderedAt,
      completedAt: diagnosticOrdersTable.completedAt,
    }).from(diagnosticOrdersTable)
      .leftJoin(patientsTable, eq(diagnosticOrdersTable.patientId, patientsTable.id))
      .leftJoin(doctorsTable, eq(diagnosticOrdersTable.doctorId, doctorsTable.id))
      .orderBy(desc(diagnosticOrdersTable.orderedAt));

    let filtered = rows;
    if (type) filtered = filtered.filter((r) => r.type === type);
    if (status) filtered = filtered.filter((r) => r.status === status);
    if (patientId) filtered = filtered.filter((r) => r.patientId === parseInt(patientId));
    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "Failed to list diagnostic orders");
    res.status(500).json({ error: "Failed to list diagnostic orders" });
  }
});

router.post("/diagnostic-orders", async (req, res) => {
  try {
    const { type, patientId, entityId, doctorId, opdVisitId, ipdAdmissionId, items, notes } = req.body;
    if (!type || !patientId || !items?.length) {
      return res.status(400).json({ error: "type, patientId, items required" });
    }
    const totalAmount = items.reduce((s: number, i: any) => s + Number(i.rate || 0) * (i.quantity || 1), 0);
    const orderNo = generateOrderNo(type);
    const [order] = await db.insert(diagnosticOrdersTable).values({
      orderNo, type, patientId,
      entityId: entityId ?? null,
      doctorId: doctorId ?? null,
      opdVisitId: opdVisitId ?? null,
      ipdAdmissionId: ipdAdmissionId ?? null,
      items, totalAmount: totalAmount.toString(),
      status: "pending", notes: notes ?? null,
    }).returning();
    invalidateClinicalMemory(order.patientId);
    res.status(201).json(order);
  } catch (err) {
    req.log.error({ err }, "Failed to create diagnostic order");
    res.status(500).json({ error: "Failed to create diagnostic order" });
  }
});

router.get("/diagnostic-orders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.select().from(diagnosticOrdersTable).where(eq(diagnosticOrdersTable.id, id));
    if (!row) return res.status(404).json({ error: "Order not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to get diagnostic order");
    res.status(500).json({ error: "Failed to get diagnostic order" });
  }
});

router.put("/diagnostic-orders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { items, status, notes } = req.body;
    const [existing] = await db.select().from(diagnosticOrdersTable).where(eq(diagnosticOrdersTable.id, id));
    if (!existing) return res.status(404).json({ error: "Order not found" });

    const update: any = { updatedAt: new Date() };
    if (items !== undefined) update.items = items;
    if (status !== undefined) {
      update.status = status;
      if (status === "completed") update.completedAt = new Date();
    }
    if (notes !== undefined) update.notes = notes;

    const [row] = await db.update(diagnosticOrdersTable).set(update)
      .where(eq(diagnosticOrdersTable.id, id)).returning();
    invalidateClinicalMemory(row.patientId);
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update diagnostic order");
    res.status(500).json({ error: "Failed to update diagnostic order" });
  }
});

router.post("/diagnostic-orders/:id/bill", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { paidAmount, paymentMode, collectedBy, discount = 0 } = req.body;
    const [order] = await db.select().from(diagnosticOrdersTable).where(eq(diagnosticOrdersTable.id, id));
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.invoiceId) return res.status(400).json({ error: "Order already billed" });

    const items = (order.items as any[]).map((i) => ({
      description: i.name, code: i.code,
      quantity: i.quantity || 1, rate: Number(i.rate),
      amount: Number(i.rate) * (i.quantity || 1), gstPercent: 0,
    }));
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const totalAmount = subtotal - Number(discount);
    const dueAmount = totalAmount - Number(paidAmount || 0);
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const invoiceNo = `INV${dateStr}${Math.floor(1000 + Math.random() * 9000)}`;

    const [invoice] = await (db.insert(invoicesTable) as any).values({
      invoiceNo, patientId: order.patientId,
      entityId: order.entityId ?? 1, opdVisitId: order.opdVisitId,
      ipdAdmissionId: order.ipdAdmissionId,
      type: order.type === "radiology" ? "Radiology" : "Pathology",
      items, invoiceDate: date.toISOString().slice(0, 10),
      subtotal: subtotal.toString(), discount: Number(discount).toString(),
      gstAmount: "0", totalAmount: totalAmount.toString(),
      paidAmount: Number(paidAmount || 0).toString(), dueAmount: dueAmount.toString(),
      paymentMode: paymentMode || "Cash",
      collectedBy: collectedBy ?? null,
      status: dueAmount > 0 ? "partial" : "paid",
    }).returning();

    await db.update(diagnosticOrdersTable)
      .set({ invoiceId: invoice.id, updatedAt: new Date() })
      .where(eq(diagnosticOrdersTable.id, id));

    res.status(201).json({ invoice, orderId: id });
  } catch (err) {
    req.log.error({ err }, "Failed to bill diagnostic order");
    res.status(500).json({ error: "Failed to bill diagnostic order" });
  }
});

export default router;
