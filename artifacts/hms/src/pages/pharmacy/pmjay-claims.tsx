import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ShieldCheck, IndianRupee } from "lucide-react";
import { toast } from "sonner";

export default function PmjayClaimsPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [filter, setFilter] = useState("all");
  const [openNew, setOpenNew] = useState(false);
  const [openPkg, setOpenPkg] = useState(false);
  const [openUpd, setOpenUpd] = useState<any>(null);

  const [form, setForm] = useState<any>({
    patient_id: "", pmjay_id: "", family_id: "", package_id: "", package_amount: 0,
    pre_auth_no: "", admission_date: "", discharge_date: "", claim_amount: 0, remarks: "",
  });
  const [pkgForm, setPkgForm] = useState<any>({ package_code: "", package_name: "", specialty: "", package_rate: 0 });
  const [upd, setUpd] = useState<any>({});

  useEffect(() => { load(); }, [filter]);
  async function load() {
    const [c, p, s] = await Promise.all([
      (async () => { const statusParam = filter !== "all" ? filter : ""; const r = await fetch(`/api/pharmacy/pmjay/claims?status=${statusParam}`, { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); })(),
      (async () => { const r = await fetch("/api/pharmacy/pmjay/packages", { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); })(),
      (async () => { const r = await fetch("/api/pharmacy/pmjay/summary", { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); })(),
    ]);
    setClaims(Array.isArray(c) ? c : []);
    setPackages(Array.isArray(p) ? p : []);
    setSummary(s || {});
  }

  async function createClaim() {
    const r = await fetch("/api/pharmacy/pmjay/claims", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) { toast.success("Claim created"); setOpenNew(false); load(); }
    else toast.error((await r.json()).error || "Failed");
  }

  async function savePackage() {
    const r = await fetch("/api/pharmacy/pmjay/packages", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pkgForm),
    });
    if (r.ok) { toast.success("Package added"); setOpenPkg(false); setPkgForm({ package_code: "", package_name: "", specialty: "", package_rate: 0 }); load(); }
    else toast.error((await r.json()).error || "Failed");
  }

  async function updateClaim() {
    const r = await fetch(`/api/pharmacy/pmjay/claims/${openUpd.id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(upd),
    });
    if (r.ok) { toast.success("Updated"); setOpenUpd(null); setUpd({}); load(); }
  }

  const statusColor: Record<string, string> = {
    draft: "secondary", submitted: "default", approved: "default", rejected: "destructive", paid: "default",
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> PMJAY / Ayushman Bharat Claims</h1>
        <div className="flex gap-2">
          <Dialog open={openPkg} onOpenChange={setOpenPkg}>
            <DialogTrigger asChild><Button variant="outline" size="sm" data-testid="pmjay-add-package"><Plus className="h-4 w-4 mr-1" /> Package</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add PMJAY Package</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Package Code *</Label><Input value={pkgForm.package_code} onChange={e => setPkgForm({...pkgForm, package_code: e.target.value})} /></div>
                <div><Label>Package Name *</Label><Input value={pkgForm.package_name} onChange={e => setPkgForm({...pkgForm, package_name: e.target.value})} /></div>
                <div><Label>Specialty</Label><Input value={pkgForm.specialty} onChange={e => setPkgForm({...pkgForm, specialty: e.target.value})} /></div>
                <div><Label>Rate (₹)</Label><Input type="number" value={pkgForm.package_rate} onChange={e => setPkgForm({...pkgForm, package_rate: e.target.value})} /></div>
                <Button onClick={savePackage} className="w-full">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button data-testid="pmjay-new-claim"><Plus className="h-4 w-4 mr-1" /> New Claim</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>New PMJAY Claim</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Patient ID *</Label><Input type="number" value={form.patient_id} onChange={e => setForm({...form, patient_id: e.target.value})} /></div>
                <div><Label>PMJAY ID *</Label><Input value={form.pmjay_id} onChange={e => setForm({...form, pmjay_id: e.target.value})} /></div>
                <div><Label>Family ID</Label><Input value={form.family_id} onChange={e => setForm({...form, family_id: e.target.value})} /></div>
                <div><Label>Package</Label>
                  <Select value={String(form.package_id)} onValueChange={v => {
                    const p = packages.find(x => String(x.id) === v);
                    setForm({...form, package_id: v, package_amount: p?.package_rate || 0});
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                    <SelectContent>{packages.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.package_code} — {p.package_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Package Amount</Label><Input type="number" value={form.package_amount} onChange={e => setForm({...form, package_amount: e.target.value})} /></div>
                <div><Label>Pre-Auth No.</Label><Input value={form.pre_auth_no} onChange={e => setForm({...form, pre_auth_no: e.target.value})} /></div>
                <div><Label>Admission Date</Label><Input type="date" value={form.admission_date} onChange={e => setForm({...form, admission_date: e.target.value})} /></div>
                <div><Label>Discharge Date</Label><Input type="date" value={form.discharge_date} onChange={e => setForm({...form, discharge_date: e.target.value})} /></div>
                <div><Label>Claim Amount</Label><Input type="number" value={form.claim_amount} onChange={e => setForm({...form, claim_amount: e.target.value})} /></div>
                <div className="col-span-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} /></div>
              </div>
              <Button onClick={createClaim} className="w-full">Create Claim</Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Draft</div><div className="text-2xl font-bold">{summary.draft_count || 0}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Submitted</div><div className="text-2xl font-bold text-blue-600">{summary.submitted_count || 0}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Approved</div><div className="text-2xl font-bold text-green-600">{summary.approved_count || 0}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Pending ₹</div><div className="text-xl font-bold text-amber-600 flex items-center"><IndianRupee className="h-4 w-4" />{Number(summary.pending_amount || 0).toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Received ₹</div><div className="text-xl font-bold text-green-700 flex items-center"><IndianRupee className="h-4 w-4" />{Number(summary.received_amount || 0).toLocaleString()}</div></CardContent></Card>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="submitted">Submitted</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
        </TabsList>
        <TabsContent value={filter}>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Claim #</TableHead><TableHead>Patient</TableHead><TableHead>PMJAY ID</TableHead>
                <TableHead>Package</TableHead><TableHead>Amount</TableHead><TableHead>Pre-Auth</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {claims.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.claim_no}</TableCell>
                    <TableCell>{c.patient_name || `#${c.patient_id}`}</TableCell>
                    <TableCell className="font-mono">{c.pmjay_id}</TableCell>
                    <TableCell className="text-xs">{c.package_name || c.package_code || "—"}</TableCell>
                    <TableCell>₹{Number(c.claim_amount).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={c.pre_auth_status === "approved" ? "default" : "secondary"}>{c.pre_auth_status}</Badge></TableCell>
                    <TableCell><Badge variant={statusColor[c.claim_status] as any || "secondary"}>{c.claim_status}</Badge></TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => { setOpenUpd(c); setUpd({}); }}>Update</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!openUpd} onOpenChange={() => setOpenUpd(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Claim {openUpd?.claim_no}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Pre-Auth Status</Label>
              <Select value={upd.pre_auth_status || ""} onValueChange={v => setUpd({...upd, pre_auth_status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Pre-Auth Amount</Label><Input type="number" value={upd.pre_auth_amount || ""} onChange={e => setUpd({...upd, pre_auth_amount: e.target.value})} /></div>
            <div><Label>Claim Status</Label>
              <Select value={upd.claim_status || ""} onValueChange={v => setUpd({...upd, claim_status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Approved Amount</Label><Input type="number" value={upd.approved_amount || ""} onChange={e => setUpd({...upd, approved_amount: e.target.value})} /></div>
            <div><Label>Payment UTR</Label><Input value={upd.payment_utr || ""} onChange={e => setUpd({...upd, payment_utr: e.target.value})} /></div>
            <div><Label>Payment Date</Label><Input type="date" value={upd.payment_date || ""} onChange={e => setUpd({...upd, payment_date: e.target.value})} /></div>
            <Button onClick={updateClaim} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
