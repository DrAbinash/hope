/**
 * Pharmacy v2 routes — FEFO batches, sales returns, shifts, audit log,
 * reorder suggestions, dashboard. Mounted on the same router as pharmacy.ts
 * via index.ts.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  medicinesTable, pharmacySalesTable, patientsTable,
  medicineBatchesTable, stockMovementsTable, pharmacyAuditLogTable,
  pharmacyShiftsTable, salesReturnsTable, salesReturnItemsTable,
} from "@workspace/db";
import { eq, sql, and, gte, lte, desc, lt, isNull, ne, inArray } from "drizzle-orm";

const router = Router();

// ---------- helpers ----------
function generateSRNo(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `SR${d}${Math.floor(1000 + Math.random() * 9000)}`;
}
function today() { return new Date().toISOString().slice(0, 10); }

// ---------- MEDICINE BATCHES ----------

// GET /api/pharmacy/batches?medicineId=&includeExpired=
router.get("/pharmacy/batches", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { medicineId, includeExpired } = req.query as Record<string, string>;
    const todayStr = today();

    const conds: any[] = [eq(medicineBatchesTable.entityId, entityId)];
    if (medicineId) conds.push(eq(medicineBatchesTable.medicineId, parseInt(medicineId)));
    if (includeExpired !== "true") conds.push(gte(medicineBatchesTable.expiryDate, todayStr));
    conds.push(eq(medicineBatchesTable.isActive, true));

    const batches = await db
      .select({
        id: medicineBatchesTable.id,
        medicineId: medicineBatchesTable.medicineId,
        medicineName: medicinesTable.name,
        batchNo: medicineBatchesTable.batchNo,
        expiryDate: medicineBatchesTable.expiryDate,
        mrp: medicineBatchesTable.mrp,
        purchaseRate: medicineBatchesTable.purchaseRate,
        saleRate: medicineBatchesTable.saleRate,
        quantity: medicineBatchesTable.quantity,
        isActive: medicineBatchesTable.isActive,
      })
      .from(medicineBatchesTable)
      .leftJoin(medicinesTable, eq(medicineBatchesTable.medicineId, medicinesTable.id))
      .where(and(...conds))
      .orderBy(medicineBatchesTable.expiryDate); // FEFO order

    res.json(batches);
  } catch (err) {
    req.log.error({ err }, "Failed to list batches");
    res.status(500).json({ error: "Failed to list batches" });
  }
});

// GET /api/pharmacy/batches/fefo-suggest?medicineId= — returns batches sorted FEFO with warning info
router.get("/pharmacy/batches/fefo-suggest", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { medicineId } = req.query as Record<string, string>;
    if (!medicineId) return res.status(400).json({ error: "medicineId required" });
    const todayStr = today();
    const warn30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const batches = await db
      .select()
      .from(medicineBatchesTable)
      .where(and(
        eq(medicineBatchesTable.entityId, entityId),
        eq(medicineBatchesTable.medicineId, parseInt(medicineId)),
        eq(medicineBatchesTable.isActive, true),
        gte(medicineBatchesTable.quantity, 1),
      ))
      .orderBy(medicineBatchesTable.expiryDate);

    const enriched = batches.map((b, idx) => ({
      ...b,
      isExpired: b.expiryDate < todayStr,
      isNearExpiry: b.expiryDate >= todayStr && b.expiryDate <= warn30,
      isFEFORecommended: idx === 0,
    }));

    return res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "FEFO suggest failed");
    return res.status(500).json({ error: "Failed to get FEFO suggestion" });
  }
});

// POST /api/pharmacy/batches — add a batch
router.post("/pharmacy/batches", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { medicineId, batchNo, expiryDate, mrp, purchaseRate, saleRate, quantity } = req.body;
    if (!medicineId || !batchNo || !expiryDate || !mrp || !saleRate) {
      return res.status(400).json({ error: "medicineId, batchNo, expiryDate, mrp, saleRate are required" });
    }
    // Validate medicine ownership
    const [med] = await db.select().from(medicinesTable)
      .where(and(eq(medicinesTable.id, medicineId), eq(medicinesTable.entityId, entityId)));
    if (!med) return res.status(404).json({ error: "Medicine not found" });

    const [batch] = await db.insert(medicineBatchesTable).values({
      entityId, medicineId, batchNo, expiryDate,
      mrp: mrp.toString(), purchaseRate: purchaseRate?.toString(),
      saleRate: saleRate.toString(), quantity: quantity || 0,
    }).returning();

    // Update aggregate stock on medicines table
    if (quantity > 0) {
      await db.update(medicinesTable)
        .set({ stock: sql`${medicinesTable.stock} + ${quantity}`, updatedAt: new Date() })
        .where(eq(medicinesTable.id, medicineId));
      // Log stock movement
      await db.insert(stockMovementsTable).values({
        entityId, medicineId, batchId: batch.id,
        movementType: "batch_add", quantity,
        balanceAfter: med.stock + quantity,
        referenceType: "batch", referenceId: batch.id,
        userId: (req.session as any)?.userId ?? null,
      });
    }

    // Audit log
    await db.insert(pharmacyAuditLogTable).values({
      entityId, actionType: "batch_add", entityType: "medicine_batch",
      entityRefId: batch.id, newValue: batch as any,
      userId: (req.session as any)?.userId ?? null,
      userRole: req.session.role ?? null,
      ipAddress: req.ip,
    });

    return res.status(201).json(batch);
  } catch (err) {
    req.log.error({ err }, "Failed to create batch");
    return res.status(500).json({ error: "Failed to create batch" });
  }
});

// PUT /api/pharmacy/batches/:id
router.put("/pharmacy/batches/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const { batchNo, expiryDate, mrp, purchaseRate, saleRate, quantity, isActive } = req.body;

    const [old] = await db.select().from(medicineBatchesTable)
      .where(and(eq(medicineBatchesTable.id, id), eq(medicineBatchesTable.entityId, entityId)));
    if (!old) return res.status(404).json({ error: "Batch not found" });

    const [batch] = await db.update(medicineBatchesTable)
      .set({ batchNo, expiryDate, mrp: mrp?.toString(), purchaseRate: purchaseRate?.toString(), saleRate: saleRate?.toString(), quantity, isActive, updatedAt: new Date() })
      .where(and(eq(medicineBatchesTable.id, id), eq(medicineBatchesTable.entityId, entityId)))
      .returning();

    // Reflect quantity change in aggregate stock
    if (quantity !== undefined && quantity !== old.quantity) {
      const delta = quantity - old.quantity;
      await db.update(medicinesTable)
        .set({ stock: sql`${medicinesTable.stock} + ${delta}`, updatedAt: new Date() })
        .where(eq(medicinesTable.id, old.medicineId));
    }

    await db.insert(pharmacyAuditLogTable).values({
      entityId, actionType: "batch_edit", entityType: "medicine_batch",
      entityRefId: id, oldValue: old as any, newValue: batch as any,
      userId: (req.session as any)?.userId ?? null,
      userRole: req.session.role ?? null,
      ipAddress: req.ip,
    });

    return res.json(batch);
  } catch (err) {
    req.log.error({ err }, "Failed to update batch");
    return res.status(500).json({ error: "Failed to update batch" });
  }
});

// ---------- EXPIRY DASHBOARD ----------

// GET /api/pharmacy/expiry-dashboard — batch-level expiry view
router.get("/pharmacy/expiry-dashboard", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const todayStr = today();
    const d30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const d90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    const allBatches = await db
      .select({
        id: medicineBatchesTable.id,
        medicineId: medicineBatchesTable.medicineId,
        medicineName: medicinesTable.name,
        batchNo: medicineBatchesTable.batchNo,
        expiryDate: medicineBatchesTable.expiryDate,
        mrp: medicineBatchesTable.mrp,
        purchaseRate: medicineBatchesTable.purchaseRate,
        quantity: medicineBatchesTable.quantity,
      })
      .from(medicineBatchesTable)
      .leftJoin(medicinesTable, eq(medicineBatchesTable.medicineId, medicinesTable.id))
      .where(and(eq(medicineBatchesTable.entityId, entityId), eq(medicineBatchesTable.isActive, true), gte(medicineBatchesTable.quantity, 0)));

    const expired = allBatches.filter(b => b.expiryDate < todayStr);
    const expiring30 = allBatches.filter(b => b.expiryDate >= todayStr && b.expiryDate <= d30);
    const expiring90 = allBatches.filter(b => b.expiryDate > d30 && b.expiryDate <= d90);

    const batchValue = (list: typeof allBatches) =>
      list.reduce((s, b) => s + b.quantity * parseFloat(b.purchaseRate || b.mrp || "0"), 0);

    res.json({
      expired: { count: expired.length, value: batchValue(expired), items: expired },
      expiring30: { count: expiring30.length, value: batchValue(expiring30), items: expiring30 },
      expiring90: { count: expiring90.length, value: batchValue(expiring90), items: expiring90 },
    });
  } catch (err) {
    req.log.error({ err }, "Failed expiry dashboard");
    res.status(500).json({ error: "Failed to get expiry dashboard" });
  }
});

// ---------- SALES RETURNS ----------

router.get("/pharmacy/sales-returns", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { status, from, to, search } = req.query as Record<string, string>;
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "20");
    const offset = (page - 1) * limit;

    const conds: any[] = [eq(salesReturnsTable.entityId, entityId)];
    if (status) conds.push(eq(salesReturnsTable.status, status));
    if (from) conds.push(gte(salesReturnsTable.returnDate, from));
    if (to) conds.push(lte(salesReturnsTable.returnDate, to));
    if (search) {
      const s = `%${search.toLowerCase()}%`;
      conds.push(sql`(
        lower(coalesce(${salesReturnsTable.returnNo}, '')) like ${s}
        or lower(coalesce(${salesReturnsTable.originalBillNo}, '')) like ${s}
      )`);
    }

    const rows = await db
      .select({
        id: salesReturnsTable.id,
        returnNo: salesReturnsTable.returnNo,
        returnDate: salesReturnsTable.returnDate,
        originalSaleId: salesReturnsTable.originalSaleId,
        originalBillNo: salesReturnsTable.originalBillNo,
        patientId: salesReturnsTable.patientId,
        patientName: patientsTable.name,
        reason: salesReturnsTable.reason,
        totalAmount: salesReturnsTable.totalAmount,
        refundMode: salesReturnsTable.refundMode,
        refundAmount: salesReturnsTable.refundAmount,
        status: salesReturnsTable.status,
        notes: salesReturnsTable.notes,
        createdAt: salesReturnsTable.createdAt,
      })
      .from(salesReturnsTable)
      .leftJoin(patientsTable, eq(salesReturnsTable.patientId, patientsTable.id))
      .where(and(...conds))
      .orderBy(desc(salesReturnsTable.returnDate))
      .limit(limit).offset(offset);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(salesReturnsTable).where(and(...conds));

    res.json({ items: rows, total: Number(count), page });
  } catch (err) {
    req.log.error({ err }, "Failed sales returns list");
    res.status(500).json({ error: "Failed to list sales returns" });
  }
});

router.get("/pharmacy/sales-returns/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const [ret] = await db
      .select({
        id: salesReturnsTable.id,
        returnNo: salesReturnsTable.returnNo,
        returnDate: salesReturnsTable.returnDate,
        originalSaleId: salesReturnsTable.originalSaleId,
        originalBillNo: salesReturnsTable.originalBillNo,
        patientId: salesReturnsTable.patientId,
        patientName: patientsTable.name,
        reason: salesReturnsTable.reason,
        subtotal: salesReturnsTable.subtotal,
        gstAmount: salesReturnsTable.gstAmount,
        cgstAmount: salesReturnsTable.cgstAmount,
        sgstAmount: salesReturnsTable.sgstAmount,
        igstAmount: salesReturnsTable.igstAmount,
        totalAmount: salesReturnsTable.totalAmount,
        refundMode: salesReturnsTable.refundMode,
        refundAmount: salesReturnsTable.refundAmount,
        status: salesReturnsTable.status,
        notes: salesReturnsTable.notes,
        createdAt: salesReturnsTable.createdAt,
      })
      .from(salesReturnsTable)
      .leftJoin(patientsTable, eq(salesReturnsTable.patientId, patientsTable.id))
      .where(and(eq(salesReturnsTable.id, id), eq(salesReturnsTable.entityId, entityId)));

    if (!ret) return res.status(404).json({ error: "Not found" });

    const items = await db
      .select({
        id: salesReturnItemsTable.id,
        medicineId: salesReturnItemsTable.medicineId,
        medicineName: medicinesTable.name,
        batchNo: salesReturnItemsTable.batchNo,
        quantityReturned: salesReturnItemsTable.quantityReturned,
        rate: salesReturnItemsTable.rate,
        gstPercent: salesReturnItemsTable.gstPercent,
        amount: salesReturnItemsTable.amount,
        hsnCode: salesReturnItemsTable.hsnCode,
        isUsable: salesReturnItemsTable.isUsable,
      })
      .from(salesReturnItemsTable)
      .leftJoin(medicinesTable, eq(salesReturnItemsTable.medicineId, medicinesTable.id))
      .where(eq(salesReturnItemsTable.returnId, id));

    return res.json({ ...ret, items });
  } catch (err) {
    req.log.error({ err }, "Failed sales return detail");
    return res.status(500).json({ error: "Failed to fetch sales return" });
  }
});

router.post("/pharmacy/sales-returns", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { originalSaleId, originalBillNo, patientId, returnDate, reason, items, refundMode = "cash", gstStateType = "intra", notes } = req.body;
    if (!items?.length || !reason) return res.status(400).json({ error: "items and reason required" });

    // Validate medicines belong to entity
    const medIds = items.map((i: any) => i.medicineId).filter(Boolean);
    const meds = medIds.length
      ? await db.select().from(medicinesTable).where(and(inArray(medicinesTable.id, medIds), eq(medicinesTable.entityId, entityId)))
      : [];
    if (medIds.length !== meds.length) return res.status(400).json({ error: "One or more medicines not found" });
    const medMap = new Map(meds.map(m => [m.id, m]));

    const lineItems = items.map((it: any) => {
      const med = medMap.get(it.medicineId);
      const qty = Math.max(1, Math.floor(it.quantityReturned || 1));
      const rate = parseFloat(it.rate || med?.saleRate || med?.mrp || "0");
      const gstP = parseFloat(it.gstPercent ?? med?.gstPercent ?? "12");
      const amount = qty * rate;
      return { medicineId: it.medicineId, batchNo: it.batchNo || null, quantityReturned: qty, rate: rate.toString(), gstPercent: gstP.toString(), amount: amount.toString(), hsnCode: it.hsnCode || med?.hsnCode || null, isUsable: it.isUsable !== false };
    });

    const subtotal = lineItems.reduce((s: number, i: any) => s + parseFloat(i.amount), 0);
    const gstAmount = lineItems.reduce((s: number, i: any) => s + parseFloat(i.amount) * parseFloat(i.gstPercent) / 100, 0);
    let cgst = 0, sgst = 0, igst = 0;
    if (gstStateType === "inter") igst = gstAmount;
    else { cgst = gstAmount / 2; sgst = gstAmount / 2; }
    const total = subtotal + gstAmount;

    const result = await db.transaction(async (tx) => {
      const [ret] = await tx.insert(salesReturnsTable).values({
        entityId, returnNo: generateSRNo(),
        originalSaleId: originalSaleId || null,
        originalBillNo: originalBillNo || null,
        patientId: patientId || null,
        returnDate: returnDate || today(), reason,
        subtotal: subtotal.toString(),
        gstAmount: gstAmount.toString(), cgstAmount: cgst.toString(), sgstAmount: sgst.toString(), igstAmount: igst.toString(),
        totalAmount: total.toString(),
        refundMode, refundAmount: total.toString(),
        status: "draft", notes,
      }).returning();

      for (const it of lineItems) {
        await tx.insert(salesReturnItemsTable).values({ returnId: ret.id, ...it });
      }

      await tx.insert(pharmacyAuditLogTable).values({
        entityId, actionType: "sales_return_create", entityType: "sales_return",
        entityRefId: ret.id, newValue: { returnNo: ret.returnNo, reason, total } as any,
        userId: (req.session as any)?.userId ?? null, userRole: req.session.role ?? null,
        ipAddress: req.ip,
      });

      return ret;
    });

    return res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to create sales return");
    return res.status(500).json({ error: "Failed to create sales return" });
  }
});

// Process (complete) a sales return — add stock back, create audit entry
router.put("/pharmacy/sales-returns/:id/complete", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const userId = (req.session as any)?.userId ?? null;

    const result = await db.transaction(async (tx) => {
      const [ret] = await tx.update(salesReturnsTable)
        .set({ status: "completed", processedBy: userId, processedAt: new Date() })
        .where(and(eq(salesReturnsTable.id, id), eq(salesReturnsTable.entityId, entityId), eq(salesReturnsTable.status, "draft")))
        .returning();
      if (!ret) throw new Error("Sales return not found or already processed");

      const items = await tx.select().from(salesReturnItemsTable).where(eq(salesReturnItemsTable.returnId, id));

      for (const it of items) {
        if (it.isUsable) {
          // Add back to stock
          await tx.update(medicinesTable)
            .set({ stock: sql`${medicinesTable.stock} + ${it.quantityReturned}`, updatedAt: new Date() })
            .where(and(eq(medicinesTable.id, it.medicineId), eq(medicinesTable.entityId, entityId)));

          const [med] = await tx.select({ stock: medicinesTable.stock })
            .from(medicinesTable).where(eq(medicinesTable.id, it.medicineId));

          await tx.insert(stockMovementsTable).values({
            entityId, medicineId: it.medicineId,
            movementType: "sales_return", quantity: it.quantityReturned,
            balanceAfter: med?.stock ?? 0,
            referenceType: "sales_return", referenceId: id,
            referenceNo: ret.returnNo,
            userId,
          });
        }
        // Non-usable items do NOT go back to saleable stock
      }

      await tx.insert(pharmacyAuditLogTable).values({
        entityId, actionType: "sales_return_complete", entityType: "sales_return",
        entityRefId: id, newValue: { status: "completed", returnNo: ret.returnNo } as any,
        userId, userRole: req.session.role ?? null, ipAddress: req.ip,
      });

      return ret;
    });

    return res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "Failed to complete sales return");
    return res.status(err.message?.includes("not found") ? 409 : 500).json({ error: err.message || "Failed" });
  }
});

// ---------- PHARMACY SHIFTS ----------

router.get("/pharmacy/shifts", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { from, to, status } = req.query as Record<string, string>;
    const page = parseInt((req.query.page as string) || "1");
    const lim = parseInt((req.query.limit as string) || "20");

    const conds: any[] = [eq(pharmacyShiftsTable.entityId, entityId)];
    if (from) conds.push(gte(pharmacyShiftsTable.shiftDate, from));
    if (to) conds.push(lte(pharmacyShiftsTable.shiftDate, to));
    if (status) conds.push(eq(pharmacyShiftsTable.status, status));

    const rows = await db.select().from(pharmacyShiftsTable)
      .where(and(...conds))
      .orderBy(desc(pharmacyShiftsTable.shiftDate))
      .limit(lim).offset((page - 1) * lim);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(pharmacyShiftsTable).where(and(...conds));

    return res.json({ items: rows, total: Number(count), page });
  } catch (err) {
    req.log.error({ err }, "Failed shifts list");
    return res.status(500).json({ error: "Failed to list shifts" });
  }
});

router.post("/pharmacy/shifts", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { shiftDate, openingCash, remarks } = req.body;
    if (!shiftDate) return res.status(400).json({ error: "shiftDate required" });

    // Only one open shift per date
    const [existing] = await db.select().from(pharmacyShiftsTable)
      .where(and(eq(pharmacyShiftsTable.entityId, entityId), eq(pharmacyShiftsTable.shiftDate, shiftDate), eq(pharmacyShiftsTable.status, "open")));
    if (existing) return res.status(409).json({ error: "An open shift already exists for this date" });

    const [shift] = await db.insert(pharmacyShiftsTable).values({
      entityId, shiftDate, openingCash: (openingCash || 0).toString(), status: "open", remarks,
    }).returning();

    return res.status(201).json(shift);
  } catch (err) {
    req.log.error({ err }, "Failed to create shift");
    return res.status(500).json({ error: "Failed to create shift" });
  }
});

router.put("/pharmacy/shifts/:id/close", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const userId = (req.session as any)?.userId ?? null;
    const { cashReceived, upiReceived, cardReceived, refunds, countedCash, remarks } = req.body;

    const [shift] = await db.select().from(pharmacyShiftsTable)
      .where(and(eq(pharmacyShiftsTable.id, id), eq(pharmacyShiftsTable.entityId, entityId)));
    if (!shift) return res.status(404).json({ error: "Shift not found" });
    if (shift.status === "closed") return res.status(409).json({ error: "Shift already closed" });

    // Compute sales total for this shift's date
    const salesRows = await db.select({
      total: sql<number>`sum(cast(paid_amount as numeric))`,
    }).from(pharmacySalesTable).where(and(
      eq(pharmacySalesTable.entityId, entityId),
      eq(pharmacySalesTable.billDate, shift.shiftDate),
      eq(pharmacySalesTable.billStatus, "final"),
    ));
    const salesTotal = Number(salesRows[0]?.total || 0);

    const opening = parseFloat(shift.openingCash || "0");
    const cash = parseFloat(cashReceived || "0");
    const upi = parseFloat(upiReceived || "0");
    const card = parseFloat(cardReceived || "0");
    const ref = parseFloat(refunds || "0");
    const counted = parseFloat(countedCash || "0");
    const expected = opening + cash - ref;
    const difference = counted - expected;

    const [employee] = await db.select({ name: sql<string>`name` }).from(sql`employees`).where(sql`id = ${userId}`).catch(() => []);

    const [closed] = await db.update(pharmacyShiftsTable)
      .set({
        salesTotal: salesTotal.toString(),
        cashReceived: cash.toString(), upiReceived: upi.toString(), cardReceived: card.toString(),
        refunds: ref.toString(), expectedCash: expected.toString(), countedCash: counted.toString(),
        difference: difference.toString(),
        remarks: remarks || shift.remarks,
        closedBy: userId, closedByName: (employee as any)?.name || null,
        closedAt: new Date(), status: "closed",
      })
      .where(and(eq(pharmacyShiftsTable.id, id), eq(pharmacyShiftsTable.entityId, entityId)))
      .returning();

    await db.insert(pharmacyAuditLogTable).values({
      entityId, actionType: "shift_close", entityType: "pharmacy_shift",
      entityRefId: id, newValue: { shiftDate: shift.shiftDate, salesTotal, difference } as any,
      userId, userRole: req.session.role ?? null, ipAddress: req.ip,
    });

    return res.json(closed);
  } catch (err) {
    req.log.error({ err }, "Failed to close shift");
    return res.status(500).json({ error: "Failed to close shift" });
  }
});

// ---------- AUDIT LOG ----------

router.get("/pharmacy/audit-log", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { actionType, entityType, from, to, userId } = req.query as Record<string, string>;
    const page = parseInt((req.query.page as string) || "1");
    const lim = parseInt((req.query.limit as string) || "50");

    const conds: any[] = [eq(pharmacyAuditLogTable.entityId, entityId)];
    if (actionType) conds.push(eq(pharmacyAuditLogTable.actionType, actionType));
    if (entityType) conds.push(eq(pharmacyAuditLogTable.entityType, entityType));
    if (from) conds.push(gte(pharmacyAuditLogTable.createdAt, new Date(from)));
    if (to) conds.push(lte(pharmacyAuditLogTable.createdAt, new Date(to + "T23:59:59")));
    if (userId) conds.push(eq(pharmacyAuditLogTable.userId, parseInt(userId)));

    const rows = await db.select().from(pharmacyAuditLogTable)
      .where(and(...conds))
      .orderBy(desc(pharmacyAuditLogTable.createdAt))
      .limit(lim).offset((page - 1) * lim);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(pharmacyAuditLogTable).where(and(...conds));

    res.json({ items: rows, total: Number(count), page });
  } catch (err) {
    req.log.error({ err }, "Failed audit log");
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

// ---------- REORDER SUGGESTIONS ----------

router.get("/pharmacy/reorder-suggestions", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const medicines = await db.select().from(medicinesTable)
      .where(eq(medicinesTable.entityId, entityId));

    const suggestions = medicines
      .filter(m => m.stock <= (m.reorderLevel || 10))
      .map(m => {
        const avgDaily = parseFloat(m.avgDailyConsumption || "0");
        const lead = m.leadTimeDays || 3;
        const max = m.maxStock || 100;
        const current = m.stock;
        const suggestedQty = Math.max(0, max - current);
        const daysToStockout = avgDaily > 0 ? Math.floor(current / avgDaily) : null;
        const stockoutDate = daysToStockout !== null
          ? new Date(Date.now() + daysToStockout * 86400000).toISOString().slice(0, 10)
          : null;
        return {
          id: m.id, name: m.name, genericName: m.genericName,
          stock: current, reorderLevel: m.reorderLevel || 10,
          minStock: m.minStock || 5, maxStock: max,
          avgDailyConsumption: avgDaily, leadTimeDays: lead,
          suggestedQty, daysToStockout, stockoutDate,
          purchaseRate: m.purchaseRate, mrp: m.mrp, unit: m.unit,
          scheduleType: m.scheduleType,
        };
      })
      .sort((a, b) => (a.daysToStockout ?? 9999) - (b.daysToStockout ?? 9999));

    res.json({ items: suggestions, total: suggestions.length });
  } catch (err) {
    req.log.error({ err }, "Failed reorder suggestions");
    res.status(500).json({ error: "Failed to get reorder suggestions" });
  }
});

// ---------- PHARMACY DASHBOARD ----------

router.get("/pharmacy/dashboard", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const todayStr = today();
    const d30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    // Today's sales
    const todaySales = await db.select().from(pharmacySalesTable)
      .where(and(eq(pharmacySalesTable.entityId, entityId), eq(pharmacySalesTable.billDate, todayStr), eq(pharmacySalesTable.billStatus, "final")));

    const salesTotal = todaySales.reduce((s, r) => s + parseFloat(r.totalAmount), 0);
    const grossSale = todaySales.reduce((s, r) => s + parseFloat(r.subtotal), 0);
    const discountTotal = todaySales.reduce((s, r) => s + parseFloat(r.discount || "0"), 0);
    const cashSales = todaySales.filter(r => r.paymentMode === "Cash").reduce((s, r) => s + parseFloat(r.paidAmount), 0);
    const upiSales = todaySales.filter(r => r.paymentMode === "UPI").reduce((s, r) => s + parseFloat(r.paidAmount), 0);
    const cardSales = todaySales.filter(r => r.paymentMode === "Card").reduce((s, r) => s + parseFloat(r.paidAmount), 0);

    // Returns today
    const returnsToday = await db.select({ total: sql<number>`sum(cast(total_amount as numeric))` })
      .from(salesReturnsTable)
      .where(and(eq(salesReturnsTable.entityId, entityId), eq(salesReturnsTable.returnDate, todayStr), eq(salesReturnsTable.status, "completed")));
    const returnsAmount = Number(returnsToday[0]?.total || 0);
    const netSale = salesTotal - returnsAmount;

    // Stock metrics
    const medicines = await db.select().from(medicinesTable).where(eq(medicinesTable.entityId, entityId));
    const lowStockCount = medicines.filter(m => m.stock <= (m.reorderLevel || 10)).length;

    // Batch-level expiry
    const allBatches = await db.select().from(medicineBatchesTable)
      .where(and(eq(medicineBatchesTable.entityId, entityId), eq(medicineBatchesTable.isActive, true)));
    const expiredBatches = allBatches.filter(b => b.expiryDate < todayStr);
    const nearExpiryBatches = allBatches.filter(b => b.expiryDate >= todayStr && b.expiryDate <= d30);
    const expiredValue = expiredBatches.reduce((s, b) => s + b.quantity * parseFloat(b.purchaseRate || b.mrp || "0"), 0);
    const nearExpiryValue = nearExpiryBatches.reduce((s, b) => s + b.quantity * parseFloat(b.purchaseRate || b.mrp || "0"), 0);

    // NDPS sales today
    const ndpsMeds = medicines.filter(m => m.scheduleType === "narcotic" || m.scheduleType === "psychotropic");
    const ndpsMedIds = new Set(ndpsMeds.map(m => m.id));
    const ndpsSalesCount = todaySales.filter(s => {
      const items = (s.items as any[]) || [];
      return items.some((it: any) => ndpsMedIds.has(it.medicineId));
    }).length;

    // High discount bills (discount > 10% of subtotal)
    const highDiscountBills = todaySales.filter(s => {
      const sub = parseFloat(s.subtotal || "0");
      const disc = parseFloat(s.discount || "0");
      return sub > 0 && disc / sub > 0.1;
    }).length;

    // Top 10 medicines by qty sold today
    const itemCounts: Record<number, { id: number; name: string; qty: number; revenue: number }> = {};
    for (const sale of todaySales) {
      for (const it of (sale.items as any[]) || []) {
        if (!it.medicineId) continue;
        const med = medicines.find(m => m.id === it.medicineId);
        if (!itemCounts[it.medicineId]) itemCounts[it.medicineId] = { id: it.medicineId, name: med?.name || `Med#${it.medicineId}`, qty: 0, revenue: 0 };
        itemCounts[it.medicineId].qty += it.quantity || 0;
        itemCounts[it.medicineId].revenue += it.amount || 0;
      }
    }
    const top10 = Object.values(itemCounts).sort((a, b) => b.qty - a.qty).slice(0, 10);

    // Slow moving — no sales in last 90 days
    const d90back = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const recentSales = await db.select({ billDate: pharmacySalesTable.billDate, items: pharmacySalesTable.items })
      .from(pharmacySalesTable)
      .where(and(eq(pharmacySalesTable.entityId, entityId), gte(pharmacySalesTable.billDate, d90back)));
    const recentMedIds = new Set<number>();
    for (const s of recentSales) {
      for (const it of (s.items as any[]) || []) if (it.medicineId) recentMedIds.add(it.medicineId);
    }
    const slowMoving = medicines.filter(m => m.stock > 0 && !recentMedIds.has(m.id)).length;

    res.json({
      today: todayStr,
      sales: { count: todaySales.length, gross: grossSale, discount: discountTotal, net: netSale, total: salesTotal, returns: returnsAmount, cash: cashSales, upi: upiSales, card: cardSales },
      stock: { total: medicines.length, lowStock: lowStockCount, expiredValue, nearExpiryValue, expiredBatches: expiredBatches.length, nearExpiryBatches: nearExpiryBatches.length, slowMoving },
      compliance: { ndpsSalesCount, highDiscountBills },
      top10,
    });
  } catch (err) {
    req.log.error({ err }, "Failed pharmacy dashboard");
    res.status(500).json({ error: "Failed to get pharmacy dashboard" });
  }
});

// ---------- STOCK MOVEMENTS LOG ----------

router.get("/pharmacy/stock-movements", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { medicineId, from, to } = req.query as Record<string, string>;
    const page = parseInt((req.query.page as string) || "1");
    const lim = parseInt((req.query.limit as string) || "50");

    const conds: any[] = [eq(stockMovementsTable.entityId, entityId)];
    if (medicineId) conds.push(eq(stockMovementsTable.medicineId, parseInt(medicineId)));
    if (from) conds.push(gte(stockMovementsTable.createdAt, new Date(from)));
    if (to) conds.push(lte(stockMovementsTable.createdAt, new Date(to + "T23:59:59")));

    const rows = await db.select({
      id: stockMovementsTable.id,
      medicineId: stockMovementsTable.medicineId,
      medicineName: medicinesTable.name,
      movementType: stockMovementsTable.movementType,
      quantity: stockMovementsTable.quantity,
      balanceAfter: stockMovementsTable.balanceAfter,
      referenceType: stockMovementsTable.referenceType,
      referenceNo: stockMovementsTable.referenceNo,
      reason: stockMovementsTable.reason,
      createdAt: stockMovementsTable.createdAt,
    }).from(stockMovementsTable)
      .leftJoin(medicinesTable, eq(stockMovementsTable.medicineId, medicinesTable.id))
      .where(and(...conds))
      .orderBy(desc(stockMovementsTable.createdAt))
      .limit(lim).offset((page - 1) * lim);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(stockMovementsTable).where(and(...conds));

    res.json({ items: rows, total: Number(count), page });
  } catch (err) {
    req.log.error({ err }, "Failed stock movements");
    res.status(500).json({ error: "Failed to get stock movements" });
  }
});

// ---------- GENERIC SUBSTITUTION SUGGESTIONS ----------

router.get("/pharmacy/generic-substitutes", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { medicineId } = req.query as Record<string, string>;
    if (!medicineId) return res.status(400).json({ error: "medicineId required" });

    const [med] = await db.select().from(medicinesTable)
      .where(and(eq(medicinesTable.id, parseInt(medicineId)), eq(medicinesTable.entityId, entityId)));
    if (!med) return res.status(404).json({ error: "Medicine not found" });

    if (!med.genericName) return res.json({ substitutes: [], reason: "No generic name set" });

    const alternates = await db.select().from(medicinesTable)
      .where(and(
        eq(medicinesTable.entityId, entityId),
        eq(medicinesTable.genericName, med.genericName),
        ne(medicinesTable.id, med.id),
        gte(medicinesTable.stock, 1),
      ));

    // Filter by strength + formulation if set
    const filtered = alternates.filter(a => {
      const sameStrength = !med.strength || !a.strength || a.strength === med.strength;
      const sameFormulation = !med.formulation || !a.formulation || a.formulation === med.formulation;
      return sameStrength && sameFormulation;
    });

    const substitutes = filtered.map(a => ({
      id: a.id, name: a.name, genericName: a.genericName,
      brandName: a.brandName, strength: a.strength, formulation: a.formulation,
      saleRate: a.saleRate, mrp: a.mrp, stock: a.stock, manufacturer: a.manufacturer,
      savings: parseFloat(med.saleRate) - parseFloat(a.saleRate),
    })).sort((a, b) => a.savings - b.savings);

    return res.json({ originalMedicine: { id: med.id, name: med.name, saleRate: med.saleRate, mrp: med.mrp }, substitutes, alternatives: substitutes });
  } catch (err) {
    req.log.error({ err }, "Failed generic substitutes");
    return res.status(500).json({ error: "Failed to get substitutes" });
  }
});

export default router;
