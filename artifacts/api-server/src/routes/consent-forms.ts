import { Router } from "express";
import { db } from "@workspace/db";
import { consentFormsTable, patientsTable, doctorsTable, entitiesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function generateFormNo(prefix: string): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${dateStr}${num}`;
}

router.get("/consent-forms", async (req, res) => {
  try {
    const { patientId, formType } = req.query as Record<string, string>;
    const rows = await db.select({
      id: consentFormsTable.id,
      formNo: consentFormsTable.formNo,
      formType: consentFormsTable.formType,
      title: consentFormsTable.title,
      patientId: consentFormsTable.patientId,
      patientName: patientsTable.name,
      patientUhid: patientsTable.uhid,
      entityId: consentFormsTable.entityId,
      entityName: entitiesTable.name,
      doctorId: consentFormsTable.doctorId,
      doctorName: doctorsTable.name,
      variables: consentFormsTable.variables,
      body: consentFormsTable.body,
      patientSigned: consentFormsTable.patientSigned,
      witnessName: consentFormsTable.witnessName,
      signedAt: consentFormsTable.signedAt,
      status: consentFormsTable.status,
      createdAt: consentFormsTable.createdAt,
    }).from(consentFormsTable)
      .leftJoin(patientsTable, eq(consentFormsTable.patientId, patientsTable.id))
      .leftJoin(entitiesTable, eq(consentFormsTable.entityId, entitiesTable.id))
      .leftJoin(doctorsTable, eq(consentFormsTable.doctorId, doctorsTable.id))
      .orderBy(desc(consentFormsTable.createdAt));

    let filtered = rows;
    if (patientId) filtered = filtered.filter((r) => r.patientId === Number(patientId));
    if (formType) filtered = filtered.filter((r) => r.formType === formType);
    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "Failed to list consent forms");
    res.status(500).json({ error: "Failed to list consent forms" });
  }
});

router.post("/consent-forms", async (req, res) => {
  try {
    const {
      formType, title, patientId, entityId, doctorId,
      ipdAdmissionId, otBookingId, variables, body,
    } = req.body;
    if (!formType || !title || !patientId || !body) {
      return res.status(400).json({ error: "formType, title, patientId, body required" });
    }
    const prefix = ({ admission: "CFA", surgery: "CFS", anaesthesia: "CFAN", refusal: "CFR", discharge: "CFD" } as any)[formType] || "CF";
    const formNo = generateFormNo(prefix);
    const [row] = await db.insert(consentFormsTable).values({
      formNo, formType, title, patientId,
      entityId: entityId ?? null,
      doctorId: doctorId ?? null,
      ipdAdmissionId: ipdAdmissionId ?? null,
      otBookingId: otBookingId ?? null,
      variables: variables ?? {},
      body,
      status: "draft",
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create consent form");
    res.status(500).json({ error: "Failed to create consent form" });
  }
});

router.get("/consent-forms/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.select({
      id: consentFormsTable.id,
      formNo: consentFormsTable.formNo,
      formType: consentFormsTable.formType,
      title: consentFormsTable.title,
      patientId: consentFormsTable.patientId,
      patientName: patientsTable.name,
      patientUhid: patientsTable.uhid,
      patientAge: patientsTable.age,
      patientGender: patientsTable.gender,
      patientPhone: patientsTable.phone,
      patientAddress: patientsTable.address,
      entityId: consentFormsTable.entityId,
      entityName: entitiesTable.name,
      doctorId: consentFormsTable.doctorId,
      doctorName: doctorsTable.name,
      variables: consentFormsTable.variables,
      body: consentFormsTable.body,
      patientSigned: consentFormsTable.patientSigned,
      witnessName: consentFormsTable.witnessName,
      signedAt: consentFormsTable.signedAt,
      status: consentFormsTable.status,
      createdAt: consentFormsTable.createdAt,
    }).from(consentFormsTable)
      .leftJoin(patientsTable, eq(consentFormsTable.patientId, patientsTable.id))
      .leftJoin(entitiesTable, eq(consentFormsTable.entityId, entitiesTable.id))
      .leftJoin(doctorsTable, eq(consentFormsTable.doctorId, doctorsTable.id))
      .where(eq(consentFormsTable.id, id));
    if (!row) return res.status(404).json({ error: "Form not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to get consent form");
    res.status(500).json({ error: "Failed to get consent form" });
  }
});

router.put("/consent-forms/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { body, variables, patientSigned, witnessName, status } = req.body;
    const update: any = { updatedAt: new Date() };
    if (body !== undefined) update.body = body;
    if (variables !== undefined) update.variables = variables;
    if (patientSigned !== undefined) {
      update.patientSigned = patientSigned;
      if (patientSigned) update.signedAt = new Date();
    }
    if (witnessName !== undefined) update.witnessName = witnessName;
    if (status !== undefined) update.status = status;
    const [row] = await db.update(consentFormsTable).set(update)
      .where(eq(consentFormsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Form not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update consent form");
    res.status(500).json({ error: "Failed to update consent form" });
  }
});

export default router;
