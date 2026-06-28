import { Router } from "express";
import { db } from "@workspace/db";
import { referralDoctorsTable, referralPayoutsTable, patientsTable, invoicesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

const router = Router();

function computeShare(amount: number, type: string, value: number): number {
  if (type === "fixed") return +Math.max(0, value).toFixed(2);
  return +Math.max(0, (amount * value) / 100).toFixed(2);
}

// ---- Referral Doctors CRUD ----
router.get("/referral-doctors", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const { active } = req.query as Record<string, string>;
    const conds = [eq(referralDoctorsTable.entityId, entityId)] as any[];
    if (active === "true") conds.push(eq(referralDoctorsTable.isActive, true));
    const rows = await db.select().from(referralDoctorsTable).where(and(...conds)).orderBy(referralDoctorsTable.name);
    res.json({ doctors: rows });
  } catch (err) {
    req.log.error({ err }, "list referral doctors failed");
    res.status(500).json({ error: "Failed to list referral doctors" });
  }
});

router.get("/referral-doctors/:id", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [row] = await db.select().from(referralDoctorsTable)
      .where(and(eq(referralDoctorsTable.id, id), eq(referralDoctorsTable.entityId, entityId)));
    if (!row) return res.status(404).json({ error: "Referral doctor not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "get referral doctor failed");
    res.status(500).json({ error: "Failed to fetch referral doctor" });
  }
});

router.post("/referral-doctors", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const { name, specialization, qualification, phone, email, address, registrationNo,
      paymentType, paymentValue, notes, isActive } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: "name is required" });
    if (paymentType && !["percentage", "fixed"].includes(paymentType)) {
      return res.status(400).json({ error: "paymentType must be percentage or fixed" });
    }
    const value = Math.max(0, Number(paymentValue) || 0);
    if (paymentType === "percentage" && value > 100) {
      return res.status(400).json({ error: "percentage cannot exceed 100" });
    }
    const [row] = await db.insert(referralDoctorsTable).values({
      entityId,
      name: String(name).trim(),
      specialization: specialization || null,
      qualification: qualification || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      registrationNo: registrationNo || null,
      paymentType: paymentType || "percentage",
      paymentValue: value.toString(),
      notes: notes || null,
      isActive: isActive !== false,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "create referral doctor failed");
    res.status(500).json({ error: "Failed to create referral doctor" });
  }
});

router.put("/referral-doctors/:id", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { name, specialization, qualification, phone, email, address, registrationNo,
      paymentType, paymentValue, notes, isActive } = req.body;
    const update: Record<string, any> = {};
    if (name !== undefined) update.name = String(name).trim();
    if (specialization !== undefined) update.specialization = specialization || null;
    if (qualification !== undefined) update.qualification = qualification || null;
    if (phone !== undefined) update.phone = phone || null;
    if (email !== undefined) update.email = email || null;
    if (address !== undefined) update.address = address || null;
    if (registrationNo !== undefined) update.registrationNo = registrationNo || null;
    if (paymentType !== undefined) {
      if (!["percentage", "fixed"].includes(paymentType)) return res.status(400).json({ error: "Invalid paymentType" });
      update.paymentType = paymentType;
    }
    if (paymentValue !== undefined) {
      const v = Math.max(0, Number(paymentValue) || 0);
      const t = paymentType ?? update.paymentType;
      if (t === "percentage" && v > 100) return res.status(400).json({ error: "percentage cannot exceed 100" });
      update.paymentValue = v.toString();
    }
    if (notes !== undefined) update.notes = notes || null;
    if (isActive !== undefined) update.isActive = !!isActive;
    const [row] = await db.update(referralDoctorsTable).set(update)
      .where(and(eq(referralDoctorsTable.id, id), eq(referralDoctorsTable.entityId, entityId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Referral doctor not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "update referral doctor failed");
    res.status(500).json({ error: "Failed to update referral doctor" });
  }
});

