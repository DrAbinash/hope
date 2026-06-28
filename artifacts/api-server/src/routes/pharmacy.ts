import { Router } from "express";
import { db } from "@workspace/db";
import { medicinesTable, pharmacySalesTable, patientsTable, scheduleHRegisterTable, vendorsTable, vendorPurchasesTable, purchaseReturnsTable, purchaseReturnItemsTable } from "@workspace/db";
import { eq, sql, and, gte, lte, inArray, desc } from "drizzle-orm";
import { requireRole } from "./auth";

const router = Router();

function generateBillNo(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const num = Math.floor(1000 + Math.random() * 9000);
  return `PH${dateStr}${num}`;
}

router.get("/pharmacy/medicines", async (req, res) => {
  try {
    const { search } = req.query;
    const entityId = req.session.entityId ?? 1;
    let medicines = await db.select().from(medicinesTable).where(eq(medicinesTable.entityId, entityId)).orderBy(medicinesTable.name);
    if (search) {
      const s = (search as string).toLowerCase();
      medicines = medicines.filter(m =>
        m.name.toLowerCase().includes(s) ||
        (m.genericName || "").toLowerCase().includes(s) ||
        (m.brandName || "").toLowerCase().includes(s) ||
        (m.strength || "").toLowerCase().includes(s) ||
        (m.barcode || "").toLowerCase().includes(s));
    }
    res.json(medicines);
  } catch (err) {
    req.log.error({ err }, "Failed to list medicines");
    res.status(500).json({ error: "Failed to list medicines" });
  }
});

router.get("/pharmacy/medicines/by-barcode/:code", async (req, res) => {
  try {
    const code = req.params.code.trim();
    const entityId = req.session.entityId ?? 1;
    const [med] = await db.select().from(medicinesTable).where(and(eq(medicinesTable.barcode, code), eq(medicinesTable.entityId, entityId))).limit(1);
    if (!med) return res.status(404).json({ error: "Medicine not found for this barcode" });
    res.json(med);
  } catch (err) {
    req.log.error({ err }, "Failed barcode lookup");
    res.status(500).json({ error: "Failed barcode lookup" });
  }
});

router.post("/pharmacy/medicines", async (req, res) => {
  try {
    const { name, genericName, brandName, strength, formulation, category, manufacturer, batchNo, expiryDate, barcode, mrp, purchaseRate, saleRate, stock, unit, hsnCode, gstPercent, reorderLevel, minStock, maxStock, leadTimeDays, avgDailyConsumption } = req.body;
    if (!name || !mrp || !saleRate) return res.status(400).json({ error: "name, mrp, saleRate are required" });
    const entityId = req.session.entityId ?? 1;
    const [medicine] = await db.insert(medicinesTable).values({
      entityId,
      name, genericName, brandName, strength, formulation, category, manufacturer, batchNo, expiryDate, barcode,
      mrp: mrp.toString(), purchaseRate: purchaseRate?.toString(), saleRate: saleRate.toString(),
      stock: stock || 0, unit: unit || "strip", hsnCode, gstPercent: gstPercent?.toString() || "12",
      reorderLevel: reorderLevel || 10, minStock: minStock || 5, maxStock: maxStock || 100,
      leadTimeDays: leadTimeDays || 3, avgDailyConsumption: avgDailyConsumption?.toString() || "0",
      scheduleType: req.body.scheduleType || "general",
    }).returning();
    res.status(201).json(medicine);
  } catch (err) {
    req.log.error({ err }, "Failed to create medicine");
    res.status(500).json({ error: "Failed to create medicine" });
  }
});

router.put("/pharmacy/medicines/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const { name, genericName, brandName, strength, formulation, category, manufacturer, batchNo, expiryDate, barcode, mrp, purchaseRate, saleRate, stock, unit, hsnCode, gstPercent, reorderLevel, minStock, maxStock, leadTimeDays, avgDailyConsumption } = req.body;
    const [medicine] = await db.update(medicinesTable).set({
      name, genericName, brandName, strength, formulation, category, manufacturer, batchNo, expiryDate, barcode,
      mrp: mrp?.toString(), purchaseRate: purchaseRate?.toString(), saleRate: saleRate?.toString(),
      stock, unit, hsnCode, gstPercent: gstPercent?.toString(), reorderLevel,
      minStock, maxStock, leadTimeDays, avgDailyConsumption: avgDailyConsumption?.toString(),
      scheduleType: req.body.scheduleType, updatedAt: new Date(),
    }).where(and(eq(medicinesTable.id, id), eq(medicinesTable.entityId, entityId))).returning();
    if (!medicine) return res.status(404).json({ error: "Medicine not found" });
    res.json(medicine);
  } catch (err) {
    req.log.error({ err }, "Failed to update medicine");
    res.status(500).json({ error: "Failed to update medicine" });
  }
});

