import { Router } from "express";
import { db } from "@workspace/db";
import { doctorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/doctors", async (req, res) => {
  try {
    const doctors = await db.select().from(doctorsTable).orderBy(doctorsTable.name);
    res.json(doctors);
  } catch (err) {
    req.log.error({ err }, "Failed to list doctors");
    res.status(500).json({ error: "Failed to list doctors" });
  }
});

router.post("/doctors", async (req, res) => {
  try {
    const { name, specialization, qualification, phone, email, registrationNo, signatureUrl, opdFee, isActive } = req.body;
    if (!name || !specialization) return res.status(400).json({ error: "name and specialization are required" });
    const [doctor] = await db.insert(doctorsTable).values({ name, specialization, qualification, phone, email, registrationNo, signatureUrl, opdFee: opdFee?.toString(), isActive: isActive ?? true }).returning();
    res.status(201).json(doctor);
  } catch (err) {
    req.log.error({ err }, "Failed to create doctor");
    res.status(500).json({ error: "Failed to create doctor" });
  }
});

router.put("/doctors/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, specialization, qualification, phone, email, registrationNo, signatureUrl, opdFee, isActive } = req.body;
    const [doctor] = await db.update(doctorsTable).set({
      name, specialization, qualification, phone, email, registrationNo, signatureUrl,
      opdFee: opdFee !== undefined && opdFee !== null && opdFee !== "" ? opdFee.toString() : undefined,
      isActive,
    }).where(eq(doctorsTable.id, id)).returning();
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });
    res.json(doctor);
  } catch (err) {
    req.log.error({ err }, "Failed to update doctor");
    res.status(500).json({ error: "Failed to update doctor" });
  }
});

router.get("/doctors/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, id));
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });
    res.json(doctor);
  } catch (err) {
    req.log.error({ err }, "Failed to get doctor");
    res.status(500).json({ error: "Failed to get doctor" });
  }
});

export default router;
