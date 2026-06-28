import { Router } from "express";
import { db } from "@workspace/db";
import { pharmacySalesTable, vendorPurchasesTable, entitiesTable, medicinesTable } from "@workspace/db";
import { and, gte, lte, eq } from "drizzle-orm";

const router = Router();

// Pharmacy is always entity_id=2 (Hope Pharmacy). Hardcoded to prevent IDOR via ?entityId.
const PHARMACY_ENTITY_ID = 2;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MMYYYY_RE = /^(0[1-9]|1[0-2])(\d{4})$/;

// Compute filing period (mmYYYY) and date window from req.
// Accepts ?period=MMYYYY OR ?from=YYYY-MM-DD&to=YYYY-MM-DD.
function resolvePeriod(req: any) {
  const period = (req.query.period as string) || "";
  if (MMYYYY_RE.test(period)) {
    const m = period.slice(0, 2);
    const y = period.slice(2);
    const from = `${y}-${m}-01`;
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    const to = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
    return { period, from, to };
  }
  const from = ISO_DATE_RE.test(req.query.from) ? req.query.from : new Date().toISOString().slice(0, 8) + "01";
  const to = ISO_DATE_RE.test(req.query.to) ? req.query.to : new Date().toISOString().slice(0, 10);
  const [y, m] = from.split("-");
  return { period: `${m}${y}`, from, to };
}

function r2(n: number) { return Math.round(n * 100) / 100; }

// Always file under Hope Pharmacy. No request-time override (prevents IDOR / cross-entity leakage).
async function getFilingEntity() {
  const [e] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, PHARMACY_ENTITY_ID));
  return e || null;
}

// Filing entity's home state code (first 2 chars of GSTIN). Defaults to "21" (Odisha) if unset.
function homeStateCode(gstin: string | null | undefined): string {
  return gstin && gstin.length >= 2 ? gstin.slice(0, 2) : "21";
}

// Numeric-aware bill-no sort so "BILL10" comes after "BILL9".
function billCmp(a: string, b: string): number {
  const ax = String(a || ""), bx = String(b || "");
  return ax.localeCompare(bx, undefined, { numeric: true, sensitivity: "base" });
}

