import { pgTable, serial, text, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { entitiesTable } from "./entities";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  empCode: text("emp_code").notNull().unique(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  name: text("name").notNull(),
  role: text("role").notNull(),
  landingPath: text("landing_path"),
  department: text("department"),
  designation: text("designation"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  joiningDate: text("joining_date"),
  monthlySalary: numeric("monthly_salary", { precision: 10, scale: 2 }),
  username: text("username").unique(),
  pinHash: text("pin_hash"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, empCode: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
