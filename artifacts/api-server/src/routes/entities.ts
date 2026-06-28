import { Router } from "express";
import { db } from "@workspace/db";
import { entitiesTable, invoicesTable, pharmacySalesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/entities", async (_req, res) => {
  try {
    const rows = await db.select().from(entitiesTable).orderBy(entitiesTable.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to list entities" });
  }
});

router.post("/entities", async (req, res) => {
  try {
    const { name, type, owner, gstin, pan, address, mobile, email } = req.body;
    if (!name || !type || !owner) return res.status(400).json({ error: "name, type and owner are required" });
    const [entity] = await db.insert(entitiesTable).values({ name, type, owner, gstin, pan, address, mobile, email }).returning();
    res.status(201).json(entity);
  } catch (err) {
    res.status(500).json({ error: "Failed to create entity" });
  }
});

router.put("/entities/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, type, owner, gstin, pan, address, mobile, email } = req.body;
    const [entity] = await db
      .update(entitiesTable)
      .set({ name, type, owner, gstin, pan, address, mobile, email })
      .where(eq(entitiesTable.id, id))
      .returning();
    if (!entity) return res.status(404).json({ error: "Entity not found" });
    res.json(entity);
  } catch (err) {
    res.status(500).json({ error: "Failed to update entity" });
  }
});

router.get("/entities/summary", async (_req, res) => {
  try {
    const entities = await db.select().from(entitiesTable).orderBy(entitiesTable.id);

    const invoiceAgg = await db
      .select({
        entityId: invoicesTable.entityId,
        totalRevenue: sql<string>`COALESCE(SUM(${invoicesTable.totalAmount}), 0)`,
        totalCollection: sql<string>`COALESCE(SUM(${invoicesTable.paidAmount}), 0)`,
        totalOutstanding: sql<string>`COALESCE(SUM(${invoicesTable.dueAmount}), 0)`,
        invoiceCount: sql<number>`COUNT(*)::int`,
      })
      .from(invoicesTable)
      .groupBy(invoicesTable.entityId);

    const pharmacyAgg = await db
      .select({
        entityId: pharmacySalesTable.entityId,
        totalRevenue: sql<string>`COALESCE(SUM(${pharmacySalesTable.totalAmount}), 0)`,
        totalCollection: sql<string>`COALESCE(SUM(${pharmacySalesTable.paidAmount}), 0)`,
        totalOutstanding: sql<string>`COALESCE(SUM(${pharmacySalesTable.dueAmount}), 0)`,
        invoiceCount: sql<number>`COUNT(*)::int`,
      })
      .from(pharmacySalesTable)
      .groupBy(pharmacySalesTable.entityId);

    const summary = entities.map((e) => {
      const inv = invoiceAgg.find((r) => r.entityId === e.id);
      const phar = pharmacyAgg.find((r) => r.entityId === e.id);
      const totalRevenue = Number(inv?.totalRevenue || 0) + Number(phar?.totalRevenue || 0);
      const totalCollection = Number(inv?.totalCollection || 0) + Number(phar?.totalCollection || 0);
      const totalOutstanding = Number(inv?.totalOutstanding || 0) + Number(phar?.totalOutstanding || 0);
      const invoiceCount = (inv?.invoiceCount || 0) + (phar?.invoiceCount || 0);
      return {
        entityId: e.id,
        entityName: e.name,
        entityType: e.type,
        owner: e.owner,
        totalRevenue,
        totalCollection,
        totalOutstanding,
        invoiceCount,
      };
    });

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: "Failed to compute entity summary" });
  }
});

export default router;
