import { useState } from "react";
import { useListLedgers, useListVouchers, useGetTrialBalance, useGetProfitLoss } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Calculator, Sparkles, Printer } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function AccountingPage() {
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [exporting, setExporting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [bookMode, setBookMode] = useState<"cash" | "bank">("cash");
  const [viewLedgerId, setViewLedgerId] = useState<string>("");

  const { data: ledgers, isLoading: ledgersLoading, refetch: refetchLedgers } = useListLedgers({});
  const { data: vouchersData, isLoading: vouchersLoading } = useListVouchers({});
  const { data: trialBalance } = useGetTrialBalance({ fromDate, toDate });
  const { data: pnl } = useGetProfitLoss({ fromDate, toDate });
  const vouchers = vouchersData?.vouchers || [];

  const { data: dayBook } = useQuery({
    queryKey: ["/api/accounting/day-book", fromDate, toDate],
    queryFn: async () => {
      const r = await fetch(`/api/accounting/day-book?fromDate=${fromDate}&toDate=${toDate}`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });
  const { data: ledgerStatement } = useQuery({
    queryKey: ["/api/accounting/ledger-statement", fromDate, toDate, viewLedgerId],
    queryFn: async () => {
      const r = await fetch(`/api/accounting/ledger-statement?fromDate=${fromDate}&toDate=${toDate}&ledgerId=${viewLedgerId}`, { credentials: "include" });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      return r.json();
    },
    enabled: !!viewLedgerId,
  });
  const { data: cashBook } = useQuery({
    queryKey: ["/api/accounting/cash-bank-book", fromDate, toDate, bookMode],
    queryFn: async () => {
      const r = await fetch(`/api/accounting/cash-bank-book?fromDate=${fromDate}&toDate=${toDate}&mode=${bookMode}`, { credentials: "include" });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      return r.json();
    },
  });

  async function exportTally() {
    setExporting(true);
    try {
      const res = await fetch(`/api/accounting/tally-export?fromDate=${fromDate}&toDate=${toDate}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const blob = new Blob([data.xmlContent], { type: "text/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tally-export-${fromDate}-to-${toDate}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${data.exportedCount} vouchers to Tally XML`);
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  }

  async function seedCoa() {
    setSeeding(true);
    try {
      const r = await fetch(`/api/accounting/seed-indian-coa`, { method: "POST", credentials: "include" });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      const d = await r.json();
      toast.success(`Seeded ${d.groupsCreated} groups, ${d.ledgersCreated} ledgers (total groups: ${d.totalGroups})`);
      refetchLedgers();
    } catch (err: any) {
      toast.error("Seed failed: " + err.message);
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Accounting</h2>
          <p className="text-muted-foreground text-sm">Indian (Tally-style) accounting with day book, cash/bank book, and Tally XML export</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-36" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-36" />
          <Button variant="outline" onClick={seedCoa} disabled={seeding}>
            <Sparkles className="h-4 w-4 mr-2" />{seeding ? "Seeding…" : "Seed Indian COA"}
          </Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2"/>Print</Button>
          <Button variant="outline" onClick={exportTally} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />{exporting ? "Exporting…" : "Export to Tally"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="ledgers">
        <TabsList>
          <TabsTrigger value="ledgers">Ledgers</TabsTrigger>
          <TabsTrigger value="vouchers">Vouchers</TabsTrigger>
          <TabsTrigger value="day-book">Day Book</TabsTrigger>
          <TabsTrigger value="cash-book">Cash / Bank Book</TabsTrigger>
          <TabsTrigger value="view-ledger">View Ledger</TabsTrigger>
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="pnl">P&amp;L Statement</TabsTrigger>
        </TabsList>

        <TabsContent value="ledgers" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ledger Name</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">Opening Balance</TableHead>
                    <TableHead className="text-right">Current Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgersLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 4 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                    ))
                  ) : (ledgers || []).map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-semibold">{l.name}</TableCell>
                      <TableCell><Badge variant="outline">{l.groupName}</Badge></TableCell>
                      <TableCell className="text-right">₹{parseFloat(l.openingBalance || "0").toLocaleString()}</TableCell>
                      <TableCell className={`text-right font-medium ${parseFloat(l.currentBalance || "0") < 0 ? "text-red-600" : "text-green-600"}`}>
                        ₹{Math.abs(parseFloat(l.currentBalance || "0")).toLocaleString()}
                        {parseFloat(l.currentBalance || "0") < 0 ? " Cr" : " Dr"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vouchers" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voucher No</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Narration</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vouchersLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                    ))
                  ) : vouchers.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No vouchers found.</TableCell></TableRow>
                  ) : (
                    vouchers.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs font-medium">{v.voucherNo}</TableCell>
                        <TableCell><Badge variant="secondary">{v.type}</Badge></TableCell>
                        <TableCell>{v.date}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{v.narration || "—"}</TableCell>
                        <TableCell className="text-right font-medium">₹{parseFloat(v.totalAmount || "0").toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="day-book" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Day Book — {fromDate} to {toDate}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Voucher</TableHead><TableHead>Type</TableHead>
                  <TableHead>Narration</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Running Total</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(dayBook?.entries || []).length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No vouchers in this range.</TableCell></TableRow>
                    : (dayBook?.entries || []).map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell>{e.date}</TableCell>
                        <TableCell className="font-mono text-xs">{e.voucherNo}</TableCell>
                        <TableCell><Badge variant="secondary">{e.type}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.narration || "—"}</TableCell>
                        <TableCell className="text-right">₹{Number(e.amount).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right font-medium">₹{Number(e.runningTotal).toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    ))}
                  <TableRow className="bg-muted font-bold">
                    <TableCell colSpan={4}>Total ({dayBook?.count || 0} vouchers)</TableCell>
                    <TableCell colSpan={2} className="text-right">₹{Number(dayBook?.totalAmount || 0).toLocaleString("en-IN")}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash-book" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{bookMode === "cash" ? "Cash Book" : "Bank Book"} — {fromDate} to {toDate}</CardTitle>
                <Select value={bookMode} onValueChange={(v) => setBookMode(v as any)}>
                  <SelectTrigger className="w-32"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 border-b">
                <div><div className="text-xs text-muted-foreground">Ledger</div><div className="font-medium">{cashBook?.ledger?.name || "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Opening</div><div className="font-medium">₹{Number(cashBook?.openingBalance || 0).toLocaleString("en-IN")}</div></div>
                <div><div className="text-xs text-muted-foreground">Receipts (Dr)</div><div className="font-medium text-emerald-700">₹{Number(cashBook?.totalReceipts || 0).toLocaleString("en-IN")}</div></div>
                <div><div className="text-xs text-muted-foreground">Payments (Cr)</div><div className="font-medium text-rose-700">₹{Number(cashBook?.totalPayments || 0).toLocaleString("en-IN")}</div></div>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Voucher</TableHead><TableHead>Particulars</TableHead>
                  <TableHead className="text-right">Receipt</TableHead><TableHead className="text-right">Payment</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(cashBook?.rows || []).length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No transactions.</TableCell></TableRow>
                    : (cashBook?.rows || []).map((r: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{r.date}</TableCell>
                        <TableCell className="font-mono text-xs">{r.voucherNo}</TableCell>
                        <TableCell className="text-sm">{r.particulars || r.narration || "—"}</TableCell>
                        <TableCell className="text-right text-emerald-700">{r.receipt > 0 ? `₹${Number(r.receipt).toLocaleString("en-IN")}` : "—"}</TableCell>
                        <TableCell className="text-right text-rose-700">{r.payment > 0 ? `₹${Number(r.payment).toLocaleString("en-IN")}` : "—"}</TableCell>
                        <TableCell className="text-right font-medium">₹{Number(r.balance).toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    ))}
                  <TableRow className="bg-muted font-bold">
                    <TableCell colSpan={3}>Closing Balance</TableCell>
                    <TableCell colSpan={3} className="text-right">₹{Number(cashBook?.closingBalance || 0).toLocaleString("en-IN")}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="view-ledger" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>Ledger Statement {ledgerStatement?.ledger?.name ? `— ${ledgerStatement.ledger.name}` : ""}</CardTitle>
                <Select value={viewLedgerId} onValueChange={setViewLedgerId}>
                  <SelectTrigger className="w-72"><SelectValue placeholder="Select a ledger…" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {(ledgers || []).map((l: any) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!viewLedgerId ? (
                <div className="text-center py-10 text-muted-foreground">Select a ledger to view its statement.</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 border-b">
                    <div><div className="text-xs text-muted-foreground">Group</div><div className="font-medium">{ledgerStatement?.ledger?.groupName || "—"}</div></div>
                    <div><div className="text-xs text-muted-foreground">Opening</div><div className="font-medium">₹{Number(ledgerStatement?.openingBalance || 0).toLocaleString("en-IN")}</div></div>
                    <div><div className="text-xs text-muted-foreground">Total Debit</div><div className="font-medium text-emerald-700">₹{Number(ledgerStatement?.totalDebit || 0).toLocaleString("en-IN")}</div></div>
                    <div><div className="text-xs text-muted-foreground">Total Credit</div><div className="font-medium text-rose-700">₹{Number(ledgerStatement?.totalCredit || 0).toLocaleString("en-IN")}</div></div>
                  </div>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Voucher</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Particulars</TableHead>
                      <TableHead className="text-right">Debit (Dr)</TableHead>
                      <TableHead className="text-right">Credit (Cr)</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      <TableRow className="bg-muted/40">
                        <TableCell colSpan={6} className="font-medium">Opening Balance</TableCell>
                        <TableCell className="text-right font-medium">₹{Number(ledgerStatement?.openingBalance || 0).toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                      {(ledgerStatement?.rows || []).length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No transactions in selected period.</TableCell></TableRow>
                      ) : (ledgerStatement?.rows || []).map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                          <TableCell className="font-mono text-xs">{r.voucherNo}</TableCell>
                          <TableCell><Badge variant="outline">{r.type}</Badge></TableCell>
                          <TableCell className="text-sm">{r.particulars || r.narration || "—"}</TableCell>
                          <TableCell className="text-right text-emerald-700">{r.debit > 0 ? `₹${Number(r.debit).toLocaleString("en-IN")}` : "—"}</TableCell>
                          <TableCell className="text-right text-rose-700">{r.credit > 0 ? `₹${Number(r.credit).toLocaleString("en-IN")}` : "—"}</TableCell>
                          <TableCell className="text-right font-medium">₹{Number(r.balance).toLocaleString("en-IN")}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted font-bold">
                        <TableCell colSpan={4}>Closing Balance</TableCell>
                        <TableCell className="text-right">₹{Number(ledgerStatement?.totalDebit || 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{Number(ledgerStatement?.totalCredit || 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{Number(ledgerStatement?.closingBalance || 0).toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trial-balance" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />Trial Balance ({fromDate} to {toDate})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ledger Name</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">Debit (Dr)</TableHead>
                    <TableHead className="text-right">Credit (Cr)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(trialBalance?.entries || []).map((e: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{e.ledgerName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{e.groupName}</TableCell>
                      <TableCell className="text-right">{e.debit > 0 ? `₹${e.debit.toLocaleString()}` : "—"}</TableCell>
                      <TableCell className="text-right">{e.credit > 0 ? `₹${e.credit.toLocaleString()}` : "—"}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted font-bold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">₹{(trialBalance?.totalDebit || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">₹{(trialBalance?.totalCredit || 0).toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pnl" className="mt-4">
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            {[
              { title: "Total Income", value: pnl?.totalIncome, color: "text-green-600" },
              { title: "Total Expenses", value: pnl?.totalExpenses, color: "text-red-600" },
              { title: "Net Profit/Loss", value: pnl?.netProfit, color: (pnl?.netProfit || 0) >= 0 ? "text-green-600" : "text-red-600" },
            ].map(({ title, value, color }) => (
              <Card key={title}>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
                <CardContent><p className={`text-2xl font-bold ${color}`}>₹{Number(value || 0).toLocaleString()}</p></CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-green-700">Income</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Ledger</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(pnl?.income || []).map((i: any, idx: number) => (
                      <TableRow key={idx}><TableCell>{i.ledgerName}</TableCell><TableCell className="text-right text-green-600 font-medium">₹{i.amount.toLocaleString()}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-red-700">Expenses</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Ledger</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(pnl?.expenses || []).map((e: any, idx: number) => (
                      <TableRow key={idx}><TableCell>{e.ledgerName}</TableCell><TableCell className="text-right text-red-600 font-medium">₹{e.amount.toLocaleString()}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