router.get("/pharmacy/sales", async (req, res) => {
  try {
    const { patientId, date, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const entityId = req.session.entityId ?? 1;

    const sales = await db.select({
      id: pharmacySalesTable.id, billNo: pharmacySalesTable.billNo,
      patientId: pharmacySalesTable.patientId, patientName: patientsTable.name,
      ipdAdmissionId: pharmacySalesTable.ipdAdmissionId, items: pharmacySalesTable.items,
      subtotal: pharmacySalesTable.subtotal, discount: pharmacySalesTable.discount,
      gstAmount: pharmacySalesTable.gstAmount,
      cgstAmount: pharmacySalesTable.cgstAmount, sgstAmount: pharmacySalesTable.sgstAmount,
      igstAmount: pharmacySalesTable.igstAmount, gstStateType: pharmacySalesTable.gstStateType,
      totalAmount: pharmacySalesTable.totalAmount,
      paidAmount: pharmacySalesTable.paidAmount, dueAmount: pharmacySalesTable.dueAmount,
      paymentMode: pharmacySalesTable.paymentMode, billDate: pharmacySalesTable.billDate,
      postedToAccounting: pharmacySalesTable.postedToAccounting,
      billStatus: pharmacySalesTable.billStatus,
      finalizedAt: pharmacySalesTable.finalizedAt,
      createdAt: pharmacySalesTable.createdAt,
    }).from(pharmacySalesTable)
      .leftJoin(patientsTable, eq(pharmacySalesTable.patientId, patientsTable.id))
      .where(eq(pharmacySalesTable.entityId, entityId))
      .orderBy(pharmacySalesTable.createdAt)
      .limit(limitNum).offset(offset);

    let filtered = sales;
    if (patientId) filtered = filtered.filter(s => s.patientId === parseInt(patientId));
    if (date) filtered = filtered.filter(s => s.billDate === date);

    const total = await db.select({ count: sql<number>`count(*)` }).from(pharmacySalesTable).where(eq(pharmacySalesTable.entityId, entityId));
    res.json({ sales: filtered, total: Number(total[0].count), page: pageNum });
  } catch (err) {
    req.log.error({ err }, "Failed to list pharmacy sales");
    res.status(500).json({ error: "Failed to list pharmacy sales" });
  }
});

// Pharmacy sale — atomic transaction, guarded stock decrement, GST snapshot per line
router.post("/pharmacy/sales", async (req, res) => {
  try {
    const { patientId, ipdAdmissionId, items, discount = 0, paidAmount, paymentMode, gstStateType = "intra", billStatus = "final" } = req.body;
    if (!items?.length) {
      return res.status(400).json({ error: "items are required" });
    }
    if (billStatus !== "provisional" && billStatus !== "final") {
      return res.status(400).json({ error: "billStatus must be 'provisional' or 'final'" });
    }
    // Provisional: no payment captured yet (paid=0, due=total, paymentMode='credit').
    // Final: payment must be supplied.
    if (billStatus === "final" && (paidAmount === undefined || !paymentMode)) {
      return res.status(400).json({ error: "paidAmount and paymentMode are required for a final bill" });
    }
    const entityId = req.session.entityId ?? 1;
    if (patientId) {
      const [pcheck] = await db.select({ id: patientsTable.id }).from(patientsTable).where(and(eq(patientsTable.id, patientId), eq(patientsTable.entityId, entityId)));
      if (!pcheck) return res.status(404).json({ error: "Patient not found in this entity" });
    }

    const result = await db.transaction(async (tx) => {
      // Snapshot HSN + GST rate per line at sale time so historical GSTR-1 stays correct
      // even if medicine master is later edited. Medicine entity must match session.
      const medIds = items.filter((i: any) => i.medicineId).map((i: any) => i.medicineId);
      const meds = medIds.length
        ? await tx.select().from(medicinesTable).where(and(inArray(medicinesTable.id, medIds), eq(medicinesTable.entityId, entityId)))
        : [];
      if (medIds.length !== meds.length) {
        throw new Error("One or more medicines do not belong to this entity");
      }
      const medMap = new Map(meds.map(m => [m.id, m]));

      const snapshotItems = items.map((i: any) => {
        const med = i.medicineId ? medMap.get(i.medicineId) : undefined;
        return {
          ...i,
          hsnCode: i.hsnCode || med?.hsnCode || "30049099",
          gstPercent: parseFloat(i.gstPercent ?? med?.gstPercent ?? "12"),
        };
      });

      const subtotal = snapshotItems.reduce((s: number, i: any) => s + (i.amount || 0), 0);
      const gstAmount = snapshotItems.reduce((s: number, i: any) => s + (i.amount * (i.gstPercent || 0) / 100), 0);
      let cgst = 0, sgst = 0, igst = 0;
      if (gstStateType === "inter") igst = gstAmount;
      else { cgst = gstAmount / 2; sgst = gstAmount / 2; }
      const totalAmount = subtotal - discount + gstAmount;
      const effPaid = billStatus === "provisional" ? 0 : Number(paidAmount);
      const effMode = billStatus === "provisional" ? "credit" : paymentMode;
      const dueAmount = totalAmount - effPaid;
      const billNo = generateBillNo();
      const billDate = new Date().toISOString().slice(0, 10);

      // Atomic stock decrement with guard: WHERE stock >= qty.
      // If guard fails the row update returns 0 rows → throw to roll back the whole sale.
      for (const it of snapshotItems) {
        if (!it.medicineId || !it.quantity) continue;
        const qty = Math.floor(it.quantity);
        const updated = await tx.update(medicinesTable)
          .set({ stock: sql`${medicinesTable.stock} - ${qty}`, updatedAt: new Date() })
          .where(and(eq(medicinesTable.id, it.medicineId), eq(medicinesTable.entityId, entityId), gte(medicinesTable.stock, qty)))
          .returning({ id: medicinesTable.id });
        if (updated.length === 0) {
          const med = medMap.get(it.medicineId);
          throw new Error(`Insufficient stock for ${med?.name || `medicine #${it.medicineId}`} (requested ${qty})`);
        }
      }

      const [sale] = await tx.insert(pharmacySalesTable).values({
        entityId,
        billNo, patientId, ipdAdmissionId, items: snapshotItems, billDate,
        subtotal: subtotal.toString(), discount: discount.toString(), gstAmount: gstAmount.toString(),
        cgstAmount: cgst.toString(), sgstAmount: sgst.toString(), igstAmount: igst.toString(),
        gstStateType,
        totalAmount: totalAmount.toString(), paidAmount: effPaid.toString(), dueAmount: dueAmount.toString(),
        paymentMode: effMode,
        billStatus,
        finalizedAt: billStatus === "final" ? new Date() : null,
      }).returning();

      // Auto-log Schedule H / H1 / Narcotic / Psychotropic entries
      const scheduleItems = snapshotItems.filter((it: any) => {
        const med = medMap.get(it.medicineId);
        const st = med?.scheduleType || "general";
        return st !== "general" && st !== null;
      });
      const pharmacistId = (req.session as any)?.userId ?? null;
      for (const it of scheduleItems) {
        const med = medMap.get(it.medicineId);
        await tx.insert(scheduleHRegisterTable).values({
          entityId,
          medicineId: it.medicineId,
          saleId: sale.id,
          patientId: patientId || null,
          doctorName: it.doctorName || null,
          prescriptionRef: it.prescriptionRef || null,
          quantityDispensed: String(it.quantity || 1),
          batchNo: it.batchNo || med?.batchNo || null,
          dispensedAt: billDate,
          pharmacistId,
          notes: `Auto-logged from sale ${billNo}`,
        });
      }

      return sale;
    });

    res.status(201).json(result);
  } catch (err: any) {
    req.log.error({ err }, "Failed to create pharmacy sale");
    const isStock = err?.message?.startsWith("Insufficient stock");
    const isEntity = err?.message?.startsWith("One or more medicines");
    const msg = (isStock || isEntity) ? err.message : "Failed to create pharmacy sale";
    const code = isStock ? 409 : isEntity ? 404 : 500;
    res.status(code).json({ error: msg });
  }
});

router.get("/pharmacy/stock-summary", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const medicines = await db.select().from(medicinesTable).where(eq(medicinesTable.entityId, entityId));
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const lowStock = medicines.filter(m => m.stock <= (m.reorderLevel || 10));
    const expiring = medicines.filter(m => m.expiryDate && m.expiryDate >= today && m.expiryDate <= thirtyDays);
    const expired = medicines.filter(m => m.expiryDate && m.expiryDate < today);
    const totalValue = medicines.reduce((s, m) => s + m.stock * parseFloat(m.purchaseRate || m.mrp || "0"), 0);

    res.json({
      totalItems: medicines.length,
      lowStockItems: lowStock.length,
      expiringItems: expiring.length,
      expiredItems: expired.length,
      totalStockValue: totalValue,
      lowStockList: lowStock,
      expiringList: expiring,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stock summary");
    res.status(500).json({ error: "Failed to get stock summary" });
  }
});

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function clampDateRange(from?: string, to?: string, fallbackFrom?: string) {
  const today = new Date().toISOString().slice(0, 10);
  let f = from && ISO_DATE_RE.test(from) ? from : (fallbackFrom || today);
  let t = to && ISO_DATE_RE.test(to) ? to : today;
  if (f > t) [f, t] = [t, f];
  return { from: f, to: t };
}

router.get("/pharmacy/daily-collection", async (req, res) => {
  try {
    const { from, to } = clampDateRange(req.query.from as string, req.query.to as string);
    const entityId = req.session.entityId ?? 1;

    const sales = await db.select().from(pharmacySalesTable)
      .where(and(eq(pharmacySalesTable.entityId, entityId), gte(pharmacySalesTable.billDate, from), lte(pharmacySalesTable.billDate, to)));

    const byDate: Record<string, { date: string; bills: number; gross: number; discount: number; gst: number; net: number; collected: number; due: number; modes: Record<string, number> }> = {};
    let totalGross = 0, totalDiscount = 0, totalGst = 0, totalNet = 0, totalCollected = 0, totalDue = 0;
    const modeTotals: Record<string, number> = {};

    for (const s of sales) {
      const d = s.billDate;
      if (!byDate[d]) byDate[d] = { date: d, bills: 0, gross: 0, discount: 0, gst: 0, net: 0, collected: 0, due: 0, modes: {} };
      const subtotal = parseFloat(s.subtotal);
      const disc = parseFloat(s.discount || "0");
      const gst = parseFloat(s.gstAmount || "0");
      const total = parseFloat(s.totalAmount);
      const paid = parseFloat(s.paidAmount);
      const due = parseFloat(s.dueAmount || "0");
      byDate[d].bills += 1;
      byDate[d].gross += subtotal; byDate[d].discount += disc; byDate[d].gst += gst;
      byDate[d].net += total; byDate[d].collected += paid; byDate[d].due += due;
      byDate[d].modes[s.paymentMode] = (byDate[d].modes[s.paymentMode] || 0) + paid;
      totalGross += subtotal; totalDiscount += disc; totalGst += gst;
      totalNet += total; totalCollected += paid; totalDue += due;
      modeTotals[s.paymentMode] = (modeTotals[s.paymentMode] || 0) + paid;
    }

    res.json({
      from, to,
      totals: { bills: sales.length, gross: totalGross, discount: totalDiscount, gst: totalGst, net: totalNet, collected: totalCollected, due: totalDue, modeTotals },
      byDate: Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)),
    });
  } catch (err) {
    req.log.error({ err }, "Failed daily collection");
    res.status(500).json({ error: "Failed daily collection report" });
  }
});

