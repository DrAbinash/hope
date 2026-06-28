import { Router } from "express";
import { db } from "@workspace/db";
import { opdVisitsTable, ipdAdmissionsTable, patientsTable, doctorsTable, invoicesTable, pharmacySalesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/reports/opd-to-ipd", async (req, res) => {
  try {
    const { fromDate, toDate } = req.query as Record<string, string>;
    const converted = await db.select({
      opdVisitId: opdVisitsTable.id,
      ipdAdmissionId: opdVisitsTable.ipdAdmissionId,
      patientName: patientsTable.name,
      uhid: patientsTable.uhid,
      doctorName: doctorsTable.name,
      diagnosis: opdVisitsTable.diagnosis,
      opdDate: opdVisitsTable.visitDate,
    }).from(opdVisitsTable)
      .leftJoin(patientsTable, eq(opdVisitsTable.patientId, patientsTable.id))
      .leftJoin(doctorsTable, eq(opdVisitsTable.doctorId, doctorsTable.id))
      .where(eq(opdVisitsTable.convertedToIpd, true));

    let result = converted.filter(r => r.ipdAdmissionId !== null);
    if (fromDate) result = result.filter(r => r.opdDate >= fromDate);
    if (toDate) result = result.filter(r => r.opdDate <= toDate);

    const withAdmission = await Promise.all(result.map(async r => {
      if (r.ipdAdmissionId) {
        const [ipd] = await db.select().from(ipdAdmissionsTable).where(eq(ipdAdmissionsTable.id, r.ipdAdmissionId));
        return { ...r, admissionDate: ipd?.admissionDate || "" };
      }
      return { ...r, admissionDate: "" };
    }));

    res.json(withAdmission);
  } catch (err) {
    req.log.error({ err }, "Failed to get OPD to IPD report");
    res.status(500).json({ error: "Failed to get report" });
  }
});

router.get("/reports/doctor-wise", async (req, res) => {
  try {
    const { fromDate, toDate } = req.query as Record<string, string>;
    const doctors = await db.select().from(doctorsTable);

    const result = await Promise.all(doctors.map(async doctor => {
      let opdQuery = db.select().from(opdVisitsTable).where(eq(opdVisitsTable.doctorId, doctor.id));
      let ipdQuery = db.select().from(ipdAdmissionsTable).where(eq(ipdAdmissionsTable.consultantDoctorId, doctor.id));

      let opdVisits = await opdQuery;
      let ipdAdmissions = await ipdQuery;

      if (fromDate) opdVisits = opdVisits.filter(v => v.visitDate >= fromDate);
      if (toDate) opdVisits = opdVisits.filter(v => v.visitDate <= toDate);

      const revenue = opdVisits.reduce((s, v) => s + parseFloat(v.fee || "0"), 0);
      const conversionCount = opdVisits.filter(v => v.convertedToIpd).length;

      return {
        doctorId: doctor.id, doctorName: doctor.name, specialization: doctor.specialization,
        opdCount: opdVisits.length, ipdCount: ipdAdmissions.length,
        conversionCount, revenue,
      };
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get doctor-wise report");
    res.status(500).json({ error: "Failed to get report" });
  }
});

router.get("/reports/financial", async (req, res) => {
  try {
    const { fromDate, toDate, groupBy = "month" } = req.query as Record<string, string>;
    const invoices = await db.select().from(invoicesTable);
    const pharmacy = await db.select().from(pharmacySalesTable);

    let filteredInvoices = invoices;
    let filteredPharmacy = pharmacy;
    if (fromDate) { filteredInvoices = filteredInvoices.filter(i => i.invoiceDate >= fromDate); filteredPharmacy = filteredPharmacy.filter(p => p.billDate >= fromDate); }
    if (toDate) { filteredInvoices = filteredInvoices.filter(i => i.invoiceDate <= toDate); filteredPharmacy = filteredPharmacy.filter(p => p.billDate <= toDate); }

    const totalRevenue = filteredInvoices.reduce((s, i) => s + parseFloat(i.totalAmount), 0);
    const totalCollection = filteredInvoices.reduce((s, i) => s + parseFloat(i.paidAmount), 0);
    const totalOutstanding = filteredInvoices.reduce((s, i) => s + parseFloat(i.dueAmount), 0);
    const hospitalRevenue = filteredInvoices.reduce((s, i) => s + parseFloat(i.totalAmount), 0);
    const pharmacyRevenue = filteredPharmacy.reduce((s, p) => s + parseFloat(p.totalAmount), 0);

    const breakdownMap = new Map<string, { revenue: number; collection: number }>();
    filteredInvoices.forEach(i => {
      const key = groupBy === "day" ? i.invoiceDate : i.invoiceDate.slice(0, 7);
      const existing = breakdownMap.get(key) || { revenue: 0, collection: 0 };
      breakdownMap.set(key, { revenue: existing.revenue + parseFloat(i.totalAmount), collection: existing.collection + parseFloat(i.paidAmount) });
    });

    const breakdowns = Array.from(breakdownMap.entries()).map(([period, data]) => ({ period, ...data })).sort((a, b) => a.period.localeCompare(b.period));

    res.json({ fromDate, toDate, totalRevenue, totalCollection, totalOutstanding, hospitalRevenue, pharmacyRevenue, breakdowns });
  } catch (err) {
    req.log.error({ err }, "Failed to get financial report");
    res.status(500).json({ error: "Failed to get report" });
  }
});

router.get("/reports/diagnosis-wise", async (req, res) => {
  try {
    const { fromDate, toDate } = req.query as Record<string, string>;
    let opdVisits = await db.select().from(opdVisitsTable);
    let ipdAdmissions = await db.select().from(ipdAdmissionsTable);

    if (fromDate) { opdVisits = opdVisits.filter(v => v.visitDate >= fromDate); ipdAdmissions = ipdAdmissions.filter(a => a.admissionDate >= fromDate); }
    if (toDate) { opdVisits = opdVisits.filter(v => v.visitDate <= toDate); ipdAdmissions = ipdAdmissions.filter(a => a.admissionDate <= toDate); }

    const diagnosisMap = new Map<string, { opd: number; ipd: number }>();
    opdVisits.filter(v => v.diagnosis).forEach(v => {
      const d = v.diagnosis!;
      const existing = diagnosisMap.get(d) || { opd: 0, ipd: 0 };
      diagnosisMap.set(d, { ...existing, opd: existing.opd + 1 });
    });
    ipdAdmissions.filter(a => a.diagnosis).forEach(a => {
      const d = a.diagnosis!;
      const existing = diagnosisMap.get(d) || { opd: 0, ipd: 0 };
      diagnosisMap.set(d, { ...existing, ipd: existing.ipd + 1 });
    });

    const result = Array.from(diagnosisMap.entries()).map(([diagnosis, counts]) => ({
      diagnosis, opdCount: counts.opd, ipdCount: counts.ipd, totalCount: counts.opd + counts.ipd,
    })).sort((a, b) => b.totalCount - a.totalCount);

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get diagnosis-wise report");
    res.status(500).json({ error: "Failed to get report" });
  }
});

export default router;
