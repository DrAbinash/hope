import { Router } from "express";
import { db } from "@workspace/db";
import { vendorsTable, vendorPurchasesTable, vendorPaymentsTable, medicinesTable } from "@workspace/db";
import { eq, sql, desc, and, gte, lte } from "drizzle-orm";
import { requireRole } from "./auth";

const router = Router();

const ADMIN_PHARM = requireRole("admin", "pharmacist");

// Money/quantity guards
function num(v: any, def = 0) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : def;
}
function assertNonNeg(v: number, label: string) {
  if (v < 0) throw new Error(`${label} must be >= 0`);
}
function assertPositive(v: number, label: string) {
  if (!(v > 0)) throw new Error(`${label} must be > 0`);
}

router.get("/vendors", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    const { active, search } = req.query as Record<string, string>;
    let rows = await db.select().from(vendorsTable)
      .where(entityId ? eq(vendorsTable.entityId, entityId) : undefined)
      .orderBy(vendorsTable.name);
    if (active === "true") rows = rows.filter(v => v.isActive);
    if (active === "false") rows = rows.filter(v => !v.isActive);
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(v =>
        v.name.toLowerCase().includes(s) ||
        (v.contactPerson || "").toLowerCase().includes(s) ||
        (v.gstin || "").toLowerCase().includes(s)
      );
    }
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list vendors");
    res.status(500).json({ error: "Failed to list vendors" });
  }
});

router.get("/vendors/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId;
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, id));
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    if (entityId && vendor.entityId !== entityId) return res.status(404).json({ error: "Vendor not found" });

    const purchases = await db.select().from(vendorPurchasesTable)
      .where(eq(vendorPurchasesTable.vendorId, id))
      .orderBy(desc(vendorPurchasesTable.invoiceDate));
    const payments = await db.select().from(vendorPaymentsTable)
      .where(eq(vendorPaymentsTable.vendorId, id))
      .orderBy(desc(vendorPaymentsTable.paymentDate));

    const totalPurchases = purchases.reduce((s, p) => s + parseFloat(p.totalAmount), 0);
    // Include ALL vendor payments (on-account + invoice-linked) for true vendor balance
    const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amount), 0);
    const opening = parseFloat(vendor.openingBalance || "0");
    const outstanding = opening + totalPurchases - totalPaid;

    res.json({ ...vendor, purchases, payments, summary: { totalPurchases, totalPaid, outstanding, openingBalance: opening } });
  } catch (err) {
    req.log.error({ err }, "Failed to get vendor");
    res.status(500).json({ error: "Failed to get vendor" });
  }
});

router.post("/vendors", ADMIN_PHARM, async (req, res) => {
  try {
    const b = req.body;
    if (!b.name) return res.status(400).json({ error: "name is required" });
    const opening = num(b.openingBalance, 0);
    assertNonNeg(opening, "openingBalance");
    const [vendor] = await db.insert(vendorsTable).values({
      entityId: req.session.entityId ?? null,
      name: b.name,
      contactPerson: b.contactPerson || null,
      phone: b.phone || null,
      email: b.email || null,
      address: b.address || null,
      gstin: b.gstin || null,
      pan: b.pan || null,
      drugLicenseNo: b.drugLicenseNo || null,
      paymentTerms: b.paymentTerms || "Net 30",
      openingBalance: opening.toString(),
      isActive: b.isActive ?? true,
      notes: b.notes || null,
    }).returning();
    res.status(201).json(vendor);
  } catch (err: any) {
    req.log.error({ err }, "Failed to create vendor");
    res.status(400).json({ error: err.message || "Failed to create vendor" });
  }
});

router.put("/vendors/:id", ADMIN_PHARM, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId;
    const b = req.body;
    const opening = num(b.openingBalance, 0);
    assertNonNeg(opening, "openingBalance");
    const [vendor] = await db.update(vendorsTable).set({
      name: b.name,
      contactPerson: b.contactPerson || null,
      phone: b.phone || null,
      email: b.email || null,
      address: b.address || null,
      gstin: b.gstin || null,
      pan: b.pan || null,
      drugLicenseNo: b.drugLicenseNo || null,
      paymentTerms: b.paymentTerms || "Net 30",
      openingBalance: opening.toString(),
      isActive: b.isActive ?? true,
      notes: b.notes || null,
      updatedAt: new Date(),
    }).where(and(eq(vendorsTable.id, id), entityId ? eq(vendorsTable.entityId, entityId) : undefined as any)).returning();
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    res.json(vendor);
  } catch (err: any) {
    req.log.error({ err }, "Failed to update vendor");
    res.status(400).json({ error: err.message || "Failed to update vendor" });
  }
});

