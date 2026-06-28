import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();
const ISO_RX = /^\d{4}-\d{2}-\d{2}$/;

// 1) Outstanding Receivables — every patient with non-zero due across invoices + pharmacy_sales
router.get("/reports/patient-ledger/outstanding", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const { q } = req.query as Record<string, string>;
    const minDueRaw = parseFloat(String(req.query.minDue ?? "0.01"));
    const minDue = Number.isFinite(minDueRaw) ? minDueRaw : 0.01;

    const result = await db.execute(sql`
      WITH inv AS (
        SELECT patient_id,
               count(*) AS bills,
               sum(total_amount) AS billed,
               sum(paid_amount)  AS paid,
               sum(total_amount - paid_amount) AS due,
               max(invoice_date) AS last_date
        FROM invoices
        WHERE ${entityId ? sql`entity_id = ${entityId}` : sql`entity_id IS NULL`}
        GROUP BY patient_id
      ), ph AS (
        SELECT patient_id,
               count(*) AS bills,
               sum(total_amount) AS billed,
               sum(paid_amount)  AS paid,
               sum(total_amount - paid_amount) AS due,
               max(bill_date) AS last_date
        FROM pharmacy_sales
        WHERE ${entityId ? sql`entity_id = ${entityId}` : sql`entity_id IS NULL`}
        GROUP BY patient_id
      )
      SELECT p.id AS patient_id, p.uhid, p.name, p.phone,
             coalesce(inv.bills, 0) AS opd_bills,
             coalesce(ph.bills, 0)  AS pharmacy_bills,
             coalesce(inv.billed, 0) + coalesce(ph.billed, 0) AS billed,
             coalesce(inv.paid, 0)   + coalesce(ph.paid, 0)   AS paid,
             coalesce(inv.due, 0)    + coalesce(ph.due, 0)    AS due,
             greatest(coalesce(inv.last_date::text, ''),
                      coalesce(ph.last_date::text,  '')) AS last_activity
      FROM patients p
      LEFT JOIN inv ON inv.patient_id = p.id
      LEFT JOIN ph  ON ph.patient_id  = p.id
      WHERE (coalesce(inv.due, 0) + coalesce(ph.due, 0)) >= ${minDue}
        ${q ? sql`AND (p.name ILIKE ${"%" + q + "%"} OR p.uhid ILIKE ${"%" + q + "%"} OR p.phone ILIKE ${"%" + q + "%"})` : sql``}
      ORDER BY due DESC
    `);
    const rows = ((result as any).rows ?? result) as any[];
    const totals = rows.reduce(
      (a, r) => ({ patients: a.patients + 1, billed: a.billed + Number(r.billed || 0), paid: a.paid + Number(r.paid || 0), due: a.due + Number(r.due || 0) }),
      { patients: 0, billed: 0, paid: 0, due: 0 },
    );
    return res.json({ count: rows.length, totals, rows });
  } catch (err) {
    req.log.error({ err }, "outstanding receivables failed");
    return res.status(500).json({ error: "Failed to load Outstanding Receivables" });
  }
});

// 2) Patient Statement — chronological list of invoices + pharmacy sales for one patient
router.get("/reports/patient-ledger/statement", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const patientId = parseInt(String(req.query.patientId ?? ""), 10);
    if (!Number.isFinite(patientId) || patientId <= 0) return res.status(400).json({ error: "Invalid patientId" });
    const { fromDate, toDate } = req.query as Record<string, string>;
    if (fromDate && !ISO_RX.test(fromDate)) return res.status(400).json({ error: "fromDate must be ISO YYYY-MM-DD" });
    if (toDate && !ISO_RX.test(toDate)) return res.status(400).json({ error: "toDate must be ISO YYYY-MM-DD" });
    if (fromDate && toDate && fromDate > toDate) return res.status(400).json({ error: "fromDate must be on/before toDate" });

    const dateFilterInv = sql`
      ${fromDate ? sql`AND invoice_date >= ${fromDate}` : sql``}
      ${toDate ? sql`AND invoice_date <= ${toDate}` : sql``}
    `;
    const dateFilterPh = sql`
      ${fromDate ? sql`AND bill_date >= ${fromDate}` : sql``}
      ${toDate ? sql`AND bill_date <= ${toDate}` : sql``}
    `;

    const patient = await db.execute(sql`SELECT id, uhid, name, phone, age, gender FROM patients WHERE id = ${patientId} LIMIT 1`);
    const pRows = ((patient as any).rows ?? patient) as any[];
    if (pRows.length === 0) return res.status(404).json({ error: "Patient not found" });

    const txResult = await db.execute(sql`
      SELECT 'OPD/IPD' AS source, invoice_date AS date, invoice_no AS doc_no, type AS doc_type,
             total_amount AS billed, paid_amount AS paid, (total_amount - paid_amount) AS due,
             payment_mode AS mode, status
      FROM invoices
      WHERE patient_id = ${patientId}
        AND ${entityId ? sql`entity_id = ${entityId}` : sql`entity_id IS NULL`}
        ${dateFilterInv}
      UNION ALL
      SELECT 'Pharmacy' AS source, bill_date AS date, bill_no AS doc_no, 'Pharmacy' AS doc_type,
             total_amount AS billed, paid_amount AS paid, (total_amount - paid_amount) AS due,
             payment_mode AS mode, bill_status AS status
      FROM pharmacy_sales
      WHERE patient_id = ${patientId}
        AND ${entityId ? sql`entity_id = ${entityId}` : sql`entity_id IS NULL`}
        ${dateFilterPh}
      ORDER BY date ASC, doc_no ASC
    `);
    const txs = ((txResult as any).rows ?? txResult) as any[];

    let runningDue = 0;
    const enriched = txs.map(t => { runningDue += Number(t.due || 0); return { ...t, runningDue }; });
    const totals = txs.reduce(
      (a, t) => ({ billed: a.billed + Number(t.billed || 0), paid: a.paid + Number(t.paid || 0), due: a.due + Number(t.due || 0) }),
      { billed: 0, paid: 0, due: 0 },
    );
    return res.json({ patient: pRows[0], count: txs.length, totals, transactions: enriched });
  } catch (err) {
    req.log.error({ err }, "patient statement failed");
    return res.status(500).json({ error: "Failed to load Patient Statement" });
  }
});

export default router;
