import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const PATIENT_LOOKUP_CATEGORIES = [
  "initial",
  "religion",
  "blood_group",
  "country",
  "state",
  "city",
  "village",
  "marital_status",
] as const;
export type PatientLookupCategory = (typeof PATIENT_LOOKUP_CATEGORIES)[number];

export const patientLookupsTable = pgTable(
  "patient_lookups",
  {
    id: serial("id").primaryKey(),
    entityId: integer("entity_id"),
    category: text("category").notNull(),
    name: text("name").notNull(),
    parentId: integer("parent_id"),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqEntityCategoryName: uniqueIndex("patient_lookups_entity_category_name_idx")
      .on(t.entityId, t.category, t.name),
  }),
);

export const insertPatientLookupSchema = createInsertSchema(patientLookupsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertPatientLookup = z.infer<typeof insertPatientLookupSchema>;
export type PatientLookup = typeof patientLookupsTable.$inferSelect;
