import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertCircle,
  FileText,
  BedDouble,
  Receipt,
  Activity,
  Heart,
  Pill,
  Shield,
  Stethoscope,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  FileHeart,
  Sparkles,
  Clock,
  Info,
  ListTodo,
  ShieldAlert
} from "lucide-react";
import { format } from "date-fns";

interface PatientHistoryData {
  patient: {
    id: number;
    name: string;
    uhid: string;
    age: number;
    gender: string;
    phone: string;
    email?: string;
    address?: string;
    bloodGroup?: string;
    allergies?: string;
    emergencyContact?: string;
    createdAt: string;
  };
  opdVisits: Array<{
    id: number;
    visitNo: string;
    doctorName?: string;
    visitDate: string;
    chiefComplaints?: string;
    diagnosis?: string;
    medicines?: string;
    labTests?: string;
    radiologyTests?: string;
    advise?: string;
    vitals?: string;
    status: string;
    fee: string;
  }>;
  ipdAdmissions: Array<{
    id: number;
    ipdNo: string;
    doctorName?: string;
    wardName?: string;
    bedNo?: string;
    admissionDate: string;
    dischargeDate?: string;
    diagnosis?: string;
    status: string;
    dischargeSummary?: string;
  }>;
  invoices: Array<{
    id: number;
    invoiceNo: string;
    type: string;
    totalAmount: string;
    paidAmount: string;
    dueAmount: string;
    status: string;
    invoiceDate: string;
  }>;
}