router.get("/pharmacy/expiry-alerts", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const medicines = await db.select().from(medicinesTable).where(eq(medicinesTable.entityId, entityId));
    const today = new Date().toISOString().slice(0, 10);
    const day30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const day90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    const expired = medicines.filter(m => m.expiryDate && m.expiryDate < today);
    const shortExpiry = medicines.filter(m => m.expiryDate && m.expiryDate >= today && m.expiryDate <= day30);
    const expiringSoon = medicines.filter(m => m.expiryDate && m.expiryDate > day30 && m.expiryDate <= day90);

    const stockValue = (list: typeof medicines) => list.reduce((s, m) => s + m.stock * parseFloat(m.mrp || "0"), 0);

    res.json({
      expired: { count: expired.length, value: stockValue(expired), items: expired },
      shortExpiry: { count: shortExpiry.length, value: stockValue(shortExpiry), items: shortExpiry },
      expiringSoon: { count: expiringSoon.length, value: stockValue(expiringSoon), items: expiringSoon },
    });
  } catch (err) {
    req.log.error({ err }, "Failed expiry alerts");
    res.status(500).json({ error: "Failed expiry alerts" });
  }
});

// GSTR-1 — reads HSN and rate from the sale-line snapshot stored in items.
// Falls back to current medicine master only if the sale row predates snapshotting.
router.get("/pharmacy/gstr1", async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + "-01";
    const { from, to } = clampDateRange(req.query.from as string, req.query.to as string, monthStart);

    const entityId = req.session.entityId ?? 1;

    // Only finalized bills appear in GST returns — provisional revenue isn't recognized.
    const sales = await db.select().from(pharmacySalesTable)
      .where(and(
        eq(pharmacySalesTable.entityId, entityId),
        gte(pharmacySalesTable.billDate, from),
        lte(pharmacySalesTable.billDate, to),
        eq(pharmacySalesTable.billStatus, "final"),
      ));

    const meds = await db.select().from(medicinesTable).where(eq(medicinesTable.entityId, entityId));
    const medMap = new Map(meds.map(m => [m.id, m]));

    const hsnMap: Record<string, { hsn: string; gstRate: number; taxable: number; cgst: number; sgst: number; igst: number; total: number }> = {};
    let grandTaxable = 0, grandCgst = 0, grandSgst = 0, grandIgst = 0, grandTotal = 0;

    for (const s of sales) {
      const stateType = s.gstStateType || "intra";
      const items = (s.items as any[]) || [];
      const billDiscount = parseFloat(s.discount || "0");
      const billSubtotal = parseFloat(s.subtotal || "0") || 1;
      for (const it of items) {
        const fallback = medMap.get(it.medicineId);
        const hsn = it.hsnCode || fallback?.hsnCode || "30049099";
        const rate = parseFloat(String(it.gstPercent ?? fallback?.gstPercent ?? "12"));
        const itemAmount = parseFloat(String(it.amount || 0));
        const itemDiscount = billDiscount * (itemAmount / billSubtotal);
        const taxable = itemAmount - itemDiscount;
        const gst = taxable * rate / 100;
        const key = `${hsn}@${rate}`;
        if (!hsnMap[key]) hsnMap[key] = { hsn, gstRate: rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
        hsnMap[key].taxable += taxable;
        if (stateType === "inter") {
          hsnMap[key].igst += gst; grandIgst += gst;
        } else {
          hsnMap[key].cgst += gst / 2; hsnMap[key].sgst += gst / 2;
          grandCgst += gst / 2; grandSgst += gst / 2;
        }
        hsnMap[key].total += taxable + gst;
        grandTaxable += taxable;
        grandTotal += taxable + gst;
      }
    }

    res.json({
      from, to,
      totals: { taxable: grandTaxable, cgst: grandCgst, sgst: grandSgst, igst: grandIgst, total: grandTotal, bills: sales.length },
      hsnSummary: Object.values(hsnMap).sort((a, b) => b.total - a.total),
    });
  } catch (err) {
    req.log.error({ err }, "Failed GSTR-1");
    res.status(500).json({ error: "Failed GSTR-1 report" });
  }
});

