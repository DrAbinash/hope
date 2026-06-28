import { Router } from "express";
import { db } from "@workspace/db";
import { indentsTable, indentItemsTable, medicinesTable, inventoryItemsTable } from "@workspace/db";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { requireRole } from "./auth";

const router = Router();

const STATE_GUARD = requireRole("admin", "pharmacist");

function generateIndentNo(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const num = Math.floor(1000 + Math.random() * 9000);
  return `IND${dateStr}${num}`;
}

router.get("/indents", async (req, res) => {
  try {
    const { status } = req.query as Record<string, string>;
    const entityId = req.session.entityId ?? 1;
    let rows = await db.select().from(indentsTable).where(eq(indentsTable.entityId, entityId)).orderBy(desc(indentsTable.createdAt));
    if (status) rows = rows.filter(r => r.status === status);
    const ids = rows.map(r => r.id);
    const items = ids.length
      ? await db.select().from(indentItemsTable).where(sql`${indentItemsTable.indentId} = ANY(${ids})`)
      : [];
    const byIndent: Record<number, typeof items> = {};
    for (const it of items) {
      if (!byIndent[it.indentId]) byIndent[it.indentId] = [];
      byIndent[it.indentId].push(it);
    }
    res.json(rows.map(r => ({ ...r, items: byIndent[r.id] || [] })));
  } catch (err) {
    req.log.error({ err }, "Failed to list indents");
    res.status(500).json({ error: "Failed to list indents" });
  }
});

router.post("/indents", async (req, res) => {
  try {
    const { department, requestedBy, notes, items } = req.body as {
      department: string; requestedBy: string; notes?: string;
      items: Array<{ itemType: string; itemId: number; itemName: string; unit?: string; requestedQty: number }>;
    };
    if (!department || !requestedBy || !items?.length) {
      return res.status(400).json({ error: "department, requestedBy, and items are required" });
    }
    const entityId = req.session.entityId ?? 1;
    const indentNo = generateIndentNo();
    const created = await db.transaction(async (tx) => {
      const [indent] = await tx.insert(indentsTable).values({
        entityId, indentNo, department, requestedBy, notes: notes || null,
      }).returning();
      const inserted = await tx.insert(indentItemsTable).values(
        items.map(i => ({
          indentId: indent.id,
          itemType: i.itemType,
          itemId: i.itemId,
          itemName: i.itemName,
          unit: i.unit || null,
          requestedQty: i.requestedQty.toString(),
        }))
      ).returning();
      return { ...indent, items: inserted };
    });
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create indent");
    res.status(500).json({ error: "Failed to create indent" });
  }
});

router.post("/indents/:id/approve", STATE_GUARD, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const [indent] = await db.update(indentsTable)
      .set({ status: "approved", approvedAt: new Date() })
      .where(and(eq(indentsTable.id, id), eq(indentsTable.entityId, entityId), eq(indentsTable.status, "pending")))
      .returning();
    if (!indent) return res.status(409).json({ error: "Indent not in pending state" });
    res.json(indent);
  } catch (err) {
    req.log.error({ err }, "Failed to approve indent");
    res.status(500).json({ error: "Failed to approve indent" });
  }
});

// Issue — atomic transaction. Flips status from 'approved' → 'issued' as a guard against
// double-issue races, then decrements stock with guarded WHERE stock >= qty AND entityId match.
router.post("/indents/:id/issue", STATE_GUARD, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const { issuedQty } = req.body as { issuedQty?: Record<number, number> };

    const result = await db.transaction(async (tx) => {
      const [indent] = await tx.update(indentsTable)
        .set({ status: "issued", issuedAt: new Date() })
        .where(and(eq(indentsTable.id, id), eq(indentsTable.entityId, entityId), eq(indentsTable.status, "approved")))
        .returning();
      if (!indent) throw new Error("Indent not in approved state (or already issued)");

      const items = await tx.select().from(indentItemsTable).where(eq(indentItemsTable.indentId, id));

      for (const it of items) {
        const qty = issuedQty?.[it.id] ?? parseFloat(it.requestedQty);
        if (qty <= 0) continue;
        if (it.itemType === "medicine") {
          const intQty = Math.floor(qty);
          const updated = await tx.update(medicinesTable)
            .set({ stock: sql`${medicinesTable.stock} - ${intQty}`, updatedAt: new Date() })
            .where(and(eq(medicinesTable.id, it.itemId), eq(medicinesTable.entityId, entityId), gte(medicinesTable.stock, intQty)))
            .returning({ id: medicinesTable.id });
          if (updated.length === 0) throw new Error(`Insufficient stock for ${it.itemName}`);
        } else if (it.itemType === "inventory") {
          const updated = await tx.update(inventoryItemsTable)
            .set({ currentStock: sql`${inventoryItemsTable.currentStock} - ${qty.toString()}`, lastUpdated: new Date() })
            .where(and(
              eq(inventoryItemsTable.id, it.itemId),
              eq(inventoryItemsTable.entityId, entityId),
              gte(inventoryItemsTable.currentStock, qty.toString()),
            ))
            .returning({ id: inventoryItemsTable.id });
          if (updated.length === 0) throw new Error(`Insufficient stock for ${it.itemName}`);
        }
        await tx.update(indentItemsTable)
          .set({ issuedQty: qty.toString() })
          .where(eq(indentItemsTable.id, it.id));
      }

      return indent;
    });

    res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "Failed to issue indent");
    const msg = err?.message || "Failed to issue indent";
    const code = msg.includes("Insufficient") || msg.includes("approved state") ? 409 : 500;
    res.status(code).json({ error: msg });
  }
});

router.post("/indents/:id/cancel", STATE_GUARD, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const [indent] = await db.update(indentsTable)
      .set({ status: "cancelled" })
      .where(and(eq(indentsTable.id, id), eq(indentsTable.entityId, entityId), sql`${indentsTable.status} IN ('pending','approved')`))
      .returning();
    if (!indent) return res.status(409).json({ error: "Indent cannot be cancelled in its current state" });
    res.json(indent);
  } catch (err) {
    req.log.error({ err }, "Failed to cancel indent");
    res.status(500).json({ error: "Failed to cancel indent" });
  }
});

export default router;