export default function PatientProfilePage() {
  const [, params] = useRoute("/patients/:id");
  const patientId = params?.id ? parseInt(params.id) : null;

  const { data, isLoading, error } = useQuery<PatientHistoryData>({
    queryKey: [`/api/patients/${patientId}/history`],
    queryFn: () => fetch(`/api/patients/${patientId}/history`).then((r) => {
      if (!r.ok) throw new Error("Failed to load patient history");
      return r.json();
    }),
    enabled: !!patientId,
  });

  const { data: aiAlerts } = useQuery({
    queryKey: [`/api/ai/clinical-alerts`, patientId],
    queryFn: () => fetch(`/api/ai/clinical-alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId })
    }).then(r => r.json()),
    enabled: !!patientId
  });

  const { data: aiTimeline } = useQuery({
    queryKey: [`/api/ai/patient-timeline`, patientId],
    queryFn: () => fetch(`/api/ai/patient-timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId })
    }).then(r => r.json()),
    enabled: !!patientId
  });

  const { data: aiRadiology } = useQuery({
    queryKey: [`/api/ai/radiology-summary`, patientId],
    queryFn: () => fetch(`/api/ai/radiology-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId })
    }).then(r => r.json()),
    enabled: !!patientId
  });

  const { data: aiLaboratory } = useQuery({
    queryKey: [`/api/ai/laboratory-summary`, patientId],
    queryFn: () => fetch(`/api/ai/laboratory-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId })
    }).then(r => r.json()),
    enabled: !!patientId
  });

  const { data: aiMedication } = useQuery({
    queryKey: [`/api/ai/medication-summary`, patientId],
    queryFn: () => fetch(`/api/ai/medication-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId })
    }).then(r => r.json()),
    enabled: !!patientId
  });

  const { data: aiSummary } = useQuery({
    queryKey: [`/api/ai/patient-summary`, patientId],
    queryFn: () => fetch(`/api/ai/patient-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId })
    }).then(r => r.json()),
    enabled: !!patientId
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-48 col-span-1 rounded-2xl" />
          <Skeleton className="h-48 col-span-2 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
        <AlertCircle className="w-12 h-12 text-destructive mb-3" />
        <h2 className="text-xl font-bold">Patient Not Found</h2>
        <p className="text-muted-foreground mt-1 max-w-sm">There was an issue loading the patient profile. Verify the UHID/Record ID.</p>
        <Link href="/patients"><Button className="mt-4 rounded-xl" variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Patients</Button></Link>
      </div>
    );
  }

  const { patient, opdVisits, ipdAdmissions, invoices } = data;

  // Calculate stats
  const totalInvoiced = invoices.reduce((s, i) => s + parseFloat(i.totalAmount), 0);
  const totalPaid = invoices.reduce((s, i) => s + parseFloat(i.paidAmount), 0);
  const outstandingDues = invoices.reduce((s, i) => s + parseFloat(i.dueAmount), 0);
  const currentIpd = ipdAdmissions.find(a => a.status === "admitted");

  return (
    <div className="space-y-6">
      {/* Header Profile Summary */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/patients"><Button variant="outline" size="icon" className="rounded-xl shrink-0"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">{patient.name}</h2>
              <Badge variant="secondary" className="font-mono text-xs px-2.5 bg-indigo-50 text-indigo-700 font-semibold border-indigo-100">{patient.uhid}</Badge>
              {currentIpd && <Badge className="bg-rose-500 text-white font-semibold">IPD: Admitted ({currentIpd.bedNo})</Badge>}
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {patient.age} Years · {patient.gender} · Blood Group: <span className="font-semibold text-foreground">{patient.bloodGroup || "—"}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Link href={`/opd?patientId=${patient.id}`} className="flex-1 md:flex-none">
            <Button size="sm" className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"><Stethoscope className="w-4 h-4 mr-2" /> Start OPD</Button>
          </Link>
          <Link href={`/billing-desk?patientId=${patient.id}`} className="flex-1 md:flex-none">
            <Button size="sm" variant="outline" className="w-full rounded-xl"><Receipt className="w-4 h-4 mr-2" /> Billing</Button>
          </Link>
        </div>
      </div>

      {/* AI Doctor Preparation Panel */}
      {aiAlerts?.doctorPreparation && aiAlerts.doctorPreparation.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-2">
          <h3 className="font-semibold text-indigo-950 flex items-center gap-2 text-sm">
            <Sparkles className="h-4.5 w-4.5 text-indigo-600 animate-pulse" />
            Things the doctor should know before seeing this patient:
          </h3>
          <ul className="list-disc pl-5 text-xs text-indigo-900 space-y-1">
            {aiAlerts.doctorPreparation.map((item: string, idx: number) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Demographics & Alert Cards */}
        <div className="space-y-6">
          <Card className="shadow-sm border">
            <CardHeader className="pb-3"><CardTitle className="text-base">Demographics Details</CardTitle></CardHeader>
            <CardContent className="space-y-3.5 text-sm">
              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{patient.phone}</span>
              </div>
              {patient.email && (
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{patient.email}</span>
                </div>
              )}
              {patient.address && (
                <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{patient.address}</span>
                </div>
              )}
              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>Registered: {format(new Date(patient.createdAt), "dd MMM yyyy")}</span>
              </div>
              {patient.emergencyContact && (
                <div className="border-t pt-3 mt-3">
                  <span className="text-xs text-muted-foreground block mb-1">Emergency Contact</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{patient.emergencyContact}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Allergies / Warnings */}
          <Card className="border border-amber-200 bg-amber-50/50 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center gap-2"><AlertCircle className="w-5 h-5 text-amber-600 shrink-0" /><CardTitle className="text-base text-amber-800">Allergies & Clinical Alerts</CardTitle></CardHeader>
            <CardContent className="text-sm text-amber-700">
              {patient.allergies ? (
                <p className="font-medium">{patient.allergies}</p>
              ) : (
                <p className="italic text-muted-foreground">No allergies or clinical drug warnings reported.</p>
              )}
            </CardContent>
          </Card>

          {/* Financial summary snapshot */}
          <Card className="border shadow-sm bg-slate-50/50 dark:bg-slate-900/50">
            <CardHeader className="pb-3"><CardTitle className="text-base">Billing & Dues Snapshot</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Invoiced:</span>
                <span className="font-semibold">₹{totalInvoiced.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Paid:</span>
                <span className="font-semibold text-emerald-600">₹{totalPaid.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2 mt-2">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Outstanding Dues:</span>
                <span className="font-bold text-rose-600">₹{outstandingDues.toLocaleString("en-IN")}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Tabbed Visit Histories */}
        <div className="md:col-span-2">
          <Tabs defaultValue="ai-memory" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-muted rounded-xl">
              <TabsTrigger value="ai-memory" className="rounded-lg">🧠 AI Memory Layer</TabsTrigger>
              <TabsTrigger value="opd" className="rounded-lg">OPD Visits ({opdVisits.length})</TabsTrigger>
              <TabsTrigger value="ipd" className="rounded-lg">IPD Admissions ({ipdAdmissions.length})</TabsTrigger>
              <TabsTrigger value="billing" className="rounded-lg">Billing ({invoices.length})</TabsTrigger>
            </TabsList>

            {/* AI Memory Layer Content */}
            <TabsContent value="ai-memory" className="mt-4 space-y-6">
              {/* Clinical Alerts & Longitudinal Intelligence */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-rose-100 bg-rose-50/30 dark:bg-rose-950/10 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-500" />
                      Active Clinical Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-rose-700 dark:text-rose-400">
                    {!aiAlerts?.alerts || aiAlerts.alerts.length === 0 ? (
                      <p className="italic text-muted-foreground">Information not available.</p>
                    ) : (
                      <ul className="list-disc pl-4 space-y-1">
                        {aiAlerts.alerts.map((alert: string, idx: number) => (
                          <li key={idx} className="font-medium">{alert}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-indigo-100 bg-indigo-50/30 dark:bg-indigo-950/10 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-indigo-500" />
                      Longitudinal Intelligence Patterns
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-indigo-700 dark:text-indigo-400">
                    {!aiAlerts?.longitudinalIntelligence || aiAlerts.longitudinalIntelligence.length === 0 ? (
                      <p className="italic text-muted-foreground">Information not available.</p>
                    ) : (
                      <ul className="list-disc pl-4 space-y-1">
                        {aiAlerts.longitudinalIntelligence.map((pattern: string, idx: number) => (
                          <li key={idx} className="font-medium">{pattern}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Patient Clinical Summary */}
              <Card className="shadow-sm border">
                <CardHeader className="pb-3 border-b">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4.5 h-4.5 text-indigo-500" /> AI Clinical Summary</CardTitle>
                      <CardDescription className="text-xs">Single longitudinal patient intelligence record</CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">Blood Group: {aiSummary?.bloodGroup || "Information not available."}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 grid gap-4 md:grid-cols-2 text-xs">
                  <div className="space-y-3">
                    <div>
                      <span className="font-semibold text-muted-foreground block mb-0.5">CHRONIC ILLNESSES / MAJOR DIAGNOSES</span>
                      <div className="flex flex-wrap gap-1">
                        {!aiSummary?.chronicIllnesses || aiSummary.chronicIllnesses.length === 0 ? (
                          <span className="text-muted-foreground italic">Information not available.</span>
                        ) : (
                          aiSummary.chronicIllnesses.map((d: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="bg-slate-100 text-slate-700">{d}</Badge>
                          ))
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block mb-0.5">MAJOR DIAGNOSES</span>
                      <p className="text-slate-700 dark:text-slate-300">
                        {aiSummary?.majorDiagnoses?.join(", ") || "Information not available."}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block mb-0.5">OPERATIONS / OT PROCEDURES</span>
                      <p className="text-slate-700 dark:text-slate-300">
                        {aiSummary?.operations?.join(", ") || "Information not available."}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block mb-0.5">HOSPITAL ADMISSIONS</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {!aiSummary?.hospitalAdmissions || aiSummary.hospitalAdmissions.length === 0 ? (
                          <li className="text-muted-foreground italic">Information not available.</li>
                        ) : (
                          aiSummary.hospitalAdmissions.map((a: string, idx: number) => <li key={idx}>{a}</li>)
                        )}
                      </ul>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block mb-0.5">ICU STAYS</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {!aiSummary?.icuStays || aiSummary.icuStays.length === 0 ? (
                          <li className="text-muted-foreground italic">Information not available.</li>
                        ) : (
                          aiSummary.icuStays.map((a: string, idx: number) => <li key={idx}>{a}</li>)
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="font-semibold text-muted-foreground block mb-0.5">DRUG ALLERGIES</span>
                      <p className="text-rose-600 font-semibold">
                        {aiSummary?.drugAllergies || "None"}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block mb-0.5">IMPLANTS / DEVICES</span>
                      <p className="text-slate-700 dark:text-slate-300">
                        {aiSummary?.implants?.join(", ") || "Information not available."}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block mb-0.5">MAJOR RADIOLOGY FINDINGS</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {!aiSummary?.majorRadiologyFindings || aiSummary.majorRadiologyFindings.length === 0 ? (
                          <li className="text-muted-foreground italic">Information not available.</li>
                        ) : (
                          aiSummary.majorRadiologyFindings.map((f: string, idx: number) => (
                            <li key={idx} dangerouslySetInnerHTML={{ __html: f.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-indigo-600 underline font-semibold">$1</a>') }} />
                          ))
                        )}
                      </ul>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block mb-0.5">MAJOR LABORATORY ABNORMALITIES</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {!aiSummary?.majorLaboratoryAbnormalities || aiSummary.majorLaboratoryAbnormalities.length === 0 ? (
                          <li className="text-muted-foreground italic">Information not available.</li>
                        ) : (
                          aiSummary.majorLaboratoryAbnormalities.map((a: string, idx: number) => (
                            <li key={idx} dangerouslySetInnerHTML={{ __html: a.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-indigo-600 underline font-semibold">$1</a>') }} />
                          ))
                        )}
                      </ul>
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground block mb-0.5">LATEST CLINICAL STATUS</span>
                      <p className="text-slate-700 dark:text-slate-300 font-medium">
                        {aiSummary?.latestClinicalStatus || "Information not available."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Chronological Medical History Timeline */}
              <Card className="shadow-sm border">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4.5 h-4.5 text-indigo-500" /> AI Patient Timeline</CardTitle></CardHeader>
                <CardContent className="pt-2">
                  {!aiTimeline || aiTimeline.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground italic text-xs">Information not available.</div>
                  ) : (
                    <div className="relative border-l border-slate-200 dark:border-slate-800 ml-3 pl-6 space-y-6 text-xs">
                      {aiTimeline.map((evt: any, idx: number) => (
                        <div key={idx} className="relative">
                          <span className="absolute -left-9.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950 border-2 border-indigo-500 ring-4 ring-white dark:ring-slate-900 shrink-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                          </span>
                          <div className="flex justify-between items-start gap-2 flex-wrap">
                            <div>
                              <span className="font-bold text-indigo-600 font-mono text-[10px] uppercase bg-indigo-50 px-1.5 py-0.5 rounded">{evt.year}</span>
                              <h4 className="font-semibold text-slate-800 dark:text-slate-200 mt-1">{evt.title}</h4>
                              <p className="text-slate-600 dark:text-slate-400 mt-0.5">{evt.description}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-muted-foreground block text-[10px]">{evt.date}</span>
                              {evt.link && (
                                <Link href={evt.link}>
                                  <span className="text-indigo-600 hover:text-indigo-800 cursor-pointer font-semibold inline-flex items-center gap-0.5 mt-0.5">
                                    Original Record <ChevronRight className="w-3 h-3" />
                                  </span>
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sub-Timelines */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Radiology Timeline */}
                <Card className="shadow-sm border">
                  <CardHeader><CardTitle className="text-sm font-semibold">AI Radiology Timeline</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {!aiRadiology || aiRadiology.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground italic text-xs">Information not available.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[10px]">
                            <TableHead>Date</TableHead>
                            <TableHead>Study</TableHead>
                            <TableHead>Finding</TableHead>
                            <TableHead>Radiologist</TableHead>
                            <TableHead>Report</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {aiRadiology.map((rad: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="whitespace-nowrap">{rad.date}</TableCell>
                              <TableCell className="font-semibold">{rad.study}</TableCell>
                              <TableCell className="max-w-[150px] truncate" title={rad.finding}>{rad.finding}</TableCell>
                              <TableCell>{rad.radiologist}</TableCell>
                              <TableCell>
                                <Link href={rad.link}>
                                  <span className="text-indigo-600 hover:text-indigo-800 cursor-pointer font-semibold">View</span>
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Laboratory Timeline */}
                <Card className="shadow-sm border">
                  <CardHeader><CardTitle className="text-sm font-semibold">AI Laboratory Timeline</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {!aiLaboratory || aiLaboratory.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground italic text-xs">Information not available.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[10px]">
                            <TableHead>Date</TableHead>
                            <TableHead>Test</TableHead>
                            <TableHead>Result</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Report</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {aiLaboratory.map((lab: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="whitespace-nowrap">{lab.date}</TableCell>
                              <TableCell className="font-semibold">{lab.test}</TableCell>
                              <TableCell className={lab.result.toLowerCase().includes("high") || lab.result.toLowerCase().includes("low") || lab.result.toLowerCase().includes("abnormal") ? "text-rose-600 font-semibold" : ""}>{lab.result}</TableCell>
                              <TableCell>{lab.referenceRange}</TableCell>
                              <TableCell>
                                <Link href={lab.link}>
                                  <span className="text-indigo-600 hover:text-indigo-800 cursor-pointer font-semibold">View</span>
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Surgery Timeline */}
                <Card className="shadow-sm border">
                  <CardHeader><CardTitle className="text-sm font-semibold">AI Surgery Timeline</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {!aiTimeline || aiTimeline.filter((e: any) => e.title.includes("Surgery") || e.title.includes("OT")).length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground italic text-xs">Information not available.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[10px]">
                            <TableHead>Date</TableHead>
                            <TableHead>Operation</TableHead>
                            <TableHead>Surgeon</TableHead>
                            <TableHead>Implants</TableHead>
                            <TableHead>Complications</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {aiTimeline.filter((e: any) => e.title.includes("Surgery") || e.title.includes("OT")).map((surg: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="whitespace-nowrap">{surg.date}</TableCell>
                              <TableCell className="font-semibold">{surg.description.split("(")[0].trim()}</TableCell>
                              <TableCell>{surg.description.includes("Surgeon:") ? surg.description.match(/Surgeon:\s*(.*?)\)/)?.[1] || "Staff" : "Staff"}</TableCell>
                              <TableCell>{surg.description.toLowerCase().includes("implant") ? "Yes" : "None"}</TableCell>
                              <TableCell>{surg.description.toLowerCase().includes("complication") ? "Yes" : "None documented"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Medication Timeline */}
                <Card className="shadow-sm border">
                  <CardHeader><CardTitle className="text-sm font-semibold">AI Medication Timeline</CardTitle></CardHeader>
                  <CardContent className="space-y-3.5 p-4 text-xs">
                    {!aiMedication ? (
                      <div className="text-center text-muted-foreground italic">Information not available.</div>
                    ) : (
                      <>
                        <div>
                          <span className="font-semibold text-muted-foreground block mb-0.5">CURRENT MEDICATIONS</span>
                          <p className="text-slate-800 dark:text-slate-200">
                            {aiMedication.currentMedicines?.join(", ") || "None active / Information not available."}
                          </p>
                        </div>
                        <div>
                          <span className="font-semibold text-muted-foreground block mb-0.5">LONG-TERM MEDICINES</span>
                          <p className="text-slate-800 dark:text-slate-200">
                            {aiMedication.longTermMedicines?.join(", ") || "None documented."}
                          </p>
                        </div>
                        <div>
                          <span className="font-semibold text-muted-foreground block mb-0.5">HIGH-RISK MEDICINES</span>
                          <p className="text-amber-700 font-semibold">
                            {aiMedication.highRiskMedicines?.join(", ") || "None."}
                          </p>
                        </div>
                        <div>
                          <span className="font-semibold text-muted-foreground block mb-0.5">STOPPED MEDICINES</span>
                          <p className="text-slate-500">
                            {aiMedication.stoppedMedicines?.join(", ") || "None."}
                          </p>
                        </div>
                        {aiMedication.duplicateTherapies?.length > 0 && (
                          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded">
                            <span className="font-semibold block">Duplicate Therapy Warnings:</span>
                            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                              {aiMedication.duplicateTherapies.map((w: string, idx: number) => <li key={idx}>{w}</li>)}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* OPD visits timeline */}
            <TabsContent value="opd" className="mt-4 space-y-4">
              {opdVisits.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-2xl text-muted-foreground">No Outpatient visits recorded.</div>
              ) : (
                opdVisits.map((visit) => (
                  <Card key={visit.id} className="shadow-sm border">
                    <CardHeader className="pb-2.5">
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2"><Stethoscope className="w-4 h-4 text-indigo-500" /> Visit: {visit.visitNo}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">Consultant: {visit.doctorName || "Internal Consultant"}</CardDescription>
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">{format(new Date(visit.visitDate), "dd MMM yyyy, hh:mm a")}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {visit.chiefComplaints && (
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Chief Complaints:</span>
                          <p className="mt-0.5 text-slate-600 dark:text-slate-400">{visit.chiefComplaints}</p>
                        </div>
                      )}
                      {visit.diagnosis && (
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Diagnosis:</span>
                          <p className="mt-0.5 text-slate-600 dark:text-slate-400">{visit.diagnosis}</p>
                        </div>
                      )}
                      {visit.medicines && (
                        <div className="bg-indigo-50/30 border border-indigo-100 rounded-xl p-2.5">
                          <span className="font-semibold text-indigo-900 flex items-center gap-1.5"><Pill className="w-3.5 h-3.5" /> Prescribed Medications</span>
                          <p className="mt-1 font-mono text-xs text-indigo-800 whitespace-pre-wrap">{visit.medicines}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* IPD admissions list */}
            <TabsContent value="ipd" className="mt-4 space-y-4">
              {ipdAdmissions.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-2xl text-muted-foreground">No Inpatient admissions recorded.</div>
              ) : (
                ipdAdmissions.map((adm) => (
                  <Card key={adm.id} className="shadow-sm border">
                    <CardHeader className="pb-2.5">
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2"><BedDouble className="w-4 h-4 text-emerald-500" /> Admission: {adm.ipdNo}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">Ward: {adm.wardName || "—"} · Bed: {adm.bedNo || "—"}</CardDescription>
                        </div>
                        <Badge className={adm.status === "admitted" ? "bg-blue-500" : "bg-slate-500"}>{adm.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3.5 text-sm">
                      <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl">
                        <div>Admitted: <span className="font-semibold text-foreground block">{format(new Date(adm.admissionDate), "dd MMM yyyy, hh:mm a")}</span></div>
                        <div>Discharged: <span className="font-semibold text-foreground block">{adm.dischargeDate ? format(new Date(adm.dischargeDate), "dd MMM yyyy, hh:mm a") : "Active admission"}</span></div>
                      </div>
                      {adm.diagnosis && (
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Admission Diagnosis:</span>
                          <p className="mt-0.5 text-slate-600 dark:text-slate-400">{adm.diagnosis}</p>
                        </div>
                      )}
                      {adm.dischargeSummary && (
                        <div className="border-t pt-3 mt-3">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><FileHeart className="w-4 h-4 text-rose-500" /> Discharge Summary Note</span>
                          <p className="mt-1 text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{adm.dischargeSummary}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Billing Ledger invoices history */}
            <TabsContent value="billing" className="mt-4">
              {invoices.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-2xl text-muted-foreground">No invoices generated for this patient.</div>
              ) : (
                <Card className="shadow-sm border">
                  <CardHeader><CardTitle className="text-base">Invoices History</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice No.</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Paid</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-semibold font-mono text-xs">{inv.invoiceNo}</TableCell>
                            <TableCell><span className="capitalize">{inv.type}</span></TableCell>
                            <TableCell>{format(new Date(inv.invoiceDate), "dd MMM yyyy")}</TableCell>
                            <TableCell>₹{parseFloat(inv.totalAmount).toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-emerald-600">₹{parseFloat(inv.paidAmount).toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-rose-600 font-medium">₹{parseFloat(inv.dueAmount).toLocaleString("en-IN")}</TableCell>
                            <TableCell>
                              <Badge variant={inv.status === "paid" ? "secondary" : "destructive"} className="text-xs">
                                {inv.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
