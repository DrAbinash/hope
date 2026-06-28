import { Router } from "express";
import { db, opdVisitsTable, invoicesTable, patientsTable, doctorsTable, ipdAdmissionsTable, wardsTable } from "@workspace/db";
import { and, eq, desc, gte, lte, sql, isNotNull, ilike, or } from "drizzle-orm";

const router = Router();
const ISO_RX = /^\d{4}-\d{2}-\d{2}$/;

function parseDates(req: any) {
  const { fromDate, toDate } = req.query as Record<string, string>;
  if (!fromDate || !toDate) return { error: "fromDate and toDate are required" };
  if (!ISO_RX.test(fromDate) || !ISO_RX.test(toDate)) return { error: "Dates must be ISO YYYY-MM-DD" };
  if (fromDate > toDate) return { error: "fromDate must be on/before toDate" };
  const days = (Date.parse(toDate) - Date.parse(fromDate)) / 86400000;
  if (days > 366) return { error: "Date range cannot exceed 366 days" };
  return { fromDate, toDate };
}

// 1) OPD Bill Record — invoices linked to OPD visits
router.get("/reports/opd/bills", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const { fromDate, toDate } = p;
    const { doctorId, status, q } = req.query as Record<string, string>;

    const filters: any[] = [
      isNotNull(invoicesTable.opdVisitId),
      gte(invoicesTable.invoiceDate, fromDate),
      lte(invoicesTable.invoiceDate, toDate),
    ];
    if (status && ["paid", "partial", "pending"].includes(status)) filters.push(eq(invoicesTable.status, status));
    if (doctorId) {
      const did = parseInt(doctorId);
      if (Number.isNaN(did)) return res.status(400).json({ error: "Invalid doctorId" });
      filters.push(eq(opdVisitsTable.doctorId, did));
    }
    if (q) filters.push(or(ilike(patientsTable.name, `%${q}%`), ilike(patientsTable.uhid, `%${q}%`), ilike(invoicesTable.invoiceNo, `%${q}%`))!);

    const rows = await db.select({
      invoiceId: invoicesTable.id,
      invoiceNo: invoicesTable.invoiceNo,
      invoiceDate: invoicesTable.invoiceDate,
      patientId: patientsTable.id,
      patientName: patientsTable.name,
      uhid: patientsTable.uhid,
      doctorId: doctorsTable.id,
      doctorName: doctorsTable.name,
      visitNo: opdVisitsTable.visitNo,
      total: invoicesTable.totalAmount,
      paid: invoicesTable.paidAmount,
      due: invoicesTable.dueAmount,
      status: invoicesTable.status,
      paymentMode: invoicesTable.paymentMode,
    })
      .from(invoicesTable)
      .leftJoin(opdVisitsTable, eq(invoicesTable.opdVisitId, opdVisitsTable.id))
      .leftJoin(patientsTable, eq(invoicesTable.patientId, patientsTable.id))
      .leftJoin(doctorsTable, eq(opdVisitsTable.doctorId, doctorsTable.id))
      .where(and(...filters))
      .orderBy(desc(invoicesTable.invoiceDate), desc(invoicesTable.id));

    const totals = rows.reduce(
      (a, r) => ({
        total: a.total + Number(r.total ?? 0),
        paid: a.paid + Number(r.paid ?? 0),
        due: a.due + Number(r.due ?? 0),
      }),
      { total: 0, paid: 0, due: 0 },
    );
    return res.json({ count: rows.length, totals, rows });
  } catch (err) {
    req.log.error({ err }, "opd bills report failed");
    return res.status(500).json({ error: "Failed to load OPD bill report" });
  }
});

// 2) OPD Patient — registered OPD visits
router.get("/reports/opd/patients", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const { fromDate, toDate } = p;
    const { doctorId, status, q } = req.query as Record<string, string>;

    const filters: any[] = [
      gte(opdVisitsTable.visitDate, fromDate),
      lte(opdVisitsTable.visitDate, toDate),
    ];
    if (status && ["pending", "completed", "converted"].includes(status)) filters.push(eq(opdVisitsTable.status, status));
    if (doctorId) {
      const did = parseInt(doctorId);
      if (Number.isNaN(did)) return res.status(400).json({ error: "Invalid doctorId" });
      filters.push(eq(opdVisitsTable.doctorId, did));
    }
    if (q) filters.push(or(ilike(patientsTable.name, `%${q}%`), ilike(patientsTable.uhid, `%${q}%`), ilike(opdVisitsTable.visitNo, `%${q}%`))!);

    const rows = await db.select({
      visitId: opdVisitsTable.id,
      visitNo: opdVisitsTable.visitNo,
      visitDate: opdVisitsTable.visitDate,
      patientId: patientsTable.id,
      patientName: patientsTable.name,
      uhid: patientsTable.uhid,
      age: patientsTable.age,
      gender: patientsTable.gender,
      phone: patientsTable.phone,
      doctorId: doctorsTable.id,
      doctorName: doctorsTable.name,
      specialization: doctorsTable.specialization,
      status: opdVisitsTable.status,
      fee: opdVisitsTable.fee,
      convertedToIpd: opdVisitsTable.convertedToIpd,
    })
      .from(opdVisitsTable)
      .leftJoin(patientsTable, eq(opdVisitsTable.patientId, patientsTable.id))
      .leftJoin(doctorsTable, eq(opdVisitsTable.doctorId, doctorsTable.id))
      .where(and(...filters))
      .orderBy(desc(opdVisitsTable.visitDate), desc(opdVisitsTable.id));

    const totalFee = rows.reduce((a, r) => a + Number(r.fee ?? 0), 0);
    return res.json({ count: rows.length, totalFee, rows });
  } catch (err) {
    req.log.error({ err }, "opd patients report failed");
    return res.status(500).json({ error: "Failed to load OPD patient report" });
  }
});

