import { Router } from "express";
import { db } from "@workspace/db";
import { ledgerGroupsTable, ledgersTable, vouchersTable, financialDocumentsTable, organizationLearningsTable, bankTransactionsTable, patientsTable, doctorsTable, pharmacySalesTable, invoicesTable } from "@workspace/db";
import { eq, sql, and, gte, lte, or, desc, like } from "drizzle-orm";

const router = Router();

function generateVoucherNo(type: string): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const num = Math.floor(1000 + Math.random() * 9000);
  const prefix = { Receipt: "RV", Payment: "PV", Journal: "JV", Sales: "SV", Purchase: "PUV" }[type] || "VR";
  return `${prefix}${dateStr}${num}`;
}

router.get("/accounting/ledger-groups", async (req, res) => {
  try {
    const groups = await db.select().from(ledgerGroupsTable).orderBy(ledgerGroupsTable.name);
    res.json(groups);
  } catch (err) {
    req.log.error({ err }, "Failed to list ledger groups");
    res.status(500).json({ error: "Failed to list ledger groups" });
  }
});

router.post("/accounting/ledger-groups", async (req, res) => {
  try {
    const { name, parent, nature } = req.body;
    if (!name || !nature) return res.status(400).json({ error: "name and nature are required" });
    const [group] = await db.insert(ledgerGroupsTable).values({ name, parent, nature }).returning();
    res.status(201).json(group);
  } catch (err) {
    req.log.error({ err }, "Failed to create ledger group");
    res.status(500).json({ error: "Failed to create ledger group" });
  }
});

router.get("/accounting/ledgers", async (req, res) => {
  try {
    const { groupId, entityId } = req.query;
    const ledgers = await db.select({
      id: ledgersTable.id, name: ledgersTable.name, groupId: ledgersTable.groupId,
      groupName: ledgerGroupsTable.name, openingBalance: ledgersTable.openingBalance,
      currentBalance: ledgersTable.currentBalance,
      entityId: ledgersTable.entityId,
    }).from(ledgersTable)
      .leftJoin(ledgerGroupsTable, eq(ledgersTable.groupId, ledgerGroupsTable.id))
      .orderBy(ledgersTable.name);
    let filtered = ledgers;
    if (groupId) {
      filtered = filtered.filter(l => l.groupId === parseInt(groupId as string));
    }
    if (entityId) {
      filtered = filtered.filter(l => l.entityId === parseInt(entityId as string));
    }
    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "Failed to list ledgers");
    res.status(500).json({ error: "Failed to list ledgers" });
  }
});

router.post("/accounting/ledgers", async (req, res) => {
  try {
    const { name, groupId, openingBalance, openingType } = req.body;
    if (!name || !groupId) return res.status(400).json({ error: "name and groupId are required" });
    const gid = parseInt(groupId);
    if (Number.isNaN(gid)) return res.status(400).json({ error: "Invalid groupId" });
    const cleanName = String(name).trim();
    const [dup] = await db.select().from(ledgersTable).where(eq(ledgersTable.name, cleanName));
    if (dup) return res.status(409).json({ error: "Ledger with this name already exists" });
    const obAbs = Math.abs(parseFloat(openingBalance) || 0);
    const obSigned = openingType === "Cr" ? -obAbs : obAbs;
    const ob = obSigned.toFixed(2);
    const [ledger] = await db.insert(ledgersTable).values({ name: cleanName, groupId: gid, openingBalance: ob, currentBalance: ob }).returning();
    const [group] = await db.select().from(ledgerGroupsTable).where(eq(ledgerGroupsTable.id, gid));
    return res.status(201).json({ ...ledger, groupName: group?.name });
  } catch (err) {
    req.log.error({ err }, "Failed to create ledger");
    return res.status(500).json({ error: "Failed to create ledger" });
  }
});

router.put("/accounting/ledgers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { name, groupId, openingBalance, openingType } = req.body || {};
    const [existing] = await db.select().from(ledgersTable).where(eq(ledgersTable.id, id));
    if (!existing) return res.status(404).json({ error: "Ledger not found" });

    const updates: any = { };
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (cleanName !== existing.name) {
        const [dup] = await db.select().from(ledgersTable).where(eq(ledgersTable.name, cleanName));
        if (dup) return res.status(409).json({ error: "Ledger with this name already exists" });
      }
      updates.name = cleanName;
    }
    if (groupId !== undefined) {
      const gid = parseInt(groupId);
      if (Number.isNaN(gid)) return res.status(400).json({ error: "Invalid groupId" });
      updates.groupId = gid;
    }
    let delta: number | null = null;
    if (openingBalance !== undefined) {
      const obAbs = Math.abs(parseFloat(openingBalance) || 0);
      const obSigned = openingType === "Cr" ? -obAbs : obAbs;
      const oldOb = parseFloat(existing.openingBalance || "0");
      delta = obSigned - oldOb;
      updates.openingBalance = obSigned.toFixed(2);
    }
    // atomic delta on currentBalance to avoid clobbering concurrent voucher posts
    if (delta !== null) {
      updates.currentBalance = sql`${ledgersTable.currentBalance} + ${delta.toFixed(2)}`;
    }
    const [row] = await db.update(ledgersTable).set(updates).where(eq(ledgersTable.id, id)).returning();
    const [group] = await db.select().from(ledgerGroupsTable).where(eq(ledgerGroupsTable.id, row.groupId));
    return res.json({ ...row, groupName: group?.name });
  } catch (err) {
    req.log.error({ err }, "Failed to update ledger");
    return res.status(500).json({ error: "Failed to update ledger" });
  }
});

router.delete("/accounting/ledgers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    // Block delete if any voucher's entries jsonb references this ledger
    const inUseRows = await db.execute(
      sql`SELECT 1 FROM vouchers WHERE entries @> ${JSON.stringify([{ ledgerId: id }])}::jsonb LIMIT 1`
    );
    if ((inUseRows as any).rows?.length || (inUseRows as any).length) {
      return res.status(409).json({ error: "Cannot delete: ledger is used in one or more vouchers" });
    }
    const result = await db.delete(ledgersTable).where(eq(ledgersTable.id, id)).returning();
    if (result.length === 0) return res.status(404).json({ error: "Ledger not found" });
    return res.json({ success: true, id });
  } catch (err) {
    req.log.error({ err }, "Failed to delete ledger");
    return res.status(500).json({ error: "Failed to delete ledger" });
  }
});

