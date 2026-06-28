/**
 * Pharmacy v3 routes — Ward stock, IPD ledger, MAR, Prescription queue,
 * OT kits, Implant tracking, Stock verification, Expiry loss, Staff issues,
 * Rate history, Purchase indents, Analytics (dead stock, fast-moving,
 * antibiotic stewardship, vendor performance, margin alerts).
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  medicinesTable, pharmacySalesTable, patientsTable, medicineBatchesTable,
  pharmacyAuditLogTable, pharmacyLocationsTable, locationStockTable,
  locationTransfersTable, ipdMedicineIssuesTable, medicationAdminRecordsTable,
  procedureKitsTable, procedureKitItemsTable, kitIssueLogTable,
  implantTrackingTable, prescriptionQueueTable, expiryLossRegisterTable,
  stockVerificationSessionsTable, stockVerificationItemsTable,
  mrpRateHistoryTable, staffMedicineIssuesTable, pharmacyNotificationsTable,
  purchaseIndentsTable, purchaseIndentItemsTable, ipdAdmissionsTable,
  stockMovementsTable, pharmacyShiftsTable, salesReturnsTable,
  scheduleHRegisterTable,
} from "@workspace/db";
import { eq, sql, and, gte, lte, desc, lt, isNull, inArray, ne, or, asc, isNotNull } from "drizzle-orm";

const router = Router();

// ─── helpers ───────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10); }
function nowStr() { return new Date().toISOString(); }
function genNo(prefix: string) {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}${d}${Math.floor(1000 + Math.random() * 9000)}`;
}

async function createAuditEntry(entityId: number, actionType: string, entityType: string, opts: {
  entityRefId?: number; oldValue?: any; newValue?: any; reason?: string;
  userId?: number; userRole?: string; ipAddress?: string;
}) {
  await db.insert(pharmacyAuditLogTable).values({
    entityId, actionType, entityType,
    entityRefId: opts.entityRefId,
    oldValue: opts.oldValue ?? null,
    newValue: opts.newValue ?? null,
    reason: opts.reason,
    userId: opts.userId,
    userRole: opts.userRole,
    ipAddress: opts.ipAddress,
  });
}

async function createNotification(entityId: number, type: string, priority: string, title: string, message: string, opts: {
  referenceType?: string; referenceId?: number; expiresAt?: Date;
} = {}) {
  await db.insert(pharmacyNotificationsTable).values({
    entityId, notificationType: type, priority, title, message,
    referenceType: opts.referenceType,
    referenceId: opts.referenceId,
    expiresAt: opts.expiresAt,
  });
}

// ════════════════════════════════════════════════════════════════════
// 1. PHARMACY COMMAND CENTER
// ════════════════════════════════════════════════════════════════════

router.get("/pharmacy/command-center", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const todayStr = today();
    const thirtyDaysLater = new Date(); thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const thirtyDaysStr = thirtyDaysLater.toISOString().slice(0, 10);
    const ninety = new Date(); ninety.setDate(ninety.getDate() + 90);
    const ninetyStr = ninety.toISOString().slice(0, 10);

    const [
      lowStockMeds, expiredBatches, expiringBatches,
      openShifts, pendingReturns, pendingAudit,
      pendingIndents, unreadNotifs, todaySales,
      pendingMAR, pendingQueue, stockVerif,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(medicinesTable)
        .where(and(eq(medicinesTable.entityId, entityId),
          sql`${medicinesTable.stock} <= ${medicinesTable.reorderLevel}`)),
      db.select({ count: sql<number>`count(*)` }).from(medicineBatchesTable)
        .where(and(eq(medicineBatchesTable.entityId, entityId), lt(medicineBatchesTable.expiryDate, todayStr), eq(medicineBatchesTable.isActive, true))),
      db.select({ count: sql<number>`count(*)` }).from(medicineBatchesTable)
        .where(and(eq(medicineBatchesTable.entityId, entityId), gte(medicineBatchesTable.expiryDate, todayStr), lte(medicineBatchesTable.expiryDate, thirtyDaysStr), eq(medicineBatchesTable.isActive, true))),
      db.select({ count: sql<number>`count(*)` }).from(pharmacyShiftsTable)
        .where(and(eq(pharmacyShiftsTable.entityId, entityId), eq(pharmacyShiftsTable.status, "open"))),
      db.select({ count: sql<number>`count(*)` }).from(salesReturnsTable)
        .where(and(eq(salesReturnsTable.entityId, entityId), eq(salesReturnsTable.status, "draft"))),
      db.select({ count: sql<number>`count(*)` }).from(expiryLossRegisterTable)
        .where(and(eq(expiryLossRegisterTable.entityId, entityId), eq(expiryLossRegisterTable.status, "pending"))),
      db.select({ count: sql<number>`count(*)` }).from(purchaseIndentsTable)
        .where(and(eq(purchaseIndentsTable.entityId, entityId), eq(purchaseIndentsTable.status, "pending"))),
      db.select({ count: sql<number>`count(*)` }).from(pharmacyNotificationsTable)
        .where(and(eq(pharmacyNotificationsTable.entityId, entityId), eq(pharmacyNotificationsTable.isRead, false))),
      db.select({ total: sql<number>`coalesce(sum(${pharmacySalesTable.totalAmount}),0)` }).from(pharmacySalesTable)
        .where(and(eq(pharmacySalesTable.entityId, entityId), eq(pharmacySalesTable.billDate, todayStr))),
      db.select({ count: sql<number>`count(*)` }).from(medicationAdminRecordsTable)
        .where(and(eq(medicationAdminRecordsTable.entityId, entityId), eq(medicationAdminRecordsTable.status, "pending"))),
      db.select({ count: sql<number>`count(*)` }).from(prescriptionQueueTable)
        .where(and(eq(prescriptionQueueTable.entityId, entityId), or(eq(prescriptionQueueTable.status, "pending"), eq(prescriptionQueueTable.status, "dispensing")))),
      db.select({ count: sql<number>`count(*)` }).from(stockVerificationSessionsTable)
        .where(and(eq(stockVerificationSessionsTable.entityId, entityId), or(eq(stockVerificationSessionsTable.status, "open"), eq(stockVerificationSessionsTable.status, "counting")))),
    ]);

    // NDPS high-alert medicines with stock
    const ndpsMeds = await db.select({ count: sql<number>`count(*)` }).from(medicinesTable)
      .where(and(eq(medicinesTable.entityId, entityId), or(eq(medicinesTable.scheduleType, "ndps"), eq(medicinesTable.scheduleType, "x"))));

    const alerts: { id: string; level: "red" | "yellow" | "green"; category: string; message: string; count: number }[] = [];

    const expiredCount = Number(expiredBatches[0]?.count ?? 0);
    const expiringCount = Number(expiringBatches[0]?.count ?? 0);
    const lowCount = Number(lowStockMeds[0]?.count ?? 0);
    const openShiftCount = Number(openShifts[0]?.count ?? 0);
    const pendingReturnCount = Number(pendingReturns[0]?.count ?? 0);
    const pendingAuditCount = Number(pendingAudit[0]?.count ?? 0);
    const pendingIndentCount = Number(pendingIndents[0]?.count ?? 0);
    const unreadCount = Number(unreadNotifs[0]?.count ?? 0);
    const pendingMARCount = Number(pendingMAR[0]?.count ?? 0);
    const pendingQueueCount = Number(pendingQueue[0]?.count ?? 0);

    if (expiredCount > 0) alerts.push({ id: "expired", level: "red", category: "Expiry", message: `${expiredCount} expired batch(es) in active stock`, count: expiredCount });
    if (pendingMARCount > 0) alerts.push({ id: "mar", level: "red", category: "MAR", message: `${pendingMARCount} pending medication dose(s)`, count: pendingMARCount });
    if (lowCount > 0) alerts.push({ id: "low_stock", level: lowCount > 5 ? "red" : "yellow", category: "Stock", message: `${lowCount} medicine(s) at or below reorder level`, count: lowCount });
    if (expiringCount > 0) alerts.push({ id: "expiring", level: "yellow", category: "Expiry", message: `${expiringCount} batch(es) expiring within 30 days`, count: expiringCount });
    if (openShiftCount > 1) alerts.push({ id: "shift", level: "yellow", category: "Shift", message: `${openShiftCount} open shifts — close before end of day`, count: openShiftCount });
    if (pendingReturnCount > 0) alerts.push({ id: "returns", level: "yellow", category: "Returns", message: `${pendingReturnCount} pending sales return(s)`, count: pendingReturnCount });
    if (pendingAuditCount > 0) alerts.push({ id: "expiry_loss", level: "yellow", category: "Approval", message: `${pendingAuditCount} expiry loss record(s) pending approval`, count: pendingAuditCount });
    if (pendingIndentCount > 0) alerts.push({ id: "indent", level: "yellow", category: "Purchase", message: `${pendingIndentCount} purchase indent(s) pending approval`, count: pendingIndentCount });
    if (pendingQueueCount > 0) alerts.push({ id: "queue", level: "green", category: "Queue", message: `${pendingQueueCount} prescription(s) in dispensing queue`, count: pendingQueueCount });

    return res.json({
      kpis: {
        todaySales: Number(todaySales[0]?.total ?? 0),
        lowStockCount: lowCount,
        expiredBatches: expiredCount,
        expiringBatches: expiringCount,
        openShifts: openShiftCount,
        pendingReturns: pendingReturnCount,
        pendingMAR: pendingMARCount,
        prescriptionQueue: pendingQueueCount,
        pendingIndents: pendingIndentCount,
        unreadNotifications: unreadCount,
        ndpsMedicines: Number(ndpsMeds[0]?.count ?? 0),
        activeAudit: Number(stockVerif[0]?.count ?? 0),
      },
      alerts: alerts.sort((a, b) => (a.level === "red" ? -1 : b.level === "red" ? 1 : a.level === "yellow" ? -1 : 1)),
    });
  } catch (err) {
    req.log.error({ err }, "command-center failed");
    return res.status(500).json({ error: "Failed to load command center" });
  }
});

// ════════════════════════════════════════════════════════════════════
// 2. WARD / ICU PHARMACY LOCATIONS
// ════════════════════════════════════════════════════════════════════

router.get("/pharmacy/locations", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const locs = await db.select().from(pharmacyLocationsTable)
      .where(eq(pharmacyLocationsTable.entityId, entityId))
      .orderBy(pharmacyLocationsTable.name);
    return res.json(locs);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.post("/pharmacy/locations", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { name, locationType, description } = req.body;
    const [loc] = await db.insert(pharmacyLocationsTable).values({ entityId, name, locationType: locationType ?? "ward", description }).returning();
    await createAuditEntry(entityId, "create_location", "location", { entityRefId: loc.id, newValue: loc, userId: req.session.userId, userRole: req.session.role });
    return res.status(201).json(loc);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed to create location" }); }
});

router.get("/pharmacy/location-stock", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { locationId } = req.query as Record<string, string>;
    const conds: any[] = [eq(locationStockTable.entityId, entityId)];
    if (locationId) conds.push(eq(locationStockTable.locationId, parseInt(locationId)));
    const rows = await db.select({
      id: locationStockTable.id,
      locationId: locationStockTable.locationId,
      locationName: pharmacyLocationsTable.name,
      locationType: pharmacyLocationsTable.locationType,
      medicineId: locationStockTable.medicineId,
      medicineName: medicinesTable.name,
      genericName: medicinesTable.genericName,
      batchNo: locationStockTable.batchNo,
      expiryDate: locationStockTable.expiryDate,
      quantity: locationStockTable.quantity,
      updatedAt: locationStockTable.updatedAt,
    }).from(locationStockTable)
      .leftJoin(pharmacyLocationsTable, eq(locationStockTable.locationId, pharmacyLocationsTable.id))
      .leftJoin(medicinesTable, eq(locationStockTable.medicineId, medicinesTable.id))
      .where(and(...conds))
      .orderBy(locationStockTable.updatedAt);
    return res.json(rows);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.post("/pharmacy/location-transfers", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { fromLocationId, toLocationId, medicineId, batchId, batchNo, quantity, reason } = req.body;
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) return res.status(400).json({ error: "Invalid quantity" });

    const result = await db.transaction(async (tx) => {
      // Decrement from-location
      const [fromRow] = await tx.select().from(locationStockTable)
        .where(and(eq(locationStockTable.locationId, fromLocationId), eq(locationStockTable.medicineId, medicineId)));
      if (!fromRow || fromRow.quantity < qty) throw new Error("Insufficient stock at source location");

      await tx.update(locationStockTable).set({ quantity: fromRow.quantity - qty, updatedAt: new Date() })
        .where(eq(locationStockTable.id, fromRow.id));

      // Increment to-location
      const [toRow] = await tx.select().from(locationStockTable)
        .where(and(eq(locationStockTable.locationId, toLocationId), eq(locationStockTable.medicineId, medicineId)));
      if (toRow) {
        await tx.update(locationStockTable).set({ quantity: toRow.quantity + qty, updatedAt: new Date() }).where(eq(locationStockTable.id, toRow.id));
      } else {
        await tx.insert(locationStockTable).values({ entityId, locationId: toLocationId, medicineId, batchId, batchNo, quantity: qty });
      }

      const [transfer] = await tx.insert(locationTransfersTable).values({
        entityId, transferNo: genNo("TRF"), fromLocationId, toLocationId, medicineId, batchId, batchNo,
        quantity: qty, reason, status: "completed",
        transferredBy: req.session.userId, transferredByName: req.session.username ?? null,
      }).returning();
      return transfer;
    });
    await createAuditEntry(entityId, "stock_transfer", "location_transfer", { entityRefId: result.id, newValue: result, reason, userId: req.session.userId, userRole: req.session.role });
    return res.status(201).json(result);
  } catch (err: any) {
    req.log.error({ err }); return res.status(err.message?.includes("Insufficient") ? 409 : 500).json({ error: err.message ?? "Failed" });
  }
});

router.get("/pharmacy/location-transfers", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const rows = await db.select({
      id: locationTransfersTable.id,
      transferNo: locationTransfersTable.transferNo,
      fromLocation: sql<string>`fl.name`,
      toLocation: sql<string>`tl.name`,
      medicineName: medicinesTable.name,
      batchNo: locationTransfersTable.batchNo,
      quantity: locationTransfersTable.quantity,
      reason: locationTransfersTable.reason,
      transferredByName: locationTransfersTable.transferredByName,
      createdAt: locationTransfersTable.createdAt,
    }).from(locationTransfersTable)
      .leftJoin(sql`pharmacy_locations fl`, sql`fl.id = ${locationTransfersTable.fromLocationId}`)
      .leftJoin(sql`pharmacy_locations tl`, sql`tl.id = ${locationTransfersTable.toLocationId}`)
      .leftJoin(medicinesTable, eq(locationTransfersTable.medicineId, medicinesTable.id))
      .where(eq(locationTransfersTable.entityId, entityId))
      .orderBy(desc(locationTransfersTable.createdAt))
      .limit(200);
    return res.json(rows);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

// ════════════════════════════════════════════════════════════════════
// 3. IPD PATIENT MEDICINE ISSUE LEDGER
// ════════════════════════════════════════════════════════════════════

router.get("/pharmacy/ipd-issues", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { ipdAdmissionId, patientId } = req.query as Record<string, string>;
    const conds: any[] = [eq(ipdMedicineIssuesTable.entityId, entityId)];
    if (ipdAdmissionId) conds.push(eq(ipdMedicineIssuesTable.ipdAdmissionId, parseInt(ipdAdmissionId)));
    if (patientId) conds.push(eq(ipdMedicineIssuesTable.patientId, parseInt(patientId)));
    const rows = await db.select({
      id: ipdMedicineIssuesTable.id,
      issueNo: ipdMedicineIssuesTable.issueNo,
      issueDate: ipdMedicineIssuesTable.issueDate,
      patientId: ipdMedicineIssuesTable.patientId,
      patientName: patientsTable.name,
      ipdAdmissionId: ipdMedicineIssuesTable.ipdAdmissionId,
      items: ipdMedicineIssuesTable.items,
      totalAmount: ipdMedicineIssuesTable.totalAmount,
      netAmount: ipdMedicineIssuesTable.netAmount,
      returnAmount: ipdMedicineIssuesTable.returnAmount,
      status: ipdMedicineIssuesTable.status,
      postedToBill: ipdMedicineIssuesTable.postedToBill,
      issuedByName: ipdMedicineIssuesTable.issuedByName,
      createdAt: ipdMedicineIssuesTable.createdAt,
    }).from(ipdMedicineIssuesTable)
      .leftJoin(patientsTable, eq(ipdMedicineIssuesTable.patientId, patientsTable.id))
      .where(and(...conds))
      .orderBy(desc(ipdMedicineIssuesTable.createdAt));
    return res.json(rows);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.get("/pharmacy/ipd-issues/pending-amount", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { ipdAdmissionId } = req.query as Record<string, string>;
    if (!ipdAdmissionId) return res.status(400).json({ error: "ipdAdmissionId required" });
    const [row] = await db.select({
      total: sql<number>`coalesce(sum(${ipdMedicineIssuesTable.netAmount}), 0)`,
      count: sql<number>`count(*)`,
    }).from(ipdMedicineIssuesTable)
      .where(and(eq(ipdMedicineIssuesTable.entityId, entityId),
        eq(ipdMedicineIssuesTable.ipdAdmissionId, parseInt(ipdAdmissionId)),
        eq(ipdMedicineIssuesTable.postedToBill, false)));
    return res.json({ pendingAmount: Number(row?.total ?? 0), issueCount: Number(row?.count ?? 0) });
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.post("/pharmacy/ipd-issues", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { ipdAdmissionId, patientId, issueDate, items, notes } = req.body;
    const subtotal = (items as any[]).reduce((s: number, i: any) => s + parseFloat(i.amount ?? 0), 0);
    const gstAmount = (items as any[]).reduce((s: number, i: any) => s + parseFloat(i.gstAmount ?? 0), 0);
    const totalAmount = subtotal + gstAmount;

    const result = await db.transaction(async (tx) => {
      for (const item of items as any[]) {
        const qty = parseInt(item.quantity);
        const [med] = await tx.select({ stock: medicinesTable.stock })
          .from(medicinesTable).where(and(eq(medicinesTable.id, item.medicineId), eq(medicinesTable.entityId, entityId)));
        if (!med || med.stock < qty) throw new Error(`Insufficient stock for ${item.medicineName}`);
        await tx.update(medicinesTable).set({ stock: med.stock - qty }).where(eq(medicinesTable.id, item.medicineId));
        await tx.insert(stockMovementsTable).values({
          entityId, medicineId: item.medicineId, movementType: "ipd_issue",
          quantity: -qty, balanceAfter: med.stock - qty,
          referenceType: "ipd_issue", reason: `IPD issue — admission ${ipdAdmissionId}`,
          userId: req.session.userId,
        });
      }
      const [issue] = await tx.insert(ipdMedicineIssuesTable).values({
        entityId, ipdAdmissionId, patientId, issueNo: genNo("IPI"),
        issueDate: issueDate ?? today(), items, subtotal: subtotal.toString(),
        gstAmount: gstAmount.toString(), totalAmount: totalAmount.toString(),
        netAmount: totalAmount.toString(), status: "issued",
        issuedBy: req.session.userId, issuedByName: req.session.username ?? null, notes,
      }).returning();
      return issue;
    });
    await createAuditEntry(entityId, "ipd_issue", "ipd_medicine_issue", { entityRefId: result.id, newValue: result, userId: req.session.userId, userRole: req.session.role });
    return res.status(201).json(result);
  } catch (err: any) {
    req.log.error({ err }); return res.status(err.message?.includes("Insufficient") ? 409 : 500).json({ error: err.message ?? "Failed" });
  }
});

router.put("/pharmacy/ipd-issues/:id/post-to-bill", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const id = parseInt(req.params.id);
    const [updated] = await db.update(ipdMedicineIssuesTable)
      .set({ postedToBill: true, status: "billed" })
      .where(and(eq(ipdMedicineIssuesTable.id, id), eq(ipdMedicineIssuesTable.entityId, entityId)))
      .returning();
    return res.json(updated);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

// ════════════════════════════════════════════════════════════════════
// 4. MAR — MEDICATION ADMINISTRATION RECORD
// ════════════════════════════════════════════════════════════════════

router.get("/pharmacy/mar", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { ipdAdmissionId, status, date } = req.query as Record<string, string>;
    const conds: any[] = [eq(medicationAdminRecordsTable.entityId, entityId)];
    if (ipdAdmissionId) conds.push(eq(medicationAdminRecordsTable.ipdAdmissionId, parseInt(ipdAdmissionId)));
    if (status) conds.push(eq(medicationAdminRecordsTable.status, status));
    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      conds.push(gte(medicationAdminRecordsTable.scheduledAt, start));
      conds.push(lte(medicationAdminRecordsTable.scheduledAt, end));
    }
    const rows = await db.select({
      id: medicationAdminRecordsTable.id,
      patientId: medicationAdminRecordsTable.patientId,
      patientName: patientsTable.name,
      ipdAdmissionId: medicationAdminRecordsTable.ipdAdmissionId,
      medicineName: medicationAdminRecordsTable.medicineName,
      dose: medicationAdminRecordsTable.dose,
      route: medicationAdminRecordsTable.route,
      frequency: medicationAdminRecordsTable.frequency,
      scheduledAt: medicationAdminRecordsTable.scheduledAt,
      administeredAt: medicationAdminRecordsTable.administeredAt,
      status: medicationAdminRecordsTable.status,
      nurseName: medicationAdminRecordsTable.nurseName,
      reason: medicationAdminRecordsTable.reason,
      notes: medicationAdminRecordsTable.notes,
    }).from(medicationAdminRecordsTable)
      .leftJoin(patientsTable, eq(medicationAdminRecordsTable.patientId, patientsTable.id))
      .where(and(...conds))
      .orderBy(asc(medicationAdminRecordsTable.scheduledAt));
    return res.json(rows);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.post("/pharmacy/mar", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { ipdAdmissionId, patientId, medicineId, medicineName, dose, route, frequency, scheduledAt } = req.body;
    const [rec] = await db.insert(medicationAdminRecordsTable).values({
      entityId, ipdAdmissionId, patientId, medicineId, medicineName,
      dose, route, frequency, scheduledAt: new Date(scheduledAt), status: "pending",
    }).returning();
    return res.status(201).json(rec);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed to create MAR entry" }); }
});

router.put("/pharmacy/mar/:id", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const id = parseInt(req.params.id);
    const { status, reason, notes } = req.body;
    const [updated] = await db.update(medicationAdminRecordsTable).set({
      status,
      administeredAt: status === "given" ? new Date() : undefined,
      nurseId: req.session.userId,
      nurseName: req.session.username ?? null,
      reason, notes,
    }).where(and(eq(medicationAdminRecordsTable.id, id), eq(medicationAdminRecordsTable.entityId, entityId)))
      .returning();
    if (status === "missed") {
      await createNotification(entityId, "mar_missed", "high", "Missed Dose Alert",
        `Dose of ${updated.medicineName} missed for patient`, { referenceType: "mar", referenceId: id });
    }
    return res.json(updated);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed to update MAR" }); }
});

// ════════════════════════════════════════════════════════════════════
// 5. PRESCRIPTION → PHARMACY QUEUE
// ════════════════════════════════════════════════════════════════════

router.get("/pharmacy/prescription-queue", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { status, priority } = req.query as Record<string, string>;
    const conds: any[] = [eq(prescriptionQueueTable.entityId, entityId)];
    if (status) conds.push(eq(prescriptionQueueTable.status, status));
    if (priority) conds.push(eq(prescriptionQueueTable.priority, priority));
    const rows = await db.select({
      id: prescriptionQueueTable.id,
      queueNo: prescriptionQueueTable.queueNo,
      patientId: prescriptionQueueTable.patientId,
      patientName: patientsTable.name,
      patientPhone: patientsTable.phone,
      doctorName: prescriptionQueueTable.doctorName,
      prescriptionItems: prescriptionQueueTable.prescriptionItems,
      dispensedItems: prescriptionQueueTable.dispensedItems,
      unavailableItems: prescriptionQueueTable.unavailableItems,
      priority: prescriptionQueueTable.priority,
      status: prescriptionQueueTable.status,
      opdVisitId: prescriptionQueueTable.opdVisitId,
      ipdAdmissionId: prescriptionQueueTable.ipdAdmissionId,
      createdAt: prescriptionQueueTable.createdAt,
      updatedAt: prescriptionQueueTable.updatedAt,
    }).from(prescriptionQueueTable)
      .leftJoin(patientsTable, eq(prescriptionQueueTable.patientId, patientsTable.id))
      .where(and(...conds))
      .orderBy(
        sql`case ${prescriptionQueueTable.priority} when 'icu' then 0 when 'ot' then 1 when 'urgent' then 2 else 3 end`,
        desc(prescriptionQueueTable.createdAt)
      );
    return res.json(rows);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.post("/pharmacy/prescription-queue", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { patientId, opdVisitId, ipdAdmissionId, doctorId, doctorName, prescriptionItems, priority, notes } = req.body;
    // Enrich items with availability
    const enriched = await Promise.all((prescriptionItems as any[]).map(async (item: any) => {
      if (!item.medicineId) return { ...item, available: false, stock: 0 };
      const [med] = await db.select({ stock: medicinesTable.stock, name: medicinesTable.name })
        .from(medicinesTable).where(eq(medicinesTable.id, item.medicineId));
      return { ...item, available: (med?.stock ?? 0) >= (item.quantity ?? 1), stock: med?.stock ?? 0 };
    }));
    const unavailable = enriched.filter((i: any) => !i.available);
    const [queue] = await db.insert(prescriptionQueueTable).values({
      entityId, queueNo: genNo("RXQ"), patientId, opdVisitId, ipdAdmissionId,
      doctorId, doctorName, prescriptionItems: enriched,
      unavailableItems: unavailable, priority: priority ?? "normal",
      status: "pending", notes,
    }).returning();
    return res.status(201).json(queue);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed to add to queue" }); }
});

router.put("/pharmacy/prescription-queue/:id/dispense", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const id = parseInt(req.params.id);
    const { dispensedItems, saleId, status } = req.body;
    const [updated] = await db.update(prescriptionQueueTable).set({
      dispensedItems: dispensedItems ?? [],
      status: status ?? "completed",
      saleId,
      assignedTo: req.session.userId,
      updatedAt: new Date(),
    }).where(and(eq(prescriptionQueueTable.id, id), eq(prescriptionQueueTable.entityId, entityId))).returning();
    return res.json(updated);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed to update queue" }); }
});

// ════════════════════════════════════════════════════════════════════
// 6. OT / PROCEDURE KIT MANAGEMENT
// ════════════════════════════════════════════════════════════════════

router.get("/pharmacy/kits", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const kits = await db.select().from(procedureKitsTable)
      .where(eq(procedureKitsTable.entityId, entityId))
      .orderBy(procedureKitsTable.kitName);
    const kitsWithItems = await Promise.all(kits.map(async (kit) => {
      const items = await db.select({
        id: procedureKitItemsTable.id,
        medicineId: procedureKitItemsTable.medicineId,
        medicineName: medicinesTable.name,
        genericName: medicinesTable.genericName,
        quantity: procedureKitItemsTable.quantity,
        unit: procedureKitItemsTable.unit,
        stock: medicinesTable.stock,
        saleRate: medicinesTable.saleRate,
      }).from(procedureKitItemsTable)
        .leftJoin(medicinesTable, eq(procedureKitItemsTable.medicineId, medicinesTable.id))
        .where(eq(procedureKitItemsTable.kitId, kit.id));
      return { ...kit, items };
    }));
    return res.json(kitsWithItems);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.post("/pharmacy/kits", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { kitName, kitCode, procedureType, description, items } = req.body;
    const result = await db.transaction(async (tx) => {
      const [kit] = await tx.insert(procedureKitsTable).values({ entityId, kitName, kitCode, procedureType, description }).returning();
      if (items?.length) {
        await tx.insert(procedureKitItemsTable).values((items as any[]).map((i: any) => ({
          kitId: kit.id, medicineId: i.medicineId, quantity: i.quantity, unit: i.unit, notes: i.notes,
        })));
      }
      return kit;
    });
    return res.status(201).json(result);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed to create kit" }); }
});

router.post("/pharmacy/kits/:id/issue", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const kitId = parseInt(req.params.id);
    const { patientId, ipdAdmissionId, otId, notes } = req.body;
    const kitItems = await db.select({
      medicineId: procedureKitItemsTable.medicineId,
      quantity: procedureKitItemsTable.quantity,
      medicineName: medicinesTable.name,
      saleRate: medicinesTable.saleRate,
      stock: medicinesTable.stock,
    }).from(procedureKitItemsTable)
      .leftJoin(medicinesTable, eq(procedureKitItemsTable.medicineId, medicinesTable.id))
      .where(eq(procedureKitItemsTable.kitId, kitId));

    const result = await db.transaction(async (tx) => {
      let totalCost = 0;
      const issuedItems: any[] = [];
      for (const item of kitItems) {
        if (!item.medicineId) continue;
        const qty = item.quantity;
        const [med] = await tx.select({ stock: medicinesTable.stock }).from(medicinesTable).where(eq(medicinesTable.id, item.medicineId));
        if (!med || med.stock < qty) throw new Error(`Insufficient stock for ${item.medicineName}`);
        await tx.update(medicinesTable).set({ stock: med.stock - qty }).where(eq(medicinesTable.id, item.medicineId));
        const itemCost = parseFloat(item.saleRate ?? "0") * qty;
        totalCost += itemCost;
        issuedItems.push({ medicineId: item.medicineId, medicineName: item.medicineName, quantity: qty, rate: item.saleRate, amount: itemCost });
        await tx.insert(stockMovementsTable).values({
          entityId, medicineId: item.medicineId, movementType: "kit_issue",
          quantity: -qty, balanceAfter: med.stock - qty,
          referenceType: "kit_issue", userId: req.session.userId,
        });
      }
      const [log] = await tx.insert(kitIssueLogTable).values({
        entityId, kitId, issueNo: genNo("KIT"), issueDate: today(),
        patientId, ipdAdmissionId, otId, issuedItems, returnedItems: [],
        totalCost: totalCost.toString(), status: "issued", issuedBy: req.session.userId, notes,
      }).returning();
      return { log, totalCost };
    });
    await createAuditEntry(entityId, "kit_issue", "kit_issue_log", { entityRefId: result.log.id, newValue: result, userId: req.session.userId, userRole: req.session.role });
    return res.status(201).json(result);
  } catch (err: any) {
    req.log.error({ err }); return res.status(err.message?.includes("Insufficient") ? 409 : 500).json({ error: err.message ?? "Failed" });
  }
});

router.get("/pharmacy/kit-issues", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const rows = await db.select({
      id: kitIssueLogTable.id,
      issueNo: kitIssueLogTable.issueNo,
      issueDate: kitIssueLogTable.issueDate,
      kitName: procedureKitsTable.kitName,
      patientName: patientsTable.name,
      issuedItems: kitIssueLogTable.issuedItems,
      totalCost: kitIssueLogTable.totalCost,
      status: kitIssueLogTable.status,
      createdAt: kitIssueLogTable.createdAt,
    }).from(kitIssueLogTable)
      .leftJoin(procedureKitsTable, eq(kitIssueLogTable.kitId, procedureKitsTable.id))
      .leftJoin(patientsTable, eq(kitIssueLogTable.patientId, patientsTable.id))
      .where(eq(kitIssueLogTable.entityId, entityId))
      .orderBy(desc(kitIssueLogTable.createdAt)).limit(200);
    return res.json(rows);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

// ════════════════════════════════════════════════════════════════════
// 7. IMPLANT / HIGH-VALUE ITEM TRACKING
// ════════════════════════════════════════════════════════════════════

router.get("/pharmacy/implants", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { patientId } = req.query as Record<string, string>;
    const conds: any[] = [eq(implantTrackingTable.entityId, entityId)];
    if (patientId) conds.push(eq(implantTrackingTable.patientId, parseInt(patientId)));
    const rows = await db.select({
      id: implantTrackingTable.id,
      medicineName: implantTrackingTable.medicineName,
      serialNo: implantTrackingTable.serialNo,
      batchNo: implantTrackingTable.batchNo,
      expiryDate: implantTrackingTable.expiryDate,
      patientId: implantTrackingTable.patientId,
      patientName: patientsTable.name,
      surgeonName: implantTrackingTable.surgeonName,
      anatomicalSite: implantTrackingTable.anatomicalSite,
      implantDate: implantTrackingTable.implantDate,
      saleRate: implantTrackingTable.saleRate,
      consentRef: implantTrackingTable.consentRef,
      createdAt: implantTrackingTable.createdAt,
    }).from(implantTrackingTable)
      .leftJoin(patientsTable, eq(implantTrackingTable.patientId, patientsTable.id))
      .where(and(...conds))
      .orderBy(desc(implantTrackingTable.createdAt));
    return res.json(rows);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.post("/pharmacy/implants", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const body = req.body;
    if (!body.patientId) return res.status(400).json({ error: "Patient linkage required for implant tracking" });
    const [rec] = await db.insert(implantTrackingTable).values({
      entityId, ...body, createdBy: req.session.userId,
    }).returning();
    await createAuditEntry(entityId, "implant_tracked", "implant_tracking", { entityRefId: rec.id, newValue: rec, userId: req.session.userId, userRole: req.session.role });
    return res.status(201).json(rec);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed to record implant" }); }
});

// ════════════════════════════════════════════════════════════════════
// 8. EXPIRY LOSS REGISTER
// ════════════════════════════════════════════════════════════════════

router.get("/pharmacy/expiry-loss", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { status } = req.query as Record<string, string>;
    const conds: any[] = [eq(expiryLossRegisterTable.entityId, entityId)];
    if (status) conds.push(eq(expiryLossRegisterTable.status, status));
    const rows = await db.select().from(expiryLossRegisterTable)
      .where(and(...conds)).orderBy(desc(expiryLossRegisterTable.createdAt));
    return res.json(rows);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.post("/pharmacy/expiry-loss", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { medicineId, medicineName, batchNo, expiryDate, quantity, disposalReason, disposalMethod, notes } = req.body;
    const [med] = await db.select({ purchaseRate: medicinesTable.purchaseRate, gstPercent: medicinesTable.gstPercent })
      .from(medicinesTable).where(and(eq(medicinesTable.id, medicineId), eq(medicinesTable.entityId, entityId)));
    const pr = parseFloat(med?.purchaseRate ?? "0");
    const gst = parseFloat(med?.gstPercent ?? "12");
    const lossValue = pr * parseInt(quantity);
    const gstValue = lossValue * gst / 100;
    const [rec] = await db.insert(expiryLossRegisterTable).values({
      entityId, lossNo: genNo("EXL"), disposalDate: today(),
      medicineId, medicineName, batchNo, expiryDate, quantity: parseInt(quantity),
      purchaseRate: pr.toString(), lossValue: lossValue.toString(),
      gstValue: gstValue.toString(), disposalReason, disposalMethod, notes,
      createdBy: req.session.userId, status: "pending",
    }).returning();
    await createAuditEntry(entityId, "expiry_loss_created", "expiry_loss", { entityRefId: rec.id, newValue: rec, userId: req.session.userId, userRole: req.session.role });
    return res.status(201).json(rec);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed to create expiry loss" }); }
});

router.put("/pharmacy/expiry-loss/:id/approve", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const id = parseInt(req.params.id);
    const [rec] = await db.select().from(expiryLossRegisterTable).where(eq(expiryLossRegisterTable.id, id));
    if (!rec) return res.status(404).json({ error: "Not found" });

    const result = await db.transaction(async (tx) => {
      await tx.update(medicinesTable).set({ stock: sql`greatest(0, ${medicinesTable.stock} - ${rec.quantity})` })
        .where(and(eq(medicinesTable.id, rec.medicineId), eq(medicinesTable.entityId, entityId)));
      await tx.insert(stockMovementsTable).values({
        entityId, medicineId: rec.medicineId, movementType: "expiry_loss",
        quantity: -rec.quantity, referenceType: "expiry_loss", referenceId: id,
        reason: rec.disposalReason, userId: req.session.userId,
      });
      const [updated] = await tx.update(expiryLossRegisterTable).set({
        status: "approved", approvedBy: req.session.userId, approvedByName: req.session.username ?? null,
      }).where(eq(expiryLossRegisterTable.id, id)).returning();
      return updated;
    });
    await createAuditEntry(entityId, "expiry_loss_approved", "expiry_loss", { entityRefId: id, newValue: result, userId: req.session.userId, userRole: req.session.role });
    return res.json(result);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed to approve" }); }
});

// ════════════════════════════════════════════════════════════════════
// 9. PHYSICAL STOCK VERIFICATION
// ════════════════════════════════════════════════════════════════════

router.get("/pharmacy/stock-verification", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const sessions = await db.select().from(stockVerificationSessionsTable)
      .where(eq(stockVerificationSessionsTable.entityId, entityId))
      .orderBy(desc(stockVerificationSessionsTable.createdAt));
    return res.json(sessions);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.post("/pharmacy/stock-verification", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { verificationDate, notes } = req.body;
    // Snapshot all medicine stock as count sheet
    const medicines = await db.select({
      id: medicinesTable.id, name: medicinesTable.name, stock: medicinesTable.stock,
      batchNo: medicinesTable.batchNo, purchaseRate: medicinesTable.purchaseRate,
    }).from(medicinesTable).where(eq(medicinesTable.entityId, entityId));

    const result = await db.transaction(async (tx) => {
      const [session] = await tx.insert(stockVerificationSessionsTable).values({
        entityId, sessionNo: genNo("SVS"), verificationDate: verificationDate ?? today(),
        status: "open", createdBy: req.session.userId, notes,
      }).returning();
      await tx.insert(stockVerificationItemsTable).values(medicines.map(m => ({
        sessionId: session.id, medicineId: m.id, medicineName: m.name,
        batchNo: m.batchNo, systemQty: m.stock, purchaseRate: m.purchaseRate,
      })));
      return session;
    });
    return res.status(201).json(result);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed to create verification" }); }
});

router.get("/pharmacy/stock-verification/:id/items", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const id = parseInt(req.params.id);
    const items = await db.select().from(stockVerificationItemsTable)
      .where(eq(stockVerificationItemsTable.sessionId, id));
    return res.json(items);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.put("/pharmacy/stock-verification/:id/items/:itemId", async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const { physicalQty, reason } = req.body;
    const pQty = parseInt(physicalQty);
    const [item] = await db.select().from(stockVerificationItemsTable).where(eq(stockVerificationItemsTable.id, itemId));
    if (!item) return res.status(404).json({ error: "Not found" });
    const variance = pQty - item.systemQty;
    const varianceValue = variance * parseFloat(item.purchaseRate ?? "0");
    const [updated] = await db.update(stockVerificationItemsTable).set({
      physicalQty: pQty, variance, varianceValue: varianceValue.toString(), reason,
    }).where(eq(stockVerificationItemsTable.id, itemId)).returning();
    return res.json(updated);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.put("/pharmacy/stock-verification/:id/complete", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const id = parseInt(req.params.id);
    const items = await db.select().from(stockVerificationItemsTable).where(eq(stockVerificationItemsTable.sessionId, id));
    const totalVariance = items.reduce((s, i) => s + parseFloat(i.varianceValue?.toString() ?? "0"), 0);
    const [updated] = await db.update(stockVerificationSessionsTable).set({
      status: "completed", completedAt: new Date(),
      totalVarianceValue: totalVariance.toString(),
    }).where(and(eq(stockVerificationSessionsTable.id, id), eq(stockVerificationSessionsTable.entityId, entityId))).returning();
    await createAuditEntry(entityId, "stock_verification_completed", "stock_verification", { entityRefId: id, newValue: { totalVariance }, userId: req.session.userId, userRole: req.session.role });
    return res.json(updated);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

// ════════════════════════════════════════════════════════════════════
// 10. MRP / RATE CHANGE HISTORY
// ════════════════════════════════════════════════════════════════════

router.get("/pharmacy/rate-history", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { medicineId, status } = req.query as Record<string, string>;
    const conds: any[] = [eq(mrpRateHistoryTable.entityId, entityId)];
    if (medicineId) conds.push(eq(mrpRateHistoryTable.medicineId, parseInt(medicineId)));
    if (status) conds.push(eq(mrpRateHistoryTable.status, status));
    const rows = await db.select({
      id: mrpRateHistoryTable.id,
      medicineName: medicinesTable.name,
      changedField: mrpRateHistoryTable.changedField,
      oldValue: mrpRateHistoryTable.oldValue,
      newValue: mrpRateHistoryTable.newValue,
      changeReason: mrpRateHistoryTable.changeReason,
      approvedByName: mrpRateHistoryTable.approvedByName,
      changedByName: mrpRateHistoryTable.changedByName,
      effectiveDate: mrpRateHistoryTable.effectiveDate,
      status: mrpRateHistoryTable.status,
      createdAt: mrpRateHistoryTable.createdAt,
    }).from(mrpRateHistoryTable)
      .leftJoin(medicinesTable, eq(mrpRateHistoryTable.medicineId, medicinesTable.id))
      .where(and(...conds))
      .orderBy(desc(mrpRateHistoryTable.createdAt));
    return res.json(rows);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.post("/pharmacy/rate-history", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { medicineId, changedField, newValue, changeReason, effectiveDate } = req.body;
    const [med] = await db.select().from(medicinesTable).where(and(eq(medicinesTable.id, medicineId), eq(medicinesTable.entityId, entityId)));
    if (!med) return res.status(404).json({ error: "Medicine not found" });
    const oldValue = (med as any)[changedField === "mrp" ? "mrp" : changedField === "sale_rate" ? "saleRate" : "purchaseRate"];
    const [rec] = await db.insert(mrpRateHistoryTable).values({
      entityId, medicineId, changedField, oldValue: oldValue?.toString(), newValue: newValue.toString(),
      changeReason, effectiveDate: effectiveDate ?? today(),
      changedBy: req.session.userId, changedByName: req.session.username ?? null,
      status: req.session.role === "admin" ? "approved" : "pending",
    }).returning();
    if (rec.status === "approved") {
      const update: any = {};
      if (changedField === "mrp") update.mrp = newValue.toString();
      else if (changedField === "sale_rate") update.saleRate = newValue.toString();
      else update.purchaseRate = newValue.toString();
      await db.update(medicinesTable).set(update).where(eq(medicinesTable.id, medicineId));
    }
    return res.status(201).json(rec);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.put("/pharmacy/rate-history/:id/approve", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const id = parseInt(req.params.id);
    const [rec] = await db.select().from(mrpRateHistoryTable).where(eq(mrpRateHistoryTable.id, id));
    if (!rec) return res.status(404).json({ error: "Not found" });
    const update: any = {};
    if (rec.changedField === "mrp") update.mrp = rec.newValue;
    else if (rec.changedField === "sale_rate") update.saleRate = rec.newValue;
    else update.purchaseRate = rec.newValue;
    await db.transaction(async (tx) => {
      await tx.update(mrpRateHistoryTable).set({
        status: "approved", approvedBy: req.session.userId, approvedByName: req.session.username ?? null,
      }).where(eq(mrpRateHistoryTable.id, id));
      await tx.update(medicinesTable).set({ ...update, updatedAt: new Date() })
        .where(and(eq(medicinesTable.id, rec.medicineId), eq(medicinesTable.entityId, entityId)));
    });
    return res.json({ success: true });
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

// ════════════════════════════════════════════════════════════════════
// 11. STAFF / INTERNAL MEDICINE ISSUES
// ════════════════════════════════════════════════════════════════════

router.get("/pharmacy/staff-issues", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { status } = req.query as Record<string, string>;
    const conds: any[] = [eq(staffMedicineIssuesTable.entityId, entityId)];
    if (status) conds.push(eq(staffMedicineIssuesTable.status, status));
    const rows = await db.select().from(staffMedicineIssuesTable)
      .where(and(...conds)).orderBy(desc(staffMedicineIssuesTable.createdAt));
    return res.json(rows);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.post("/pharmacy/staff-issues", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { recipientName, recipientId, department, recipientType, items, purpose, notes } = req.body;
    const totalValue = (items as any[]).reduce((s: number, i: any) => s + parseFloat(i.amount ?? 0), 0);
    const [rec] = await db.insert(staffMedicineIssuesTable).values({
      entityId, issueNo: genNo("SIS"), issueDate: today(),
      recipientType: recipientType ?? "staff", recipientName, recipientId, department,
      items, totalValue: totalValue.toString(), purpose, notes,
      status: req.session.role === "admin" ? "approved" : "pending",
    }).returning();
    return res.status(201).json(rec);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.put("/pharmacy/staff-issues/:id/approve", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const id = parseInt(req.params.id);
    const [rec] = await db.select().from(staffMedicineIssuesTable).where(eq(staffMedicineIssuesTable.id, id));
    if (!rec) return res.status(404).json({ error: "Not found" });

    const result = await db.transaction(async (tx) => {
      for (const item of rec.items as any[]) {
        const qty = parseInt(item.quantity);
        const [med] = await tx.select({ stock: medicinesTable.stock }).from(medicinesTable).where(eq(medicinesTable.id, item.medicineId));
        if (!med || med.stock < qty) throw new Error(`Insufficient stock for ${item.medicineName}`);
        await tx.update(medicinesTable).set({ stock: med.stock - qty }).where(eq(medicinesTable.id, item.medicineId));
        await tx.insert(stockMovementsTable).values({
          entityId, medicineId: item.medicineId, movementType: "staff_issue",
          quantity: -qty, balanceAfter: med.stock - qty,
          referenceType: "staff_issue", referenceId: id, userId: req.session.userId,
        });
      }
      const [updated] = await tx.update(staffMedicineIssuesTable).set({
        status: "issued", approvedBy: req.session.userId, approvedByName: req.session.username ?? null,
        approvedAt: new Date(), issuedBy: req.session.userId, issuedByName: req.session.username ?? null,
      }).where(eq(staffMedicineIssuesTable.id, id)).returning();
      return updated;
    });
    await createAuditEntry(entityId, "staff_issue_approved", "staff_issue", { entityRefId: id, newValue: result, userId: req.session.userId, userRole: req.session.role });
    return res.json(result);
  } catch (err: any) {
    req.log.error({ err }); return res.status(err.message?.includes("Insufficient") ? 409 : 500).json({ error: err.message ?? "Failed" });
  }
});

// ════════════════════════════════════════════════════════════════════
// 12. PURCHASE INDENT APPROVAL
// ════════════════════════════════════════════════════════════════════

router.get("/pharmacy/purchase-indents", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { status } = req.query as Record<string, string>;
    const conds: any[] = [eq(purchaseIndentsTable.entityId, entityId)];
    if (status) conds.push(eq(purchaseIndentsTable.status, status));
    const indents = await db.select().from(purchaseIndentsTable)
      .where(and(...conds)).orderBy(desc(purchaseIndentsTable.createdAt));
    const result = await Promise.all(indents.map(async (ind) => {
      const items = await db.select().from(purchaseIndentItemsTable).where(eq(purchaseIndentItemsTable.indentId, ind.id));
      return { ...ind, items };
    }));
    return res.json(result);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.post("/pharmacy/purchase-indents", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { requestedByName, department, urgency, items, notes } = req.body;
    const result = await db.transaction(async (tx) => {
      const [indent] = await tx.insert(purchaseIndentsTable).values({
        entityId, indentNo: genNo("PI"), indentDate: today(),
        requestedBy: req.session.userId, requestedByName, department,
        urgency: urgency ?? "routine", status: "pending", notes,
      }).returning();
      await tx.insert(purchaseIndentItemsTable).values((items as any[]).map((i: any) => ({
        indentId: indent.id, medicineId: i.medicineId, medicineName: i.medicineName,
        requiredQty: i.requiredQty, unit: i.unit,
        lastPurchaseRate: i.lastPurchaseRate, estimatedRate: i.estimatedRate, reason: i.reason,
      })));
      return indent;
    });
    return res.status(201).json(result);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed to create indent" }); }
});

router.put("/pharmacy/purchase-indents/:id/approve", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const id = parseInt(req.params.id);
    const { approvedQtys } = req.body;
    await db.transaction(async (tx) => {
      await tx.update(purchaseIndentsTable).set({
        status: "approved", approvedBy: req.session.userId, approvedByName: req.session.username ?? null, approvedAt: new Date(),
      }).where(and(eq(purchaseIndentsTable.id, id), eq(purchaseIndentsTable.entityId, entityId)));
      if (approvedQtys) {
        for (const [itemId, qty] of Object.entries(approvedQtys)) {
          await tx.update(purchaseIndentItemsTable).set({ approvedQty: qty as number })
            .where(eq(purchaseIndentItemsTable.id, parseInt(itemId)));
        }
      }
    });
    return res.json({ success: true });
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.put("/pharmacy/purchase-indents/:id/reject", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const id = parseInt(req.params.id);
    const { rejectionReason } = req.body;
    const [updated] = await db.update(purchaseIndentsTable).set({
      status: "rejected", approvedBy: req.session.userId, approvedByName: req.session.username ?? null,
      approvedAt: new Date(), rejectionReason,
    }).where(and(eq(purchaseIndentsTable.id, id), eq(purchaseIndentsTable.entityId, entityId))).returning();
    return res.json(updated);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

// ════════════════════════════════════════════════════════════════════
// 13. ANALYTICS — DEAD STOCK / FAST-MOVING / ANTIBIOTIC
// ════════════════════════════════════════════════════════════════════

router.get("/pharmacy/analytics/dead-stock", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const days = parseInt((req.query.days as string) ?? "90");
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    // Find medicines with no sales movements since cutoff
    const rows = await db.execute(sql`
      SELECT m.id, m.name, m.generic_name, m.stock, m.purchase_rate, m.sale_rate, m.category,
             COALESCE((m.stock * m.purchase_rate::numeric), 0) as blocked_value,
             MAX(sm.created_at) as last_movement_date
      FROM medicines m
      LEFT JOIN stock_movements sm ON sm.medicine_id = m.id
        AND sm.movement_type IN ('sale','ipd_issue','kit_issue','staff_issue')
        AND sm.created_at >= ${cutoff}
      WHERE m.entity_id = ${entityId} AND m.stock > 0
      GROUP BY m.id, m.name, m.generic_name, m.stock, m.purchase_rate, m.sale_rate, m.category
      HAVING MAX(sm.created_at) IS NULL OR MAX(sm.created_at) < ${cutoff}
      ORDER BY blocked_value DESC
    `);
    return res.json({ days, items: rows.rows });
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.get("/pharmacy/analytics/fast-moving", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const days = parseInt((req.query.days as string) ?? "30");
    const limit = parseInt((req.query.limit as string) ?? "20");
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const rows = await db.execute(sql`
      SELECT m.id, m.name, m.generic_name, m.category,
             ABS(SUM(sm.quantity)) as total_qty,
             COUNT(sm.id) as movement_count,
             ABS(SUM(sm.quantity)) * m.sale_rate::numeric as total_value
      FROM stock_movements sm
      JOIN medicines m ON m.id = sm.medicine_id
      WHERE sm.entity_id = ${entityId}
        AND sm.movement_type IN ('sale','ipd_issue','kit_issue')
        AND sm.created_at >= ${cutoff}
      GROUP BY m.id, m.name, m.generic_name, m.category, m.sale_rate
      ORDER BY total_value DESC
      LIMIT ${limit}
    `);
    return res.json({ days, items: rows.rows });
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.get("/pharmacy/analytics/antibiotic-usage", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { fromDate, toDate } = req.query as Record<string, string>;
    const from = fromDate ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = toDate ?? today();
    const rows = await db.execute(sql`
      SELECT m.antibiotic_class, m.name, m.generic_name,
             ABS(SUM(sm.quantity)) as total_qty,
             COUNT(DISTINCT ps.patient_id) as patient_count,
             ABS(SUM(sm.quantity)) * m.sale_rate::numeric as total_value
      FROM stock_movements sm
      JOIN medicines m ON m.id = sm.medicine_id
      LEFT JOIN pharmacy_sales ps ON ps.id = sm.reference_id AND sm.reference_type = 'sale'
      WHERE sm.entity_id = ${entityId}
        AND m.antibiotic_class IS NOT NULL
        AND sm.movement_type = 'sale'
        AND sm.created_at::date BETWEEN ${from} AND ${to}
      GROUP BY m.antibiotic_class, m.name, m.generic_name, m.sale_rate
      ORDER BY total_qty DESC
    `);
    return res.json({ fromDate: from, toDate: to, items: rows.rows });
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.get("/pharmacy/analytics/margin-check", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const rows = await db.execute(sql`
      SELECT id, name, generic_name, purchase_rate, sale_rate, mrp, min_margin_percent,
        CASE WHEN purchase_rate::numeric > 0
          THEN ROUND(((sale_rate::numeric - purchase_rate::numeric) / purchase_rate::numeric) * 100, 2)
          ELSE NULL END as actual_margin_percent,
        CASE WHEN min_margin_percent IS NOT NULL AND purchase_rate::numeric > 0
          AND ((sale_rate::numeric - purchase_rate::numeric) / purchase_rate::numeric) * 100 < min_margin_percent::numeric
          THEN true ELSE false END as below_min_margin
      FROM medicines
      WHERE entity_id = ${entityId} AND purchase_rate IS NOT NULL AND purchase_rate::numeric > 0
      ORDER BY actual_margin_percent ASC NULLS LAST
      LIMIT 100
    `);
    return res.json(rows.rows);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

// ════════════════════════════════════════════════════════════════════
// 14. NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════

router.get("/pharmacy/notifications", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { unreadOnly } = req.query as Record<string, string>;
    const conds: any[] = [eq(pharmacyNotificationsTable.entityId, entityId)];
    if (unreadOnly === "true") conds.push(eq(pharmacyNotificationsTable.isRead, false));
    const rows = await db.select().from(pharmacyNotificationsTable)
      .where(and(...conds)).orderBy(desc(pharmacyNotificationsTable.createdAt)).limit(50);
    return res.json(rows);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.put("/pharmacy/notifications/:id/read", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const id = parseInt(req.params.id);
    await db.update(pharmacyNotificationsTable).set({ isRead: true, readBy: req.session.userId, readAt: new Date() })
      .where(and(eq(pharmacyNotificationsTable.id, id), eq(pharmacyNotificationsTable.entityId, entityId)));
    return res.json({ success: true });
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

router.put("/pharmacy/notifications/read-all", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    await db.update(pharmacyNotificationsTable).set({ isRead: true, readBy: req.session.userId, readAt: new Date() })
      .where(and(eq(pharmacyNotificationsTable.entityId, entityId), eq(pharmacyNotificationsTable.isRead, false)));
    return res.json({ success: true });
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

// ════════════════════════════════════════════════════════════════════
// 15. MEDICINE MASTER — HIGH-ALERT / LASA FLAGS
// ════════════════════════════════════════════════════════════════════

router.get("/pharmacy/high-alert-medicines", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const rows = await db.select({
      id: medicinesTable.id,
      name: medicinesTable.name,
      genericName: medicinesTable.genericName,
      lasaFlag: medicinesTable.lasaFlag,
      highAlertFlag: medicinesTable.highAlertFlag,
      coldChainRequired: medicinesTable.coldChainRequired,
      antibioticClass: medicinesTable.antibioticClass,
      scheduleType: medicinesTable.scheduleType,
      stock: medicinesTable.stock,
      rackLocation: medicinesTable.rackLocation,
      shelfLocation: medicinesTable.shelfLocation,
    }).from(medicinesTable)
      .where(and(eq(medicinesTable.entityId, entityId),
        or(eq(medicinesTable.lasaFlag, true), eq(medicinesTable.highAlertFlag, true))))
      .orderBy(medicinesTable.name);
    return res.json(rows);
  } catch (err) { req.log.error({ err }); return res.status(500).json({ error: "Failed" }); }
});

export default router;
