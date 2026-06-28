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

// 1) Output GST — month-wise from pharmacy_sales (CGST/SGST/IGST split) + invoices (gst lump)
router.get("/reports/gst/output", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const entityId = req.session.entityId ?? null;

    const pharmacy = await db.execute(sql`
      SELECT to_char(bill_date::date, 'YYYY-MM') AS month,
             count(*) AS bills,
             sum(subtotal - discount) AS taxable,
             sum(cgst_amount) AS cgst,
             sum(sgst_amount) AS sgst,
             sum(igst_amount) AS igst,
             sum(gst_amount) AS gst_total,
             sum(total_amount) AS gross
      FROM pharmacy_sales
      WHERE ${entityId ? sql`entity_id = ${entityId}` : sql`entity_id IS NULL`}
        AND bill_date >= ${p.fromDate} AND bill_date <= ${p.toDate}
      GROUP BY 1 ORDER BY 1
    `);
    const services = await db.execute(sql`
      SELECT to_char(invoice_date::date, 'YYYY-MM') AS month,
             count(*) AS bills,
             sum(subtotal - discount) AS taxable,
             sum(gst_amount) AS gst_total,
             sum(total_amount) AS gross
      FROM invoices
      WHERE ${entityId ? sql`entity_id = ${entityId}` : sql`entity_id IS NULL`}
        AND invoice_date >= ${p.fromDate} AND invoice_date <= ${p.toDate}
      GROUP BY 1 ORDER BY 1
    `);

    const phRows = ((pharmacy as any).rows ?? pharmacy) as any[];
    const svRows = ((services as any).rows ?? services) as any[];
    const months = new Map<string, any>();
    for (const r of phRows) {
      months.set(r.month, {
        month: r.month,
        pharmacyBills: Number(r.bills || 0),
        pharmacyTaxable: Number(r.taxable || 0),
        cgst: Number(r.cgst || 0), sgst: Number(r.sgst || 0), igst: Number(r.igst || 0),
        pharmacyGst: Number(r.gst_total || 0), pharmacyGross: Number(r.gross || 0),
        serviceBills: 0, serviceTaxable: 0, serviceGst: 0, serviceGross: 0,
      });
    }
    for (const r of svRows) {
      const e = months.get(r.month) ?? {
        month: r.month,
        pharmacyBills: 0, pharmacyTaxable: 0, cgst: 0, sgst: 0, igst: 0, pharmacyGst: 0, pharmacyGross: 0,
        serviceBills: 0, serviceTaxable: 0, serviceGst: 0, serviceGross: 0,
      };
      e.serviceBills = Number(r.bills || 0);
      e.serviceTaxable = Number(r.taxable || 0);
      e.serviceGst = Number(r.gst_total || 0);
      e.serviceGross = Number(r.gross || 0);
      months.set(r.month, e);
    }
    const rows = Array.from(months.values()).map(r => ({ ...r, gstTotal: r.pharmacyGst + r.serviceGst, grossTotal: r.pharmacyGross + r.serviceGross })).sort((a, b) => a.month.localeCompare(b.month));
    const totals = rows.reduce(
      (a, r) => ({
        pharmacyBills: a.pharmacyBills + r.pharmacyBills,
        serviceBills: a.serviceBills + r.serviceBills,
        cgst: a.cgst + r.cgst, sgst: a.sgst + r.sgst, igst: a.igst + r.igst,
        pharmacyGst: a.pharmacyGst + r.pharmacyGst,
        serviceGst: a.serviceGst + r.serviceGst,
        gstTotal: a.gstTotal + r.gstTotal,
        grossTotal: a.grossTotal + r.grossTotal,
      }),
      { pharmacyBills: 0, serviceBills: 0, cgst: 0, sgst: 0, igst: 0, pharmacyGst: 0, serviceGst: 0, gstTotal: 0, grossTotal: 0 },
    );
    return res.json({ count: rows.length, totals, rows });
  } catch (err) {
    req.log.error({ err }, "gst output failed");
    return res.status(500).json({ error: "Failed to load GST Output report" });
  }
});

