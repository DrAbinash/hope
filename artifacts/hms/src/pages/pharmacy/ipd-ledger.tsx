import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, IndianRupee, FileText } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  issued: "bg-blue-100 text-blue-700", billed: "bg-green-100 text-green-700",
  partially_returned: "bg-amber-100 text-amber-700", fully_returned: "bg-gray-100 text-gray-700",
};

async function fetchAdmissions() {
  const r = await fetch("/api/ipd/admissions?status=admitted&limit=100");
  if (!r.ok) return [];
  return r.json();
}
async function fetchIpdIssues(ipdAdmissionId: string) {
  const r = await fetch(`/api/pharmacy/ipd-issues?ipdAdmissionId=${ipdAdmissionId}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}
async function fetchPendingAmount(ipdAdmissionId: string) {
  const r = await fetch(`/api/pharmacy/ipd-issues/pending-amount?ipdAdmissionId=${ipdAdmissionId}`);
  if (!r.ok) return { pendingAmount: 0, issueCount: 0 };
  return r.json();
}
async function fetchMedicines() {
  const r = await fetch("/api/pharmacy/medicines?limit=500");
  if (!r.ok) return [];
  return r.json();
}

export default function IpdMedicineLedger() {
  const qc = useQueryClient();
  const [selectedAdm, setSelectedAdm] = useState("");
  const [showIssue, setShowIssue] = useState(false);
  const [lines, setLines] = useState([{ medicineId: "", medicineName: "", quantity: 1, rate: "", gstPercent: "12", amount: "0", gstAmount: "0" }]);
  const [notes, setNotes] = useState("");

  const { data: admissions = [] } = useQuery({ queryKey: ["ipd-admissions"], queryFn: fetchAdmissions });
  const { data: issues = [], isLoading } = useQuery({ queryKey: ["ipd-issues", selectedAdm], queryFn: () => fetchIpdIssues(selectedAdm), enabled: !!selectedAdm });
  const { data: pendingInfo } = useQuery({ queryKey: ["ipd-pending", selectedAdm], queryFn: () => fetchPendingAmount(selectedAdm), enabled: !!selectedAdm });
  const { data: medicines = [] } = useQuery({ queryKey: ["medicines-list"], queryFn: fetchMedicines });

  const addIssueMutation = useMutation({
    mutationFn: async (payload: any) => {
      const adm = (admissions as any[]).find((a: any) => String(a.id) === selectedAdm);
      const r = await fetch("/api/pharmacy/ipd-issues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, ipdAdmissionId: Number(selectedAdm), patientId: adm?.patientId }) });
      if (!r.ok) { const j = await r.json(); throw new Error(j.error); }
      return r.json();
    },
    onSuccess: () => { toast.success("Medicine issued"); qc.invalidateQueries({ queryKey: ["ipd-issues", selectedAdm] }); qc.invalidateQueries({ queryKey: ["ipd-pending", selectedAdm] }); setShowIssue(false); setLines([{ medicineId: "", medicineName: "", quantity: 1, rate: "", gstPercent: "12", amount: "0", gstAmount: "0" }]); setNotes(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const postBillMutation = useMutation({
    mutationFn: async (id: number) => { const r = await fetch(`/api/pharmacy/ipd-issues/${id}/post-to-bill`, { method: "PUT" }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("Posted to bill"); qc.invalidateQueries({ queryKey: ["ipd-issues", selectedAdm] }); qc.invalidateQueries({ queryKey: ["ipd-pending", selectedAdm] }); },
  });

  function updateLine(idx: number, field: string, value: any) {
    setLines(prev => {
      const l = [...prev];
      l[idx] = { ...l[idx], [field]: value };
      if (field === "medicineId") {
        const med = (medicines as any[]).find((m: any) => String(m.id) === value);
        if (med) { l[idx].medicineName = med.name; l[idx].rate = String(med.saleRate ?? 0); l[idx].gstPercent = String(med.gstPercent ?? 12); }
      }
      if (["quantity", "rate", "gstPercent"].includes(field)) {
        const qty = parseFloat(l[idx].quantity as any) || 0;
        const rate = parseFloat(l[idx].rate) || 0;
        const gst = parseFloat(l[idx].gstPercent) || 0;
        const base = qty * rate;
        const gstAmt = base * gst / 100;
        l[idx].amount = (base + gstAmt).toFixed(2);
        l[idx].gstAmount = gstAmt.toFixed(2);
      }
      return l;
    });
  }

  function handleIssue() {
    const items = lines.filter(l => l.medicineId && l.quantity > 0);
    if (!items.length) return;
    const issueDate = new Date().toISOString().slice(0, 10);
    addIssueMutation.mutate({ issueDate, items, notes });
  }

  const selectedAdmObj = (admissions as any[]).find((a: any) => String(a.id) === selectedAdm);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-xl font-bold">IPD Medicine Ledger</h1><p className="text-sm text-muted-foreground">Patient-wise medicine issue for admitted patients</p></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <Label>Select Admitted Patient</Label>
          <Select value={selectedAdm} onValueChange={setSelectedAdm}>
            <SelectTrigger><SelectValue placeholder="Choose IPD admission…" /></SelectTrigger>
            <SelectContent className="max-h-60">
              {(admissions as any[]).map((a: any) => (
                <SelectItem key={a.id} value={String(a.id)}>{a.ipdNo} — {a.patientName} (Bed {a.bedName || a.bedId})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedAdm && (
          <Button onClick={() => setShowIssue(true)} className="self-end"><Plus className="w-4 h-4 mr-1.5" />Issue Medicines</Button>
        )}
      </div>

      {selectedAdm && pendingInfo && (
        <div className="flex items-center gap-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <IndianRupee className="w-5 h-5 text-amber-600" />
          <div>
            <span className="font-semibold text-amber-800">₹{Number(pendingInfo.pendingAmount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
            <span className="text-amber-700 text-sm ml-2">unbilled from {pendingInfo.issueCount} issue(s)</span>
          </div>
        </div>
      )}

      {selectedAdm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Issue History {selectedAdmObj ? `— ${selectedAdmObj.patientName}` : ""}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Issue No</TableHead><TableHead>Date</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                  : (issues as any[]).length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No medicines issued yet</TableCell></TableRow>
                  : (issues as any[]).map((iss: any) => (
                    <TableRow key={iss.id}>
                      <TableCell className="font-mono text-xs">{iss.issueNo}</TableCell>
                      <TableCell>{iss.issueDate}</TableCell>
                      <TableCell>{(iss.items as any[]).length} item(s)</TableCell>
                      <TableCell className="text-right font-semibold">₹{Number(iss.netAmount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[iss.status] ?? ""}>{iss.status}</Badge></TableCell>
                      <TableCell>
                        {!iss.postedToBill && <Button variant="outline" size="sm" onClick={() => postBillMutation.mutate(iss.id)}>Post to Bill</Button>}
                        {iss.postedToBill && <span className="text-xs text-green-600">Billed</span>}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Issue Dialog */}
      <Dialog open={showIssue} onOpenChange={setShowIssue}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Issue Medicines</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-2">
                <div className="col-span-4">
                  <Label className="text-xs">Medicine</Label>
                  <Select value={line.medicineId} onValueChange={v => updateLine(idx, "medicineId", v)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent className="max-h-48">{(medicines as any[]).map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label className="text-xs">Qty</Label><Input className="h-8" type="number" min={1} value={line.quantity} onChange={e => updateLine(idx, "quantity", parseFloat(e.target.value) || 1)} /></div>
                <div className="col-span-2"><Label className="text-xs">Rate (₹)</Label><Input className="h-8" value={line.rate} onChange={e => updateLine(idx, "rate", e.target.value)} /></div>
                <div className="col-span-2"><Label className="text-xs">GST%</Label><Input className="h-8" value={line.gstPercent} onChange={e => updateLine(idx, "gstPercent", e.target.value)} /></div>
                <div className="col-span-1"><Label className="text-xs">Amount</Label><p className="text-sm font-semibold mt-1">₹{line.amount}</p></div>
                <div className="col-span-1"><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setLines(prev => prev.filter((_, i) => i !== idx))} disabled={lines.length === 1}>✕</Button></div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLines(prev => [...prev, { medicineId: "", medicineName: "", quantity: 1, rate: "", gstPercent: "12", amount: "0", gstAmount: "0" }])}>
              <Plus className="w-3.5 h-3.5 mr-1" />Add Row
            </Button>
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm font-semibold">Total: ₹{lines.reduce((s, l) => s + parseFloat(l.amount || "0"), 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
            <Input placeholder="Notes" className="max-w-xs" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIssue(false)}>Cancel</Button>
            <Button onClick={handleIssue} disabled={addIssueMutation.isPending || !lines.some(l => l.medicineId)}>Issue Medicines</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
