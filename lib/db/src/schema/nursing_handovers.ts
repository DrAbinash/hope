import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";
import { ipdAdmissionsTable } from "./ipd";
import { employeesTable } from "./employees";

export const nursingHandoversTable = pgTable("nursing_handovers", {
  id: serial("id").primaryKey(),
  ipdAdmissionId: integer("ipd_admission_id").references(() => ipdAdmissionsTable.id).notNull(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  shift: text("shift").notNull(), // Morning, Evening, Night
  currentDiagnosis: text("current_diagnosis"),
  currentCondition: text("current_condition"),
  vitalsConcern: text("vitals_concern"),
  ivFluidsRunning: text("iv_fluids_running"),
  oxygenStatus: text("oxygen_status"),
  drainsTubes: text("drains_tubes"),
  pendingMedications: jsonb("pending_medications").default([]),
  pendingInvestigations: jsonb("pending_investigations").default([]),
  criticalInstructions: text("critical_instructions"),
  fallRisk: text("fall_risk"),
  intakeOutputNotes: text("intake_output_notes"),
  givenByEmployeeId: integer("given_by_employee_id").references(() => employeesTable.id).notNull(),
  takenByEmployeeId: integer("taken_by_employee_id").references(() => employeesTable.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