// 3) OPD → IPD conversions
router.get("/reports/opd/conversions", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const { fromDate, toDate } = p;
    const { doctorId, q } = req.query as Record<string, string>;

    const filters: any[] = [
      eq(opdVisitsTable.convertedToIpd, true),
      gte(opdVisitsTable.visitDate, fromDate),
      lte(opdVisitsTable.visitDate, toDate),
    ];
    if (doctorId) {
      const did = parseInt(doctorId);
      if (Number.isNaN(did)) return res.status(400).json({ error: "Invalid doctorId" });
      filters.push(eq(opdVisitsTable.doctorId, did));
    }
    if (q) filters.push(or(ilike(patientsTable.name, `%${q}%`), ilike(patientsTable.uhid, `%${q}%`), ilike(opdVisitsTable.visitNo, `%${q}%`), ilike(ipdAdmissionsTable.ipdNo, `%${q}%`))!);

    const rows = await db.select({
      opdVisitId: opdVisitsTable.id,
      visitNo: opdVisitsTable.visitNo,
      visitDate: opdVisitsTable.visitDate,
      ipdId: ipdAdmissionsTable.id,
      ipdNo: ipdAdmissionsTable.ipdNo,
      admissionDate: ipdAdmissionsTable.admissionDate,
      patientName: patientsTable.name,
      uhid: patientsTable.uhid,
      doctorName: doctorsTable.name,
      wardName: wardsTable.name,
      ipdStatus: ipdAdmissionsTable.status,
    })
      .from(opdVisitsTable)
      .leftJoin(ipdAdmissionsTable, eq(opdVisitsTable.ipdAdmissionId, ipdAdmissionsTable.id))
      .leftJoin(patientsTable, eq(opdVisitsTable.patientId, patientsTable.id))
      .leftJoin(doctorsTable, eq(opdVisitsTable.doctorId, doctorsTable.id))
      .leftJoin(wardsTable, eq(ipdAdmissionsTable.wardId, wardsTable.id))
      .where(and(...filters))
      .orderBy(desc(opdVisitsTable.visitDate), desc(opdVisitsTable.id));

    return res.json({ count: rows.length, rows });
  } catch (err) {
    req.log.error({ err }, "opd conversions report failed");
    return res.status(500).json({ error: "Failed to load OPD→IPD report" });
  }
});

// 4) Consultant-Specific summary
router.get("/reports/opd/consultant", async (req, res) => {
  try {
    const p = parseDates(req); if ("error" in p) return res.status(400).json({ error: p.error });
    const { fromDate, toDate } = p;
    const { doctorId } = req.query as Record<string, string>;

    const filters: any[] = [
      gte(opdVisitsTable.visitDate, fromDate),
      lte(opdVisitsTable.visitDate, toDate),
    ];
    if (doctorId) {
      const did = parseInt(doctorId);
      if (Number.isNaN(did)) return res.status(400).json({ error: "Invalid doctorId" });
      filters.push(eq(opdVisitsTable.doctorId, did));
    }

    const rows = await db.select({
      doctorId: doctorsTable.id,
      doctorName: doctorsTable.name,
      specialization: doctorsTable.specialization,
      totalVisits: sql<number>`count(${opdVisitsTable.id})::int`,
      uniquePatients: sql<number>`count(distinct ${opdVisitsTable.patientId})::int`,
      converted: sql<number>`sum(case when ${opdVisitsTable.convertedToIpd} then 1 else 0 end)::int`,
      totalFee: sql<string>`coalesce(sum(${opdVisitsTable.fee}),0)::text`,
    })
      .from(opdVisitsTable)
      .innerJoin(doctorsTable, eq(opdVisitsTable.doctorId, doctorsTable.id))
      .where(and(...filters))
      .groupBy(doctorsTable.id, doctorsTable.name, doctorsTable.specialization)
      .orderBy(desc(sql`count(${opdVisitsTable.id})`));

    const totals = rows.reduce(
      (a, r) => ({
        visits: a.visits + Number(r.totalVisits ?? 0),
        patients: a.patients + Number(r.uniquePatients ?? 0),
        converted: a.converted + Number(r.converted ?? 0),
        fee: a.fee + Number(r.totalFee ?? 0),
      }),
      { visits: 0, patients: 0, converted: 0, fee: 0 },
    );
    return res.json({ count: rows.length, totals, rows });
  } catch (err) {
    req.log.error({ err }, "consultant report failed");
    return res.status(500).json({ error: "Failed to load Consultant report" });
  }
});

export default router;
