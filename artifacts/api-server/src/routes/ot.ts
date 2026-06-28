import { Router } from "express";
import { db } from "@workspace/db";
import {
  otBookingsTable, patientsTable, doctorsTable, invoicesTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { invalidateClinicalMemory } from "./ai_assistant";
import { alias } from "drizzle-orm/pg-core";

const router = Router();

const surgeonAlias = alias(doctorsTable, "surgeon");
const anaesthetistAlias = alias(doctorsTable, "anaesthetist");

function generateBookingNo(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const num = Math.floor(1000 + Math.random() * 9000);
  return `OT${dateStr}${num}`;
}

router.get("/ot-bookings", async (req, res) => {
  try {
    const { status, room } = req.query as Record<string, string>;
    const rows = await db.select({
      id: otBookingsTable.id,
      bookingNo: otBookingsTable.bookingNo,
      patientId: otBookingsTable.patientId,
      patientName: patientsTable.name,
      patientUhid: patientsTable.uhid,
      entityId: otBookingsTable.entityId,
      otRoom: otBookingsTable.otRoom,
      surgeonId: otBookingsTable.surgeonId,
      surgeonName: surgeonAlias.name,
      anaesthetistId: otBookingsTable.anaesthetistId,
      anaesthetistName: anaesthetistAlias.name,
      procedureName: otBookingsTable.procedureName,
      procedureCharge: otBookingsTable.procedureCharge,
      anaesthesiaType: otBookingsTable.anaesthesiaType,
      anaesthesiaNotes: otBookingsTable.anaesthesiaNotes,
      preOpChecklist: otBookingsTable.preOpChecklist,
      consumables: otBookingsTable.consumables,
      notes: otBookingsTable.notes,
      status: otBookingsTable.status,
      invoiceId: otBookingsTable.invoiceId,
      scheduledAt: otBookingsTable.scheduledAt,
      startedAt: otBookingsTable.startedAt,
      endedAt: otBookingsTable.endedAt,
    }).from(otBookingsTable)
      .leftJoin(patientsTable, eq(otBookingsTable.patientId, patientsTable.id))
      .leftJoin(surgeonAlias, eq(otBookingsTable.surgeonId, surgeonAlias.id))
      .leftJoin(anaesthetistAlias, eq(otBookingsTable.anaesthetistId, anaesthetistAlias.id))
      .orderBy(desc(otBookingsTable.scheduledAt));

    let filtered = rows;
    if (status) filtered = filtered.filter((r) => r.status === status);
    if (room) filtered = filtered.filter((r) => r.otRoom === room);
    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "Failed to list OT bookings");
    res.status(500).json({ error: "Failed to list OT bookings" });
  }
});

router.post("/ot-bookings", async (req, res) => {
  try {
    const {
      patientId, entityId, ipdAdmissionId, otRoom, surgeonId, anaesthetistId,
      procedureBillingHeadId, procedureName, procedureCharge,
      anaesthesiaType, anaesthesiaNotes, preOpChecklist, consumables,
      notes, scheduledAt,
    } = req.body;
    if (!patientId || !otRoom || !procedureName || procedureCharge === undefined || !scheduledAt) {
      return res.status(400).json({ error: "patientId, otRoom, procedureName, procedureCharge, scheduledAt required" });
    }
    const bookingNo = generateBookingNo();
    const [booking] = await db.insert(otBookingsTable).values({
      bookingNo, patientId,
      entityId: entityId ?? null,
      ipdAdmissionId: ipdAdmissionId ?? null,
      otRoom,
      surgeonId: surgeonId ?? null,
      anaesthetistId: anaesthetistId ?? null,
      procedureBillingHeadId: procedureBillingHeadId ?? null,
      procedureName,
      procedureCharge: procedureCharge.toString(),
      anaesthesiaType: anaesthesiaType ?? null,
      anaesthesiaNotes: anaesthesiaNotes ?? null,
      preOpChecklist: preOpChecklist ?? {},
      consumables: consumables ?? [],
      notes: notes ?? null,
      scheduledAt: new Date(scheduledAt),
      status: "scheduled",
    }).returning();
    invalidateClinicalMemory(booking.patientId);
    res.status(201).json(booking);
  } catch (err) {
    req.log.error({ err }, "Failed to create OT booking");
    res.status(500).json({ error: "Failed to create OT booking" });
  }
});

