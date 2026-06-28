import { Router } from "express";
import { db, patientLookupsTable, PATIENT_LOOKUP_CATEGORIES } from "@workspace/db";
import { and, eq, isNull, or, asc } from "drizzle-orm";

const router = Router();

const HIERARCHY: Record<string, string | null> = {
  initial: null,
  religion: null,
  blood_group: null,
  marital_status: null,
  country: null,
  state: "country",
  city: "state",
  village: "city",
};

function isCategory(c: unknown): c is (typeof PATIENT_LOOKUP_CATEGORIES)[number] {
  return typeof c === "string" && (PATIENT_LOOKUP_CATEGORIES as readonly string[]).includes(c);
}

function entityScope(entityId: number | null | undefined) {
  if (!entityId) return isNull(patientLookupsTable.entityId);
  return or(eq(patientLookupsTable.entityId, entityId), isNull(patientLookupsTable.entityId));
}

router.get("/lookups", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const category = String(req.query.category || "");
    if (!isCategory(category)) return res.status(400).json({ error: "Invalid or missing category" });
    const parentIdRaw = req.query.parentId;
    const filters = [eq(patientLookupsTable.category, category), entityScope(entityId)];
    if (parentIdRaw !== undefined && parentIdRaw !== "") {
      const pid = parseInt(String(parentIdRaw));
      if (Number.isNaN(pid)) return res.status(400).json({ error: "Invalid parentId" });
      filters.push(eq(patientLookupsTable.parentId, pid));
    }
    const rows = await db.select().from(patientLookupsTable)
      .where(and(...filters))
      .orderBy(asc(patientLookupsTable.sortOrder), asc(patientLookupsTable.name));
    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list lookups failed");
    return res.status(500).json({ error: "Failed to list lookups" });
  }
});

router.post("/lookups", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const { category, name, parentId, sortOrder, isActive } = req.body || {};
    if (!isCategory(category)) return res.status(400).json({ error: "Invalid category" });
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "Name is required" });
    const requiredParent = HIERARCHY[category];
    if (requiredParent && (parentId === undefined || parentId === null || parentId === "")) {
      return res.status(400).json({ error: `${category} requires a ${requiredParent}` });
    }
    let parentIdNum: number | null = null;
    if (parentId !== undefined && parentId !== null && parentId !== "") {
      parentIdNum = parseInt(String(parentId));
      if (Number.isNaN(parentIdNum)) return res.status(400).json({ error: "Invalid parentId" });
      if (requiredParent) {
        const [p] = await db.select().from(patientLookupsTable)
          .where(and(eq(patientLookupsTable.id, parentIdNum), eq(patientLookupsTable.category, requiredParent), entityScope(entityId)));
        if (!p) return res.status(400).json({ error: `Parent ${requiredParent} not found` });
      }
    }
    // Pre-check duplicate (case-insensitive)
    const existing = await db.select().from(patientLookupsTable)
      .where(and(
        eq(patientLookupsTable.category, category),
        entityScope(entityId),
      ));
    const trimmed = name.trim();
    if (existing.some(r => r.name.toLowerCase() === trimmed.toLowerCase() && (r.parentId ?? null) === parentIdNum)) {
      return res.status(409).json({ error: "An entry with this name already exists" });
    }
    const [row] = await db.insert(patientLookupsTable).values({
      entityId, category, name: trimmed, parentId: parentIdNum,
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      isActive: isActive === false ? false : true,
    }).returning();
    return res.status(201).json(row);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "An entry with this name already exists" });
    req.log.error({ err }, "create lookup failed");
    return res.status(500).json({ error: "Failed to create lookup" });
  }
});

router.put("/lookups/:id", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db.select().from(patientLookupsTable)
      .where(and(eq(patientLookupsTable.id, id), entityScope(entityId)));
    if (!existing) return res.status(404).json({ error: "Not found" });

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof req.body.name === "string" && req.body.name.trim()) patch.name = req.body.name.trim();
    if (typeof req.body.isActive === "boolean") patch.isActive = req.body.isActive;
    if (typeof req.body.sortOrder === "number") patch.sortOrder = req.body.sortOrder;
    if (req.body.parentId !== undefined) {
      const requiredParent = HIERARCHY[existing.category];
      if (requiredParent) {
        if (req.body.parentId === null || req.body.parentId === "") {
          return res.status(400).json({ error: `${existing.category} requires a ${requiredParent}` });
        }
        const pid = parseInt(String(req.body.parentId));
        if (Number.isNaN(pid)) return res.status(400).json({ error: "Invalid parentId" });
        patch.parentId = pid;
      }
    }
    const [row] = await db.update(patientLookupsTable).set(patch)
      .where(and(eq(patientLookupsTable.id, id), entityScope(entityId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "An entry with this name already exists" });
    req.log.error({ err }, "update lookup failed");
    return res.status(500).json({ error: "Failed to update lookup" });
  }
});

router.delete("/lookups/:id", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db.select().from(patientLookupsTable)
      .where(and(eq(patientLookupsTable.id, id), entityScope(entityId)));
    if (!existing) return res.status(404).json({ error: "Not found" });
    // Prevent delete if a child references this row (state→country, city→state, village→city)
    const [child] = await db.select().from(patientLookupsTable)
      .where(and(eq(patientLookupsTable.parentId, id), entityScope(entityId)));
    if (child) return res.status(409).json({ error: `Cannot delete: in use by '${child.name}' (${child.category})` });
    const deleted = await db.delete(patientLookupsTable)
      .where(and(eq(patientLookupsTable.id, id), entityScope(entityId)))
      .returning({ id: patientLookupsTable.id });
    if (deleted.length === 0) return res.status(404).json({ error: "Not found" });
    return res.json({ success: true, id });
  } catch (err) {
    req.log.error({ err }, "delete lookup failed");
    return res.status(500).json({ error: "Failed to delete lookup" });
  }
});

export default router;
