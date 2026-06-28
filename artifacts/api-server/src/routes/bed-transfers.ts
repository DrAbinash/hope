import { Router } from "express";
import { db } from "@workspace/db";
import {
  bedTransfersTable, wardsTable, bedsTable, employeesTable,
  ipdAdmissionsTable,
} from "@workspace/db";
import { and, eq, isNull, asc } from "drizzle-orm";

const router = Router();

router.get("/ipd/:id/stay", async (req, res) => {
  try {
    const ipdId = parseInt(req.params.id);
    const transfers = await db.select({
      id: bedTransfersTable.id,
      wardId: bedTransfersTable.wardId,
      wardName: wardsTable.name,
      wardType: wardsTable.type,
      ratePerDay: wardsTable.ratePerDay,
      bedId: bedTransfersTable.bedId,
      bedNo: bedsTable.bedNo,
      startedAt: bedTransfersTable.startedAt,
      endedAt: bedTransfersTable.endedAt,
      reason: bedTransfersTable.reason,
      transferredById: bedTransfersTable.transferredById,
      transferredByName: employeesTable.name,
    }).from(bedTransfersTable)
      .leftJoin(wardsTable, eq(bedTransfersTable.wardId, wardsTable.id))
      .leftJoin(bedsTable, eq(bedTransfersTable.bedId, bedsTable.id))
      .leftJoin(employeesTable, eq(bedTransfersTable.transferredById, employeesTable.id))
      .where(eq(bedTransfersTable.ipdAdmissionId, ipdId))
      .orderBy(asc(bedTransfersTable.startedAt));

    let totalDays = 0;
    let totalRent = 0;
    const enriched = transfers.map((t) => {
      const start = new Date(t.startedAt).getTime();
      const end = t.endedAt ? new Date(t.endedAt).getTime() : Date.now();
      const ms = Math.max(0, end - start);
      // round up to next day, minimum 1
      const days = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
      const rate = Number(t.ratePerDay || 0);
      const subtotal = days * rate;
      totalDays += days;
      totalRent += subtotal;
      return { ...t, days, rate, subtotal, isCurrent: !t.endedAt };
    });

    res.json({ transfers: enriched, totalDays, totalRent });
  } catch (err) {
    req.log.error({ err }, "Failed to get stay history");
    res.status(500).json({ error: "Failed to get stay history" });
  }
});

router.post("/ipd/:id/transfer", async (req, res) => {
  try {
    const ipdId = parseInt(req.params.id);
    const { wardId, bedId, reason, transferredById } = req.body;
    if (!wardId || !bedId) return res.status(400).json({ error: "wardId and bedId required" });

    const [adm] = await db.select().from(ipdAdmissionsTable).where(eq(ipdAdmissionsTable.id, ipdId));
    if (!adm) return res.status(404).json({ error: "Admission not found" });
    if (adm.status === "discharged") return res.status(400).json({ error: "Cannot transfer a discharged patient" });

    // verify new bed available
    const [newBed] = await db.select().from(bedsTable).where(eq(bedsTable.id, bedId));
    if (!newBed) return res.status(404).json({ error: "Bed not found" });
    if (newBed.status === "occupied" && newBed.id !== adm.bedId) {
      return res.status(400).json({ error: `Bed ${newBed.bedNo} is already occupied` });
    }
    if (newBed.id === adm.bedId) return res.status(400).json({ error: "Patient is already in this bed" });

    const now = new Date();

    // close current open transfer
    const [open] = await db.select().from(bedTransfersTable)
      .where(and(eq(bedTransfersTable.ipdAdmissionId, ipdId), isNull(bedTransfersTable.endedAt)));
    if (open) {
      await db.update(bedTransfersTable).set({ endedAt: now }).where(eq(bedTransfersTable.id, open.id));
    }

    // open new transfer
    const [newTransfer] = await db.insert(bedTransfersTable).values({
      ipdAdmissionId: ipdId,
      wardId, bedId,
      startedAt: now,
      reason: reason || null,
      transferredById: transferredById || null,
    }).returning();

    // free old bed, occupy new bed
    if (adm.bedId) {
      await db.update(bedsTable).set({ status: "available" }).where(eq(bedsTable.id, adm.bedId));
    }
    await db.update(bedsTable).set({ status: "occupied" }).where(eq(bedsTable.id, bedId));

    // update admission's current ward/bed
    await db.update(ipdAdmissionsTable).set({
      wardId, bedId, updatedAt: now,
    }).where(eq(ipdAdmissionsTable.id, ipdId));

    res.status(201).json(newTransfer);
  } catch (err) {
    req.log.error({ err }, "Failed to transfer bed");
    res.status(500).json({ error: "Failed to transfer bed" });
  }
});

export default router;