// Finalize a provisional bill: capture payment and mark as final.
// Atomic update guarded by billStatus='provisional' so we cannot double-finalize.
router.post("/pharmacy/sales/:id/finalize", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid sale id" });
    const entityId = req.session.entityId ?? 1;
    const { paidAmount, paymentMode } = req.body || {};
    const paid = Number(paidAmount);
    if (!Number.isFinite(paid) || paid < 0) return res.status(400).json({ error: "paidAmount must be a non-negative number" });
    if (!paymentMode || typeof paymentMode !== "string") return res.status(400).json({ error: "paymentMode is required" });

    const [existing] = await db.select().from(pharmacySalesTable).where(and(eq(pharmacySalesTable.id, id), eq(pharmacySalesTable.entityId, entityId)));
    if (!existing) return res.status(404).json({ error: "Sale not found" });
    if (existing.billStatus === "final") return res.status(409).json({ error: "Bill is already final" });
    const total = parseFloat(existing.totalAmount);
    if (paid > total + 0.01) return res.status(400).json({ error: `Paid (${paid}) exceeds total (${total})` });

    const userId = (req.session as any)?.userId ?? null;
    const due = Math.max(0, total - paid);
    const [updated] = await db.update(pharmacySalesTable)
      .set({
        paidAmount: paid.toString(), dueAmount: due.toString(), paymentMode,
        billStatus: "final", finalizedAt: new Date(), finalizedBy: userId,
      })
      .where(and(eq(pharmacySalesTable.id, id), eq(pharmacySalesTable.entityId, entityId), eq(pharmacySalesTable.billStatus, "provisional")))
      .returning();
    if (!updated) return res.status(409).json({ error: "Bill is no longer provisional" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to finalize pharmacy sale");
    res.status(500).json({ error: "Failed to finalize sale" });
  }
});

