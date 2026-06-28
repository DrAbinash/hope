import { pgTable, serial, text, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";
import { ipdAdmissionsTable } from "./ipd";
import { doctorsTable } from "./doctors";

export const ipdProgressNotesTable = pgTable("ipd_progress_notes", {
  id: serial("id").primaryKey(),
  ipdAdmissionId: integer("ipd_admission_id").references(() => ipdAdmissionsTable.id).notNull(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  doctorId: integer("doctor_id").references(() => doctorsTable.id).notNull(),
  noteDate: timestamp("note_date").defaultNow().notNull(),
  subjectiveComplaints: text("subjective_complaints"),
  objectiveFindings: text("objective_findings"),
  vitalsSummary: jsonb("vitals_summary").default({}),
  examinationSystemic: jsonb("examination_systemic").default({}),
  diagnosisAssessment: text("diagnosis_assessment"),
  plan: text("plan"),
  investigationsAdvised: jsonb("investigations_advised").default([]),
  medicinesChanged: jsonb("medicines_changed").default([]),
  procedureNotes: text("procedure_notes"),
  followUpInstructions: text("follow_up_instructions"),
  aiGenerated: boolean("ai_generated").default(false),
  doctorEdited: boolean("doctor_edited").default(false),
  approvedBy: integer("approved_by").references(() => doctorsTable.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