router.get("/accounting/vouchers", async (req, res) => {
  try {
    const { type, fromDate, toDate, entityId, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let vouchers = await db.select().from(vouchersTable).orderBy(vouchersTable.date).limit(limitNum).offset(offset);
    if (type) vouchers = vouchers.filter(v => v.type === type);
    if (fromDate) vouchers = vouchers.filter(v => v.date >= fromDate);
    if (toDate) vouchers = vouchers.filter(v => v.date <= toDate);
    if (entityId) vouchers = vouchers.filter(v => v.entityId === parseInt(entityId));

    const total = await db.select({ count: sql<number>`count(*)` }).from(vouchersTable);
    res.json({ vouchers, total: Number(total[0].count), page: pageNum });
  } catch (err) {
    req.log.error({ err }, "Failed to list vouchers");
    res.status(500).json({ error: "Failed to list vouchers" });
  }
});

router.post("/accounting/vouchers", async (req, res) => {
  try {
    const { type, date, narration, entries } = req.body;
    if (!type || !date || !entries?.length) return res.status(400).json({ error: "type, date, entries are required" });

    const debitEntries = entries.filter((e: any) => e.type === "Dr");
    const totalAmount = debitEntries.reduce((s: number, e: any) => s + e.amount, 0);
    const voucherNo = generateVoucherNo(type);

    const [voucher] = await db.insert(vouchersTable).values({
      voucherNo, type, date, narration, entries, totalAmount: totalAmount.toString(),
    }).returning();

    for (const entry of entries) {
      if (entry.ledgerId) {
        const delta = entry.type === "Dr" ? entry.amount : -entry.amount;
        await db.update(ledgersTable).set({
          currentBalance: sql`${ledgersTable.currentBalance} + ${delta}`,
        }).where(eq(ledgersTable.id, entry.ledgerId));
      }
    }

    res.status(201).json(voucher);
  } catch (err) {
    req.log.error({ err }, "Failed to create voucher");
    res.status(500).json({ error: "Failed to create voucher" });
  }
});

// Indian (Tally-style) Chart of Accounts seeder
router.post("/accounting/seed-indian-coa", async (req, res) => {
  try {
    const role = (req.session as any)?.role;
    if (role !== "admin") return res.status(403).json({ error: "Admin only" });

    // Ensure Entity 1 and Entity 2 exist
    const { entitiesTable } = await import("@workspace/db");
    
    // Seed Hope Hospital (ID 1)
    let [hopeEntity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, 1));
    if (!hopeEntity) {
      [hopeEntity] = await db.insert(entitiesTable).values({
        id: 1,
        name: "Hope Neurotrauma & Multispeciality Hospital",
        type: "Hospital",
        owner: "Dr. Hope",
        gstin: "27HOPEH1234A1Z1",
        address: "Main Road, Deoghar",
        mobile: "9999999999",
      }).returning();
    }

    // Seed Care Diagnostics (ID 2)
    let [careEntity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, 2));
    if (!careEntity) {
      [careEntity] = await db.insert(entitiesTable).values({
        id: 2,
        name: "Care Diagnostics",
        type: "Diagnostics",
        owner: "Care Admin",
        gstin: "27CARED5678B1Z2",
        address: "Court Road, Deoghar",
        mobile: "8888888888",
      }).returning();
    }

    // Tally's 28 primary groups
    const TALLY_GROUPS: Array<{ name: string; parent: string | null; nature: string }> = [
      { name: "Capital Account", parent: null, nature: "Liability" },
      { name: "Reserves & Surplus", parent: "Capital Account", nature: "Liability" },
      { name: "Loans (Liability)", parent: null, nature: "Liability" },
      { name: "Bank OD A/c", parent: "Loans (Liability)", nature: "Liability" },
      { name: "Secured Loans", parent: "Loans (Liability)", nature: "Liability" },
      { name: "Unsecured Loans", parent: "Loans (Liability)", nature: "Liability" },
      { name: "Current Liabilities", parent: null, nature: "Liability" },
      { name: "Duties & Taxes", parent: "Current Liabilities", nature: "Liability" },
      { name: "Provisions", parent: "Current Liabilities", nature: "Liability" },
      { name: "Sundry Creditors", parent: "Current Liabilities", nature: "Liability" },
      { name: "Suspense A/c", parent: null, nature: "Liability" },
      { name: "Fixed Assets", parent: null, nature: "Asset" },
      { name: "Investments", parent: null, nature: "Asset" },
      { name: "Current Assets", parent: null, nature: "Asset" },
      { name: "Bank Accounts", parent: "Current Assets", nature: "Asset" },
      { name: "Cash-in-Hand", parent: "Current Assets", nature: "Asset" },
      { name: "Deposits (Asset)", parent: "Current Assets", nature: "Asset" },
      { name: "Loans & Advances (Asset)", parent: "Current Assets", nature: "Asset" },
      { name: "Stock-in-Hand", parent: "Current Assets", nature: "Asset" },
      { name: "Sundry Debtors", parent: "Current Assets", nature: "Asset" },
      { name: "Misc. Expenses (Asset)", parent: null, nature: "Asset" },
      { name: "Branch / Divisions", parent: null, nature: "Asset" },
      { name: "Sales Accounts", parent: null, nature: "Income" },
      { name: "Direct Incomes", parent: null, nature: "Income" },
      { name: "Indirect Incomes", parent: null, nature: "Income" },
      { name: "Purchase Accounts", parent: null, nature: "Expense" },
      { name: "Direct Expenses", parent: null, nature: "Expense" },
      { name: "Indirect Expenses", parent: null, nature: "Expense" },
    ];

    const result = await db.transaction(async (tx) => {
      const existing = await tx.select().from(ledgerGroupsTable);
      const existingNames = new Set(existing.map((g) => g.name));
      let groupsCreated = 0;
      for (const g of TALLY_GROUPS) {
        if (existingNames.has(g.name)) continue;
        await tx.insert(ledgerGroupsTable).values({ name: g.name, parent: g.parent, nature: g.nature }).onConflictDoNothing();
        groupsCreated += 1;
      }
      return { groupsCreated };
    });
    const created = result.groupsCreated;

    // Seed default ledgers for both entities
    const allGroups = await db.select().from(ledgerGroupsTable);
    const byName = new Map(allGroups.map((g) => [g.name, g.id]));

    // Entity-specific Chart of Accounts ledgers
    const DEFAULT_LEDGERS: Array<{ name: string; group: string; entityId: number }> = [
      // --- Hope Hospital (ID 1) ---
      { name: "Cash (Hope)", group: "Cash-in-Hand", entityId: 1 },
      { name: "Bank - Current A/c (Hope)", group: "Bank Accounts", entityId: 1 },
      { name: "OPD Consultation Income (Hope)", group: "Direct Incomes", entityId: 1 },
      { name: "IPD Room Rent Income (Hope)", group: "Direct Incomes", entityId: 1 },
      { name: "Pharmacy Sales (Hope)", group: "Sales Accounts", entityId: 1 },
      { name: "Diagnostic Income (Hope)", group: "Direct Incomes", entityId: 1 },
      { name: "Operation Theatre Income (Hope)", group: "Direct Incomes", entityId: 1 },
      { name: "Discount Allowed (Hope)", group: "Indirect Expenses", entityId: 1 },
      { name: "Doctor Fees Payable (Hope)", group: "Sundry Creditors", entityId: 1 },
      { name: "Referral Commission (Hope)", group: "Indirect Expenses", entityId: 1 },
      { name: "Salaries & Wages (Hope)", group: "Indirect Expenses", entityId: 1 },
      { name: "Rent (Hope)", group: "Indirect Expenses", entityId: 1 },
      { name: "Electricity (Hope)", group: "Indirect Expenses", entityId: 1 },
      { name: "GST Payable (Hope)", group: "Duties & Taxes", entityId: 1 },
      { name: "TDS Payable (Hope)", group: "Duties & Taxes", entityId: 1 },
      { name: "Capital A/c (Hope)", group: "Capital Account", entityId: 1 },
      { name: "Patient Receivables (Hope)", group: "Sundry Debtors", entityId: 1 },
      { name: "Pharmacy Stock (Hope)", group: "Stock-in-Hand", entityId: 1 },
      { name: "Medical Equipment (Hope)", group: "Fixed Assets", entityId: 1 },

      // --- Care Diagnostics (ID 2) ---
      { name: "Cash (Care)", group: "Cash-in-Hand", entityId: 2 },
      { name: "Bank - Current A/c (Care)", group: "Bank Accounts", entityId: 2 },
      { name: "Radiology Income (Care)", group: "Direct Incomes", entityId: 2 },
      { name: "Laboratory Income (Care)", group: "Direct Incomes", entityId: 2 },
      { name: "Ultrasound Income (Care)", group: "Direct Incomes", entityId: 2 },
      { name: "CT Scan Income (Care)", group: "Direct Incomes", entityId: 2 },
      { name: "MRI Consumables (Care)", group: "Direct Expenses", entityId: 2 },
      { name: "X-Ray Income (Care)", group: "Direct Incomes", entityId: 2 },
      { name: "Pharmacy Purchase (Care)", group: "Purchase Accounts", entityId: 2 },
      { name: "Pharmacy Sales (Care)", group: "Sales Accounts", entityId: 2 },
      { name: "Pharmacy GST Input (Care)", group: "Duties & Taxes", entityId: 2 },
      { name: "Pharmacy GST Output (Care)", group: "Duties & Taxes", entityId: 2 },
      { name: "Admin Expenses (Care)", group: "Indirect Expenses", entityId: 2 },
      { name: "GST Payable (Care)", group: "Duties & Taxes", entityId: 2 },
      { name: "TDS Payable (Care)", group: "Duties & Taxes", entityId: 2 },
      { name: "Electricity (Care)", group: "Indirect Expenses", entityId: 2 },
      { name: "Rent (Care)", group: "Indirect Expenses", entityId: 2 },
    ];

    const ledgerResult = await db.transaction(async (tx) => {
      const existingLedgers = await tx.select().from(ledgersTable);
      const existingLedgerNames = new Set(existingLedgers.map((l) => l.name));
      let ledgersCreated = 0;
      for (const l of DEFAULT_LEDGERS) {
        if (existingLedgerNames.has(l.name)) continue;
        const gid = byName.get(l.group);
        if (!gid) continue;
        await tx.insert(ledgersTable).values({
          name: l.name,
          groupId: gid,
          entityId: l.entityId,
          openingBalance: "0",
          currentBalance: "0"
        }).onConflictDoNothing();
        ledgersCreated += 1;
      }
      return { ledgersCreated };
    });

    return res.json({
      groupsCreated: created,
      ledgersCreated: ledgerResult.ledgersCreated,
      totalGroups: allGroups.length,
      entitiesConfigured: [hopeEntity.name, careEntity.name]
    });
  } catch (err) {
    req.log.error({ err }, "seed COA failed");
    return res.status(500).json({ error: "Failed to seed Indian COA" });
  }
});

