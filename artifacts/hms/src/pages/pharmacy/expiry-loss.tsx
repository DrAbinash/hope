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
import { Plus, AlertTriangle, CheckCircle2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  disposed: "bg-gray-100 text-gray-700",
};
const DISPOSAL_METHODS = ["incineration", "return_to_vendor", "municipal_waste", "autoclave", "chemical_deactivation"];
const DISPOSAL_REASONS = ["expired", "damaged", "recalled", "contaminated", "deteriorated"];

async function fetchLosses(status?: string) {
  const p = status ? `?status=${status}` : "";
  const r = await fetch(`/api/pharmacy/expiry-loss${p}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}
async function fetchMedicines() {
  const r = await fetch("/api/pharmacy/medicines?limit=500");
  if (!r.ok) return [];
  return r.json();
}

export default function ExpiryLossPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ medicineId: "", medicineName: "", batchNo: "", expiryDate: "", quantity: "", disposalReason: "expired", disposalMethod: "incineration", notes: "" });

  const { data: losses = [], isLoading } = useQuery({ queryKey: ["expiry-losses", filterStatus], queryFn: () => fetchLosses(filterStatus || undefined) });
  const { data: medicines = [] } = useQuery({ queryKey: ["medicines-list"], queryFn: fetchMedicines });

  const addLoss = useMutation({
    mutationFn: async (d: any) => { const r = await fetch("/api/pharmacy/expiry-loss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("Loss entry created"); qc.invalidateQueries({ queryKey: ["expiry-losses"] }); setShowAdd(false); setForm({ medicineId: "", medicineName: "", batchNo: "", expiryDate: "", quantity: "", disposalReason: "expired", disposalMethod: "incineration", notes: "" }); },
    onError: () => toast.error("Failed"),
  });

  const approveLoss = useMutation({
    mutationFn: async (id: number) => { const r = await fetch(`/api/pharmacy/expiry-loss/${id}/approve`, { method: "PUT" }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("Loss approved — stock decremented"); qc.invalidateQueries({ queryKey: ["expiry-losses"] }); },
    onError: () => toast.error("Failed"),
  });

  const totalLoss = (losses as any[]).reduce((s, l) => s + parseFloat(l.lossValue ?? "0"), 0);
  const pendingCount = (losses as any[]).filter((l: any) => l.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Expiry Loss Register</h1>
          <p className="text-sm text-muted-foreground">Track and approve expired / damaged stock disposal</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1.5" />Add Entry</Button>
      </div>

      {/* Summary */}
      <div className="flex gap-3 flex-wrap">
        <div className="px-4 py-2 rounded-lg bg-red-50 border border-red-200">
          <p className="text-xs text-red-600 font-medium">Total Loss Value</p>
          <p className="text-lg font-bold text-red-700">₹{totalLoss.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-700">{pendingCount} pending approval</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="disposed">Disposed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loss No</TableHead>
                <TableHead>Medicine</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Loss Value</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                : (losses as any[]).length === 0 ? <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No expiry loss entries</TableCell></TableRow>
                : (losses as any[]).map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.lossNo}</TableCell>
                    <TableCell className="font-medium">{l.medicineName}</TableCell>
                    <TableCell className="font-mono text-xs">{l.batchNo || "—"}</TableCell>
                    <TableCell className={l.expiryDate && l.expiryDate < new Date().toISOString().slice(0, 10) ? "text-red-600 font-medium" : ""}>{l.expiryDate || "—"}</TableCell>
                    <TableCell className="text-right">{l.quantity}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">₹{Number(l.lossValue).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-sm">{l.disposalReason}</TableCell>
                    <TableCell className="text-sm">{l.disposalMethod || "—"}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[l.status] ?? ""}>{l.status}</Badge></TableCell>
                    <TableCell>
                      {l.status === "pending" && (
                        <Button variant="outline" size="sm" onClick={() => approveLoss.mutate(l.id)} disabled={approveLoss.isPending}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Approve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Expiry / Disposal Loss</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Medicine *</Label>
              <Select value={form.medicineId} onValueChange={v => { const m = (medicines as any[]).find((x: any) => String(x.id) === v); setForm(f => ({ ...f, medicineId: v, medicineName: m?.name ?? "", batchNo: m?.batchNo ?? "" })); }}>
                <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
                <SelectContent className="max-h-48">{(medicines as any[]).map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Batch No</Label><Input value={form.batchNo} onChange={e => setForm(f => ({ ...f, batchNo: e.target.value }))} /></div>
              <div><Label>Expiry Date</Label><Input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} /></div>
            </div>
            <div><Label>Quantity *</Label><Input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
            <div><Label>Disposal Reason</Label>
              <Select value={form.disposalReason} onValueChange={v => setForm(f => ({ ...f, disposalReason: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DISPOSAL_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Disposal Method</Label>
              <Select value={form.disposalMethod} onValueChange={v => setForm(f => ({ ...f, disposalMethod: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DISPOSAL_METHODS.map(m => <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => addLoss.mutate({ ...form, medicineId: Number(form.medicineId) })} disabled={!form.medicineId || !form.quantity || addLoss.isPending}>Submit for Approval</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
