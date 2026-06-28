import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryItemsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/inventory/items", async (req, res) => {
  try {
    const { category, search } = req.query;
    let items = await db.select().from(inventoryItemsTable).orderBy(inventoryItemsTable.name);
    if (category) items = items.filter(i => i.category === category);
    if (search) {
      const s = (search as string).toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(s));
    }
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list inventory items");
    res.status(500).json({ error: "Failed to list inventory items" });
  }
});

router.post("/inventory/items", async (req, res) => {
  try {
    const { name, category, unit, currentStock, reorderLevel, purchaseRate, vendor } = req.body;
    if (!name || !category || !unit || currentStock === undefined) {
      return res.status(400).json({ error: "name, category, unit, currentStock are required" });
    }
    const [item] = await db.insert(inventoryItemsTable).values({
      name, category, unit,
      currentStock: currentStock.toString(),
      reorderLevel: reorderLevel?.toString() || "10",
      purchaseRate: purchaseRate?.toString(),
      vendor,
    }).returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to create inventory item");
    res.status(500).json({ error: "Failed to create inventory item" });
  }
});

router.put("/inventory/items/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, category, unit, currentStock, reorderLevel, purchaseRate, vendor } = req.body;
    const [item] = await db.update(inventoryItemsTable).set({
      name, category, unit,
      currentStock: currentStock?.toString(),
      reorderLevel: reorderLevel?.toString(),
      purchaseRate: purchaseRate?.toString(),
      vendor, lastUpdated: new Date(),
    }).where(eq(inventoryItemsTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to update inventory item");
    res.status(500).json({ error: "Failed to update inventory item" });
  }
});

router.get("/inventory/summary", async (req, res) => {
  try {
    const items = await db.select().from(inventoryItemsTable);
    const lowStock = items.filter(i => parseFloat(i.currentStock) <= parseFloat(i.reorderLevel || "10"));
    const totalValue = items.reduce((s, i) => s + parseFloat(i.currentStock) * parseFloat(i.purchaseRate || "0"), 0);

    const categoryMap = new Map<string, number>();
    items.forEach(i => categoryMap.set(i.category, (categoryMap.get(i.category) || 0) + 1));
    const categories = Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count }));

    res.json({
      totalItems: items.length,
      lowStockCount: lowStock.length,
      totalValue,
      categories,
      lowStockItems: lowStock,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get inventory summary");
    res.status(500).json({ error: "Failed to get inventory summary" });
  }
});

export default router;
