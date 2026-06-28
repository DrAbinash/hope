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

const STANDALONE_BY_TYPE: Record<string, string> = {
  Pathology: "Pathology", PATHOLOGY: "Pathology", pathology: "Pathology",
  Radiology: "Radiology", RADIOLOGY: "Radiology", radiology: "Radiology",
  OT: "Operation Theatre", ot: "Operation Theatre",
  OPD: "OPD (Unassigned)", opd: "OPD (Unassigned)",
  IPD: "IPD (Unassigned)", ipd: "IPD (Unassigned)",
};

router.get("/reports/department-revenue", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const entityId = req.session.entityId ?? null;
    const entityScope = entityId ? sql`entity_id = ${entityId}` : sql`entity_id IS NULL`;

    // 1) OPD-linked invoices: bucket by doctor's department
    const opdRev = await db.execute(sql`
      SELECT coalesce(e.department, 'OPD (Unknown)') AS department,
             count(i.id) AS bills,
             coalesce(sum(i.total_amount), 0) AS billed,
             coalesce(sum(i.paid_amount), 0)  AS collected
      FROM invoices i
      JOIN opd_visits v ON v.id = i.opd_visit_id
      LEFT JOIN employees e ON e.id = v.doctor_id
      WHERE i.${entityScope}
        AND i.invoice_date >= ${p.fromDate} AND i.invoice_date <= ${p.toDate}
      GROUP BY 1
    `);

    // 2) IPD-linked invoices: bucket by consultant's department
    const ipdRev = await db.execute(sql`
      SELECT coalesce(e.department, 'IPD (Unknown)') AS department,
             count(i.id) AS bills,
             coalesce(sum(i.total_amount), 0) AS billed,
             coalesce(sum(i.paid_amount), 0)  AS collected
      FROM invoices i
      JOIN ipd_admissions a ON a.id = i.ipd_admission_id
      LEFT JOIN employees e ON e.id = a.consultant_doctor_id
      WHERE i.${entityScope}
        AND i.invoice_date >= ${p.fromDate} AND i.invoice_date <= ${p.toDate}
      GROUP BY 1
    `);

    // 3) Standalone invoices (no opd/ipd link): bucket by invoice.type
    const stRev = await db.execute(sql`
      SELECT type AS itype,
             count(*) AS bills,
             coalesce(sum(total_amount), 0) AS billed,
             coalesce(sum(paid_amount), 0)  AS collected
      FROM invoices
      WHERE ${entityScope}
        AND invoice_date >= ${p.fromDate} AND invoice_date <= ${p.toDate}
        AND opd_visit_id IS NULL AND ipd_admission_id IS NULL
      GROUP BY type
    `);

    // 4) Pharmacy
    const ph = await db.execute(sql`
      SELECT count(*) AS bills,
             coalesce(sum(total_amount), 0) AS billed,
             coalesce(sum(paid_amount), 0)  AS collected
      FROM pharmacy_sales
      WHERE ${entityScope}
        AND bill_date >= ${p.fromDate} AND bill_date <= ${p.toDate}
    `);

    const rows = (xs: any) => ((xs as any).rows ?? xs) as any[];
    const acc = new Map<string, any>();
    const ensure = (dept: string) => {
      if (!acc.has(dept)) acc.set(dept, { department: dept, bills: 0, billed: 0, collected: 0, due: 0 });
      return acc.get(dept);
    };
    const add = (dept: string, bills: number, billed: number, collected: number) => {
      const e = ensure(dept);
      e.bills += bills; e.billed += billed; e.collected += collected;
    };
    for (const r of rows(opdRev)) add(r.department, Number(r.bills || 0), Number(r.billed || 0), Number(r.collected || 0));
    for (const r of rows(ipdRev)) add(r.department, Number(r.bills || 0), Number(r.billed || 0), Number(r.collected || 0));
    for (const r of rows(stRev)) {
      const dept = STANDALONE_BY_TYPE[r.itype as string] ?? `Standalone (${r.itype})`;
      add(dept, Number(r.bills || 0), Number(r.billed || 0), Number(r.collected || 0));
    }
    const phRow = rows(ph)[0];
    if (phRow && Number(phRow.bills || 0) > 0) {
      add("Pharmacy", Number(phRow.bills || 0), Number(phRow.billed || 0), Number(phRow.collected || 0));
    }

    const out = Array.from(acc.values()).map(r => ({ ...r, due: r.billed - r.collected })).sort((a, b) => b.billed - a.billed);
    const grand = out.reduce((a, r) => ({
      bills: a.bills + r.bills, billed: a.billed + r.billed, collected: a.collected + r.collected, due: a.due + r.due,
    }), { bills: 0, billed: 0, collected: 0, due: 0 });
    const withShare = out.map(r => ({ ...r, sharePct: grand.billed > 0 ? (r.billed / grand.billed) * 100 : 0 }));

    return res.json({ count: out.length, totals: grand, rows: withShare });
  } catch (err) {
    req.log.error({ err }, "department revenue failed");
    return res.status(500).json({ error: "Failed to load Department Revenue report" });
  }
});

export default router;
