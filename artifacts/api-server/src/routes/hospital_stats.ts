import { Router } from "express";
import { db, ipdAdmissionsTable, bedsTable, opdVisitsTable, patientsTable, doctorsTable } from "@workspace/db";
import { and, eq, gte, lte, sql, isNull, or, desc } from "drizzle-orm";

const router = Router();

function parseDateRange(req: any) {
  const { fromDate, toDate } = req.query as Record<string, string>;
  if (!fromDate || !toDate) return { error: "fromDate and toDate are required" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    return { error: "Dates must be ISO YYYY-MM-DD" };
  }
  if (fromDate > toDate) return { error: "fromDate must be on or before toDate" };
  return { fromDate, toDate };
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// GET /api/stats/bed-occupancy?fromDate=&toDate=&mode=daily|average
router.get("/stats/bed-occupancy", async (req, res) => {
  try {
    const dr = parseDateRange(req);
    if ("error" in dr) return res.status(400).json({ error: dr.error });
    const { fromDate, toDate } = dr;

    const [{ totalBeds }] = await db
      .select({ totalBeds: sql<number>`COUNT(*)::int` })
      .from(bedsTable);

    // Admissions overlapping the range: admission_date <= toDate AND (discharge_date IS NULL OR discharge_date >= fromDate)
    const admissions = await db
      .select({
        id: ipdAdmissionsTable.id,
        admissionDate: ipdAdmissionsTable.admissionDate,
        dischargeDate: ipdAdmissionsTable.dischargeDate,
      })
      .from(ipdAdmissionsTable)
      .where(and(
        lte(ipdAdmissionsTable.admissionDate, toDate),
        or(isNull(ipdAdmissionsTable.dischargeDate), gte(ipdAdmissionsTable.dischargeDate, fromDate)),
      ));

    const days = eachDay(fromDate, toDate);
    const todayStr = new Date().toISOString().slice(0, 10);
    const daily = days.map((d) => {
      let occupied = 0;
      for (const a of admissions) {
        const start = a.admissionDate;
        const end = a.dischargeDate ?? todayStr;
        if (start <= d && d <= end) occupied += 1;
      }
      const beds = Number(totalBeds || 0);
      const vacant = Math.max(0, beds - occupied);
      const pct = beds > 0 ? +((occupied / beds) * 100).toFixed(2) : 0;
      return { date: d, totalBeds: beds, occupied, vacant, occupancyPct: pct };
    });

    const sumOccupied = daily.reduce((s, r) => s + r.occupied, 0);
    const sumBedDays = daily.reduce((s, r) => s + r.totalBeds, 0);
    const averagePct = sumBedDays > 0 ? +((sumOccupied / sumBedDays) * 100).toFixed(2) : 0;
    const peak = daily.reduce((p, r) => (r.occupied > p.occupied ? r : p), daily[0] || { date: fromDate, occupied: 0, occupancyPct: 0 });

    return res.json({
      fromDate, toDate,
      totalBeds: Number(totalBeds || 0),
      averageOccupancyPct: averagePct,
      totalBedDays: sumBedDays,
      occupiedBedDays: sumOccupied,
      peakDay: peak ? { date: peak.date, occupied: peak.occupied, occupancyPct: peak.occupancyPct } : null,
      daily,
    });
  } catch (err) {
    req.log.error({ err }, "bed occupancy report failed");
    return res.status(500).json({ error: "Failed to compute bed occupancy" });
  }
});

// GET /api/stats/daily-case-register?fromDate=&toDate=&type=opd|ipd|all
router.get("/stats/daily-case-register", async (req, res) => {
  try {
    const dr = parseDateRange(req);
    if ("error" in dr) return res.status(400).json({ error: dr.error });
    const { fromDate, toDate } = dr;
    const type = String(req.query.type || "all");

    const cases: any[] = [];

    if (type === "all" || type === "opd") {
      const opdRows = await db
        .select({
          id: opdVisitsTable.id,
          visitNo: opdVisitsTable.visitNo,
          date: opdVisitsTable.visitDate,
          patientId: opdVisitsTable.patientId,
          patientName: patientsTable.name,
          uhid: patientsTable.uhid,
          gender: patientsTable.gender,
          age: patientsTable.age,
          phone: patientsTable.phone,
          doctorId: opdVisitsTable.doctorId,
          doctorName: doctorsTable.name,
          chiefComplaint: opdVisitsTable.chiefComplaints,
        })
        .from(opdVisitsTable)
        .leftJoin(patientsTable, eq(opdVisitsTable.patientId, patientsTable.id))
        .leftJoin(doctorsTable, eq(opdVisitsTable.doctorId, doctorsTable.id))
        .where(and(gte(opdVisitsTable.visitDate, fromDate), lte(opdVisitsTable.visitDate, toDate)))
        .orderBy(desc(opdVisitsTable.visitDate), desc(opdVisitsTable.id));
      for (const r of opdRows) cases.push({ ...r, caseType: "OPD" });
    }

    if (type === "all" || type === "ipd") {
      const ipdRows = await db
        .select({
          id: ipdAdmissionsTable.id,
          visitNo: ipdAdmissionsTable.ipdNo,
          date: ipdAdmissionsTable.admissionDate,
          patientId: ipdAdmissionsTable.patientId,
          patientName: patientsTable.name,
          uhid: patientsTable.uhid,
          gender: patientsTable.gender,
          age: patientsTable.age,
          phone: patientsTable.phone,
          doctorId: ipdAdmissionsTable.consultantDoctorId,
          doctorName: doctorsTable.name,
          chiefComplaint: ipdAdmissionsTable.diagnosis,
        })
        .from(ipdAdmissionsTable)
        .leftJoin(patientsTable, eq(ipdAdmissionsTable.patientId, patientsTable.id))
        .leftJoin(doctorsTable, eq(ipdAdmissionsTable.consultantDoctorId, doctorsTable.id))
        .where(and(gte(ipdAdmissionsTable.admissionDate, fromDate), lte(ipdAdmissionsTable.admissionDate, toDate)))
        .orderBy(desc(ipdAdmissionsTable.admissionDate), desc(ipdAdmissionsTable.id));
      for (const r of ipdRows) cases.push({ ...r, caseType: "IPD" });
    }

    cases.sort((a, b) => (a.date === b.date ? (a.caseType < b.caseType ? -1 : 1) : (a.date < b.date ? 1 : -1)));

    const byDate = new Map<string, { date: string; opdCount: number; ipdCount: number; total: number }>();
    for (const c of cases) {
      const e = byDate.get(c.date) ?? { date: c.date, opdCount: 0, ipdCount: 0, total: 0 };
      if (c.caseType === "OPD") e.opdCount += 1; else e.ipdCount += 1;
      e.total += 1;
      byDate.set(c.date, e);
    }
    const summary = [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));

    return res.json({
      fromDate, toDate, type,
      total: cases.length,
      opdTotal: cases.filter(c => c.caseType === "OPD").length,
      ipdTotal: cases.filter(c => c.caseType === "IPD").length,
      summary, cases,
    });
  } catch (err) {
    req.log.error({ err }, "daily case register failed");
    return res.status(500).json({ error: "Failed to build daily case register" });
  }
});

export default router;
