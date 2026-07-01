import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Shield, Plus, IndianRupee, FileCheck2, Send, CheckCircle2, XCircle, Building2, FileText,
} from "lucide-react";
import { DocumentIntegration } from "@/components/document-integration";
import { DocumentUpload } from "@/components/document-upload";

interface TpaProvider { id: number; name: string; code: string; contactPerson: string | null; phone: string | null; email: string | null; paymentTermDays: number; tdsPercent: string; status: string }
interface Patient { id: number; name: string; uhid: string }
interface IpdAdm { id: number; ipdNo: string; patientId: number; patientName: string; diagnosis: string | null; admissionDate: string; status: string }
interface Policy { id: number; patientId: number; patientName: string; tpaId: number; tpaName: string; policyNo: string; policyHolderName: string | null; sumInsured: string; copayPercent: string; policyEnd: string | null }
interface ClaimRow {
  id: number; claimNo: string;
  patientId: number; patientName: string; patientUhid: string;
  ipdAdmissionId: number | null;
  tpaId: number; tpaName: string;
  entityName: string | null;
  preauthAmount: string; preauthApprovedAmount: string; preauthApprovalNo: string | null;
  claimAmount: string; approvedAmount: string; disallowedAmount: string; settledAmount: string;
  settlementDate: string | null;
  status: string; createdAt: string;
}
interface Entity { id: number; name: string }

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  preauth_pending: { label: "Pre-auth Pending", cls: "bg-amber-100 text-amber-800" },
  preauth_approved: { label: "Pre-auth Approved", cls: "bg-blue-100 text-blue-800" },
  claim_submitted: { label: "Claim Submitted", cls: "bg-indigo-100 text-indigo-800" },
  partially_settled: { label: "Partially Settled", cls: "bg-orange-100 text-orange-800" },
  settled: { label: "Settled", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-800" },
};

