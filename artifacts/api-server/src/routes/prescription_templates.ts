import { Router } from "express";
import { db } from "@workspace/db";
import { prescriptionTemplatesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/prescription-templates", async (req, res) => {
  try {
    const { doctorId } = req.query;
    const entityId = req.session.entityId ?? 1;
    const where = doctorId
      ? and(eq(prescriptionTemplatesTable.entityId, entityId), eq(prescriptionTemplatesTable.doctorId, parseInt(doctorId as string)))
      : eq(prescriptionTemplatesTable.entityId, entityId);
    const templates = await db.select().from(prescriptionTemplatesTable).where(where).orderBy(prescriptionTemplatesTable.name);
    res.json(templates);
  } catch (err) {
    req.log.error({ err }, "Failed to list templates");
    res.status(500).json({ error: "Failed to list templates" });
  }
});

router.post("/prescription-templates", async (req, res) => {
  try {
    const { doctorId, name, chiefComplaints, diagnosis, medicines, labTests, radiologyTests, advise, specialAdvise, followUpDays } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const entityId = req.session.entityId ?? 1;
    const [template] = await db.insert(prescriptionTemplatesTable).values({
      entityId, doctorId, name, chiefComplaints, diagnosis, medicines: medicines || [],
      labTests, radiologyTests, advise, specialAdvise, followUpDays,
    }).returning();
    res.status(201).json(template);
  } catch (err) {
    req.log.error({ err }, "Failed to create template");
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.get("/prescription-templates/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const [template] = await db.select().from(prescriptionTemplatesTable)
      .where(and(eq(prescriptionTemplatesTable.id, id), eq(prescriptionTemplatesTable.entityId, entityId)));
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (err) {
    req.log.error({ err }, "Failed to get template");
    res.status(500).json({ error: "Failed to get template" });
  }
});

router.put("/prescription-templates/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const { doctorId, name, chiefComplaints, diagnosis, medicines, labTests, radiologyTests, advise, specialAdvise, followUpDays } = req.body;
    const [template] = await db.update(prescriptionTemplatesTable).set({
      doctorId, name, chiefComplaints, diagnosis, medicines: medicines || [],
      labTests, radiologyTests, advise, specialAdvise, followUpDays, updatedAt: new Date(),
    }).where(and(eq(prescriptionTemplatesTable.id, id), eq(prescriptionTemplatesTable.entityId, entityId))).returning();
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (err) {
    req.log.error({ err }, "Failed to update template");
    res.status(500).json({ error: "Failed to update template" });
  }
});

router.delete("/prescription-templates/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entityId = req.session.entityId ?? 1;
    const result = await db.delete(prescriptionTemplatesTable)
      .where(and(eq(prescriptionTemplatesTable.id, id), eq(prescriptionTemplatesTable.entityId, entityId)))
      .returning({ id: prescriptionTemplatesTable.id });
    if (result.length === 0) return res.status(404).json({ error: "Template not found" });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete template");
    res.status(500).json({ error: "Failed to delete template" });
  }
});

export default router;
