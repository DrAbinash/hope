import { Router } from "express";
import { db, patientCertificatesTable, patientsTable, employeesTable, PATIENT_CERTIFICATE_TYPES } from "@workspace/db";
import { and, eq, desc, gte, lte, isNull, sql } from "drizzle-orm";

const router = Router();

const ISO_RX = /^\d{4}-\d{2}-\d{2}$/;
const isType = (t: unknown): t is "birth" | "death" =>
  typeof t === "string" && (PATIENT_CERTIFICATE_TYPES as readonly string[]).includes(t);

function entityScope(entityId: number | null) {
  // Strict tenant isolation: certificates are bound to a single entity.
  if (!entityId) return isNull(patientCertificatesTable.entityId);
  return eq(patientCertificatesTable.entityId, entityId);
}

async function nextCertificateNo(entityId: number | null, type: "birth" | "death") {
  const prefix = type === "birth" ? "BC" : "DC";
  const year = new Date().getFullYear();
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(patientCertificatesTable)
    .where(and(eq(patientCertificatesTable.type, type), entityScope(entityId)));
  const seq = (count + 1).toString().padStart(5, "0");
  return `${prefix}${year}${seq}`;
}

router.get("/certificates", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const type = String(req.query.type || "");
    if (!isType(type)) return res.status(400).json({ error: "type must be 'birth' or 'death'" });
    const { fromDate, toDate, q } = req.query as Record<string, string>;
    if (fromDate && !ISO_RX.test(fromDate)) return res.status(400).json({ error: "fromDate must be ISO YYYY-MM-DD" });
    if (toDate && !ISO_RX.test(toDate)) return res.status(400).json({ error: "toDate must be ISO YYYY-MM-DD" });

    const filters: any[] = [eq(patientCertificatesTable.type, type), entityScope(entityId)];
    if (fromDate) filters.push(gte(patientCertificatesTable.issuedDate, fromDate));
    if (toDate) filters.push(lte(patientCertificatesTable.issuedDate, toDate));

    const rows = await db.select({
      id: patientCertificatesTable.id,
      certificateNo: patientCertificatesTable.certificateNo,
      type: patientCertificatesTable.type,
      issuedDate: patientCertificatesTable.issuedDate,
      patientId: patientCertificatesTable.patientId,
      patientName: patientsTable.name,
      uhid: patientsTable.uhid,
      details: patientCertificatesTable.details,
      issuedById: patientCertificatesTable.issuedById,
      issuedByName: employeesTable.name,
      createdAt: patientCertificatesTable.createdAt,
    }).from(patientCertificatesTable)
      .leftJoin(patientsTable, eq(patientCertificatesTable.patientId, patientsTable.id))
      .leftJoin(employeesTable, eq(patientCertificatesTable.issuedById, employeesTable.id))
      .where(and(...filters))
      .orderBy(desc(patientCertificatesTable.issuedDate), desc(patientCertificatesTable.id));

    const filtered = q
      ? rows.filter(r =>
          r.certificateNo.toLowerCase().includes(q.toLowerCase()) ||
          (r.patientName || "").toLowerCase().includes(q.toLowerCase()) ||
          ((r.details as any)?.deceasedName || (r.details as any)?.childName || "").toLowerCase().includes(q.toLowerCase()),
        )
      : rows;
    return res.json({ total: filtered.length, rows: filtered });
  } catch (err) {
    req.log.error({ err }, "list certificates failed");
    return res.status(500).json({ error: "Failed to list certificates" });
  }
});

router.get("/certificates/:id", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [row] = await db.select({
      id: patientCertificatesTable.id,
      certificateNo: patientCertificatesTable.certificateNo,
      type: patientCertificatesTable.type,
      issuedDate: patientCertificatesTable.issuedDate,
      patientId: patientCertificatesTable.patientId,
      patientName: patientsTable.name,
      uhid: patientsTable.uhid,
      patientGender: patientsTable.gender,
      patientAge: patientsTable.age,
      patientAddress: patientsTable.address,
      details: patientCertificatesTable.details,
      issuedById: patientCertificatesTable.issuedById,
      issuedByName: employeesTable.name,
      entityId: patientCertificatesTable.entityId,
      createdAt: patientCertificatesTable.createdAt,
    }).from(patientCertificatesTable)
      .leftJoin(patientsTable, eq(patientCertificatesTable.patientId, patientsTable.id))
      .leftJoin(employeesTable, eq(patientCertificatesTable.issuedById, employeesTable.id))
      .where(and(eq(patientCertificatesTable.id, id), entityScope(entityId)));
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "get certificate failed");
    return res.status(500).json({ error: "Failed to fetch certificate" });
  }
});