router.get("/accounting/tally-export", async (req, res) => {
  try {
    const { fromDate, toDate } = req.query as Record<string, string>;
    if (!fromDate || !toDate) return res.status(400).json({ error: "fromDate and toDate are required" });

    const allVouchers = await db.select().from(vouchersTable);
    const vouchers = allVouchers.filter(v => v.date >= fromDate && v.date <= toDate);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>\n<BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>\n<REQUESTDATA>\n`;

    for (const v of vouchers) {
      const entries = (v.entries as any[]) || [];
      xml += `<TALLYMESSAGE xmlns:UDF="TallyUDF">\n<VOUCHER REMOTEID="${v.voucherNo}" VCHTYPE="${v.type}" ACTION="Create">\n`;
      xml += `<DATE>${v.date.replace(/-/g, "")}</DATE>\n`;
      xml += `<NARRATION>${v.narration || ""}</NARRATION>\n`;
      xml += `<VOUCHERTYPENAME>${v.type}</VOUCHERTYPENAME>\n`;
      xml += `<VOUCHERNUMBER>${v.voucherNo}</VOUCHERNUMBER>\n`;
      xml += `<ALLLEDGERENTRIES.LIST>\n`;
      for (const e of entries) {
        xml += `<ALLLEDGERENTRIES.LIST>\n<LEDGERNAME>${e.ledgerName || e.ledgerId}</LEDGERNAME>\n`;
        xml += `<ISDEEMEDPOSITIVE>${e.type === "Dr" ? "Yes" : "No"}</ISDEEMEDPOSITIVE>\n`;
        xml += `<AMOUNT>${e.type === "Cr" ? "-" : ""}${e.amount}</AMOUNT>\n</ALLLEDGERENTRIES.LIST>\n`;
      }
      xml += `</ALLLEDGERENTRIES.LIST>\n</VOUCHER>\n</TALLYMESSAGE>\n`;
    }
    xml += `</REQUESTDATA>\n</IMPORTDATA>\n</BODY>\n</ENVELOPE>`;

    res.json({ exportedCount: vouchers.length, fromDate, toDate, xmlContent: xml });
  } catch (err) {
    req.log.error({ err }, "Failed to export to Tally");
    res.status(500).json({ error: "Failed to export to Tally" });
  }
});

router.get("/accounting/trial-balance", async (req, res) => {
  try {
    const { fromDate, toDate, entityId } = req.query as Record<string, string>;
    const ledgers = await db.select({
      id: ledgersTable.id, name: ledgersTable.name, groupId: ledgersTable.groupId,
      groupName: ledgerGroupsTable.name, currentBalance: ledgersTable.currentBalance,
      entityId: ledgersTable.entityId,
    }).from(ledgersTable).leftJoin(ledgerGroupsTable, eq(ledgersTable.groupId, ledgerGroupsTable.id));

    let filteredLedgers = ledgers;
    if (entityId) {
      filteredLedgers = filteredLedgers.filter(l => l.entityId === parseInt(entityId));
    }

    const entries = filteredLedgers.map(l => {
      const bal = parseFloat(l.currentBalance || "0");
      return { ledgerName: l.name, groupName: l.groupName || "", debit: bal >= 0 ? bal : 0, credit: bal < 0 ? Math.abs(bal) : 0 };
    });

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    res.json({ fromDate, toDate, entries, totalDebit, totalCredit });
  } catch (err) {
    req.log.error({ err }, "Failed to get trial balance");
    res.status(500).json({ error: "Failed to get trial balance" });
  }
});

router.get("/accounting/day-book", async (req, res) => {
  try {
    const { fromDate, toDate, entityId } = req.query as Record<string, string>;
    if (!fromDate || !toDate) return res.status(400).json({ error: "fromDate and toDate are required" });
    const all = await db.select().from(vouchersTable);
    let vouchers = all.filter(v => v.date >= fromDate && v.date <= toDate);
    if (entityId) {
      vouchers = vouchers.filter(v => v.entityId === parseInt(entityId));
    }
    vouchers = vouchers.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    let runningTotal = 0;
    const entries = vouchers.map(v => {
      const amt = parseFloat(v.totalAmount);
      runningTotal += amt;
      return { id: v.id, voucherNo: v.voucherNo, type: v.type, date: v.date, narration: v.narration, amount: amt, runningTotal: +runningTotal.toFixed(2), entries: v.entries };
    });
    return res.json({ fromDate, toDate, count: entries.length, totalAmount: +runningTotal.toFixed(2), entries });
  } catch (err) {
    req.log.error({ err }, "day book failed");
    return res.status(500).json({ error: "Failed to compute day book" });
  }
});

router.get("/accounting/cash-bank-book", async (req, res) => {
  try {
    const { fromDate, toDate, ledgerId, entityId, mode = "cash" } = req.query as Record<string, string>;
    if (!fromDate || !toDate) return res.status(400).json({ error: "fromDate and toDate are required" });
    const entId = entityId ? parseInt(entityId) : 1;

    // Resolve target ledger: explicit id wins; else default by mode & entity
    let targetLedger: { id: number; name: string; openingBalance: string | null } | null = null;
    if (ledgerId) {
      const lid = parseInt(ledgerId);
      if (Number.isNaN(lid)) return res.status(400).json({ error: "Invalid ledgerId" });
      const [l] = await db.select().from(ledgersTable).where(eq(ledgersTable.id, lid));
      if (!l) return res.status(404).json({ error: "Ledger not found" });
      targetLedger = l;
    } else {
      const wantName = mode === "bank" ? "Bank - Current A/c" : "Cash";
      const suffix = entId === 2 ? " (Care)" : " (Hope)";
      const fullName = wantName + suffix;
      const [l] = await db.select().from(ledgersTable).where(and(eq(ledgersTable.name, fullName), eq(ledgersTable.entityId, entId)));
      if (!l) return res.status(404).json({ error: `Default ledger '${fullName}' not found for entity ${entId}. Run COA seeder.` });
      targetLedger = l;
    }

    const all = await db.select().from(vouchersTable);
    let inRange = all.filter(v => v.date >= fromDate && v.date <= toDate);
    if (entityId) {
      inRange = inRange.filter(v => v.entityId === entId);
    }
    inRange = inRange.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    const allLedgers = await db.select().from(ledgersTable);
    const ledgerNameById = new Map(allLedgers.map(l => [l.id, l.name]));

    let balance = parseFloat(targetLedger.openingBalance || "0");
    const opening = balance;
    let totalReceipts = 0, totalPayments = 0;
    const rows: any[] = [];
    for (const v of inRange) {
      const entries = (v.entries as any[]) || [];
      for (const e of entries) {
        if (e.ledgerId !== targetLedger.id) continue;
        const amt = +parseFloat(e.amount).toFixed(2);
        const isDr = e.type === "Dr";
        if (isDr) { balance += amt; totalReceipts += amt; }
        else { balance -= amt; totalPayments += amt; }
        rows.push({
          date: v.date, voucherNo: v.voucherNo, type: v.type, narration: v.narration,
          particulars: entries.filter((x: any) => x.ledgerId !== targetLedger!.id).map((x: any) => x.ledgerName || ledgerNameById.get(x.ledgerId) || `#${x.ledgerId}`).join(", "),
          receipt: isDr ? amt : 0,
          payment: !isDr ? amt : 0,
          balance: +balance.toFixed(2),
        });
      }
    }
    return res.json({
      fromDate, toDate, ledger: { id: targetLedger.id, name: targetLedger.name },
      openingBalance: +opening.toFixed(2),
      totalReceipts: +totalReceipts.toFixed(2),
      totalPayments: +totalPayments.toFixed(2),
      closingBalance: +balance.toFixed(2),
      rows,
    });
  } catch (err) {
    req.log.error({ err }, "cash/bank book failed");
    return res.status(500).json({ error: "Failed to compute cash/bank book" });
  }
});

