import { pgTable, serial, text, integer, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { entitiesTable } from "./entities";
import { doctorsTable } from "./doctors";
import { packagesTable } from "./packages";

export const estimationsTable = pgTable("estimations", {
  id: serial("id").primaryKey(),
  estimationNo: text("estimation_no").notNull().unique(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  type: text("type").notNull(), // surgery | ipd | investigation | general
  surgeonId: integer("surgeon_id").references(() => doctorsTable.id),
  doctorId: integer("doctor_id").references(() => doctorsTable.id),
  packageId: integer("package_id").references(() => packagesTable.id),
  wardCategory: text("ward_category"),
  expectedDays: integer("expected_days"),
  procedureName: text("procedure_name"),
  items: jsonb("items").notNull().default([]),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0"),
  gstAmount: numeric("gst_amount", { precision: 12, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  validityDays: integer("validity_days").default(7),
  validUntil: text("valid_until"),
  notes: text("notes"),
  status: text("status").default("draft").notNull(), // draft | sent | accepted | expired
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEstimationSchema = createInsertSchema(estimationsTable).omit({
  id: true, estimationNo: true, createdAt: true, updatedAt: true,
});
export type InsertEstimation = z.infer<typeof insertEstimationSchema>;
export type Estimation = typeof estimationsTable.$inferSelect;

export interface EstimationItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  billingHeadId?: number | null;
  category?: string | null;
}
