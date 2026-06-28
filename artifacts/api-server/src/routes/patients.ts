import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable } from "@workspace/db";
import { eq, ilike, or, and, sql } from "drizzle-orm";

const router = Router();

function generateUHID(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `UHID${num}`;
}

router.get("/patients", async (req, res) => {
  try {
    const { search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const entityId = req.session.entityId ?? 1;
    const entityCond = eq(patientsTable.entityId, entityId);

    let query = db.select().from(patientsTable);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(patientsTable);

    const condition = search
      ? and(
          entityCond,
          or(
            ilike(patientsTable.name, `%${search}%`),
            ilike(patientsTable.uhid, `%${search}%`),
            ilike(patientsTable.phone, `%${search}%`)
          )
        )
      : entityCond;
    query = query.where(condition) as typeof query;
    countQuery = countQuery.where(condition) as typeof countQuery;

    const [patients, countResult] = await Promise.all([
      query.limit(limitNum).offset(offset).orderBy(patientsTable.createdAt),
      countQuery,
    ]);

    res.json({ patients, total: Number(countResult[0].count), page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "Failed to list patients");
    res.status(500).json({ error: "Failed to list patients" });
  }
});

router.post("/patients", async (req, res) => {
  try {
    const { name, age, gender, phone, email, address, bloodGroup, allergies, emergencyContact } = req.body;
    if (!name || !age || !gender || !phone) {
      return res.status(400).json({ error: "name, age, gender, phone are required" });
    }
    const uhid = generateUHID();
    const entityId = req.session.entityId ?? 1;
    const [patient] = await db.insert(patientsTable).values({ entityId, uhid, name, age, gender, phone, email, address, bloodGroup, allergies, emergencyContact }).returning();
    res.status(201).json(patient);
  } catch (err) {
    req.log.error({ err }, "Failed to create patient");
    res.status(500).json({ error: "Failed to create patient" });
  }
});

router.get("/patients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const [patient] = await db.select().from(patientsTable).where(and(eq(patientsTable.id, id), eq(patientsTable.entityId, entityId)));
    if (!patient) return res.status(404).json({ error: "Patient not found" });
    res.json(patient);
  } catch (err) {
    req.log.error({ err }, "Failed to get patient");
    res.status(500).json({ error: "Failed to get patient" });
  }
});

router.put("/patients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const { name, age, gender, phone, email, address, bloodGroup, allergies, emergencyContact } = req.body;
    const [patient] = await db.update(patientsTable).set({ name, age, gender, phone, email, address, bloodGroup, allergies, emergencyContact, updatedAt: new Date() }).where(and(eq(patientsTable.id, id), eq(patientsTable.entityId, entityId))).returning();
    if (!patient) return res.status(404).json({ error: "Patient not found" });
    res.json(patient);
  } catch (err) {
    req.log.error({ err }, "Failed to update patient");
    res.status(500).json({ error: "Failed to update patient" });
  }
});

router.get("/patients/:id/history", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const { opdVisitsTable, ipdAdmissionsTable, invoicesTable, doctorsTable, wardsTable, bedsTable } = await import("@workspace/db");

    const [patient] = await db.select().from(patientsTable).where(and(eq(patientsTable.id, id), eq(patientsTable.entityId, entityId)));
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const [opdVisits, ipdAdmissions, invoices] = await Promise.all([
      db.select({
        id: opdVisitsTable.id, visitNo: opdVisitsTable.visitNo, patientId: opdVisitsTable.patientId,
        doctorId: opdVisitsTable.doctorId, doctorName: doctorsTable.name, visitDate: opdVisitsTable.visitDate,
        chiefComplaints: opdVisitsTable.chiefComplaints, diagnosis: opdVisitsTable.diagnosis,
        medicines: opdVisitsTable.medicines, labTests: opdVisitsTable.labTests, radiologyTests: opdVisitsTable.radiologyTests,
        advise: opdVisitsTable.advise, vitals: opdVisitsTable.vitals, status: opdVisitsTable.status,
        convertedToIpd: opdVisitsTable.convertedToIpd, ipdAdmissionId: opdVisitsTable.ipdAdmissionId, fee: opdVisitsTable.fee, createdAt: opdVisitsTable.createdAt,
      }).from(opdVisitsTable).leftJoin(doctorsTable, eq(opdVisitsTable.doctorId, doctorsTable.id)).where(and(eq(opdVisitsTable.patientId, id), eq(opdVisitsTable.entityId, entityId))).orderBy(opdVisitsTable.createdAt),
      db.select({
        id: ipdAdmissionsTable.id, ipdNo: ipdAdmissionsTable.ipdNo, patientId: ipdAdmissionsTable.patientId,
        linkedOpdId: ipdAdmissionsTable.linkedOpdId, consultantDoctorId: ipdAdmissionsTable.consultantDoctorId,
        doctorName: doctorsTable.name, wardId: ipdAdmissionsTable.wardId, wardName: wardsTable.name,
        bedId: ipdAdmissionsTable.bedId, bedNo: bedsTable.bedNo, admissionDate: ipdAdmissionsTable.admissionDate,
        dischargeDate: ipdAdmissionsTable.dischargeDate, admissionNote: ipdAdmissionsTable.admissionNote,
        diagnosis: ipdAdmissionsTable.diagnosis, status: ipdAdmissionsTable.status, transferOpdBilling: ipdAdmissionsTable.transferOpdBilling,
        dischargeSummary: ipdAdmissionsTable.dischargeSummary, createdAt: ipdAdmissionsTable.createdAt,
      }).from(ipdAdmissionsTable)
        .leftJoin(doctorsTable, eq(ipdAdmissionsTable.consultantDoctorId, doctorsTable.id))
        .leftJoin(wardsTable, eq(ipdAdmissionsTable.wardId, wardsTable.id))
        .leftJoin(bedsTable, eq(ipdAdmissionsTable.bedId, bedsTable.id))
        .where(and(eq(ipdAdmissionsTable.patientId, id), eq(ipdAdmissionsTable.entityId, entityId))).orderBy(ipdAdmissionsTable.createdAt),
      db.select().from(invoicesTable).where(and(eq(invoicesTable.patientId, id), eq(invoicesTable.entityId, entityId))).orderBy(invoicesTable.createdAt),
    ]);

    res.json({ patient, opdVisits: opdVisits.map(v => ({ ...v, patientName: patient.name })), ipdAdmissions: ipdAdmissions.map(a => ({ ...a, patientName: patient.name })), invoices });
  } catch (err) {
    req.log.error({ err }, "Failed to get patient history");
    res.status(500).json({ error: "Failed to get patient history" });
  }
});

export default router;
