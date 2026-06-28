import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, patientsTable, pharmacySalesTable } from "@workspace/db";
import { eq, sql, gte, and } from "drizzle-orm";

const router = Router();

function generateInvoiceNo(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const num = Math.floor(1000 + Math.random() * 9000);
  return `INV${dateStr}${num}`;
}

router.get("/billing/invoices", async (req, res) => {
  try {
    const { patientId, type, status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const entityId = req.session.entityId ?? 1;

    const invoices = await db.select({
      id: invoicesTable.id, invoiceNo: invoicesTable.invoiceNo,
      patientId: invoicesTable.patientId, patientName: patientsTable.name,
      ipdAdmissionId: invoicesTable.ipdAdmissionId, opdVisitId: invoicesTable.opdVisitId,
      type: invoicesTable.type, items: invoicesTable.items,
      subtotal: invoicesTable.subtotal, discount: invoicesTable.discount,
      gstAmount: invoicesTable.gstAmount, totalAmount: invoicesTable.totalAmount,
      paidAmount: invoicesTable.paidAmount, dueAmount: invoicesTable.dueAmount,
      paymentMode: invoicesTable.paymentMode, status: invoicesTable.status,
      invoiceDate: invoicesTable.invoiceDate, createdAt: invoicesTable.createdAt,
    }).from(invoicesTable)
      .leftJoin(patientsTable, eq(invoicesTable.patientId, patientsTable.id))
      .where(eq(invoicesTable.entityId, entityId))
      .orderBy(invoicesTable.createdAt)
      .limit(limitNum).offset(offset);

    let filtered = invoices;
    if (patientId) filtered = filtered.filter(i => i.patientId === parseInt(patientId));
    if (type) filtered = filtered.filter(i => i.type === type);
    if (status) filtered = filtered.filter(i => i.status === status);

    const total = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(eq(invoicesTable.entityId, entityId));
    res.json({ invoices: filtered, total: Number(total[0].count), page: pageNum });
  } catch (err) {
    req.log.error({ err }, "Failed to list invoices");
    res.status(500).json({ error: "Failed to list invoices" });
  }
});

router.post("/billing/invoices", async (req, res) => {
  try {
    const { patientId, ipdAdmissionId, opdVisitId, type, items, discount = 0, paidAmount, paymentMode, collectedBy } = req.body;
    if (!patientId || !type || !items?.length || paidAmount === undefined || !paymentMode) {
      return res.status(400).json({ error: "patientId, type, items, paidAmount, paymentMode are required" });
    }
    const entityId = req.session.entityId ?? 1;
    const [patientCheck] = await db.select({ id: patientsTable.id, name: patientsTable.name }).from(patientsTable).where(and(eq(patientsTable.id, patientId), eq(patientsTable.entityId, entityId)));
    if (!patientCheck) return res.status(404).json({ error: "Patient not found in this entity" });

    const subtotal = items.reduce((s: number, i: any) => s + (i.amount || 0), 0);
    const gstAmount = items.reduce((s: number, i: any) => s + (i.amount * (i.gstPercent || 0) / 100), 0);
    const totalAmount = subtotal - discount + gstAmount;
    const dueAmount = totalAmount - paidAmount;
    const invoiceNo = generateInvoiceNo();
    const invoiceDate = new Date().toISOString().slice(0, 10);

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNo, patientId, ipdAdmissionId, opdVisitId, type, items, invoiceDate,
      entityId, collectedBy: collectedBy ?? null,
      subtotal: subtotal.toString(), discount: discount.toString(), gstAmount: gstAmount.toString(),
      totalAmount: totalAmount.toString(), paidAmount: paidAmount.toString(), dueAmount: dueAmount.toString(),
      paymentMode, status: dueAmount > 0 ? "partial" : "paid",
    }).returning();
    res.status(201).json({ ...invoice, patientName: patientCheck.name });
  } catch (err) {
    req.log.error({ err }, "Failed to create invoice");
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

router.get("/billing/invoices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const [invoice] = await db.select({
      id: invoicesTable.id, invoiceNo: invoicesTable.invoiceNo,
      patientId: invoicesTable.patientId, patientName: patientsTable.name,
      ipdAdmissionId: invoicesTable.ipdAdmissionId, opdVisitId: invoicesTable.opdVisitId,
      type: invoicesTable.type, items: invoicesTable.items,
      subtotal: invoicesTable.subtotal, discount: invoicesTable.discount,
      gstAmount: invoicesTable.gstAmount, totalAmount: invoicesTable.totalAmount,
      paidAmount: invoicesTable.paidAmount, dueAmount: invoicesTable.dueAmount,
      paymentMode: invoicesTable.paymentMode, status: invoicesTable.status,
      invoiceDate: invoicesTable.invoiceDate, createdAt: invoicesTable.createdAt,
    }).from(invoicesTable)
      .leftJoin(patientsTable, eq(invoicesTable.patientId, patientsTable.id))
      .where(and(eq(invoicesTable.id, id), eq(invoicesTable.entityId, entityId)));
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(invoice);
  } catch (err) {
    req.log.error({ err }, "Failed to get invoice");
    res.status(500).json({ error: "Failed to get invoice" });
  }
});

router.put("/billing/invoices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const { paidAmount, paymentMode, status, discount } = req.body;
    const [existing] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, id), eq(invoicesTable.entityId, entityId)));
    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const newPaid = paidAmount ?? parseFloat(existing.paidAmount);
    const total = parseFloat(existing.totalAmount);
    const newDue = total - newPaid;
    const newStatus = status || (newDue <= 0 ? "paid" : "partial");

    const [invoice] = await db.update(invoicesTable).set({
      paidAmount: newPaid.toString(), dueAmount: newDue.toString(), paymentMode, status: newStatus,
      discount: discount?.toString(), updatedAt: new Date(),
    }).where(and(eq(invoicesTable.id, id), eq(invoicesTable.entityId, entityId))).returning();
    res.json(invoice);
  } catch (err) {
    req.log.error({ err }, "Failed to update invoice");
    res.status(500).json({ error: "Failed to update invoice" });
  }
});

router.get("/billing/summary", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    const [allInvoices, allPharmacy] = await Promise.all([
      db.select().from(invoicesTable).where(eq(invoicesTable.entityId, entityId)),
      db.select().from(pharmacySalesTable).where(eq(pharmacySalesTable.entityId, entityId)),
    ]);

    const todayInvoices = allInvoices.filter(i => i.invoiceDate === today);
    const monthInvoices = allInvoices.filter(i => i.invoiceDate >= monthStart);
    const outstanding = allInvoices.filter(i => i.status !== "paid");

    res.json({
      todayCollection: todayInvoices.reduce((s, i) => s + parseFloat(i.paidAmount), 0),
      monthCollection: monthInvoices.reduce((s, i) => s + parseFloat(i.paidAmount), 0),
      totalOutstanding: outstanding.reduce((s, i) => s + parseFloat(i.dueAmount ?? "0"), 0),
      todayInvoices: todayInvoices.length,
      hospitalRevenue: allInvoices.reduce((s, i) => s + parseFloat(i.totalAmount), 0),
      pharmacyRevenue: allPharmacy.reduce((s, p) => s + parseFloat(p.totalAmount), 0),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get billing summary");
    res.status(500).json({ error: "Failed to get billing summary" });
  }
});

export default router;
