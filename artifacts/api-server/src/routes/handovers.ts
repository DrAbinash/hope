import { Router } from "express";
import { db } from "@workspace/db";
import { nursingHandoversTable, patientsTable, ipdAdmissionsTable, employeesTable, bedsTable, wardsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm";

const router = Router();

const givenByEmployee = aliasedTable(employeesTable, "given_by_employee");
const takenByEmployee = aliasedTable(employeesTable, "taken_by_employee");

// Get all handovers with filters (ward, active patients, etc.)
router.get("/nursing/handovers", async (req, res) => {
  try {
    const { wardId, shift } = req.query as Record<string, string>;

    let query = db.select({
      id: nursingHandoversTable.id,
      ipdAdmissionId: nursingHandoversTable.ipdAdmissionId,
      patientId: nursingHandoversTable.patientId,
      patientName: patientsTable.name,
      patientUhid: patientsTable.uhid,
      bedNo: bedsTable.bedNo,
      wardName: wardsTable.name,
      wardId: ipdAdmissionsTable.wardId,
      shift: nursingHandoversTable.shift,
      currentDiagnosis: nursingHandoversTable.currentDiagnosis,
      currentCondition: nursingHandoversTable.currentCondition,
      vitalsConcern: nursingHandoversTable.vitalsConcern,
      ivFluidsRunning: nursingHandoversTable.ivFluidsRunning,
      oxygenStatus: nursingHandoversTable.oxygenStatus,
      drainsTubes: nursingHandoversTable.drainsTubes,
      pendingMedications: nursingHandoversTable.pendingMedications,
      pendingInvestigations: nursingHandoversTable.pendingInvestigations,
      criticalInstructions: nursingHandoversTable.criticalInstructions,
      fallRisk: nursingHandoversTable.fallRisk,
      intakeOutputNotes: nursingHandoversTable.intakeOutputNotes,
      givenByEmployeeId: nursingHandoversTable.givenByEmployeeId,
      givenByEmployeeName: givenByEmployee.name,
      takenByEmployeeId: nursingHandoversTable.takenByEmployeeId,
      takenByEmployeeName: takenByEmployee.name,
      createdAt: nursingHandoversTable.createdAt,
    }).from(nursingHandoversTable)
      .leftJoin(patientsTable, eq(nursingHandoversTable.patientId, patientsTable.id))
      .leftJoin(ipdAdmissionsTable, eq(nursingHandoversTable.ipdAdmissionId, ipdAdmissionsTable.id))
      .leftJoin(bedsTable, eq(ipdAdmissionsTable.bedId, bedsTable.id))
      .leftJoin(wardsTable, eq(ipdAdmissionsTable.wardId, wardsTable.id))
      .leftJoin(givenByEmployee, eq(nursingHandoversTable.givenByEmployeeId, givenByEmployee.id))
      .leftJoin(takenByEmployee, eq(nursingHandoversTable.takenByEmployeeId, takenByEmployee.id))
      .orderBy(desc(nursingHandoversTable.createdAt));

    let rows = await query;

    if (wardId) {
      rows = rows.filter(r => r.wardId === parseInt(wardId));
    }
    if (shift) {
      rows = rows.filter(r => r.shift === shift);
    }

    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to query nursing handovers");
    return res.status(500).json({ error: "Failed to query nursing handovers" });
  }
});

// Get handovers for a specific admission
router.get("/ipd/:admissionId/handovers", async (req, res) => {
  try {
    const admissionId = parseInt(req.params.admissionId);

    const rows = await db.select({
      id: nursingHandoversTable.id,
      ipdAdmissionId: nursingHandoversTable.ipdAdmissionId,
      patientId: nursingHandoversTable.patientId,
      patientName: patientsTable.name,
      patientUhid: patientsTable.uhid,
      bedNo: bedsTable.bedNo,
      wardName: wardsTable.name,
      shift: nursingHandoversTable.shift,
      currentDiagnosis: nursingHandoversTable.currentDiagnosis,
      currentCondition: nursingHandoversTable.currentCondition,
      vitalsConcern: nursingHandoversTable.vitalsConcern,
      ivFluidsRunning: nursingHandoversTable.ivFluidsRunning,
      oxygenStatus: nursingHandoversTable.oxygenStatus,
      drainsTubes: nursingHandoversTable.drainsTubes,
      pendingMedications: nursingHandoversTable.pendingMedications,
      pendingInvestigations: nursingHandoversTable.pendingInvestigations,
      criticalInstructions: nursingHandoversTable.criticalInstructions,
      fallRisk: nursingHandoversTable.fallRisk,
      intakeOutputNotes: nursingHandoversTable.intakeOutputNotes,
      givenByEmployeeId: nursingHandoversTable.givenByEmployeeId,
      givenByEmployeeName: givenByEmployee.name,
      takenByEmployeeId: nursingHandoversTable.takenByEmployeeId,
      takenByEmployeeName: takenByEmployee.name,
      createdAt: nursingHandoversTable.createdAt,
    }).from(nursingHandoversTable)
      .leftJoin(patientsTable, eq(nursingHandoversTable.patientId, patientsTable.id))
      .leftJoin(ipdAdmissionsTable, eq(nursingHandoversTable.ipdAdmissionId, ipdAdmissionsTable.id))
      .leftJoin(bedsTable, eq(ipdAdmissionsTable.bedId, bedsTable.id))
      .leftJoin(wardsTable, eq(ipdAdmissionsTable.wardId, wardsTable.id))
      .leftJoin(givenByEmployee, eq(nursingHandoversTable.givenByEmployeeId, givenByEmployee.id))
      .leftJoin(takenByEmployee, eq(nursingHandoversTable.takenByEmployeeId, takenByEmployee.id))
      .where(eq(nursingHandoversTable.ipdAdmissionId, admissionId))
      .orderBy(desc(nursingHandoversTable.createdAt));

    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get handovers for admission");
    return res.status(500).json({ error: "Failed to get handovers for admission" });
  }
});

// Create a new handover
router.post("/ipd/:admissionId/handovers", async (req, res) => {
  try {
    const role = req.session.role;
    if (role !== "nurse" && role !== "admin") {
      return res.status(403).json({ error: "Only authorized nurses or admins can create handovers" });
    }

    const admissionId = parseInt(req.params.admissionId);
    const b = req.body;

    if (!b.patientId || !b.shift || !b.givenByEmployeeId || !b.takenByEmployeeId) {
      return res.status(400).json({ error: "patientId, shift, givenByEmployeeId, and takenByEmployeeId are required" });
    }

    const [row] = await db.insert(nursingHandoversTable).values({
      ipdAdmissionId: admissionId,
      patientId: b.patientId,
      shift: b.shift,
      currentDiagnosis: b.currentDiagnosis || null,
      currentCondition: b.currentCondition || null,
      vitalsConcern: b.vitalsConcern || null,
      ivFluidsRunning: b.ivFluidsRunning || null,
      oxygenStatus: b.oxygenStatus || null,
      drainsTubes: b.drainsTubes || null,
      pendingMedications: b.pendingMedications || [],
      pendingInvestigations: b.pendingInvestigations || [],
      criticalInstructions: b.criticalInstructions || null,
      fallRisk: b.fallRisk || null,
      intakeOutputNotes: b.intakeOutputNotes || null,
      givenByEmployeeId: b.givenByEmployeeId,
      takenByEmployeeId: b.takenByEmployeeId,
    }).returning();

    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create nursing handover");
    return res.status(500).json({ error: "Failed to create nursing handover" });
  }
});

export default router;
