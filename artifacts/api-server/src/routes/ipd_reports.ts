import { Router } from "express";
import { db, ipdAdmissionsTable, patientsTable, doctorsTable, wardsTable, bedsTable, invoicesTable } from "@workspace/db";
import { and, eq, gte, lte, sql, isNull, isNotNull, desc, ne, inArray } from "drizzle-orm";

const router = Router();

const ISO_RX = /^\d{4}-\d{2}-\d{2}$/;
function parseRange(req: any, required = true) {
  const { fromDate, toDate } = req.query as Record<string, string>;
  if (required && (!fromDate || !toDate)) return { error: "fromDate and toDate are required" };
  if (fromDate && !ISO_RX.test(fromDate)) return { error: "fromDate must be ISO YYYY-MM-DD" };
  if (toDate && !ISO_RX.test(toDate)) return { error: "toDate must be ISO YYYY-MM-DD" };
  if (fromDate && toDate && fromDate > toDate) return { error: "fromDate must be on or before toDate" };
  return { fromDate, toDate };
}

function admissionSelect() {
  return {
    id: ipdAdmissionsTable.id,
    ipdNo: ipdAdmissionsTable.ipdNo,
    admissionDate: ipdAdmissionsTable.admissionDate,
    dischargeDate: ipdAdmissionsTable.dischargeDate,
    status: ipdAdmissionsTable.status,
    diagnosis: ipdAdmissionsTable.diagnosis,
    patientId: ipdAdmissionsTable.patientId,
    patientName: patientsTable.name,
    uhid: patientsTable.uhid,
    age: patientsTable.age,
    gender: patientsTable.gender,
    phone: patientsTable.phone,
    doctorId: ipdAdmissionsTable.consultantDoctorId,
    doctorName: doctorsTable.name,
    wardId: ipdAdmissionsTable.wardId,
    wardName: wardsTable.name,
    bedId: ipdAdmissionsTable.bedId,
    bedNo: bedsTable.bedNo,
  };
}

function admissionJoins(qb: any) {
  return qb
    .leftJoin(patientsTable, eq(ipdAdmissionsTable.patientId, patientsTable.id))
    .leftJoin(doctorsTable, eq(ipdAdmissionsTable.consultantDoctorId, doctorsTable.id))
    .leftJoin(wardsTable, eq(ipdAdmissionsTable.wardId, wardsTable.id))
    .leftJoin(bedsTable, eq(ipdAdmissionsTable.bedId, bedsTable.id));
}

// 1) Admitted Patient List — currently admitted (no discharge date)
router.get("/reports/ipd/admitted", async (req, res) => {
  try {
    const rows = await admissionJoins(
      db.select(admissionSelect()).from(ipdAdmissionsTable),
    )
      .where(and(isNull(ipdAdmissionsTable.dischargeDate), ne(ipdAdmissionsTable.status, "discharged")))
      .orderBy(desc(ipdAdmissionsTable.admissionDate), desc(ipdAdmissionsTable.id));
    return res.json({ total: rows.length, rows });
  } catch (err) {
    req.log.error({ err }, "admitted list failed");
    return res.status(500).json({ error: "Failed to fetch admitted list" });
  }
});

// 2) Admission Log by Date — admissions in range
router.get("/reports/ipd/admissions", async (req, res) => {
  try {
    const r = parseRange(req);
    if ("error" in r) return res.status(400).json({ error: r.error });
    const rows = await admissionJoins(db.select(admissionSelect()).from(ipdAdmissionsTable))
      .where(and(gte(ipdAdmissionsTable.admissionDate, r.fromDate!), lte(ipdAdmissionsTable.admissionDate, r.toDate!)))
      .orderBy(desc(ipdAdmissionsTable.admissionDate), desc(ipdAdmissionsTable.id));
    return res.json({ fromDate: r.fromDate, toDate: r.toDate, total: rows.length, rows });
  } catch (err) {
    req.log.error({ err }, "admission log failed");
    return res.status(500).json({ error: "Failed to fetch admission log" });
  }
});

