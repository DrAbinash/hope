import { Router } from "express";
import { db, pharmacySalesTable, vendorPurchasesTable, vendorsTable, invoicesTable, patientsTable, ipdAdmissionsTable } from "@workspace/db";
import { and, eq, desc, gte, lte, sql, isNotNull, isNull, ilike, or } from "drizzle-orm";

const router = Router();
const ISO_RX = /^\d{4}-\d{2}-\d{2}$/;

// Strict multi-tenant scope: a session bound to entity X must only see entity X's rows.
// Sessions without an entity (legacy/global admin) only see legacy rows where entity_id IS NULL.
function scope(col: any, entityId: number | null) {
  return entityId ? eq(col, entityId) : isNull(col);
}

function parseDates(req: any) {
  const { fromDate, toDate } = req.query as Record<string, string>;
  if (!fromDate || !toDate) return { error: "fromDate and toDate are required" };
  if (!ISO_RX.test(fromDate) || !ISO_RX.test(toDate)) return { error: "Dates must be ISO YYYY-MM-DD" };
  if (fromDate > toDate) return { error: "fromDate must be on/before toDate" };
  const days = (Date.parse(toDate) - Date.parse(fromDate)) / 86400000;
  if (days > 366) return { error: "Date range cannot exceed 366 days" };
  return { fromDate, toDate };
}

// 1) Issued Medicines — pharmacy sales tied to IPD admissions
router.get("/reports/pharmacy/issued", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const { fromDate, toDate } = p;
    const { q, ipdId } = req.query as Record<string, string>;
    const entityId = req.session.entityId ?? null;

    const filters: any[] = [
      scope(pharmacySalesTable.entityId, entityId),
      isNotNull(pharmacySalesTable.ipdAdmissionId),
      gte(pharmacySalesTable.billDate, fromDate),
      lte(pharmacySalesTable.billDate, toDate),
    ];
    if (ipdId) {
      const id = parseInt(ipdId);
      if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid ipdId" });
      filters.push(eq(pharmacySalesTable.ipdAdmissionId, id));
    }
    if (q) filters.push(or(ilike(patientsTable.name, `%${q}%`), ilike(patientsTable.uhid, `%${q}%`), ilike(pharmacySalesTable.billNo, `%${q}%`), ilike(ipdAdmissionsTable.ipdNo, `%${q}%`))!);

    const rows = await db.select({
      saleId: pharmacySalesTable.id,
      billNo: pharmacySalesTable.billNo,
      billDate: pharmacySalesTable.billDate,
      patientId: patientsTable.id,
      patientName: patientsTable.name,
      uhid: patientsTable.uhid,
      ipdId: ipdAdmissionsTable.id,
      ipdNo: ipdAdmissionsTable.ipdNo,
      items: pharmacySalesTable.items,
      subtotal: pharmacySalesTable.subtotal,
      discount: pharmacySalesTable.discount,
      gst: pharmacySalesTable.gstAmount,
      total: pharmacySalesTable.totalAmount,
      paid: pharmacySalesTable.paidAmount,
      due: pharmacySalesTable.dueAmount,
      paymentMode: pharmacySalesTable.paymentMode,
      billStatus: pharmacySalesTable.billStatus,
    })
      .from(pharmacySalesTable)
      .leftJoin(patientsTable, eq(pharmacySalesTable.patientId, patientsTable.id))
      .leftJoin(ipdAdmissionsTable, eq(pharmacySalesTable.ipdAdmissionId, ipdAdmissionsTable.id))
      .where(and(...filters))
      .orderBy(desc(pharmacySalesTable.billDate), desc(pharmacySalesTable.id));

    let qty = 0;
    const totals = rows.reduce(
      (a, r) => {
        for (const it of (r.items as any[] | null) || []) qty += Number(it.qty || it.quantity || 0);
        return {
          total: a.total + Number(r.total ?? 0),
          paid: a.paid + Number(r.paid ?? 0),
          due: a.due + Number(r.due ?? 0),
        };
      },
      { total: 0, paid: 0, due: 0 },
    );
    return res.json({ count: rows.length, totals: { ...totals, qty }, rows });
  } catch (err) {
    req.log.error({ err }, "issued medicines report failed");
    return res.status(500).json({ error: "Failed to load Issued Medicines report" });
  }
});