// ---- Referral Payouts (shares) ----
router.get("/referral-payouts", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const { doctorId, status, dateFrom, dateTo } = req.query as Record<string, string>;
    const conds = [eq(referralPayoutsTable.entityId, entityId)] as any[];
    if (doctorId && !Number.isNaN(parseInt(doctorId))) conds.push(eq(referralPayoutsTable.referralDoctorId, parseInt(doctorId)));
    if (status) conds.push(eq(referralPayoutsTable.status, status));
    if (dateFrom) conds.push(sql`${referralPayoutsTable.serviceDate} >= ${dateFrom}`);
    if (dateTo) conds.push(sql`${referralPayoutsTable.serviceDate} <= ${dateTo}`);

    const rows = await db.select({
      id: referralPayoutsTable.id,
      referralDoctorId: referralPayoutsTable.referralDoctorId,
      doctorName: referralDoctorsTable.name,
      patientId: referralPayoutsTable.patientId,
      patientName: patientsTable.name,
      uhid: patientsTable.uhid,
      invoiceId: referralPayoutsTable.invoiceId,
      invoiceNo: invoicesTable.invoiceNo,
      serviceDate: referralPayoutsTable.serviceDate,
      serviceDescription: referralPayoutsTable.serviceDescription,
      serviceAmount: referralPayoutsTable.serviceAmount,
      paymentType: referralPayoutsTable.paymentType,
      paymentValue: referralPayoutsTable.paymentValue,
      shareAmount: referralPayoutsTable.shareAmount,
      status: referralPayoutsTable.status,
      paidOn: referralPayoutsTable.paidOn,
      paymentMode: referralPayoutsTable.paymentMode,
      reference: referralPayoutsTable.reference,
      notes: referralPayoutsTable.notes,
      createdBy: referralPayoutsTable.createdBy,
      createdAt: referralPayoutsTable.createdAt,
    })
      .from(referralPayoutsTable)
      .leftJoin(referralDoctorsTable, eq(referralPayoutsTable.referralDoctorId, referralDoctorsTable.id))
      .leftJoin(patientsTable, eq(referralPayoutsTable.patientId, patientsTable.id))
      .leftJoin(invoicesTable, eq(referralPayoutsTable.invoiceId, invoicesTable.id))
      .where(and(...conds))
      .orderBy(sql`${referralPayoutsTable.serviceDate} desc, ${referralPayoutsTable.id} desc`);

    // summary
    const totals = rows.reduce((acc: any, r: any) => {
      const amt = Number(r.shareAmount) || 0;
      acc.total += amt;
      if (r.status === "pending") acc.pending += amt;
      if (r.status === "paid") acc.paid += amt;
      return acc;
    }, { total: 0, pending: 0, paid: 0 });
    res.json({ payouts: rows, summary: { total: +totals.total.toFixed(2), pending: +totals.pending.toFixed(2), paid: +totals.paid.toFixed(2), count: rows.length } });
  } catch (err) {
    req.log.error({ err }, "list referral payouts failed");
    res.status(500).json({ error: "Failed to list referral payouts" });
  }
});