// 3 & 4) Dues — current (admitted) or DP (discharged with dues)
router.get("/reports/ipd/dues", async (req, res) => {
  try {
    const status = String(req.query.status || "current"); // 'current' | 'discharged' | 'all'
    if (!["current", "discharged", "all"].includes(status))
      return res.status(400).json({ error: "status must be current|discharged|all" });

    const rows = await admissionJoins(db.select({
      ...admissionSelect(),
    }).from(ipdAdmissionsTable))
      .where(
        status === "current" ? and(isNull(ipdAdmissionsTable.dischargeDate), ne(ipdAdmissionsTable.status, "discharged")) :
        status === "discharged" ? isNotNull(ipdAdmissionsTable.dischargeDate) :
        sql`TRUE`,
      )
      .orderBy(desc(ipdAdmissionsTable.admissionDate));

    if (rows.length === 0) return res.json({ total: 0, rows: [], totalDue: 0 });

    const ids = rows.map(r => r.id);
    // sum invoice totals/paid/due per ipd admission
    const inv = await db.select({
      ipdAdmissionId: invoicesTable.ipdAdmissionId,
      total: sql<string>`COALESCE(SUM(${invoicesTable.totalAmount}),0)`,
      paid: sql<string>`COALESCE(SUM(${invoicesTable.paidAmount}),0)`,
      due: sql<string>`COALESCE(SUM(${invoicesTable.dueAmount}),0)`,
    }).from(invoicesTable)
      .where(and(isNotNull(invoicesTable.ipdAdmissionId), inArray(invoicesTable.ipdAdmissionId, ids)))
      .groupBy(invoicesTable.ipdAdmissionId);

    const m = new Map(inv.map(i => [i.ipdAdmissionId, i]));
    const enriched = rows.map(r => {
      const x = m.get(r.id);
      const total = Number(x?.total || 0), paid = Number(x?.paid || 0), due = Number(x?.due || 0);
      return { ...r, billTotal: total, billPaid: paid, billDue: due };
    }).filter(r => r.billDue > 0 || status === "all");

    const totalDue = enriched.reduce((s, r) => s + r.billDue, 0);
    return res.json({ status, total: enriched.length, totalDue: +totalDue.toFixed(2), rows: enriched });
  } catch (err) {
    req.log.error({ err }, "ipd dues failed");
    return res.status(500).json({ error: "Failed to fetch IPD dues" });
  }
});

// 5 & 6) Discharge Log — all or by date
router.get("/reports/ipd/discharges", async (req, res) => {
  try {
    const r = parseRange(req, false);
    if ("error" in r) return res.status(400).json({ error: r.error });
    const filters: any[] = [isNotNull(ipdAdmissionsTable.dischargeDate)];
    if (r.fromDate) filters.push(gte(ipdAdmissionsTable.dischargeDate, r.fromDate));
    if (r.toDate) filters.push(lte(ipdAdmissionsTable.dischargeDate, r.toDate));
    const rows = await admissionJoins(db.select(admissionSelect()).from(ipdAdmissionsTable))
      .where(and(...filters))
      .orderBy(desc(ipdAdmissionsTable.dischargeDate), desc(ipdAdmissionsTable.id));
    return res.json({ fromDate: r.fromDate, toDate: r.toDate, total: rows.length, rows });
  } catch (err) {
    req.log.error({ err }, "discharge log failed");
    return res.status(500).json({ error: "Failed to fetch discharge log" });
  }
});

// 7) IPD Package Details — admissions with package invoices
router.get("/reports/ipd/packages", async (req, res) => {
  try {
    const r = parseRange(req, false);
    if ("error" in r) return res.status(400).json({ error: r.error });
    const filters: any[] = [
      isNotNull(invoicesTable.ipdAdmissionId),
      sql`${invoicesTable.items}::text ILIKE '%"packageId"%' OR ${invoicesTable.type} = 'package'`,
    ];
    if (r.fromDate) filters.push(gte(invoicesTable.invoiceDate, r.fromDate));
    if (r.toDate) filters.push(lte(invoicesTable.invoiceDate, r.toDate));
    const rows = await db.select({
      invoiceId: invoicesTable.id,
      invoiceNo: invoicesTable.invoiceNo,
      invoiceDate: invoicesTable.invoiceDate,
      ipdAdmissionId: invoicesTable.ipdAdmissionId,
      ipdNo: ipdAdmissionsTable.ipdNo,
      patientName: patientsTable.name,
      uhid: patientsTable.uhid,
      items: invoicesTable.items,
      total: invoicesTable.totalAmount,
      paid: invoicesTable.paidAmount,
      due: invoicesTable.dueAmount,
    }).from(invoicesTable)
      .leftJoin(ipdAdmissionsTable, eq(invoicesTable.ipdAdmissionId, ipdAdmissionsTable.id))
      .leftJoin(patientsTable, eq(invoicesTable.patientId, patientsTable.id))
      .where(and(...filters))
      .orderBy(desc(invoicesTable.invoiceDate));
    return res.json({ fromDate: r.fromDate, toDate: r.toDate, total: rows.length, rows });
  } catch (err) {
    req.log.error({ err }, "ipd packages failed");
    return res.status(500).json({ error: "Failed to fetch IPD package details" });
  }
});

export default router;
