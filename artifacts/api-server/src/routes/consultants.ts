import { Router } from "express";
import { db } from "@workspace/db";
import { consultantsTable, consultantEngagementsTable, patientsTable, invoicesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

const router = Router();

function computePayout(amount: number, type: string, value: number): number {
  if (type === "fixed") return +Math.max(0, value).toFixed(2);
  return +Math.max(0, (amount * value) / 100).toFixed(2);
}

// ---- Consultants CRUD ----
router.get("/consultants", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const { active } = req.query as Record<string, string>;
    const conds = [eq(consultantsTable.entityId, entityId)] as any[];
    if (active === "true") conds.push(eq(consultantsTable.isActive, true));
    const rows = await db.select().from(consultantsTable).where(and(...conds)).orderBy(consultantsTable.name);
    res.json({ consultants: rows });
  } catch (err) {
    req.log.error({ err }, "list consultants failed");
    res.status(500).json({ error: "Failed to list consultants" });
  }
});

router.get("/consultants/:id", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [row] = await db.select().from(consultantsTable)
      .where(and(eq(consultantsTable.id, id), eq(consultantsTable.entityId, entityId)));
    if (!row) return res.status(404).json({ error: "Consultant not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "get consultant failed");
    res.status(500).json({ error: "Failed to fetch consultant" });
  }
});

router.post("/consultants", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const { name, specialization, qualification, phone, email, registrationNo,
      paymentType, paymentValue, notes, isActive } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: "name is required" });
    if (paymentType && !["percentage", "fixed"].includes(paymentType)) {
      return res.status(400).json({ error: "paymentType must be percentage or fixed" });
    }
    const value = Math.max(0, Number(paymentValue) || 0);
    if (paymentType === "percentage" && value > 100) return res.status(400).json({ error: "percentage cannot exceed 100" });
    const [row] = await db.insert(consultantsTable).values({
      entityId,
      name: String(name).trim(),
      specialization: specialization || null,
      qualification: qualification || null,
      phone: phone || null,
      email: email || null,
      registrationNo: registrationNo || null,
      paymentType: paymentType || "percentage",
      paymentValue: value.toString(),
      notes: notes || null,
      isActive: isActive !== false,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "create consultant failed");
    res.status(500).json({ error: "Failed to create consultant" });
  }
});

router.put("/consultants/:id", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { name, specialization, qualification, phone, email, registrationNo,
      paymentType, paymentValue, notes, isActive } = req.body;
    const update: Record<string, any> = {};
    if (name !== undefined) update.name = String(name).trim();
    if (specialization !== undefined) update.specialization = specialization || null;
    if (qualification !== undefined) update.qualification = qualification || null;
    if (phone !== undefined) update.phone = phone || null;
    if (email !== undefined) update.email = email || null;
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
    const [row] = await db.update(consultantsTable).set(update)
      .where(and(eq(consultantsTable.id, id), eq(consultantsTable.entityId, entityId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Consultant not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "update consultant failed");
    res.status(500).json({ error: "Failed to update consultant" });
  }
});

// ---- Consultant Engagements ----
router.get("/consultant-engagements", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const { consultantId, status, dateFrom, dateTo } = req.query as Record<string, string>;
    const conds = [eq(consultantEngagementsTable.entityId, entityId)] as any[];
    if (consultantId && !Number.isNaN(parseInt(consultantId))) conds.push(eq(consultantEngagementsTable.consultantId, parseInt(consultantId)));
    if (status) conds.push(eq(consultantEngagementsTable.status, status));
    if (dateFrom) conds.push(sql`${consultantEngagementsTable.serviceDate} >= ${dateFrom}`);
    if (dateTo) conds.push(sql`${consultantEngagementsTable.serviceDate} <= ${dateTo}`);

    const rows = await db.select({
      id: consultantEngagementsTable.id,
      consultantId: consultantEngagementsTable.consultantId,
      consultantName: consultantsTable.name,
      patientId: consultantEngagementsTable.patientId,
      patientName: patientsTable.name,
      uhid: patientsTable.uhid,
      invoiceId: consultantEngagementsTable.invoiceId,
      invoiceNo: invoicesTable.invoiceNo,
      serviceDate: consultantEngagementsTable.serviceDate,
      serviceDescription: consultantEngagementsTable.serviceDescription,
      serviceAmount: consultantEngagementsTable.serviceAmount,
      paymentType: consultantEngagementsTable.paymentType,
      paymentValue: consultantEngagementsTable.paymentValue,
      payoutAmount: consultantEngagementsTable.payoutAmount,
      status: consultantEngagementsTable.status,
      paidOn: consultantEngagementsTable.paidOn,
      paymentMode: consultantEngagementsTable.paymentMode,
      reference: consultantEngagementsTable.reference,
      notes: consultantEngagementsTable.notes,
      createdBy: consultantEngagementsTable.createdBy,
      createdAt: consultantEngagementsTable.createdAt,
    })
      .from(consultantEngagementsTable)
      .leftJoin(consultantsTable, eq(consultantEngagementsTable.consultantId, consultantsTable.id))
      .leftJoin(patientsTable, eq(consultantEngagementsTable.patientId, patientsTable.id))
      .leftJoin(invoicesTable, eq(consultantEngagementsTable.invoiceId, invoicesTable.id))
      .where(and(...conds))
      .orderBy(sql`${consultantEngagementsTable.serviceDate} desc, ${consultantEngagementsTable.id} desc`);

    const totals = rows.reduce((acc: any, r: any) => {
      const amt = Number(r.payoutAmount) || 0;
      acc.total += amt;
      if (r.status === "pending") acc.pending += amt;
      if (r.status === "paid") acc.paid += amt;
      return acc;
    }, { total: 0, pending: 0, paid: 0 });
    res.json({ engagements: rows, summary: { total: +totals.total.toFixed(2), pending: +totals.pending.toFixed(2), paid: +totals.paid.toFixed(2), count: rows.length } });
  } catch (err) {
    req.log.error({ err }, "list engagements failed");
    res.status(500).json({ error: "Failed to list engagements" });
  }
});

