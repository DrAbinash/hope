import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/employees", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(employeesTable).orderBy(employeesTable.name);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to list employees" });
  }
});

router.post("/employees", async (req, res): Promise<void> => {
  try {
    const { entityId, name, role, landingPath, department, designation, phone, email, address, joiningDate, monthlySalary, username, isActive } = req.body;
    if (!name || !role) {
      res.status(400).json({ error: "name and role are required" });
      return;
    }

    const [{ count }] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(employeesTable);
    const empCode = `EMP${String((count as number) + 1).padStart(4, "0")}`;

    const [emp] = await db.insert(employeesTable).values({
      empCode,
      entityId,
      name,
      role,
      landingPath,
      department,
      designation,
      phone,
      email,
      address,
      joiningDate,
      monthlySalary: monthlySalary?.toString(),
      username,
      isActive: isActive ?? true,
    }).returning();
    res.status(201).json(emp);
  } catch (err) {
    res.status(500).json({ error: "Failed to create employee" });
  }
});

router.put("/employees/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { entityId, name, role, landingPath, department, designation, phone, email, address, joiningDate, monthlySalary, username, isActive } = req.body;
    const [emp] = await db.update(employeesTable).set({
      entityId, name, role, landingPath, department, designation, phone, email, address, joiningDate,
      monthlySalary: monthlySalary?.toString(), username, isActive,
    }).where(eq(employeesTable.id, id)).returning();
    if (!emp) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: "Failed to update employee" });
  }
});

export default router;
