import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ClipboardCheck, Plus, Printer, Clock, User, ShieldAlert, ArrowLeftRight, CheckCircle2 } from "lucide-react";

interface Handover {
  id: number;
  ipdAdmissionId: number;
  patientId: number;
  patientName: string;
  patientUhid: string;
  bedNo: string;
  wardName: string;
  shift: string;
  currentDiagnosis: string;
  currentCondition: string;
  vitalsConcern: string;
  ivFluidsRunning: string;
  oxygenStatus: string;
  drainsTubes: string;
  pendingMedications: string[];
  pendingInvestigations: string[];
  criticalInstructions: string;
  fallRisk: string;
  intakeOutputNotes: string;
  givenByEmployeeId: number;
  givenByEmployeeName: string;
  takenByEmployeeId: number;
  takenByEmployeeName: string;
  createdAt: string;
}

interface Props {
  admissionId: number;
  patientId: number;
  patientName: string;
  patientUhid: string;
  bedNo: string;
  wardName: string;
}

export default function NursingHandoverSection({ admissionId, patientId, patientName, patientUhid, bedNo, wardName }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [activeHandover, setActiveHandover] = useState<Handover | null>(null);

  const isNurseOrAdmin = user?.role === "nurse" || user?.role === "admin";

  const [form, setForm] = useState({
    shift: "Morning",
    currentDiagnosis: "",
    currentCondition: "Stable",
    vitalsConcern: "",
    ivFluidsRunning: "",
    oxygenStatus: "Room Air",
    drainsTubes: "",
    pendingMeds: "",
    pendingInvs: "",
    criticalInstructions: "",
    fallRisk: "No Risk",
    intakeOutputNotes: "",
    takenByEmployeeId: "",
  });

  const { data: handovers, isLoading } = useQuery<Handover[]>({
    queryKey: ["/api/ipd/handovers", admissionId],
    queryFn: () => fetch(`/api/ipd/${admissionId}/handovers`).then((r) => r.json()),
  });

  const { data: employees } = useQuery<{ id: number; name: string; role: string }[]>({
    queryKey: ["/api/employees"],
    queryFn: () => fetch("/api/employees").then((r) => r.json()),
  });

  const nursesList = (employees || []).filter(e => e.role === "nurse" || e.role === "admin");

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/ipd/${admissionId}/handovers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("Nursing Handover signed off successfully");
      setShowAdd(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["/api/ipd/handovers", admissionId] });
      qc.invalidateQueries({ queryKey: ["/api/nursing/handovers"] });
    },
    onError: (err: any) => toast.error("Handover failed: " + err.message),
  });

  const resetForm = () => {
    setForm({
      shift: "Morning",
      currentDiagnosis: "",
      currentCondition: "Stable",
      vitalsConcern: "",
      ivFluidsRunning: "",
      oxygenStatus: "Room Air",
      drainsTubes: "",
      pendingMeds: "",
      pendingInvs: "",
      criticalInstructions: "",
      fallRisk: "No Risk",
      intakeOutputNotes: "",
      takenByEmployeeId: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.takenByEmployeeId) {
      toast.error("Please select the receiving nurse (Handover Taken By)");
      return;
    }

    const payload = {
      patientId,
      shift: form.shift,
      currentDiagnosis: form.currentDiagnosis,
      currentCondition: form.currentCondition,
      vitalsConcern: form.vitalsConcern,
      ivFluidsRunning: form.ivFluidsRunning,
      oxygenStatus: form.oxygenStatus,
      drainsTubes: form.drainsTubes,
      pendingMedications: form.pendingMeds.split(",").map(m => m.trim()).filter(Boolean),
      pendingInvestigations: form.pendingInvs.split(",").map(i => i.trim()).filter(Boolean),
      criticalInstructions: form.criticalInstructions,
      fallRisk: form.fallRisk,
      intakeOutputNotes: form.intakeOutputNotes,
      givenByEmployeeId: user?.id || 1,
      takenByEmployeeId: parseInt(form.takenByEmployeeId),
    };

    createMutation.mutate(payload);
  };

  const printHandover = (h: Handover) => {
    const w = window.open("", "_blank", "width=850,height=950");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Nursing Shift Handover Sheet</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; line-height: 1.6; color: #333; }
            .header { text-align: center; border-bottom: 3px double #333; padding-bottom: 10px; margin-bottom: 20px; }
            .h-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; border: 1px solid #ccc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .section { margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            .section-title { font-weight: bold; color: #1a237e; text-transform: uppercase; font-size: 13px; }
            .badge { display: inline-block; padding: 2px 8px; font-weight: bold; background: #e8eaf6; color: #1a237e; border-radius: 4px; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; font-size: 22px;">Shift Handover Sheet</h1>
            <small style="color: #666;">Hope Neurotrauma & Multispeciality Hospital</small>
          </div>

          <div class="h-grid">
            <div><strong>Patient Name:</strong> ${patientName}</div>
            <div><strong>UHID:</strong> ${patientUhid}</div>
            <div><strong>Ward/Bed:</strong> ${wardName} / Bed ${bedNo}</div>
            <div><strong>Shift:</strong> <span class="badge">${h.shift}</span></div>
            <div><strong>Handover Date:</strong> ${new Date(h.createdAt).toLocaleString("en-IN")}</div>
            <div><strong>Current Condition:</strong> ${h.currentCondition}</div>
          </div>

          <div class="section">
            <span class="section-title">Current Diagnosis</span>
            <p>${h.currentDiagnosis || "—"}</p>
          </div>

          <div class="section">
            <span class="section-title">Vitals Concern</span>
            <p>${h.vitalsConcern || "None / Stable"}</p>
          </div>

          <div class="section">
            <span class="section-title">IV Fluids & Oxygen Status</span>
            <p><strong>IV Fluids:</strong> ${h.ivFluidsRunning || "None"}<br/><strong>O2/Vent Status:</strong> ${h.oxygenStatus}</p>
          </div>

          <div class="section">
            <span class="section-title">Drains, Catheters & Tubes</span>
            <p>${h.drainsTubes || "None"}</p>
          </div>

          <div class="section">
            <span class="section-title">Pending Medications & Investigations</span>
            <p><strong>Meds:</strong> ${(h.pendingMedications || []).join(", ") || "None"}<br/><strong>Invs:</strong> ${(h.pendingInvestigations || []).join(", ") || "None"}</p>
          </div>

          <div class="section">
            <span class="section-title">Safety Risks (Fall/Pressure Sore)</span>
            <p>${h.fallRisk || "No Risk"}</p>
          </div>

          <div class="section">
            <span class="section-title">Intake / Output Notes</span>
            <p>${h.intakeOutputNotes || "—"}</p>
          </div>

          <div class="section" style="background: #fff9c4; padding: 10px; border-radius: 6px;">
            <span class="section-title">⚠️ Critical Instructions</span>
            <p style="margin: 5px 0 0 0;"><strong>${h.criticalInstructions || "No critical instructions."}</strong></p>
          </div>

          <table style="width: 100%; margin-top: 50px; border-collapse: collapse;">
            <tr>
              <td style="width: 50%; border-top: 1px solid #333; padding-top: 10px;">
                <strong>Handover Given By:</strong><br/>
                Nurse: ${h.givenByEmployeeName || "Staff Nurse"}
              </td>
              <td style="width: 50%; border-top: 1px solid #333; padding-top: 10px; text-align: right;">
                <strong>Handover Taken By:</strong><br/>
                Nurse: ${h.takenByEmployeeName || "Staff Nurse"}
              </td>
            </tr>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `);
    w.document.close();
  };

  const lastHandover = handovers && handovers[0];

  return (
    <Card className="border shadow-sm bg-slate-50/20">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-slate-50/50">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-500" />
            Nursing Shift Handover
          </CardTitle>
          <CardDescription>Shift-to-shift nursing records and instructions</CardDescription>
        </div>
        <div className="flex gap-2">
          {lastHandover && (
            <Button size="sm" variant="outline" onClick={() => printHandover(lastHandover)} className="rounded-xl">
              <Printer className="w-4 h-4 mr-1" /> Print Last
            </Button>
          )}
          {isNurseOrAdmin && (
            <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 mr-1" /> New Handover
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
        ) : !lastHandover ? (
          <div className="text-center py-6 text-sm text-muted-foreground italic">No handovers logged for this admission yet.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-emerald-600" />
                <div>
                  <span className="text-xs font-semibold text-emerald-950 dark:text-emerald-300">Last Handover: {lastHandover.shift} Shift</span>
                  <span className="text-[10px] text-muted-foreground block">
                    Signed Off: {new Date(lastHandover.createdAt).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="text-emerald-700 text-xs font-semibold" onClick={() => setActiveHandover(lastHandover)}>View Full Sheet</Button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="border p-3 rounded-xl bg-white dark:bg-slate-900">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Current Diagnosis</span>
                <span className="font-semibold block mt-0.5">{lastHandover.currentDiagnosis || "—"}</span>
              </div>
              <div className="border p-3 rounded-xl bg-white dark:bg-slate-900">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Vitals Concern</span>
                <span className="font-semibold block mt-0.5">{lastHandover.vitalsConcern || "Stable"}</span>
              </div>
              <div className="border p-3 rounded-xl bg-white dark:bg-slate-900">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">IV Fluids / Oxygen</span>
                <span className="font-semibold block mt-0.5">IV: {lastHandover.ivFluidsRunning || "None"} | O2: {lastHandover.oxygenStatus}</span>
              </div>
              <div className="border p-3 rounded-xl bg-white dark:bg-slate-900">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Pending Meds/Invs</span>
                <span className="font-semibold block mt-0.5">
                  Meds: {(lastHandover.pendingMedications || []).length} | Invs: {(lastHandover.pendingInvestigations || []).length}
                </span>
              </div>
            </div>

            {lastHandover.criticalInstructions && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs flex gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block">Critical Instructions:</strong>
                  <span className="block mt-0.5 font-medium">{lastHandover.criticalInstructions}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Add Handover Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-emerald-600" /> New Shift Handover Note</DialogTitle>
            <CardDescription>Fill checklist to transition care safety to the next nurse shift</CardDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Shift *</Label>
                <select value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))} className="mt-1 w-full border rounded-lg h-9 px-2 bg-white dark:bg-slate-900">
                  <option value="Morning">Morning</option>
                  <option value="Evening">Evening</option>
                  <option value="Night">Night</option>
                </select>
              </div>
              <div>
                <Label>Current Condition</Label>
                <Input value={form.currentCondition} onChange={e => setForm(f => ({ ...f, currentCondition: e.target.value }))} className="mt-1 h-9" placeholder="Stable / Critical / Alert..." />
              </div>
              <div>
                <Label>Fall / Pressure Sore Risk</Label>
                <select value={form.fallRisk} onChange={e => setForm(f => ({ ...f, fallRisk: e.target.value }))} className="mt-1 w-full border rounded-lg h-9 px-2 bg-white dark:bg-slate-900">
                  <option value="No Risk">No Risk</option>
                  <option value="Moderate Risk">Moderate Risk</option>
                  <option value="High Risk">High Risk</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Current Diagnosis</Label>
                <Textarea value={form.currentDiagnosis} onChange={e => setForm(f => ({ ...f, currentDiagnosis: e.target.value }))} className="mt-1 h-16" placeholder="Reason for stay & primary condition..." />
              </div>
              <div>
                <Label>Vitals Concerns</Label>
                <Textarea value={form.vitalsConcern} onChange={e => setForm(f => ({ ...f, vitalsConcern: e.target.value }))} className="mt-1 h-16" placeholder="Spikes in temp, bradycardia, etc..." />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>IV Fluids Running</Label>
                <Input value={form.ivFluidsRunning} onChange={e => setForm(f => ({ ...f, ivFluidsRunning: e.target.value }))} className="mt-1 h-9" placeholder="NS 100ml/hr, RL, etc..." />
              </div>
              <div>
                <Label>Oxygen / Ventilator Status</Label>
                <Input value={form.oxygenStatus} onChange={e => setForm(f => ({ ...f, oxygenStatus: e.target.value }))} className="mt-1 h-9" placeholder="Room Air / 2L Nasal / BiPAP..." />
              </div>
              <div>
                <Label>Drains / Catheters / Tubes</Label>
                <Input value={form.drainsTubes} onChange={e => setForm(f => ({ ...f, drainsTubes: e.target.value }))} className="mt-1 h-9" placeholder="Foley's, Ryles tube, etc..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pending Medications (comma separated)</Label>
                <Input value={form.pendingMeds} onChange={e => setForm(f => ({ ...f, pendingMeds: e.target.value }))} className="mt-1 h-9" placeholder="e.g. Inj Piperacillin 2pm, Tab PCM 4pm..." />
              </div>
              <div>
                <Label>Pending Investigations (comma separated)</Label>
                <Input value={form.pendingInvs} onChange={e => setForm(f => ({ ...f, pendingInvs: e.target.value }))} className="mt-1 h-9" placeholder="e.g. Serum Potassium report, Chest Xray..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Intake / Output Notes</Label>
                <Textarea value={form.intakeOutputNotes} onChange={e => setForm(f => ({ ...f, intakeOutputNotes: e.target.value }))} className="mt-1 h-16" placeholder="Urinary output, oral fluid intake..." />
              </div>
              <div>
                <Label>⚠️ Critical Instructions</Label>
                <Textarea value={form.criticalInstructions} onChange={e => setForm(f => ({ ...f, criticalInstructions: e.target.value }))} className="mt-1 h-16 border-rose-300 focus:border-rose-500" placeholder="CRITICAL alert warnings, doctor visits planned..." />
              </div>
            </div>

            <div className="border-t pt-3 grid grid-cols-2 gap-4">
              <div>
                <Label>Handover Given By</Label>
                <Input value={user?.name || "Staff Nurse"} disabled className="mt-1 h-9 bg-slate-100" />
              </div>
              <div>
                <Label>Handover Taken By (Receiving Nurse) *</Label>
                <select value={form.takenByEmployeeId} onChange={e => setForm(f => ({ ...f, takenByEmployeeId: e.target.value }))} className="mt-1 w-full border rounded-lg h-9 px-2 bg-white dark:bg-slate-900">
                  <option value="">Select receiving staff...</option>
                  {nursesList.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                {createMutation.isPending ? "Signing Off..." : "Sign Off & Handover"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!activeHandover} onOpenChange={(o) => !o && setActiveHandover(null)}>
        <DialogContent className="max-w-2xl text-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nursing Handover Details</DialogTitle>
          </DialogHeader>
          {activeHandover && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg">
                <div><strong>Shift:</strong> {activeHandover.shift}</div>
                <div><strong>Signed Off:</strong> {new Date(activeHandover.createdAt).toLocaleString("en-IN")}</div>
                <div><strong>Given By:</strong> Nurse {activeHandover.givenByEmployeeName}</div>
                <div><strong>Taken By:</strong> Nurse {activeHandover.takenByEmployeeName}</div>
              </div>
              <div className="space-y-1">
                <strong>Diagnosis:</strong>
                <p className="bg-slate-50 p-2 rounded">{activeHandover.currentDiagnosis || "—"}</p>
              </div>
              <div className="space-y-1">
                <strong>Vitals Concern:</strong>
                <p className="bg-slate-50 p-2 rounded">{activeHandover.vitalsConcern || "Stable"}</p>
              </div>
              <div className="space-y-1">
                <strong>Safety Risk Status:</strong>
                <p className="bg-slate-50 p-2 rounded">{activeHandover.fallRisk || "No Risk"}</p>
              </div>
              {activeHandover.criticalInstructions && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded text-rose-900">
                  <strong>Critical Instructions:</strong>
                  <p className="mt-1 font-medium">{activeHandover.criticalInstructions}</p>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" className="rounded-xl" onClick={() => printHandover(activeHandover)}>
                  <Printer className="w-4 h-4 mr-1" /> Print Handover
                </Button>
                <Button className="rounded-xl" onClick={() => setActiveHandover(null)}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
