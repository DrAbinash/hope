import { db } from "@workspace/db";
import { rolePermissionsTable, userPermissionOverridesTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { ALL_MODULE_KEYS, DEFAULT_ROLE_PERMISSIONS } from "./default-permissions";

export async function ensureRoleSeeded(role: string): Promise<void> {
  const existing = await db.select({ moduleKey: rolePermissionsTable.moduleKey })
    .from(rolePermissionsTable)
    .where(eq(rolePermissionsTable.role, role));
  const have = new Set(existing.map((r) => r.moduleKey));
  const defaults = DEFAULT_ROLE_PERMISSIONS[role] || [];
  const allowedSet = new Set(defaults);
  const rows = ALL_MODULE_KEYS.filter((k) => !have.has(k)).map((k) => ({
    role,
    moduleKey: k,
    allowed: allowedSet.has(k),
  }));
  if (rows.length > 0) {
    await db.insert(rolePermissionsTable).values(rows).onConflictDoNothing();
  }
}

export async function getRolePermissions(role: string): Promise<Record<string, boolean>> {
  await ensureRoleSeeded(role);
  const rows = await db.select().from(rolePermissionsTable).where(eq(rolePermissionsTable.role, role));
  const map: Record<string, boolean> = {};
  for (const r of rows) map[r.moduleKey] = r.allowed;
  return map;
}

export async function getUserOverrides(employeeId: number): Promise<Record<string, boolean>> {
  const rows = await db.select().from(userPermissionOverridesTable)
    .where(eq(userPermissionOverridesTable.employeeId, employeeId));
  const map: Record<string, boolean> = {};
  for (const r of rows) map[r.moduleKey] = r.allowed;
  return map;
}

export async function getEffectivePermissions(employeeId: number, role: string): Promise<string[]> {
  const [roleMap, overrideMap] = await Promise.all([
    getRolePermissions(role),
    getUserOverrides(employeeId),
  ]);
  const allowed: string[] = [];
  for (const key of ALL_MODULE_KEYS) {
    const eff = key in overrideMap ? overrideMap[key] : (roleMap[key] ?? false);
    if (eff) allowed.push(key);
  }
  return allowed;
}

export async function setRolePermissions(role: string, perms: Record<string, boolean>): Promise<void> {
  await ensureRoleSeeded(role);
  const keys = Object.keys(perms).filter((k) => ALL_MODULE_KEYS.includes(k));
  if (keys.length === 0) return;
  // Drizzle doesn't support easy bulk upserts here; do per-row updates in a tx.
  await db.transaction(async (tx) => {
    for (const k of keys) {
      await tx.update(rolePermissionsTable)
        .set({ allowed: perms[k] })
        .where(and(eq(rolePermissionsTable.role, role), eq(rolePermissionsTable.moduleKey, k)));
    }
  });
}

export async function setUserOverrides(
  employeeId: number,
  overrides: Record<string, boolean | null>,
): Promise<void> {
  const validKeys = Object.keys(overrides).filter((k) => ALL_MODULE_KEYS.includes(k));
  await db.transaction(async (tx) => {
    const toClear = validKeys.filter((k) => overrides[k] === null);
    const toSet = validKeys.filter((k) => overrides[k] !== null);

    if (toClear.length > 0) {
      await tx.delete(userPermissionOverridesTable).where(
        and(
          eq(userPermissionOverridesTable.employeeId, employeeId),
          inArray(userPermissionOverridesTable.moduleKey, toClear),
        ),
      );
    }

    for (const k of toSet) {
      const value = overrides[k] as boolean;
      // Try update; if no rows changed, insert.
      const updated = await tx.update(userPermissionOverridesTable)
        .set({ allowed: value })
        .where(and(
          eq(userPermissionOverridesTable.employeeId, employeeId),
          eq(userPermissionOverridesTable.moduleKey, k),
        ))
        .returning({ id: userPermissionOverridesTable.id });
      if (updated.length === 0) {
        await tx.insert(userPermissionOverridesTable).values({
          employeeId,
          moduleKey: k,
          allowed: value,
        }).onConflictDoNothing();
      }
    }
  });
}
