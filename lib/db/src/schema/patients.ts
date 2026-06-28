import { pgTable, serial, text, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").notNull(),
  uhid: text("uhid").notNull().unique(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address"),
  bloodGroup: text("blood_group"),
  allergies: text("allergies"),
  emergencyContact: text("emergency_contact"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_patients_entity_id").on(table.entityId),
  index("idx_patients_phone").on(table.phone),
  index("idx_patients_name").on(table.name),
  index("idx_patients_created_at").on(table.createdAt),
]);

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ id: true, uhid: true, createdAt: true, updatedAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