// Bulk-post unposted **final** pharmacy sales to accounting — admin only.
// Provisional bills are excluded since revenue isn't recognized until finalization.
router.post("/pharmacy/post-to-accounting", requireRole("admin"), async (req, res) => {
  try {
    const { from, to } = clampDateRange(req.body.from, req.body.to);
    const entityId = req.session.entityId ?? 1;

    const result = await db.transaction(async (tx) => {
      const unposted = await tx.select().from(pharmacySalesTable)
        .where(and(
          eq(pharmacySalesTable.entityId, entityId),
          eq(pharmacySalesTable.postedToAccounting, false),
          eq(pharmacySalesTable.billStatus, "final"),
          gte(pharmacySalesTable.billDate, from),
          lte(pharmacySalesTable.billDate, to),
        ));
      let totalRevenue = 0, totalGst = 0;
      for (const s of unposted) {
        totalRevenue += parseFloat(s.subtotal || "0") - parseFloat(s.discount || "0");
        totalGst += parseFloat(s.gstAmount || "0");
        await tx.update(pharmacySalesTable)
          .set({ postedToAccounting: true })
          .where(eq(pharmacySalesTable.id, s.id));
      }
      return { posted: unposted.length, totalRevenue, totalGst };
    });

    res.json({ ...result, from, to });
  } catch (err) {
    req.log.error({ err }, "Failed to post to accounting");
    res.status(500).json({ error: "Failed to post pharmacy sales to accounting" });
  }
});