// Build GSTR-1 sections strictly from Hope Pharmacy (entity_id=2) sales in window.
async function buildGstr1Sections(from: string, to: string, homeState: string) {
  const sales = await db.select().from(pharmacySalesTable)
    .where(and(
      eq(pharmacySalesTable.entityId, PHARMACY_ENTITY_ID),
      eq(pharmacySalesTable.billStatus, "final"),
      gte(pharmacySalesTable.billDate, from),
      lte(pharmacySalesTable.billDate, to),
    ));
  const meds = await db.select().from(medicinesTable);
  const medMap = new Map(meds.map(m => [m.id, m]));
  const interStateSkipped: string[] = [];

  // B2CS: aggregated by (rate, pos, type=OE)
  const b2csMap: Record<string, { rt: number; typ: string; pos: string; txval: number; iamt: number; camt: number; samt: number }> = {};
  // B2CL: invoice-wise inter-state above 2.5L
  const b2clInv: any[] = [];
  // HSN summary (Table 12)
  const hsnMap: Record<string, { num: number; hsn: string; uqc: string; qty: number; rt: number; txval: number; iamt: number; camt: number; samt: number; total: number }> = {};
  let hsnSeq = 1;

  for (const s of sales) {
    const items = (s.items as any[]) || [];
    const stateType = s.gstStateType || "intra";
    // Inter-state retail has no recipient state captured today — skip rather than mis-report POS.
    if (stateType === "inter") {
      interStateSkipped.push(s.billNo);
      continue;
    }
    const pos = homeState;
    const billDiscount = parseFloat(s.discount || "0");
    const billSubtotal = parseFloat(s.subtotal || "0") || 1;

    let invTaxable = 0, invIgst = 0, invCgst = 0, invSgst = 0;
    for (const it of items) {
      const fb = medMap.get(it.medicineId);
      const hsn = it.hsnCode || fb?.hsnCode || "30049099";
      const rate = parseFloat(String(it.gstPercent ?? fb?.gstPercent ?? "12"));
      const grossLine = parseFloat(String(it.amount || 0));
      const lineDiscount = billDiscount * (grossLine / billSubtotal);
      const taxable = grossLine - lineDiscount;
      const gst = taxable * rate / 100;
      const cgst = gst / 2;
      const sgst = gst / 2;
      const igst = 0;

      invTaxable += taxable; invIgst += igst; invCgst += cgst; invSgst += sgst;

      // B2CS aggregation (always intra here; inter-state was skipped above)
      const k = `${rate}|${pos}|INTRA`;
      if (!b2csMap[k]) b2csMap[k] = { rt: rate, typ: "OE", pos, txval: 0, iamt: 0, camt: 0, samt: 0 };
      b2csMap[k].txval += taxable;
      b2csMap[k].iamt += igst; b2csMap[k].camt += cgst; b2csMap[k].samt += sgst;

      // HSN summary
      const hk = `${hsn}|${rate}`;
      if (!hsnMap[hk]) hsnMap[hk] = { num: hsnSeq++, hsn, uqc: "NOS", qty: 0, rt: rate, txval: 0, iamt: 0, camt: 0, samt: 0, total: 0 };
      hsnMap[hk].qty += parseFloat(String(it.quantity || 0));
      hsnMap[hk].txval += taxable;
      hsnMap[hk].iamt += igst; hsnMap[hk].camt += cgst; hsnMap[hk].samt += sgst;
      hsnMap[hk].total += taxable + gst;
    }
  }

  // Doc Issued (Table 13) — bill range, numeric-aware sort
  const billNos = sales.map(s => s.billNo).sort(billCmp);
  const docIssued = sales.length > 0 ? [{
    doc_num: 1,
    doc_typ: "Invoices for outward supply",
    docs: [{
      num: 1, from: billNos[0], to: billNos[billNos.length - 1],
      totnum: sales.length, cancel: 0, net_issue: sales.length,
    }],
  }] : [];

  return {
    // GSTR-1 B2CS schema: sply_ty (INTRA/INTER), rt, typ (OE), pos, txval, iamt, camt, samt, csamt
    b2cs: Object.values(b2csMap).map(r => ({
      sply_ty: "INTRA",
      rt: r.rt, typ: r.typ, pos: r.pos,
      txval: r2(r.txval), iamt: r2(r.iamt), camt: r2(r.camt), samt: r2(r.samt), csamt: 0,
    })),
    b2cl: b2clInv,
    // GSTR-1 HSN schema (Table 12): num, hsn_sc, desc, uqc, qty, rt, txval, iamt, camt, samt, csamt, val
    hsn: Object.values(hsnMap).map(r => ({
      num: r.num, hsn_sc: r.hsn, desc: "", uqc: r.uqc,
      qty: r2(r.qty), rt: r.rt,
      txval: r2(r.txval), iamt: r2(r.iamt), camt: r2(r.camt), samt: r2(r.samt), csamt: 0,
      val: r2(r.total),
    })),
    doc_issue: docIssued,
    interStateSkipped,
    raw: { sales },
  };
}

