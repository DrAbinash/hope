import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { BookOpen, Printer, Plus, MessageSquare } from "lucide-react";

const FOOD_LABELS: Record<string, string> = {
  before_food: "Before Food / खाने से पहले",
  after_food: "After Food / खाने के बाद",
  with_food: "With Food / खाने के साथ",
  empty_stomach: "Empty Stomach / खाली पेट",
  any_time: "Any Time / कभी भी",
};

function InstructionSlipPrint({ slip, patient }: { slip: any; patient: any }) {
  return (
    <div className="p-6 bg-white text-sm print:p-0" id="slip-print-area">
      <div className="border-b-2 border-gray-800 pb-3 mb-4">
        <h2 className="text-lg font-bold text-center">Medicine Instruction Sheet / दवा निर्देश पर्ची</h2>
        {patient && <div className="text-center text-xs mt-1 text-gray-600">Patient: {slip.sale?.patient_name} | Age: {patient.age ?? "—"} | Bill: {slip.sale?.bill_no}</div>}
      </div>
      <div className="space-y-4">
        {slip.slip_items?.map((item: any, i: number) => (
          <div key={i} className="border rounded-lg p-3 break-inside-avoid">
            <div className="font-bold text-base flex items-center justify-between">
              <span>{item.medicine_name}</span>
              <span className="text-xs font-normal text-gray-500">Qty: {item.quantity}</span>
            </div>
            {item.template ? (
              <div className="mt-2 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div><span className="font-medium">Food: </span>{FOOD_LABELS[item.template.food_relation] ?? item.template.food_relation}</div>
                  {item.template.timing_english && <div><span className="font-medium">Timing: </span>{item.template.timing_english}</div>}
                  {item.template.timing_hindi && <div className="text-gray-600">{item.template.timing_hindi}</div>}
                  {item.template.storage_english && <div><span className="font-medium">Storage: </span>{item.template.storage_english}</div>}
                </div>
                {item.template.warnings_english && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
                    ⚠ <span className="font-medium">Warning: </span>{item.template.warnings_english}
                    {item.template.warnings_hindi && <div className="text-gray-600 mt-0.5">{item.template.warnings_hindi}</div>}
                  </div>
                )}
                {item.template.missed_dose_english && (
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Missed dose: </span>{item.template.missed_dose_english}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-1 italic">No instruction template configured for this medicine</p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t text-xs text-gray-500 text-center">
        If you have any questions about your medicines, please ask the pharmacist. / दवाओं के बारे में कोई प्रश्न हो तो फार्मासिस्ट से पूछें।
      </div>
    </div>
  );
}

export default function CounsellingSlip() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("generate");
  const [saleId, setSaleId] = useState("");
  const [showSlip, setShowSlip] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTpl, setNewTpl] = useState({
    medicine_id: "", timing_english: "", timing_hindi: "", storage_english: "", storage_hindi: "",
    warnings_english: "", warnings_hindi: "", missed_dose_english: "", missed_dose_hindi: "",
    food_relation: "after_food"
  });

  const { data: slip } = useQuery<any>({
    queryKey: ["/api/pharmacy/counselling-slips", saleId],
    queryFn: async () => {
      const r = await fetch(`/api/pharmacy/counselling-slips/${saleId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch counselling slip");
      return r.json();
    },
    enabled: showSlip && !!saleId,
  });

  const { data: medicines = [] } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/medicines"],
    queryFn: async () => {
      const r = await fetch("/api/pharmacy/medicines?limit=500", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch medicines");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: templates = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/counselling-templates"],
    queryFn: async () => {
      const r = await fetch("/api/pharmacy/counselling-templates", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch templates");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: tab === "templates",
  });

  const saveTplMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/pharmacy/counselling-templates", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Failed to save template");
      return r.json();
    },
    onSuccess: () => { toast.success("Template saved"); qc.invalidateQueries({ queryKey: ["/api/pharmacy/counselling-templates"] }); setShowNewTemplate(false); },
    onError: (e: any) => toast.error(e.message),
  });

  function printSlip() { window.print(); }

  function buildWhatsApp() {
    if (!slip) return;
    const lines = [`*Medicine Instructions — ${slip.sale?.patient_name ?? "Patient"}*`, `Bill: ${slip.sale?.bill_no}`];
    slip.slip_items?.forEach((it: any) => {
      lines.push(`\n*${it.medicine_name}* (Qty: ${it.quantity})`);
      if (it.template) {
        lines.push(`Food: ${FOOD_LABELS[it.template.food_relation]}`);
        if (it.template.timing_english) lines.push(`Timing: ${it.template.timing_english}`);
        if (it.template.storage_english) lines.push(`Storage: ${it.template.storage_english}`);
        if (it.template.warnings_english) lines.push(`⚠ ${it.template.warnings_english}`);
      }
    });
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-indigo-600" />
        <div><h1 className="text-xl font-bold">Medicine Counselling Slips</h1><p className="text-sm text-muted-foreground">Bilingual Hindi + English patient instruction sheets</p></div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="generate">Generate Slip</TabsTrigger>
          <TabsTrigger value="templates">Instruction Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4 pt-2">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1"><Label>Pharmacy Bill / Sale ID</Label><Input type="number" placeholder="Enter Sale ID" value={saleId} onChange={e => setSaleId(e.target.value)} /></div>
                <Button onClick={() => setShowSlip(true)} disabled={!saleId}>Load Slip</Button>
              </div>
            </CardContent>
          </Card>

          {showSlip && slip && !slip.error && (
            <Card>
              <CardContent className="pt-0">
                <div className="flex justify-end gap-2 py-3 print:hidden">
                  <Button size="sm" variant="outline" onClick={buildWhatsApp}><MessageSquare className="h-4 w-4 mr-1" />WhatsApp</Button>
                  <Button size="sm" onClick={printSlip}><Printer className="h-4 w-4 mr-1" />Print</Button>
                </div>
                <InstructionSlipPrint slip={slip} patient={null} />
              </CardContent>
            </Card>
          )}
          {showSlip && slip?.error && (
            <div className="text-center py-10 text-red-500">Sale not found. Check the ID.</div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-3 pt-2">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowNewTemplate(true)}><Plus className="h-4 w-4 mr-1" />Add Template</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Food Relation</TableHead>
                  <TableHead>Timing (EN)</TableHead>
                  <TableHead>Timing (HI)</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Warning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">Loading…</TableCell></TableRow>
                ) : templates.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No templates yet. Add one to get started.</TableCell></TableRow>
                ) : templates.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.medicine_name}<div className="text-xs text-muted-foreground">{t.formulation}</div></TableCell>
                    <TableCell className="text-xs">{FOOD_LABELS[t.food_relation] ?? t.food_relation}</TableCell>
                    <TableCell className="text-xs max-w-36 truncate">{t.timing_english ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-36 truncate">{t.timing_hindi ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-36 truncate">{t.storage_english ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-36 truncate text-amber-700">{t.warnings_english ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Template Dialog */}
      <Dialog open={showNewTemplate} onOpenChange={setShowNewTemplate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add Medicine Instruction Template</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div>
              <Label>Medicine *</Label>
              <Select value={newTpl.medicine_id} onValueChange={v => setNewTpl(p => ({ ...p, medicine_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
                <SelectContent>{medicines.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Food Relation</Label>
              <Select value={newTpl.food_relation} onValueChange={v => setNewTpl(p => ({ ...p, food_relation: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(FOOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Timing (English)</Label><Input value={newTpl.timing_english} onChange={e => setNewTpl(p => ({ ...p, timing_english: e.target.value }))} placeholder="e.g. 1 tablet morning and night" /></div>
              <div><Label>Timing (Hindi)</Label><Input value={newTpl.timing_hindi} onChange={e => setNewTpl(p => ({ ...p, timing_hindi: e.target.value }))} placeholder="e.g. सुबह और रात 1 गोली" /></div>
              <div><Label>Storage (English)</Label><Input value={newTpl.storage_english} onChange={e => setNewTpl(p => ({ ...p, storage_english: e.target.value }))} placeholder="e.g. Store in cool dry place" /></div>
              <div><Label>Storage (Hindi)</Label><Input value={newTpl.storage_hindi} onChange={e => setNewTpl(p => ({ ...p, storage_hindi: e.target.value }))} placeholder="e.g. ठंडी सूखी जगह रखें" /></div>
              <div><Label>Warning (English)</Label><Textarea rows={2} value={newTpl.warnings_english} onChange={e => setNewTpl(p => ({ ...p, warnings_english: e.target.value }))} placeholder="Side effects or precautions" /></div>
              <div><Label>Warning (Hindi)</Label><Textarea rows={2} value={newTpl.warnings_hindi} onChange={e => setNewTpl(p => ({ ...p, warnings_hindi: e.target.value }))} placeholder="दुष्प्रभाव या सावधानियाँ" /></div>
              <div><Label>Missed Dose (English)</Label><Input value={newTpl.missed_dose_english} onChange={e => setNewTpl(p => ({ ...p, missed_dose_english: e.target.value }))} placeholder="e.g. Take as soon as you remember" /></div>
              <div><Label>Missed Dose (Hindi)</Label><Input value={newTpl.missed_dose_hindi} onChange={e => setNewTpl(p => ({ ...p, missed_dose_hindi: e.target.value }))} placeholder="e.g. याद आने पर लें" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTemplate(false)}>Cancel</Button>
            <Button disabled={saveTplMutation.isPending || !newTpl.medicine_id} onClick={() => saveTplMutation.mutate({ ...newTpl, medicine_id: Number(newTpl.medicine_id) })}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>
    </div>
  );
}
