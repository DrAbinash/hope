import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Package, Scissors } from "lucide-react";

async function fetchKits() { const r = await fetch("/api/pharmacy/kits"); if (!r.ok) throw new Error("Failed"); return r.json(); }
async function fetchKitIssues() { const r = await fetch("/api/pharmacy/kit-issues"); if (!r.ok) throw new Error("Failed"); return r.json(); }
async function fetchMedicines() { const r = await fetch("/api/pharmacy/medicines?limit=500"); if (!r.ok) return []; return r.json(); }
async function fetchPatients() { const r = await fetch("/api/patients?limit=100"); if (!r.ok) return []; const j = await r.json(); return Array.isArray(j) ? j : (j.data ?? []); }

const PROC_TYPES = ["surgery", "dressing", "central_line", "intubation", "iv_cannula", "catheter", "suturing", "lumbar_puncture", "dialysis", "other"];

export default function KitsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showIssue, setShowIssue] = useState<any>(null);
  const [kitForm, setKitForm] = useState({ kitName: "", kitCode: "", procedureType: "", description: "", items: [{ medicineId: "", quantity: 1, unit: "" }] });
  const [issueForm, setIssueForm] = useState({ patientId: "", notes: "" });

  const { data: kits = [] } = useQuery({ queryKey: ["kits"], queryFn: fetchKits });
  const { data: kitIssues = [] } = useQuery({ queryKey: ["kit-issues"], queryFn: fetchKitIssues });
  const { data: medicines = [] } = useQuery({ queryKey: ["medicines-list"], queryFn: fetchMedicines });
  const { data: patients = [] } = useQuery({ queryKey: ["patients-list"], queryFn: fetchPatients });

  const createKit = useMutation({
    mutationFn: async (d: any) => { const r = await fetch("/api/pharmacy/kits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("Kit created"); qc.invalidateQueries({ queryKey: ["kits"] }); setShowCreate(false); setKitForm({ kitName: "", kitCode: "", procedureType: "", description: "", items: [{ medicineId: "", quantity: 1, unit: "" }] }); },
    onError: () => toast.error("Failed to create kit"),
  });

  const issueKit = useMutation({
    mutationFn: async ({ kitId, ...rest }: any) => { const r = await fetch(`/api/pharmacy/kits/${kitId}/issue`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rest) }); if (!r.ok) { const j = await r.json(); throw new Error(j.error); } return r.json(); },
    onSuccess: (data) => {
      toast.success(`Kit issued — ₹${Number(data.totalCost).toLocaleString("en-IN", { maximumFractionDigits: 0 })} charged`);
      qc.invalidateQueries({ queryKey: ["kit-issues"] }); setShowIssue(null); setIssueForm({ patientId: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function updateKitItem(idx: number, field: string, value: any) {
    setKitForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-xl font-bold">OT / Procedure Kit Management</h1><p className="text-sm text-muted-foreground">Pre-packaged procedure kits for surgery and clinical procedures</p></div>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5" />Create Kit</Button>
      </div>

      <Tabs defaultValue="kits">
        <TabsList><TabsTrigger value="kits">Kit Definitions</TabsTrigger><TabsTrigger value="issues">Issue Log</TabsTrigger></TabsList>

        <TabsContent value="kits" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(kits as any[]).length === 0 ? (
              <div className="col-span-3 text-center py-16 text-muted-foreground"><Package className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No kits yet</p></div>
            ) : (kits as any[]).map((kit: any) => (
              <Card key={kit.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{kit.kitName}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">{kit.kitCode}</p>
                    </div>
                    <Badge variant="outline">{kit.procedureType || "general"}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 mb-3">
                    {(kit.items as any[]).map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{item.medicineName}</span>
                        <span className="text-muted-foreground">×{item.quantity}</span>
                      </div>
                    ))}
                    {kit.items.length === 0 && <p className="text-xs text-muted-foreground">No items configured</p>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">₹{Number(kit.estimatedCost || 0).toLocaleString("en-IN")}</span>
                    <Button size="sm" onClick={() => setShowIssue(kit)} disabled={kit.items.length === 0}>
                      <Scissors className="w-3.5 h-3.5 mr-1.5" />Issue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="issues" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Issue No</TableHead><TableHead>Kit</TableHead><TableHead>Patient</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Cost</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(kitIssues as any[]).length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No kit issues yet</TableCell></TableRow>
                    : (kitIssues as any[]).map((iss: any) => (
                      <TableRow key={iss.id}>
                        <TableCell className="font-mono text-xs">{iss.issueNo}</TableCell>
                        <TableCell>{iss.kitName}</TableCell>
                        <TableCell>{iss.patientName || "—"}</TableCell>
                        <TableCell>{iss.issueDate}</TableCell>
                        <TableCell className="text-right font-semibold">₹{Number(iss.totalCost).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                        <TableCell><Badge variant="outline">{iss.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Kit Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Create Procedure Kit</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Kit Name *</Label><Input value={kitForm.kitName} onChange={e => setKitForm(f => ({ ...f, kitName: e.target.value }))} placeholder="e.g. Appendectomy Kit" /></div>
              <div><Label>Kit Code *</Label><Input value={kitForm.kitCode} onChange={e => setKitForm(f => ({ ...f, kitCode: e.target.value }))} placeholder="e.g. APP001" /></div>
            </div>
            <div><Label>Procedure Type</Label>
              <Select value={kitForm.procedureType} onValueChange={v => setKitForm(f => ({ ...f, procedureType: v }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{PROC_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Input value={kitForm.description} onChange={e => setKitForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div>
              <Label>Kit Items</Label>
              {kitForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-8 gap-2 mt-2 items-end">
                  <div className="col-span-5">
                    <Select value={item.medicineId} onValueChange={v => updateKitItem(idx, "medicineId", v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Select medicine" /></SelectTrigger>
                      <SelectContent className="max-h-48">{(medicines as any[]).map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Input className="h-8" type="number" min={1} value={item.quantity} onChange={e => updateKitItem(idx, "quantity", parseInt(e.target.value) || 1)} placeholder="Qty" /></div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setKitForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} disabled={kitForm.items.length === 1}>✕</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setKitForm(f => ({ ...f, items: [...f.items, { medicineId: "", quantity: 1, unit: "" }] }))}><Plus className="w-3.5 h-3.5 mr-1" />Add Item</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createKit.mutate({ ...kitForm, items: kitForm.items.filter(i => i.medicineId).map(i => ({ ...i, medicineId: Number(i.medicineId) })) })} disabled={!kitForm.kitName || !kitForm.kitCode || createKit.isPending}>Create Kit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Kit Dialog */}
      <Dialog open={!!showIssue} onOpenChange={() => setShowIssue(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Issue: {showIssue?.kitName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Items: {(showIssue?.items ?? []).map((i: any) => `${i.medicineName} ×${i.quantity}`).join(", ")}</div>
            <div><Label>Patient</Label>
              <Select value={issueForm.patientId} onValueChange={v => setIssueForm(f => ({ ...f, patientId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select patient (optional)" /></SelectTrigger>
                <SelectContent className="max-h-48">{(patients as any[]).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Input value={issueForm.notes} onChange={e => setIssueForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIssue(null)}>Cancel</Button>
            <Button onClick={() => issueKit.mutate({ kitId: showIssue?.id, patientId: issueForm.patientId ? Number(issueForm.patientId) : undefined, notes: issueForm.notes })} disabled={issueKit.isPending}>Issue Kit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