// === GSTR-1 JSON (offline-tool / portal upload schema) ===
router.get("/pharmacy/gstr1/export", async (req, res) => {
  try {
    const fmt = (req.query.format as string) || "json";
    const section = (req.query.section as string) || "all";
    const { period, from, to } = resolvePeriod(req);
    const entity = await getFilingEntity();
    const gstin = entity?.gstin || "00XXXXXXXXXXX1Z0";
    const homeState = homeStateCode(entity?.gstin);

    const sec = await buildGstr1Sections(from, to, homeState);

    if (fmt === "csv") {
      let csv = "";
      if (section === "b2cs") {
        csv = "Type,Place Of Supply,Applicable % of Tax Rate,Rate,Taxable Value,Cess Amount,E-Commerce GSTIN\n";
        for (const r of sec.b2cs) {
          csv += `OE,${r.pos},,${r.rt},${r.txval.toFixed(2)},0.00,\n`;
        }
      } else if (section === "hsn") {
        csv = "HSN,Description,UQC,Total Quantity,Total Value,Taxable Value,Integrated Tax Amount,Central Tax Amount,State/UT Tax Amount,Cess Amount,Rate\n";
        for (const r of sec.hsn) {
          csv += `${r.hsn_sc},,${r.uqc},${r.qty.toFixed(2)},${r.val.toFixed(2)},${r.txval.toFixed(2)},${r.iamt.toFixed(2)},${r.camt.toFixed(2)},${r.samt.toFixed(2)},0.00,${r.rt}\n`;
        }
      } else if (section === "docs") {
        csv = "Nature of Document,Sr No From,Sr No To,Total Number,Cancelled,Net Issued\n";
        for (const d of sec.doc_issue) for (const x of d.docs) {
          csv += `Invoices for outward supply,${x.from},${x.to},${x.totnum},${x.cancel},${x.net_issue}\n`;
        }
      } else {
        return res.status(400).json({ error: "section must be one of: b2cs, hsn, docs" });
      }
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="GSTR1_${section}_${period}.csv"`);
      return res.send(csv);
    }

    // GSTR-1 JSON in offline-tool schema
    const payload: any = {
      gstin,
      fp: period,
      gt: 0, // gross turnover of preceding FY — placeholder
      cur_gt: r2(sec.b2cs.reduce((s: number, r: any) => s + r.txval, 0)),
      b2cs: sec.b2cs,
      hsn: { data: sec.hsn },
      doc_issue: { doc_det: sec.doc_issue },
    };
    if (sec.interStateSkipped.length > 0) {
      payload._warnings = [
        `Skipped ${sec.interStateSkipped.length} inter-state bill(s) (no recipient state captured): ${sec.interStateSkipped.slice(0, 10).join(", ")}${sec.interStateSkipped.length > 10 ? "..." : ""}. Add B2CL/B2CS-INTER manually before upload if any.`,
      ];
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="GSTR1_${gstin}_${period}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    req.log.error({ err }, "Failed GSTR-1 export");
    res.status(500).json({ error: "Failed GSTR-1 export" });
  }
});

// === GSTR-3B JSON (offline-tool / portal upload schema) ===
router.get("/pharmacy/gstr3b/export", async (req, res) => {
  try {
    const fmt = (req.query.format as string) || "json";
    const { period, from, to } = resolvePeriod(req);
    const entity = await getFilingEntity();
    const gstin = entity?.gstin || "00XXXXXXXXXXX1Z0";

    // Outward (sales) — pharmacy entity only
    const sales = await db.select().from(pharmacySalesTable)
      .where(and(
        eq(pharmacySalesTable.entityId, PHARMACY_ENTITY_ID),
        eq(pharmacySalesTable.billStatus, "final"),
        gte(pharmacySalesTable.billDate, from),
        lte(pharmacySalesTable.billDate, to),
      ));
    let osupTaxable = 0, osupCgst = 0, osupSgst = 0, osupIgst = 0;
    for (const s of sales) {
      const taxable = parseFloat(s.subtotal || "0") - parseFloat(s.discount || "0");
      osupTaxable += taxable;
      osupCgst += parseFloat(s.cgstAmount || "0");
      osupSgst += parseFloat(s.sgstAmount || "0");
      osupIgst += parseFloat(s.igstAmount || "0");
    }

    // Inward (vendor purchases) → ITC available — pharmacy entity only
    const purchases = await db.select().from(vendorPurchasesTable)
      .where(and(
        eq(vendorPurchasesTable.entityId, PHARMACY_ENTITY_ID),
        gte(vendorPurchasesTable.invoiceDate, from),
        lte(vendorPurchasesTable.invoiceDate, to),
      ));
    let itcCgst = 0, itcSgst = 0, itcIgst = 0;
    for (const p of purchases) {
      itcCgst += parseFloat(p.cgstAmount || "0");
      itcSgst += parseFloat(p.sgstAmount || "0");
      itcIgst += parseFloat(p.igstAmount || "0");
    }

    const payload = {
      gstin,
      ret_period: period,
      sup_details: {
        // 3.1(a) Outward taxable supplies (other than zero-rated, nil-rated, exempted)
        osup_det: {
          txval: r2(osupTaxable), iamt: r2(osupIgst),
          camt: r2(osupCgst), samt: r2(osupSgst), csamt: 0,
        },
        // 3.1(b) Outward zero-rated
        osup_zero: { txval: 0, iamt: 0, csamt: 0 },
        // 3.1(c) Other outward supplies (Nil rated, exempted)
        osup_nil_exmp: { txval: 0 },
        // 3.1(d) Inward supplies liable to reverse charge
        isup_rev: { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 },
        // 3.1(e) Non-GST outward supplies
        osup_nongst: { txval: 0 },
      },
      // 4. Eligible ITC
      itc_elg: {
        itc_avl: [
          // 4.A.5 All other ITC
          { ty: "OTH", iamt: r2(itcIgst), camt: r2(itcCgst), samt: r2(itcSgst), csamt: 0 },
        ],
        itc_rev: [],
        itc_net: { iamt: r2(itcIgst), camt: r2(itcCgst), samt: r2(itcSgst), csamt: 0 },
        itc_inelg: [],
      },
      // 5. Exempt, nil and Non-GST inward supplies
      inward_sup: { isup_details: [] },
      // Tax payable summary (informational)
      tax_payable: {
        net_iamt: r2(Math.max(0, osupIgst - itcIgst)),
        net_camt: r2(Math.max(0, osupCgst - itcCgst)),
        net_samt: r2(Math.max(0, osupSgst - itcSgst)),
        net_csamt: 0,
      },
    };

    if (fmt === "csv") {
      let csv = "Section,Description,Taxable Value,Integrated Tax,Central Tax,State Tax,Cess\n";
      csv += `3.1(a),Outward taxable supplies (other than zero/nil/exempted),${r2(osupTaxable).toFixed(2)},${r2(osupIgst).toFixed(2)},${r2(osupCgst).toFixed(2)},${r2(osupSgst).toFixed(2)},0.00\n`;
      csv += `3.1(b),Outward zero-rated supplies,0.00,0.00,0.00,0.00,0.00\n`;
      csv += `3.1(c),Other outward (nil/exempted),0.00,0.00,0.00,0.00,0.00\n`;
      csv += `3.1(d),Inward liable to reverse charge,0.00,0.00,0.00,0.00,0.00\n`;
      csv += `3.1(e),Non-GST outward supplies,0.00,0.00,0.00,0.00,0.00\n`;
      csv += `4.A.5,Eligible ITC - All other ITC,,${r2(itcIgst).toFixed(2)},${r2(itcCgst).toFixed(2)},${r2(itcSgst).toFixed(2)},0.00\n`;
      csv += `Net,Tax payable after ITC,,${payload.tax_payable.net_iamt.toFixed(2)},${payload.tax_payable.net_camt.toFixed(2)},${payload.tax_payable.net_samt.toFixed(2)},0.00\n`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="GSTR3B_${period}.csv"`);
      return res.send(csv);
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="GSTR3B_${gstin}_${period}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    req.log.error({ err }, "Failed GSTR-3B export");
    res.status(500).json({ error: "Failed GSTR-3B export" });
  }
});

