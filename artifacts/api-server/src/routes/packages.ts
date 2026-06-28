import { Router } from "express";
import { db } from "@workspace/db";
import { packagesTable, packageItemsTable, billingHeadsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/packages", async (_req, res) => {
  try {
    const pkgs = await db.select().from(packagesTable).orderBy(packagesTable.name);
    const items = await db.select({
      id: packageItemsTable.id,
      packageId: packageItemsTable.packageId,
      quantity: packageItemsTable.quantity,
      billingHeadId: packageItemsTable.billingHeadId,
      headName: billingHeadsTable.name,
      headCode: billingHeadsTable.code,
      headRate: billingHeadsTable.defaultRate,
      headCategory: billingHeadsTable.category,
    }).from(packageItemsTable).innerJoin(billingHeadsTable, eq(packageItemsTable.billingHeadId, billingHeadsTable.id));

    res.json(pkgs.map((p) => ({
      ...p,
      items: items.filter((i) => i.packageId === p.id),
    })));
  } catch {
    res.status(500).json({ error: "Failed to list packages" });
  }
});

router.post("/packages", async (req, res) => {
  try {
    const { entityId, code, name, description, category, packageRate, validityDays, items } = req.body;
    if (!code || !name || !packageRate || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "code, name, packageRate and at least one item are required" });
    }
    const headIds = items.map((i: { billingHeadId: number }) => i.billingHeadId);
    const heads = await db.select().from(billingHeadsTable);
    const headMap = new Map(heads.map((h) => [h.id, h]));
    let mrp = 0;
    for (const it of items) {
      const h = headMap.get(it.billingHeadId);
      if (!h) return res.status(400).json({ error: `Billing head ${it.billingHeadId} not found` });
      mrp += Number(h.defaultRate) * (it.quantity || 1);
    }

    const [pkg] = await db.insert(packagesTable).values({
      entityId, code, name, description, category,
      mrpTotal: mrp.toString(),
      packageRate: packageRate.toString(),
      validityDays,
    }).returning();

    if (items.length > 0) {
      await db.insert(packageItemsTable).values(items.map((it: { billingHeadId: number; quantity?: number }) => ({
        packageId: pkg.id,
        billingHeadId: it.billingHeadId,
        quantity: it.quantity || 1,
      })));
    }
    res.status(201).json(pkg);
    void headIds;
  } catch (err) {
    res.status(500).json({ error: "Failed to create package" });
  }
});

export default router;
