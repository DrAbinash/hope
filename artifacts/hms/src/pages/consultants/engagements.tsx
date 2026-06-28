import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Wallet, BadgeCheck, ArrowLeft } from "lucide-react";

const STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

export default function ConsultantEngagements() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [consultantFilter, setConsultantFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ consultantId: "", patientId: "", invoiceId: "", serviceDate: new Date().toISOString().slice(0, 10), serviceDescription: "", serviceAmount: "" });
  const [pay, setPay] = useState<any>({ paidOn: new Date().toISOString().slice(0, 10), paymentMode: "cash", reference: "", notes: "" });

  const { data: consultants } = useQuery({
    queryKey: ["/api/consultants", "active"],
    queryFn: async () => {
      const r = await fetch("/api/consultants?active=true", { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ consultants: any[] }>;
    },
  });
  const { data: patients } = useQuery({
    queryKey: ["/api/patients"],
    queryFn: async () => {
      const r = await fetch("/api/patients?limit=200", { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ patients: any[] }>;
    },
  });
  const { data, isLoading } = useQuery({
    queryKey: ["/api/consultant-engagements", consultantFilter, statusFilter],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (consultantFilter) qs.set("consultantId", consultantFilter);
      if (statusFilter) qs.set("status", statusFilter);
      const r = await fetch(`/api/consultant-engagements?${qs}`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ engagements: any[]; summary: any }>;
    },
  });

  const selectedConsultant = (consultants?.consultants || []).find((d) => String(d.id) === form.consultantId);
  const previewPayout = (() => {
    const amt = Number(form.serviceAmount) || 0;
    if (!selectedConsultant || amt <= 0) return 0;
    const v = Number(selectedConsultant.paymentValue) || 0;
    return selectedConsultant.paymentType === "fixed" ? +v.toFixed(2) : +((amt * v) / 100).toFixed(2);
  })();

  async function submit() {
    if (!form.consultantId) { toast({ title: "Pick a consultant", variant: "destructive" }); return; }
    const amt = Number(form.serviceAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast({ title: "Service amount must be > 0", variant: "destructive" }); return; }
    try {
      const r = await fetch("/api/consultant-engagements", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      qc.invalidateQueries({ queryKey: ["/api/consultant-engagements"] });
      toast({ title: "Engagement recorded" });
      setOpen(false);
      setForm({ consultantId: "", patientId: "", invoiceId: "", serviceDate: new Date().toISOString().slice(0, 10), serviceDescription: "", serviceAmount: "" });
    } catch (e: any) { toast({ title: "Save failed", description: e.message, variant: "destructive" }); }
  }
  async function markPaid(p: any) {
    try {
      const r = await fetch(`/api/consultant-engagements/${p.id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "paid", ...pay }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      qc.invalidateQueries({ queryKey: ["/api/consultant-engagements"] });
      toast({ title: "Marked as paid" });
      setPayOpen(null);
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  }

  const summary = data?.summary || { total: 0, pending: 0, paid: 0, count: 0 };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Wallet className="w-6 h-6"/> Consultant Engagements</h1>
          <p className="text-muted-foreground text-sm">Record consultant work on cases and pay them out per the configured basis.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/consultants"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-1"/>Back</Button></Link>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1"/>Record Engagement</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Engagements</div><div className="text-xl font-semibold">{summary.count}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total Payout</div><div className="text-xl font-semibold">₹{Number(summary.total).toLocaleString("en-IN")}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Pending</div><div className="text-xl font-semibold text-amber-700">₹{Number(summary.pending).toLocaleString("en-IN")}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Paid</div><div className="text-xl font-semibold text-emerald-700">₹{Number(summary.paid).toLocaleString("en-IN")}</div></CardContent></Card>
      </div>

      <Card><CardContent className="p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <Select value={consultantFilter || "all"} onValueChange={(v) => setConsultantFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All consultants"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All consultants</SelectItem>
              {(consultants?.consultants || []).map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All status"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Consultant</TableHead><TableHead>Patient</TableHead>
            <TableHead>Service</TableHead><TableHead className="text-right">Service Amt</TableHead>
            <TableHead>Basis</TableHead><TableHead className="text-right">Payout</TableHead>
            <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
              : (data?.engagements || []).length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No engagements yet.</TableCell></TableRow>
              : (data?.engagements || []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.serviceDate}</TableCell>
                  <TableCell className="font-medium">{p.consultantName}</TableCell>
                  <TableCell>{p.patientName ? <span>{p.patientName}<span className="text-xs text-muted-foreground ml-1">({p.uhid})</span></span> : "—"}</TableCell>
                  <TableCell>{p.serviceDescription || (p.invoiceNo ? `Invoice ${p.invoiceNo}` : "—")}</TableCell>
                  <TableCell className="text-right">₹{Number(p.serviceAmount).toLocaleString("en-IN")}</TableCell>
                  <TableCell>{p.paymentType === "percentage" ? `${Number(p.paymentValue).toFixed(2)}%` : `₹${Number(p.paymentValue).toLocaleString("en-IN")} fixed`}</TableCell>
                  <TableCell className="text-right font-medium">₹{Number(p.payoutAmount).toLocaleString("en-IN")}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded ${STATUS[p.status] || ""}`}>{p.status}</span></TableCell>
                  <TableCell className="text-right">
                    {p.status === "pending" ? <Button size="sm" variant="outline" onClick={() => setPayOpen(p)}><BadgeCheck className="w-4 h-4 mr-1"/>Mark Paid</Button> : null}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Record Consultant Engagement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Consultant *</Label>
              <Select value={form.consultantId} onValueChange={(v) => setForm({ ...form, consultantId: v })}>
                <SelectTrigger><SelectValue placeholder="Choose consultant"/></SelectTrigger>
                <SelectContent>
                  {(consultants?.consultants || []).map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name} — {d.paymentType === "percentage" ? `${Number(d.paymentValue).toFixed(2)}%` : `₹${Number(d.paymentValue)} fixed`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Service Date</Label><Input type="date" value={form.serviceDate} onChange={(e) => setForm({ ...form, serviceDate: e.target.value })}/></div>
              <div><Label>Service Amount (₹) *</Label><Input type="number" min="0" step="0.01" value={form.serviceAmount} onChange={(e) => setForm({ ...form, serviceAmount: e.target.value })}/></div>
            </div>
            <div>
              <Label>Patient (optional)</Label>
              <Select value={form.patientId || "none"} onValueChange={(v) => setForm({ ...form, patientId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Pick patient"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {(patients?.patients || []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.uhid})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Service Description</Label><Input value={form.serviceDescription} onChange={(e) => setForm({ ...form, serviceDescription: e.target.value })} placeholder="e.g. Anaesthesia, surgical assist, expert opinion"/></div>
            <div><Label>Invoice ID (optional)</Label><Input value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value.replace(/[^0-9]/g, "") })}/></div>
            {selectedConsultant ? (
              <div className="bg-muted/50 p-3 rounded text-sm">
                <div>Basis: <strong>{selectedConsultant.paymentType === "percentage" ? `${Number(selectedConsultant.paymentValue).toFixed(2)}% of service` : `₹${Number(selectedConsultant.paymentValue).toLocaleString("en-IN")} fixed`}</strong></div>
                <div>Computed payout: <strong className="text-emerald-700">₹{previewPayout.toLocaleString("en-IN")}</strong></div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payOpen} onOpenChange={(o) => { if (!o) setPayOpen(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Payout as Paid</DialogTitle></DialogHeader>
          {payOpen ? (
            <div className="space-y-3">
              <div className="text-sm">Consultant: <strong>{payOpen.consultantName}</strong> — Payout: <strong>₹{Number(payOpen.payoutAmount).toLocaleString("en-IN")}</strong></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Paid On</Label><Input type="date" value={pay.paidOn} onChange={(e) => setPay({ ...pay, paidOn: e.target.value })}/></div>
                <div>
                  <Label>Mode</Label>
                  <Select value={pay.paymentMode} onValueChange={(v) => setPay({ ...pay, paymentMode: v })}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Reference / Txn No.</Label><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })}/></div>
              <div><Label>Notes</Label><Textarea rows={2} value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })}/></div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(null)}>Cancel</Button>
            <Button onClick={() => markPaid(payOpen)}>Confirm Paid</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
