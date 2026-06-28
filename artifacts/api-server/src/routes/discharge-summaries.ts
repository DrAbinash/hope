import { Router } from "express";
import { db } from "@workspace/db";
import {
  dischargeSummariesTable, patientsTable, doctorsTable, entitiesTable,
  ipdAdmissionsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { invalidateClinicalMemory } from "./ai_assistant";

const router = Router();

function generateSummaryNo(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const num = Math.floor(1000 + Math.random() * 9000);
  return `DS${dateStr}${num}`;
}

router.get("/discharge-summaries", async (req, res) => {
  try {
    const { patientId, status } = req.query as Record<string, string>;
    const rows = await db.select({
      id: dischargeSummariesTable.id,
      summaryNo: dischargeSummariesTable.summaryNo,
      ipdAdmissionId: dischargeSummariesTable.ipdAdmissionId,
      patientId: dischargeSummariesTable.patientId,
      patientName: patientsTable.name,
      patientUhid: patientsTable.uhid,
      entityId: dischargeSummariesTable.entityId,
      entityName: entitiesTable.name,
      attendingDoctorId: dischargeSummariesTable.attendingDoctorId,
      attendingDoctorName: doctorsTable.name,
      admissionDate: dischargeSummariesTable.admissionDate,
      dischargeDate: dischargeSummariesTable.dischargeDate,
      finalDiagnosis: dischargeSummariesTable.finalDiagnosis,
      conditionAtDischarge: dischargeSummariesTable.conditionAtDischarge,
      status: dischargeSummariesTable.status,
      createdAt: dischargeSummariesTable.createdAt,
    }).from(dischargeSummariesTable)
      .leftJoin(patientsTable, eq(dischargeSummariesTable.patientId, patientsTable.id))
      .leftJoin(entitiesTable, eq(dischargeSummariesTable.entityId, entitiesTable.id))
      .leftJoin(doctorsTable, eq(dischargeSummariesTable.attendingDoctorId, doctorsTable.id))
      .orderBy(desc(dischargeSummariesTable.createdAt));

    let filtered = rows;
    if (patientId) filtered = filtered.filter((r) => r.patientId === Number(patientId));
    if (status) filtered = filtered.filter((r) => r.status === status);
    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "Failed to list discharge summaries");
    res.status(500).json({ error: "Failed to list discharge summaries" });
  }
});

// Pre-fill payload from an IPD admission
router.get("/discharge-summaries/prefill/:ipdId", async (req, res) => {
  try {
    const ipdId = parseInt(req.params.ipdId);
    const [adm] = await db.select().from(ipdAdmissionsTable).where(eq(ipdAdmissionsTable.id, ipdId));
    if (!adm) return res.status(404).json({ error: "Admission not found" });
    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, adm.patientId));
    res.json({
      ipdAdmissionId: adm.id,
      patientId: adm.patientId,
      patient,
      attendingDoctorId: adm.consultantDoctorId,
      admissionDate: adm.admissionDate,
      dischargeDate: adm.dischargeDate || new Date().toISOString().slice(0, 10),
      admissionDiagnosis: adm.diagnosis || "",
      finalDiagnosis: adm.diagnosis || "",
      presentingComplaints: adm.admissionNote || "",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to prefill discharge summary");
    res.status(500).json({ error: "Failed to prefill discharge summary" });
  }
});

router.post("/discharge-summaries", async (req, res) => {
  try {
    const role = req.session.role;
    if (role !== "doctor" && role !== "admin") {
      return res.status(403).json({ error: "Only doctors or admins can create discharge summaries" });
    }
    const b = req.body;
    if (!b.patientId) return res.status(400).json({ error: "patientId required" });
    const summaryNo = generateSummaryNo();
    const [row] = await db.insert(dischargeSummariesTable).values({
      summaryNo,
      ipdAdmissionId: b.ipdAdmissionId ?? null,
      patientId: b.patientId,
      entityId: b.entityId ?? null,
      attendingDoctorId: b.attendingDoctorId ?? null,
      admissionDate: b.admissionDate ?? null,
      dischargeDate: b.dischargeDate ?? null,
      admissionDiagnosis: b.admissionDiagnosis ?? null,
      finalDiagnosis: b.finalDiagnosis ?? null,
      presentingComplaints: b.presentingComplaints ?? null,
      history: b.history ?? null,
      examinationFindings: b.examinationFindings ?? null,
      investigations: b.investigations ?? [],
      treatmentGiven: b.treatmentGiven ?? null,
      proceduresPerformed: b.proceduresPerformed ?? [],
      conditionAtDischarge: b.conditionAtDischarge ?? null,
      dischargeMedications: b.dischargeMedications ?? [],
      followUpAdvice: b.followUpAdvice ?? null,
      dietAdvice: b.dietAdvice ?? null,
      activityAdvice: b.activityAdvice ?? null,
      warningSigns: b.warningSigns ?? null,
      status: b.status ?? "draft",
      aiGenerated: b.aiGenerated ?? false,
      doctorEdited: b.doctorEdited ?? false,
      approvedBy: b.approvedBy ?? null,
      approvedAt: b.approvedAt ? new Date(b.approvedAt) : null,
    }).returning();
    invalidateClinicalMemory(row.patientId);
    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create discharge summary");
    return res.status(500).json({ error: "Failed to create discharge summary" });
  }
});