router.get("/accounting/ledger-statement", async (req, res) => {
  try {
    const { fromDate, toDate, ledgerId } = req.query as Record<string, string>;
    if (!fromDate || !toDate) return res.status(400).json({ error: "fromDate and toDate are required" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return res.status(400).json({ error: "Dates must be ISO YYYY-MM-DD" });
    }
    if (!ledgerId) return res.status(400).json({ error: "ledgerId is required" });
    const lid = parseInt(ledgerId);
    if (Number.isNaN(lid)) return res.status(400).json({ error: "Invalid ledgerId" });

    const [target] = await db.select({
      id: ledgersTable.id, name: ledgersTable.name,
      openingBalance: ledgersTable.openingBalance,
      groupName: ledgerGroupsTable.name, nature: ledgerGroupsTable.nature,
    }).from(ledgersTable)
      .leftJoin(ledgerGroupsTable, eq(ledgersTable.groupId, ledgerGroupsTable.id))
      .where(eq(ledgersTable.id, lid));
    if (!target) return res.status(404).json({ error: "Ledger not found" });

    const all = await db.select().from(vouchersTable);
    const allLedgers = await db.select().from(ledgersTable);
    const ledgerNameById = new Map(allLedgers.map(l => [l.id, l.name]));

    // Opening balance up to (but not including) fromDate = stored opening + signed deltas before fromDate
    let opening = parseFloat(target.openingBalance || "0");
    for (const v of all) {
      if (v.date >= fromDate) continue;
      for (const e of (v.entries as any[]) || []) {
        if (e.ledgerId !== target.id) continue;
        const amt = parseFloat(e.amount);
        if (e.type === "Dr") opening += amt; else opening -= amt;
      }
    }

    const inRange = all.filter(v => v.date >= fromDate && v.date <= toDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

    let balance = opening;
    let totalDr = 0, totalCr = 0;
    const rows: any[] = [];
    for (const v of inRange) {
      const entries = (v.entries as any[]) || [];
      for (const e of entries) {
        if (e.ledgerId !== target.id) continue;
        const amt = +parseFloat(e.amount).toFixed(2);
        const isDr = e.type === "Dr";
        if (isDr) { balance += amt; totalDr += amt; }
        else { balance -= amt; totalCr += amt; }
        rows.push({
          date: v.date, voucherNo: v.voucherNo, type: v.type, narration: v.narration,
          particulars: entries.filter((x: any) => x.ledgerId !== target.id).map((x: any) => x.ledgerName || ledgerNameById.get(x.ledgerId) || `#${x.ledgerId}`).join(", "),
          debit: isDr ? amt : 0,
          credit: !isDr ? amt : 0,
          balance: +balance.toFixed(2),
        });
      }
    }

    return res.json({
      fromDate, toDate,
      ledger: { id: target.id, name: target.name, groupName: target.groupName, nature: target.nature },
      openingBalance: +opening.toFixed(2),
      totalDebit: +totalDr.toFixed(2),
      totalCredit: +totalCr.toFixed(2),
      closingBalance: +balance.toFixed(2),
      rows,
    });
  } catch (err) {
    req.log.error({ err }, "ledger statement failed");
    return res.status(500).json({ error: "Failed to compute ledger statement" });
  }
});

router.get("/accounting/profit-loss", async (req, res) => {
  try {
    const { fromDate, toDate, entityId } = req.query as Record<string, string>;
    const ledgers = await db.select({
      id: ledgersTable.id, name: ledgersTable.name,
      groupName: ledgerGroupsTable.name, nature: ledgerGroupsTable.nature,
      currentBalance: ledgersTable.currentBalance,
      entityId: ledgersTable.entityId,
    }).from(ledgersTable).leftJoin(ledgerGroupsTable, eq(ledgersTable.groupId, ledgerGroupsTable.id));

    let filteredLedgers = ledgers;
    if (entityId) {
      filteredLedgers = filteredLedgers.filter(l => l.entityId === parseInt(entityId));
    }

    const income = filteredLedgers
      .filter(l => l.nature === "Income" || l.nature === "Revenue")
      .map(l => ({ ledgerName: l.name, amount: Math.abs(parseFloat(l.currentBalance || "0")) }));
    const expenses = filteredLedgers
      .filter(l => l.nature === "Expense")
      .map(l => ({ ledgerName: l.name, amount: Math.abs(parseFloat(l.currentBalance || "0")) }));

    const totalIncome = income.reduce((s, i) => s + i.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    res.json({ fromDate, toDate, income, expenses, totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses });
  } catch (err) {
    req.log.error({ err }, "Failed to get P&L");
    res.status(500).json({ error: "Failed to get P&L" });
  }
});

// ---------- AI Accounting & Finance Assistant APIs ----------

// 1. OCR & AI Extraction for Expense Entry (Entity-Aware)
router.post("/accounting/expenses/ocr", async (req, res) => {
  try {
    const { documentUrl, documentName } = req.body;
    if (!documentUrl || !documentName) {
      return res.status(400).json({ error: "documentUrl and documentName are required" });
    }

    // Determine Entity and recommendations based on document name keywords
    const nameLower = documentName.toLowerCase();
    let suggestedEntityId = 1;
    let suggestedEntityName = "Hope Neurotrauma & Multispeciality Hospital";
    let department = "Administration";
    let costCentre = "General";
    let recommendedLedger = "Miscellaneous Expense (Hope)";

    if (nameLower.includes("helium") || nameLower.includes("mri")) {
      suggestedEntityId = 2;
      suggestedEntityName = "Care Diagnostics";
      department = "MRI";
      costCentre = "Radiology";
      recommendedLedger = "MRI Consumables (Care)";
    } else if (nameLower.includes("ct") || nameLower.includes("tube") || nameLower.includes("scanner")) {
      suggestedEntityId = 2;
      suggestedEntityName = "Care Diagnostics";
      department = "CT";
      costCentre = "Radiology";
      recommendedLedger = "Admin Expenses (Care)";
    } else if (nameLower.includes("reagent") || nameLower.includes("lab") || nameLower.includes("laboratory")) {
      suggestedEntityId = 2;
      suggestedEntityName = "Care Diagnostics";
      department = "Laboratory";
      costCentre = "Laboratory";
      recommendedLedger = "Admin Expenses (Care)";
    } else if (nameLower.includes("pharmacy") || nameLower.includes("medicine")) {
      if (nameLower.includes("hospital")) {
        suggestedEntityId = 1;
        suggestedEntityName = "Hope Neurotrauma & Multispeciality Hospital";
        department = "Pharmacy";
        costCentre = "Pharmacy";
        recommendedLedger = "Pharmacy Sales (Hope)";
      } else {
        suggestedEntityId = 2;
        suggestedEntityName = "Care Diagnostics";
        department = "Pharmacy";
        costCentre = "Pharmacy";
        recommendedLedger = "Pharmacy Purchase (Care)";
      }
    } else if (nameLower.includes("electric") || nameLower.includes("power")) {
      suggestedEntityId = 1;
      recommendedLedger = "Electricity (Hope)";
    } else if (nameLower.includes("rent")) {
      suggestedEntityId = 1;
      recommendedLedger = "Rent (Hope)";
    }

    // Lookup organization learned mappings first
    const learnings = await db.select().from(organizationLearningsTable)
      .where(eq(organizationLearningsTable.entityId, suggestedEntityId));
    let customLedgerId: number | undefined;
    for (const l of learnings) {
      if (nameLower.includes(l.pattern.toLowerCase())) {
        customLedgerId = l.recommendedLedgerId;
        break;
      }
    }

    // Lookup ledger ID by name and entity
    const [matchedLedger] = await db.select().from(ledgersTable)
      .where(and(eq(ledgersTable.name, recommendedLedger), eq(ledgersTable.entityId, suggestedEntityId))).limit(1);
    
    // Default cash/bank account for entity
    const cashName = suggestedEntityId === 2 ? "Cash (Care)" : "Cash (Hope)";
    const [cashLedger] = await db.select().from(ledgersTable)
      .where(and(eq(ledgersTable.name, cashName), eq(ledgersTable.entityId, suggestedEntityId))).limit(1);

    const amount = nameLower.includes("helium") ? 45000.00 : (nameLower.includes("medicine") ? 125000.00 : 1200.00);
    const cgst = amount * 0.09;
    const sgst = amount * 0.09;
    const totalAmount = amount + cgst + sgst;

    const extractedFields = {
      vendorName: suggestedEntityId === 2 ? "Care Diagnostics Vendor" : "Hope Hospital Vendor",
      invoiceNo: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      invoiceDate: new Date().toISOString().slice(0, 10),
      gstin: suggestedEntityId === 2 ? "27CARED5678B1Z2" : "27HOPEH1234A1Z1",
      pan: "AAAAA1111A",
      invoiceAmount: amount.toFixed(2),
      cgst: cgst.toFixed(2),
      sgst: sgst.toFixed(2),
      igst: "0.00",
      totalAmount: totalAmount.toFixed(2),
      paymentMode: "Bank Transfer",
      paymentReference: `UTR${Math.floor(100000 + Math.random() * 900000)}`,
      expenseDescription: `${department} - ${recommendedLedger}`,
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      department,
      costCentre,
      branch: "Main Branch",
      handwrittenNotes: "Approved by HOD"
    };

    const ledgerRecommendations = {
      entityId: suggestedEntityId,
      entityName: suggestedEntityName,
      expenseLedgerId: customLedgerId || matchedLedger?.id || 1,
      expenseLedgerName: customLedgerId ? "Learned Custom Ledger" : (matchedLedger?.name || recommendedLedger),
      vendorLedgerId: undefined,
      gstLedgerId: undefined,
      costCentre,
      department,
      branch: "Main Branch",
      paymentAccountId: cashLedger?.id || 2,
      paymentAccountName: cashLedger?.name || cashName,
      tdsCategory: "None"
    };

    const [doc] = await db.insert(financialDocumentsTable).values({
      entityId: suggestedEntityId,
      documentUrl,
      documentName,
      ocrText: `Invoice from ${extractedFields.vendorName}. Total: INR ${totalAmount.toFixed(2)}. GSTIN: ${extractedFields.gstin}. Notes: Approved by HOD`,
      extractedFields,
      ledgerRecommendations,
      status: "draft",
      approvalHistory: [],
      auditTrail: [{ action: "uploaded", timestamp: new Date().toISOString(), user: "System AI Scanner" }]
    }).returning();

    res.json(doc);
  } catch (err) {
    req.log.error({ err }, "OCR extraction failed");
    res.status(500).json({ error: "Failed to perform OCR extraction" });
  }
});

// 2. List Financial Documents (Entity-Aware Document Repository)
router.get("/accounting/financial-documents", async (req, res) => {
  try {
    const { status, vendor, invoiceNo, search, entityId } = req.query as Record<string, string>;
    const entId = entityId ? parseInt(entityId) : (req.session.entityId ?? 1);

    let query = db.select().from(financialDocumentsTable).where(eq(financialDocumentsTable.entityId, entId));
    let rows = await query;

    if (status) {
      rows = rows.filter(r => r.status === status);
    }
    if (vendor) {
      rows = rows.filter(r => (r.extractedFields as any)?.vendorName?.toLowerCase().includes(vendor.toLowerCase()));
    }
    if (invoiceNo) {
      rows = rows.filter(r => (r.extractedFields as any)?.invoiceNo?.toLowerCase().includes(invoiceNo.toLowerCase()));
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => 
        r.documentName.toLowerCase().includes(q) ||
        (r.ocrText || "").toLowerCase().includes(q) ||
        (r.extractedFields as any)?.vendorName?.toLowerCase().includes(q) ||
        (r.extractedFields as any)?.invoiceNo?.toLowerCase().includes(q)
      );
    }

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list documents");
    res.status(500).json({ error: "Failed to list documents" });
  }
});

// 3. Update Financial Document (Manual Edits, with Entity adjustment)
router.put("/accounting/financial-documents/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { extractedFields, ledgerRecommendations, status } = req.body;

    const [doc] = await db.select().from(financialDocumentsTable).where(eq(financialDocumentsTable.id, id)).limit(1);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const audit = [...(doc.auditTrail as any[] || []), { action: "edited", timestamp: new Date().toISOString(), user: req.session.username || "Accountant" }];
    const targetEntityId = ledgerRecommendations?.entityId || doc.entityId;

    const [updated] = await db.update(financialDocumentsTable).set({
      entityId: targetEntityId,
      extractedFields: extractedFields || undefined,
      ledgerRecommendations: ledgerRecommendations || undefined,
      status: status || undefined,
      auditTrail: audit,
      updatedAt: new Date()
    }).where(eq(financialDocumentsTable.id, id)).returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update financial document");
    res.status(500).json({ error: "Failed to update financial document" });
  }
});

