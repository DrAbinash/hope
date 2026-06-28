import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const wardsTable = pgTable("wards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  ratePerDay: numeric("rate_per_day", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bedsTable = pgTable("beds", {
  id: serial("id").primaryKey(),
  wardId: integer("ward_id").references(() => wardsTable.id).notNull(),
  bedNo: text("bed_no").notNull(),
  status: text("status").default("available").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWardSchema = createInsertSchema(wardsTable).omit({ id: true, createdAt: true });
export const insertBedSchema = createInsertSchema(bedsTable).omit({ id: true, createdAt: true });
export type InsertWard = z.infer<typeof insertWardSchema>;
export type InsertBed = z.infer<typeof insertBedSchema>;
export type Ward = typeof wardsTable.$inferSelect;
export type Bed = typeof bedsTable.$inferSelect;
