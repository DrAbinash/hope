import { Router } from "express";
import { db } from "@workspace/db";
import { bankTransactionsTable, pharmacySalesTable, invoicesTable } from "@workspace/db";
import { eq, desc, and, gte, lte } from "drizzle-orm";

const router = Router();

router.get("/bank-reconciliation/transactions", async (req, res) => {
  try {
    const { reconciled, from, to } = req.query as Record<string, string>;
    const conditions = [];
    if (reconciled === "true") conditions.push(eq(bankTransactionsTable.reconciled, true));
    if (reconciled === "false") conditions.push(eq(bankTransactionsTable.reconciled, false));
    if (from) conditions.push(gte(bankTransactionsTable.txnDate, from));
    if (to) conditions.push(lte(bankTransactionsTable.txnDate, to));
    const rows = await db.select().from(bankTransactionsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(bankTransactionsTable.txnDate));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list bank transactions");
    res.status(500).json({ error: "Failed to list bank transactions" });
  }
});

router.post("/bank-reconciliation/transactions", async (req, res) => {
  try {
    const { txnDate, description, reference, amount, txnType, mode, notes } = req.body;
    if (!txnDate || amount === undefined || !txnType) {
      return res.status(400).json({ error: "txnDate, amount, txnType required" });
    }
    const [row] = await db.insert(bankTransactionsTable).values({
      txnDate,
      description: description || null,
      reference: reference || null,
      amount: amount.toString(),
      txnType,
      mode: mode || null,
      notes: notes || null,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create bank txn");
    res.status(500).json({ error: "Failed to create bank transaction" });
  }
});

// Bulk import (CSV-style array)
router.post("/bank-reconciliation/transactions/bulk", async (req, res) => {
  try {
    const { transactions } = req.body as { transactions: Array<any> };
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: "transactions array required" });
    }
    const inserted = await db.insert(bankTransactionsTable).values(
      transactions.map(t => ({
        txnDate: t.txnDate,
        description: t.description || null,
        reference: t.reference || null,
        amount: t.amount.toString(),
        txnType: t.txnType,
        mode: t.mode || null,
      }))
    ).returning();
    res.status(201).json({ inserted: inserted.length });
  } catch (err) {
    req.log.error({ err }, "Failed bulk insert bank txns");
    res.status(500).json({ error: "Failed to bulk insert bank transactions" });
  }
});

router.post("/bank-reconciliation/transactions/:id/match", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { matchedInvoiceId, matchedPharmacySaleId, reconciled = true } = req.body;
    const [row] = await db.update(bankTransactionsTable).set({
      matchedInvoiceId: matchedInvoiceId || null,
      matchedPharmacySaleId: matchedPharmacySaleId || null,
      reconciled,
    }).where(eq(bankTransactionsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Transaction not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to match bank txn");
    res.status(500).json({ error: "Failed to match bank transaction" });
  }
});

router.post("/bank-reconciliation/transactions/:id/unmatch", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.update(bankTransactionsTable).set({
      matchedInvoiceId: null, matchedPharmacySaleId: null, reconciled: false,
    }).where(eq(bankTransactionsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Transaction not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to unmatch bank txn");
    res.status(500).json({ error: "Failed to unmatch bank transaction" });
  }
});

router.delete("/bank-reconciliation/transactions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(bankTransactionsTable).where(eq(bankTransactionsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete bank txn");
    res.status(500).json({ error: "Failed to delete bank transaction" });
  }
});

router.get("/bank-reconciliation/summary", async (req, res) => {
  try {
    const rows = await db.select().from(bankTransactionsTable);
    let credits = 0, debits = 0, reconciledCount = 0, unreconciledCount = 0, reconciledAmt = 0;
    for (const r of rows) {
      const amt = parseFloat(r.amount);
      if (r.txnType === "credit") credits += amt; else debits += amt;
      if (r.reconciled) { reconciledCount++; reconciledAmt += amt; } else { unreconciledCount++; }
    }
    res.json({
      total: rows.length, credits, debits,
      reconciledCount, unreconciledCount, reconciledAmt,
      netBalance: credits - debits,
    });
  } catch (err) {
    req.log.error({ err }, "Failed bank summary");
    res.status(500).json({ error: "Failed bank summary" });
  }
});

// Suggest matches for an unreconciled txn — find pharmacy sales / invoices with the same amount, same/close date
router.get("/bank-reconciliation/suggest/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [txn] = await db.select().from(bankTransactionsTable).where(eq(bankTransactionsTable.id, id));
    if (!txn) return res.status(404).json({ error: "Transaction not found" });

    const amount = parseFloat(txn.amount);
    const txnDate = new Date(txn.txnDate);
    const lo = new Date(txnDate.getTime() - 3 * 86400000).toISOString().slice(0, 10);
    const hi = new Date(txnDate.getTime() + 3 * 86400000).toISOString().slice(0, 10);

    const sales = await db.select().from(pharmacySalesTable)
      .where(and(gte(pharmacySalesTable.billDate, lo), lte(pharmacySalesTable.billDate, hi)));
    const invoices = await db.select().from(invoicesTable);

    const matchSales = sales.filter(s => Math.abs(parseFloat(s.paidAmount) - amount) < 0.01);
    const matchInvoices = invoices.filter(i => {
      const d = (i.invoiceDate || "").slice(0, 10);
      return d >= lo && d <= hi && Math.abs(parseFloat(i.paidAmount || "0") - amount) < 0.01;
    });

    res.json({ pharmacySales: matchSales, invoices: matchInvoices });
  } catch (err) {
    req.log.error({ err }, "Failed bank suggest");
    res.status(500).json({ error: "Failed to suggest matches" });
  }
});

export default router;