// 2) Medicine Purchase — vendor purchases (goods receipt) in date range
router.get("/reports/pharmacy/purchases", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const { fromDate, toDate } = p;
    const { vendorId, status, q } = req.query as Record<string, string>;
    const entityId = req.session.entityId ?? null;

    const filters: any[] = [
      scope(vendorPurchasesTable.entityId, entityId),
      gte(vendorPurchasesTable.invoiceDate, fromDate as any),
      lte(vendorPurchasesTable.invoiceDate, toDate as any),
    ];
    if (vendorId) {
      const id = parseInt(vendorId);
      if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid vendorId" });
      filters.push(eq(vendorPurchasesTable.vendorId, id));
    }
    if (status && ["paid", "partial", "unpaid", "pending"].includes(status)) filters.push(eq(vendorPurchasesTable.status, status));
    if (q) filters.push(or(ilike(vendorsTable.name, `%${q}%`), ilike(vendorPurchasesTable.invoiceNo, `%${q}%`))!);

    const rows = await db.select({
      purchaseId: vendorPurchasesTable.id,
      invoiceNo: vendorPurchasesTable.invoiceNo,
      invoiceDate: vendorPurchasesTable.invoiceDate,
      vendorId: vendorsTable.id,
      vendorName: vendorsTable.name,
      gstin: vendorsTable.gstin,
      subtotal: vendorPurchasesTable.subtotal,
      discount: vendorPurchasesTable.discount,
      gst: vendorPurchasesTable.gstAmount,
      total: vendorPurchasesTable.totalAmount,
      paid: vendorPurchasesTable.paidAmount,
      due: vendorPurchasesTable.dueAmount,
      status: vendorPurchasesTable.status,
      itemCount: sql<number>`coalesce(jsonb_array_length(${vendorPurchasesTable.items}),0)::int`,
    })
      .from(vendorPurchasesTable)
      .leftJoin(vendorsTable, eq(vendorPurchasesTable.vendorId, vendorsTable.id))
      .where(and(...filters))
      .orderBy(desc(vendorPurchasesTable.invoiceDate), desc(vendorPurchasesTable.id));

    const totals = rows.reduce(
      (a, r) => ({
        total: a.total + Number(r.total ?? 0),
        paid: a.paid + Number(r.paid ?? 0),
        due: a.due + Number(r.due ?? 0),
      }),
      { total: 0, paid: 0, due: 0 },
    );
    return res.json({ count: rows.length, totals, rows });
  } catch (err) {
    req.log.error({ err }, "purchases report failed");
    return res.status(500).json({ error: "Failed to load Medicine Purchase report" });
  }
});

// 3) IP Payment History — IPD invoices in range (pharmacy bills appear in the Issued Medicines tab).
router.get("/reports/pharmacy/ip-payments", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const { fromDate, toDate } = p;
    const { status, mode, q } = req.query as Record<string, string>;
    const entityId = req.session.entityId ?? null;

    const ipFilters: any[] = [
      scope(invoicesTable.entityId, entityId),
      isNotNull(invoicesTable.ipdAdmissionId),
      gte(invoicesTable.invoiceDate, fromDate),
      lte(invoicesTable.invoiceDate, toDate),
    ];
    if (status && ["paid", "partial", "pending"].includes(status)) ipFilters.push(eq(invoicesTable.status, status));
    if (mode) ipFilters.push(eq(invoicesTable.paymentMode, mode));
    if (q) ipFilters.push(or(ilike(patientsTable.name, `%${q}%`), ilike(patientsTable.uhid, `%${q}%`), ilike(invoicesTable.invoiceNo, `%${q}%`), ilike(ipdAdmissionsTable.ipdNo, `%${q}%`))!);

    const rows = await db.select({
      kind: sql<string>`'invoice'`.as("kind"),
      id: invoicesTable.id,
      billNo: invoicesTable.invoiceNo,
      billDate: invoicesTable.invoiceDate,
      patientName: patientsTable.name,
      uhid: patientsTable.uhid,
      ipdNo: ipdAdmissionsTable.ipdNo,
      total: invoicesTable.totalAmount,
      paid: invoicesTable.paidAmount,
      due: invoicesTable.dueAmount,
      status: invoicesTable.status,
      paymentMode: invoicesTable.paymentMode,
    })
      .from(invoicesTable)
      .leftJoin(patientsTable, eq(invoicesTable.patientId, patientsTable.id))
      .leftJoin(ipdAdmissionsTable, eq(invoicesTable.ipdAdmissionId, ipdAdmissionsTable.id))
      .where(and(...ipFilters))
      .orderBy(desc(invoicesTable.invoiceDate), desc(invoicesTable.id));

    const totals = rows.reduce(
      (a, r) => ({
        billed: a.billed + Number(r.total ?? 0),
        collected: a.collected + Number(r.paid ?? 0),
        due: a.due + Number(r.due ?? 0),
      }),
      { billed: 0, collected: 0, due: 0 },
    );

    // Mode breakdown
    const modeAgg: Record<string, number> = {};
    for (const r of rows) {
      const m = r.paymentMode || "—";
      modeAgg[m] = (modeAgg[m] || 0) + Number(r.paid ?? 0);
    }
    return res.json({ count: rows.length, totals, byMode: modeAgg, rows });
  } catch (err) {
    req.log.error({ err }, "ip payments report failed");
    return res.status(500).json({ error: "Failed to load IP Payment report" });
  }
});

export default router;