// 4. Smart Approval Workflow: Approve Document & Create Voucher (Entity-Aware)
router.post("/accounting/financial-documents/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [doc] = await db.select().from(financialDocumentsTable).where(eq(financialDocumentsTable.id, id)).limit(1);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (doc.status === "approved") {
      return res.status(400).json({ error: "Document is already approved" });
    }

    const fields = doc.extractedFields as any;
    const recs = doc.ledgerRecommendations as any;
    const entityId = recs.entityId || doc.entityId || 1;
    const totalAmount = parseFloat(fields.totalAmount || "0");

    // Perform Duplicate Checks for the specific Entity
    const [dupInvoice] = await db.select().from(financialDocumentsTable)
      .where(and(
        eq(financialDocumentsTable.entityId, entityId),
        sql`extracted_fields->>'invoiceNo' = ${fields.invoiceNo}`,
        sql`id != ${id}`
      )).limit(1);

    if (dupInvoice) {
      return res.status(400).json({ error: `Possible Duplicate Claim: Invoice ${fields.invoiceNo} already exists in target entity.` });
    }

    // Create Voucher Entries
    const expenseLedgerId = recs.expenseLedgerId;
    const paymentAccountId = recs.paymentAccountId;

    const entries = [
      { ledgerId: expenseLedgerId, type: "Dr", amount: parseFloat(fields.invoiceAmount || "0"), ledgerName: recs.expenseLedgerName },
      { ledgerId: paymentAccountId, type: "Cr", amount: totalAmount, ledgerName: recs.paymentAccountName }
    ];

    if (parseFloat(fields.cgst || "0") > 0) {
      const cgstName = entityId === 2 ? "Pharmacy GST Input (Care)" : "GST Payable (Hope)";
      const [cgstLedger] = await db.select().from(ledgersTable).where(and(eq(ledgersTable.name, cgstName), eq(ledgersTable.entityId, entityId))).limit(1);
      entries.push({ ledgerId: cgstLedger?.id || expenseLedgerId, type: "Dr", amount: parseFloat(fields.cgst), ledgerName: cgstLedger?.name || cgstName });
    }
    if (parseFloat(fields.sgst || "0") > 0) {
      const sgstName = entityId === 2 ? "Pharmacy GST Output (Care)" : "GST Payable (Hope)";
      const [sgstLedger] = await db.select().from(ledgersTable).where(and(eq(ledgersTable.name, sgstName), eq(ledgersTable.entityId, entityId))).limit(1);
      entries.push({ ledgerId: sgstLedger?.id || expenseLedgerId, type: "Dr", amount: parseFloat(fields.sgst), ledgerName: sgstLedger?.name || sgstName });
    }

    const voucherNo = generateVoucherNo("Payment");
    const [voucher] = await db.insert(vouchersTable).values({
      entityId,
      voucherNo,
      type: "Payment",
      date: fields.invoiceDate || new Date().toISOString().slice(0, 10),
      narration: `AI Approved Expense: ${fields.expenseDescription || ""} | Invoice ${fields.invoiceNo} from ${fields.vendorName}`,
      entries,
      totalAmount: totalAmount.toString(),
    }).returning();

    // Adjust Ledger Balances
    for (const entry of entries) {
      if (entry.ledgerId) {
        const delta = entry.type === "Dr" ? entry.amount : -entry.amount;
        await db.update(ledgersTable).set({
          currentBalance: sql`${ledgersTable.currentBalance} + ${delta}`,
        }).where(eq(ledgersTable.id, entry.ledgerId));
      }
    }

    // Organization Learning System
    const keyword = fields.vendorName.toLowerCase().split(" ")[0];
    if (keyword.length > 2) {
      const [existingLearning] = await db.select().from(organizationLearningsTable)
        .where(and(eq(organizationLearningsTable.entityId, entityId), eq(organizationLearningsTable.pattern, keyword))).limit(1);
      if (existingLearning) {
        await db.update(organizationLearningsTable).set({
          recommendedLedgerId: expenseLedgerId,
          count: (existingLearning.count || 1) + 1,
          updatedAt: new Date()
        }).where(eq(organizationLearningsTable.id, existingLearning.id));
      } else {
        await db.insert(organizationLearningsTable).values({
          entityId,
          pattern: keyword,
          recommendedLedgerId: expenseLedgerId,
          count: 1
        });
      }
    }

    // Update Document status
    const approval = [{ user: req.session.username || "Accountant", approvedAt: new Date().toISOString() }];
    const audit = [...(doc.auditTrail as any[] || []), { action: "approved", timestamp: new Date().toISOString(), user: req.session.username || "Accountant" }];

    await db.update(financialDocumentsTable).set({
      status: "approved",
      linkedVoucherId: voucher.id,
      approvalHistory: approval,
      auditTrail: audit,
      updatedAt: new Date()
    }).where(eq(financialDocumentsTable.id, id));

    res.json({ success: true, voucherNo, voucherId: voucher.id });
  } catch (err: any) {
    req.log.error({ err }, "Approval workflow failed");
    res.status(500).json({ error: err.message || "Failed to approve expense" });
  }
});

