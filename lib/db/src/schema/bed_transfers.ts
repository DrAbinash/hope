import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { wardsTable, bedsTable } from "./wards";
import { employeesTable } from "./employees";

export const bedTransfersTable = pgTable("bed_transfers", {
  id: serial("id").primaryKey(),
  ipdAdmissionId: integer("ipd_admission_id").notNull(),
  wardId: integer("ward_id").references(() => wardsTable.id).notNull(),
  bedId: integer("bed_id").references(() => bedsTable.id).notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  reason: text("reason"),
  transferredById: integer("transferred_by_id").references(() => employeesTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBedTransferSchema = createInsertSchema(bedTransfersTable).omit({ id: true, createdAt: true });
export type InsertBedTransfer = z.infer<typeof insertBedTransferSchema>;
export type BedTransfer = typeof bedTransfersTable.$inferSelect;
