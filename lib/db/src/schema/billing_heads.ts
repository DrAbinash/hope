import { pgTable, serial, text, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { entitiesTable } from "./entities";

export const billingHeadsTable = pgTable("billing_heads", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  defaultRate: numeric("default_rate", { precision: 10, scale: 2 }).notNull(),
  gstPercent: numeric("gst_percent", { precision: 5, scale: 2 }).default("0"),
  hsnSac: text("hsn_sac"),
  ledgerName: text("ledger_name"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBillingHeadSchema = createInsertSchema(billingHeadsTable).omit({ id: true, createdAt: true });
export type InsertBillingHead = z.infer<typeof insertBillingHeadSchema>;
export type BillingHead = typeof billingHeadsTable.$inferSelect;