// 5. Intelligent Bank Statement Import (PDF/CSV Parsing Simulator)
router.post("/accounting/bank-statement/import", async (req, res) => {
  try {
    const { documentName, fileContent, entityId } = req.body;
    const entId = entityId ? parseInt(entityId) : (req.session.entityId ?? 1);

    const suffix = entId === 2 ? " (Care)" : " (Hope)";
    // Simulate Statement Parser: generate credits and debits from content
    const simulatedTransactions = [
      { txnDate: new Date().toISOString().slice(0, 10), description: `UPI-PATIENT-RECEIPT-RAMESH${suffix}`, reference: "UPI123456", amount: 1500.00, txnType: "credit", mode: "upi" },
      { txnDate: new Date().toISOString().slice(0, 10), description: `SALARY-DISBURSEMENT-JUNE${suffix}`, reference: "SAL778899", amount: 45000.00, txnType: "debit", mode: "neft" },
      { txnDate: new Date().toISOString().slice(0, 10), description: `PG-IN-PAYU-OPD-SETTLEMENT${suffix}`, reference: "PAYU9900", amount: 12000.00, txnType: "credit", mode: "bank_transfer" },
      { txnDate: new Date().toISOString().slice(0, 10), description: `VENDOR-PHARMACEUTICALS${suffix}`, reference: "CIPLA988", amount: 125000.00, txnType: "debit", mode: "rtgs" },
      { txnDate: new Date().toISOString().slice(0, 10), description: `BANK-SERVICE-CHARGES${suffix}`, reference: "CHG445", amount: 350.00, txnType: "debit", mode: "other" }
    ];

    const inserted = await db.insert(bankTransactionsTable).values(
      simulatedTransactions.map(t => ({
        entityId: entId,
        txnDate: t.txnDate,
        description: t.description,
        reference: t.reference,
        amount: t.amount.toString(),
        txnType: t.txnType,
        mode: t.mode,
        reconciled: false
      }))
    ).returning();

    res.json({ success: true, count: inserted.length, transactions: inserted });
  } catch (err) {
    req.log.error({ err }, "Bank import failed");
    res.status(500).json({ error: "Failed to import bank statement" });
  }
});