router.get("/ot-bookings/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.select().from(otBookingsTable).where(eq(otBookingsTable.id, id));
    if (!row) return res.status(404).json({ error: "Booking not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to get OT booking");
    res.status(500).json({ error: "Failed to get OT booking" });
  }
});

router.put("/ot-bookings/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      status, anaesthesiaType, anaesthesiaNotes, preOpChecklist, consumables, notes,
      startedAt, endedAt, otRoom, scheduledAt, procedureCharge,
    } = req.body;
    const [existing] = await db.select().from(otBookingsTable).where(eq(otBookingsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Booking not found" });

    const update: any = { updatedAt: new Date() };
    if (status !== undefined) {
      update.status = status;
      if (status === "in_progress" && !existing.startedAt) update.startedAt = new Date();
      if (status === "completed" && !existing.endedAt) update.endedAt = new Date();
    }
    if (anaesthesiaType !== undefined) update.anaesthesiaType = anaesthesiaType;
    if (anaesthesiaNotes !== undefined) update.anaesthesiaNotes = anaesthesiaNotes;
    if (preOpChecklist !== undefined) update.preOpChecklist = preOpChecklist;
    if (consumables !== undefined) update.consumables = consumables;
    if (notes !== undefined) update.notes = notes;
    if (startedAt !== undefined) update.startedAt = startedAt ? new Date(startedAt) : null;
    if (endedAt !== undefined) update.endedAt = endedAt ? new Date(endedAt) : null;
    if (otRoom !== undefined) update.otRoom = otRoom;
    if (scheduledAt !== undefined) update.scheduledAt = new Date(scheduledAt);
    if (procedureCharge !== undefined) update.procedureCharge = procedureCharge.toString();

    const [row] = await db.update(otBookingsTable).set(update)
      .where(eq(otBookingsTable.id, id)).returning();
    invalidateClinicalMemory(row.patientId);
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update OT booking");
    res.status(500).json({ error: "Failed to update OT booking" });
  }
});

router.post("/ot-bookings/:id/bill", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { paidAmount, paymentMode, collectedBy, discount = 0, otCharges = 0 } = req.body;
    const [booking] = await db.select().from(otBookingsTable).where(eq(otBookingsTable.id, id));
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.invoiceId) return res.status(400).json({ error: "Booking already billed" });

    const items: any[] = [{
      description: booking.procedureName,
      code: "PROCEDURE",
      quantity: 1,
      rate: Number(booking.procedureCharge),
      amount: Number(booking.procedureCharge),
      gstPercent: 0,
    }];
    if (otCharges && Number(otCharges) > 0) {
      items.push({
        description: "OT Theatre Charges",
        code: "OT-CHARGES",
        quantity: 1,
        rate: Number(otCharges),
        amount: Number(otCharges),
        gstPercent: 0,
      });
    }
    for (const c of booking.consumables as any[]) {
      const qty = Number(c.quantity || 1);
      const rate = Number(c.rate || 0);
      items.push({
        description: c.name, code: c.code || "CONSUMABLE",
        quantity: qty, rate, amount: rate * qty, gstPercent: 0,
      });
    }
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const totalAmount = subtotal - Number(discount);
    const dueAmount = totalAmount - Number(paidAmount || 0);
    const date = new Date();
    const invoiceNo = `INV${date.toISOString().slice(0, 10).replace(/-/g, "")}${Math.floor(1000 + Math.random() * 9000)}`;

    const [invoice] = await (db.insert(invoicesTable) as any).values({
      invoiceNo, patientId: booking.patientId,
      entityId: booking.entityId ?? 1,
      ipdAdmissionId: booking.ipdAdmissionId,
      type: "OT",
      items, invoiceDate: date.toISOString().slice(0, 10),
      subtotal: subtotal.toString(),
      discount: Number(discount).toString(),
      gstAmount: "0",
      totalAmount: totalAmount.toString(),
      paidAmount: Number(paidAmount || 0).toString(),
      dueAmount: dueAmount.toString(),
      paymentMode: paymentMode || "Cash",
      collectedBy: collectedBy ?? null,
      status: dueAmount > 0 ? "partial" : "paid",
    } as any).returning();

    await db.update(otBookingsTable)
      .set({ invoiceId: invoice.id, updatedAt: new Date() })
      .where(eq(otBookingsTable.id, id));

    res.status(201).json({ invoice, bookingId: id });
  } catch (err) {
    req.log.error({ err }, "Failed to bill OT booking");
    res.status(500).json({ error: "Failed to bill OT booking" });
  }
});

export default router;
