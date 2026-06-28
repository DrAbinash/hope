import { Router } from "express";
import { db, medicinesTable, vendorPurchasesTable, pharmacySalesTable } from "@workspace/db";
import { and, eq, desc, gte, lte, sql, isNull, ilike, or, lt } from "drizzle-orm";

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

// 1) Stock-on-Hand
router.get("/reports/stock/on-hand", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const { q, category } = req.query as Record<string, string>;
    const filters: any[] = [scope(medicinesTable.entityId, entityId)];
    if (q) filters.push(or(ilike(medicinesTable.name, `%${q}%`), ilike(medicinesTable.genericName, `%${q}%`), ilike(medicinesTable.barcode, `%${q}%`))!);
    if (category) filters.push(eq(medicinesTable.category, category));

    const rows = await db.select({
      id: medicinesTable.id,
      name: medicinesTable.name,
      genericName: medicinesTable.genericName,
      category: medicinesTable.category,
      manufacturer: medicinesTable.manufacturer,
      batchNo: medicinesTable.batchNo,
      expiryDate: medicinesTable.expiryDate,
      stock: medicinesTable.stock,
      unit: medicinesTable.unit,
      reorderLevel: medicinesTable.reorderLevel,
      mrp: medicinesTable.mrp,
      saleRate: medicinesTable.saleRate,
      purchaseRate: medicinesTable.purchaseRate,
    })
      .from(medicinesTable)
      .where(and(...filters))
      .orderBy(medicinesTable.name);

    const totals = rows.reduce(
      (a, r) => {
        const stk = Number(r.stock || 0);
        return {
          items: a.items + 1,
          stock: a.stock + stk,
          mrpValue: a.mrpValue + stk * Number(r.mrp || 0),
          purchaseValue: a.purchaseValue + stk * Number(r.purchaseRate || 0),
        };
      },
      { items: 0, stock: 0, mrpValue: 0, purchaseValue: 0 },
    );
    return res.json({ count: rows.length, totals, rows });
  } catch (err) {
    req.log.error({ err }, "stock on-hand failed");
    return res.status(500).json({ error: "Failed to load Stock-on-Hand report" });
  }
});

// 2) Expiry Tracker — items expiring within N days (default 90)
router.get("/reports/stock/expiry", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const days = Math.max(1, Math.min(3650, parseInt(String(req.query.days ?? "90"), 10) || 90));
    const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const rows = await db.select({
      id: medicinesTable.id,
      name: medicinesTable.name,
      batchNo: medicinesTable.batchNo,
      expiryDate: medicinesTable.expiryDate,
      stock: medicinesTable.stock,
      unit: medicinesTable.unit,
      mrp: medicinesTable.mrp,
      purchaseRate: medicinesTable.purchaseRate,
    })
      .from(medicinesTable)
      .where(and(
        scope(medicinesTable.entityId, entityId),
        sql`${medicinesTable.expiryDate} IS NOT NULL`,
        lte(medicinesTable.expiryDate, cutoff),
        sql`${medicinesTable.stock} > 0`,
      ))
      .orderBy(medicinesTable.expiryDate);

    let expired = 0, near = 0;
    let lossValue = 0;
    for (const r of rows) {
      const stk = Number(r.stock || 0);
      const purch = Number(r.purchaseRate || 0);
      lossValue += stk * purch;
      if (r.expiryDate && r.expiryDate < today) expired++; else near++;
    }
    return res.json({ count: rows.length, days, cutoff, totals: { expired, near, lossValue }, rows });
  } catch (err) {
    req.log.error({ err }, "expiry tracker failed");
    return res.status(500).json({ error: "Failed to load Expiry Tracker report" });
  }
});

// 3) Reorder List — stock <= reorder_level
router.get("/reports/stock/reorder", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const rows = await db.select({
      id: medicinesTable.id,
      name: medicinesTable.name,
      category: medicinesTable.category,
      manufacturer: medicinesTable.manufacturer,
      stock: medicinesTable.stock,
      reorderLevel: medicinesTable.reorderLevel,
      unit: medicinesTable.unit,
      purchaseRate: medicinesTable.purchaseRate,
    })
      .from(medicinesTable)
      .where(and(
        scope(medicinesTable.entityId, entityId),
        sql`${medicinesTable.stock} <= COALESCE(${medicinesTable.reorderLevel}, 0)`,
      ))
      .orderBy(medicinesTable.name);

    let suggestedSpend = 0;
    const enriched = rows.map(r => {
      const reorder = Number(r.reorderLevel || 0);
      const suggested = Math.max(0, reorder * 2 - Number(r.stock || 0));
      const spend = suggested * Number(r.purchaseRate || 0);
      suggestedSpend += spend;
      return { ...r, suggestedQty: suggested, suggestedSpend: spend };
    });
    return res.json({ count: enriched.length, totals: { suggestedSpend }, rows: enriched });
  } catch (err) {
    req.log.error({ err }, "reorder list failed");
    return res.status(500).json({ error: "Failed to load Reorder List report" });
  }
});