router.get("/vendor-purchases", async (req, res) => {
  try {
    const { vendorId, from, to } = req.query as Record<string, string>;
    const entityId = req.session.entityId;
    const conditions = [];
    if (entityId) conditions.push(eq(vendorPurchasesTable.entityId, entityId));
    if (vendorId) conditions.push(eq(vendorPurchasesTable.vendorId, parseInt(vendorId)));
    if (from) conditions.push(gte(vendorPurchasesTable.invoiceDate, from));
    if (to) conditions.push(lte(vendorPurchasesTable.invoiceDate, to));
    const rows = await db.select({
      id: vendorPurchasesTable.id,
      vendorId: vendorPurchasesTable.vendorId,
      vendorName: vendorsTable.name,
      invoiceNo: vendorPurchasesTable.invoiceNo,
      invoiceDate: vendorPurchasesTable.invoiceDate,
      items: vendorPurchasesTable.items,
      subtotal: vendorPurchasesTable.subtotal,
      discount: vendorPurchasesTable.discount,
      gstAmount: vendorPurchasesTable.gstAmount,
      cgstAmount: vendorPurchasesTable.cgstAmount,
      sgstAmount: vendorPurchasesTable.sgstAmount,
      igstAmount: vendorPurchasesTable.igstAmount,
      gstStateType: vendorPurchasesTable.gstStateType,
      totalAmount: vendorPurchasesTable.totalAmount,
      paidAmount: vendorPurchasesTable.paidAmount,
      dueAmount: vendorPurchasesTable.dueAmount,
      status: vendorPurchasesTable.status,
      createdAt: vendorPurchasesTable.createdAt,
    }).from(vendorPurchasesTable)
      .leftJoin(vendorsTable, eq(vendorPurchasesTable.vendorId, vendorsTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(vendorPurchasesTable.invoiceDate));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list purchases");
    res.status(500).json({ error: "Failed to list vendor purchases" });
  }
});

// Goods receipt — atomic txn:
//   * verify vendor belongs to caller entity
//   * validate every medicineId, qty>0, rate>=0
//   * compute GST on discount-adjusted (taxable) base, allocated proportionally per line
//   * stock += qty as guarded update; if 0 rows updated → rollback
router.post("/vendor-purchases", ADMIN_PHARM, async (req, res) => {
  try {
    const { vendorId, invoiceNo, invoiceDate, items, gstStateType = "intra", notes } = req.body as any;
    const discount = num(req.body.discount, 0);
    const paidAmount = num(req.body.paidAmount, 0);
    const entityId = req.session.entityId ?? null;

    if (!vendorId || !invoiceNo || !invoiceDate || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "vendorId, invoiceNo, invoiceDate, items required" });
    }
    assertNonNeg(discount, "discount");
    assertNonNeg(paidAmount, "paidAmount");

    for (const it of items) {
      assertPositive(num(it.quantity), "item quantity");
      assertNonNeg(num(it.purchaseRate), "item purchaseRate");
      assertNonNeg(num(it.gstPercent, 0), "item gstPercent");
    }

    const result = await db.transaction(async (tx) => {
      // Vendor must exist and (if multi-entity) belong to same entity
      const [vendor] = await tx.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId));
      if (!vendor) throw new Error("Vendor not found");
      if (entityId && vendor.entityId && vendor.entityId !== entityId) throw new Error("Vendor not in your entity");

      const lineGross = (i: any) => num(i.quantity) * num(i.purchaseRate);
      const subtotal = items.reduce((s: number, i: any) => s + lineGross(i), 0);
      if (discount > subtotal) throw new Error("discount cannot exceed subtotal");

      // GST on discount-adjusted taxable base, allocated by line gross share
      let gstAmount = 0;
      const enriched = items.map((i: any) => {
        const gross = lineGross(i);
        const share = subtotal > 0 ? gross / subtotal : 0;
        const taxable = gross - discount * share;
        const lineGst = taxable * num(i.gstPercent, 0) / 100;
        gstAmount += lineGst;
        return { ...i, taxable, lineGst };
      });

      let cgst = 0, sgst = 0, igst = 0;
      if (gstStateType === "inter") igst = gstAmount;
      else { cgst = gstAmount / 2; sgst = gstAmount / 2; }
      const totalAmount = subtotal - discount + gstAmount;
      if (paidAmount > totalAmount + 0.01) throw new Error("paidAmount cannot exceed total");
      const dueAmount = totalAmount - paidAmount;

      // Verify every medicine + apply atomic stock add (returning to confirm row updated)
      for (const it of items) {
        if (!it.medicineId) throw new Error(`Line missing medicineId`);
        const qty = Math.floor(num(it.quantity));
        const updateSet: any = {
          stock: sql`${medicinesTable.stock} + ${qty}`,
          updatedAt: new Date(),
        };
        if (it.batchNo) updateSet.batchNo = it.batchNo;
        if (it.expiryDate) updateSet.expiryDate = it.expiryDate;
        if (it.purchaseRate !== undefined) updateSet.purchaseRate = num(it.purchaseRate).toString();
        const updated = await tx.update(medicinesTable).set(updateSet)
          .where(entityId
            ? and(eq(medicinesTable.id, it.medicineId), eq(medicinesTable.entityId, entityId))
            : eq(medicinesTable.id, it.medicineId))
          .returning({ id: medicinesTable.id });
        if (updated.length === 0) throw new Error(`Medicine #${it.medicineId} not found in your entity`);
      }

      const [purchase] = await tx.insert(vendorPurchasesTable).values({
        entityId,
        vendorId, invoiceNo, invoiceDate,
        items: enriched,
        subtotal: subtotal.toString(),
        discount: discount.toString(),
        gstAmount: gstAmount.toString(),
        cgstAmount: cgst.toString(),
        sgstAmount: sgst.toString(),
        igstAmount: igst.toString(),
        gstStateType,
        totalAmount: totalAmount.toString(),
        paidAmount: paidAmount.toString(),
        dueAmount: dueAmount.toString(),
        status: paidAmount <= 0.01 ? "received" : (dueAmount <= 0.01 ? "paid" : "partial"),
        notes: notes || null,
      }).returning();

      if (paidAmount > 0) {
        await tx.insert(vendorPaymentsTable).values({
          vendorId,
          purchaseId: purchase.id,
          paymentDate: invoiceDate,
          amount: paidAmount.toString(),
          mode: "On Invoice",
          reference: invoiceNo,
        });
      }

      return purchase;
    });

    res.status(201).json(result);
  } catch (err: any) {
    req.log.error({ err }, "Failed to create purchase");
    const code = /not found|exceed|>=|>|missing|entity/i.test(err?.message || "") ? 400 : 500;
    res.status(code).json({ error: err.message || "Failed to record purchase" });
  }
});