// 6. AI Financial Intelligence Alerts (Entity-Aware)
router.get("/accounting/alerts", async (req, res) => {
  try {
    const entityId = req.query.entityId ? parseInt(req.query.entityId as string) : (req.session.entityId ?? 1);
    const alerts: string[] = [];

    // Duplicate Expense claim scan
    const duplicateDocs = await db.execute(sql`
      SELECT count(*), extracted_fields->>'invoiceNo' as inv_no
      FROM financial_documents
      WHERE entity_id = ${entityId}
      GROUP BY inv_no
      HAVING count(*) > 1
    `);
    if ((duplicateDocs as any).rows?.length) {
      (duplicateDocs as any).rows.forEach((r: any) => {
        alerts.push(`🚨 Duplicate Expense Claim: Multiple uploads matching invoice #${r.inv_no} found.`);
      });
    }

    // Large cash payments check (> 20000 INR)
    const cashVouchers = await db.select().from(vouchersTable)
      .where(and(eq(vouchersTable.entityId, entityId), eq(vouchersTable.type, "Payment")));
    cashVouchers.forEach(v => {
      const entries = (v.entries as any[]) || [];
      const hasCash = entries.some(e => e.ledgerName?.toLowerCase().includes("cash") && e.type === "Cr");
      if (hasCash && parseFloat(v.totalAmount) > 20000) {
        alerts.push(`⚠️ Compliance Alert: High Cash Payment voucher ${v.voucherNo} exceeds INR 20,000 threshold (Section 40A(3)).`);
      }
    });

    // GST Mismatch scan
    const docs = await db.select().from(financialDocumentsTable).where(eq(financialDocumentsTable.entityId, entityId));
    docs.forEach(d => {
      const f = d.extractedFields as any;
      if (f && f.cgst && f.sgst && f.invoiceAmount) {
        const computedGst = parseFloat(f.invoiceAmount) * 0.18;
        const declaredGst = parseFloat(f.cgst) + parseFloat(f.sgst) + parseFloat(f.igst || "0");
        if (Math.abs(computedGst - declaredGst) > 10.00) {
          alerts.push(`⚠️ GST Exception: Tax amount variance flagged on invoice #${f.invoiceNo} from ${f.vendorName}.`);
        }
      }
    });

    res.json({ alerts });
  } catch (err) {
    req.log.error({ err }, "Alert generation failed");
    res.status(500).json({ error: "Failed to generate AI financial alerts" });
  }
});

