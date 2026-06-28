import { pgTable, serial, text, boolean, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const rolePermissionsTable = pgTable(
  "role_permissions",
  {
    id: serial("id").primaryKey(),
    role: text("role").notNull(),
    moduleKey: text("module_key").notNull(),
    allowed: boolean("allowed").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    roleModuleIdx: uniqueIndex("role_permissions_role_module_idx").on(t.role, t.moduleKey),
  }),
);

export const userPermissionOverridesTable = pgTable(
  "user_permission_overrides",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
    moduleKey: text("module_key").notNull(),
    allowed: boolean("allowed").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    empModuleIdx: uniqueIndex("user_perm_override_emp_module_idx").on(t.employeeId, t.moduleKey),
  }),
);

export type RolePermission = typeof rolePermissionsTable.$inferSelect;
export type UserPermissionOverride = typeof userPermissionOverridesTable.$inferSelect;
