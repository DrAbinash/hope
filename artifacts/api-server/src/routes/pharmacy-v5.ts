/**
 * Pharmacy v5 routes — Barcode Scan, PMJAY Claims, Drug Licence Tracker,
 * Consignment Stock, ABC/VED/FSN Analysis, Vendor Schemes, KPI Scorecard.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function eid(req: any): number { return req.session.entityId ?? 1; }
function uid(req: any): number | null { return req.session.userId ?? null; }
function uname(req: any): string { return req.session.username ?? "system"; }
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Not authenticated" });
  next();
}
function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.session.role ?? "")) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

router.use(requireAuth);

// ════════════════════════════════════════════════════════════════════════
// MODULE 1 — BARCODE / QR SCAN-TO-DISPENSE
// ════════════════════════════════════════════════════════════════════════

// Resolve a scanned barcode → returns medicine + active batches
router.get("/pharmacy/barcode/resolve/:code", async (req, res) => {
  try {
    const entityId = eid(req);
    const code = String(req.params.code).trim();
    const med = await db.execute(sql`
      SELECT id, name, generic_name, formulation, strength, mrp, barcode
      FROM medicines
      WHERE entity_id = ${entityId} AND barcode = ${code}
      LIMIT 1
    `);
    if (med.rows.length === 0) {
      await db.execute(sql`
        INSERT INTO barcode_scan_log (entity_id, barcode, scan_type, scanned_by, scanned_by_name, result)
        VALUES (${entityId}, ${code}, 'unknown', ${uid(req)}, ${uname(req)}, 'not_found')
      `);
      return res.status(404).json({ error: "Barcode not found", barcode: code });
    }
    const medicine: any = med.rows[0];
    const batches = await db.execute(sql`
      SELECT id, batch_no, expiry_date, mrp, qty_in_stock
      FROM medicine_batches
      WHERE medicine_id = ${medicine.id}
        AND qty_in_stock > 0
        AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)
      ORDER BY expiry_date ASC NULLS LAST
    `);
    return res.json({ medicine, batches: batches.rows });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Log a scan
router.post("/pharmacy/barcode/log", async (req, res) => {
  try {
    const entityId = eid(req);
    const { barcode, scan_type, medicine_id, batch_id, sale_id, grn_id, result, notes } = req.body;
    await db.execute(sql`
      INSERT INTO barcode_scan_log (entity_id, barcode, scan_type, medicine_id, batch_id, sale_id, grn_id, scanned_by, scanned_by_name, result, notes)
      VALUES (${entityId}, ${barcode}, ${scan_type}, ${medicine_id ?? null}, ${batch_id ?? null}, ${sale_id ?? null}, ${grn_id ?? null}, ${uid(req)}, ${uname(req)}, ${result ?? 'success'}, ${notes ?? null})
    `);
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Recent scan log
router.get("/pharmacy/barcode/log", async (req, res) => {
  try {
    const entityId = eid(req);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await db.execute(sql`
      SELECT b.*, m.name AS medicine_name
      FROM barcode_scan_log b
      LEFT JOIN medicines m ON m.id = b.medicine_id
      WHERE b.entity_id = ${entityId}
      ORDER BY b.created_at DESC
      LIMIT ${limit}
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Assign barcode to medicine
router.put("/pharmacy/barcode/assign/:medicineId", async (req, res) => {
  try {
    const entityId = eid(req);
    const id = Number(req.params.medicineId);
    const { barcode } = req.body;
    if (!barcode) return res.status(400).json({ error: "barcode required" });
    await db.execute(sql`
      UPDATE medicines SET barcode = ${String(barcode).trim()}
      WHERE id = ${id} AND entity_id = ${entityId}
    `);
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// MODULE 5 — PMJAY / AYUSHMAN BHARAT CLAIMS
// ════════════════════════════════════════════════════════════════════════

router.get("/pharmacy/pmjay/packages", async (req, res) => {
  try {
    const entityId = eid(req);
    const search = String(req.query.search || "").trim();
    const rows = await db.execute(sql`
      SELECT * FROM pmjay_packages
      WHERE entity_id = ${entityId} AND is_active = true
        AND (${search} = '' OR package_code ILIKE ${'%' + search + '%'} OR package_name ILIKE ${'%' + search + '%'})
      ORDER BY package_name LIMIT 200
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/pmjay/packages", async (req, res) => {
  try {
    const entityId = eid(req);
    const { package_code, package_name, specialty, package_rate, pre_auth_required } = req.body;
    if (!package_code || !package_name) return res.status(400).json({ error: "package_code and package_name required" });
    const rows = await db.execute(sql`
      INSERT INTO pmjay_packages (entity_id, package_code, package_name, specialty, package_rate, pre_auth_required)
      VALUES (${entityId}, ${package_code}, ${package_name}, ${specialty ?? null}, ${Number(package_rate) || 0}, ${pre_auth_required !== false})
      RETURNING *
    `);
    return res.json(rows.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.get("/pharmacy/pmjay/claims", async (req, res) => {
  try {
    const entityId = eid(req);
    const status = String(req.query.status || "").trim();
    const rows = await db.execute(sql`
      SELECT c.*, p.first_name || ' ' || COALESCE(p.last_name, '') AS patient_name,
             pkg.package_name
      FROM pmjay_claims c
      LEFT JOIN patients p ON p.id = c.patient_id
      LEFT JOIN pmjay_packages pkg ON pkg.id = c.package_id
      WHERE c.entity_id = ${entityId}
        AND (${status} = '' OR c.claim_status = ${status})
      ORDER BY c.created_at DESC
      LIMIT 200
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/pmjay/claims", async (req, res) => {
  try {
    const entityId = eid(req);
    const { patient_id, pmjay_id, family_id, package_id, package_code, package_amount,
            pre_auth_no, admission_date, discharge_date, claim_amount, remarks } = req.body;
    if (!patient_id || !pmjay_id) return res.status(400).json({ error: "patient_id and pmjay_id required" });
    const claim_no = `PMJ-${Date.now()}`;
    const rows = await db.execute(sql`
      INSERT INTO pmjay_claims (entity_id, claim_no, patient_id, pmjay_id, family_id, package_id, package_code, package_amount,
                                pre_auth_no, admission_date, discharge_date, claim_amount, remarks, created_by)
      VALUES (${entityId}, ${claim_no}, ${patient_id}, ${pmjay_id}, ${family_id ?? null}, ${package_id ?? null}, ${package_code ?? null},
              ${Number(package_amount) || 0}, ${pre_auth_no ?? null}, ${admission_date ?? null}, ${discharge_date ?? null},
              ${Number(claim_amount) || 0}, ${remarks ?? null}, ${uid(req)})
      RETURNING *
    `);
    return res.json(rows.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.put("/pharmacy/pmjay/claims/:id", async (req, res) => {
  try {
    const entityId = eid(req);
    const id = Number(req.params.id);
    const { pre_auth_status, pre_auth_amount, claim_status, approved_amount, payment_date, payment_utr, remarks } = req.body;
    const rows = await db.execute(sql`
      UPDATE pmjay_claims SET
        pre_auth_status = COALESCE(${pre_auth_status ?? null}, pre_auth_status),
        pre_auth_amount = COALESCE(${pre_auth_amount != null ? Number(pre_auth_amount) : null}, pre_auth_amount),
        claim_status = COALESCE(${claim_status ?? null}, claim_status),
        approved_amount = COALESCE(${approved_amount != null ? Number(approved_amount) : null}, approved_amount),
        payment_date = COALESCE(${payment_date ?? null}, payment_date),
        payment_utr = COALESCE(${payment_utr ?? null}, payment_utr),
        remarks = COALESCE(${remarks ?? null}, remarks),
        updated_at = NOW()
      WHERE id = ${id} AND entity_id = ${entityId}
      RETURNING *
    `);
    if (rows.rows.length === 0) return res.status(404).json({ error: "Not found" });
    return res.json(rows.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.get("/pharmacy/pmjay/claims/:id/items", async (req, res) => {
  try {
    const entityId = eid(req);
    const id = Number(req.params.id);
    const own = await db.execute(sql`SELECT 1 FROM pmjay_claims WHERE id = ${id} AND entity_id = ${entityId}`);
    if (own.rows.length === 0) return res.status(404).json({ error: "Not found" });
    const rows = await db.execute(sql`
      SELECT * FROM pmjay_claim_items WHERE claim_id = ${id} ORDER BY id
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/pmjay/claims/:id/items", async (req, res) => {
  try {
    const entityId = eid(req);
    const id = Number(req.params.id);
    const own = await db.execute(sql`SELECT 1 FROM pmjay_claims WHERE id = ${id} AND entity_id = ${entityId}`);
    if (own.rows.length === 0) return res.status(404).json({ error: "Not found" });
    const { item_type, item_ref_id, description, amount } = req.body;
    const rows = await db.execute(sql`
      INSERT INTO pmjay_claim_items (claim_id, item_type, item_ref_id, description, amount)
      VALUES (${id}, ${item_type}, ${item_ref_id ?? null}, ${description ?? null}, ${Number(amount) || 0})
      RETURNING *
    `);
    return res.json(rows.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// PMJAY summary dashboard
router.get("/pharmacy/pmjay/summary", async (req, res) => {
  try {
    const entityId = eid(req);
    const rows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE claim_status = 'draft') AS draft_count,
        COUNT(*) FILTER (WHERE claim_status = 'submitted') AS submitted_count,
        COUNT(*) FILTER (WHERE claim_status = 'approved') AS approved_count,
        COUNT(*) FILTER (WHERE claim_status = 'rejected') AS rejected_count,
        COUNT(*) FILTER (WHERE claim_status = 'paid') AS paid_count,
        COALESCE(SUM(claim_amount) FILTER (WHERE claim_status IN ('submitted','approved')), 0) AS pending_amount,
        COALESCE(SUM(approved_amount) FILTER (WHERE claim_status = 'paid'), 0) AS received_amount
      FROM pmjay_claims WHERE entity_id = ${entityId}
    `);
    return res.json(rows.rows[0] || {});
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// MODULE 9 — DRUG LICENCE TRACKER
// ════════════════════════════════════════════════════════════════════════

router.get("/pharmacy/drug-licences", async (req, res) => {
  try {
    const entityId = eid(req);
    const rows = await db.execute(sql`
      SELECT l.*, v.name AS vendor_name,
        CASE
          WHEN l.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN l.expiry_date < CURRENT_DATE + (l.renewal_alert_days || ' days')::INTERVAL THEN 'expiring_soon'
          ELSE 'ok'
        END AS alert_status,
        (l.expiry_date - CURRENT_DATE) AS days_to_expiry
      FROM drug_licences l
      LEFT JOIN vendors v ON v.id = l.vendor_id
      WHERE l.entity_id = ${entityId}
      ORDER BY l.expiry_date ASC
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/drug-licences", async (req, res) => {
  try {
    const entityId = eid(req);
    const { licence_holder_type, vendor_id, licence_type, licence_no, issuing_authority,
            issue_date, expiry_date, renewal_alert_days, document_url, remarks } = req.body;
    if (!licence_holder_type || !licence_type || !licence_no || !expiry_date) {
      return res.status(400).json({ error: "Required: licence_holder_type, licence_type, licence_no, expiry_date" });
    }
    const rows = await db.execute(sql`
      INSERT INTO drug_licences (entity_id, licence_holder_type, vendor_id, licence_type, licence_no, issuing_authority,
                                  issue_date, expiry_date, renewal_alert_days, document_url, remarks)
      VALUES (${entityId}, ${licence_holder_type}, ${vendor_id ?? null}, ${licence_type}, ${licence_no},
              ${issuing_authority ?? null}, ${issue_date ?? null}, ${expiry_date}, ${Number(renewal_alert_days) || 60},
              ${document_url ?? null}, ${remarks ?? null})
      RETURNING *
    `);
    return res.json(rows.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.put("/pharmacy/drug-licences/:id", async (req, res) => {
  try {
    const entityId = eid(req);
    const id = Number(req.params.id);
    const { licence_no, issuing_authority, issue_date, expiry_date, renewal_alert_days, status, document_url, remarks } = req.body;
    const rows = await db.execute(sql`
      UPDATE drug_licences SET
        licence_no = COALESCE(${licence_no ?? null}, licence_no),
        issuing_authority = COALESCE(${issuing_authority ?? null}, issuing_authority),
        issue_date = COALESCE(${issue_date ?? null}, issue_date),
        expiry_date = COALESCE(${expiry_date ?? null}, expiry_date),
        renewal_alert_days = COALESCE(${renewal_alert_days != null ? Number(renewal_alert_days) : null}, renewal_alert_days),
        status = COALESCE(${status ?? null}, status),
        document_url = COALESCE(${document_url ?? null}, document_url),
        remarks = COALESCE(${remarks ?? null}, remarks),
        updated_at = NOW()
      WHERE id = ${id} AND entity_id = ${entityId}
      RETURNING *
    `);
    return res.json(rows.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.delete("/pharmacy/drug-licences/:id", async (req, res) => {
  try {
    const entityId = eid(req);
    const id = Number(req.params.id);
    await db.execute(sql`DELETE FROM drug_licences WHERE id = ${id} AND entity_id = ${entityId}`);
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Licence expiry alerts dashboard
router.get("/pharmacy/drug-licences/alerts", async (req, res) => {
  try {
    const entityId = eid(req);
    const rows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) AS expired,
        COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') AS expiring_30d,
        COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE + INTERVAL '30 days' AND CURRENT_DATE + INTERVAL '60 days') AS expiring_60d,
        COUNT(*) FILTER (WHERE expiry_date > CURRENT_DATE + INTERVAL '60 days') AS ok
      FROM drug_licences WHERE entity_id = ${entityId} AND status = 'active'
    `);
    return res.json(rows.rows[0] || {});
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// MODULE 10 — CONSIGNMENT STOCK
// ════════════════════════════════════════════════════════════════════════

router.get("/pharmacy/consignment", async (req, res) => {
  try {
    const entityId = eid(req);
    const status = String(req.query.status || "").trim();
    const rows = await db.execute(sql`
      SELECT cs.*, v.name AS vendor_name, m.name AS medicine_name, m.formulation,
             (cs.qty_received - cs.qty_consumed - cs.qty_returned) AS qty_balance
      FROM consignment_stock cs
      LEFT JOIN vendors v ON v.id = cs.vendor_id
      LEFT JOIN medicines m ON m.id = cs.medicine_id
      WHERE cs.entity_id = ${entityId}
        AND (${status} = '' OR cs.status = ${status})
      ORDER BY cs.received_date DESC
      LIMIT 300
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/consignment", async (req, res) => {
  try {
    const entityId = eid(req);
    const { vendor_id, medicine_id, batch_no, expiry_date, mrp, rate, qty_received, received_date, notes } = req.body;
    if (!vendor_id || !medicine_id || !batch_no || !qty_received) {
      return res.status(400).json({ error: "Required: vendor_id, medicine_id, batch_no, qty_received" });
    }
    const rows = await db.execute(sql`
      INSERT INTO consignment_stock (entity_id, vendor_id, medicine_id, batch_no, expiry_date, mrp, rate, qty_received, received_date, notes)
      VALUES (${entityId}, ${vendor_id}, ${medicine_id}, ${batch_no}, ${expiry_date ?? null},
              ${Number(mrp) || 0}, ${Number(rate) || 0}, ${Number(qty_received)},
              ${received_date ?? new Date().toISOString().slice(0,10)}, ${notes ?? null})
      RETURNING *
    `);
    return res.json(rows.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Record consumption (when patient is billed for consignment item)
router.post("/pharmacy/consignment/:id/consume", async (req, res) => {
  try {
    const entityId = eid(req);
    const id = Number(req.params.id);
    const { sale_id, patient_id, qty, rate } = req.body;
    const qtyN = Number(qty);
    if (!qtyN || qtyN <= 0) return res.status(400).json({ error: "qty must be > 0" });
    // Check balance (entity-scoped)
    const balRow = await db.execute(sql`
      SELECT qty_received - qty_consumed - qty_returned AS bal FROM consignment_stock WHERE id = ${id} AND entity_id = ${entityId}
    `);
    if (balRow.rows.length === 0) return res.status(404).json({ error: "Not found" });
    const bal = Number((balRow.rows[0] as any)?.bal ?? 0);
    if (bal < qtyN) return res.status(400).json({ error: `Insufficient balance: ${bal}` });
    const rate_eff = Number(rate) || 0;
    await db.execute(sql`
      INSERT INTO consignment_consumption (consignment_stock_id, sale_id, patient_id, qty, rate, amount, consumed_by)
      VALUES (${id}, ${sale_id ?? null}, ${patient_id ?? null}, ${qtyN}, ${rate_eff}, ${rate_eff * qtyN}, ${uid(req)})
    `);
    await db.execute(sql`
      UPDATE consignment_stock SET
        qty_consumed = qty_consumed + ${qtyN},
        status = CASE WHEN (qty_received - qty_consumed - qty_returned - ${qtyN}) <= 0 THEN 'exhausted' ELSE status END
      WHERE id = ${id}
    `);
    return res.json({ success: true, remaining: bal - qtyN });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.get("/pharmacy/consignment/:id/consumption", async (req, res) => {
  try {
    const entityId = eid(req);
    const id = Number(req.params.id);
    const own = await db.execute(sql`SELECT 1 FROM consignment_stock WHERE id = ${id} AND entity_id = ${entityId}`);
    if (own.rows.length === 0) return res.status(404).json({ error: "Not found" });
    const rows = await db.execute(sql`
      SELECT cc.*, p.first_name || ' ' || COALESCE(p.last_name, '') AS patient_name
      FROM consignment_consumption cc
      LEFT JOIN patients p ON p.id = cc.patient_id
      WHERE cc.consignment_stock_id = ${id}
      ORDER BY cc.consumed_at DESC
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Vendor-wise consignment outstanding
router.get("/pharmacy/consignment/outstanding", async (req, res) => {
  try {
    const entityId = eid(req);
    const rows = await db.execute(sql`
      SELECT v.id AS vendor_id, v.name AS vendor_name,
        COUNT(DISTINCT cs.id) AS active_items,
        COALESCE(SUM(cs.qty_received - cs.qty_consumed - cs.qty_returned), 0) AS balance_qty,
        COALESCE(SUM((cs.qty_received - cs.qty_consumed - cs.qty_returned) * cs.rate), 0) AS balance_value,
        COALESCE(SUM(cc.amount) FILTER (WHERE cc.invoice_status = 'pending'), 0) AS uninvoiced_consumption
      FROM consignment_stock cs
      JOIN vendors v ON v.id = cs.vendor_id
      LEFT JOIN consignment_consumption cc ON cc.consignment_stock_id = cs.id
      WHERE cs.entity_id = ${entityId} AND cs.status != 'returned'
      GROUP BY v.id, v.name
      ORDER BY balance_value DESC
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// MODULE 13 — ABC / VED / FSN ANALYSIS
// ════════════════════════════════════════════════════════════════════════

// Run analysis: ABC by consumption value (12 months), VED stays manual, FSN by movement
router.post("/pharmacy/abc-ved-fsn/run", async (req, res) => {
  try {
    const entityId = eid(req);
    const months = Math.max(1, Number(req.body?.months) || 12);
    // Consumption value per medicine
    await db.execute(sql`
      WITH consumption AS (
        SELECT (item->>'medicine_id')::int AS medicine_id,
               COALESCE(SUM(((item->>'qty')::numeric) * ((item->>'rate')::numeric)), 0) AS value,
               COALESCE(SUM((item->>'qty')::numeric), 0) AS qty,
               COUNT(DISTINCT ps.id) AS sale_count
        FROM pharmacy_sales ps
        CROSS JOIN LATERAL jsonb_array_elements(ps.items) AS item
        WHERE ps.entity_id = ${entityId}
          AND ps.created_at >= NOW() - make_interval(months => ${months})
          AND item ? 'medicine_id'
          AND (item->>'medicine_id') ~ '^[0-9]+$'
        GROUP BY (item->>'medicine_id')::int
      ),
      ranked AS (
        SELECT medicine_id, value, qty, sale_count,
               SUM(value) OVER () AS total_value,
               SUM(value) OVER (ORDER BY value DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_value
        FROM consumption
      ),
      classified AS (
        SELECT medicine_id,
          CASE
            WHEN total_value = 0 THEN 'C'
            WHEN running_value / total_value <= 0.70 THEN 'A'
            WHEN running_value / total_value <= 0.90 THEN 'B'
            ELSE 'C'
          END AS abc_class,
          CASE
            WHEN sale_count >= 30 THEN 'F'
            WHEN sale_count >= 5 THEN 'S'
            ELSE 'N'
          END AS fsn_class
        FROM ranked
      )
      UPDATE medicines m SET
        abc_class = c.abc_class,
        fsn_class = c.fsn_class,
        classification_updated_at = NOW()
      FROM classified c
      WHERE m.id = c.medicine_id AND m.entity_id = ${entityId}
    `);
    // Medicines with no consumption → C / N
    await db.execute(sql`
      UPDATE medicines SET
        abc_class = COALESCE(abc_class, 'C'),
        fsn_class = COALESCE(fsn_class, 'N'),
        classification_updated_at = NOW()
      WHERE entity_id = ${entityId} AND classification_updated_at IS NULL
    `);
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.get("/pharmacy/abc-ved-fsn", async (req, res) => {
  try {
    const entityId = eid(req);
    const abc = String(req.query.abc || "").trim();
    const ved = String(req.query.ved || "").trim();
    const fsn = String(req.query.fsn || "").trim();
    const rows = await db.execute(sql`
      SELECT m.id, m.name, m.generic_name, m.formulation, m.strength,
             m.abc_class, m.ved_class, m.fsn_class, m.classification_updated_at,
             COALESCE((SELECT SUM(qty_in_stock) FROM medicine_batches WHERE medicine_id = m.id), 0) AS current_stock
      FROM medicines m
      WHERE m.entity_id = ${entityId}
        AND (${abc} = '' OR m.abc_class = ${abc})
        AND (${ved} = '' OR m.ved_class = ${ved})
        AND (${fsn} = '' OR m.fsn_class = ${fsn})
      ORDER BY m.name
      LIMIT 500
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.put("/pharmacy/abc-ved-fsn/:medicineId", async (req, res) => {
  try {
    const entityId = eid(req);
    const id = Number(req.params.medicineId);
    const { abc_class, ved_class, fsn_class } = req.body;
    await db.execute(sql`
      UPDATE medicines SET
        abc_class = COALESCE(${abc_class ?? null}, abc_class),
        ved_class = COALESCE(${ved_class ?? null}, ved_class),
        fsn_class = COALESCE(${fsn_class ?? null}, fsn_class),
        classification_updated_at = NOW()
      WHERE id = ${id} AND entity_id = ${entityId}
    `);
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Summary matrix
router.get("/pharmacy/abc-ved-fsn/summary", async (req, res) => {
  try {
    const entityId = eid(req);
    const rows = await db.execute(sql`
      SELECT
        COALESCE(abc_class, '?') AS abc_class,
        COALESCE(ved_class, '?') AS ved_class,
        COALESCE(fsn_class, '?') AS fsn_class,
        COUNT(*) AS count
      FROM medicines WHERE entity_id = ${entityId}
      GROUP BY abc_class, ved_class, fsn_class
      ORDER BY abc_class, ved_class, fsn_class
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// MODULE 14 — VENDOR SCHEMES / BONUS TRACKING
// ════════════════════════════════════════════════════════════════════════

router.get("/pharmacy/vendor-schemes", async (req, res) => {
  try {
    const entityId = eid(req);
    const active = String(req.query.active || "");
    const rows = await db.execute(sql`
      SELECT vs.*, v.name AS vendor_name, m.name AS medicine_name,
        CASE WHEN vs.valid_to < CURRENT_DATE THEN true ELSE false END AS is_expired
      FROM vendor_schemes vs
      LEFT JOIN vendors v ON v.id = vs.vendor_id
      LEFT JOIN medicines m ON m.id = vs.medicine_id
      WHERE vs.entity_id = ${entityId}
        AND (${active} = '' OR vs.is_active = ${active === 'true'})
      ORDER BY vs.valid_to DESC
      LIMIT 300
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/vendor-schemes", async (req, res) => {
  try {
    const entityId = eid(req);
    const { vendor_id, medicine_id, scheme_name, scheme_type, buy_qty, free_qty,
            discount_pct, discount_amt, valid_from, valid_to, min_order_value, notes } = req.body;
    if (!vendor_id || !scheme_name || !scheme_type || !valid_from || !valid_to) {
      return res.status(400).json({ error: "Required: vendor_id, scheme_name, scheme_type, valid_from, valid_to" });
    }
    const rows = await db.execute(sql`
      INSERT INTO vendor_schemes (entity_id, vendor_id, medicine_id, scheme_name, scheme_type,
                                   buy_qty, free_qty, discount_pct, discount_amt,
                                   valid_from, valid_to, min_order_value, notes)
      VALUES (${entityId}, ${vendor_id}, ${medicine_id ?? null}, ${scheme_name}, ${scheme_type},
              ${Number(buy_qty) || 0}, ${Number(free_qty) || 0}, ${Number(discount_pct) || 0}, ${Number(discount_amt) || 0},
              ${valid_from}, ${valid_to}, ${Number(min_order_value) || 0}, ${notes ?? null})
      RETURNING *
    `);
    return res.json(rows.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.put("/pharmacy/vendor-schemes/:id", async (req, res) => {
  try {
    const entityId = eid(req);
    const id = Number(req.params.id);
    const { is_active, valid_to, notes } = req.body;
    const rows = await db.execute(sql`
      UPDATE vendor_schemes SET
        is_active = COALESCE(${is_active != null ? Boolean(is_active) : null}, is_active),
        valid_to = COALESCE(${valid_to ?? null}, valid_to),
        notes = COALESCE(${notes ?? null}, notes)
      WHERE id = ${id} AND entity_id = ${entityId}
      RETURNING *
    `);
    return res.json(rows.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Suggest applicable schemes at GRN time
router.get("/pharmacy/vendor-schemes/applicable", async (req, res) => {
  try {
    const entityId = eid(req);
    const vendor_id = Number(req.query.vendor_id);
    const medicine_id = Number(req.query.medicine_id) || null;
    const order_value = Number(req.query.order_value) || 0;
    if (!vendor_id) return res.status(400).json({ error: "vendor_id required" });
    const rows = await db.execute(sql`
      SELECT vs.*, m.name AS medicine_name
      FROM vendor_schemes vs
      LEFT JOIN medicines m ON m.id = vs.medicine_id
      WHERE vs.entity_id = ${entityId}
        AND vs.vendor_id = ${vendor_id}
        AND vs.is_active = true
        AND vs.valid_from <= CURRENT_DATE AND vs.valid_to >= CURRENT_DATE
        AND vs.min_order_value <= ${order_value}
        AND (${medicine_id} IS NULL OR vs.medicine_id IS NULL OR vs.medicine_id = ${medicine_id})
      ORDER BY vs.scheme_type
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Apply scheme to GRN/purchase
router.post("/pharmacy/vendor-schemes/:id/apply", async (req, res) => {
  try {
    const entityId = eid(req);
    const id = Number(req.params.id);
    const own = await db.execute(sql`SELECT 1 FROM vendor_schemes WHERE id = ${id} AND entity_id = ${entityId}`);
    if (own.rows.length === 0) return res.status(404).json({ error: "Not found" });
    const { grn_id, purchase_id, applied_buy_qty, applied_free_qty, applied_discount, benefit_value } = req.body;
    await db.execute(sql`
      INSERT INTO vendor_scheme_applications (scheme_id, grn_id, purchase_id,
        applied_buy_qty, applied_free_qty, applied_discount, benefit_value, applied_by)
      VALUES (${id}, ${grn_id ?? null}, ${purchase_id ?? null},
        ${Number(applied_buy_qty) || 0}, ${Number(applied_free_qty) || 0},
        ${Number(applied_discount) || 0}, ${Number(benefit_value) || 0}, ${uid(req)})
    `);
    return res.json({ success: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Benefits realised report
router.get("/pharmacy/vendor-schemes/benefits", async (req, res) => {
  try {
    const entityId = eid(req);
    const from = String(req.query.from || new Date(Date.now() - 90*86400000).toISOString().slice(0,10));
    const to = String(req.query.to || new Date().toISOString().slice(0,10));
    const rows = await db.execute(sql`
      SELECT v.name AS vendor_name, vs.scheme_name, vs.scheme_type,
        COUNT(vsa.id) AS times_applied,
        COALESCE(SUM(vsa.applied_free_qty), 0) AS total_free_qty,
        COALESCE(SUM(vsa.applied_discount), 0) AS total_discount,
        COALESCE(SUM(vsa.benefit_value), 0) AS total_benefit
      FROM vendor_scheme_applications vsa
      JOIN vendor_schemes vs ON vs.id = vsa.scheme_id
      JOIN vendors v ON v.id = vs.vendor_id
      WHERE vs.entity_id = ${entityId}
        AND vsa.applied_at::DATE BETWEEN ${from} AND ${to}
      GROUP BY v.name, vs.scheme_name, vs.scheme_type
      ORDER BY total_benefit DESC
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// MODULE 18 — PHARMACY KPI SCORECARD
// ════════════════════════════════════════════════════════════════════════

router.get("/pharmacy/kpi-scorecard", async (req, res) => {
  try {
    const entityId = eid(req);
    const days = Math.max(1, Number(req.query.days) || 30);

    // Sales metrics
    const sales = await db.execute(sql`
      SELECT
        COUNT(*) AS sale_count,
        COALESCE(SUM(total_amount), 0) AS total_sales,
        COALESCE(SUM(total_amount) FILTER (WHERE payer_type = 'cash'), 0) AS cash_sales,
        COALESCE(SUM(total_amount) FILTER (WHERE payer_type = 'credit'), 0) AS credit_sales,
        COALESCE(AVG(total_amount), 0) AS avg_ticket_value
      FROM pharmacy_sales
      WHERE entity_id = ${entityId} AND created_at >= NOW() - (${days} || ' days')::INTERVAL
    `);

    // Stock metrics
    const stock = await db.execute(sql`
      SELECT
        COUNT(*) AS total_skus,
        COALESCE(SUM(qty_in_stock * mrp), 0) AS stock_value,
        COUNT(*) FILTER (WHERE qty_in_stock <= 0) AS stockout_skus,
        COUNT(*) FILTER (WHERE expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE + INTERVAL '90 days' AND qty_in_stock > 0) AS near_expiry_skus,
        COUNT(*) FILTER (WHERE expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE AND qty_in_stock > 0) AS expired_skus
      FROM medicine_batches mb
      WHERE EXISTS (SELECT 1 FROM medicines m WHERE m.id = mb.medicine_id AND m.entity_id = ${entityId})
    `);

    // Expiry loss
    const expiryLoss = await db.execute(sql`
      SELECT COALESCE(SUM(qty_in_stock * mrp), 0) AS expired_value
      FROM medicine_batches mb
      WHERE EXISTS (SELECT 1 FROM medicines m WHERE m.id = mb.medicine_id AND m.entity_id = ${entityId})
        AND expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE AND qty_in_stock > 0
    `);

    // GRN turnaround (purchases)
    const grn = await db.execute(sql`
      SELECT COUNT(*) AS grn_count,
        COALESCE(SUM(total_amount), 0) AS purchase_value
      FROM pharmacy_purchases
      WHERE entity_id = ${entityId} AND created_at >= NOW() - (${days} || ' days')::INTERVAL
    `).catch(() => ({ rows: [{ grn_count: 0, purchase_value: 0 }] } as any));

    // Returns rate
    const returns = await db.execute(sql`
      SELECT
        COUNT(*) AS return_count,
        COALESCE(SUM(total_amount), 0) AS return_value
      FROM sales_returns
      WHERE entity_id = ${entityId}
        AND created_at >= NOW() - (${days} || ' days')::INTERVAL
    `).catch(() => ({ rows: [{ return_count: 0, return_value: 0 }] } as any));

    const salesRow: any = sales.rows[0] || {};
    const stockRow: any = stock.rows[0] || {};
    const expiryRow: any = expiryLoss.rows[0] || {};
    const grnRow: any = grn.rows[0] || {};
    const retRow: any = returns.rows[0] || {};

    const totalSales = Number(salesRow.total_sales) || 0;
    const stockValue = Number(stockRow.stock_value) || 0;
    const inventoryTurnover = stockValue > 0 ? (totalSales * (365/days)) / stockValue : 0;

    return res.json({
      period_days: days,
      sales: salesRow,
      stock: stockRow,
      expiry_loss_value: Number(expiryRow.expired_value) || 0,
      grn: grnRow,
      returns: retRow,
      kpis: {
        avg_daily_sales: totalSales / days,
        inventory_turnover_annual: Number(inventoryTurnover.toFixed(2)),
        stockout_pct: stockRow.total_skus ? Number(((Number(stockRow.stockout_skus) / Number(stockRow.total_skus)) * 100).toFixed(2)) : 0,
        expiry_loss_pct: stockValue ? Number(((Number(expiryRow.expired_value) / stockValue) * 100).toFixed(2)) : 0,
        return_rate_pct: totalSales ? Number(((Math.abs(Number(retRow.return_value)) / totalSales) * 100).toFixed(2)) : 0,
        days_of_inventory: totalSales > 0 ? Number(((stockValue / (totalSales / days))).toFixed(1)) : 0,
      }
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// KPI trend (daily sales for sparkline)
router.get("/pharmacy/kpi-scorecard/trend", async (req, res) => {
  try {
    const entityId = eid(req);
    const days = Math.max(1, Math.min(Number(req.query.days) || 30, 180));
    const rows = await db.execute(sql`
      SELECT DATE(created_at) AS day,
        COUNT(*) AS sale_count,
        COALESCE(SUM(total_amount), 0) AS sales_value
      FROM pharmacy_sales
      WHERE entity_id = ${entityId} AND created_at >= NOW() - (${days} || ' days')::INTERVAL
      GROUP BY DATE(created_at)
      ORDER BY day
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

export default router;
