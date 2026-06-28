import { Router } from "express";
import { db, invoicesTable, patientsTable, opdVisitsTable, ipdAdmissionsTable, employeesTable } from "@workspace/db";
import { and, eq, desc, gte, lte, sql, isNull, ilike, or } from "drizzle-orm";

const router = Router();
const ISO_RX = /^\d{4}-\d{2}-\d{2}$/;

function scope(col: any, entityId: number | null) {
  return entityId ? eq(col, entityId) : isNull(col);
}

function parseDates(req: any) {
  const { fromDate, toDate } = req.query as Record<string, string>;
  if (!fromDate || !toDate) return { error: "fromDate and toDate are required" };
  if (!ISO_RX.test(fromDate) || !ISO_RX.test(toDate)) return { error: "Dates must be ISO YYYY-MM-DD" };
  if (fromDate > toDate) return { error: "fromDate must be on/before toDate" };
  if ((Date.parse(toDate) - Date.parse(fromDate)) / 86400000 > 366) return { error: "Date range cannot exceed 366 days" };
  return { fromDate, toDate };
}

// 1) Daily Service Report — aggregate items jsonb by date + service
router.get("/reports/finance/daily-service", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const { fromDate, toDate } = p;
    const { type, q } = req.query as Record<string, string>;
    const entityId = req.session.entityId ?? null;

    const rows = await db.execute(sql`
      SELECT
        i.invoice_date AS date,
        coalesce(it->>'description','—') AS service,
        coalesce(it->>'code','') AS code,
        sum((it->>'quantity')::numeric) AS qty,
        sum((it->>'amount')::numeric) AS amount,
        count(distinct i.id)::int AS bill_count
      FROM invoices i,
           jsonb_array_elements(i.items) AS it
      WHERE ${entityId ? sql`i.entity_id = ${entityId}` : sql`i.entity_id IS NULL`}
        AND i.invoice_date >= ${fromDate}
        AND i.invoice_date <= ${toDate}
        ${type ? sql`AND i.type = ${type}` : sql``}
        ${q ? sql`AND (it->>'description' ILIKE ${"%" + q + "%"} OR it->>'code' ILIKE ${"%" + q + "%"})` : sql``}
      GROUP BY i.invoice_date, it->>'description', it->>'code'
      ORDER BY i.invoice_date DESC, amount DESC
    `);

    const list = (rows as any).rows ?? rows;
    const totals = list.reduce(
      (a: any, r: any) => ({ qty: a.qty + Number(r.qty || 0), amount: a.amount + Number(r.amount || 0) }),
      { qty: 0, amount: 0 },
    );
    return res.json({ count: list.length, totals, rows: list });
  } catch (err) {
    req.log.error({ err }, "daily service report failed");
    return res.status(500).json({ error: "Failed to load Daily Service report" });
  }
});

// 2) Doctor-Wise Service Taken — group invoices by attributed doctor
router.get("/reports/finance/doctor-wise", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const { fromDate, toDate } = p;
    const { doctorId } = req.query as Record<string, string>;
    const entityId = req.session.entityId ?? null;

    let docFilter = sql``;
    if (doctorId) {
      const id = parseInt(doctorId);
      if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid doctorId" });
      docFilter = sql`AND coalesce(o.doctor_id, a.consultant_doctor_id) = ${id}`;
    }

    // Per-doctor aggregate
    const byDoctor = await db.execute(sql`
      SELECT
        coalesce(o.doctor_id, a.consultant_doctor_id) AS doctor_id,
        e.name AS doctor_name,
        count(distinct i.id)::int AS bills,
        count(distinct i.patient_id)::int AS patients,
        sum(i.subtotal::numeric) AS subtotal,
        sum(i.total_amount::numeric) AS billed,
        sum(i.paid_amount::numeric) AS paid,
        sum(i.due_amount::numeric) AS due
      FROM invoices i
      LEFT JOIN opd_visits o ON i.opd_visit_id = o.id
      LEFT JOIN ipd_admissions a ON i.ipd_admission_id = a.id
      LEFT JOIN employees e ON e.id = coalesce(o.doctor_id, a.consultant_doctor_id)
      WHERE ${entityId ? sql`i.entity_id = ${entityId}` : sql`i.entity_id IS NULL`}
        AND i.invoice_date >= ${fromDate}
        AND i.invoice_date <= ${toDate}
        AND coalesce(o.doctor_id, a.consultant_doctor_id) IS NOT NULL
        ${docFilter}
      GROUP BY coalesce(o.doctor_id, a.consultant_doctor_id), e.name
      ORDER BY billed DESC NULLS LAST
    `);

    // Per-service-per-doctor breakdown
    const byService = await db.execute(sql`
      SELECT
        coalesce(o.doctor_id, a.consultant_doctor_id) AS doctor_id,
        coalesce(it->>'description','—') AS service,
        sum((it->>'quantity')::numeric) AS qty,
        sum((it->>'amount')::numeric) AS amount
      FROM invoices i
      LEFT JOIN opd_visits o ON i.opd_visit_id = o.id
      LEFT JOIN ipd_admissions a ON i.ipd_admission_id = a.id,
      jsonb_array_elements(i.items) AS it
      WHERE ${entityId ? sql`i.entity_id = ${entityId}` : sql`i.entity_id IS NULL`}
        AND i.invoice_date >= ${fromDate}
        AND i.invoice_date <= ${toDate}
        AND coalesce(o.doctor_id, a.consultant_doctor_id) IS NOT NULL
        ${docFilter}
      GROUP BY coalesce(o.doctor_id, a.consultant_doctor_id), it->>'description'
      ORDER BY amount DESC
    `);

    const docList = ((byDoctor as any).rows ?? byDoctor) as any[];
    const svcList = ((byService as any).rows ?? byService) as any[];
    const totals = docList.reduce(
      (a, r) => ({
        bills: a.bills + Number(r.bills || 0),
        patients: a.patients + Number(r.patients || 0),
        billed: a.billed + Number(r.billed || 0),
        paid: a.paid + Number(r.paid || 0),
        due: a.due + Number(r.due || 0),
      }),
      { bills: 0, patients: 0, billed: 0, paid: 0, due: 0 },
    );
    return res.json({ count: docList.length, totals, doctors: docList, services: svcList });
  } catch (err) {
    req.log.error({ err }, "doctor-wise report failed");
    return res.status(500).json({ error: "Failed to load Doctor-Wise report" });
  }
});

