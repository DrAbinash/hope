import { Router } from "express";
import { db } from "@workspace/db";
import { wardsTable, bedsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/wards", async (req, res) => {
  try {
    const wards = await db.select().from(wardsTable).orderBy(wardsTable.name);
    const bedsCount = await db.select({
      wardId: bedsTable.wardId,
      total: sql<number>`count(*)`,
      available: sql<number>`count(*) filter (where ${bedsTable.status} = 'available')`,
    }).from(bedsTable).groupBy(bedsTable.wardId);

    const result = wards.map(w => {
      const bc = bedsCount.find(b => b.wardId === w.id);
      return { ...w, totalBeds: Number(bc?.total || 0), availableBeds: Number(bc?.available || 0) };
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list wards");
    res.status(500).json({ error: "Failed to list wards" });
  }
});

router.post("/wards", async (req, res) => {
  try {
    const { name, type, ratePerDay } = req.body;
    if (!name || !type) return res.status(400).json({ error: "name and type are required" });
    const [ward] = await db.insert(wardsTable).values({ name, type, ratePerDay: ratePerDay?.toString() }).returning();
    res.status(201).json({ ...ward, totalBeds: 0, availableBeds: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create ward");
    res.status(500).json({ error: "Failed to create ward" });
  }
});

router.get("/wards/bed-availability", async (req, res) => {
  try {
    const wards = await db.select().from(wardsTable);
    const bedsData = await db.select({
      wardId: bedsTable.wardId,
      total: sql<number>`count(*)`,
      occupied: sql<number>`count(*) filter (where ${bedsTable.status} = 'occupied')`,
      available: sql<number>`count(*) filter (where ${bedsTable.status} = 'available')`,
    }).from(bedsTable).groupBy(bedsTable.wardId);

    const result = wards.map(w => {
      const b = bedsData.find(bd => bd.wardId === w.id) || { total: 0, occupied: 0, available: 0 };
      const total = Number(b.total);
      const available = Number(b.available);
      return {
        wardId: w.id, wardName: w.name, wardType: w.type,
        totalBeds: total, occupiedBeds: Number(b.occupied), availableBeds: available,
        occupancyRate: total > 0 ? Math.round((Number(b.occupied) / total) * 100) : 0,
      };
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get bed availability");
    res.status(500).json({ error: "Failed to get bed availability" });
  }
});

router.get("/beds", async (req, res) => {
  try {
    const { wardId, status } = req.query;
    const beds = await db.select({
      id: bedsTable.id, wardId: bedsTable.wardId, wardName: wardsTable.name,
      bedNo: bedsTable.bedNo, status: bedsTable.status,
    }).from(bedsTable).leftJoin(wardsTable, eq(bedsTable.wardId, wardsTable.id))
      .where(wardId ? eq(bedsTable.wardId, parseInt(wardId as string)) : undefined as any)
      .orderBy(bedsTable.bedNo);

    const filtered = status ? beds.filter(b => b.status === status) : beds;
    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "Failed to list beds");
    res.status(500).json({ error: "Failed to list beds" });
  }
});

router.post("/beds", async (req, res) => {
  try {
    const { wardId, bedNo } = req.body;
    if (!wardId || !bedNo) return res.status(400).json({ error: "wardId and bedNo are required" });
    const [bed] = await db.insert(bedsTable).values({ wardId, bedNo, status: "available" }).returning();
    const [ward] = await db.select().from(wardsTable).where(eq(wardsTable.id, wardId));
    res.status(201).json({ ...bed, wardName: ward?.name });
  } catch (err) {
    req.log.error({ err }, "Failed to create bed");
    res.status(500).json({ error: "Failed to create bed" });
  }
});

export default router;
