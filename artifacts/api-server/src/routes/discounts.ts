import { Router } from "express";
import { db } from "@workspace/db";
import { discountApprovalsTable, invoicesTable, patientsTable } from "@workspace/db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

const router = Router();

function computeDiscount(amount: number, type: string, value: number): number {
  const v = Math.max(0, value);
  if (type === "percentage") {
    const pct = Math.min(100, v);
    return +Math.max(0, (amount * pct) / 100).toFixed(2);
  }
  return +Math.min(amount, v).toFixed(2);
}

const APPROVER_ROLES = ["admin"];

router.get("/discounts", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const { status, fromDate, toDate, patientId } = req.query as Record<string, string>;
    const conds = [eq(discountApprovalsTable.entityId, entityId)] as any[];
    if (status) conds.push(eq(discountApprovalsTable.status, status));
    if (patientId) {
      const pid = parseInt(patientId);
      if (Number.isNaN(pid)) return res.status(400).json({ error: "Invalid patientId" });
      conds.push(eq(discountApprovalsTable.patientId, pid));
    }
    const rows = await db.select().from(discountApprovalsTable).where(and(...conds)).orderBy(desc(discountApprovalsTable.createdAt));
    let filtered = rows;
    if (fromDate) filtered = filtered.filter(r => r.createdAt.toISOString().slice(0, 10) >= fromDate);
    if (toDate) filtered = filtered.filter(r => r.createdAt.toISOString().slice(0, 10) <= toDate);
    return res.json({ discounts: filtered });
  } catch (err) {
    req.log.error({ err }, "list discounts failed");
    return res.status(500).json({ error: "Failed to list discount approvals" });
  }
});

router.get("/discounts/:id", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [row] = await db.select().from(discountApprovalsTable)
      .where(and(eq(discountApprovalsTable.id, id), eq(discountApprovalsTable.entityId, entityId)));
    if (!row) return res.status(404).json({ error: "Discount request not found" });
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "get discount failed");
    return res.status(500).json({ error: "Failed to fetch discount request" });
  }
});

router.post("/discounts", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const role = (req.session as any)?.role;
    const username = (req.session as any)?.username || "unknown";
    const allowedRequesters = ["admin", "cashier", "receptionist", "doctor"];
    if (!role || !allowedRequesters.includes(role)) return res.status(403).json({ error: "Not allowed to request discount" });

    const { invoiceId, patientId, originalAmount, discountType, discountValue, reason } = req.body;
    if (originalAmount === undefined || discountValue === undefined || !reason) {
      return res.status(400).json({ error: "originalAmount, discountValue, reason are required" });
    }
    const orig = +Math.max(0, parseFloat(originalAmount)).toFixed(2);
    const dtype = discountType === "percentage" ? "percentage" : "fixed";
    const dval = +Math.max(0, parseFloat(discountValue)).toFixed(2);
    const damt = computeDiscount(orig, dtype, dval);

    let invType: string | null = null;
    let pName: string | null = null;
    let pId: number | null = patientId ?? null;
    let invIdNum: number | null = null;
    if (invoiceId !== undefined && invoiceId !== null && invoiceId !== "") {
      invIdNum = parseInt(invoiceId);
      if (Number.isNaN(invIdNum)) return res.status(400).json({ error: "Invalid invoiceId" });
      const [inv] = await db.select().from(invoicesTable)
        .where(and(eq(invoicesTable.id, invIdNum), eq(invoicesTable.entityId, entityId)));
      if (!inv) return res.status(404).json({ error: "Invoice not found" });
      invType = inv.type;
      pId = inv.patientId;
    }
    if (pId) {
      const [p] = await db.select().from(patientsTable).where(eq(patientsTable.id, pId));
      pName = p?.name || null;
    }

    const [row] = await db.insert(discountApprovalsTable).values({
      entityId,
      invoiceId: invIdNum,
      patientId: pId,
      patientName: pName,
      invoiceType: invType,
      originalAmount: orig.toString(),
      discountType: dtype,
      discountValue: dval.toString(),
      discountAmount: damt.toString(),
      reason,
      requestedBy: username,
      requestedRole: role,
      status: "pending",
    }).returning();
    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "create discount failed");
    return res.status(500).json({ error: "Failed to create discount request" });
  }
});