router.post("/certificates", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const { type, patientId, issuedDate, issuedById, details } = req.body ?? {};
    if (!isType(type)) return res.status(400).json({ error: "type must be 'birth' or 'death'" });
    if (!issuedDate || !ISO_RX.test(String(issuedDate))) return res.status(400).json({ error: "issuedDate must be ISO YYYY-MM-DD" });

    // Required minimal fields per type
    const d = (details && typeof details === "object") ? details : {};
    if (type === "birth") {
      if (!d.childName || !d.dob || !d.sex || !d.motherName) {
        return res.status(400).json({ error: "Birth certificate requires childName, dob, sex, motherName" });
      }
      if (!ISO_RX.test(String(d.dob))) return res.status(400).json({ error: "details.dob must be ISO YYYY-MM-DD" });
    } else {
      if (!d.deceasedName || !d.dod || !d.sex || !d.causeOfDeath) {
        return res.status(400).json({ error: "Death certificate requires deceasedName, dod, sex, causeOfDeath" });
      }
      if (!ISO_RX.test(String(d.dod))) return res.status(400).json({ error: "details.dod must be ISO YYYY-MM-DD" });
    }

    let pid: number | null = null;
    if (patientId !== undefined && patientId !== null && patientId !== "") {
      pid = parseInt(String(patientId));
      if (Number.isNaN(pid)) return res.status(400).json({ error: "Invalid patientId" });
    }
    let issuedBy: number | null = null;
    if (issuedById !== undefined && issuedById !== null && issuedById !== "") {
      issuedBy = parseInt(String(issuedById));
      if (Number.isNaN(issuedBy)) return res.status(400).json({ error: "Invalid issuedById" });
    }

    // Retry on unique-violation to absorb concurrent count-based collisions.
    let lastErr: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const certificateNo = await nextCertificateNo(entityId, type);
        const [row] = await db.insert(patientCertificatesTable).values({
          entityId: entityId ?? undefined,
          type,
          certificateNo,
          patientId: pid,
          issuedDate: String(issuedDate),
          issuedById: issuedBy,
          details: d,
        }).returning();
        return res.status(201).json(row);
      } catch (e: any) {
        if (e?.code === "23505") { lastErr = e; continue; }
        throw e;
      }
    }
    req.log.error({ err: lastErr }, "certificate number race exhausted");
    return res.status(409).json({ error: "Certificate number conflict, please retry" });
  } catch (err: any) {
    req.log.error({ err }, "create certificate failed");
    return res.status(500).json({ error: "Failed to create certificate" });
  }
});

router.put("/certificates/:id", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { issuedDate, details, patientId, issuedById } = req.body ?? {};
    const patch: any = { updatedAt: new Date() };
    if (issuedDate !== undefined) {
      if (!ISO_RX.test(String(issuedDate))) return res.status(400).json({ error: "issuedDate must be ISO YYYY-MM-DD" });
      patch.issuedDate = String(issuedDate);
    }
    if (details !== undefined) {
      if (typeof details !== "object" || details === null) return res.status(400).json({ error: "details must be an object" });
      patch.details = details;
    }
    if (patientId !== undefined) {
      if (patientId === null || patientId === "") patch.patientId = null;
      else { const pid = parseInt(String(patientId)); if (Number.isNaN(pid)) return res.status(400).json({ error: "Invalid patientId" }); patch.patientId = pid; }
    }
    if (issuedById !== undefined) {
      if (issuedById === null || issuedById === "") patch.issuedById = null;
      else { const e = parseInt(String(issuedById)); if (Number.isNaN(e)) return res.status(400).json({ error: "Invalid issuedById" }); patch.issuedById = e; }
    }
    const [row] = await db.update(patientCertificatesTable).set(patch)
      .where(and(eq(patientCertificatesTable.id, id), entityScope(entityId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "update certificate failed");
    return res.status(500).json({ error: "Failed to update certificate" });
  }
});

router.delete("/certificates/:id", async (req, res) => {
  try {
    const entityId = req.session.entityId ?? null;
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const deleted = await db.delete(patientCertificatesTable)
      .where(and(eq(patientCertificatesTable.id, id), entityScope(entityId)))
      .returning({ id: patientCertificatesTable.id });
    if (deleted.length === 0) return res.status(404).json({ error: "Not found" });
    return res.json({ success: true, id });
  } catch (err) {
    req.log.error({ err }, "delete certificate failed");
    return res.status(500).json({ error: "Failed to delete certificate" });
  }
});

export default router;
