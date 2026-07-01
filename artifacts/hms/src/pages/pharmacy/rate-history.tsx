import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

async function fetchHistory(status?: string) {
  const p = status ? `?status=${status}` : "";
  const r = await fetch(`/api/pharmacy/rate-history${p}`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}
async function fetchMedicines() { const r = await fetch("/api/pharmacy/medicines?limit=500", { credentials: "include" }); if (!r.ok) return []; const data = await r.json(); return Array.isArray(data) ? data : []; }

export default function RateHistoryPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ medicineId: "", changedField: "mrp", newValue: "", changeReason: "", effectiveDate: new Date().toISOString().slice(0, 10) });

  const { data: history = [], isLoading } = useQuery({ queryKey: ["rate-history", filterStatus], queryFn: () => fetchHistory(filterStatus !== "all" ? filterStatus : undefined) });
  const { data: medicines = [] } = useQuery({ queryKey: ["medicines-list"], queryFn: fetchMedicines });
  const safeHistory = Array.isArray(history) ? history : [];
  const safeMedicines = Array.isArray(medicines) ? medicines : [];

  const addChange = useMutation({
    mutationFn: async (d: any) => { const r = await fetch("/api/pharmacy/rate-history", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(d) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("Rate change submitted"); qc.invalidateQueries({ queryKey: ["rate-history"] }); setShowAdd(false); setForm({ medicineId: "", changedField: "mrp", newValue: "", changeReason: "", effectiveDate: new Date().toISOString().slice(0, 10) }); },
    onError: () => toast.error("Failed"),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => { const r = await fetch(`/api/pharmacy/rate-history/${id}/approve`, { method: "PUT", credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("Rate change approved"); qc.invalidateQueries({ queryKey: ["rate-history"] }); },
    onError: () => toast.error("Failed"),
  });

  const FIELD_LABELS: Record<string, string> = { mrp: "MRP", sale_rate: "Sale Rate", purchase_rate: "Purchase Rate" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-xl font-bold">MRP / Rate Change History</h1><p className="text-sm text-muted-foreground">Audit trail for medicine price changes with approval workflow</p></div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1.5" />Request Change</Button>
      </div>

      <div className="flex gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead>Field</TableHead>
                <TableHead className="text-right">Old Value</TableHead>
                <TableHead className="text-right">New Value</TableHead>
                <TableHead>Change%</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Changed By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                : safeHistory.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No rate changes recorded</TableCell></TableRow>
                : safeHistory.map((rec: any) => {
                  const oldVal = parseFloat(rec.oldValue ?? "0");
                  const newVal = parseFloat(rec.newValue ?? "0");
                  const changePct = oldVal > 0 ? ((newVal - oldVal) / oldVal * 100).toFixed(1) : null;
                  const isIncrease = newVal > oldVal;
                  return (
                    <TableRow key={rec.id}>
                      <TableCell className="font-medium">{rec.medicineName}</TableCell>
                      <TableCell><Badge variant="outline">{FIELD_LABELS[rec.changedField] ?? rec.changedField}</Badge></TableCell>
                      <TableCell className="text-right text-muted-foreground">₹{Number(rec.oldValue ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">₹{Number(rec.newValue).toFixed(2)}</TableCell>
                      <TableCell>
                        {changePct && (
                          <div className={`flex items-center gap-1 text-sm font-medium ${isIncrease ? "text-red-600" : "text-green-600"}`}>
                            {isIncrease ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            {isIncrease ? "+" : ""}{changePct}%
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-32 truncate">{rec.changeReason || "—"}</TableCell>
                      <TableCell>{rec.effectiveDate}</TableCell>
                      <TableCell className="text-sm">{rec.changedByName || "—"}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[rec.status] ?? ""}>{rec.status}</Badge></TableCell>
                      <TableCell>
                        {rec.status === "pending" && (
                          <Button variant="outline" size="sm" onClick={() => approveMutation.mutate(rec.id)} disabled={approveMutation.isPending}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Approve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Rate Change</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Medicine *</Label>
              <Select value={form.medicineId} onValueChange={v => setForm(f => ({ ...f, medicineId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
                <SelectContent className="max-h-48">{safeMedicines.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Rate Field *</Label>
              <Select value={form.changedField} onValueChange={v => setForm(f => ({ ...f, changedField: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mrp">MRP</SelectItem>
                  <SelectItem value="sale_rate">Sale Rate</SelectItem>
                  <SelectItem value="purchase_rate">Purchase Rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>New Value (₹) *</Label><Input type="number" step="0.01" value={form.newValue} onChange={e => setForm(f => ({ ...f, newValue: e.target.value }))} /></div>
            <div><Label>Reason</Label><Input value={form.changeReason} onChange={e => setForm(f => ({ ...f, changeReason: e.target.value }))} placeholder="e.g. Supplier price revision" /></div>
            <div><Label>Effective Date</Label><Input type="date" value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => addChange.mutate({ ...form, medicineId: Number(form.medicineId), newValue: parseFloat(form.newValue) })} disabled={!form.medicineId || !form.newValue || addChange.isPending}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
