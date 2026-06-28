import { Router } from "express";
import { db } from "@workspace/db";
import { ipdProgressNotesTable, doctorsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { invalidateClinicalMemory } from "./ai_assistant";

const router = Router();

router.get("/ipd/:admissionId/progress-notes", async (req, res) => {
  try {
    const admissionId = parseInt(req.params.admissionId);
    const rows = await db.select({
      id: ipdProgressNotesTable.id,
      ipdAdmissionId: ipdProgressNotesTable.ipdAdmissionId,
      patientId: ipdProgressNotesTable.patientId,
      doctorId: ipdProgressNotesTable.doctorId,
      doctorName: doctorsTable.name,
      noteDate: ipdProgressNotesTable.noteDate,
      subjectiveComplaints: ipdProgressNotesTable.subjectiveComplaints,
      objectiveFindings: ipdProgressNotesTable.objectiveFindings,
      vitalsSummary: ipdProgressNotesTable.vitalsSummary,
      examinationSystemic: ipdProgressNotesTable.examinationSystemic,
      diagnosisAssessment: ipdProgressNotesTable.diagnosisAssessment,
      plan: ipdProgressNotesTable.plan,
      investigationsAdvised: ipdProgressNotesTable.investigationsAdvised,
      medicinesChanged: ipdProgressNotesTable.medicinesChanged,
      procedureNotes: ipdProgressNotesTable.procedureNotes,
      followUpInstructions: ipdProgressNotesTable.followUpInstructions,
    }).from(ipdProgressNotesTable)
      .leftJoin(doctorsTable, eq(ipdProgressNotesTable.doctorId, doctorsTable.id))
      .where(eq(ipdProgressNotesTable.ipdAdmissionId, admissionId))
      .orderBy(desc(ipdProgressNotesTable.noteDate));

    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list progress notes");
    return res.status(500).json({ error: "Failed to list progress notes" });
  }
});

router.post("/ipd/:admissionId/progress-notes", async (req, res) => {
  try {
    const role = req.session.role;
    if (role !== "doctor" && role !== "admin") {
      return res.status(403).json({ error: "Only authorized doctors or admins can create progress notes" });
    }

    const admissionId = parseInt(req.params.admissionId);
    const b = req.body;
    if (!b.patientId || !b.doctorId) {
      return res.status(400).json({ error: "patientId and doctorId are required" });
    }

    const [row] = await db.insert(ipdProgressNotesTable).values({
      ipdAdmissionId: admissionId,
      patientId: b.patientId,
      doctorId: b.doctorId,
      subjectiveComplaints: b.subjectiveComplaints || null,
      objectiveFindings: b.objectiveFindings || null,
      vitalsSummary: b.vitalsSummary || {},
      examinationSystemic: b.examinationSystemic || {},
      diagnosisAssessment: b.diagnosisAssessment || null,
      plan: b.plan || null,
      investigationsAdvised: b.investigationsAdvised || [],
      medicinesChanged: b.medicinesChanged || [],
      procedureNotes: b.procedureNotes || null,
      followUpInstructions: b.followUpInstructions || null,
      aiGenerated: b.aiGenerated ?? false,
      doctorEdited: b.doctorEdited ?? false,
      approvedBy: b.approvedBy ?? null,
      approvedAt: b.approvedAt ? new Date(b.approvedAt) : null,
    }).returning();

    invalidateClinicalMemory(row.patientId);
    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create progress note");
    return res.status(500).json({ error: "Failed to create progress note" });
  }
});

router.put("/ipd/:admissionId/progress-notes/:noteId", async (req, res) => {
  try {
    const role = req.session.role;
    if (role !== "doctor" && role !== "admin") {
      return res.status(403).json({ error: "Only authorized doctors or admins can edit progress notes" });
    }

    const noteId = parseInt(req.params.noteId);
    const b = req.body;
    const update: any = {};
    const fields = [
      "subjectiveComplaints", "objectiveFindings", "vitalsSummary", "examinationSystemic",
      "diagnosisAssessment", "plan", "investigationsAdvised", "medicinesChanged",
      "procedureNotes", "followUpInstructions", "aiGenerated", "doctorEdited",
      "approvedBy", "approvedAt"
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

    const [row] = await db.update(ipdProgressNotesTable).set(update)
      .where(eq(ipdProgressNotesTable.id, noteId)).returning();

    if (!row) return res.status(404).json({ error: "Progress note not found" });
    invalidateClinicalMemory(row.patientId);
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update progress note");
    return res.status(500).json({ error: "Failed to update progress note" });
  }
});

export default router;
