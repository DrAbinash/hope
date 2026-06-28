import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();
const ISO_RX = /^\d{4}-\d{2}-\d{2}$/;

function parseDates(req: any) {
  const { fromDate, toDate } = req.query as Record<string, string>;
  if (!fromDate || !toDate) return { error: "fromDate and toDate are required" };
  if (!ISO_RX.test(fromDate) || !ISO_RX.test(toDate)) return { error: "Dates must be ISO YYYY-MM-DD" };
  if (fromDate > toDate) return { error: "fromDate must be on/before toDate" };
  if ((Date.parse(toDate) - Date.parse(fromDate)) / 86400000 > 366) return { error: "Date range cannot exceed 366 days" };
  return { fromDate, toDate };
}

// Per-doctor productivity: OPD visits/fees, IPD admissions/active/avg LOS, invoice revenue billed+collected
router.get("/reports/doctor-performance", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const entityId = req.session.entityId ?? null;
    const role = req.session.role;
    const userId = req.session.userId;
    const { doctorId } = req.query as Record<string, string>;
    let docFilter: number | null = doctorId ? Number(doctorId) : null;
    if (doctorId !== undefined && (docFilter === null || !Number.isFinite(docFilter))) {
      return res.status(400).json({ error: "doctorId must be numeric" });
    }
    // Privacy: a doctor user can only see their own performance row, regardless of any docFilter override.
    if (role === "doctor") {
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      docFilter = userId;
    }

    // Entity scope is now direct on opd_visits / ipd_admissions (entity_id backfilled + NOT NULL).
    const entityDocScope = entityId
      ? sql`AND entity_id = ${entityId}`
      : sql`AND entity_id IS NULL`;
    const entityIpdScope = entityDocScope;

    // 1) OPD visits
    const opd = await db.execute(sql`
      SELECT doctor_id,
             count(*) AS visits,
             count(*) FILTER (WHERE status = 'completed') AS completed,
             count(*) FILTER (WHERE converted_to_ipd = true) AS converted,
             coalesce(sum(fee), 0) AS consult_fees
      FROM opd_visits
      WHERE visit_date >= ${p.fromDate} AND visit_date <= ${p.toDate}
        ${entityDocScope}
        ${docFilter ? sql`AND doctor_id = ${docFilter}` : sql``}
      GROUP BY doctor_id
    `);

    // 2) IPD admissions
    const ipd = await db.execute(sql`
      SELECT consultant_doctor_id AS doctor_id,
             count(*) AS admissions,
             count(*) FILTER (WHERE status = 'admitted') AS active,
             count(*) FILTER (WHERE status = 'discharged') AS discharged,
             coalesce(avg(EXTRACT(EPOCH FROM (discharge_date::timestamp - admission_date::timestamp)) / 86400)
                      FILTER (WHERE status = 'discharged' AND discharge_date IS NOT NULL AND discharge_date <> ''), 0) AS avg_los
      FROM ipd_admissions
      WHERE admission_date >= ${p.fromDate} AND admission_date <= ${p.toDate}
        ${entityIpdScope}
        ${docFilter ? sql`AND consultant_doctor_id = ${docFilter}` : sql``}
      GROUP BY consultant_doctor_id
    `);

    // 3) Revenue from invoices linked to OPD visits
    const opdRev = await db.execute(sql`
      SELECT v.doctor_id AS doctor_id,
             count(i.id) AS bills,
             coalesce(sum(i.total_amount), 0) AS billed,
             coalesce(sum(i.paid_amount), 0)  AS collected
      FROM invoices i
      JOIN opd_visits v ON v.id = i.opd_visit_id
      WHERE ${entityId ? sql`i.entity_id = ${entityId}` : sql`i.entity_id IS NULL`}
        AND i.invoice_date >= ${p.fromDate} AND i.invoice_date <= ${p.toDate}
        ${docFilter ? sql`AND v.doctor_id = ${docFilter}` : sql``}
      GROUP BY v.doctor_id
    `);

    // 4) Revenue from invoices linked to IPD admissions
    const ipdRev = await db.execute(sql`
      SELECT a.consultant_doctor_id AS doctor_id,
             count(i.id) AS bills,
             coalesce(sum(i.total_amount), 0) AS billed,
             coalesce(sum(i.paid_amount), 0)  AS collected
      FROM invoices i
      JOIN ipd_admissions a ON a.id = i.ipd_admission_id
      WHERE ${entityId ? sql`i.entity_id = ${entityId}` : sql`i.entity_id IS NULL`}
        AND i.invoice_date >= ${p.fromDate} AND i.invoice_date <= ${p.toDate}
        ${docFilter ? sql`AND a.consultant_doctor_id = ${docFilter}` : sql``}
      GROUP BY a.consultant_doctor_id
    `);

    // 5) Doctor names
    const docs = await db.execute(sql`
      SELECT id, name, department, designation FROM employees
      WHERE role = 'doctor'
        AND ${entityId ? sql`(entity_id = ${entityId} OR entity_id IS NULL)` : sql`entity_id IS NULL`}
        ${docFilter ? sql`AND id = ${docFilter}` : sql``}
    `);

    const rows = (xs: any) => ((xs as any).rows ?? xs) as any[];
    const docMap = new Map<number, { name: string; department: string | null; designation: string | null }>();
    for (const d of rows(docs)) docMap.set(Number(d.id), { name: d.name, department: d.department, designation: d.designation });

    const acc = new Map<number, any>();
    const ensure = (did: number) => {
      if (!acc.has(did)) {
        const meta = docMap.get(did);
        acc.set(did, {
          doctorId: did,
          doctorName: meta?.name ?? `Doctor #${did}`,
          department: meta?.department ?? null,
          designation: meta?.designation ?? null,
          opdVisits: 0, opdCompleted: 0, opdConverted: 0, consultFees: 0,
          ipdAdmissions: 0, ipdActive: 0, ipdDischarged: 0, avgLos: 0,
          opdBills: 0, opdBilled: 0, opdCollected: 0,
          ipdBills: 0, ipdBilled: 0, ipdCollected: 0,
          totalBilled: 0, totalCollected: 0,
        });
      }
      return acc.get(did);
    };
    for (const r of rows(opd)) {
      if (r.doctor_id == null) continue;
      const e = ensure(Number(r.doctor_id));
      e.opdVisits = Number(r.visits || 0);
      e.opdCompleted = Number(r.completed || 0);
      e.opdConverted = Number(r.converted || 0);
      e.consultFees = Number(r.consult_fees || 0);
    }
    for (const r of rows(ipd)) {
      if (r.doctor_id == null) continue;
      const e = ensure(Number(r.doctor_id));
      e.ipdAdmissions = Number(r.admissions || 0);
      e.ipdActive = Number(r.active || 0);
      e.ipdDischarged = Number(r.discharged || 0);
      e.avgLos = Number(r.avg_los || 0);
    }
    for (const r of rows(opdRev)) {
      if (r.doctor_id == null) continue;
      const e = ensure(Number(r.doctor_id));
      e.opdBills = Number(r.bills || 0);
      e.opdBilled = Number(r.billed || 0);
      e.opdCollected = Number(r.collected || 0);
    }
    for (const r of rows(ipdRev)) {
      if (r.doctor_id == null) continue;
      const e = ensure(Number(r.doctor_id));
      e.ipdBills = Number(r.bills || 0);
      e.ipdBilled = Number(r.billed || 0);
      e.ipdCollected = Number(r.collected || 0);
    }
    const out = Array.from(acc.values()).map(r => ({
      ...r,
      totalBilled: r.opdBilled + r.ipdBilled,
      totalCollected: r.opdCollected + r.ipdCollected,
      revenuePerVisit: r.opdVisits > 0 ? (r.opdBilled + r.consultFees) / r.opdVisits : 0,
    })).sort((a, b) => (b.totalBilled + b.consultFees) - (a.totalBilled + a.consultFees));

    const totals = out.reduce((a, r) => ({
      doctors: a.doctors + 1,
      opdVisits: a.opdVisits + r.opdVisits,
      ipdAdmissions: a.ipdAdmissions + r.ipdAdmissions,
      consultFees: a.consultFees + r.consultFees,
      totalBilled: a.totalBilled + r.totalBilled,
      totalCollected: a.totalCollected + r.totalCollected,
    }), { doctors: 0, opdVisits: 0, ipdAdmissions: 0, consultFees: 0, totalBilled: 0, totalCollected: 0 });

    return res.json({ count: out.length, totals, rows: out });
  } catch (err) {
    req.log.error({ err }, "doctor performance failed");
    return res.status(500).json({ error: "Failed to load Doctor Performance report" });
  }
});

export default router;