router.post("/consultant-engagements", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const { consultantId, patientId, invoiceId, serviceDate, serviceDescription,
      serviceAmount, notes } = req.body;
    if (!consultantId) return res.status(400).json({ error: "consultantId is required" });
    const cId = parseInt(consultantId);
    if (Number.isNaN(cId)) return res.status(400).json({ error: "Invalid consultantId" });
    if (!serviceDate) return res.status(400).json({ error: "serviceDate is required" });
    const amt = Math.max(0, Number(serviceAmount) || 0);
    if (amt <= 0) return res.status(400).json({ error: "serviceAmount must be > 0" });

    const [consultant] = await db.select().from(consultantsTable)
      .where(and(eq(consultantsTable.id, cId), eq(consultantsTable.entityId, entityId)));
    if (!consultant) return res.status(404).json({ error: "Consultant not found" });

    const pType = consultant.paymentType;
    const pValue = Number(consultant.paymentValue) || 0;
    const payout = computePayout(amt, pType, pValue);

    const [row] = await db.insert(consultantEngagementsTable).values({
      entityId,
      consultantId: cId,
      patientId: patientId ? parseInt(patientId) : null,
      invoiceId: invoiceId ? parseInt(invoiceId) : null,
      serviceDate,
      serviceDescription: serviceDescription || null,
      serviceAmount: amt.toString(),
      paymentType: pType,
      paymentValue: pValue.toString(),
      payoutAmount: payout.toString(),
      status: "pending",
      notes: notes || null,
      createdBy: req.session?.username || null,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "create engagement failed");
    res.status(500).json({ error: "Failed to create engagement" });
  }
});

router.put("/consultant-engagements/:id", async (req, res) => {
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
    const [row] = await db.update(consultantEngagementsTable).set(update)
      .where(and(eq(consultantEngagementsTable.id, id), eq(consultantEngagementsTable.entityId, entityId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Engagement not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "update engagement failed");
    res.status(500).json({ error: "Failed to update engagement" });
  }
});

router.get("/consultant-engagements/report/by-consultant", async (req, res) => {
  try {
    const entityId = req.session?.entityId;
    if (!entityId) return res.status(401).json({ error: "No active session entity" });
    const { dateFrom, dateTo } = req.query as Record<string, string>;
    const conds = [eq(consultantEngagementsTable.entityId, entityId)] as any[];
    if (dateFrom) conds.push(sql`${consultantEngagementsTable.serviceDate} >= ${dateFrom}`);
    if (dateTo) conds.push(sql`${consultantEngagementsTable.serviceDate} <= ${dateTo}`);

    const rows = await db.select({
      consultantId: consultantEngagementsTable.consultantId,
      consultantName: consultantsTable.name,
      specialization: consultantsTable.specialization,
      paymentType: consultantsTable.paymentType,
      paymentValue: consultantsTable.paymentValue,
      cases: sql<number>`count(*)::int`,
      totalServices: sql<string>`coalesce(sum(${consultantEngagementsTable.serviceAmount}), 0)`,
      totalPayout: sql<string>`coalesce(sum(${consultantEngagementsTable.payoutAmount}), 0)`,
      pendingPayout: sql<string>`coalesce(sum(case when ${consultantEngagementsTable.status} = 'pending' then ${consultantEngagementsTable.payoutAmount} else 0 end), 0)`,
      paidPayout: sql<string>`coalesce(sum(case when ${consultantEngagementsTable.status} = 'paid' then ${consultantEngagementsTable.payoutAmount} else 0 end), 0)`,
    })
      .from(consultantEngagementsTable)
      .leftJoin(consultantsTable, eq(consultantEngagementsTable.consultantId, consultantsTable.id))
      .where(and(...conds))
      .groupBy(consultantEngagementsTable.consultantId, consultantsTable.name,
        consultantsTable.specialization, consultantsTable.paymentType, consultantsTable.paymentValue);

    res.json({ rows });
  } catch (err) {
    req.log.error({ err }, "consultant report failed");
    res.status(500).json({ error: "Failed to build report" });
  }
});

export default router;