// 4) Stock Movement — synthesized from vendor_purchases (IN) and pharmacy_sales (OUT) over a date range
router.get("/reports/stock/movement", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const { fromDate, toDate } = p;
    const { q } = req.query as Record<string, string>;
    const entityId = req.session.entityId ?? null;

    // Inflows from purchases
    const inflows = await db.execute(sql`
      SELECT
        coalesce(it->>'medicineName', it->>'name', it->>'description') AS name,
        coalesce((it->>'medicineId')::int, NULL) AS medicine_id,
        sum((it->>'quantity')::numeric) AS qty,
        sum((it->>'amount')::numeric) AS amount
      FROM vendor_purchases vp,
           jsonb_array_elements(vp.items) AS it
      WHERE ${entityId ? sql`vp.entity_id = ${entityId}` : sql`vp.entity_id IS NULL`}
        AND vp.invoice_date >= ${fromDate}
        AND vp.invoice_date <= ${toDate}
        ${q ? sql`AND (it->>'medicineName' ILIKE ${"%" + q + "%"} OR it->>'name' ILIKE ${"%" + q + "%"})` : sql``}
      GROUP BY 1, 2
    `);

    // Outflows from pharmacy sales
    const outflows = await db.execute(sql`
      SELECT
        coalesce(it->>'medicineName', it->>'name', it->>'description') AS name,
        coalesce((it->>'medicineId')::int, NULL) AS medicine_id,
        sum((it->>'quantity')::numeric) AS qty,
        sum((it->>'amount')::numeric) AS amount
      FROM pharmacy_sales ps,
           jsonb_array_elements(ps.items) AS it
      WHERE ${entityId ? sql`ps.entity_id = ${entityId}` : sql`ps.entity_id IS NULL`}
        AND ps.bill_date >= ${fromDate}
        AND ps.bill_date <= ${toDate}
        ${q ? sql`AND (it->>'medicineName' ILIKE ${"%" + q + "%"} OR it->>'name' ILIKE ${"%" + q + "%"})` : sql``}
      GROUP BY 1, 2
    `);

    const inList = ((inflows as any).rows ?? inflows) as any[];
    const outList = ((outflows as any).rows ?? outflows) as any[];
    const map = new Map<string, any>();
    const key = (r: any) => `${r.medicine_id ?? "-"}::${r.name ?? ""}`;
    for (const r of inList) {
      const k = key(r);
      const e = map.get(k) ?? { name: r.name, medicineId: r.medicine_id, inQty: 0, inAmount: 0, outQty: 0, outAmount: 0 };
      e.inQty += Number(r.qty || 0); e.inAmount += Number(r.amount || 0);
      map.set(k, e);
    }
    for (const r of outList) {
      const k = key(r);
      const e = map.get(k) ?? { name: r.name, medicineId: r.medicine_id, inQty: 0, inAmount: 0, outQty: 0, outAmount: 0 };
      e.outQty += Number(r.qty || 0); e.outAmount += Number(r.amount || 0);
      map.set(k, e);
    }
    const rows = Array.from(map.values()).map(r => ({ ...r, netQty: r.inQty - r.outQty })).sort((a, b) => Math.abs(b.netQty) - Math.abs(a.netQty));
    const totals = rows.reduce(
      (a, r) => ({
        inQty: a.inQty + r.inQty,
        outQty: a.outQty + r.outQty,
        inAmount: a.inAmount + r.inAmount,
        outAmount: a.outAmount + r.outAmount,
      }),
      { inQty: 0, outQty: 0, inAmount: 0, outAmount: 0 },
    );
    return res.json({ count: rows.length, totals, rows });
  } catch (err) {
    req.log.error({ err }, "stock movement failed");
    return res.status(500).json({ error: "Failed to load Stock Movement report" });
  }
});

export default router;
