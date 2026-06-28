import { Router } from "express";
import { db } from "@workspace/db";
import {
  tpaProvidersTable, patientInsuranceTable, insuranceClaimsTable,
  patientsTable, entitiesTable, ipdAdmissionsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

function generateClaimNo(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const num = Math.floor(1000 + Math.random() * 9000);
  return `CLM${dateStr}${num}`;
}

// ============ TPA PROVIDERS ============
router.get("/tpa-providers", async (_req, res) => {
  const rows = await db.select().from(tpaProvidersTable).orderBy(tpaProvidersTable.name);
  res.json(rows);
});

router.post("/tpa-providers", async (req, res) => {
  try {
    const b = req.body;
    if (!b.name || !b.code) return res.status(400).json({ error: "name and code required" });
    const [row] = await db.insert(tpaProvidersTable).values({
      name: b.name, code: b.code,
      contactPerson: b.contactPerson, phone: b.phone, email: b.email, address: b.address,
      paymentTermDays: b.paymentTermDays ?? 30,
      tdsPercent: String(b.tdsPercent ?? 0),
      status: b.status ?? "active",
    }).returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "TPA code already exists" });
    req.log.error({ err }, "Failed to create TPA");
    res.status(500).json({ error: "Failed to create TPA" });
  }
});

router.put("/tpa-providers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const b = req.body;
    const update: any = {};
    ["name", "contactPerson", "phone", "email", "address", "paymentTermDays", "status"].forEach((f) => {
      if (b[f] !== undefined) update[f] = b[f];
    });
    if (b.tdsPercent !== undefined) update.tdsPercent = String(b.tdsPercent);
    const [row] = await db.update(tpaProvidersTable).set(update).where(eq(tpaProvidersTable.id, id)).returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update TPA");
    res.status(500).json({ error: "Failed to update TPA" });
  }
});

// ============ PATIENT INSURANCE ============
router.get("/patient-insurance", async (req, res) => {
  const { patientId } = req.query as Record<string, string>;
  const rows = await db.select({
    id: patientInsuranceTable.id,
    patientId: patientInsuranceTable.patientId,
    patientName: patientsTable.name,
    patientUhid: patientsTable.uhid,
    tpaId: patientInsuranceTable.tpaId,
    tpaName: tpaProvidersTable.name,
    policyNo: patientInsuranceTable.policyNo,
    policyHolderName: patientInsuranceTable.policyHolderName,
    relationToHolder: patientInsuranceTable.relationToHolder,
    policyStart: patientInsuranceTable.policyStart,
    policyEnd: patientInsuranceTable.policyEnd,
    sumInsured: patientInsuranceTable.sumInsured,
    copayPercent: patientInsuranceTable.copayPercent,
    status: patientInsuranceTable.status,
  }).from(patientInsuranceTable)
    .leftJoin(patientsTable, eq(patientInsuranceTable.patientId, patientsTable.id))
    .leftJoin(tpaProvidersTable, eq(patientInsuranceTable.tpaId, tpaProvidersTable.id))
    .orderBy(desc(patientInsuranceTable.id));
  const filtered = patientId ? rows.filter((r) => r.patientId === Number(patientId)) : rows;
  res.json(filtered);
});