// 3) Receipt Details — list of receipts (paid invoices) with mode breakdown
router.get("/reports/finance/receipts", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const { fromDate, toDate } = p;
    const { mode, type, q } = req.query as Record<string, string>;
    const entityId = req.session.entityId ?? null;

    const filters: any[] = [
      scope(invoicesTable.entityId, entityId),
      gte(invoicesTable.invoiceDate, fromDate),
      lte(invoicesTable.invoiceDate, toDate),
      sql`${invoicesTable.paidAmount}::numeric > 0`,
    ];
    if (mode) filters.push(eq(invoicesTable.paymentMode, mode));
    if (type) filters.push(eq(invoicesTable.type, type));
    if (q) filters.push(or(ilike(patientsTable.name, `%${q}%`), ilike(patientsTable.uhid, `%${q}%`), ilike(invoicesTable.invoiceNo, `%${q}%`))!);

    const rows = await db.select({
      id: invoicesTable.id,
      invoiceNo: invoicesTable.invoiceNo,
      invoiceDate: invoicesTable.invoiceDate,
      type: invoicesTable.type,
      patientName: patientsTable.name,
      uhid: patientsTable.uhid,
      total: invoicesTable.totalAmount,
      paid: invoicesTable.paidAmount,
      due: invoicesTable.dueAmount,
      mode: invoicesTable.paymentMode,
      collectedBy: invoicesTable.collectedBy,
      status: invoicesTable.status,
    })
      .from(invoicesTable)
      .leftJoin(patientsTable, eq(invoicesTable.patientId, patientsTable.id))
      .where(and(...filters))
      .orderBy(desc(invoicesTable.invoiceDate), desc(invoicesTable.id));

    const totals = rows.reduce(
      (a, r) => ({
        billed: a.billed + Number(r.total ?? 0),
        collected: a.collected + Number(r.paid ?? 0),
        due: a.due + Number(r.due ?? 0),
      }),
      { billed: 0, collected: 0, due: 0 },
    );
    const byMode: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const r of rows) {
      const m = r.mode || "—"; byMode[m] = (byMode[m] || 0) + Number(r.paid ?? 0);
      const t = r.type || "—"; byType[t] = (byType[t] || 0) + Number(r.paid ?? 0);
    }
    return res.json({ count: rows.length, totals, byMode, byType, rows });
  } catch (err) {
    req.log.error({ err }, "receipts report failed");
    return res.status(500).json({ error: "Failed to load Receipt Details report" });
  }
});

// Doctor list for filter dropdown — restricted to entity scope
router.get("/reports/finance/doctors", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const rows = await db.select({ id: employeesTable.id, name: employeesTable.name, role: employeesTable.role })
      .from(employeesTable)
      .where(and(scope(employeesTable.entityId, entityId), or(eq(employeesTable.role, "doctor"), eq(employeesTable.role, "consultant"))!))
      .orderBy(employeesTable.name);
    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "doctors lookup failed");
    return res.status(500).json({ error: "Failed to load doctors" });
  }
});

export default router;
