import { useState } from "react";
import { useRoute } from "wouter";
import { useGetIpdAdmission } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, LogOut, BedDouble, User, Stethoscope, FileText } from "lucide-react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProgressNotesSection from "@/components/ProgressNotesSection";
import NursingHandoverSection from "@/components/NursingHandoverSection";
import { DocumentIntegration } from "@/components/document-integration";
import { DocumentUpload } from "@/components/document-upload";

export default function IPDDetail() {
  const [, params] = useRoute("/ipd/:id");
  const id = parseInt(params?.id || "0");
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ dischargeDate: new Date().toISOString().slice(0, 10), dischargeSummary: "", finalDiagnosis: "", condition: "Stable" });
  const qc = useQueryClient();

  const { data: admission, isLoading } = useGetIpdAdmission(id);

  async function handleDischarge(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ipd/${id}/discharge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Patient discharged successfully");
      setDischargeOpen(false);
      qc.invalidateQueries({ queryKey: [`/api/ipd/${id}`] });
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  if (!admission) return <div className="text-center py-12 text-muted-foreground">IPD admission not found.</div>;

  const isActive = admission.status === "admitted" || admission.status === "emergency";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild><Link href="/ipd"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link></Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{(admission as any).ipdNo}</h2>
          <p className="text-sm text-muted-foreground">{(admission as any).patientName}</p>
        </div>
        {isActive && (
          <Dialog open={dischargeOpen} onOpenChange={setDischargeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-green-500 text-green-700 hover:bg-green-50">
                <LogOut className="h-4 w-4 mr-2" />Discharge Patient
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Discharge Patient</DialogTitle></DialogHeader>
              <form onSubmit={handleDischarge} className="space-y-4">
                <div className="space-y-2">
                  <Label>Discharge Date</Label>
                  <Input type="date" value={form.dischargeDate} onChange={e => setForm(f => ({ ...f, dischargeDate: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Final Diagnosis</Label>
                  <Input value={form.finalDiagnosis} onChange={e => setForm(f => ({ ...f, finalDiagnosis: e.target.value }))} placeholder="Final diagnosis..." />
                </div>
                <div className="space-y-2">
                  <Label>Condition on Discharge</Label>
                  <Input value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} placeholder="e.g. Stable, Improved..." />
                </div>
                <div className="space-y-2">
                  <Label>Discharge Summary</Label>
                  <Textarea rows={4} value={form.dischargeSummary} onChange={e => setForm(f => ({ ...f, dischargeSummary: e.target.value }))} placeholder="Summary of hospital course..." />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDischargeOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>{submitting ? "Discharging…" : "Confirm Discharge"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Patient", value: (admission as any).patientName, icon: User },
          { title: "Consultant", value: (admission as any).doctorName, icon: Stethoscope },
          { title: "Ward / Bed", value: `${(admission as any).wardName} / Bed ${(admission as any).bedNo}`, icon: BedDouble },
          { title: "Status", value: admission.status, icon: null },
        ].map(({ title, value, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
            <CardContent>
              <p className={`font-semibold ${title === "Status" ? `px-2 py-0.5 rounded-full text-xs inline-block ${admission.status === "admitted" ? "bg-blue-100 text-blue-800" : admission.status === "discharged" ? "bg-gray-100 text-gray-700" : "bg-red-100 text-red-800"}` : ""}`}>
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <TabsTrigger value="details" className="rounded-lg">Admission Details</TabsTrigger>
          <TabsTrigger value="progress" className="rounded-lg">Daily Progress Notes</TabsTrigger>
          <TabsTrigger value="handover" className="rounded-lg">Nursing Handovers</TabsTrigger>
          <TabsTrigger value="documents" className="rounded-lg">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Admission Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Admission Date</p><p className="mt-1 font-medium">{(admission as any).admissionDate}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Diagnosis</p><p className="mt-1 font-medium">{admission.diagnosis || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Admission Note</p><p className="mt-1">{(admission as any).admissionNote || "—"}</p></div>
                {(admission as any).linkedOpdId && <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Linked OPD</p><Link href={`/opd/${(admission as any).linkedOpdId}`} className="text-primary hover:underline text-sm mt-1 block">View OPD Visit →</Link></div>}
              </CardContent>
            </Card>
            {admission.status === "discharged" && (
              <Card>
                <CardHeader><CardTitle>Discharge Information</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Discharge Date</p><p className="mt-1 font-medium">{(admission as any).dischargeDate}</p></div>
                  <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Discharge Summary</p><p className="mt-1 text-sm">{(admission as any).dischargeSummary || "—"}</p></div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          <ProgressNotesSection
            admissionId={id}
            patientId={admission.patientId}
            patientName={(admission as any).patientName}
          />
        </TabsContent>

        <TabsContent value="handover" className="mt-4">
          <NursingHandoverSection
            admissionId={id}
            patientId={admission.patientId}
            patientName={(admission as any).patientName}
            patientUhid={(admission as any).patientUhid || "UHID" + admission.patientId}
            bedNo={(admission as any).bedNo}
            wardName={(admission as any).wardName}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Upload Admission & Discharge Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg border border-purple-200">
                <p className="text-xs text-muted-foreground mb-3">
                  Upload admission documents, clinical notes, investigation reports, discharge summaries, and other relevant medical records.
                </p>
                <DocumentUpload
                  category="IPD Document"
                  patientId={admission.patientId}
                  module="IPD"
                  department="Inpatient"
                  description="IPD admission or discharge document"
                  tags={["ipd", `admission-${(admission as any).ipdNo}`]}
                  multiple={true}
                />
              </div>
            </CardContent>
          </Card>

          <DocumentIntegration
            patientId={admission.patientId}
            module="IPD"
            title="IPD Documents"
            showUpload={false}
            maxDocuments={20}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

