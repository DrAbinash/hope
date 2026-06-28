import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable, opdVisitsTable, ipdAdmissionsTable, bedsTable, invoicesTable, pharmacySalesTable, medicinesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary", async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [
      totalPatients, todayOpd, activeIpd, availableBeds,
      todayInvoices, monthInvoices, pendingDues, lowStockMeds,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(patientsTable),
      db.select({ count: sql<number>`count(*)` }).from(opdVisitsTable).where(eq(opdVisitsTable.visitDate, today)),
      db.select({ count: sql<number>`count(*)` }).from(ipdAdmissionsTable).where(eq(ipdAdmissionsTable.status, "admitted")),
      db.select({ count: sql<number>`count(*)` }).from(bedsTable).where(eq(bedsTable.status, "available")),
      db.select().from(invoicesTable).where(eq(invoicesTable.invoiceDate, today)),
      db.select().from(invoicesTable),
      db.select().from(invoicesTable),
      db.select().from(medicinesTable),
    ]);

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const monthRevs = monthInvoices.filter(i => i.invoiceDate >= monthStart);

    res.json({
      totalPatients: Number(totalPatients[0].count),
      todayOpdVisits: Number(todayOpd[0].count),
      activeIpdAdmissions: Number(activeIpd[0].count),
      availableBeds: Number(availableBeds[0].count),
      todayRevenue: todayInvoices.reduce((s, i) => s + parseFloat(i.paidAmount), 0),
      monthRevenue: monthRevs.reduce((s, i) => s + parseFloat(i.totalAmount), 0),
      pendingDues: pendingDues.reduce((s, i) => s + parseFloat(i.dueAmount), 0),
      lowStockItems: lowStockMeds.filter(m => m.stock <= (m.reorderLevel || 10)).length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Failed to get dashboard summary" });
  }
});

router.get("/dashboard/recent-activity", async (req, res) => {
  try {
    const [recentOpd, recentIpd] = await Promise.all([
      db.select({
        id: opdVisitsTable.id, visitDate: opdVisitsTable.visitDate,
        patientName: patientsTable.name, status: opdVisitsTable.status,
        createdAt: opdVisitsTable.createdAt,
      }).from(opdVisitsTable)
        .leftJoin(patientsTable, eq(opdVisitsTable.patientId, patientsTable.id))
        .orderBy(opdVisitsTable.createdAt).limit(5),
      db.select({
        id: ipdAdmissionsTable.id, ipdNo: ipdAdmissionsTable.ipdNo,
        patientName: patientsTable.name, status: ipdAdmissionsTable.status,
        createdAt: ipdAdmissionsTable.createdAt,
      }).from(ipdAdmissionsTable)
        .leftJoin(patientsTable, eq(ipdAdmissionsTable.patientId, patientsTable.id))
        .orderBy(ipdAdmissionsTable.createdAt).limit(5),
    ]);

    const activities = [
      ...recentOpd.map(o => ({ id: o.id, type: "opd", description: `OPD visit for ${o.patientName}`, patientName: o.patientName || "", createdAt: o.createdAt?.toISOString() || "" })),
      ...recentIpd.map(i => ({ id: i.id + 10000, type: "ipd", description: `IPD admission ${i.ipdNo} for ${i.patientName}`, patientName: i.patientName || "", createdAt: i.createdAt?.toISOString() || "" })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

    res.json(activities);
  } catch (err) {
    req.log.error({ err }, "Failed to get recent activity");
    res.status(500).json({ error: "Failed to get recent activity" });
  }
});

export default router;
