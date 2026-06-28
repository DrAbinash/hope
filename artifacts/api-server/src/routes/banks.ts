import { Router } from "express";
import { db, bankDetailsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/banks", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const rows = await db.select().from(bankDetailsTable)
      .where(eq(bankDetailsTable.entityId, entityId))
      .orderBy(desc(bankDetailsTable.id));
    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list banks failed");
    return res.status(500).json({ error: "Failed to list bank details" });
  }
});

router.post("/banks", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const { bankName, accountHolderName, accountNo, ifscCode, branch, upiId } = req.body || {};
    if (!bankName || !accountHolderName || !accountNo || !branch) {
      return res.status(400).json({ error: "bankName, accountHolderName, accountNo and branch are required" });
    }
    const [row] = await db.insert(bankDetailsTable).values({
      entityId,
      bankName: String(bankName).trim(),
      accountHolderName: String(accountHolderName).trim(),
      accountNo: String(accountNo).trim(),
      ifscCode: ifscCode ? String(ifscCode).trim().toUpperCase() : null,
      branch: String(branch).trim(),
      upiId: upiId ? String(upiId).trim() : null,
    }).returning();
    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "create bank failed");
    return res.status(500).json({ error: "Failed to create bank details" });
  }
});

router.put("/banks/:id", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db.select().from(bankDetailsTable)
      .where(and(eq(bankDetailsTable.id, id), eq(bankDetailsTable.entityId, entityId)));
    if (!existing) return res.status(404).json({ error: "Bank not found" });
    const { bankName, accountHolderName, accountNo, ifscCode, branch, upiId, isActive } = req.body || {};
    const [row] = await db.update(bankDetailsTable).set({
      ...(bankName !== undefined ? { bankName: String(bankName).trim() } : {}),
      ...(accountHolderName !== undefined ? { accountHolderName: String(accountHolderName).trim() } : {}),
      ...(accountNo !== undefined ? { accountNo: String(accountNo).trim() } : {}),
      ...(ifscCode !== undefined ? { ifscCode: ifscCode ? String(ifscCode).trim().toUpperCase() : null } : {}),
      ...(branch !== undefined ? { branch: String(branch).trim() } : {}),
      ...(upiId !== undefined ? { upiId: upiId ? String(upiId).trim() : null } : {}),
      ...(isActive !== undefined ? { isActive: isActive ? 1 : 0 } : {}),
      updatedAt: new Date(),
    }).where(eq(bankDetailsTable.id, id)).returning();
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "update bank failed");
    return res.status(500).json({ error: "Failed to update bank details" });
  }
});

router.delete("/banks/:id", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const result = await db.delete(bankDetailsTable)
      .where(and(eq(bankDetailsTable.id, id), eq(bankDetailsTable.entityId, entityId)))
      .returning();
    if (result.length === 0) return res.status(404).json({ error: "Bank not found" });
    return res.json({ success: true, id });
  } catch (err) {
    req.log.error({ err }, "delete bank failed");
    return res.status(500).json({ error: "Failed to delete bank details" });
  }
});

export default router;
