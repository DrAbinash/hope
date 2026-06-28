import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, employeesTable } from "@workspace/db";
import { sql, and, gte, lte } from "drizzle-orm";

const router = Router();

router.get("/reports/daily-collection", async (req, res) => {
  try {
    const from = (req.query.from as string) || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);

    const rows = await db.select({
      date: invoicesTable.invoiceDate,
      entityId: invoicesTable.entityId,
      paymentMode: invoicesTable.paymentMode,
      collected: sql<string>`COALESCE(SUM(${invoicesTable.paidAmount}), 0)`,
      billed: sql<string>`COALESCE(SUM(${invoicesTable.totalAmount}), 0)`,
      due: sql<string>`COALESCE(SUM(${invoicesTable.dueAmount}), 0)`,
      invoices: sql<number>`COUNT(*)::int`,
    })
      .from(invoicesTable)
      .where(and(
        gte(invoicesTable.invoiceDate, from),
        lte(invoicesTable.invoiceDate, to),
      ))
      .groupBy(invoicesTable.invoiceDate, invoicesTable.entityId, invoicesTable.paymentMode)
      .orderBy(sql`${invoicesTable.invoiceDate} DESC`);

    res.json({ from, to, rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to compute daily collection" });
  }
});

router.get("/reports/user-collection", async (req, res) => {
  try {
    const from = (req.query.from as string) || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);

    const rows = await db.select({
      collectedBy: invoicesTable.collectedBy,
      entityId: invoicesTable.entityId,
      paymentMode: invoicesTable.paymentMode,
      collected: sql<string>`COALESCE(SUM(${invoicesTable.paidAmount}), 0)`,
      invoices: sql<number>`COUNT(*)::int`,
    })
      .from(invoicesTable)
      .where(and(
        gte(invoicesTable.invoiceDate, from),
        lte(invoicesTable.invoiceDate, to),
      ))
      .groupBy(invoicesTable.collectedBy, invoicesTable.entityId, invoicesTable.paymentMode);

    const employees = await db.select().from(employeesTable);
    const empMap = new Map(employees.map((e) => [e.username, e.name]));
    const enriched = rows.map((r) => ({
      ...r,
      collectorName: r.collectedBy ? (empMap.get(r.collectedBy) || r.collectedBy) : "Unassigned",
    }));
    res.json({ from, to, rows: enriched });
  } catch (err) {
    res.status(500).json({ error: "Failed to compute user collection" });
  }
});

export default router;
