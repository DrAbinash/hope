import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Baby, Plus, Stethoscope, ShieldAlert } from "lucide-react";

type DoseRule = {
  id: number; medicine_id: number; medicine_name: string; generic_name: string;
  age_group: string; min_age_months: number; max_age_months: number;
  min_weight_kg: number | null; max_weight_kg: number | null;
  mg_per_kg_per_day: number; max_single_dose_mg: number | null;
  max_daily_dose_mg: number | null; frequency_max: number | null;
  warning_note: string | null;
};

type DoseCheckResult = {
  status: "green" | "yellow" | "red" | "no_rule" | "skipped";
  weight_kg?: number;
  recommended_single_dose_mg?: number;
  recommended_daily_dose_mg?: number;
  min_single_dose_mg?: number;
  rounding_suggestion?: { low: number; high: number };
  warnings?: string[];
  rule_note?: string;
  requires_override?: boolean;
  message?: string;
};

const STATUS_META = {
  green: { label: "Safe", bg: "bg-green-50 border-green-200", badge: "bg-green-100 text-green-800", icon: CheckCircle2 },
  yellow: { label: "Caution", bg: "bg-amber-50 border-amber-200", badge: "bg-amber-100 text-amber-800", icon: AlertTriangle },
  red: { label: "Unsafe — Override Required", bg: "bg-red-50 border-red-200", badge: "bg-red-100 text-red-800", icon: ShieldAlert },
  no_rule: { label: "No Rule Found", bg: "bg-gray-50 border-gray-200", badge: "bg-gray-100 text-gray-700", icon: Baby },
  skipped: { label: "Skipped", bg: "bg-gray-50 border-gray-200", badge: "bg-gray-100 text-gray-700", icon: Baby },
};

