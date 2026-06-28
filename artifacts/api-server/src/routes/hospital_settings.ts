import { Router } from "express";
import { db } from "@workspace/db";
import { hospitalSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Whitelist + validate the writable fields. Entity is taken from the URL +
// session; we never accept it from the body.
const ALLOWED_FIELDS = new Set([
  "hospitalName", "tagline", "address", "city", "state", "pincode",
  "gstin", "pan", "mobile", "email", "website",
  "logoUrl", "letterheadUrl", "letterheadFooterUrl", "signatureUrl",
  "prescriptionPrintMode", "billHeader", "billFooter", "termsConditions",
  "invoicePrefix", "receiptPrefix", "uhidPrefix", "currency",
  "financialYearStart", "defaultBillType", "quickServices",
]);

function validateUpdateBody(input: unknown): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Body must be an object" };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!ALLOWED_FIELDS.has(k)) continue;
    if (k === "quickServices") {
      if (!Array.isArray(v)) return { ok: false, error: "quickServices must be an array" };
      if (v.length > 6) return { ok: false, error: "quickServices may have at most 6 entries" };
      const ints: number[] = [];
      for (const x of v) {
        if (typeof x !== "number" || !Number.isInteger(x) || x <= 0) {
          return { ok: false, error: "quickServices entries must be positive integers" };
        }
        if (ints.includes(x)) return { ok: false, error: "quickServices entries must be unique" };
        ints.push(x);
      }
      out.quickServices = ints;
    } else {
      out[k] = v;
    }
  }
  return { ok: true, data: out };
}

router.get("/hospital-settings", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(hospitalSettingsTable);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to list settings" });
  }
});

router.get("/hospital-settings/:entityId", async (req, res): Promise<void> => {
  try {
    const requested = parseInt(req.params.entityId);
    const sessionEntity = req.session.entityId ?? 1;
    const isAdmin = req.session.role === "admin";
    if (!isAdmin && requested !== sessionEntity) {
      res.status(403).json({ error: "Cannot access settings for another entity" });
      return;
    }
    const [row] = await db.select().from(hospitalSettingsTable).where(eq(hospitalSettingsTable.entityId, requested));
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/hospital-settings/:entityId", async (req, res): Promise<void> => {
  try {
    const entityId = parseInt(req.params.entityId);
    const sessionEntity = req.session.entityId ?? 1;
    const isAdmin = req.session.role === "admin";
    if (!isAdmin && entityId !== sessionEntity) {
      res.status(403).json({ error: "Cannot modify settings for another entity" });
      return;
    }
    const parsed = validateUpdateBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const body = parsed.data as Partial<typeof hospitalSettingsTable.$inferInsert>;
    const [existing] = await db.select().from(hospitalSettingsTable).where(eq(hospitalSettingsTable.entityId, entityId));
    if (existing) {
      const [updated] = await db.update(hospitalSettingsTable)
        .set({ ...body, entityId, updatedAt: new Date() })
        .where(eq(hospitalSettingsTable.entityId, entityId)).returning();
      res.json(updated);
      return;
    }
    if (!body.hospitalName) {
      res.status(400).json({ error: "hospitalName required to create settings" });
      return;
    }
    const [created] = await db.insert(hospitalSettingsTable)
      .values({ ...body, hospitalName: body.hospitalName, entityId })
      .returning();
    res.json(created);
  } catch {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

export default router;
