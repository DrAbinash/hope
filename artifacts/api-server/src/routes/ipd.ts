import { Router } from "express";
import { db } from "@workspace/db";
import { ipdAdmissionsTable, patientsTable, doctorsTable, wardsTable, bedsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { invalidateClinicalMemory } from "./ai_assistant";

const router = Router();

function generateIpdNo(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const num = Math.floor(1000 + Math.random() * 9000);
  return `IPD${dateStr}${num}`;
}

async function getAdmissionWithJoins(id: number, entityId?: number) {
  const [admission] = await db.select({
    id: ipdAdmissionsTable.id, ipdNo: ipdAdmissionsTable.ipdNo, patientId: ipdAdmissionsTable.patientId,
    patientName: patientsTable.name, linkedOpdId: ipdAdmissionsTable.linkedOpdId,
    consultantDoctorId: ipdAdmissionsTable.consultantDoctorId, doctorName: doctorsTable.name,
    wardId: ipdAdmissionsTable.wardId, wardName: wardsTable.name,
    bedId: ipdAdmissionsTable.bedId, bedNo: bedsTable.bedNo,
    admissionDate: ipdAdmissionsTable.admissionDate, dischargeDate: ipdAdmissionsTable.dischargeDate,
    admissionNote: ipdAdmissionsTable.admissionNote, diagnosis: ipdAdmissionsTable.diagnosis,
    status: ipdAdmissionsTable.status, transferOpdBilling: ipdAdmissionsTable.transferOpdBilling,
    dischargeSummary: ipdAdmissionsTable.dischargeSummary, createdAt: ipdAdmissionsTable.createdAt,
  }).from(ipdAdmissionsTable)
    .leftJoin(patientsTable, eq(ipdAdmissionsTable.patientId, patientsTable.id))
    .leftJoin(doctorsTable, eq(ipdAdmissionsTable.consultantDoctorId, doctorsTable.id))
    .leftJoin(wardsTable, eq(ipdAdmissionsTable.wardId, wardsTable.id))
    .leftJoin(bedsTable, eq(ipdAdmissionsTable.bedId, bedsTable.id))
    .where(entityId !== undefined
      ? and(eq(ipdAdmissionsTable.id, id), eq(ipdAdmissionsTable.entityId, entityId))
      : eq(ipdAdmissionsTable.id, id));
  return admission;
}

router.get("/ipd", async (req, res) => {
  try {
    const { patientId, doctorId, status, wardId, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const entityId = req.session.entityId ?? 1;

    const admissions = await db.select({
      id: ipdAdmissionsTable.id, ipdNo: ipdAdmissionsTable.ipdNo, patientId: ipdAdmissionsTable.patientId,
      patientName: patientsTable.name, linkedOpdId: ipdAdmissionsTable.linkedOpdId,
      consultantDoctorId: ipdAdmissionsTable.consultantDoctorId, doctorName: doctorsTable.name,
      wardId: ipdAdmissionsTable.wardId, wardName: wardsTable.name,
      bedId: ipdAdmissionsTable.bedId, bedNo: bedsTable.bedNo,
      admissionDate: ipdAdmissionsTable.admissionDate, dischargeDate: ipdAdmissionsTable.dischargeDate,
      admissionNote: ipdAdmissionsTable.admissionNote, diagnosis: ipdAdmissionsTable.diagnosis,
      status: ipdAdmissionsTable.status, transferOpdBilling: ipdAdmissionsTable.transferOpdBilling,
      dischargeSummary: ipdAdmissionsTable.dischargeSummary, createdAt: ipdAdmissionsTable.createdAt,
    }).from(ipdAdmissionsTable)
      .leftJoin(patientsTable, eq(ipdAdmissionsTable.patientId, patientsTable.id))
      .leftJoin(doctorsTable, eq(ipdAdmissionsTable.consultantDoctorId, doctorsTable.id))
      .leftJoin(wardsTable, eq(ipdAdmissionsTable.wardId, wardsTable.id))
      .leftJoin(bedsTable, eq(ipdAdmissionsTable.bedId, bedsTable.id))
      .where(eq(ipdAdmissionsTable.entityId, entityId))
      .orderBy(ipdAdmissionsTable.createdAt)
      .limit(limitNum).offset(offset);

    let filtered = admissions;
    if (patientId) filtered = filtered.filter(a => a.patientId === parseInt(patientId));
    if (doctorId) filtered = filtered.filter(a => a.consultantDoctorId === parseInt(doctorId));
    if (status) filtered = filtered.filter(a => a.status === status);
    if (wardId) filtered = filtered.filter(a => a.wardId === parseInt(wardId));

    const total = await db.select({ count: sql<number>`count(*)` }).from(ipdAdmissionsTable).where(eq(ipdAdmissionsTable.entityId, entityId));
    res.json({ admissions: filtered, total: Number(total[0].count), page: pageNum });
  } catch (err) {
    req.log.error({ err }, "Failed to list IPD admissions");
    res.status(500).json({ error: "Failed to list IPD admissions" });
  }
});

router.post("/ipd", async (req, res) => {
  try {
    const { patientId, consultantDoctorId, wardId, bedId, admissionDate, admissionNote, diagnosis, emergencyMode } = req.body;
    if (!patientId || !consultantDoctorId || !wardId || !bedId) {
      return res.status(400).json({ error: "patientId, consultantDoctorId, wardId, bedId are required" });
    }
    const entityId = req.session.entityId ?? 1;
    const [patientCheck] = await db.select({ id: patientsTable.id }).from(patientsTable).where(and(eq(patientsTable.id, patientId), eq(patientsTable.entityId, entityId)));
    if (!patientCheck) return res.status(404).json({ error: "Patient not found in this entity" });
    const ipdNo = generateIpdNo();
    const [admission] = await db.insert(ipdAdmissionsTable).values({
      entityId,
      ipdNo, patientId, consultantDoctorId, wardId, bedId,
      admissionDate: admissionDate || new Date().toISOString().slice(0, 10),
      admissionNote, diagnosis, status: emergencyMode ? "emergency" : "admitted",
    }).returning();
    await db.update(bedsTable).set({ status: "occupied" }).where(eq(bedsTable.id, bedId));
    invalidateClinicalMemory(admission.patientId);
    const result = await getAdmissionWithJoins(admission.id);
    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to create IPD admission");
    res.status(500).json({ error: "Failed to create IPD admission" });
  }
});

router.get("/ipd/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const admission = await getAdmissionWithJoins(id, entityId);
    if (!admission) return res.status(404).json({ error: "IPD admission not found" });
    res.json(admission);
  } catch (err) {
    req.log.error({ err }, "Failed to get IPD admission");
    res.status(500).json({ error: "Failed to get IPD admission" });
  }
});