export default function InsurancePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("claims");

  // ============ DATA ============
  const { data: claims } = useQuery<ClaimRow[]>({
    queryKey: ["/api/insurance-claims"],
    queryFn: async () => {
      const r = await fetch("/api/insurance-claims", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch claims");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: tpas } = useQuery<TpaProvider[]>({
    queryKey: ["/api/tpa-providers"],
    queryFn: async () => {
      const r = await fetch("/api/tpa-providers", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch TPA providers");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    queryFn: async () => {
      const r = await fetch("/api/patients", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch patients");
      const data = await r.json();
      return Array.isArray(data) ? data : (data?.patients || data?.data || []);
    },
  });
  const { data: admissions } = useQuery<IpdAdm[]>({
    queryKey: ["/api/ipd"],
    queryFn: async () => {
      const r = await fetch("/api/ipd", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch admissions");
      const data = await r.json();
      return Array.isArray(data) ? data : (data?.admissions || []);
    },
  });
  const { data: policies } = useQuery<Policy[]>({
    queryKey: ["/api/patient-insurance"],
    queryFn: async () => {
      const r = await fetch("/api/patient-insurance", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch policies");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: entities } = useQuery<Entity[]>({
    queryKey: ["/api/entities"],
    queryFn: async () => {
      const r = await fetch("/api/entities", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch entities");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // ============ NEW CLAIM ============
  const [showNewClaim, setShowNewClaim] = useState(false);
  const [nc, setNc] = useState({ patientId: "", ipdAdmissionId: "", tpaId: "", policyId: "", entityId: "1", preauthAmount: "", preauthDate: "", remarks: "" });
  const ncEligibleAdmissions = (admissions || []).filter((a) => !nc.patientId || a.patientId === Number(nc.patientId));
  const ncEligiblePolicies = (policies || []).filter((p) => !nc.patientId || p.patientId === Number(nc.patientId));

  const createClaim = useMutation({
    mutationFn: async () => {
      if (!nc.patientId || !nc.tpaId) throw new Error("Patient and TPA required");
      const r = await fetch("/api/insurance-claims", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          patientId: Number(nc.patientId),
          ipdAdmissionId: nc.ipdAdmissionId ? Number(nc.ipdAdmissionId) : null,
          tpaId: Number(nc.tpaId),
          policyId: nc.policyId ? Number(nc.policyId) : null,
          entityId: Number(nc.entityId),
          preauthAmount: Number(nc.preauthAmount || 0),
          preauthDate: nc.preauthDate || null,
          remarks: nc.remarks,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Claim created — pre-auth pending");
      setShowNewClaim(false);
      setNc({ patientId: "", ipdAdmissionId: "", tpaId: "", policyId: "", entityId: "1", preauthAmount: "", preauthDate: "", remarks: "" });
      qc.invalidateQueries({ queryKey: ["/api/insurance-claims"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ============ WORKFLOW DIALOGS ============
  const [activeClaim, setActiveClaim] = useState<ClaimRow | null>(null);
  const [actionMode, setActionMode] = useState<"preauth" | "submit" | "settle" | "reject" | null>(null);
  const [actionData, setActionData] = useState<any>({});

  const performAction = useMutation({
    mutationFn: async () => {
      if (!activeClaim || !actionMode) throw new Error("");
      const r = await fetch(`/api/insurance-claims/${activeClaim.id}/${actionMode === "preauth" ? "preauth-approve" : actionMode}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(actionData),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Updated");
      setActiveClaim(null); setActionMode(null); setActionData({});
      qc.invalidateQueries({ queryKey: ["/api/insurance-claims"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ============ NEW TPA ============
  const [showNewTpa, setShowNewTpa] = useState(false);
  const [newTpa, setNewTpa] = useState({ name: "", code: "", contactPerson: "", phone: "", email: "", paymentTermDays: 30, tdsPercent: 10 });
  const createTpa = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/tpa-providers", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(newTpa),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success("TPA added");
      setShowNewTpa(false);
      setNewTpa({ name: "", code: "", contactPerson: "", phone: "", email: "", paymentTermDays: 30, tdsPercent: 10 });
      qc.invalidateQueries({ queryKey: ["/api/tpa-providers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ============ NEW POLICY ============
  const [showNewPolicy, setShowNewPolicy] = useState(false);
  const [np, setNp] = useState({ patientId: "", tpaId: "", policyNo: "", policyHolderName: "", relationToHolder: "Self", policyStart: "", policyEnd: "", sumInsured: "", copayPercent: "10" });
  const createPolicy = useMutation({
    mutationFn: async () => {
      if (!np.patientId || !np.tpaId || !np.policyNo) throw new Error("Patient, TPA, policy no required");
      const r = await fetch("/api/patient-insurance", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          patientId: Number(np.patientId), tpaId: Number(np.tpaId),
          policyNo: np.policyNo, policyHolderName: np.policyHolderName,
          relationToHolder: np.relationToHolder,
          policyStart: np.policyStart || null, policyEnd: np.policyEnd || null,
          sumInsured: np.sumInsured ? Number(np.sumInsured) : null,
          copayPercent: Number(np.copayPercent || 0),
        }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Policy added");
      setShowNewPolicy(false);
      setNp({ patientId: "", tpaId: "", policyNo: "", policyHolderName: "", relationToHolder: "Self", policyStart: "", policyEnd: "", sumInsured: "", copayPercent: "10" });
      qc.invalidateQueries({ queryKey: ["/api/patient-insurance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = claims || [];
  const fmtINR = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
  const stats = {
    total: list.length,
    preauthPending: list.filter((c) => c.status === "preauth_pending").length,
    submitted: list.filter((c) => c.status === "claim_submitted").length,
    settled: list.filter((c) => c.status === "settled" || c.status === "partially_settled").length,
    outstanding: list.filter((c) => ["claim_submitted", "partially_settled"].includes(c.status))
      .reduce((s, c) => s + (Number(c.claimAmount) - Number(c.settledAmount)), 0),
    settledTotal: list.reduce((s, c) => s + Number(c.settledAmount || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Shield className="w-6 h-6 text-blue-700" />TPA / Insurance</h2>
          <p className="text-muted-foreground text-sm">Manage cashless claims, pre-auth workflow and TPA settlements.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Claims</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pre-auth Pending</p><p className="text-2xl font-bold text-amber-600">{stats.preauthPending}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Submitted</p><p className="text-2xl font-bold text-indigo-600">{stats.submitted}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Settled</p><p className="text-2xl font-bold text-emerald-600">{stats.settled}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-xl font-bold text-orange-600">{fmtINR(stats.outstanding)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Settled</p><p className="text-xl font-bold text-emerald-700">{fmtINR(stats.settledTotal)}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="policies">Patient Policies</TabsTrigger>
          <TabsTrigger value="tpas">TPA Providers</TabsTrigger>
          <TabsTrigger value="documents">📄 Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="claims" className="space-y-3">
          <div className="flex justify-end"><Button onClick={() => setShowNewClaim(true)}><Plus className="w-4 h-4 mr-1" />New Claim</Button></div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim #</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>TPA</TableHead>
                    <TableHead className="text-right">Pre-auth ₹</TableHead>
                    <TableHead className="text-right">Claimed ₹</TableHead>
                    <TableHead className="text-right">Approved ₹</TableHead>
                    <TableHead className="text-right">Settled ₹</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">No claims yet.</TableCell></TableRow>
                  ) : list.map((c) => {
                    const cfg = STATUS_CONFIG[c.status] || { label: c.status, cls: "" };
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.claimNo}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{c.patientName}</div>
                          <div className="text-xs text-muted-foreground font-mono">{c.patientUhid}</div>
                        </TableCell>
                        <TableCell className="text-sm">{c.tpaName}</TableCell>
                        <TableCell className="text-right text-sm">
                          {fmtINR(c.preauthApprovedAmount || c.preauthAmount)}
                          {Number(c.preauthApprovedAmount) > 0 && Number(c.preauthApprovedAmount) !== Number(c.preauthAmount) && (
                            <div className="text-xs text-muted-foreground line-through">{fmtINR(c.preauthAmount)}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">{fmtINR(c.claimAmount)}</TableCell>
                        <TableCell className="text-right text-sm">{fmtINR(c.approvedAmount)}</TableCell>
                        <TableCell className="text-right text-sm font-medium text-emerald-700">{fmtINR(c.settledAmount)}</TableCell>
                        <TableCell><Badge className={cfg.cls} variant="secondary">{cfg.label}</Badge></TableCell>
                        <TableCell className="text-right space-x-1">
                          {c.status === "preauth_pending" && (
                            <Button size="sm" variant="ghost" onClick={() => { setActiveClaim(c); setActionMode("preauth"); setActionData({ preauthApprovedAmount: c.preauthAmount, preauthApprovalNo: "" }); }}>
                              <FileCheck2 className="w-3.5 h-3.5 mr-1" />Approve Pre-auth
                            </Button>
                          )}
                          {c.status === "preauth_approved" && (
                            <Button size="sm" variant="ghost" onClick={() => { setActiveClaim(c); setActionMode("submit"); setActionData({ claimAmount: c.preauthApprovedAmount, claimSubmittedDate: new Date().toISOString().slice(0, 10) }); }}>
                              <Send className="w-3.5 h-3.5 mr-1" />Submit Claim
                            </Button>
                          )}
                          {(c.status === "claim_submitted" || c.status === "partially_settled") && (
                            <Button size="sm" variant="ghost" onClick={() => {
                              const claimAmt = Number(c.claimAmount);
                              setActiveClaim(c); setActionMode("settle");
                              setActionData({
                                approvedAmount: claimAmt,
                                disallowedAmount: 0,
                                copayAmount: 0,
                                tdsAmount: claimAmt * 0.10,
                                settledAmount: claimAmt * 0.90,
                                settlementDate: new Date().toISOString().slice(0, 10),
                                utrNumber: "",
                              });
                            }}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Settle
                            </Button>
                          )}
                          {!["settled", "rejected"].includes(c.status) && (
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { setActiveClaim(c); setActionMode("reject"); setActionData({ remarks: "" }); }}>
                              <XCircle className="w-3.5 h-3.5" />
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
        </TabsContent>

        <TabsContent value="policies" className="space-y-3">
          <div className="flex justify-end"><Button onClick={() => setShowNewPolicy(true)}><Plus className="w-4 h-4 mr-1" />Add Policy</Button></div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>TPA</TableHead>
                    <TableHead>Policy No</TableHead>
                    <TableHead>Holder</TableHead>
                    <TableHead className="text-right">Sum Insured</TableHead>
                    <TableHead className="text-right">Co-pay %</TableHead>
                    <TableHead>Valid Till</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(policies || []).length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">No policies yet.</TableCell></TableRow>
                  ) : (policies || []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm font-medium">{p.patientName}</TableCell>
                      <TableCell className="text-sm">{p.tpaName}</TableCell>
                      <TableCell className="font-mono text-xs">{p.policyNo}</TableCell>
                      <TableCell className="text-sm">{p.policyHolderName || "—"}</TableCell>
                      <TableCell className="text-right text-sm">{fmtINR(p.sumInsured)}</TableCell>
                      <TableCell className="text-right text-sm">{p.copayPercent}%</TableCell>
                      <TableCell className="text-xs">{p.policyEnd || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tpas" className="space-y-3">
          <div className="flex justify-end"><Button onClick={() => setShowNewTpa(true)}><Plus className="w-4 h-4 mr-1" />New TPA</Button></div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead><TableHead>Email</TableHead>
                    <TableHead className="text-right">Pay Term</TableHead>
                    <TableHead className="text-right">TDS %</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(tpas || []).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs font-medium">{t.code}</TableCell>
                      <TableCell className="text-sm">{t.name}</TableCell>
                      <TableCell className="text-xs">{t.contactPerson || "—"}</TableCell>
                      <TableCell className="text-xs">{t.phone || "—"}</TableCell>
                      <TableCell className="text-xs">{t.email || "—"}</TableCell>
                      <TableCell className="text-right text-xs">{t.paymentTermDays}d</TableCell>
                      <TableCell className="text-right text-xs">{t.tdsPercent}%</TableCell>
                      <TableCell><Badge variant={t.status === "active" ? "default" : "secondary"}>{t.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Insurance & TPA Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200">
                <p className="text-xs text-muted-foreground mb-3">
                  Upload insurance certificates, TPA agreements, pre-authorization documents, claim settlement proofs, and related insurance documents.
                </p>
                <DocumentUpload
                  category="Insurance"
                  patientId={0}
                  module="Billing"
                  department="Insurance & TPA"
                  description="Insurance certificate or TPA document"
                  tags={["insurance", "tpa", "claim"]}
                  multiple={true}
                />
              </div>

              <DocumentIntegration
                patientId={0}
                module="Billing"
                title="All Insurance Documents"
                showUpload={false}
                maxDocuments={35}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Claim Dialog */}
      <Dialog open={showNewClaim} onOpenChange={setShowNewClaim}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Insurance Claim</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Patient *</Label>
              <Select value={nc.patientId} onValueChange={(v) => setNc({ ...nc, patientId: v, ipdAdmissionId: "", policyId: "" })}>
                <SelectTrigger><SelectValue placeholder="Pick patient..." /></SelectTrigger>
                <SelectContent>{(patients || []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.uhid})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>IPD Admission (optional)</Label>
              <Select value={nc.ipdAdmissionId} onValueChange={(v) => setNc({ ...nc, ipdAdmissionId: v })}>
                <SelectTrigger><SelectValue placeholder="Pick admission..." /></SelectTrigger>
                <SelectContent>
                  {ncEligibleAdmissions.length === 0 ? <div className="p-2 text-sm text-muted-foreground">No admissions for this patient</div> :
                    ncEligibleAdmissions.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.ipdNo} • {a.admissionDate} {a.diagnosis && `• ${a.diagnosis}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>TPA *</Label>
              <Select value={nc.tpaId} onValueChange={(v) => setNc({ ...nc, tpaId: v })}>
                <SelectTrigger><SelectValue placeholder="Pick TPA..." /></SelectTrigger>
                <SelectContent>{(tpas || []).map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Policy</Label>
              <Select value={nc.policyId} onValueChange={(v) => setNc({ ...nc, policyId: v })}>
                <SelectTrigger><SelectValue placeholder="Pick policy..." /></SelectTrigger>
                <SelectContent>
                  {ncEligiblePolicies.length === 0 ? <div className="p-2 text-sm text-muted-foreground">No policy on file — claim can still proceed</div> :
                    ncEligiblePolicies.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.policyNo} • {p.tpaName} • {fmtINR(p.sumInsured)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entity</Label>
              <Select value={nc.entityId} onValueChange={(v) => setNc({ ...nc, entityId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(entities || []).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pre-auth Date</Label>
              <Input type="date" value={nc.preauthDate} onChange={(e) => setNc({ ...nc, preauthDate: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Pre-auth Amount Requested *</Label>
              <Input type="number" value={nc.preauthAmount} onChange={(e) => setNc({ ...nc, preauthAmount: e.target.value })} placeholder="Enter requested amount" />
            </div>
            <div className="col-span-2">
              <Label>Remarks</Label>
              <Textarea rows={2} value={nc.remarks} onChange={(e) => setNc({ ...nc, remarks: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewClaim(false)}>Cancel</Button>
            <Button onClick={() => createClaim.mutate()} disabled={!nc.patientId || !nc.tpaId || createClaim.isPending}>
              {createClaim.isPending ? "Creating..." : "Create Claim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workflow Action Dialog */}
      <Dialog open={!!actionMode} onOpenChange={(o) => { if (!o) { setActionMode(null); setActiveClaim(null); }}}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {actionMode === "preauth" && "Approve Pre-authorization"}
              {actionMode === "submit" && "Submit Claim to TPA"}
              {actionMode === "settle" && "Settle Claim"}
              {actionMode === "reject" && "Reject Claim"}
            </DialogTitle>
          </DialogHeader>
          {activeClaim && (
            <div className="space-y-3">
              <div className="text-sm p-2 bg-muted/30 rounded">
                <strong>{activeClaim.claimNo}</strong> • {activeClaim.patientName} • {activeClaim.tpaName}
              </div>
              {actionMode === "preauth" && (
                <>
                  <div><Label>Approved Amount</Label><Input type="number" value={actionData.preauthApprovedAmount || ""} onChange={(e) => setActionData({ ...actionData, preauthApprovedAmount: e.target.value })} /></div>
                  <div><Label>TPA Approval Number</Label><Input value={actionData.preauthApprovalNo || ""} onChange={(e) => setActionData({ ...actionData, preauthApprovalNo: e.target.value })} /></div>
                </>
              )}
              {actionMode === "submit" && (
                <>
                  <div><Label>Final Bill / Claim Amount</Label><Input type="number" value={actionData.claimAmount || ""} onChange={(e) => setActionData({ ...actionData, claimAmount: e.target.value })} /></div>
                  <div><Label>Submitted Date</Label><Input type="date" value={actionData.claimSubmittedDate || ""} onChange={(e) => setActionData({ ...actionData, claimSubmittedDate: e.target.value })} /></div>
                </>
              )}
              {actionMode === "settle" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Approved Amount</Label><Input type="number" value={actionData.approvedAmount || ""} onChange={(e) => setActionData({ ...actionData, approvedAmount: e.target.value })} /></div>
                    <div><Label>Disallowed Amount</Label><Input type="number" value={actionData.disallowedAmount || ""} onChange={(e) => setActionData({ ...actionData, disallowedAmount: e.target.value })} /></div>
                    <div><Label>Co-pay (Patient)</Label><Input type="number" value={actionData.copayAmount || ""} onChange={(e) => setActionData({ ...actionData, copayAmount: e.target.value })} /></div>
                    <div><Label>TDS Deducted</Label><Input type="number" value={actionData.tdsAmount || ""} onChange={(e) => setActionData({ ...actionData, tdsAmount: e.target.value })} /></div>
                    <div className="col-span-2"><Label>Settled Amount (Net Received)</Label><Input type="number" value={actionData.settledAmount || ""} onChange={(e) => setActionData({ ...actionData, settledAmount: e.target.value })} /></div>
                    <div><Label>Settlement Date</Label><Input type="date" value={actionData.settlementDate || ""} onChange={(e) => setActionData({ ...actionData, settlementDate: e.target.value })} /></div>
                    <div><Label>UTR / Cheque #</Label><Input value={actionData.utrNumber || ""} onChange={(e) => setActionData({ ...actionData, utrNumber: e.target.value })} /></div>
                  </div>
                </>
              )}
              {actionMode === "reject" && (
                <div><Label>Reason for Rejection</Label><Textarea rows={3} value={actionData.remarks || ""} onChange={(e) => setActionData({ ...actionData, remarks: e.target.value })} /></div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionMode(null); setActiveClaim(null); }}>Cancel</Button>
            <Button onClick={() => performAction.mutate()} disabled={performAction.isPending}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New TPA */}
      <Dialog open={showNewTpa} onOpenChange={setShowNewTpa}>
        <DialogContent>
          <DialogHeader><DialogTitle>New TPA Provider</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name *</Label><Input value={newTpa.name} onChange={(e) => setNewTpa({ ...newTpa, name: e.target.value })} /></div>
            <div><Label>Code *</Label><Input value={newTpa.code} onChange={(e) => setNewTpa({ ...newTpa, code: e.target.value.toUpperCase() })} /></div>
            <div><Label>Contact Person</Label><Input value={newTpa.contactPerson} onChange={(e) => setNewTpa({ ...newTpa, contactPerson: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={newTpa.phone} onChange={(e) => setNewTpa({ ...newTpa, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={newTpa.email} onChange={(e) => setNewTpa({ ...newTpa, email: e.target.value })} /></div>
            <div><Label>Payment Term (days)</Label><Input type="number" value={newTpa.paymentTermDays} onChange={(e) => setNewTpa({ ...newTpa, paymentTermDays: Number(e.target.value) })} /></div>
            <div><Label>TDS %</Label><Input type="number" value={newTpa.tdsPercent} onChange={(e) => setNewTpa({ ...newTpa, tdsPercent: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTpa(false)}>Cancel</Button>
            <Button onClick={() => createTpa.mutate()} disabled={!newTpa.name || !newTpa.code}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Policy */}
      <Dialog open={showNewPolicy} onOpenChange={setShowNewPolicy}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add Patient Policy</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Patient *</Label>
              <Select value={np.patientId} onValueChange={(v) => setNp({ ...np, patientId: v })}>
                <SelectTrigger><SelectValue placeholder="Pick patient..." /></SelectTrigger>
                <SelectContent>{(patients || []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.uhid})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>TPA *</Label>
              <Select value={np.tpaId} onValueChange={(v) => setNp({ ...np, tpaId: v })}>
                <SelectTrigger><SelectValue placeholder="Pick TPA..." /></SelectTrigger>
                <SelectContent>{(tpas || []).map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Policy Number *</Label><Input value={np.policyNo} onChange={(e) => setNp({ ...np, policyNo: e.target.value })} /></div>
            <div><Label>Holder Name</Label><Input value={np.policyHolderName} onChange={(e) => setNp({ ...np, policyHolderName: e.target.value })} /></div>
            <div>
              <Label>Relation to Holder</Label>
              <Select value={np.relationToHolder} onValueChange={(v) => setNp({ ...np, relationToHolder: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Self", "Spouse", "Father", "Mother", "Son", "Daughter", "Other"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Sum Insured</Label><Input type="number" value={np.sumInsured} onChange={(e) => setNp({ ...np, sumInsured: e.target.value })} /></div>
            <div><Label>Policy Start</Label><Input type="date" value={np.policyStart} onChange={(e) => setNp({ ...np, policyStart: e.target.value })} /></div>
            <div><Label>Policy End</Label><Input type="date" value={np.policyEnd} onChange={(e) => setNp({ ...np, policyEnd: e.target.value })} /></div>
            <div><Label>Co-pay %</Label><Input type="number" value={np.copayPercent} onChange={(e) => setNp({ ...np, copayPercent: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPolicy(false)}>Cancel</Button>
            <Button onClick={() => createPolicy.mutate()} disabled={!np.patientId || !np.tpaId || !np.policyNo}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
