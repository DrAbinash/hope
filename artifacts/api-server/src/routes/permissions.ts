import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getRolePermissions,
  setRolePermissions,
  getUserOverrides,
  setUserOverrides,
  getEffectivePermissions,
} from "../lib/permissions";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  next();
}

router.get("/permissions/me", async (req, res): Promise<void> => {
  if (!req.session.userId || !req.session.role) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const allowed = await getEffectivePermissions(req.session.userId, req.session.role);
    res.json({ allowedModules: allowed });
  } catch (err) {
    req.log.error({ err }, "Failed to get effective permissions");
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/permissions/role/:role", requireAdmin, async (req, res): Promise<void> => {
  try {
    const role = String(req.params.role);
    const map = await getRolePermissions(role);
    res.json(map);
  } catch (err) {
    req.log.error({ err }, "Failed to get role permissions");
    res.status(500).json({ error: "Failed" });
  }
});

router.put("/permissions/role/:role", requireAdmin, async (req, res): Promise<void> => {
  try {
    const role = String(req.params.role);
    const body = req.body as Record<string, boolean>;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    await setRolePermissions(role, body);
    const map = await getRolePermissions(role);
    res.json(map);
  } catch (err) {
    req.log.error({ err }, "Failed to set role permissions");
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/permissions/user/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
    if (!emp) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    const [roleMap, overrides] = await Promise.all([
      getRolePermissions(emp.role),
      getUserOverrides(id),
    ]);
    res.json({ role: emp.role, roleDefaults: roleMap, overrides });
  } catch (err) {
    req.log.error({ err }, "Failed to get user permissions");
    res.status(500).json({ error: "Failed" });
  }
});

router.put("/permissions/user/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    const body = req.body as Record<string, boolean | null>;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    await setUserOverrides(id, body);
    const overrides = await getUserOverrides(id);
    res.json(overrides);
  } catch (err) {
    req.log.error({ err }, "Failed to set user overrides");
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
