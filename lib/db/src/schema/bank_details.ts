import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { entitiesTable } from "./entities";

export const bankDetailsTable = pgTable("bank_details", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  bankName: text("bank_name").notNull(),
  accountHolderName: text("account_holder_name").notNull(),
  accountNo: text("account_no").notNull(),
  ifscCode: text("ifsc_code"),
  branch: text("branch").notNull(),
  upiId: text("upi_id"),
  isActive: integer("is_active").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBankDetailsSchema = createInsertSchema(bankDetailsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBankDetails = z.infer<typeof insertBankDetailsSchema>;
export type BankDetails = typeof bankDetailsTable.$inferSelect;
