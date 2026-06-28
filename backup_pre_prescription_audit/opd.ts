import { Router } from "express";
import { db } from "@workspace/db";
import { opdVisitsTable, patientsTable, doctorsTable, ipdAdmissionsTable, bedsTable, admissionConversionLogTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { invalidateClinicalMemory } from "./ai_assistant";

const router = Router();

function generateVisitNo(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const num = Math.floor(1000 + Math.random() * 9000);
  return `OPD${dateStr}${num}`;
}

function generateIpdNo(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const num = Math.floor(1000 + Math.random() * 9000);
  return `IPD${dateStr}${num}`;
}

router.get("/opd", async (req, res) => {
  try {
    const { patientId, doctorId, date, status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const entityId = req.session.entityId ?? 1;

    const visits = await db.select({
      id: opdVisitsTable.id, visitNo: opdVisitsTable.visitNo, patientId: opdVisitsTable.patientId,
      patientName: patientsTable.name, doctorId: opdVisitsTable.doctorId, doctorName: doctorsTable.name,
      visitDate: opdVisitsTable.visitDate, chiefComplaints: opdVisitsTable.chiefComplaints,
      diagnosis: opdVisitsTable.diagnosis, medicines: opdVisitsTable.medicines, labTests: opdVisitsTable.labTests,
      radiologyTests: opdVisitsTable.radiologyTests, advise: opdVisitsTable.advise,
      specialAdvise: opdVisitsTable.specialAdvise, nextVisitDate: opdVisitsTable.nextVisitDate, vitals: opdVisitsTable.vitals,
      status: opdVisitsTable.status, convertedToIpd: opdVisitsTable.convertedToIpd,
      ipdAdmissionId: opdVisitsTable.ipdAdmissionId, fee: opdVisitsTable.fee, createdAt: opdVisitsTable.createdAt,
    }).from(opdVisitsTable)
      .leftJoin(patientsTable, eq(opdVisitsTable.patientId, patientsTable.id))
      .leftJoin(doctorsTable, eq(opdVisitsTable.doctorId, doctorsTable.id))
      .where(eq(opdVisitsTable.entityId, entityId))
      .orderBy(opdVisitsTable.createdAt)
      .limit(limitNum).offset(offset);

    let filtered = visits;
    if (patientId) filtered = filtered.filter(v => v.patientId === parseInt(patientId));
    if (doctorId) filtered = filtered.filter(v => v.doctorId === parseInt(doctorId));
    if (status) filtered = filtered.filter(v => v.status === status);

    const total = await db.select({ count: sql<number>`count(*)` }).from(opdVisitsTable).where(eq(opdVisitsTable.entityId, entityId));
    res.json({ visits: filtered, total: Number(total[0].count), page: pageNum });
  } catch (err) {
    req.log.error({ err }, "Failed to list OPD visits");
    res.status(500).json({ error: "Failed to list OPD visits" });
  }
});

router.post("/opd", async (req, res) => {
  try {
    const { patientId, doctorId, visitDate, chiefComplaints, fee } = req.body;
    if (!patientId || !doctorId) return res.status(400).json({ error: "patientId and doctorId are required" });
    const entityId = req.session.entityId ?? 1;
    const [patientCheck] = await db.select({ id: patientsTable.id }).from(patientsTable).where(and(eq(patientsTable.id, patientId), eq(patientsTable.entityId, entityId)));
    if (!patientCheck) return res.status(404).json({ error: "Patient not found in this entity" });
    const visitNo = generateVisitNo();
    const [visit] = await db.insert(opdVisitsTable).values({
      entityId, visitNo, patientId, doctorId,
      visitDate: visitDate || new Date().toISOString().slice(0, 10),
      chiefComplaints, fee: fee?.toString(), status: "pending",
    }).returning();

    invalidateClinicalMemory(patientId);
    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId));
    const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, doctorId));
    res.status(201).json({ ...visit, patientName: patient?.name, doctorName: doctor?.name });
  } catch (err) {
    req.log.error({ err }, "Failed to create OPD visit");
    res.status(500).json({ error: "Failed to create OPD visit" });
  }
});

