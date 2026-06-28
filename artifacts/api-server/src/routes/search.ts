import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable, employeesTable, medicinesTable, wardsTable, bedsTable } from "@workspace/db";
import { ilike, or } from "drizzle-orm";

const router = Router();

router.get("/search", async (req, res) => {
  try {
    const query = req.query.q?.toString().trim();
    if (!query) {
      res.json({ patients: [], employees: [], medicines: [], wards: [] });
      return;
    }

    const [patients, employees, medicines, wards] = await Promise.all([
      db.select({ id: patientsTable.id, name: patientsTable.name, uhid: patientsTable.uhid, phone: patientsTable.phone })
        .from(patientsTable)
        .where(or(
          ilike(patientsTable.name, `%${query}%`),
          ilike(patientsTable.uhid, `%${query}%`),
          ilike(patientsTable.phone, `%${query}%`)
        )).limit(10),
      db.select({ id: employeesTable.id, name: employeesTable.name, role: employeesTable.role, username: employeesTable.username })
        .from(employeesTable)
        .where(or(
          ilike(employeesTable.name, `%${query}%`),
          ilike(employeesTable.username, `%${query}%`)
        )).limit(10),
      db.select({ id: medicinesTable.id, name: medicinesTable.name, code: medicinesTable.genericName })
        .from(medicinesTable)
        .where(or(
          ilike(medicinesTable.name, `%${query}%`),
          ilike(medicinesTable.genericName, `%${query}%`),
          ilike(medicinesTable.brandName, `%${query}%`)
        )).limit(10),
      db.select({ id: wardsTable.id, name: wardsTable.name, type: wardsTable.type })
        .from(wardsTable)
        .where(ilike(wardsTable.name, `%${query}%`)).limit(10)
    ]);

    res.json({ patients, employees, medicines, wards });
  } catch (err) {
    req.log.error({ err }, "Global search failed");
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