// ---- Schedule H / H1 / Narcotic / Psychotropic Register ----
router.get("/pharmacy/schedule-h-register", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { from, to, medicineId, search } = req.query as Record<string, string>;
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "50");
    const offset = (page - 1) * limit;

    const conditions = [eq(scheduleHRegisterTable.entityId, entityId)];
    if (from) conditions.push(gte(scheduleHRegisterTable.dispensedAt, from));
    if (to) conditions.push(lte(scheduleHRegisterTable.dispensedAt, to));
    if (medicineId) conditions.push(eq(scheduleHRegisterTable.medicineId, parseInt(medicineId)));
    if (search) {
      const s = `%${search.toLowerCase()}%`;
      conditions.push(sql`(
        lower(coalesce(${scheduleHRegisterTable.doctorName}, '')) like ${s}
        or lower(coalesce(${scheduleHRegisterTable.prescriptionRef}, '')) like ${s}
      )`);
    }

    const regs = await db.select({
      id: scheduleHRegisterTable.id,
      medicineId: scheduleHRegisterTable.medicineId,
      medicineName: medicinesTable.name,
      scheduleType: medicinesTable.scheduleType,
      patientId: scheduleHRegisterTable.patientId,
      patientName: patientsTable.name,
      doctorName: scheduleHRegisterTable.doctorName,
      prescriptionRef: scheduleHRegisterTable.prescriptionRef,
      quantityDispensed: scheduleHRegisterTable.quantityDispensed,
      batchNo: scheduleHRegisterTable.batchNo,
      dispensedAt: scheduleHRegisterTable.dispensedAt,
      pharmacistId: scheduleHRegisterTable.pharmacistId,
      notes: scheduleHRegisterTable.notes,
    }).from(scheduleHRegisterTable)
      .leftJoin(medicinesTable, eq(scheduleHRegisterTable.medicineId, medicinesTable.id))
      .leftJoin(patientsTable, eq(scheduleHRegisterTable.patientId, patientsTable.id))
      .where(and(...conditions))
      .orderBy(desc(scheduleHRegisterTable.dispensedAt))
      .limit(limit).offset(offset);

    const totalResult = await db.select({ count: sql<number>`count(*)` }).from(scheduleHRegisterTable)
      .where(and(...conditions));
    res.json({ items: regs, total: Number(totalResult[0].count), page });
  } catch (err) {
    req.log.error({ err }, "Failed schedule-h register");
    res.status(500).json({ error: "Failed to fetch schedule H register" });
  }
});

router.post("/pharmacy/schedule-h-register", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { medicineId, patientId, doctorName, prescriptionRef, quantityDispensed, batchNo, dispensedAt, notes } = req.body;
    if (!medicineId || !quantityDispensed) return res.status(400).json({ error: "medicineId and quantityDispensed required" });
    const [medCheck] = await db.select({ id: medicinesTable.id }).from(medicinesTable)
      .where(and(eq(medicinesTable.id, medicineId), eq(medicinesTable.entityId, entityId)));
    if (!medCheck) return res.status(400).json({ error: "Medicine not found in this entity" });
    const pharmacistId = (req.session as any)?.userId ?? null;
    const [entry] = await db.insert(scheduleHRegisterTable).values({
      entityId, medicineId, patientId, doctorName, prescriptionRef,
      quantityDispensed: String(quantityDispensed), batchNo,
      dispensedAt: dispensedAt || new Date().toISOString().slice(0, 10),
      pharmacistId, notes,
    }).returning();
    res.status(201).json(entry);
  } catch (err) {
    req.log.error({ err }, "Failed schedule-h entry");
    res.status(500).json({ error: "Failed to create register entry" });
  }
});

// ---- Purchase Returns ----
function generateReturnNo(): string {
  const d = new Date();
  const ds = d.toISOString().slice(0, 10).replace(/-/g, "");
  return `RT${ds}${Math.floor(1000 + Math.random() * 9000)}`;
}