export default function PediatricSafety() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("calculator");
  const [calc, setCalc] = useState({ medicine_id: "", weight_kg: "", age_months: "", dose_mg: "", frequency_per_day: "3" });
  const [doseResult, setDoseResult] = useState<DoseCheckResult | null>(null);
  const [overrideDialog, setOverrideDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [newRule, setNewRule] = useState({ medicine_id: "", mg_per_kg_per_day: "", max_single_dose_mg: "", max_daily_dose_mg: "", frequency_max: "", warning_note: "" });
  const [showNewRule, setShowNewRule] = useState(false);

  const { data: medicines = [] } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/medicines"],
    queryFn: async () => {
      const r = await fetch("/api/pharmacy/medicines?limit=500", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch medicines");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: rules = [], isLoading } = useQuery<DoseRule[]>({
    queryKey: ["/api/pharmacy/pediatric-doses"],
    queryFn: async () => {
      const r = await fetch("/api/pharmacy/pediatric-doses", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch dose rules");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: tab === "master",
  });

  const { data: overrides = [] } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/pediatric-doses/overrides"],
    queryFn: async () => {
      const r = await fetch("/api/pharmacy/pediatric-doses/overrides", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch overrides");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: tab === "overrides",
  });

  const checkMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/pharmacy/pediatric-doses/check", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Failed to check dose");
      return r.json();
    },
    onSuccess: (res) => { setDoseResult(res); if (res.requires_override) setOverrideDialog(true); },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/pharmacy/pediatric-doses", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Failed to save dose rule");
      return r.json();
    },
    onSuccess: () => { toast.success("Pediatric dose rule saved"); qc.invalidateQueries({ queryKey: ["/api/pharmacy/pediatric-doses"] }); setShowNewRule(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const overrideMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/pharmacy/pediatric-doses/override", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Failed to record override");
      return r.json();
    },
    onSuccess: () => { toast.success("Override recorded — proceed with caution"); setOverrideDialog(false); },
  });

  function doCheck() {
    if (!calc.medicine_id || !calc.weight_kg) { toast.error("Medicine and weight are required"); return; }
    checkMutation.mutate({
      medicine_id: Number(calc.medicine_id), weight_kg: Number(calc.weight_kg),
      age_months: calc.age_months ? Number(calc.age_months) : undefined,
      dose_mg: calc.dose_mg ? Number(calc.dose_mg) : undefined,
      frequency_per_day: Number(calc.frequency_per_day),
    });
  }

  const result = doseResult;
  const meta = result ? STATUS_META[result.status] : null;
  const StatusIcon = meta?.icon ?? Baby;

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Baby className="h-6 w-6 text-blue-600" />
        <div><h1 className="text-xl font-bold">Pediatric Dose Safety</h1><p className="text-sm text-muted-foreground">Age and weight-based dosing engine for children</p></div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="calculator">Dose Calculator</TabsTrigger>
          <TabsTrigger value="master">Dose Master</TabsTrigger>
          <TabsTrigger value="overrides">Override Log</TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="space-y-4 pt-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Enter Patient & Dose Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2 md:col-span-1">
                <Label>Medicine *</Label>
                <Select value={calc.medicine_id} onValueChange={v => setCalc(p => ({ ...p, medicine_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
                  <SelectContent>
                    {medicines.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Weight (kg) *</Label>
                <Input type="number" placeholder="e.g. 12.5" value={calc.weight_kg} onChange={e => setCalc(p => ({ ...p, weight_kg: e.target.value }))} />
              </div>
              <div>
                <Label>Age (months)</Label>
                <Input type="number" placeholder="e.g. 36" value={calc.age_months} onChange={e => setCalc(p => ({ ...p, age_months: e.target.value }))} />
              </div>
              <div>
                <Label>Prescribed Dose (mg)</Label>
                <Input type="number" placeholder="Single dose in mg" value={calc.dose_mg} onChange={e => setCalc(p => ({ ...p, dose_mg: e.target.value }))} />
              </div>
              <div>
                <Label>Frequency/day</Label>
                <Select value={calc.frequency_per_day} onValueChange={v => setCalc(p => ({ ...p, frequency_per_day: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 6, 8].map(n => <SelectItem key={n} value={String(n)}>{n}× daily</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={doCheck} disabled={checkMutation.isPending} className="w-full">
                  {checkMutation.isPending ? "Checking…" : "Check Safety"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {result && meta && (
            <Card className={`border-2 ${meta.bg}`}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <StatusIcon className={`h-5 w-5 ${result.status === "green" ? "text-green-600" : result.status === "yellow" ? "text-amber-600" : "text-red-600"}`} />
                  <Badge className={meta.badge}>{meta.label}</Badge>
                  {result.status === "red" && <Badge variant="destructive">Hard Stop — Admin/Consultant Override Required</Badge>}
                </div>
                {result.status !== "no_rule" && result.status !== "skipped" && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="bg-white rounded p-2 border">
                      <div className="text-muted-foreground text-xs">Recommended Single</div>
                      <div className="font-bold text-lg">{result.recommended_single_dose_mg} mg</div>
                    </div>
                    <div className="bg-white rounded p-2 border">
                      <div className="text-muted-foreground text-xs">Max Daily</div>
                      <div className="font-bold text-lg">{result.recommended_daily_dose_mg} mg</div>
                    </div>
                    <div className="bg-white rounded p-2 border">
                      <div className="text-muted-foreground text-xs">Min Single</div>
                      <div className="font-bold text-lg">{result.min_single_dose_mg} mg</div>
                    </div>
                    {result.rounding_suggestion && (
                      <div className="bg-white rounded p-2 border">
                        <div className="text-muted-foreground text-xs">Rounding Suggestion</div>
                        <div className="font-bold">{result.rounding_suggestion.low} – {result.rounding_suggestion.high} mg</div>
                      </div>
                    )}
                  </div>
                )}
                {result.warnings && result.warnings.length > 0 && (
                  <ul className="space-y-1">
                    {result.warnings.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {result.rule_note && <p className="text-sm text-muted-foreground italic">ℹ {result.rule_note}</p>}
                {result.message && <p className="text-sm text-muted-foreground">{result.message}</p>}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="master" className="space-y-3 pt-2">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowNewRule(true)}><Plus className="h-4 w-4 mr-1" />Add Rule</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Age Group</TableHead>
                  <TableHead>Weight Range</TableHead>
                  <TableHead>mg/kg/day</TableHead>
                  <TableHead>Max Single</TableHead>
                  <TableHead>Max Daily</TableHead>
                  <TableHead>Freq/day</TableHead>
                  <TableHead>Warning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : rules.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No pediatric rules configured. Click "Add Rule" to start.</TableCell></TableRow>
                ) : rules.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.medicine_name}<div className="text-xs text-muted-foreground">{r.generic_name}</div></TableCell>
                    <TableCell>{r.age_group}</TableCell>
                    <TableCell>{r.min_weight_kg ?? "—"} – {r.max_weight_kg ?? "∞"} kg</TableCell>
                    <TableCell>{r.mg_per_kg_per_day}</TableCell>
                    <TableCell>{r.max_single_dose_mg ?? "—"}</TableCell>
                    <TableCell>{r.max_daily_dose_mg ?? "—"}</TableCell>
                    <TableCell>{r.frequency_max ?? "—"}</TableCell>
                    <TableCell className="max-w-40 truncate text-xs text-amber-700">{r.warning_note ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="overrides" className="pt-2">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Prescribed</TableHead>
                  <TableHead>Calc Max</TableHead>
                  <TableHead>Over%</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Overridden By</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No override records</TableCell></TableRow>
                ) : overrides.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-xs">{new Date(o.created_at).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell>{o.medicine_name}</TableCell>
                    <TableCell>{o.patient_name ?? "—"}</TableCell>
                    <TableCell>{o.prescribed_dose_mg} mg</TableCell>
                    <TableCell>{o.calculated_max_mg ?? "—"}</TableCell>
                    <TableCell><Badge className={Number(o.override_percent) > 100 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>{Number(o.override_percent).toFixed(0)}%</Badge></TableCell>
                    <TableCell><Badge variant={o.risk_level === "critical" ? "destructive" : "outline"}>{o.risk_level}</Badge></TableCell>
                    <TableCell className="text-xs">{o.overridden_by_name} <span className="text-muted-foreground">({o.overridden_by_role})</span></TableCell>
                    <TableCell className="text-xs max-w-40 truncate">{o.override_reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Rule Dialog */}
      <Dialog open={showNewRule} onOpenChange={setShowNewRule}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Pediatric Dose Rule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Medicine *</Label>
              <Select value={newRule.medicine_id} onValueChange={v => setNewRule(p => ({ ...p, medicine_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
                <SelectContent>{medicines.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>mg/kg/day *</Label><Input type="number" value={newRule.mg_per_kg_per_day} onChange={e => setNewRule(p => ({ ...p, mg_per_kg_per_day: e.target.value }))} /></div>
              <div><Label>Max Single Dose (mg)</Label><Input type="number" value={newRule.max_single_dose_mg} onChange={e => setNewRule(p => ({ ...p, max_single_dose_mg: e.target.value }))} /></div>
              <div><Label>Max Daily Dose (mg)</Label><Input type="number" value={newRule.max_daily_dose_mg} onChange={e => setNewRule(p => ({ ...p, max_daily_dose_mg: e.target.value }))} /></div>
              <div><Label>Max Frequency/day</Label><Input type="number" value={newRule.frequency_max} onChange={e => setNewRule(p => ({ ...p, frequency_max: e.target.value }))} /></div>
            </div>
            <div><Label>Warning Note</Label><Textarea value={newRule.warning_note} onChange={e => setNewRule(p => ({ ...p, warning_note: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewRule(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate({ medicine_id: Number(newRule.medicine_id), mg_per_kg_per_day: Number(newRule.mg_per_kg_per_day), max_single_dose_mg: newRule.max_single_dose_mg ? Number(newRule.max_single_dose_mg) : undefined, max_daily_dose_mg: newRule.max_daily_dose_mg ? Number(newRule.max_daily_dose_mg) : undefined, frequency_max: newRule.frequency_max ? Number(newRule.frequency_max) : undefined, warning_note: newRule.warning_note || undefined })} disabled={saveMutation.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override Dialog */}
      <Dialog open={overrideDialog} onOpenChange={setOverrideDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-red-600 flex items-center gap-2"><ShieldAlert className="h-5 w-5" />Pediatric Dose Override Required</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">The entered dose exceeds the recommended pediatric safety limit. This requires consultant or admin override with documented reason.</p>
          {doseResult?.warnings?.map((w, i) => <p key={i} className="text-sm text-red-600 font-medium">⚠ {w}</p>)}
          <div>
            <Label>Override Reason (required) *</Label>
            <Textarea rows={3} placeholder="Specify clinical justification from consultant..." value={overrideReason} onChange={e => setOverrideReason(e.target.value)} className="border-red-300 mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOverrideDialog(false); setDoseResult(null); }}>Cancel — Do Not Dispense</Button>
            <Button variant="destructive" disabled={!overrideReason.trim() || overrideMutation.isPending} onClick={() => overrideMutation.mutate({ medicine_id: Number(calc.medicine_id), prescribed_dose_mg: Number(calc.dose_mg), calculated_max_mg: doseResult?.recommended_single_dose_mg, override_reason: overrideReason })}>
              Record Override & Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