// Lightweight summary for the GSTR-3B UI tab
router.get("/pharmacy/gstr3b/summary", async (req, res) => {
  try {
    const { period, from, to } = resolvePeriod(req);
    const entity = await getFilingEntity();

    const sales = await db.select().from(pharmacySalesTable)
      .where(and(
        eq(pharmacySalesTable.entityId, PHARMACY_ENTITY_ID),
        eq(pharmacySalesTable.billStatus, "final"),
        gte(pharmacySalesTable.billDate, from),
        lte(pharmacySalesTable.billDate, to),
      ));
    const purchases = await db.select().from(vendorPurchasesTable)
      .where(and(
        eq(vendorPurchasesTable.entityId, PHARMACY_ENTITY_ID),
        gte(vendorPurchasesTable.invoiceDate, from),
        lte(vendorPurchasesTable.invoiceDate, to),
      ));

    const outward = sales.reduce((acc, s) => ({
      taxable: acc.taxable + (parseFloat(s.subtotal || "0") - parseFloat(s.discount || "0")),
      cgst: acc.cgst + parseFloat(s.cgstAmount || "0"),
      sgst: acc.sgst + parseFloat(s.sgstAmount || "0"),
      igst: acc.igst + parseFloat(s.igstAmount || "0"),
      bills: acc.bills + 1,
    }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, bills: 0 });

    const itc = purchases.reduce((acc, p) => ({
      taxable: acc.taxable + parseFloat(p.subtotal || "0") - parseFloat(p.discount || "0"),
      cgst: acc.cgst + parseFloat(p.cgstAmount || "0"),
      sgst: acc.sgst + parseFloat(p.sgstAmount || "0"),
      igst: acc.igst + parseFloat(p.igstAmount || "0"),
      bills: acc.bills + 1,
    }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, bills: 0 });

    res.json({
      period, from, to,
      gstin: entity?.gstin || null,
      entityName: entity?.name || null,
      outward: {
        taxable: r2(outward.taxable),
        cgst: r2(outward.cgst), sgst: r2(outward.sgst), igst: r2(outward.igst),
        totalTax: r2(outward.cgst + outward.sgst + outward.igst),
        bills: outward.bills,
      },
      itc: {
        taxable: r2(itc.taxable),
        cgst: r2(itc.cgst), sgst: r2(itc.sgst), igst: r2(itc.igst),
        totalItc: r2(itc.cgst + itc.sgst + itc.igst),
        bills: itc.bills,
      },
      netPayable: {
        cgst: r2(Math.max(0, outward.cgst - itc.cgst)),
        sgst: r2(Math.max(0, outward.sgst - itc.sgst)),
        igst: r2(Math.max(0, outward.igst - itc.igst)),
        total: r2(Math.max(0, outward.cgst - itc.cgst) + Math.max(0, outward.sgst - itc.sgst) + Math.max(0, outward.igst - itc.igst)),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed GSTR-3B summary");
    res.status(500).json({ error: "Failed GSTR-3B summary" });
  }
});

export default router;