router.get("/pharmacy/purchase-returns", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { status, vendorId } = req.query as Record<string, string>;
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "20");
    const offset = (page - 1) * limit;

    const conditions = [eq(purchaseReturnsTable.entityId, entityId)];
    if (status) conditions.push(eq(purchaseReturnsTable.status, status));
    if (vendorId) conditions.push(eq(purchaseReturnsTable.vendorId, parseInt(vendorId)));

    const rows = await db.select({
      id: purchaseReturnsTable.id,
      returnNo: purchaseReturnsTable.returnNo,
      returnDate: purchaseReturnsTable.returnDate,
      vendorId: purchaseReturnsTable.vendorId,
      vendorName: vendorsTable.name,
      reason: purchaseReturnsTable.reason,
      totalAmount: purchaseReturnsTable.totalAmount,
      status: purchaseReturnsTable.status,
      subtotal: purchaseReturnsTable.subtotal,
      discount: purchaseReturnsTable.discount,
      gstAmount: purchaseReturnsTable.gstAmount,
      cgstAmount: purchaseReturnsTable.cgstAmount,
      sgstAmount: purchaseReturnsTable.sgstAmount,
      igstAmount: purchaseReturnsTable.igstAmount,
      gstStateType: purchaseReturnsTable.gstStateType,
      notes: purchaseReturnsTable.notes,
      createdAt: purchaseReturnsTable.createdAt,
    }).from(purchaseReturnsTable)
      .leftJoin(vendorsTable, eq(purchaseReturnsTable.vendorId, vendorsTable.id))
      .where(and(...conditions))
      .orderBy(desc(purchaseReturnsTable.returnDate))
      .limit(limit).offset(offset);

    const totalResult = await db.select({ count: sql<number>`count(*)` }).from(purchaseReturnsTable)
      .where(and(...conditions));
    res.json({ items: rows, total: Number(totalResult[0].count), page });
  } catch (err) {
    req.log.error({ err }, "Failed purchase returns list");
    res.status(500).json({ error: "Failed to list purchase returns" });
  }
});

router.get("/pharmacy/purchase-returns/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const [ret] = await db.select({
      id: purchaseReturnsTable.id, returnNo: purchaseReturnsTable.returnNo,
      returnDate: purchaseReturnsTable.returnDate, vendorId: purchaseReturnsTable.vendorId,
      vendorName: vendorsTable.name, reason: purchaseReturnsTable.reason,
      subtotal: purchaseReturnsTable.subtotal, discount: purchaseReturnsTable.discount,
      gstAmount: purchaseReturnsTable.gstAmount, cgstAmount: purchaseReturnsTable.cgstAmount,
      sgstAmount: purchaseReturnsTable.sgstAmount, igstAmount: purchaseReturnsTable.igstAmount,
      gstStateType: purchaseReturnsTable.gstStateType, totalAmount: purchaseReturnsTable.totalAmount,
      status: purchaseReturnsTable.status, notes: purchaseReturnsTable.notes,
      createdAt: purchaseReturnsTable.createdAt,
    }).from(purchaseReturnsTable)
      .leftJoin(vendorsTable, eq(purchaseReturnsTable.vendorId, vendorsTable.id))
      .where(and(eq(purchaseReturnsTable.id, id), eq(purchaseReturnsTable.entityId, entityId)));
    if (!ret) return res.status(404).json({ error: "Not found" });
    const lineItems = await db.select({
      medicineId: purchaseReturnItemsTable.medicineId,
      medicineName: medicinesTable.name,
      batchNo: purchaseReturnItemsTable.batchNo,
      quantityReturned: purchaseReturnItemsTable.quantityReturned,
      rate: purchaseReturnItemsTable.rate,
      gstPercent: purchaseReturnItemsTable.gstPercent,
      amount: purchaseReturnItemsTable.amount,
      hsnCode: purchaseReturnItemsTable.hsnCode,
    }).from(purchaseReturnItemsTable)
      .leftJoin(medicinesTable, eq(purchaseReturnItemsTable.medicineId, medicinesTable.id))
      .where(eq(purchaseReturnItemsTable.returnId, id));
    res.json({ ...ret, items: lineItems });
  } catch (err) {
    req.log.error({ err }, "Failed purchase return detail");
    res.status(500).json({ error: "Failed to fetch purchase return" });
  }
});