// 2) Input GST — month-wise from vendor_purchases (CGST/SGST/IGST split)
router.get("/reports/gst/input", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const entityId = req.session.entityId ?? null;

    const result = await db.execute(sql`
      SELECT to_char(invoice_date::date, 'YYYY-MM') AS month,
             count(*) AS purchases,
             sum(subtotal - discount) AS taxable,
             sum(cgst_amount) AS cgst,
             sum(sgst_amount) AS sgst,
             sum(igst_amount) AS igst,
             sum(gst_amount) AS gst_total,
             sum(total_amount) AS gross
      FROM vendor_purchases
      WHERE ${entityId ? sql`entity_id = ${entityId}` : sql`entity_id IS NULL`}
        AND invoice_date >= ${p.fromDate} AND invoice_date <= ${p.toDate}
      GROUP BY 1 ORDER BY 1
    `);
    const rows = (((result as any).rows ?? result) as any[]).map(r => ({
      month: r.month,
      purchases: Number(r.purchases || 0),
      taxable: Number(r.taxable || 0),
      cgst: Number(r.cgst || 0), sgst: Number(r.sgst || 0), igst: Number(r.igst || 0),
      gstTotal: Number(r.gst_total || 0), gross: Number(r.gross || 0),
    }));
    const totals = rows.reduce(
      (a, r) => ({
        purchases: a.purchases + r.purchases,
        taxable: a.taxable + r.taxable,
        cgst: a.cgst + r.cgst, sgst: a.sgst + r.sgst, igst: a.igst + r.igst,
        gstTotal: a.gstTotal + r.gstTotal,
        gross: a.gross + r.gross,
      }),
      { purchases: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, gstTotal: 0, gross: 0 },
    );
    return res.json({ count: rows.length, totals, rows });
  } catch (err) {
    req.log.error({ err }, "gst input failed");
    return res.status(500).json({ error: "Failed to load GST Input report" });
  }
});

// 3) Net GST Liability — output - input
router.get("/reports/gst/liability", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const entityId = req.session.entityId ?? null;

    const out = await db.execute(sql`
      SELECT to_char(bill_date::date, 'YYYY-MM') AS month,
             sum(cgst_amount) AS cgst, sum(sgst_amount) AS sgst, sum(igst_amount) AS igst,
             sum(gst_amount)  AS gst_total
      FROM pharmacy_sales
      WHERE ${entityId ? sql`entity_id = ${entityId}` : sql`entity_id IS NULL`}
        AND bill_date >= ${p.fromDate} AND bill_date <= ${p.toDate}
      GROUP BY 1
      UNION ALL
      SELECT to_char(invoice_date::date, 'YYYY-MM') AS month,
             0 AS cgst, 0 AS sgst, 0 AS igst, sum(gst_amount) AS gst_total
      FROM invoices
      WHERE ${entityId ? sql`entity_id = ${entityId}` : sql`entity_id IS NULL`}
        AND invoice_date >= ${p.fromDate} AND invoice_date <= ${p.toDate}
      GROUP BY 1
    `);
    const inp = await db.execute(sql`
      SELECT to_char(invoice_date::date, 'YYYY-MM') AS month,
             sum(cgst_amount) AS cgst, sum(sgst_amount) AS sgst, sum(igst_amount) AS igst,
             sum(gst_amount) AS gst_total
      FROM vendor_purchases
      WHERE ${entityId ? sql`entity_id = ${entityId}` : sql`entity_id IS NULL`}
        AND invoice_date >= ${p.fromDate} AND invoice_date <= ${p.toDate}
      GROUP BY 1
    `);
    const outRows = ((out as any).rows ?? out) as any[];
    const inRows = ((inp as any).rows ?? inp) as any[];
    const months = new Map<string, any>();
    for (const r of outRows) {
      const e = months.get(r.month) ?? { month: r.month, outCgst: 0, outSgst: 0, outIgst: 0, outTotal: 0, inCgst: 0, inSgst: 0, inIgst: 0, inTotal: 0 };
      e.outCgst += Number(r.cgst || 0); e.outSgst += Number(r.sgst || 0); e.outIgst += Number(r.igst || 0); e.outTotal += Number(r.gst_total || 0);
      months.set(r.month, e);
    }
    for (const r of inRows) {
      const e = months.get(r.month) ?? { month: r.month, outCgst: 0, outSgst: 0, outIgst: 0, outTotal: 0, inCgst: 0, inSgst: 0, inIgst: 0, inTotal: 0 };
      e.inCgst = Number(r.cgst || 0); e.inSgst = Number(r.sgst || 0); e.inIgst = Number(r.igst || 0); e.inTotal = Number(r.gst_total || 0);
      months.set(r.month, e);
    }
    const rows = Array.from(months.values())
      .map(r => ({
        ...r,
        netCgst: r.outCgst - r.inCgst,
        netSgst: r.outSgst - r.inSgst,
        netIgst: r.outIgst - r.inIgst,
        netTotal: r.outTotal - r.inTotal,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
    const totals = rows.reduce(
      (a, r) => ({
        outTotal: a.outTotal + r.outTotal,
        inTotal: a.inTotal + r.inTotal,
        netTotal: a.netTotal + r.netTotal,
        netCgst: a.netCgst + r.netCgst,
        netSgst: a.netSgst + r.netSgst,
        netIgst: a.netIgst + r.netIgst,
      }),
      { outTotal: 0, inTotal: 0, netTotal: 0, netCgst: 0, netSgst: 0, netIgst: 0 },
    );
    return res.json({ count: rows.length, totals, rows });
  } catch (err) {
    req.log.error({ err }, "gst liability failed");
    return res.status(500).json({ error: "Failed to load GST Liability report" });
  }
});

export default router;
