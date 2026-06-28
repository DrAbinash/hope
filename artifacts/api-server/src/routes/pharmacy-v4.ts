import { Router } from "express";
import { db } from "@workspace/db";
import { sql, eq, and, gte, lte, lt, desc, or, ne } from "drizzle-orm";
import { pharmacySalesTable, medicinesTable, medicineBatchesTable, patientsTable, vendorsTable } from "@workspace/db";

const router = Router();

function eid(req: any): number { return req.session.entityId ?? 1; }
function uid(req: any): number | null { return req.session.userId ?? null; }
function uname(req: any): string { return req.session.username ?? "system"; }
function today(): string { return new Date().toISOString().slice(0, 10); }
function todayTs(): string { return new Date().toISOString(); }

// ── helpers ─────────────────────────────────────────────────────────────
function seqNo(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}
function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!roles.includes(req.session.role ?? "")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

// ════════════════════════════════════════════════════════════════════════
// FEATURE 1 — PEDIATRIC DOSE SAFETY
// ════════════════════════════════════════════════════════════════════════

// List pediatric dose master records
router.get("/pharmacy/pediatric-doses", async (req, res) => {
  try {
    const entityId = eid(req);
    const rows = await db.execute(sql`
      SELECT p.*, m.name AS medicine_name, m.generic_name, m.formulation
      FROM pediatric_dose_master p
      JOIN medicines m ON m.id = p.medicine_id
      WHERE p.entity_id = ${entityId} AND p.is_active = true
      ORDER BY m.name
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/pediatric-doses", async (req, res) => {
  try {
    const entityId = eid(req);
    const { medicine_id, generic_name, age_group, min_age_months, max_age_months,
      min_weight_kg, max_weight_kg, mg_per_kg_per_day, max_single_dose_mg,
      max_daily_dose_mg, min_single_dose_mg, frequency_max, safe_formulations,
      unsafe_below_age_months, warning_note } = req.body;
    const r = await db.execute(sql`
      INSERT INTO pediatric_dose_master
        (entity_id, medicine_id, generic_name, age_group, min_age_months, max_age_months,
         min_weight_kg, max_weight_kg, mg_per_kg_per_day, max_single_dose_mg, max_daily_dose_mg,
         min_single_dose_mg, frequency_max, safe_formulations, unsafe_below_age_months,
         warning_note, created_by)
      VALUES
        (${entityId}, ${medicine_id}, ${generic_name ?? null}, ${age_group ?? "all"},
         ${min_age_months ?? 0}, ${max_age_months ?? 216},
         ${min_weight_kg ?? null}, ${max_weight_kg ?? null},
         ${mg_per_kg_per_day}, ${max_single_dose_mg ?? null}, ${max_daily_dose_mg ?? null},
         ${min_single_dose_mg ?? null}, ${frequency_max ?? null},
         ${safe_formulations ? JSON.stringify(safe_formulations) : null}::jsonb,
         ${unsafe_below_age_months ?? null}, ${warning_note ?? null}, ${uid(req)})
      RETURNING *
    `);
    return res.json(r.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.put("/pharmacy/pediatric-doses/:id", async (req, res) => {
  try {
    const entityId = eid(req);
    const { mg_per_kg_per_day, max_single_dose_mg, max_daily_dose_mg,
      min_single_dose_mg, frequency_max, warning_note, is_active } = req.body;
    await db.execute(sql`
      UPDATE pediatric_dose_master SET
        mg_per_kg_per_day = COALESCE(${mg_per_kg_per_day ?? null}, mg_per_kg_per_day),
        max_single_dose_mg = COALESCE(${max_single_dose_mg ?? null}, max_single_dose_mg),
        max_daily_dose_mg = COALESCE(${max_daily_dose_mg ?? null}, max_daily_dose_mg),
        min_single_dose_mg = COALESCE(${min_single_dose_mg ?? null}, min_single_dose_mg),
        frequency_max = COALESCE(${frequency_max ?? null}, frequency_max),
        warning_note = COALESCE(${warning_note ?? null}, warning_note),
        is_active = COALESCE(${is_active ?? null}, is_active),
        updated_at = now()
      WHERE id = ${req.params.id} AND entity_id = ${entityId}
    `);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Dose safety check — returns green/yellow/red + recommended dose
router.post("/pharmacy/pediatric-doses/check", async (req, res) => {
  try {
    const entityId = eid(req);
    const { medicine_id, weight_kg, age_months, dose_mg, frequency_per_day, formulation } = req.body;
    if (!medicine_id || !weight_kg) return res.json({ status: "skipped", message: "Insufficient data" });

    const rules = await db.execute(sql`
      SELECT * FROM pediatric_dose_master
      WHERE entity_id = ${entityId} AND medicine_id = ${medicine_id}
        AND is_active = true
        AND (min_age_months IS NULL OR ${age_months ?? 0} >= min_age_months)
        AND (max_age_months IS NULL OR ${age_months ?? 0} <= max_age_months)
        AND (min_weight_kg IS NULL OR ${weight_kg} >= min_weight_kg)
        AND (max_weight_kg IS NULL OR ${weight_kg} <= max_weight_kg)
      LIMIT 1
    `);

    if (!rules.rows.length) return res.json({ status: "no_rule", message: "No pediatric rule found for this medicine" });

    const rule: any = rules.rows[0];
    const wt = Number(weight_kg);
    const rec_daily = wt * Number(rule.mg_per_kg_per_day);
    const freq = Number(frequency_per_day ?? 3);
    const rec_single = rule.max_single_dose_mg
      ? Math.min(rec_daily / freq, Number(rule.max_single_dose_mg))
      : rec_daily / freq;
    const max_daily = rule.max_daily_dose_mg ? Math.min(rec_daily, Number(rule.max_daily_dose_mg)) : rec_daily;
    const min_single = rule.min_single_dose_mg ? Number(rule.min_single_dose_mg) : rec_single * 0.5;

    // Rounding suggestion (nearest 0.5)
    const rounded_low = Math.floor(rec_single * 2) / 2;
    const rounded_high = Math.ceil(rec_single * 2) / 2;

    const age_unsafe = rule.unsafe_below_age_months && (age_months ?? 999) < Number(rule.unsafe_below_age_months);

    let status: "green" | "yellow" | "red" = "green";
    const warnings: string[] = [];

    if (age_unsafe) { status = "red"; warnings.push(`This medicine is unsafe for children below ${rule.unsafe_below_age_months} months`); }

    if (dose_mg) {
      const d = Number(dose_mg);
      const daily_total = d * freq;
      const over_single = d > rec_single * 1.5;
      const dangerous_over = d > rec_single * 2;
      const over_daily = daily_total > max_daily * 1.1;

      if (dangerous_over) { status = "red"; warnings.push(`Dose ${d}mg exceeds recommended max single dose ${rec_single.toFixed(2)}mg by more than 100% — DANGEROUS OVERDOSE`); }
      else if (over_single) { if (status !== "red") status = "yellow"; warnings.push(`Dose ${d}mg exceeds recommended single dose ${rec_single.toFixed(2)}mg`); }
      else if (d < min_single) { if (status !== "red") status = "yellow"; warnings.push(`Dose ${d}mg is below minimum recommended ${min_single.toFixed(2)}mg`); }

      if (over_daily) { if (status !== "red") status = "yellow"; warnings.push(`Daily total ${daily_total.toFixed(2)}mg exceeds max daily dose ${max_daily.toFixed(2)}mg`); }

      if (rule.frequency_max && freq > Number(rule.frequency_max)) {
        if (status !== "red") status = "yellow";
        warnings.push(`Frequency ${freq}/day exceeds max allowed ${rule.frequency_max}/day`);
      }
    }

    return res.json({
      status,
      weight_kg: wt,
      recommended_single_dose_mg: Math.round(rec_single * 100) / 100,
      recommended_daily_dose_mg: Math.round(max_daily * 100) / 100,
      min_single_dose_mg: Math.round(min_single * 100) / 100,
      rounding_suggestion: { low: rounded_low, high: rounded_high },
      warnings,
      rule_note: rule.warning_note,
      requires_override: status === "red"
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Save override audit
router.post("/pharmacy/pediatric-doses/override", async (req, res) => {
  try {
    const entityId = eid(req);
    const { medicine_id, patient_id, sale_id, prescribed_dose_mg, calculated_max_mg, override_reason } = req.body;
    const over_pct = calculated_max_mg
      ? ((Number(prescribed_dose_mg) - Number(calculated_max_mg)) / Number(calculated_max_mg) * 100)
      : 0;
    await db.execute(sql`
      INSERT INTO pediatric_dose_overrides
        (entity_id, medicine_id, patient_id, sale_id, prescribed_dose_mg, calculated_max_mg,
         override_percent, risk_level, override_reason, overridden_by, overridden_by_name, overridden_by_role)
      VALUES
        (${entityId}, ${medicine_id}, ${patient_id ?? null}, ${sale_id ?? null},
         ${prescribed_dose_mg}, ${calculated_max_mg ?? null}, ${over_pct},
         ${over_pct > 100 ? "critical" : "high"},
         ${override_reason}, ${uid(req)}, ${uname(req)}, ${req.session.role ?? null})
    `);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.get("/pharmacy/pediatric-doses/overrides", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT o.*, m.name AS medicine_name, p.name AS patient_name
      FROM pediatric_dose_overrides o
      LEFT JOIN medicines m ON m.id = o.medicine_id
      LEFT JOIN patients p ON p.id = o.patient_id
      WHERE o.entity_id = ${eid(req)}
      ORDER BY o.created_at DESC LIMIT 100
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// FEATURE 2 — TPA / INSURANCE PHARMACY BILLING
// ════════════════════════════════════════════════════════════════════════

router.get("/pharmacy/tpa-claims", async (req, res) => {
  try {
    const entityId = eid(req);
    const { status, from_date, to_date, payer_type } = req.query as any;
    let where = `c.entity_id = ${entityId}`;
    if (status) where += ` AND c.approval_status = '${status}'`;
    if (payer_type) where += ` AND c.payer_type = '${payer_type}'`;
    if (from_date) where += ` AND c.created_at::date >= '${from_date}'`;
    if (to_date) where += ` AND c.created_at::date <= '${to_date}'`;
    const rows = await db.execute(sql.raw(`
      SELECT c.*, p.name AS patient_name, p.phone AS patient_phone,
             s.bill_no, s.total_amount AS sale_total
      FROM pharmacy_tpa_claims c
      LEFT JOIN patients p ON p.id = c.patient_id
      LEFT JOIN pharmacy_sales s ON s.id = c.sale_id
      WHERE ${where}
      ORDER BY c.created_at DESC LIMIT 200
    `));
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.get("/pharmacy/tpa-claims/:id", async (req, res) => {
  try {
    const row = await db.execute(sql`
      SELECT c.*, p.name AS patient_name,
             json_agg(i.*) AS items
      FROM pharmacy_tpa_claims c
      LEFT JOIN patients p ON p.id = c.patient_id
      LEFT JOIN pharmacy_tpa_claim_items i ON i.claim_id = c.id
      WHERE c.id = ${req.params.id} AND c.entity_id = ${eid(req)}
      GROUP BY c.id, p.name
    `);
    if (!row.rows.length) return res.status(404).json({ error: "Not found" });
    return res.json(row.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/tpa-claims", async (req, res) => {
  try {
    const entityId = eid(req);
    const { patient_id, sale_id, ipd_admission_id, payer_type, tpa_provider_name,
      policy_no, preauth_ref, total_amount, insurance_payable, patient_payable,
      items, remarks } = req.body;
    const claim_no = seqNo("TPA");
    await db.execute(sql`BEGIN`);
    const c = await db.execute(sql`
      INSERT INTO pharmacy_tpa_claims
        (entity_id, claim_no, sale_id, patient_id, ipd_admission_id, payer_type,
         tpa_provider_name, policy_no, preauth_ref, total_amount, insurance_payable,
         patient_payable, remarks)
      VALUES
        (${entityId}, ${claim_no}, ${sale_id ?? null}, ${patient_id}, ${ipd_admission_id ?? null},
         ${payer_type ?? "tpa"}, ${tpa_provider_name ?? null}, ${policy_no ?? null},
         ${preauth_ref ?? null}, ${total_amount}, ${insurance_payable ?? 0},
         ${patient_payable ?? 0}, ${remarks ?? null})
      RETURNING *
    `);
    const claimId = (c.rows[0] as any).id;
    if (Array.isArray(items) && items.length) {
      for (const it of items) {
        await db.execute(sql`
          INSERT INTO pharmacy_tpa_claim_items
            (claim_id, medicine_id, medicine_name, quantity, rate, amount,
             payability, insurance_amount, patient_amount, non_payable_reason)
          VALUES
            (${claimId}, ${it.medicine_id}, ${it.medicine_name}, ${it.quantity},
             ${it.rate}, ${it.amount}, ${it.payability ?? "payable"},
             ${it.insurance_amount ?? 0}, ${it.patient_amount ?? 0},
             ${it.non_payable_reason ?? null})
        `);
      }
    }
    await db.execute(sql`COMMIT`);
    return res.json(c.rows[0]);
  } catch (e: any) { await db.execute(sql`ROLLBACK`); return res.status(500).json({ error: e.message }); }
});

router.patch("/pharmacy/tpa-claims/:id/approve", async (req, res) => {
  try {
    const { approved_amount, rejection_reason, status } = req.body;
    await db.execute(sql`
      UPDATE pharmacy_tpa_claims SET
        approval_status = ${status ?? "approved"},
        approved_amount = ${approved_amount ?? null},
        rejected_amount = CASE WHEN ${status ?? "approved"} = 'rejected'
          THEN total_amount ELSE (total_amount - COALESCE(${approved_amount ?? null}, total_amount)) END,
        rejection_reason = ${rejection_reason ?? null},
        approved_by = ${uid(req)},
        approved_at = now(),
        updated_at = now()
      WHERE id = ${req.params.id} AND entity_id = ${eid(req)}
    `);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.get("/pharmacy/tpa-reports/outstanding", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT tpa_provider_name,
        count(*) AS total_claims,
        sum(total_amount) AS total_billed,
        sum(CASE WHEN approval_status = 'pending' THEN insurance_payable ELSE 0 END) AS pending_amount,
        sum(CASE WHEN approval_status = 'approved' AND settled_at IS NULL THEN approved_amount ELSE 0 END) AS approved_not_settled,
        sum(CASE WHEN approval_status = 'rejected' THEN rejected_amount ELSE 0 END) AS rejected_amount
      FROM pharmacy_tpa_claims
      WHERE entity_id = ${eid(req)}
      GROUP BY tpa_provider_name
      ORDER BY pending_amount DESC NULLS LAST
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// FEATURE 3 — FRAUD DETECTION ENGINE
// ════════════════════════════════════════════════════════════════════════

router.get("/pharmacy/fraud-events", requireRole(["admin"]), async (req, res) => {
  try {
    const { risk_level, event_type, from_date, to_date, reviewed } = req.query as any;
    let where = `entity_id = ${eid(req)}`;
    if (risk_level) where += ` AND risk_level = '${risk_level}'`;
    if (event_type) where += ` AND event_type = '${event_type}'`;
    if (from_date) where += ` AND created_at::date >= '${from_date}'`;
    if (to_date) where += ` AND created_at::date <= '${to_date}'`;
    if (reviewed === "false") where += ` AND is_reviewed = false`;
    const rows = await db.execute(sql.raw(`
      SELECT * FROM pharmacy_fraud_events WHERE ${where}
      ORDER BY created_at DESC LIMIT 500
    `));
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.patch("/pharmacy/fraud-events/:id/review", requireRole(["admin"]), async (req, res) => {
  try {
    await db.execute(sql`
      UPDATE pharmacy_fraud_events SET
        is_reviewed = true,
        reviewed_by = ${uid(req)},
        reviewed_by_name = ${uname(req)},
        reviewed_at = now(),
        review_notes = ${req.body.review_notes ?? null}
      WHERE id = ${req.params.id} AND entity_id = ${eid(req)}
    `);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Run anomaly scan — detects fraud patterns in last N days
router.post("/pharmacy/fraud-events/scan", requireRole(["admin"]), async (req, res) => {
  try {
    const entityId = eid(req);
    const days = Number(req.body.days ?? 1);
    const since = new Date(); since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();
    let inserted = 0;

    // Pattern 1: Bills with discount > 30%
    const highDisc = await db.execute(sql`
      SELECT id, bill_no, patient_id, discount, total_amount, finalized_by
      FROM pharmacy_sales
      WHERE entity_id = ${entityId} AND created_at >= ${sinceStr}
        AND discount > 0 AND total_amount > 0
        AND (discount / (total_amount + discount)) > 0.3
    `);
    for (const r of highDisc.rows as any[]) {
      await db.execute(sql`
        INSERT INTO pharmacy_fraud_events
          (entity_id, event_type, risk_level, risk_score, title, description,
           sale_id, bill_no, patient_id, amount)
        VALUES
          (${entityId}, 'high_discount', 'medium', 55,
           'High discount bill',
           ${'Bill ' + r.bill_no + ' has >30% discount. Amount: ₹' + r.total_amount},
           ${r.id}, ${r.bill_no}, ${r.patient_id ?? null}, ${r.discount})
        ON CONFLICT DO NOTHING
      `).catch(() => {});
      inserted++;
    }

    // Pattern 2: Midnight billing (11pm–5am)
    const midnight = await db.execute(sql`
      SELECT id, bill_no, patient_id, total_amount, finalized_by
      FROM pharmacy_sales
      WHERE entity_id = ${entityId} AND created_at >= ${sinceStr}
        AND EXTRACT(HOUR FROM created_at) BETWEEN 23 AND 24
           OR EXTRACT(HOUR FROM created_at) BETWEEN 0 AND 4
    `);
    for (const r of midnight.rows as any[]) {
      await db.execute(sql`
        INSERT INTO pharmacy_fraud_events
          (entity_id, event_type, risk_level, risk_score, title, description, sale_id, bill_no, patient_id, amount)
        VALUES
          (${entityId}, 'midnight_billing', 'medium', 45,
           'Unusual hour billing', ${'Bill ' + r.bill_no + ' created at unusual hour. ₹' + r.total_amount},
           ${r.id}, ${r.bill_no}, ${r.patient_id ?? null}, ${r.total_amount})
        ON CONFLICT DO NOTHING
      `).catch(() => {});
      inserted++;
    }

    // Pattern 3: Negative margin — sale_rate < purchase_rate
    const negMargin = await db.execute(sql`
      SELECT s.id, s.bill_no, s.patient_id, s.total_amount
      FROM pharmacy_sales s
      WHERE s.entity_id = ${entityId} AND s.created_at >= ${sinceStr}
        AND s.total_amount < s.subtotal * 0.7
    `);
    for (const r of negMargin.rows as any[]) {
      await db.execute(sql`
        INSERT INTO pharmacy_fraud_events
          (entity_id, event_type, risk_level, risk_score, title, description, sale_id, bill_no, patient_id, amount)
        VALUES
          (${entityId}, 'negative_margin', 'high', 75,
           'Negative/low margin sale', ${'Bill ' + r.bill_no + ' sold far below cost. ₹' + r.total_amount},
           ${r.id}, ${r.bill_no}, ${r.patient_id ?? null}, ${r.total_amount})
        ON CONFLICT DO NOTHING
      `).catch(() => {});
      inserted++;
    }

    return res.json({ ok: true, patterns_scanned: 3, events_inserted: inserted });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.get("/pharmacy/fraud-events/summary", requireRole(["admin"]), async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE risk_level = 'high' AND NOT is_reviewed) AS high_unreviewed,
        count(*) FILTER (WHERE risk_level = 'medium' AND NOT is_reviewed) AS medium_unreviewed,
        count(*) FILTER (WHERE risk_level = 'low' AND NOT is_reviewed) AS low_unreviewed,
        count(*) FILTER (WHERE is_reviewed) AS reviewed_total,
        count(DISTINCT event_type) AS distinct_patterns,
        sum(amount) FILTER (WHERE risk_level = 'high') AS high_risk_amount
      FROM pharmacy_fraud_events WHERE entity_id = ${eid(req)}
    `);
    return res.json(rows.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// FEATURE 4 — ENHANCED PATIENT RETURNS
// ════════════════════════════════════════════════════════════════════════

router.get("/pharmacy/enhanced-returns", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT r.*, p.name AS patient_name, s.bill_no AS original_bill_no
      FROM enhanced_pharmacy_returns r
      LEFT JOIN patients p ON p.id = r.patient_id
      LEFT JOIN pharmacy_sales s ON s.id = r.original_sale_id
      WHERE r.entity_id = ${eid(req)}
      ORDER BY r.created_at DESC LIMIT 200
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/enhanced-returns", async (req, res) => {
  try {
    const entityId = eid(req);
    const { original_sale_id, patient_id, return_reason, items,
      total_refund_amount, gst_credit_amount, refund_mode,
      inspection_status, stock_action } = req.body;

    // Validate original sale belongs to entity
    const sale = await db.execute(sql`
      SELECT * FROM pharmacy_sales WHERE id = ${original_sale_id} AND entity_id = ${entityId}
    `);
    if (!sale.rows.length) return res.status(404).json({ error: "Original sale not found" });

    const saleRow: any = sale.rows[0];
    // Check return window (configurable — default 7 days)
    const saleDate = new Date(saleRow.created_at);
    const diffDays = (Date.now() - saleDate.getTime()) / 86400000;
    if (diffDays > 7) return res.status(400).json({ error: `Return window expired (${Math.floor(diffDays)} days old, max 7 days)` });

    const return_no = seqNo("RET");
    await db.execute(sql`BEGIN`);
    const r = await db.execute(sql`
      INSERT INTO enhanced_pharmacy_returns
        (entity_id, return_no, original_sale_id, patient_id, return_date, return_reason,
         items, total_refund_amount, gst_credit_amount, refund_mode, inspection_status,
         stock_action, created_by)
      VALUES
        (${entityId}, ${return_no}, ${original_sale_id}, ${patient_id}, ${today()},
         ${return_reason}, ${JSON.stringify(items ?? [])}::jsonb,
         ${total_refund_amount}, ${gst_credit_amount ?? 0}, ${refund_mode ?? "cash"},
         ${inspection_status ?? "reusable"}, ${stock_action ?? "return_to_stock"}, ${uid(req)})
      RETURNING *
    `);
    await db.execute(sql`COMMIT`);
    return res.json(r.rows[0]);
  } catch (e: any) { await db.execute(sql`ROLLBACK`); return res.status(500).json({ error: e.message }); }
});

router.patch("/pharmacy/enhanced-returns/:id/approve", async (req, res) => {
  try {
    await db.execute(sql`
      UPDATE enhanced_pharmacy_returns SET
        refund_status = 'approved',
        approved_by = ${uid(req)},
        approved_by_name = ${uname(req)},
        approved_at = now()
      WHERE id = ${req.params.id} AND entity_id = ${eid(req)}
    `);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// FEATURE 5 — PATIENT CREDIT LIMIT CONTROL
// ════════════════════════════════════════════════════════════════════════

router.get("/pharmacy/credit-limits", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT cl.*, p.name AS patient_name, p.phone AS patient_phone
      FROM patient_credit_limits cl
      LEFT JOIN patients p ON p.id = cl.patient_id
      WHERE cl.entity_id = ${eid(req)} AND cl.is_active = true
      ORDER BY cl.current_outstanding DESC NULLS LAST
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/credit-limits", async (req, res) => {
  try {
    const entityId = eid(req);
    const { patient_id, patient_type, credit_limit, emergency_override_limit, notes } = req.body;
    const r = await db.execute(sql`
      INSERT INTO patient_credit_limits
        (entity_id, patient_id, patient_type, credit_limit, emergency_override_limit, notes, created_by)
      VALUES
        (${entityId}, ${patient_id ?? null}, ${patient_type ?? "general"},
         ${credit_limit}, ${emergency_override_limit ?? 0}, ${notes ?? null}, ${uid(req)})
      ON CONFLICT DO NOTHING
      RETURNING *
    `);
    return res.json(r.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.put("/pharmacy/credit-limits/:id", async (req, res) => {
  try {
    const { credit_limit, emergency_override_limit, notes } = req.body;
    await db.execute(sql`
      UPDATE patient_credit_limits SET
        credit_limit = COALESCE(${credit_limit ?? null}, credit_limit),
        emergency_override_limit = COALESCE(${emergency_override_limit ?? null}, emergency_override_limit),
        notes = COALESCE(${notes ?? null}, notes),
        updated_at = now()
      WHERE id = ${req.params.id} AND entity_id = ${eid(req)}
    `);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Check credit availability before dispensing
router.post("/pharmacy/credit-limits/check", async (req, res) => {
  try {
    const { patient_id, amount } = req.body;
    const rows = await db.execute(sql`
      SELECT * FROM patient_credit_limits
      WHERE entity_id = ${eid(req)} AND patient_id = ${patient_id} AND is_active = true
      LIMIT 1
    `);
    if (!rows.rows.length) return res.json({ status: "no_limit", message: "No credit limit configured" });
    const cl: any = rows.rows[0];
    const outstanding = Number(cl.current_outstanding);
    const limit = Number(cl.credit_limit);
    const after = outstanding + Number(amount ?? 0);
    const pct = limit > 0 ? (after / limit * 100) : 0;
    let status = "green";
    if (pct >= 100) status = "red";
    else if (pct >= 80) status = "yellow";
    return res.json({
      status, outstanding, limit, after_outstanding: after, utilization_pct: Math.round(pct),
      can_proceed: after <= limit + Number(cl.emergency_override_limit),
      requires_override: after > limit,
      emergency_limit: cl.emergency_override_limit
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.get("/pharmacy/credit-limits/:patientId/transactions", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT * FROM patient_credit_transactions
      WHERE entity_id = ${eid(req)} AND patient_id = ${req.params.patientId}
      ORDER BY created_at DESC LIMIT 100
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.get("/pharmacy/credit-limits/reports/aging", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT cl.*, p.name AS patient_name,
        COALESCE(
          (SELECT sum(amount) FROM patient_credit_transactions
           WHERE patient_id = cl.patient_id AND transaction_type = 'debit'
             AND created_at >= now() - interval '30 days'), 0) AS due_0_30,
        COALESCE(
          (SELECT sum(amount) FROM patient_credit_transactions
           WHERE patient_id = cl.patient_id AND transaction_type = 'debit'
             AND created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days'), 0) AS due_31_60,
        COALESCE(
          (SELECT sum(amount) FROM patient_credit_transactions
           WHERE patient_id = cl.patient_id AND transaction_type = 'debit'
             AND created_at BETWEEN now() - interval '90 days' AND now() - interval '60 days'), 0) AS due_61_90,
        COALESCE(
          (SELECT sum(amount) FROM patient_credit_transactions
           WHERE patient_id = cl.patient_id AND transaction_type = 'debit'
             AND created_at < now() - interval '90 days'), 0) AS due_gt_90
      FROM patient_credit_limits cl
      JOIN patients p ON p.id = cl.patient_id
      WHERE cl.entity_id = ${eid(req)} AND cl.current_outstanding > 0
      ORDER BY cl.current_outstanding DESC
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// FEATURE 6 — VENDOR RATE CONTRACTS
// ════════════════════════════════════════════════════════════════════════

router.get("/pharmacy/rate-contracts", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT c.*, v.name AS vendor_name_resolved,
        (SELECT count(*) FROM vendor_rate_contract_items WHERE contract_id = c.id) AS item_count,
        (SELECT count(*) FROM vendor_contract_violations WHERE contract_id = c.id) AS violations
      FROM vendor_rate_contracts c
      LEFT JOIN vendors v ON v.id = c.vendor_id
      WHERE c.entity_id = ${eid(req)}
      ORDER BY c.valid_to DESC
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/rate-contracts", async (req, res) => {
  try {
    const entityId = eid(req);
    const { vendor_id, vendor_name, valid_from, valid_to, notes, items } = req.body;
    const contract_no = seqNo("RC");
    await db.execute(sql`BEGIN`);
    const c = await db.execute(sql`
      INSERT INTO vendor_rate_contracts
        (entity_id, contract_no, vendor_id, vendor_name, valid_from, valid_to, notes, created_by)
      VALUES
        (${entityId}, ${contract_no}, ${vendor_id}, ${vendor_name},
         ${valid_from}, ${valid_to}, ${notes ?? null}, ${uid(req)})
      RETURNING *
    `);
    const cid = (c.rows[0] as any).id;
    if (Array.isArray(items)) {
      for (const it of items) {
        await db.execute(sql`
          INSERT INTO vendor_rate_contract_items
            (contract_id, medicine_id, medicine_name, agreed_rate, gst_percent, min_order_qty, unit)
          VALUES
            (${cid}, ${it.medicine_id}, ${it.medicine_name}, ${it.agreed_rate},
             ${it.gst_percent ?? 12}, ${it.min_order_qty ?? 1}, ${it.unit ?? null})
        `);
      }
    }
    await db.execute(sql`COMMIT`);
    return res.json(c.rows[0]);
  } catch (e: any) { await db.execute(sql`ROLLBACK`); return res.status(500).json({ error: e.message }); }
});

router.get("/pharmacy/rate-contracts/:id/items", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT i.*, m.name AS medicine_name_resolved, m.purchase_rate AS current_purchase_rate, m.mrp
      FROM vendor_rate_contract_items i
      JOIN vendor_rate_contracts c ON c.id = i.contract_id
      LEFT JOIN medicines m ON m.id = i.medicine_id
      WHERE i.contract_id = ${req.params.id} AND c.entity_id = ${eid(req)}
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Check rate against contract during purchase
router.post("/pharmacy/rate-contracts/check-rate", async (req, res) => {
  try {
    const { vendor_id, medicine_id, invoiced_rate } = req.body;
    const today_str = today();
    const row = await db.execute(sql`
      SELECT i.agreed_rate, c.contract_no, c.valid_to, c.id AS contract_id
      FROM vendor_rate_contract_items i
      JOIN vendor_rate_contracts c ON c.id = i.contract_id
      WHERE c.entity_id = ${eid(req)} AND c.vendor_id = ${vendor_id}
        AND i.medicine_id = ${medicine_id}
        AND c.status = 'active' AND c.valid_from <= ${today_str} AND c.valid_to >= ${today_str}
      LIMIT 1
    `);
    if (!row.rows.length) return res.json({ has_contract: false });
    const r: any = row.rows[0];
    const diff = Number(invoiced_rate) - Number(r.agreed_rate);
    const pct = Number(r.agreed_rate) > 0 ? (diff / Number(r.agreed_rate) * 100) : 0;
    return res.json({
      has_contract: true,
      contract_no: r.contract_no,
      agreed_rate: r.agreed_rate,
      invoiced_rate,
      excess_rate: diff > 0 ? diff : 0,
      excess_pct: Math.round(pct * 100) / 100,
      requires_approval: diff > 0
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/rate-contracts/violations", async (req, res) => {
  try {
    const entityId = eid(req);
    const { contract_id, purchase_id, medicine_id, medicine_name, contracted_rate,
      invoiced_rate, excess_amount, approval_reason } = req.body;
    await db.execute(sql`
      INSERT INTO vendor_contract_violations
        (entity_id, contract_id, purchase_id, medicine_id, medicine_name,
         contracted_rate, invoiced_rate, excess_rate, excess_amount,
         approved_by, approved_by_name, approval_reason)
      VALUES
        (${entityId}, ${contract_id ?? null}, ${purchase_id ?? null}, ${medicine_id ?? null},
         ${medicine_name}, ${contracted_rate}, ${invoiced_rate},
         ${Number(invoiced_rate) - Number(contracted_rate)},
         ${excess_amount ?? 0}, ${uid(req)}, ${uname(req)}, ${approval_reason ?? null})
    `);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.get("/pharmacy/rate-contracts/violations", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT v.*, m.name AS medicine_name_resolved
      FROM vendor_contract_violations v
      LEFT JOIN medicines m ON m.id = v.medicine_id
      WHERE v.entity_id = ${eid(req)}
      ORDER BY v.created_at DESC LIMIT 200
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// FEATURE 7 — GST RECONCILIATION
// ════════════════════════════════════════════════════════════════════════

router.get("/pharmacy/gst-reconciliation", async (req, res) => {
  try {
    const entityId = eid(req);
    const { from_date, to_date } = req.query as any;
    const fd = from_date ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const td = to_date ?? today();

    const [salesGst, purchaseGst, returnsGst] = await Promise.all([
      db.execute(sql`
        SELECT
          sum(cgst_amount) AS cgst, sum(sgst_amount) AS sgst, sum(igst_amount) AS igst,
          sum(total_amount) AS taxable_value, count(*) AS bill_count,
          gst_state_type
        FROM pharmacy_sales
        WHERE entity_id = ${entityId} AND bill_date >= ${fd} AND bill_date <= ${td}
        GROUP BY gst_state_type
      `),
      db.execute(sql`
        SELECT
          COALESCE(sum((items->>'gst_amount')::numeric), 0) AS purchase_gst,
          count(*) AS purchase_count
        FROM purchases
        WHERE entity_id = ${entityId} AND purchase_date >= ${fd} AND purchase_date <= ${td}
      `).catch(() => ({ rows: [{ purchase_gst: 0, purchase_count: 0 }] })),
      db.execute(sql`
        SELECT
          sum(gst_amount) AS return_gst, count(*) AS return_count
        FROM sales_returns
        WHERE entity_id = ${entityId} AND return_date >= ${fd} AND return_date <= ${td}
      `).catch(() => ({ rows: [{ return_gst: 0, return_count: 0 }] }))
    ]);

    const totalOutputGst = salesGst.rows.reduce((s: number, r: any) =>
      s + Number(r.cgst ?? 0) + Number(r.sgst ?? 0) + Number(r.igst ?? 0), 0);
    const purchaseInput = Number((purchaseGst.rows[0] as any)?.purchase_gst ?? 0);
    const returnCredit = Number((returnsGst.rows[0] as any)?.return_gst ?? 0);

    return res.json({
      period: { from: fd, to: td },
      output_gst: { by_state_type: salesGst.rows, total: totalOutputGst },
      input_gst: { purchase_gst: purchaseInput, return_credit: returnCredit, net_input: purchaseInput - returnCredit },
      liability: { gross_liability: totalOutputGst, input_credit: purchaseInput - returnCredit, net_payable: totalOutputGst - (purchaseInput - returnCredit) }
    });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.get("/pharmacy/gst-reconciliation/hsn-summary", async (req, res) => {
  try {
    const entityId = eid(req);
    const { from_date, to_date } = req.query as any;
    const fd = from_date ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const td = to_date ?? today();
    const rows = await db.execute(sql`
      SELECT
        m.hsn_code, m.gst_percent,
        sum((item->>'quantity')::numeric) AS quantity,
        sum((item->>'amount')::numeric) AS taxable_value,
        sum((item->>'amount')::numeric * m.gst_percent / 200) AS cgst,
        sum((item->>'amount')::numeric * m.gst_percent / 200) AS sgst,
        count(DISTINCT s.id) AS invoice_count
      FROM pharmacy_sales s
      CROSS JOIN LATERAL jsonb_array_elements(s.items) AS item
      JOIN medicines m ON m.id = (item->>'medicine_id')::integer
      WHERE s.entity_id = ${entityId} AND s.bill_date >= ${fd} AND s.bill_date <= ${td}
        AND m.hsn_code IS NOT NULL
      GROUP BY m.hsn_code, m.gst_percent
      ORDER BY taxable_value DESC
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// FEATURE 8 — TALLY / ACCOUNTING EXPORT
// ════════════════════════════════════════════════════════════════════════

router.get("/pharmacy/tally-exports", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT * FROM pharmacy_tally_exports WHERE entity_id = ${eid(req)}
      ORDER BY created_at DESC LIMIT 50
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/tally-exports", async (req, res) => {
  try {
    const entityId = eid(req);
    const { export_type, from_date, to_date } = req.body;
    const export_no = seqNo("TALLY");

    // Gather data based on export_type
    let records: any[] = [];
    let vouchers: any[] = [];

    if (export_type === "sales" || export_type === "all") {
      const sales = await db.execute(sql`
        SELECT s.*, p.name AS patient_name
        FROM pharmacy_sales s
        LEFT JOIN patients p ON p.id = s.patient_id
        WHERE s.entity_id = ${entityId} AND s.bill_date >= ${from_date} AND s.bill_date <= ${to_date}
        ORDER BY s.bill_date
      `);
      for (const s of sales.rows as any[]) {
        vouchers.push({
          type: "Sales", date: s.bill_date, narration: `Pharmacy Sale - ${s.bill_no}`,
          debit: [{ ledger: s.payment_mode === "cash" ? "Cash" : "Patient Dues", amount: s.total_amount }],
          credit: [
            { ledger: "Pharmacy Sales A/c", amount: s.subtotal },
            { ledger: "GST Payable", amount: s.gst_amount }
          ]
        });
        records.push(s);
      }
    }

    const r = await db.execute(sql`
      INSERT INTO pharmacy_tally_exports
        (entity_id, export_no, export_type, from_date, to_date, record_count, status, exported_by, exported_at)
      VALUES
        (${entityId}, ${export_no}, ${export_type ?? "sales"}, ${from_date}, ${to_date},
         ${records.length}, 'exported', ${uid(req)}, now())
      RETURNING *
    `);

    return res.json({ export: r.rows[0], vouchers, record_count: records.length });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// FEATURE 9 — STOCK HEATMAP
// ════════════════════════════════════════════════════════════════════════

router.get("/pharmacy/stock-heatmap", async (req, res) => {
  try {
    const entityId = eid(req);
    const { group_by, category, location_id } = req.query as any;
    const todayStr = today();
    const thirtyStr = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const ninetyStr = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    const rows = await db.execute(sql`
      SELECT
        m.id, m.name, m.category, m.rack_location, m.formulation,
        m.stock, m.reorder_level, m.min_stock, m.max_stock,
        m.purchase_rate, m.sale_rate, m.mrp,
        m.lasa_flag, m.high_alert_flag,
        b.expiry_date AS nearest_expiry,
        b.quantity AS batch_qty,
        CASE
          WHEN m.stock = 0 THEN 'red'
          WHEN m.stock <= m.min_stock THEN 'red'
          WHEN m.stock <= m.reorder_level THEN 'yellow'
          WHEN b.expiry_date IS NOT NULL AND b.expiry_date < ${todayStr} THEN 'black'
          WHEN b.expiry_date IS NOT NULL AND b.expiry_date <= ${thirtyStr} THEN 'orange'
          WHEN m.stock > m.max_stock THEN 'blue'
          ELSE 'green'
        END AS heat_status,
        (m.stock * m.purchase_rate) AS stock_value
      FROM medicines m
      LEFT JOIN LATERAL (
        SELECT expiry_date, quantity FROM medicine_batches
        WHERE medicine_id = m.id AND entity_id = ${entityId} AND is_active = true
        ORDER BY expiry_date ASC LIMIT 1
      ) b ON true
      WHERE m.entity_id = ${entityId}
        ${category ? sql.raw(`AND m.category = '${category}'`) : sql.raw('')}
      ORDER BY
        CASE WHEN m.stock = 0 THEN 0
             WHEN b.expiry_date < ${todayStr} THEN 1
             WHEN m.stock <= m.min_stock THEN 2
             WHEN m.stock <= m.reorder_level THEN 3
             ELSE 9 END, m.name
    `);

    // Summary counts per heat status
    const items = rows.rows as any[];
    const summary = {
      red: items.filter(x => x.heat_status === "red").length,
      yellow: items.filter(x => x.heat_status === "yellow").length,
      orange: items.filter(x => x.heat_status === "orange").length,
      green: items.filter(x => x.heat_status === "green").length,
      blue: items.filter(x => x.heat_status === "blue").length,
      black: items.filter(x => x.heat_status === "black").length,
      total_value: items.reduce((s, x) => s + Number(x.stock_value ?? 0), 0)
    };
    return res.json({ summary, items });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// FEATURE 10 — MULTI-MRP BATCH SELECTOR
// ════════════════════════════════════════════════════════════════════════

router.get("/pharmacy/medicines/:id/batches-multi-mrp", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT b.*,
        m.name AS medicine_name, m.generic_name, m.purchase_rate AS default_purchase_rate,
        m.min_margin_percent,
        ((b.mrp - b.purchase_rate) / NULLIF(b.purchase_rate, 0) * 100) AS margin_pct,
        CASE WHEN b.purchase_rate IS NOT NULL AND b.mrp < b.purchase_rate THEN true ELSE false END AS negative_margin,
        CASE WHEN EXISTS(
          SELECT 1 FROM medicine_batches b2
          WHERE b2.medicine_id = b.medicine_id AND b2.entity_id = b.entity_id
            AND b2.mrp > b.mrp AND b2.is_active = true AND b2.quantity > 0
        ) THEN true ELSE false END AS older_mrp_flag
      FROM medicine_batches b
      JOIN medicines m ON m.id = b.medicine_id
      WHERE b.medicine_id = ${req.params.id} AND b.entity_id = ${eid(req)}
        AND b.is_active = true AND b.quantity > 0
      ORDER BY b.mrp DESC, b.expiry_date ASC
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════
// FEATURE 11 — MEDICINE COUNSELLING SLIPS
// ════════════════════════════════════════════════════════════════════════

router.get("/pharmacy/counselling-templates", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT t.*, m.name AS medicine_name, m.formulation, m.generic_name
      FROM medicine_instruction_templates t
      JOIN medicines m ON m.id = t.medicine_id
      WHERE t.entity_id = ${eid(req)} AND t.is_active = true
      ORDER BY m.name
    `);
    return res.json(rows.rows);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/pharmacy/counselling-templates", async (req, res) => {
  try {
    const entityId = eid(req);
    const { medicine_id, timing_english, timing_hindi, storage_english, storage_hindi,
      warnings_english, warnings_hindi, missed_dose_english, missed_dose_hindi,
      food_relation } = req.body;
    const r = await db.execute(sql`
      INSERT INTO medicine_instruction_templates
        (entity_id, medicine_id, timing_english, timing_hindi, storage_english,
         storage_hindi, warnings_english, warnings_hindi, missed_dose_english,
         missed_dose_hindi, food_relation)
      VALUES
        (${entityId}, ${medicine_id}, ${timing_english ?? null}, ${timing_hindi ?? null},
         ${storage_english ?? null}, ${storage_hindi ?? null},
         ${warnings_english ?? null}, ${warnings_hindi ?? null},
         ${missed_dose_english ?? null}, ${missed_dose_hindi ?? null},
         ${food_relation ?? "after_food"})
      RETURNING *
    `);
    return res.json(r.rows[0]);
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.put("/pharmacy/counselling-templates/:id", async (req, res) => {
  try {
    const { timing_english, timing_hindi, storage_english, storage_hindi,
      warnings_english, warnings_hindi, missed_dose_english, missed_dose_hindi,
      food_relation } = req.body;
    await db.execute(sql`
      UPDATE medicine_instruction_templates SET
        timing_english = COALESCE(${timing_english ?? null}, timing_english),
        timing_hindi = COALESCE(${timing_hindi ?? null}, timing_hindi),
        storage_english = COALESCE(${storage_english ?? null}, storage_english),
        storage_hindi = COALESCE(${storage_hindi ?? null}, storage_hindi),
        warnings_english = COALESCE(${warnings_english ?? null}, warnings_english),
        warnings_hindi = COALESCE(${warnings_hindi ?? null}, warnings_hindi),
        missed_dose_english = COALESCE(${missed_dose_english ?? null}, missed_dose_english),
        missed_dose_hindi = COALESCE(${missed_dose_hindi ?? null}, missed_dose_hindi),
        food_relation = COALESCE(${food_relation ?? null}, food_relation)
      WHERE id = ${req.params.id} AND entity_id = ${eid(req)}
    `);
    return res.json({ ok: true });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

// Generate slip for a pharmacy sale (batch of medicines)
router.get("/pharmacy/counselling-slips/:saleId", async (req, res) => {
  try {
    const entityId = eid(req);
    const sale = await db.execute(sql`
      SELECT s.*, p.name AS patient_name, p.age, p.gender
      FROM pharmacy_sales s LEFT JOIN patients p ON p.id = s.patient_id
      WHERE s.id = ${req.params.saleId} AND s.entity_id = ${entityId}
    `);
    if (!sale.rows.length) return res.status(404).json({ error: "Sale not found" });
    const saleRow: any = sale.rows[0];
    const items = saleRow.items ?? [];

    const medIds = items.map((x: any) => x.medicine_id).filter(Boolean);
    const slipData: any[] = [];
    for (const mid of medIds) {
      const t = await db.execute(sql`
        SELECT t.*, m.name, m.formulation, m.generic_name
        FROM medicine_instruction_templates t
        JOIN medicines m ON m.id = t.medicine_id
        WHERE t.entity_id = ${entityId} AND t.medicine_id = ${mid} AND t.is_active = true
        LIMIT 1
      `);
      const item = items.find((x: any) => String(x.medicine_id) === String(mid));
      slipData.push({
        medicine_id: mid,
        medicine_name: item?.medicine_name ?? "Unknown",
        quantity: item?.quantity,
        template: t.rows[0] ?? null
      });
    }
    return res.json({ sale: saleRow, slip_items: slipData });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

export default router;
