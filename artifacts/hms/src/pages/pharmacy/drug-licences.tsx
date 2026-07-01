import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileWarning, Trash2 } from "lucide-react";
import { toast } from "sonner";

const LICENCE_TYPES = ["20B", "21B", "25", "NDPS", "manufacturing", "wholesale", "retail"];

export default function DrugLicencesPage() {
  const [list, setList] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    licence_holder_type: "entity", vendor_id: "", licence_type: "20B", licence_no: "",
    issuing_authority: "", issue_date: "", expiry_date: "", renewal_alert_days: 60,
    document_url: "", remarks: "",
  });

  useEffect(() => { load(); }, []);
  async function load() {
    const [l, a] = await Promise.all([
      (async () => { const r = await fetch("/api/pharmacy/drug-licences", { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); })(),
      (async () => { const r = await fetch("/api/pharmacy/drug-licences/alerts", { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); })(),
    ]);
    setList(Array.isArray(l) ? l : []);
    setAlerts(a || {});
  }

  async function save() {
    const r = await fetch("/api/pharmacy/drug-licences", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, vendor_id: form.vendor_id || null }),
    });
    if (r.ok) { toast.success("Licence added"); setOpen(false); load(); }
    else toast.error((await r.json()).error || "Failed");
  }

  async function del(id: number) {
    if (!confirm("Delete licence?")) return;
    const r = await fetch(`/api/pharmacy/drug-licences/${id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) { toast.success("Deleted"); load(); }
  }

  function statusBadge(s: string, days: number) {
    if (s === "expired") return <Badge variant="destructive">Expired ({Math.abs(days)}d ago)</Badge>;
    if (s === "expiring_soon") return <Badge className="bg-amber-500">Expiring in {days}d</Badge>;
    return <Badge variant="outline" className="text-green-700 border-green-300">OK ({days}d)</Badge>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileWarning className="h-6 w-6" /> Drug Licence Tracker</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button data-testid="licence-add"><Plus className="h-4 w-4 mr-1" /> Add Licence</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Add Drug Licence</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Holder Type</Label>
                <Select value={form.licence_holder_type} onValueChange={v => setForm({...form, licence_holder_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entity">Hospital / Entity</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Vendor ID (if vendor)</Label><Input type="number" value={form.vendor_id} onChange={e => setForm({...form, vendor_id: e.target.value})} /></div>
              <div><Label>Licence Type *</Label>
                <Select value={form.licence_type} onValueChange={v => setForm({...form, licence_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LICENCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Licence No. *</Label><Input value={form.licence_no} onChange={e => setForm({...form, licence_no: e.target.value})} /></div>
              <div><Label>Issuing Authority</Label><Input value={form.issuing_authority} onChange={e => setForm({...form, issuing_authority: e.target.value})} /></div>
              <div><Label>Issue Date</Label><Input type="date" value={form.issue_date} onChange={e => setForm({...form, issue_date: e.target.value})} /></div>
              <div><Label>Expiry Date *</Label><Input type="date" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})} /></div>
              <div><Label>Alert Days Before</Label><Input type="number" value={form.renewal_alert_days} onChange={e => setForm({...form, renewal_alert_days: e.target.value})} /></div>
              <div className="col-span-2"><Label>Document URL</Label><Input value={form.document_url} onChange={e => setForm({...form, document_url: e.target.value})} /></div>
              <div className="col-span-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} /></div>
            </div>
            <Button onClick={save} className="w-full">Save</Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-red-300"><CardContent className="p-3"><div className="text-xs text-muted-foreground">Expired</div><div className="text-3xl font-bold text-red-600">{alerts.expired || 0}</div></CardContent></Card>
        <Card className="border-amber-300"><CardContent className="p-3"><div className="text-xs text-muted-foreground">≤ 30 days</div><div className="text-3xl font-bold text-amber-600">{alerts.expiring_30d || 0}</div></CardContent></Card>
        <Card className="border-yellow-300"><CardContent className="p-3"><div className="text-xs text-muted-foreground">30–60 days</div><div className="text-3xl font-bold text-yellow-600">{alerts.expiring_60d || 0}</div></CardContent></Card>
        <Card className="border-green-300"><CardContent className="p-3"><div className="text-xs text-muted-foreground">OK ({">"}60 d)</div><div className="text-3xl font-bold text-green-600">{alerts.ok || 0}</div></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>All Licences</CardTitle></CardHeader><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Holder</TableHead><TableHead>Type</TableHead><TableHead>Licence No.</TableHead>
            <TableHead>Authority</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {list.map(l => (
              <TableRow key={l.id}>
                <TableCell>{l.licence_holder_type === "entity" ? "Hospital" : (l.vendor_name || `Vendor #${l.vendor_id}`)}</TableCell>
                <TableCell><Badge variant="outline">{l.licence_type}</Badge></TableCell>
                <TableCell className="font-mono">{l.licence_no}</TableCell>
                <TableCell className="text-xs">{l.issuing_authority || "—"}</TableCell>
                <TableCell>{l.expiry_date}</TableCell>
                <TableCell>{statusBadge(l.alert_status, l.days_to_expiry)}</TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => del(l.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