router.post("/patient-insurance", async (req, res) => {
  try {
    const b = req.body;
    if (!b.patientId || !b.tpaId || !b.policyNo) return res.status(400).json({ error: "patientId, tpaId, policyNo required" });
    const [row] = await db.insert(patientInsuranceTable).values({
      patientId: b.patientId, tpaId: b.tpaId, policyNo: b.policyNo,
      policyHolderName: b.policyHolderName, relationToHolder: b.relationToHolder,
      policyStart: b.policyStart, policyEnd: b.policyEnd,
      sumInsured: b.sumInsured ? String(b.sumInsured) : null,
      copayPercent: String(b.copayPercent ?? 0),
      status: b.status ?? "active",
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create policy");
    res.status(500).json({ error: "Failed to create policy" });
  }
});

// ============ INSURANCE CLAIMS ============
router.get("/insurance-claims", async (req, res) => {
  const { status } = req.query as Record<string, string>;
  const rows = await db.select({
    id: insuranceClaimsTable.id,
    claimNo: insuranceClaimsTable.claimNo,
    patientId: insuranceClaimsTable.patientId,
    patientName: patientsTable.name,
    patientUhid: patientsTable.uhid,
    ipdAdmissionId: insuranceClaimsTable.ipdAdmissionId,
    tpaId: insuranceClaimsTable.tpaId,
    tpaName: tpaProvidersTable.name,
    policyId: insuranceClaimsTable.policyId,
    entityId: insuranceClaimsTable.entityId,
    entityName: entitiesTable.name,
    preauthAmount: insuranceClaimsTable.preauthAmount,
    preauthApprovedAmount: insuranceClaimsTable.preauthApprovedAmount,
    preauthApprovalNo: insuranceClaimsTable.preauthApprovalNo,
    claimAmount: insuranceClaimsTable.claimAmount,
    approvedAmount: insuranceClaimsTable.approvedAmount,
    disallowedAmount: insuranceClaimsTable.disallowedAmount,
    settledAmount: insuranceClaimsTable.settledAmount,
    settlementDate: insuranceClaimsTable.settlementDate,
    status: insuranceClaimsTable.status,
    createdAt: insuranceClaimsTable.createdAt,
  }).from(insuranceClaimsTable)
    .leftJoin(patientsTable, eq(insuranceClaimsTable.patientId, patientsTable.id))
    .leftJoin(tpaProvidersTable, eq(insuranceClaimsTable.tpaId, tpaProvidersTable.id))
    .leftJoin(entitiesTable, eq(insuranceClaimsTable.entityId, entitiesTable.id))
    .orderBy(desc(insuranceClaimsTable.createdAt));
  const filtered = status ? rows.filter((r) => r.status === status) : rows;
  res.json(filtered);
});

router.get("/insurance-claims/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [row] = await db.select().from(insuranceClaimsTable).where(eq(insuranceClaimsTable.id, id));
  if (!row) return res.status(404).json({ error: "Claim not found" });
  res.json(row);
});

router.post("/insurance-claims", async (req, res) => {
  try {
    const b = req.body;
    if (!b.patientId || !b.tpaId) return res.status(400).json({ error: "patientId, tpaId required" });
    const claimNo = generateClaimNo();
    const [row] = await db.insert(insuranceClaimsTable).values({
      claimNo,
      patientId: b.patientId,
      ipdAdmissionId: b.ipdAdmissionId ?? null,
      tpaId: b.tpaId,
      policyId: b.policyId ?? null,
      entityId: b.entityId ?? null,
      preauthAmount: String(b.preauthAmount ?? 0),
      preauthDate: b.preauthDate ?? null,
      claimAmount: String(b.claimAmount ?? 0),
      remarks: b.remarks ?? null,
      status: "preauth_pending",
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create claim");
    res.status(500).json({ error: "Failed to create claim" });
  }
});

router.put("/insurance-claims/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const b = req.body;
    const update: any = { updatedAt: new Date() };
    const numFields = ["preauthAmount", "preauthApprovedAmount", "claimAmount",
      "approvedAmount", "disallowedAmount", "copayAmount", "tdsAmount", "settledAmount"];
    const strFields = ["preauthDate", "preauthApprovalNo", "claimSubmittedDate",
      "settlementDate", "utrNumber", "status", "remarks"];
    numFields.forEach((f) => { if (b[f] !== undefined) update[f] = String(b[f]); });
    strFields.forEach((f) => { if (b[f] !== undefined) update[f] = b[f]; });
    if (b.deductions !== undefined) update.deductions = b.deductions;
    const [row] = await db.update(insuranceClaimsTable).set(update).where(eq(insuranceClaimsTable.id, id)).returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update claim");
    res.status(500).json({ error: "Failed to update claim" });
  }
});

// Workflow shortcuts
router.post("/insurance-claims/:id/preauth-approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { preauthApprovedAmount, preauthApprovalNo } = req.body;
    const [row] = await db.update(insuranceClaimsTable).set({
      preauthApprovedAmount: String(preauthApprovedAmount ?? 0),
      preauthApprovalNo: preauthApprovalNo ?? null,
      status: "preauth_approved",
      updatedAt: new Date(),
    }).where(eq(insuranceClaimsTable.id, id)).returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/insurance-claims/:id/submit", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { claimAmount, claimSubmittedDate } = req.body;
    const [row] = await db.update(insuranceClaimsTable).set({
      claimAmount: String(claimAmount ?? 0),
      claimSubmittedDate: claimSubmittedDate ?? new Date().toISOString().slice(0, 10),
      status: "claim_submitted",
      updatedAt: new Date(),
    }).where(eq(insuranceClaimsTable.id, id)).returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/insurance-claims/:id/settle", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const b = req.body;
    const approved = Number(b.approvedAmount ?? 0);
    const disallowed = Number(b.disallowedAmount ?? 0);
    const copay = Number(b.copayAmount ?? 0);
    const tds = Number(b.tdsAmount ?? 0);
    const settled = Number(b.settledAmount ?? approved - tds);
    const [existing] = await db.select().from(insuranceClaimsTable).where(eq(insuranceClaimsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Claim not found" });
    const claimAmt = Number(existing.claimAmount || 0);
    const status = settled >= claimAmt - 1 ? "settled" : "partially_settled";
    const [row] = await db.update(insuranceClaimsTable).set({
      approvedAmount: String(approved),
      disallowedAmount: String(disallowed),
      copayAmount: String(copay),
      tdsAmount: String(tds),
      settledAmount: String(settled),
      settlementDate: b.settlementDate ?? new Date().toISOString().slice(0, 10),
      utrNumber: b.utrNumber ?? null,
      deductions: b.deductions ?? [],
      status,
      updatedAt: new Date(),
    }).where(eq(insuranceClaimsTable.id, id)).returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to settle");
    res.status(500).json({ error: "Failed to settle" });
  }
});

router.post("/insurance-claims/:id/reject", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.update(insuranceClaimsTable).set({
      status: "rejected",
      remarks: req.body.remarks ?? null,
      updatedAt: new Date(),
    }).where(eq(insuranceClaimsTable.id, id)).returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