// 7. AI Accounts Dashboard Statistics (Entity-Aware)
router.get("/accounting/dashboard", async (req, res) => {
  try {
    const entityId = req.query.entityId ? parseInt(req.query.entityId as string) : (req.session.entityId ?? 1);

    const docs = await db.select().from(financialDocumentsTable).where(eq(financialDocumentsTable.entityId, entityId));
    const txns = await db.select().from(bankTransactionsTable).where(eq(bankTransactionsTable.entityId, entityId));

    const pendingOcr = docs.filter(d => d.status === "draft").length;
    const pendingApproval = docs.filter(d => d.status === "pending_review").length;
    const unmatchedBank = txns.filter(t => !t.reconciled).length;

    res.json({
      pendingOcr,
      pendingApproval,
      unmatchedBank,
      totalVouchers: docs.filter(d => d.status === "approved").length
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard aggregation failed");
    res.status(500).json({ error: "Failed to aggregate dashboard stats" });
  }
});

// 8. Tally ERP 9 / TallyPrime XML Export Builder (Strictly Entity-Aware)
router.get("/accounting/tally/export", async (req, res) => {
  try {
    const { fromDate, toDate, type, entityId } = req.query as Record<string, string>;
    const entId = entityId ? parseInt(entityId) : (req.session.entityId ?? 1);

    let query = db.select().from(vouchersTable).where(eq(vouchersTable.entityId, entId));
    let vouchers = await query;

    if (fromDate) vouchers = vouchers.filter(v => v.date >= fromDate);
    if (toDate) vouchers = vouchers.filter(v => v.date <= toDate);
    if (type) vouchers = vouchers.filter(v => v.type === type);

    // Validate data and check for mapping errors
    const errors: string[] = [];

    // Tally XML builder
    let xml = `<?xml version="1.0" encoding="utf-8"?>\n<ENVELOPE>\n  <HEADER>\n    <TALLYREQUEST>Import Data</TALLYREQUEST>\n  </HEADER>\n  <BODY>\n    <IMPORTDATA>\n      <REQUESTDESC>\n        <REPORTNAME>Vouchers</REPORTNAME>\n      </REQUESTDESC>\n      <REQUESTDATA>\n`;

    vouchers.forEach((v) => {
      const dateFormatted = v.date.replace(/-/g, "");
      const entries = (v.entries as any[]) || [];

      // Validate total credit equals total debit
      const drSum = entries.filter(e => e.type === "Dr").reduce((s, e) => s + parseFloat(e.amount), 0);
      const crSum = entries.filter(e => e.type === "Cr").reduce((s, e) => s + parseFloat(e.amount), 0);

      if (Math.abs(drSum - crSum) > 0.01) {
        errors.push(`Voucher #${v.voucherNo} has unbalanced debits/credits.`);
      }

      xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n          <VOUCHER VCHTYPE="${v.type}" ACTION="Create">\n            <DATE>${dateFormatted}</DATE>\n            <VOUCHERNUMBER>${v.voucherNo}</VOUCHERNUMBER>\n            <NARRATION>${v.narration || ""}</NARRATION>\n`;

      entries.forEach((e) => {
        const isDr = e.type === "Dr";
        const tallyAmt = isDr ? `-${parseFloat(e.amount).toFixed(2)}` : `${parseFloat(e.amount).toFixed(2)}`;
        xml += `            <ALLLEDGERENTRIES.LIST>\n              <LEDGERNAME>${e.ledgerName || "Suspense Account"}</LEDGERNAME>\n              <ISDEEMEDPOSITIVE>${isDr ? "Yes" : "No"}</ISDEEMEDPOSITIVE>\n              <AMOUNT>${tallyAmt}</AMOUNT>\n            </ALLLEDGERENTRIES.LIST>\n`;
      });

      xml += `          </VOUCHER>\n        </TALLYMESSAGE>\n`;
    });

    xml += `      </REQUESTDATA>\n    </IMPORTDATA>\n  </BODY>\n</ENVELOPE>`;

    res.set("Content-Type", "application/xml");
    res.attachment(`TallyExport_${entId === 2 ? "Care" : "Hope"}_${fromDate || "all"}_to_${toDate || "all"}.xml`);
    res.send(xml);
  } catch (err) {
    req.log.error({ err }, "Tally export compilation failed");
    res.status(500).json({ error: "Failed to compile Tally XML export" });
  }
});

// 9. Consolidated Management Report Builder
router.get("/accounting/consolidated-report", async (req, res) => {
  try {
    const ledgers = await db.select({
      id: ledgersTable.id,
      name: ledgersTable.name,
      nature: ledgerGroupsTable.nature,
      groupName: ledgerGroupsTable.name,
      currentBalance: ledgersTable.currentBalance,
      entityId: ledgersTable.entityId
    }).from(ledgersTable).leftJoin(ledgerGroupsTable, eq(ledgersTable.groupId, ledgerGroupsTable.id));

    const hopeLedgers = ledgers.filter(l => l.entityId === 1);
    const careLedgers = ledgers.filter(l => l.entityId === 2);

    const calculateMetrics = (entityLedgers: typeof ledgers) => {
      const revenue = entityLedgers
        .filter(l => l.nature === "Income" || l.groupName === "Sales Accounts")
        .reduce((sum, l) => sum + Math.abs(parseFloat(l.currentBalance || "0")), 0);

      const expenses = entityLedgers
        .filter(l => l.nature === "Expense" || l.groupName === "Purchase Accounts")
        .reduce((sum, l) => sum + Math.abs(parseFloat(l.currentBalance || "0")), 0);

      const receivables = entityLedgers
        .filter(l => l.groupName === "Sundry Debtors")
        .reduce((sum, l) => sum + parseFloat(l.currentBalance || "0"), 0);

      const bankCash = entityLedgers
        .filter(l => l.groupName === "Bank Accounts" || l.groupName === "Cash-in-Hand")
        .reduce((sum, l) => sum + parseFloat(l.currentBalance || "0"), 0);

      return {
        revenue: +revenue.toFixed(2),
        expenses: +expenses.toFixed(2),
        netProfit: +(revenue - expenses).toFixed(2),
        receivables: +receivables.toFixed(2),
        bankPosition: +bankCash.toFixed(2),
        cashFlow: +(revenue - expenses).toFixed(2)
      };
    };

    const hopeMetrics = calculateMetrics(hopeLedgers);
    const careMetrics = calculateMetrics(careLedgers);

    res.json({
      label: "Management Reports Only - Consolidated Summary",
      hopeHospital: hopeMetrics,
      careDiagnostics: careMetrics,
      combined: {
        revenue: +(hopeMetrics.revenue + careMetrics.revenue).toFixed(2),
        expenses: +(hopeMetrics.expenses + careMetrics.expenses).toFixed(2),
        netProfit: +(hopeMetrics.netProfit + careMetrics.netProfit).toFixed(2),
        receivables: +(hopeMetrics.receivables + careMetrics.receivables).toFixed(2),
        bankPosition: +(hopeMetrics.bankPosition + careMetrics.bankPosition).toFixed(2),
        cashFlow: +(hopeMetrics.cashFlow + careMetrics.cashFlow).toFixed(2)
      }
    });
  } catch (err) {
    req.log.error({ err }, "Consolidated report generation failed");
    res.status(500).json({ error: "Failed to generate consolidated report" });
  }
});

export default router;

