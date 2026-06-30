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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CreditCard, Plus, AlertTriangle, CheckCircle2, User } from "lucide-react";

function CreditBar({ pct }: { pct: number }) {
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs font-medium w-10 text-right">{pct}%</span>
    </div>
  );
}

export default function CreditLimits() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("limits");
  const [showNew, setShowNew] = useState(false);
  const [editDialog, setEditDialog] = useState<any | null>(null);
  const [txnPatient, setTxnPatient] = useState<any | null>(null);
  const [newForm, setNewForm] = useState({ patient_id: "", patient_type: "general", credit_limit: "", emergency_override_limit: "", notes: "" });

  const { data: limits = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/credit-limits"],
    queryFn: async () => {
      const r = await fetch("/api/pharmacy/credit-limits", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch credit limits");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: aging = [] } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/credit-limits/reports/aging"],
    queryFn: async () => {
      const r = await fetch("/api/pharmacy/credit-limits/reports/aging", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch aging report");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: tab === "aging",
  });

  const { data: txns = [] } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/credit-limits/patient-txns", txnPatient?.patient_id],
    queryFn: async () => {
      const r = await fetch(`/api/pharmacy/credit-limits/${txnPatient!.patient_id}/transactions`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch transactions");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!txnPatient,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/pharmacy/credit-limits", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Failed to save credit limit");
      return r.json();
    },
    onSuccess: () => { toast.success("Credit limit saved"); qc.invalidateQueries({ queryKey: ["/api/pharmacy/credit-limits"] }); setShowNew(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const r = await fetch(`/api/pharmacy/credit-limits/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Failed to update credit limit");
      return r.json();
    },
    onSuccess: () => { toast.success("Credit limit updated"); qc.invalidateQueries({ queryKey: ["/api/pharmacy/credit-limits"] }); setEditDialog(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const totals = limits.reduce((a, r: any) => ({
    outstanding: a.outstanding + Number(r.current_outstanding ?? 0),
    limit: a.limit + Number(r.credit_limit ?? 0),
    exceed: a.exceed + (Number(r.current_outstanding ?? 0) > Number(r.credit_limit ?? 0) ? 1 : 0),
  }), { outstanding: 0, limit: 0, exceed: 0 });

  return (
    <div className="p-4 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-indigo-600" />
          <div><h1 className="text-xl font-bold">Patient Credit Limit Control</h1><p className="text-sm text-muted-foreground">Prevent uncontrolled dues and track patient outstanding</p></div>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" />Add Limit</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-3 pb-2">
          <div className="text-xs text-muted-foreground">Total Outstanding</div>
          <div className="text-2xl font-bold text-amber-700">₹{totals.outstanding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2">
          <div className="text-xs text-muted-foreground">Total Limit Sanctioned</div>
          <div className="text-2xl font-bold">₹{totals.limit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
        </CardContent></Card>
        <Card className={totals.exceed > 0 ? "border-2 border-red-200 bg-red-50" : ""}><CardContent className="pt-3 pb-2">
          <div className="text-xs text-muted-foreground">Limit Exceeded</div>
          <div className={`text-2xl font-bold ${totals.exceed > 0 ? "text-red-700" : "text-green-700"}`}>{totals.exceed} patients</div>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="limits">Credit Limits</TabsTrigger>
          <TabsTrigger value="aging">Due Aging</TabsTrigger>
        </TabsList>

        <TabsContent value="limits" className="pt-2">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Credit Limit</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Emergency Limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Utilisation</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10">Loading…</TableCell></TableRow>
                ) : limits.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No credit limits configured</TableCell></TableRow>
                ) : limits.map((r: any) => {
                  const pct = r.credit_limit > 0 ? Math.round(r.current_outstanding / r.credit_limit * 100) : 0;
                  const status = pct >= 100 ? "red" : pct >= 80 ? "yellow" : "green";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.patient_name ?? `Patient #${r.patient_id}`}<div className="text-xs text-muted-foreground">{r.patient_phone}</div></TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{r.patient_type}</Badge></TableCell>
                      <TableCell>₹{Number(r.credit_limit).toLocaleString("en-IN")}</TableCell>
                      <TableCell className={status === "red" ? "text-red-700 font-bold" : status === "yellow" ? "text-amber-700 font-semibold" : "text-green-700"}>₹{Number(r.current_outstanding).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-xs">₹{Number(r.emergency_override_limit).toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        {status === "red" ? <Badge className="bg-red-100 text-red-800">Exceeded</Badge>
                          : status === "yellow" ? <Badge className="bg-amber-100 text-amber-800">Nearing Limit</Badge>
                          : <Badge className="bg-green-100 text-green-800">Within Limit</Badge>}
                      </TableCell>
                      <TableCell className="w-40"><CreditBar pct={pct} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditDialog({ id: r.id, credit_limit: r.credit_limit, emergency_override_limit: r.emergency_override_limit, notes: r.notes })}>Edit</Button>
                          <Button size="sm" variant="ghost" onClick={() => setTxnPatient(r)}>Txns</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="aging" className="pt-2">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>0–30 days</TableHead>
                  <TableHead>31–60 days</TableHead>
                  <TableHead>61–90 days</TableHead>
                  <TableHead>&gt;90 days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aging.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No dues to show</TableCell></TableRow>
                ) : aging.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.patient_name}</TableCell>
                    <TableCell className="text-red-700 font-bold">₹{Number(r.current_outstanding).toLocaleString("en-IN")}</TableCell>
                    <TableCell>₹{Number(r.due_0_30).toLocaleString("en-IN")}</TableCell>
                    <TableCell>₹{Number(r.due_31_60).toLocaleString("en-IN")}</TableCell>
                    <TableCell>₹{Number(r.due_61_90).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-red-700 font-semibold">₹{Number(r.due_gt_90).toLocaleString("en-IN")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Limit Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Credit Limit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Patient ID</Label><Input placeholder="Patient ID" value={newForm.patient_id} onChange={e => setNewForm(p => ({ ...p, patient_id: e.target.value }))} /></div>
            <div><Label>Patient Type</Label>
              <Select value={newForm.patient_type} onValueChange={v => setNewForm(p => ({ ...p, patient_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["general", "opd", "ipd", "staff", "corporate", "insurance"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Credit Limit (₹) *</Label><Input type="number" value={newForm.credit_limit} onChange={e => setNewForm(p => ({ ...p, credit_limit: e.target.value }))} /></div>
              <div><Label>Emergency Override (₹)</Label><Input type="number" value={newForm.emergency_override_limit} onChange={e => setNewForm(p => ({ ...p, emergency_override_limit: e.target.value }))} /></div>
            </div>
            <div><Label>Notes</Label><Input value={newForm.notes} onChange={e => setNewForm(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ ...newForm, patient_id: newForm.patient_id ? Number(newForm.patient_id) : null, credit_limit: Number(newForm.credit_limit), emergency_override_limit: Number(newForm.emergency_override_limit) })}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Credit Limit</DialogTitle></DialogHeader>
          {editDialog && (
            <div className="space-y-3">
              <div><Label>Credit Limit (₹)</Label><Input type="number" value={editDialog.credit_limit} onChange={e => setEditDialog((p: any) => ({ ...p, credit_limit: e.target.value }))} /></div>
              <div><Label>Emergency Override (₹)</Label><Input type="number" value={editDialog.emergency_override_limit} onChange={e => setEditDialog((p: any) => ({ ...p, emergency_override_limit: e.target.value }))} /></div>
              <div><Label>Notes</Label><Input value={editDialog.notes ?? ""} onChange={e => setEditDialog((p: any) => ({ ...p, notes: e.target.value }))} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ ...editDialog, credit_limit: Number(editDialog.credit_limit), emergency_override_limit: Number(editDialog.emergency_override_limit) })}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={!!txnPatient} onOpenChange={() => setTxnPatient(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Transactions — {txnPatient?.patient_name}</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Bill No</TableHead><TableHead>Balance</TableHead></TableRow></TableHeader>
              <TableBody>
                {txns.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No transactions</TableCell></TableRow>
                  : txns.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{new Date(t.created_at).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell><Badge variant={t.transaction_type === "debit" ? "destructive" : "outline"}>{t.transaction_type}</Badge></TableCell>
                      <TableCell className={t.transaction_type === "debit" ? "text-red-700" : "text-green-700"}>₹{Number(t.amount).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-xs">{t.bill_no ?? "—"}</TableCell>
                      <TableCell className="text-xs">₹{Number(t.running_balance ?? 0).toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTxnPatient(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