router.put("/ipd/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const { consultantDoctorId, wardId, bedId, admissionNote, diagnosis, status } = req.body;
    await db.update(ipdAdmissionsTable).set({ consultantDoctorId, wardId, bedId, admissionNote, diagnosis, status, updatedAt: new Date() }).where(and(eq(ipdAdmissionsTable.id, id), eq(ipdAdmissionsTable.entityId, entityId)));
    const result = await getAdmissionWithJoins(id, entityId);
    if (result) invalidateClinicalMemory(result.patientId);
    if (!result) return res.status(404).json({ error: "IPD admission not found" });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to update IPD admission");
    res.status(500).json({ error: "Failed to update IPD admission" });
  }
});

router.post("/ipd/:id/discharge", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const { dischargeDate, dischargeSummary, finalDiagnosis, condition } = req.body;
    const admission = await getAdmissionWithJoins(id, entityId);
    if (!admission) return res.status(404).json({ error: "IPD admission not found" });

    const summary = dischargeSummary || `Patient ${admission.patientName} discharged. Diagnosis: ${admission.diagnosis || finalDiagnosis || "N/A"}. Condition on discharge: ${condition || "Stable"}.`;
    await db.update(ipdAdmissionsTable).set({
      status: "discharged",
      dischargeDate: dischargeDate || new Date().toISOString().slice(0, 10),
      dischargeSummary: summary,
      diagnosis: finalDiagnosis || admission.diagnosis,
      updatedAt: new Date(),
    }).where(and(eq(ipdAdmissionsTable.id, id), eq(ipdAdmissionsTable.entityId, entityId)));
    if (admission.bedId) {
      await db.update(bedsTable).set({ status: "available" }).where(eq(bedsTable.id, admission.bedId));
    }
    const result = await getAdmissionWithJoins(id, entityId);
    if (result) invalidateClinicalMemory(result.patientId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to discharge patient");
    res.status(500).json({ error: "Failed to discharge patient" });
  }
});

export default router;
