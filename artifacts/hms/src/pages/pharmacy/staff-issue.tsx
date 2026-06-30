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
import { Plus, CheckCircle2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  issued: "bg-green-100 text-green-700",
};

async function fetchIssues(status?: string) {
  const p = status ? `?status=${status}` : "";
  const r = await fetch(`/api/pharmacy/staff-issues${p}`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}
async function fetchMedicines() {
  const r = await fetch("/api/pharmacy/medicines?limit=500", { credentials: "include" });
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

const DEPTS = ["Emergency", "ICU", "OT", "CSSD", "Nursing Station", "Physiotherapy", "Radiology", "Lab", "Canteen", "Admin", "Other"];

export default function StaffIssuePage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ recipientName: "", recipientType: "staff", department: "", purpose: "", notes: "", items: [{ medicineId: "", medicineName: "", quantity: 1, rate: "", amount: "0" }] });

  const { data: issues = [], isLoading } = useQuery({ queryKey: ["staff-issues", filterStatus], queryFn: () => fetchIssues(filterStatus || undefined) });
  const { data: medicines = [] } = useQuery({ queryKey: ["medicines-list"], queryFn: fetchMedicines });
  const safeIssues = Array.isArray(issues) ? issues : [];
  const safeMedicines = Array.isArray(medicines) ? medicines : [];

  const addIssue = useMutation({
    mutationFn: async (d: any) => { const r = await fetch("/api/pharmacy/staff-issues", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(d) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("Issue request submitted"); qc.invalidateQueries({ queryKey: ["staff-issues"] }); setShowAdd(false); setForm({ recipientName: "", recipientType: "staff", department: "", purpose: "", notes: "", items: [{ medicineId: "", medicineName: "", quantity: 1, rate: "", amount: "0" }] }); },
    onError: () => toast.error("Failed"),
  });

  const approveIssue = useMutation({
    mutationFn: async (id: number) => { const r = await fetch(`/api/pharmacy/staff-issues/${id}/approve`, { method: "PUT", credentials: "include" }); if (!r.ok) { const j = await r.json(); throw new Error(j.error); } return r.json(); },
    onSuccess: () => { toast.success("Issued — stock decremented"); qc.invalidateQueries({ queryKey: ["staff-issues"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  function updateLine(idx: number, field: string, value: any) {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === "medicineId") {
        const m = safeMedicines.find((x: any) => String(x.id) === value);
        if (m) { items[idx].medicineName = m.name; items[idx].rate = String(m.saleRate ?? 0); }
      }
      if (["quantity", "rate"].includes(field)) {
        items[idx].amount = (parseFloat(items[idx].quantity as any) * parseFloat(items[idx].rate || "0")).toFixed(2);
      }
      return { ...f, items };
    });
  }

  const totalValue = form.items.reduce((s, i) => s + parseFloat(i.amount || "0"), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-xl font-bold">Staff / Internal Medicine Issue</h1><p className="text-sm text-muted-foreground">Issue medicines to departments or staff for internal consumption</p></div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1.5" />New Issue</Button>
      </div>

      <div className="flex gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issue No</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                : safeIssues.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No staff issues yet</TableCell></TableRow>
                : safeIssues.map((iss: any) => (
                  <TableRow key={iss.id}>
                    <TableCell className="font-mono text-xs">{iss.issueNo}</TableCell>
                    <TableCell className="font-medium">{iss.recipientName}</TableCell>
                    <TableCell>{iss.department || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{iss.purpose || "—"}</TableCell>
                    <TableCell>{(iss.items as any[]).length} item(s)</TableCell>
                    <TableCell className="text-right font-semibold">₹{Number(iss.totalValue).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[iss.status] ?? ""}>{iss.status}</Badge></TableCell>
                    <TableCell>
                      {iss.status === "pending" && (
                        <Button variant="outline" size="sm" onClick={() => approveIssue.mutate(iss.id)} disabled={approveIssue.isPending}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Approve & Issue
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
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Staff / Department Issue</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Recipient Name *</Label><Input value={form.recipientName} onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))} placeholder="Staff name or dept" /></div>
              <div><Label>Type</Label>
                <Select value={form.recipientType} onValueChange={v => setForm(f => ({ ...f, recipientType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="department">Department</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Department</Label>
                <Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select dept" /></SelectTrigger>
                  <SelectContent>{DEPTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Purpose</Label><Input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} placeholder="e.g. First Aid Kit" /></div>
            </div>
            <div>
              <Label>Items</Label>
              {form.items.map((line, idx) => (
                <div key={idx} className="grid grid-cols-8 gap-2 mt-2 items-end">
                  <div className="col-span-4">
                    <Select value={line.medicineId} onValueChange={v => updateLine(idx, "medicineId", v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Medicine" /></SelectTrigger>
                      <SelectContent className="max-h-48">{safeMedicines.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Input className="h-8" type="number" min={1} value={line.quantity} onChange={e => updateLine(idx, "quantity", parseFloat(e.target.value) || 1)} placeholder="Qty" /></div>
                  <div className="col-span-1"><p className="text-xs text-muted-foreground">₹{line.amount}</p></div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} disabled={form.items.length === 1}>✕</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setForm(f => ({ ...f, items: [...f.items, { medicineId: "", medicineName: "", quantity: 1, rate: "", amount: "0" }] }))}>
                <Plus className="w-3.5 h-3.5 mr-1" />Add Row
              </Button>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-semibold">Total: ₹{totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
              <Input placeholder="Notes" className="max-w-xs" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => addIssue.mutate({ ...form, items: form.items.filter(i => i.medicineId).map(i => ({ ...i, medicineId: Number(i.medicineId) })) })} disabled={!form.recipientName || addIssue.isPending}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