router.post("/pharmacy/purchase-returns", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? 1;
    const { vendorId, purchaseId, returnDate, reason, items, discount = 0, gstStateType = "intra", notes } = req.body;
    if (!vendorId || !items?.length) return res.status(400).json({ error: "vendorId and items required" });

    // Validate vendor belongs to entity
    const [vendorCheck] = await db.select({ id: vendorsTable.id }).from(vendorsTable)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.entityId, entityId)));
    if (!vendorCheck) return res.status(400).json({ error: "Vendor not found in this entity" });

    const medIds = items.map((i: any) => i.medicineId).filter(Boolean);
    const meds = medIds.length
      ? await db.select().from(medicinesTable).where(and(inArray(medicinesTable.id, medIds), eq(medicinesTable.entityId, entityId)))
      : [];
    if (medIds.length !== meds.length) return res.status(400).json({ error: "One or more medicines not found" });
    const medMap = new Map(meds.map(m => [m.id, m]));

    const lineItems = items.map((it: any) => {
      const med = medMap.get(it.medicineId);
      const qty = Math.max(1, Math.floor(it.quantityReturned || 1));
      const rate = parseFloat(it.rate || med?.purchaseRate || med?.mrp || "0");
      const gstP = parseFloat(it.gstPercent ?? med?.gstPercent ?? "12");
      const taxable = qty * rate;
      return { medicineId: it.medicineId, batchNo: it.batchNo || med?.batchNo || null, quantityReturned: qty, rate: rate.toString(), gstPercent: gstP.toString(), taxable: taxable.toString(), hsnCode: it.hsnCode || med?.hsnCode || null };
    });

    const subtotal = lineItems.reduce((s: number, i: any) => s + parseFloat(i.taxable), 0);
    const disc = parseFloat(String(discount || "0"));
    const taxableAfterDisc = Math.max(0, subtotal - disc);
    const proration = subtotal > 0 ? taxableAfterDisc / subtotal : 0;
    const gstAmount = lineItems.reduce((s: number, i: any) => s + (parseFloat(i.taxable) * proration) * parseFloat(i.gstPercent) / 100, 0);
    let cgst = 0, sgst = 0, igst = 0;
    if (gstStateType === "inter") igst = gstAmount;
    else { cgst = gstAmount / 2; sgst = gstAmount / 2; }
    const total = taxableAfterDisc + gstAmount;

    const result = await db.transaction(async (tx) => {
      const [ret] = await tx.insert(purchaseReturnsTable).values({
        entityId, vendorId, purchaseId: purchaseId || null, returnNo: generateReturnNo(),
        returnDate, reason, subtotal: subtotal.toString(), discount: disc.toString(),
        gstAmount: gstAmount.toString(), cgstAmount: cgst.toString(), sgstAmount: sgst.toString(), igstAmount: igst.toString(),
        gstStateType, totalAmount: total.toString(), status: "draft", notes,
      }).returning();
      for (const it of lineItems) {
        await tx.insert(purchaseReturnItemsTable).values({ returnId: ret.id, ...it, amount: it.taxable });
      }
      return ret;
    });

    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to create purchase return");
    res.status(500).json({ error: "Failed to create purchase return" });
  }
});

router.put("/pharmacy/purchase-returns/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const [ret] = await db.update(purchaseReturnsTable)
      .set({ status: "approved", approvedAt: new Date() })
      .where(and(eq(purchaseReturnsTable.id, id), eq(purchaseReturnsTable.entityId, entityId), eq(purchaseReturnsTable.status, "draft")))
      .returning();
    if (!ret) return res.status(409).json({ error: "Return not found or not in draft status" });
    res.json(ret);
  } catch (err) {
    req.log.error({ err }, "Failed to approve purchase return");
    res.status(500).json({ error: "Failed to approve purchase return" });
  }
});

router.put("/pharmacy/purchase-returns/:id/complete", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const result = await db.transaction(async (tx) => {
      const [ret] = await tx.update(purchaseReturnsTable)
        .set({ status: "completed", completedAt: new Date() })
        .where(and(eq(purchaseReturnsTable.id, id), eq(purchaseReturnsTable.entityId, entityId), eq(purchaseReturnsTable.status, "approved")))
        .returning();
      if (!ret) throw new Error("Return not found or not approved");

      // Decrement stock for returned items (goods sent back to vendor)
      const items = await tx.select().from(purchaseReturnItemsTable).where(eq(purchaseReturnItemsTable.returnId, id));
      for (const it of items) {
        const [updated] = await tx.update(medicinesTable)
          .set({ stock: sql`${medicinesTable.stock} - ${it.quantityReturned}`, updatedAt: new Date() })
          .where(and(eq(medicinesTable.id, it.medicineId), eq(medicinesTable.entityId, entityId), gte(medicinesTable.stock, it.quantityReturned)))
          .returning({ id: medicinesTable.id });
        if (!updated) throw new Error(`Insufficient stock for medicine #${it.medicineId} (requested ${it.quantityReturned})`);
      }
      return ret;
    });
    res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "Failed to complete purchase return");
    res.status(err.message?.includes("not approved") ? 409 : 500).json({ error: err.message || "Failed to complete purchase return" });
  }
});

export default router;
