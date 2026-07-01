import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, CheckCircle2, XCircle, Truck, AlertTriangle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  po_generated: "bg-blue-100 text-blue-700",
};
const URGENCY_COLORS: Record<string, string> = {
  routine: "bg-gray-100 text-gray-700",
  urgent: "bg-amber-100 text-amber-700",
  emergency: "bg-red-100 text-red-700",
};

async function fetchIndents(status?: string) {
  const p = status ? `?status=${status}` : "";
  const r = await fetch(`/api/pharmacy/purchase-indents${p}`, { credentials: "include" });
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

const DEPTS = ["Pharmacy", "Emergency", "ICU", "OT", "General Ward", "Pediatrics", "Gynecology", "Orthopedics", "Other"];

export default function PurchaseIndentPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("pending");
  const [showCreate, setShowCreate] = useState(false);
  const [showApprove, setShowApprove] = useState<any>(null);
  const [showReject, setShowReject] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [form, setForm] = useState({ requestedByName: "", department: "", urgency: "routine", notes: "", items: [{ medicineId: "", medicineName: "", requiredQty: 1, unit: "strip", reason: "" }] });
  const [approvedQtys, setApprovedQtys] = useState<Record<number, number>>({});

  const { data: indents = [], isLoading } = useQuery({ queryKey: ["purchase-indents", filterStatus], queryFn: () => fetchIndents(filterStatus !== "all" ? filterStatus : undefined) });
  const { data: medicines = [] } = useQuery({ queryKey: ["medicines-list"], queryFn: fetchMedicines });
  const safeIndents = Array.isArray(indents) ? indents : [];
  const safeMedicines = Array.isArray(medicines) ? medicines : [];

  const createIndent = useMutation({
    mutationFn: async (d: any) => { const r = await fetch("/api/pharmacy/purchase-indents", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(d) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("Purchase indent created"); qc.invalidateQueries({ queryKey: ["purchase-indents"] }); setShowCreate(false); setForm({ requestedByName: "", department: "", urgency: "routine", notes: "", items: [{ medicineId: "", medicineName: "", requiredQty: 1, unit: "strip", reason: "" }] }); },
    onError: () => toast.error("Failed"),
  });

  const approveIndent = useMutation({
    mutationFn: async ({ id, approvedQtys }: any) => { const r = await fetch(`/api/pharmacy/purchase-indents/${id}/approve`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ approvedQtys }) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("Indent approved"); qc.invalidateQueries({ queryKey: ["purchase-indents"] }); setShowApprove(null); },
    onError: () => toast.error("Failed"),
  });

  const rejectIndent = useMutation({
    mutationFn: async ({ id, rejectionReason }: any) => { const r = await fetch(`/api/pharmacy/purchase-indents/${id}/reject`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ rejectionReason }) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("Indent rejected"); qc.invalidateQueries({ queryKey: ["purchase-indents"] }); setShowReject(null); setRejectionReason(""); },
    onError: () => toast.error("Failed"),
  });

  function updateLine(idx: number, field: string, value: any) {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === "medicineId") {
        const m = safeMedicines.find((x: any) => String(x.id) === value);
        if (m) items[idx].medicineName = m.name;
      }
      return { ...f, items };
    });
  }

  const pendingCount = safeIndents.filter((i: any) => i.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Purchase Indent Management</h1>
          <p className="text-sm text-muted-foreground">Procurement requests with approval workflow</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5" />New Indent</Button>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 w-fit">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700">{pendingCount} indent(s) pending your approval</span>
        </div>
      )}

      <Tabs value={filterStatus} onValueChange={setFilterStatus}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={filterStatus} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indent No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                    : safeIndents.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground"><Truck className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No indents found</p></TableCell></TableRow>
                    : safeIndents.map((ind: any) => (
                      <TableRow key={ind.id}>
                        <TableCell className="font-mono text-xs font-medium">{ind.indentNo}</TableCell>
                        <TableCell>{ind.indentDate}</TableCell>
                        <TableCell>{ind.requestedByName}</TableCell>
                        <TableCell>{ind.department || "—"}</TableCell>
                        <TableCell><Badge className={URGENCY_COLORS[ind.urgency] ?? ""}>{ind.urgency}</Badge></TableCell>
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            {(ind.items as any[])?.slice(0, 2).map((item: any, i: number) => (
                              <div key={i}>{item.medicineName} ×{item.requiredQty}</div>
                            ))}
                            {(ind.items as any[])?.length > 2 && <span className="text-muted-foreground">+{ind.items.length - 2} more</span>}
                          </div>
                        </TableCell>
                        <TableCell><Badge className={STATUS_COLORS[ind.status] ?? ""}>{ind.status}</Badge></TableCell>
                        <TableCell>
                          {ind.status === "pending" && (
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" className="text-green-700 border-green-300" onClick={() => { setShowApprove(ind); const qtys: any = {}; (ind.items as any[]).forEach((i: any) => { qtys[i.id] = i.requiredQty; }); setApprovedQtys(qtys); }}>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="outline" size="sm" className="text-red-700 border-red-300" onClick={() => { setShowReject(ind); setRejectionReason(""); }}>
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                          {ind.status === "approved" && <span className="text-xs text-green-600">By {ind.approvedByName || "Admin"}</span>}
                          {ind.status === "rejected" && <span className="text-xs text-red-600">{ind.rejectionReason?.slice(0, 20) || "Rejected"}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Purchase Indent</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Requested By *</Label><Input value={form.requestedByName} onChange={e => setForm(f => ({ ...f, requestedByName: e.target.value }))} /></div>
              <div><Label>Department</Label>
                <Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{DEPTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Urgency</Label>
                <Select value={form.urgency} onValueChange={v => setForm(f => ({ ...f, urgency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="routine">Routine</SelectItem><SelectItem value="urgent">Urgent</SelectItem><SelectItem value="emergency">Emergency</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Medicines Required</Label>
              {form.items.map((line, idx) => (
                <div key={idx} className="grid grid-cols-9 gap-2 mt-2 items-end">
                  <div className="col-span-5">
                    <Select value={line.medicineId} onValueChange={v => updateLine(idx, "medicineId", v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Medicine" /></SelectTrigger>
                      <SelectContent className="max-h-48">{safeMedicines.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Input className="h-8" type="number" min={1} value={line.requiredQty} onChange={e => updateLine(idx, "requiredQty", parseInt(e.target.value) || 1)} placeholder="Qty" /></div>
                  <div className="col-span-1"><Input className="h-8" value={line.unit} onChange={e => updateLine(idx, "unit", e.target.value)} placeholder="Unit" /></div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} disabled={form.items.length === 1}>✕</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setForm(f => ({ ...f, items: [...f.items, { medicineId: "", medicineName: "", requiredQty: 1, unit: "strip", reason: "" }] }))}><Plus className="w-3.5 h-3.5 mr-1" />Add Row</Button>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createIndent.mutate({ ...form, items: form.items.filter(i => i.medicineId).map(i => ({ ...i, medicineId: Number(i.medicineId) })) })} disabled={!form.requestedByName || createIndent.isPending}>Submit Indent</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={!!showApprove} onOpenChange={() => setShowApprove(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve Indent — {showApprove?.indentNo}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {(showApprove?.items ?? []).map((item: any) => (
              <div key={item.id} className="flex items-center gap-3">
                <span className="flex-1 text-sm">{item.medicineName}</span>
                <span className="text-xs text-muted-foreground">Requested: {item.requiredQty}</span>
                <Input type="number" min={0} className="w-24 h-8" value={approvedQtys[item.id] ?? item.requiredQty} onChange={e => setApprovedQtys(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprove(null)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => approveIndent.mutate({ id: showApprove?.id, approvedQtys })} disabled={approveIndent.isPending}>Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!showReject} onOpenChange={() => setShowReject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Indent — {showReject?.indentNo}</DialogTitle></DialogHeader>
          <div><Label>Rejection Reason *</Label><Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={3} placeholder="Explain why this indent is being rejected" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectIndent.mutate({ id: showReject?.id, rejectionReason })} disabled={!rejectionReason || rejectIndent.isPending}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
