import { pgTable, serial, text, integer, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { entitiesTable } from "./entities";
import { doctorsTable } from "./doctors";

export const diagnosticOrdersTable = pgTable("diagnostic_orders", {
  id: serial("id").primaryKey(),
  orderNo: text("order_no").notNull().unique(),
  type: text("type").notNull(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  doctorId: integer("doctor_id").references(() => doctorsTable.id),
  opdVisitId: integer("opd_visit_id"),
  ipdAdmissionId: integer("ipd_admission_id"),
  items: jsonb("items").notNull().default([]),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default("pending").notNull(),
  invoiceId: integer("invoice_id"),
  notes: text("notes"),
  orderedAt: timestamp("ordered_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDiagnosticOrderSchema = createInsertSchema(diagnosticOrdersTable).omit({
  id: true, orderNo: true, createdAt: true, updatedAt: true,
});
export type InsertDiagnosticOrder = z.infer<typeof insertDiagnosticOrderSchema>;
export type DiagnosticOrder = typeof diagnosticOrdersTable.$inferSelect;