router.get("/opd/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const [visit] = await db.select({
      id: opdVisitsTable.id, entityId: opdVisitsTable.entityId, visitNo: opdVisitsTable.visitNo, patientId: opdVisitsTable.patientId,
      patientName: patientsTable.name, doctorId: opdVisitsTable.doctorId, doctorName: doctorsTable.name,
      visitDate: opdVisitsTable.visitDate, chiefComplaints: opdVisitsTable.chiefComplaints,
      diagnosis: opdVisitsTable.diagnosis, medicines: opdVisitsTable.medicines, labTests: opdVisitsTable.labTests,
      radiologyTests: opdVisitsTable.radiologyTests, advise: opdVisitsTable.advise,
      specialAdvise: opdVisitsTable.specialAdvise, nextVisitDate: opdVisitsTable.nextVisitDate, vitals: opdVisitsTable.vitals,
      status: opdVisitsTable.status, convertedToIpd: opdVisitsTable.convertedToIpd,
      ipdAdmissionId: opdVisitsTable.ipdAdmissionId, fee: opdVisitsTable.fee, createdAt: opdVisitsTable.createdAt,
    }).from(opdVisitsTable)
      .leftJoin(patientsTable, eq(opdVisitsTable.patientId, patientsTable.id))
      .leftJoin(doctorsTable, eq(opdVisitsTable.doctorId, doctorsTable.id))
      .where(and(eq(opdVisitsTable.id, id), eq(opdVisitsTable.entityId, entityId)));

    if (!visit) return res.status(404).json({ error: "OPD visit not found" });
    res.json(visit);
  } catch (err) {
    req.log.error({ err }, "Failed to get OPD visit");
    res.status(500).json({ error: "Failed to get OPD visit" });
  }
});

router.put("/opd/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const {
      chiefComplaints, diagnosis, medicines, labTests, radiologyTests,
      advise, specialAdvise, nextVisitDate, vitals, status,
      aiGenerated, doctorEdited, approvedBy, approvedAt
    } = req.body;
    const [visit] = await db.update(opdVisitsTable).set({
      chiefComplaints, diagnosis, medicines: medicines || undefined,
      labTests, radiologyTests, advise, specialAdvise, nextVisitDate,
      vitals: vitals || undefined, status,
      aiGenerated, doctorEdited, approvedBy,
      approvedAt: approvedAt ? new Date(approvedAt) : undefined,
      updatedAt: new Date(),
    }).where(and(eq(opdVisitsTable.id, id), eq(opdVisitsTable.entityId, entityId))).returning();
    if (!visit) return res.status(404).json({ error: "OPD visit not found" });
    invalidateClinicalMemory(visit.patientId);
    res.json(visit);
  } catch (err) {
    req.log.error({ err }, "Failed to update OPD visit");
    res.status(500).json({ error: "Failed to update OPD visit" });
  }
});

router.post("/opd/:id/convert-to-ipd", async (req, res) => {
  try {
    const opdId = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const { wardId, bedId, consultantDoctorId, admissionNote, transferOpdBilling, emergencyMode } = req.body;
    if (!wardId || !bedId) return res.status(400).json({ error: "wardId and bedId are required" });

    const [opdVisit] = await db.select().from(opdVisitsTable).where(and(eq(opdVisitsTable.id, opdId), eq(opdVisitsTable.entityId, entityId)));
    if (!opdVisit) return res.status(404).json({ error: "OPD visit not found" });
    if (opdVisit.convertedToIpd) return res.status(400).json({ error: "Already converted to IPD" });

    const ipdNo = generateIpdNo();
    const doctorId = consultantDoctorId || opdVisit.doctorId;

    const entityIdConv = req.session.entityId ?? opdVisit.entityId ?? 1;
    const [admission] = await db.insert(ipdAdmissionsTable).values({
      entityId: entityIdConv,
      ipdNo, patientId: opdVisit.patientId, linkedOpdId: opdId,
      consultantDoctorId: doctorId, wardId, bedId,
      admissionDate: new Date().toISOString().slice(0, 10),
      admissionNote: admissionNote || opdVisit.chiefComplaints,
      diagnosis: opdVisit.diagnosis,
      status: emergencyMode ? "emergency" : "admitted",
      transferOpdBilling: transferOpdBilling ?? false,
    }).returning();

    await db.update(bedsTable).set({ status: "occupied" }).where(eq(bedsTable.id, bedId));
    await db.update(opdVisitsTable).set({ convertedToIpd: true, ipdAdmissionId: admission.id, status: "converted", updatedAt: new Date() }).where(eq(opdVisitsTable.id, opdId));
    await db.insert(admissionConversionLogTable).values({
      opdVisitId: opdId, ipdAdmissionId: admission.id, patientId: opdVisit.patientId,
      notes: `Converted from OPD ${opdVisit.visitNo}`,
    });
    invalidateClinicalMemory(opdVisit.patientId);

    const { wardsTable, doctorsTable: dt } = await import("@workspace/db");
    const [ward] = await db.select().from(wardsTable).where(eq(wardsTable.id, wardId));
    const [doctor] = await db.select().from(dt).where(eq(dt.id, doctorId));
    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, opdVisit.patientId));
    const [bed] = await db.select().from(bedsTable).where(eq(bedsTable.id, bedId));

    res.status(201).json({ ...admission, patientName: patient?.name, wardName: ward?.name, doctorName: doctor?.name, bedNo: bed?.bedNo });
  } catch (err) {
    req.log.error({ err }, "Failed to convert OPD to IPD");
    res.status(500).json({ error: "Failed to convert OPD to IPD" });
  }
});

export default router;