router.get("/vendor-payments", async (req, res) => {
  try {
    const { vendorId } = req.query as Record<string, string>;
    const rows = await db.select({
      id: vendorPaymentsTable.id,
      vendorId: vendorPaymentsTable.vendorId,
      vendorName: vendorsTable.name,
      purchaseId: vendorPaymentsTable.purchaseId,
      paymentDate: vendorPaymentsTable.paymentDate,
      amount: vendorPaymentsTable.amount,
      mode: vendorPaymentsTable.mode,
      reference: vendorPaymentsTable.reference,
      notes: vendorPaymentsTable.notes,
      createdAt: vendorPaymentsTable.createdAt,
    }).from(vendorPaymentsTable)
      .leftJoin(vendorsTable, eq(vendorPaymentsTable.vendorId, vendorsTable.id))
      .where(vendorId ? eq(vendorPaymentsTable.vendorId, parseInt(vendorId)) : undefined)
      .orderBy(desc(vendorPaymentsTable.paymentDate));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list payments");
    res.status(500).json({ error: "Failed to list vendor payments" });
  }
});

// Payment — atomic txn:
//   * vendor must exist
//   * if linked to a purchase, the purchase must belong to that vendor
//   * amount > 0, capped to outstanding due
//   * paid_amount/due_amount updated via atomic SQL increment (no read-modify-write race)
router.post("/vendor-payments", ADMIN_PHARM, async (req, res) => {
  try {
    const { vendorId, paymentDate, mode, reference, notes } = req.body;
    const purchaseId = req.body.purchaseId ? parseInt(req.body.purchaseId) : null;
    const amount = num(req.body.amount);
    if (!vendorId || !paymentDate || !mode) return res.status(400).json({ error: "vendorId, paymentDate, mode required" });
    assertPositive(amount, "amount");

    const result = await db.transaction(async (tx) => {
      const [vendor] = await tx.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId));
      if (!vendor) throw new Error("Vendor not found");

      if (purchaseId) {
        // Atomic, race-safe update: only succeeds if purchase belongs to this vendor
        // and remaining due is sufficient. Returning row gives us the new balance.
        const updated = await tx.update(vendorPurchasesTable)
          .set({
            paidAmount: sql`${vendorPurchasesTable.paidAmount} + ${amount}`,
            dueAmount: sql`${vendorPurchasesTable.dueAmount} - ${amount}`,
            status: sql`CASE WHEN ${vendorPurchasesTable.dueAmount} - ${amount} <= 0.01 THEN 'paid' ELSE 'partial' END`,
          })
          .where(and(
            eq(vendorPurchasesTable.id, purchaseId),
            eq(vendorPurchasesTable.vendorId, vendorId),
            gte(vendorPurchasesTable.dueAmount, amount.toString()),
          ))
          .returning({ id: vendorPurchasesTable.id });
        if (updated.length === 0) {
          throw new Error("Payment exceeds outstanding due, or invoice does not belong to this vendor");
        }
      }

      const [payment] = await tx.insert(vendorPaymentsTable).values({
        vendorId, purchaseId,
        paymentDate, amount: amount.toString(), mode,
        reference: reference || null, notes: notes || null,
      }).returning();
      return payment;
    });

    res.status(201).json(result);
  } catch (err: any) {
    req.log.error({ err }, "Failed to record payment");
    const code = /not found|exceed|>|>=|belong/i.test(err?.message || "") ? 400 : 500;
    res.status(code).json({ error: err.message || "Failed to record payment" });
  }
});

