import { pgTable, serial, text, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { entitiesTable } from "./entities";
import { billingHeadsTable } from "./billing_heads";

export const packagesTable = pgTable("packages", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  mrpTotal: numeric("mrp_total", { precision: 12, scale: 2 }).notNull(),
  packageRate: numeric("package_rate", { precision: 12, scale: 2 }).notNull(),
  validityDays: integer("validity_days"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const packageItemsTable = pgTable("package_items", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").notNull().references(() => packagesTable.id, { onDelete: "cascade" }),
  billingHeadId: integer("billing_head_id").notNull().references(() => billingHeadsTable.id),
  quantity: integer("quantity").default(1).notNull(),
});

export const insertPackageSchema = createInsertSchema(packagesTable).omit({ id: true, createdAt: true });
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Package = typeof packagesTable.$inferSelect;
export type PackageItem = typeof packageItemsTable.$inferSelect;
