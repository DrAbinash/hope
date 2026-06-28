import { Router } from "express";
import { db } from "@workspace/db";
import { billingHeadsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/billing-heads", async (_req, res) => {
  try {
    const rows = await db.select().from(billingHeadsTable).orderBy(billingHeadsTable.category, billingHeadsTable.name);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to list billing heads" });
  }
});

router.post("/billing-heads", async (req, res) => {
  try {
    const { entityId, code, name, category, defaultRate, gstPercent, hsnSac, ledgerName, isActive } = req.body;
    if (!code || !name || !category || defaultRate == null) {
      return res.status(400).json({ error: "code, name, category and defaultRate are required" });
    }
    const [head] = await db.insert(billingHeadsTable).values({
      entityId, code, name, category,
      defaultRate: defaultRate.toString(),
      gstPercent: gstPercent != null ? gstPercent.toString() : "0",
      hsnSac, ledgerName,
      isActive: isActive ?? true,
    }).returning();
    res.status(201).json(head);
  } catch (err) {
    res.status(500).json({ error: "Failed to create billing head" });
  }
});

router.put("/billing-heads/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { entityId, code, name, category, defaultRate, gstPercent, hsnSac, ledgerName, isActive } = req.body;
    const [head] = await db.update(billingHeadsTable).set({
      entityId, code, name, category,
      defaultRate: defaultRate?.toString(),
      gstPercent: gstPercent?.toString(),
      hsnSac, ledgerName, isActive,
    }).where(eq(billingHeadsTable.id, id)).returning();
    if (!head) return res.status(404).json({ error: "Billing head not found" });
    res.json(head);
  } catch (err) {
    res.status(500).json({ error: "Failed to update billing head" });
  }
});

export default router;
