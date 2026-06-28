import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Plus, Percent, Check, X, Printer } from "lucide-react";

const STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
};

export default function DiscountsPage() {
  const { user } = useAuth();
  const isApprover = user?.role === "admin";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [open, setOpen] = useState(false);
  const [rejectFor, setRejectFor] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState<any>({
    invoiceId: "", patientId: "", originalAmount: "", discountType: "fixed", discountValue: "", reason: "",
  });

  const { data: patients } = useQuery({
    queryKey: ["/api/patients", "discounts"],
    queryFn: async () => {
      const r = await fetch("/api/patients?limit=200", { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ patients: any[] }>;
    },
  });

  const listKey = ["/api/discounts", tab];
  const { data, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (tab !== "all" && tab !== "report") qs.set("status", tab);
      const r = await fetch(`/api/discounts?${qs}`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ discounts: any[] }>;
    },
    enabled: tab !== "report",
  });

  const { data: report } = useQuery({
    queryKey: ["/api/discounts-report", fromDate, toDate],
    queryFn: async () => {
      const qs = new URLSearchParams({ fromDate, toDate });
      const r = await fetch(`/api/discounts-report/summary?${qs}`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: tab === "report" && isApprover,
  });

  const previewAmount = (() => {
    const orig = Number(form.originalAmount) || 0;
    const v = Number(form.discountValue) || 0;
    if (orig <= 0 || v <= 0) return 0;
    if (form.discountType === "percentage") return +Math.min(orig, (orig * Math.min(100, v)) / 100).toFixed(2);
    return +Math.min(orig, v).toFixed(2);
  })();

  async function submit() {
    const orig = Number(form.originalAmount);
    const dv = Number(form.discountValue);
    if (!Number.isFinite(orig) || orig <= 0) { toast({ title: "Original amount required", variant: "destructive" }); return; }
    if (!Number.isFinite(dv) || dv <= 0) { toast({ title: "Discount value required", variant: "destructive" }); return; }
    if (!form.reason.trim()) { toast({ title: "Reason required", variant: "destructive" }); return; }
    try {
      const body: any = {
        originalAmount: orig, discountType: form.discountType, discountValue: dv, reason: form.reason,
      };
      if (form.invoiceId) body.invoiceId = parseInt(form.invoiceId);
      if (form.patientId) body.patientId = parseInt(form.patientId);
      const r = await fetch("/api/discounts", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      qc.invalidateQueries({ queryKey: ["/api/discounts"] });
      toast({ title: "Discount request submitted" });
      setOpen(false);
      setForm({ invoiceId: "", patientId: "", originalAmount: "", discountType: "fixed", discountValue: "", reason: "" });
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  }

  async function approve(d: any) {
    try {
      const r = await fetch(`/api/discounts/${d.id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      qc.invalidateQueries({ queryKey: ["/api/discounts"] });
      toast({ title: "Approved" + (d.invoiceId ? " & applied to invoice" : "") });
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  }

  async function reject() {
    if (!rejectFor) return;
    try {
      const r = await fetch(`/api/discounts/${rejectFor.id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject", rejectionReason: rejectReason }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      qc.invalidateQueries({ queryKey: ["/api/discounts"] });
      toast({ title: "Rejected" });
      setRejectFor(null); setRejectReason("");
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  }

  const rows = data?.discounts || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Percent className="w-6 h-6"/> Discount Approvals</h1>
          <p className="text-muted-foreground text-sm">Request, approve and audit discounts before they are applied to invoices.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1"/>Request Discount</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
          {isApprover ? <TabsTrigger value="report">Report</TabsTrigger> : null}
        </TabsList>

        {["pending", "approved", "rejected", "all"].map((t) => (
          <TabsContent key={t} value={t}>
            <Card><CardContent className="p-4">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Original</TableHead>
                  <TableHead>Basis</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {isLoading ? <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                    : rows.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">No discount requests.</TableCell></TableRow>
                    : rows.map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell>{new Date(d.createdAt).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell>{d.patientName || "—"}</TableCell>
                        <TableCell>{d.invoiceId ? `#${d.invoiceId}` : "—"}</TableCell>
                        <TableCell className="text-right">₹{Number(d.originalAmount).toLocaleString("en-IN")}</TableCell>
                        <TableCell>{d.discountType === "percentage" ? `${Number(d.discountValue).toFixed(2)}%` : `₹${Number(d.discountValue).toLocaleString("en-IN")} fixed`}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-700">₹{Number(d.discountAmount).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="max-w-xs truncate" title={d.reason}>{d.reason}</TableCell>
                        <TableCell>{d.requestedBy} <span className="text-xs text-muted-foreground">({d.requestedRole})</span></TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded ${STATUS[d.status] || ""}`}>{d.status}</span>
                          {d.appliedToInvoice ? <span className="ml-1 text-xs text-emerald-700">applied</span> : null}
                        </TableCell>
                        <TableCell className="text-right">
                          {d.status === "pending" && isApprover ? (
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="outline" onClick={() => approve(d)}><Check className="w-4 h-4 mr-1"/>Approve</Button>
                              <Button size="sm" variant="outline" onClick={() => setRejectFor(d)}><X className="w-4 h-4 mr-1"/>Reject</Button>
                            </div>
                          ) : d.status === "rejected" && d.rejectionReason ? <span className="text-xs text-muted-foreground" title={d.rejectionReason}>Reason on file</span>
                            : d.status === "approved" ? <span className="text-xs text-muted-foreground">by {d.approvedBy}</span> : null}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        ))}

        {isApprover ? (
          <TabsContent value="report">
            <Card><CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3 print:hidden">
                <div><Label>From</Label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}/></div>
                <div><Label>To</Label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}/></div>
                <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1"/>Print</Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total Requests</div><div className="text-xl font-semibold">{report?.totals?.totalRequested ?? 0}</div></CardContent></Card>
                <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Pending</div><div className="text-xl font-semibold text-amber-700">{report?.totals?.pending ?? 0}</div></CardContent></Card>
                <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Approved</div><div className="text-xl font-semibold text-emerald-700">{report?.totals?.approvedCount ?? 0}</div></CardContent></Card>
                <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total Discount Given</div><div className="text-xl font-semibold">₹{Number(report?.totals?.totalApprovedAmount ?? 0).toLocaleString("en-IN")}</div></CardContent></Card>
              </div>
              <div>
                <h3 className="font-medium mb-2">By Requester (approved only)</h3>
                <Table>
                  <TableHeader><TableRow><TableHead>Requested By</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Total Discount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(report?.byRequester || []).length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-3 text-muted-foreground">No approved discounts in range.</TableCell></TableRow>
                      : (report?.byRequester || []).map((r: any) => (
                        <TableRow key={r.requestedBy}>
                          <TableCell>{r.requestedBy}</TableCell>
                          <TableCell className="text-right">{r.count}</TableCell>
                          <TableCell className="text-right">₹{Number(r.amount).toLocaleString("en-IN")}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              <div>
                <h3 className="font-medium mb-2">All Records</h3>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Date</TableHead><TableHead>Patient</TableHead><TableHead>Status</TableHead>
                    <TableHead className="text-right">Original</TableHead><TableHead className="text-right">Discount</TableHead>
                    <TableHead>Requested By</TableHead><TableHead>Approved By</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(report?.details || []).map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell>{new Date(d.createdAt).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell>{d.patientName || "—"}</TableCell>
                        <TableCell><span className={`text-xs px-2 py-0.5 rounded ${STATUS[d.status] || ""}`}>{d.status}</span></TableCell>
                        <TableCell className="text-right">₹{Number(d.originalAmount).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{Number(d.discountAmount).toLocaleString("en-IN")}</TableCell>
                        <TableCell>{d.requestedBy}</TableCell>
                        <TableCell>{d.approvedBy || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent></Card>
          </TabsContent>
        ) : null}
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Request Discount</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Invoice ID (optional)</Label><Input value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value.replace(/[^0-9]/g, "") })} placeholder="e.g. 42"/></div>
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
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Original Amount (₹) *</Label><Input type="number" min="0" step="0.01" value={form.originalAmount} onChange={(e) => setForm({ ...form, originalAmount: e.target.value })}/></div>
              <div>
                <Label>Type</Label>
                <Select value={form.discountType} onValueChange={(v) => setForm({ ...form, discountType: v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed ₹</SelectItem>
                    <SelectItem value="percentage">Percentage %</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Value *</Label><Input type="number" min="0" step="0.01" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })}/></div>
            </div>
            <div><Label>Reason *</Label><Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Justification for discount"/></div>
            {previewAmount > 0 ? <div className="bg-muted/50 p-3 rounded text-sm">Computed discount: <strong className="text-emerald-700">₹{previewAmount.toLocaleString("en-IN")}</strong></div> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectFor} onOpenChange={(o) => { if (!o) { setRejectFor(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Discount Request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">Discount: <strong>₹{Number(rejectFor?.discountAmount || 0).toLocaleString("en-IN")}</strong> for {rejectFor?.patientName || "—"}</div>
            <div><Label>Rejection Reason</Label><Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancel</Button>
            <Button variant="destructive" onClick={reject}>Confirm Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