// Outstanding (AP) — includes ALL vendor payments (linked + on-account)
router.get("/vendor-outstanding", async (req, res) => {
  try {
    const entityId = req.session.entityId;
    const vendors = await db.select().from(vendorsTable)
      .where(and(eq(vendorsTable.isActive, true), entityId ? eq(vendorsTable.entityId, entityId) : undefined as any));
    const allPurchases = await db.select().from(vendorPurchasesTable);
    const allPayments = await db.select().from(vendorPaymentsTable);
    const summary = vendors.map(v => {
      const myP = allPurchases.filter(p => p.vendorId === v.id);
      const myPay = allPayments.filter(p => p.vendorId === v.id);
      const totalPurchases = myP.reduce((s, p) => s + parseFloat(p.totalAmount), 0);
      // Include all payments (on-account + invoice-linked) so outstanding is accurate
      const totalPaid = myPay.reduce((s, p) => s + parseFloat(p.amount), 0);
      const opening = parseFloat(v.openingBalance || "0");
      const outstanding = opening + totalPurchases - totalPaid;
      const overdueBills = myP.filter(p => parseFloat(p.dueAmount || "0") > 0).length;
      return {
        id: v.id, name: v.name, gstin: v.gstin, paymentTerms: v.paymentTerms,
        openingBalance: opening, totalPurchases, totalPaid, outstanding, overdueBills,
      };
    }).filter(s => Math.abs(s.outstanding) > 0.01 || s.totalPurchases > 0)
      .sort((a, b) => b.outstanding - a.outstanding);

    const grand = summary.reduce((s, x) => s + x.outstanding, 0);
    res.json({ vendors: summary, totalOutstanding: grand });
  } catch (err) {
    req.log.error({ err }, "Failed outstanding");
    res.status(500).json({ error: "Failed to compute outstanding" });
  }
});

export default router;
