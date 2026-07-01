import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Shield, Plus, CheckCircle2, XCircle, Clock, AlertTriangle, IndianRupee } from "lucide-react";

const STATUS_META: Record<string, { label: string; badge: string }> = {
  pending: { label: "Pending", badge: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", badge: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", badge: "bg-red-100 text-red-800" },
  partial: { label: "Partial", badge: "bg-blue-100 text-blue-800" },
};

const PAYER_TYPES = ["cash", "insurance", "tpa", "corporate", "credit"];

export default function InsuranceBilling() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("claims");
  const [filters, setFilters] = useState({ status: "", payer_type: "", from_date: "", to_date: "" });
  const [showNew, setShowNew] = useState(false);
  const [approveDialog, setApproveDialog] = useState<{ id: number; bill: string } | null>(null);
  const [approveForm, setApproveForm] = useState({ status: "approved", approved_amount: "", rejection_reason: "" });
  const [newClaim, setNewClaim] = useState({
    patient_id: "", tpa_provider_name: "", policy_no: "", preauth_ref: "",
    total_amount: "", insurance_payable: "", patient_payable: "", payer_type: "tpa", remarks: ""
  });

  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.payer_type) params.set("payer_type", filters.payer_type);
  if (filters.from_date) params.set("from_date", filters.from_date);
  if (filters.to_date) params.set("to_date", filters.to_date);

  const { data: claims = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/tpa-claims", filters],
    queryFn: async () => { const r = await fetch(`/api/pharmacy/tpa-claims?${params}`, { credentials: "include" }); if (!r.ok) throw new Error("Failed"); const data = await r.json(); return Array.isArray(data) ? data : []; },
  });

  const { data: outstanding = [] } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/tpa-reports/outstanding"],
    queryFn: async () => { const r = await fetch("/api/pharmacy/tpa-reports/outstanding", { credentials: "include" }); if (!r.ok) throw new Error("Failed"); const data = await r.json(); return Array.isArray(data) ? data : []; },
    enabled: tab === "outstanding",
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => { const r = await fetch("/api/pharmacy/tpa-claims", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("TPA claim created"); qc.invalidateQueries({ queryKey: ["/api/pharmacy/tpa-claims"] }); setShowNew(false); },
    onError: () => toast.error("Failed"),
  });

  const approveMutation = useMutation({
    mutationFn: async (data: any) => { const r = await fetch(`/api/pharmacy/tpa-claims/${data.id}/approve`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("Claim status updated"); qc.invalidateQueries({ queryKey: ["/api/pharmacy/tpa-claims"] }); setApproveDialog(null); },
    onError: () => toast.error("Failed"),
  });

  const totals = claims.reduce((acc, c: any) => ({
    total: acc.total + Number(c.total_amount ?? 0),
    insurance: acc.insurance + Number(c.insurance_payable ?? 0),
    patient: acc.patient + Number(c.patient_payable ?? 0),
    pending: acc.pending + (c.approval_status === "pending" ? Number(c.insurance_payable ?? 0) : 0),
  }), { total: 0, insurance: 0, patient: 0, pending: 0 });

  return (
    <div className="p-4 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-blue-600" />
          <div><h1 className="text-xl font-bold">Insurance / TPA Pharmacy Billing</h1><p className="text-sm text-muted-foreground">Cashless and insured pharmacy claim management</p></div>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" />New Claim</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Billed", value: totals.total, color: "text-gray-700" },
          { label: "Insurance Portion", value: totals.insurance, color: "text-blue-700" },
          { label: "Patient Portion", value: totals.patient, color: "text-green-700" },
          { label: "Pending TPA", value: totals.pending, color: "text-amber-700" },
        ].map(k => (
          <Card key={k.label}><CardContent className="pt-3 pb-2">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className={`text-xl font-bold ${k.color}`}>₹{k.value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
          </CardContent></Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="outstanding">TPA Outstanding</TabsTrigger>
        </TabsList>

        <TabsContent value="claims" className="space-y-3 pt-2">
          <Card>
            <CardContent className="pt-3 pb-2">
              <div className="flex flex-wrap gap-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={filters.status} onValueChange={v => setFilters(p => ({ ...p, status: v === "all" ? "" : v }))}>
                    <SelectTrigger className="h-8 w-36"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {Object.keys(STATUS_META).map(s => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Payer Type</Label>
                  <Select value={filters.payer_type} onValueChange={v => setFilters(p => ({ ...p, payer_type: v === "all" ? "" : v }))}>
                    <SelectTrigger className="h-8 w-32"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {PAYER_TYPES.map(t => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">From</Label><Input type="date" className="h-8 w-36" value={filters.from_date} onChange={e => setFilters(p => ({ ...p, from_date: e.target.value }))} /></div>
                <div><Label className="text-xs">To</Label><Input type="date" className="h-8 w-36" value={filters.to_date} onChange={e => setFilters(p => ({ ...p, to_date: e.target.value }))} /></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim No</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Payer / TPA</TableHead>
                  <TableHead>Policy No</TableHead>
                  <TableHead>Pre-auth Ref</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Insurance</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8">Loading…</TableCell></TableRow>
                ) : claims.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No claims found</TableCell></TableRow>
                ) : claims.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.claim_no}</TableCell>
                    <TableCell>{c.patient_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{c.payer_type?.toUpperCase()}</Badge><div className="text-xs text-muted-foreground mt-0.5">{c.tpa_provider_name ?? "—"}</div></TableCell>
                    <TableCell className="text-xs">{c.policy_no ?? "—"}</TableCell>
                    <TableCell className="text-xs">{c.preauth_ref ?? "—"}</TableCell>
                    <TableCell>₹{Number(c.total_amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-blue-700">₹{Number(c.insurance_payable).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-green-700">₹{Number(c.patient_payable).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell><Badge className={(STATUS_META[c.approval_status] ?? STATUS_META.pending).badge}>{(STATUS_META[c.approval_status] ?? { label: c.approval_status }).label}</Badge></TableCell>
                    <TableCell>
                      {c.approval_status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => { setApproveDialog({ id: c.id, bill: c.claim_no }); setApproveForm({ status: "approved", approved_amount: c.insurance_payable, rejection_reason: "" }); }}>
                          Update
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="outstanding" className="pt-2">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>TPA Provider</TableHead>
                  <TableHead>Total Claims</TableHead>
                  <TableHead>Total Billed</TableHead>
                  <TableHead>Pending Amount</TableHead>
                  <TableHead>Approved (Unsettled)</TableHead>
                  <TableHead>Rejected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstanding.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No outstanding TPA data</TableCell></TableRow>
                ) : outstanding.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.tpa_provider_name ?? "Unknown"}</TableCell>
                    <TableCell>{r.total_claims}</TableCell>
                    <TableCell>₹{Number(r.total_billed).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-amber-700 font-semibold">₹{Number(r.pending_amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-green-700">₹{Number(r.approved_not_settled ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-red-700">₹{Number(r.rejected_amount ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Claim */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New TPA / Insurance Claim</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Patient ID *</Label><Input placeholder="Patient ID" value={newClaim.patient_id} onChange={e => setNewClaim(p => ({ ...p, patient_id: e.target.value }))} /></div>
              <div><Label>Payer Type</Label>
                <Select value={newClaim.payer_type} onValueChange={v => setNewClaim(p => ({ ...p, payer_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYER_TYPES.map(t => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>TPA Provider</Label><Input value={newClaim.tpa_provider_name} onChange={e => setNewClaim(p => ({ ...p, tpa_provider_name: e.target.value }))} /></div>
              <div><Label>Policy No</Label><Input value={newClaim.policy_no} onChange={e => setNewClaim(p => ({ ...p, policy_no: e.target.value }))} /></div>
              <div><Label>Pre-auth Ref</Label><Input value={newClaim.preauth_ref} onChange={e => setNewClaim(p => ({ ...p, preauth_ref: e.target.value }))} /></div>
              <div><Label>Total Amount (₹)</Label><Input type="number" value={newClaim.total_amount} onChange={e => setNewClaim(p => ({ ...p, total_amount: e.target.value }))} /></div>
              <div><Label>Insurance Payable (₹)</Label><Input type="number" value={newClaim.insurance_payable} onChange={e => setNewClaim(p => ({ ...p, insurance_payable: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Patient Payable (₹)</Label><Input type="number" value={newClaim.patient_payable} onChange={e => setNewClaim(p => ({ ...p, patient_payable: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Remarks</Label><Textarea rows={2} value={newClaim.remarks} onChange={e => setNewClaim(p => ({ ...p, remarks: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ ...newClaim, patient_id: Number(newClaim.patient_id), total_amount: Number(newClaim.total_amount), insurance_payable: Number(newClaim.insurance_payable), patient_payable: Number(newClaim.patient_payable) })}>Create Claim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={() => setApproveDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Claim — {approveDialog?.bill}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Status</Label>
              <Select value={approveForm.status} onValueChange={v => setApproveForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="partial">Partial Approval</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {approveForm.status !== "rejected" && <div><Label>Approved Amount (₹)</Label><Input type="number" value={approveForm.approved_amount} onChange={e => setApproveForm(p => ({ ...p, approved_amount: e.target.value }))} /></div>}
            {approveForm.status === "rejected" && <div><Label>Rejection Reason</Label><Textarea rows={2} value={approveForm.rejection_reason} onChange={e => setApproveForm(p => ({ ...p, rejection_reason: e.target.value }))} /></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>Cancel</Button>
            <Button disabled={approveMutation.isPending} onClick={() => approveMutation.mutate({ id: approveDialog!.id, ...approveForm, approved_amount: approveForm.approved_amount ? Number(approveForm.approved_amount) : undefined })}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
