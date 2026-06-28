import { pgTable, serial, text, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { entitiesTable } from "./entities";
import { doctorsTable } from "./doctors";

export const dischargeSummariesTable = pgTable("discharge_summaries", {
  id: serial("id").primaryKey(),
  summaryNo: text("summary_no").notNull().unique(),
  ipdAdmissionId: integer("ipd_admission_id"),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  attendingDoctorId: integer("attending_doctor_id").references(() => doctorsTable.id),
  admissionDate: text("admission_date"),
  dischargeDate: text("discharge_date"),
  admissionDiagnosis: text("admission_diagnosis"),
  finalDiagnosis: text("final_diagnosis"),
  presentingComplaints: text("presenting_complaints"),
  history: text("history"),
  examinationFindings: text("examination_findings"),
  investigations: jsonb("investigations").default([]),
  treatmentGiven: text("treatment_given"),
  proceduresPerformed: jsonb("procedures_performed").default([]),
  conditionAtDischarge: text("condition_at_discharge"),
  dischargeMedications: jsonb("discharge_medications").default([]),
  followUpAdvice: text("follow_up_advice"),
  dietAdvice: text("diet_advice"),
  activityAdvice: text("activity_advice"),
  warningSigns: text("warning_signs"),
  status: text("status").default("draft").notNull(),
  aiGenerated: boolean("ai_generated").default(false),
  doctorEdited: boolean("doctor_edited").default(false),
  approvedBy: integer("approved_by").references(() => doctorsTable.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDischargeSummarySchema = createInsertSchema(dischargeSummariesTable).omit({
  id: true, summaryNo: true, createdAt: true, updatedAt: true,
});
export type InsertDischargeSummary = z.infer<typeof insertDischargeSummarySchema>;
export type DischargeSummary = typeof dischargeSummariesTable.$inferSelect;