router.get("/discharge-summaries/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.select({
      id: dischargeSummariesTable.id,
      summaryNo: dischargeSummariesTable.summaryNo,
      ipdAdmissionId: dischargeSummariesTable.ipdAdmissionId,
      patientId: dischargeSummariesTable.patientId,
      patientName: patientsTable.name,
      patientUhid: patientsTable.uhid,
      patientAge: patientsTable.age,
      patientGender: patientsTable.gender,
      patientPhone: patientsTable.phone,
      patientAddress: patientsTable.address,
      entityId: dischargeSummariesTable.entityId,
      entityName: entitiesTable.name,
      attendingDoctorId: dischargeSummariesTable.attendingDoctorId,
      attendingDoctorName: doctorsTable.name,
      attendingDoctorSpec: doctorsTable.specialization,
      admissionDate: dischargeSummariesTable.admissionDate,
      dischargeDate: dischargeSummariesTable.dischargeDate,
      admissionDiagnosis: dischargeSummariesTable.admissionDiagnosis,
      finalDiagnosis: dischargeSummariesTable.finalDiagnosis,
      presentingComplaints: dischargeSummariesTable.presentingComplaints,
      history: dischargeSummariesTable.history,
      examinationFindings: dischargeSummariesTable.examinationFindings,
      investigations: dischargeSummariesTable.investigations,
      treatmentGiven: dischargeSummariesTable.treatmentGiven,
      proceduresPerformed: dischargeSummariesTable.proceduresPerformed,
      conditionAtDischarge: dischargeSummariesTable.conditionAtDischarge,
      dischargeMedications: dischargeSummariesTable.dischargeMedications,
      followUpAdvice: dischargeSummariesTable.followUpAdvice,
      dietAdvice: dischargeSummariesTable.dietAdvice,
      activityAdvice: dischargeSummariesTable.activityAdvice,
      warningSigns: dischargeSummariesTable.warningSigns,
      status: dischargeSummariesTable.status,
      createdAt: dischargeSummariesTable.createdAt,
    }).from(dischargeSummariesTable)
      .leftJoin(patientsTable, eq(dischargeSummariesTable.patientId, patientsTable.id))
      .leftJoin(entitiesTable, eq(dischargeSummariesTable.entityId, entitiesTable.id))
      .leftJoin(doctorsTable, eq(dischargeSummariesTable.attendingDoctorId, doctorsTable.id))
      .where(eq(dischargeSummariesTable.id, id));
    if (!row) return res.status(404).json({ error: "Summary not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to get discharge summary");
    res.status(500).json({ error: "Failed to get discharge summary" });
  }
});

router.put("/discharge-summaries/:id", async (req, res) => {
  try {
    const role = req.session.role;
    if (role !== "doctor" && role !== "admin") {
      return res.status(403).json({ error: "Only doctors or admins can edit discharge summaries" });
    }
    const id = parseInt(req.params.id);
    const b = req.body;
    const update: any = { updatedAt: new Date() };
    const fields = [
      "admissionDate", "dischargeDate", "admissionDiagnosis", "finalDiagnosis",
      "presentingComplaints", "history", "examinationFindings", "investigations",
      "treatmentGiven", "proceduresPerformed", "conditionAtDischarge",
      "dischargeMedications", "followUpAdvice", "dietAdvice", "activityAdvice",
      "warningSigns", "status", "attendingDoctorId", "entityId",
      "aiGenerated", "doctorEdited", "approvedBy", "approvedAt",
    ];
    for (const f of fields) {
      if (b[f] !== undefined) {
        if (f === "approvedAt" && b[f]) {
          update[f] = new Date(b[f]);
        } else {
          update[f] = b[f];
        }
      }
    }
    const [row] = await db.update(dischargeSummariesTable).set(update)
      .where(eq(dischargeSummariesTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Summary not found" });
    invalidateClinicalMemory(row.patientId);
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update discharge summary");
    return res.status(500).json({ error: "Failed to update discharge summary" });
  }
});

export default router;