router.put("/discounts/:id", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const role = (req.session as any)?.role;
    const username = (req.session as any)?.username || "unknown";
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const [existing] = await db.select().from(discountApprovalsTable)
      .where(and(eq(discountApprovalsTable.id, id), eq(discountApprovalsTable.entityId, entityId)));
    if (!existing) return res.status(404).json({ error: "Discount request not found" });

    const { action, rejectionReason } = req.body as { action?: string; rejectionReason?: string };
    if (!action || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    }
    if (!APPROVER_ROLES.includes(role)) return res.status(403).json({ error: "Not allowed to approve/reject" });
    if (existing.status !== "pending") return res.status(400).json({ error: `Already ${existing.status}` });

    if (action === "approve") {
      const updated = await db.transaction(async (tx) => {
        const [u] = await tx.update(discountApprovalsTable).set({
          status: "approved",
          approvedBy: username,
          approvedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(discountApprovalsTable.id, id)).returning();

        if (existing.invoiceId && !existing.appliedToInvoice) {
          const [inv] = await tx.select().from(invoicesTable)
            .where(and(eq(invoicesTable.id, existing.invoiceId), eq(invoicesTable.entityId, entityId)));
          if (inv) {
            const existingDisc = parseFloat(inv.discount || "0");
            const addDisc = parseFloat(existing.discountAmount);
            const newDisc = existingDisc + addDisc;
            const subtotal = parseFloat(inv.subtotal);
            const gst = parseFloat(inv.gstAmount || "0");
            const newTotal = Math.max(0, subtotal - newDisc + gst);
            const paid = parseFloat(inv.paidAmount);
            const newDue = Math.max(0, newTotal - paid);
            const newStatus = newDue <= 0 ? "paid" : (paid > 0 ? "partial" : "pending");
            await tx.update(invoicesTable).set({
              discount: newDisc.toString(),
              totalAmount: newTotal.toString(),
              dueAmount: newDue.toString(),
              status: newStatus,
              updatedAt: new Date(),
            }).where(eq(invoicesTable.id, existing.invoiceId));
            await tx.update(discountApprovalsTable).set({ appliedToInvoice: true, updatedAt: new Date() })
              .where(eq(discountApprovalsTable.id, id));
          }
        }
        return u;
      });
      return res.json(updated);
    } else {
      const [updated] = await db.update(discountApprovalsTable).set({
        status: "rejected",
        approvedBy: username,
        approvedAt: new Date(),
        rejectionReason: rejectionReason || null,
        updatedAt: new Date(),
      }).where(eq(discountApprovalsTable.id, id)).returning();
      return res.json(updated);
    }
  } catch (err) {
    req.log.error({ err }, "update discount failed");
    return res.status(500).json({ error: "Failed to update discount request" });
  }
});

router.get("/discounts-report/summary", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const { fromDate, toDate } = req.query as Record<string, string>;
    const rows = await db.select().from(discountApprovalsTable)
      .where(eq(discountApprovalsTable.entityId, entityId))
      .orderBy(desc(discountApprovalsTable.createdAt));
    let filtered = rows;
    if (fromDate) filtered = filtered.filter(r => r.createdAt.toISOString().slice(0, 10) >= fromDate);
    if (toDate) filtered = filtered.filter(r => r.createdAt.toISOString().slice(0, 10) <= toDate);

    const totalRequested = filtered.length;
    const pending = filtered.filter(r => r.status === "pending").length;
    const approved = filtered.filter(r => r.status === "approved");
    const rejected = filtered.filter(r => r.status === "rejected");
    const totalApprovedAmount = approved.reduce((s, r) => s + parseFloat(r.discountAmount), 0);
    const totalOriginalAmount = approved.reduce((s, r) => s + parseFloat(r.originalAmount), 0);

    // by-requester breakdown
    const byRequester: Record<string, { count: number; amount: number }> = {};
    for (const r of approved) {
      const k = r.requestedBy || "unknown";
      byRequester[k] = byRequester[k] || { count: 0, amount: 0 };
      byRequester[k].count += 1;
      byRequester[k].amount += parseFloat(r.discountAmount);
    }

    return res.json({
      fromDate: fromDate || null,
      toDate: toDate || null,
      totals: {
        totalRequested,
        pending,
        approvedCount: approved.length,
        rejectedCount: rejected.length,
        totalApprovedAmount: +totalApprovedAmount.toFixed(2),
        totalOriginalAmount: +totalOriginalAmount.toFixed(2),
      },
      byRequester: Object.entries(byRequester).map(([requestedBy, v]) => ({ requestedBy, ...v, amount: +v.amount.toFixed(2) })),
      details: filtered,
    });
  } catch (err) {
    req.log.error({ err }, "discount report failed");
    return res.status(500).json({ error: "Failed to compute discount report" });
  }
});

export default router;