router.post("/referral-payouts", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const { referralDoctorId, patientId, invoiceId, serviceDate, serviceDescription,
      serviceAmount, notes } = req.body;
    if (!referralDoctorId) return res.status(400).json({ error: "referralDoctorId is required" });
    const dId = parseInt(referralDoctorId);
    if (Number.isNaN(dId)) return res.status(400).json({ error: "Invalid referralDoctorId" });
    if (!serviceDate) return res.status(400).json({ error: "serviceDate is required" });
    const amt = Math.max(0, Number(serviceAmount) || 0);
    if (amt <= 0) return res.status(400).json({ error: "serviceAmount must be > 0" });

    const [doctor] = await db.select().from(referralDoctorsTable)
      .where(and(eq(referralDoctorsTable.id, dId), eq(referralDoctorsTable.entityId, entityId)));
    if (!doctor) return res.status(404).json({ error: "Referral doctor not found" });

    const pType = doctor.paymentType;
    const pValue = Number(doctor.paymentValue) || 0;
    const share = computeShare(amt, pType, pValue);

    const [row] = await db.insert(referralPayoutsTable).values({
      entityId,
      referralDoctorId: dId,
      patientId: patientId ? parseInt(patientId) : null,
      invoiceId: invoiceId ? parseInt(invoiceId) : null,
      serviceDate,
      serviceDescription: serviceDescription || null,
      serviceAmount: amt.toString(),
      paymentType: pType,
      paymentValue: pValue.toString(),
      shareAmount: share.toString(),
      status: "pending",
      notes: notes || null,
      createdBy: req.session?.username || null,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "create referral payout failed");
    res.status(500).json({ error: "Failed to create referral payout" });
  }
});

router.put("/referral-payouts/:id", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { status, paidOn, paymentMode, reference, notes } = req.body;
    const update: Record<string, any> = {};
    if (status !== undefined) {
      if (!["pending", "paid", "cancelled"].includes(status)) return res.status(400).json({ error: "Invalid status" });
      update.status = status;
      if (status === "paid" && !paidOn) update.paidOn = new Date().toISOString().slice(0, 10);
    }
    if (paidOn !== undefined) update.paidOn = paidOn || null;
    if (paymentMode !== undefined) update.paymentMode = paymentMode || null;
    if (reference !== undefined) update.reference = reference || null;
    if (notes !== undefined) update.notes = notes || null;
    const [row] = await db.update(referralPayoutsTable).set(update)
      .where(and(eq(referralPayoutsTable.id, id), eq(referralPayoutsTable.entityId, entityId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Payout not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "update referral payout failed");
    res.status(500).json({ error: "Failed to update payout" });
  }
});

// Report endpoint: summary by doctor
router.get("/referral-payouts/report/by-doctor", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const { dateFrom, dateTo } = req.query as Record<string, string>;
    const conds = [eq(referralPayoutsTable.entityId, entityId)] as any[];
    if (dateFrom) conds.push(sql`${referralPayoutsTable.serviceDate} >= ${dateFrom}`);
    if (dateTo) conds.push(sql`${referralPayoutsTable.serviceDate} <= ${dateTo}`);

    const rows = await db.select({
      referralDoctorId: referralPayoutsTable.referralDoctorId,
      doctorName: referralDoctorsTable.name,
      specialization: referralDoctorsTable.specialization,
      paymentType: referralDoctorsTable.paymentType,
      paymentValue: referralDoctorsTable.paymentValue,
      cases: sql<number>`count(*)::int`,
      totalServices: sql<string>`coalesce(sum(${referralPayoutsTable.serviceAmount}), 0)`,
      totalShare: sql<string>`coalesce(sum(${referralPayoutsTable.shareAmount}), 0)`,
      pendingShare: sql<string>`coalesce(sum(case when ${referralPayoutsTable.status} = 'pending' then ${referralPayoutsTable.shareAmount} else 0 end), 0)`,
      paidShare: sql<string>`coalesce(sum(case when ${referralPayoutsTable.status} = 'paid' then ${referralPayoutsTable.shareAmount} else 0 end), 0)`,
    })
      .from(referralPayoutsTable)
      .leftJoin(referralDoctorsTable, eq(referralPayoutsTable.referralDoctorId, referralDoctorsTable.id))
      .where(and(...conds))
      .groupBy(referralPayoutsTable.referralDoctorId, referralDoctorsTable.name,
        referralDoctorsTable.specialization, referralDoctorsTable.paymentType, referralDoctorsTable.paymentValue);

    res.json({ rows });
  } catch (err) {
    req.log.error({ err }, "referral report failed");
    res.status(500).json({ error: "Failed to build report" });
  }
});

export default router;
