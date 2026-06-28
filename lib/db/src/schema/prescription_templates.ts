import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { doctorsTable } from "./doctors";

export const prescriptionTemplatesTable = pgTable("prescription_templates", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").notNull(),
  doctorId: integer("doctor_id").references(() => doctorsTable.id),
  name: text("name").notNull(),
  chiefComplaints: text("chief_complaints"),
  diagnosis: text("diagnosis"),
  medicines: jsonb("medicines").default([]),
  labTests: text("lab_tests"),
  radiologyTests: text("radiology_tests"),
  advise: text("advise"),
  specialAdvise: text("special_advise"),
  followUpDays: integer("follow_up_days"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPrescriptionTemplateSchema = createInsertSchema(prescriptionTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPrescriptionTemplate = z.infer<typeof insertPrescriptionTemplateSchema>;
export type PrescriptionTemplate = typeof prescriptionTemplatesTable.$inferSelect;
