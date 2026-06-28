import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Landmark, Link2, Unlink, Trash2 } from "lucide-react";
import { toast } from "sonner";

const j = async (url: string, opts: RequestInit = {}) => {
  const r = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Request failed");
  return r.json();
};

function inr(n: any) { return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; }

export default function BankReconciliationPage() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState("unreconciled");
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState<any>({ txnDate: today, description: "", reference: "", amount: 0, txnType: "credit", mode: "Bank Transfer", notes: "" });
  const [openMatch, setOpenMatch] = useState<any>(null);
  const [openImport, setOpenImport] = useState(false);
  const [csv, setCsv] = useState("");

  const { data: summary } = useQuery<any>({ queryKey: ["bank-summary"], queryFn: () => j("/api/bank-reconciliation/summary") });
  const { data: txns } = useQuery<any[]>({
    queryKey: ["bank-txns", tab],
    queryFn: () => {
      const filter = tab === "unreconciled" ? "?reconciled=false" : tab === "reconciled" ? "?reconciled=true" : "";
      return j(`/api/bank-reconciliation/transactions${filter}`);
    },
  });
  const { data: suggestions } = useQuery<any>({
    queryKey: ["bank-suggest", openMatch?.id],
    queryFn: () => j(`/api/bank-reconciliation/suggest/${openMatch.id}`),
    enabled: !!openMatch,
  });

  const create = useMutation({
    mutationFn: () => j("/api/bank-reconciliation/transactions", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      toast.success("Transaction added");
      qc.invalidateQueries({ queryKey: ["bank-txns"] });
      qc.invalidateQueries({ queryKey: ["bank-summary"] });
      setOpenNew(false);
      setForm({ txnDate: today, description: "", reference: "", amount: 0, txnType: "credit", mode: "Bank Transfer", notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const importBulk = useMutation({
    mutationFn: () => {
      const lines = csv.trim().split("\n").filter(l => l.trim());
      const transactions = lines.map(l => {
        const [date, description, reference, amount, type] = l.split(",").map(s => s.trim());
        return { txnDate: date, description, reference, amount: parseFloat(amount || "0"), txnType: (type || "credit").toLowerCase() };
      });
      return j("/api/bank-reconciliation/transactions/bulk", { method: "POST", body: JSON.stringify({ transactions }) });
    },
    onSuccess: (r: any) => {
      toast.success(`Imported ${r.inserted} transactions`);
      qc.invalidateQueries({ queryKey: ["bank-txns"] });
      qc.invalidateQueries({ queryKey: ["bank-summary"] });
      setOpenImport(false); setCsv("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const match = useMutation({
    mutationFn: ({ id, body }: any) => j(`/api/bank-reconciliation/transactions/${id}/match`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Matched & reconciled");
      qc.invalidateQueries({ queryKey: ["bank-txns"] });
      qc.invalidateQueries({ queryKey: ["bank-summary"] });
      setOpenMatch(null);
    },
  });
  const unmatch = useMutation({
    mutationFn: (id: number) => j(`/api/bank-reconciliation/transactions/${id}/unmatch`, { method: "POST" }),
    onSuccess: () => { toast.success("Unmatched"); qc.invalidateQueries({ queryKey: ["bank-txns"] }); qc.invalidateQueries({ queryKey: ["bank-summary"] }); },
  });
  const del = useMutation({
    mutationFn: (id: number) => j(`/api/bank-reconciliation/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["bank-txns"] }); qc.invalidateQueries({ queryKey: ["bank-summary"] }); },
  });

  const markManual = (id: number) => match.mutate({ id, body: { reconciled: true } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Landmark className="h-6 w-6" />Bank Reconciliation</h2>
          <p className="text-muted-foreground text-sm">Match bank statement entries against pharmacy sales & invoices</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openImport} onOpenChange={setOpenImport}>
            <DialogTrigger asChild><Button variant="outline">Import CSV</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Bulk Import Bank Statement</DialogTitle></DialogHeader>
              <div className="space-y-2">
                <Label className="text-xs">CSV format: <code>date,description,reference,amount,credit|debit</code></Label>
                <Textarea rows={10} value={csv} onChange={e => setCsv(e.target.value)}
                  placeholder={`2026-05-01,UPI Receipt 234,UPI234,5000,credit\n2026-05-02,NEFT Inward,NEFT891,12500,credit`} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenImport(false)}>Cancel</Button>
                <Button onClick={() => importBulk.mutate()} disabled={!csv.trim() || importBulk.isPending}>Import</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Entry</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Bank Transaction</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Date</Label><Input type="date" value={form.txnDate} onChange={e => setForm({ ...form, txnDate: e.target.value })} /></div>
                  <div><Label>Type</Label><Select value={form.txnType} onValueChange={v => setForm({ ...form, txnType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="credit">Credit (incoming)</SelectItem><SelectItem value="debit">Debit (outgoing)</SelectItem></SelectContent>
                  </Select></div>
                </div>
                <div><Label>Amount (₹)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Reference</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
                  <div><Label>Mode</Label><Select value={form.mode} onValueChange={v => setForm({ ...form, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Bank Transfer", "UPI", "NEFT", "RTGS", "IMPS", "Cheque", "Cash Deposit", "Card"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenNew(false)}>Cancel</Button>
                <Button onClick={() => create.mutate()} disabled={!form.amount || create.isPending}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Entries</div><div className="text-2xl font-bold">{summary?.total || 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Credits</div><div className="text-xl font-bold text-green-600">{inr(summary?.credits)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Debits</div><div className="text-xl font-bold text-red-600">{inr(summary?.debits)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Net Balance</div><div className="text-xl font-bold">{inr(summary?.netBalance)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Reconciled / Open</div><div className="text-lg font-bold"><span className="text-green-600">{summary?.reconciledCount || 0}</span> / <span className="text-orange-600">{summary?.unreconciledCount || 0}</span></div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="unreconciled">Unreconciled</TabsTrigger>
          <TabsTrigger value="reconciled">Reconciled</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Reference</TableHead>
                <TableHead>Mode</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead>
                <TableHead>Match</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(txns || []).length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center h-24 text-muted-foreground">No transactions.</TableCell></TableRow>
                ) : (txns || []).map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{t.txnDate}</TableCell>
                    <TableCell>{t.description || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{t.reference || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{t.mode || "—"}</Badge></TableCell>
                    <TableCell><Badge className={t.txnType === "credit" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{t.txnType}</Badge></TableCell>
                    <TableCell className={`font-semibold ${t.txnType === "credit" ? "text-green-600" : "text-red-600"}`}>{inr(t.amount)}</TableCell>
                    <TableCell className="text-xs">
                      {t.matchedPharmacySaleId ? <Badge variant="outline">Pharmacy #{t.matchedPharmacySaleId}</Badge>
                        : t.matchedInvoiceId ? <Badge variant="outline">Invoice #{t.matchedInvoiceId}</Badge>
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {t.reconciled ? <Badge className="bg-green-100 text-green-700">Reconciled</Badge> : <Badge variant="outline">Open</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!t.reconciled && <Button size="sm" variant="outline" onClick={() => setOpenMatch(t)}><Link2 className="h-3 w-3" /></Button>}
                        {!t.reconciled && <Button size="sm" variant="ghost" onClick={() => markManual(t.id)}>Mark</Button>}
                        {t.reconciled && <Button size="icon" variant="ghost" onClick={() => unmatch.mutate(t.id)}><Unlink className="h-3 w-3" /></Button>}
                        <Button size="icon" variant="ghost" onClick={() => del.mutate(t.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!openMatch} onOpenChange={v => !v && setOpenMatch(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Suggested Matches · {inr(openMatch?.amount)} on {openMatch?.txnDate}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold mb-2">Pharmacy Sales</div>
              {(suggestions?.pharmacySales || []).length === 0 ? <p className="text-xs text-muted-foreground">None.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Bill</TableHead><TableHead>Date</TableHead><TableHead>Paid</TableHead><TableHead>Mode</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {suggestions.pharmacySales.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.billNo}</TableCell>
                        <TableCell>{s.billDate}</TableCell>
                        <TableCell>{inr(s.paidAmount)}</TableCell>
                        <TableCell><Badge variant="outline">{s.paymentMode}</Badge></TableCell>
                        <TableCell><Button size="sm" onClick={() => match.mutate({ id: openMatch.id, body: { matchedPharmacySaleId: s.id, reconciled: true } })}>Match</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold mb-2">Invoices</div>
              {(suggestions?.invoices || []).length === 0 ? <p className="text-xs text-muted-foreground">None.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Paid</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {suggestions.invoices.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.invoiceNo}</TableCell>
                        <TableCell>{s.invoiceDate}</TableCell>
                        <TableCell>{inr(s.paidAmount)}</TableCell>
                        <TableCell><Button size="sm" onClick={() => match.mutate({ id: openMatch.id, body: { matchedInvoiceId: s.id, reconciled: true } })}>Match</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
