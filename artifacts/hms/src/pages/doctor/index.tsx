import { useState } from "react";
import { Link } from "wouter";
import { useListOpdVisits, useListIpdAdmissions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProgressNotesSection from "@/components/ProgressNotesSection";
import {
  CalendarCheck, BedDouble, FileText, Stethoscope, FlaskConical, Radiation,
  ClipboardList, History, Printer, FolderArchive, ListChecks, ArrowRightLeft, LogOut, Clock, AlertCircle, CheckSquare
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  converted: "bg-blue-100 text-blue-800",
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const [selectedRoundPatient, setSelectedRoundPatient] = useState<any | null>(null);
  const { data: opdData, isLoading: opdLoading } = useListOpdVisits({ limit: 200 } as any);
  const { data: ipdData, isLoading: ipdLoading } = useListIpdAdmissions({} as any);

  const today = todayStr();
  const visits = opdData?.visits || [];
  const todayVisits = visits.filter((v: any) => (v.visitDate || "").slice(0, 10) === today);
  const admissions = (ipdData as any)?.admissions || (Array.isArray(ipdData) ? ipdData : []) || [];
  const activeIpd = admissions.filter((a: any) => a.status !== "discharged" && !a.dischargeDate);
  const dischargesToday = admissions.filter((a: any) => (a.dischargeDate || "").slice(0, 10) === today);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Doctor Dashboard</h2>
          <p className="text-muted-foreground text-sm">Welcome, {user?.name}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          data-testid="doctor-logout"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      {/* 3 big stat cards (matches photo) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BigStatCard
          title="Today Appointments"
          value={todayVisits.length}
          color="emerald"
          icon={CalendarCheck}
          isLoading={opdLoading}
          to="/doctor/today"
          testid="card-today-appointments"
        />
        <BigStatCard
          title="Discharge Creation"
          value={dischargesToday.length}
          color="rose"
          icon={ClipboardList}
          isLoading={ipdLoading}
          to="/discharge-summary"
          testid="card-discharge"
        />
        <BigStatCard
          title="IPD Patient"
          value={activeIpd.length}
          color="indigo"
          icon={BedDouble}
          isLoading={ipdLoading}
          to="/ipd"
          testid="card-ipd"
        />
      </div>

      <Tabs defaultValue="appointments" className="w-full">
        <TabsList className="bg-muted p-1 rounded-xl">
          <TabsTrigger value="appointments" className="rounded-lg gap-2"><CalendarCheck className="w-4 h-4" /> Appointments</TabsTrigger>
          <TabsTrigger value="command-center" className="rounded-lg gap-2"><ListChecks className="w-4 h-4" /> Doctor Command Center</TabsTrigger>
          <TabsTrigger value="round-list" className="rounded-lg gap-2"><Stethoscope className="w-4 h-4" /> Daily Round List</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="mt-4 space-y-6">
          {/* Today's appointments table (matches photo) */}
          <Card className="shadow-sm border">
            <CardHeader className="pb-3 border-b bg-slate-50/50 dark:bg-slate-900/50">
              <CardTitle className="text-base">Today's Appointments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>OPD No.</TableHead>
                    <TableHead>Reg. No.</TableHead>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient Remarks</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opdLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                    ))
                  ) : todayVisits.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center h-24 text-muted-foreground">No appointments today.</TableCell></TableRow>
                  ) : (
                    todayVisits.map((v: any, idx: number) => {
                      const status = v.status || "pending";
                      const display = status === "pending" ? "Waiting" : status === "completed" ? "Done" : status === "converted" ? "Admitted" : status;
                      return (
                        <TableRow key={v.id} data-testid={`appt-row-${v.id}`}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-mono text-xs">{v.visitNo}</TableCell>
                          <TableCell className="font-mono text-xs">{v.uhid || "—"}</TableCell>
                          <TableCell>
                            <Link href={`/opd/${v.id}`} className="font-semibold text-indigo-600 hover:underline">
                              {v.patientName}
                            </Link>
                          </TableCell>
                          <TableCell>{v.doctorName}</TableCell>
                          <TableCell className="text-muted-foreground">{v.specialization || "Medicine"}</TableCell>
                          <TableCell className="text-sm">{v.visitDate}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{v.chiefComplaints || "—"}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] || "bg-gray-100 text-gray-700"}`}>
                              {display}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Quick links — Appointment + Report menus from the photos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MenuCard
              title="Appointment"
              items={[
                { label: "Today's Appointment", to: "/doctor/today", icon: CalendarCheck },
                { label: "View Lab Report", to: "/diagnostics", icon: FlaskConical },
                { label: "View Radiology Report", to: "/diagnostics", icon: Radiation },
                { label: "Update Test Finding", to: "/diagnostics", icon: ListChecks },
                { label: "Old Patient History", to: "/doctor/history", icon: History },
              ]}
            />
            <MenuCard
              title="Report"
              items={[
                { label: "OPD Patient List", to: "/opd", icon: Stethoscope },
                { label: "IPD Patient List", to: "/ipd", icon: BedDouble },
                { label: "OPD to IPD List", to: "/doctor/opd-to-ipd", icon: ArrowRightLeft },
                { label: "Patient History", to: "/doctor/history", icon: History },
                { label: "Re-Print Prescription", to: "/doctor/reprint", icon: Printer },
                { label: "MRD", to: "/doctor/mrd", icon: FolderArchive },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="command-center" className="mt-4 space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Admitted IPD Patients under this doctor */}
            <Card className="shadow-sm border">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2"><BedDouble className="w-4 h-4 text-indigo-500" /> Admitted Patients (IPD)</CardTitle>
                <CardDescription>Active inpatients assigned to you</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {activeIpd.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-4">No admitted patients under your care.</p>
                ) : (
                  activeIpd.map((a: any) => (
                    <div key={a.id} className="flex justify-between items-center text-xs p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-900">
                      <div>
                        <Link href={`/patients/${a.patientId}`} className="font-semibold text-indigo-600 hover:underline block">{a.patientName}</Link>
                        <span className="text-[10px] text-muted-foreground block font-mono">Ward: {a.wardName} · Bed: {a.bedNo}</span>
                      </div>
                      <Link href={`/ipd/${a.id}`}>
                        <Button size="sm" variant="ghost" className="rounded-lg h-7 px-2 text-[10px]">View Details</Button>
                      </Link>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Critical Lab Alerts */}
            <Card className="shadow-sm border">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2"><AlertCircle className="w-4 h-4 text-rose-500" /> Critical Lab Alerts</CardTitle>
                <CardDescription>Abnormal radiology/pathology results</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start gap-2.5 text-xs p-2.5 rounded-xl border border-rose-100 bg-rose-50/50 text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Patient: Amit Kumar (UHID8812)</span>
                    <span className="block mt-0.5">Potassium level: 6.2 mEq/L (Critical High)</span>
                    <span className="text-[10px] text-muted-foreground block mt-1">Reported 20 mins ago</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-xs p-2.5 rounded-xl border border-rose-100 bg-rose-50/50 text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Patient: Priya Sharma (UHID4910)</span>
                    <span className="block mt-0.5">CT Brain: Active subdural hematoma check needed</span>
                    <span className="text-[10px] text-muted-foreground block mt-1">Reported 1 hour ago</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Follow-up / Summary checklists */}
            <Card className="shadow-sm border">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2"><CheckSquare className="w-4 h-4 text-emerald-500" /> Discharge Summary queue</CardTitle>
                <CardDescription>Patients scheduled for release</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {activeIpd.slice(0, 3).map((a: any) => (
                  <div key={a.id} className="flex justify-between items-center text-xs p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-900">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">{a.patientName}</span>
                      <span className="text-[10px] text-muted-foreground block font-mono">Admission No: {a.ipdNo}</span>
                    </div>
                    <Link href={`/discharge-summary`}>
                      <Button size="sm" variant="outline" className="rounded-lg h-7 px-2 text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100">Draft Summary</Button>
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="round-list" className="mt-4 space-y-6">
          <Card className="shadow-sm border">
            <CardHeader className="pb-3 border-b bg-slate-50/50 dark:bg-slate-900/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Daily Patient Rounding Checklist</CardTitle>
                <CardDescription>Monitor active admissions, log daily progress, and prepare discharges</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ward / Bed</TableHead>
                    <TableHead>Patient Information</TableHead>
                    <TableHead>Admitting Consultant</TableHead>
                    <TableHead>Daily Note Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ipdLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                    ))
                  ) : activeIpd.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No active admitted patients found.</TableCell></TableRow>
                  ) : (
                    activeIpd.map((a: any) => {
                      const isIcu = (a.wardName || "").toLowerCase().includes("icu");
                      return (
                        <TableRow key={a.id} data-testid={`round-row-${a.id}`}>
                          <TableCell>
                            <span className="font-semibold block">{a.bedNo}</span>
                            <span className="text-[10px] text-muted-foreground block">{a.wardName}</span>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold">{a.patientName}</div>
                            <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                              <span>UHID: {a.patientUhid || `UHID${a.patientId}`}</span>
                              {isIcu && <Badge className="bg-rose-100 text-rose-800 text-[8px] h-4 px-1">ICU</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">Dr. {a.doctorName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-medium text-amber-600 bg-amber-50">
                              Pending Note
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100"
                                onClick={() => setSelectedRoundPatient(a)}
                              >
                                Daily Check-in
                              </Button>
                              <Link href={`/discharge-summary`}>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]">
                                  Discharge
                                </Button>
                              </Link>
                              <Link href={`/ipd/${a.id}`}>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]">
                                  Chart File
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Daily Round Clinical Note Dialog */}
      <Dialog open={!!selectedRoundPatient} onOpenChange={(o) => !o && setSelectedRoundPatient(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Daily Round Clinical Check-in</DialogTitle>
          </DialogHeader>
          {selectedRoundPatient && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/40 rounded-xl text-xs flex justify-between items-center">
                <div>
                  <span className="font-semibold block">{selectedRoundPatient.patientName}</span>
                  <span className="text-muted-foreground block font-mono text-[10px]">UHID: {selectedRoundPatient.patientUhid || `UHID${selectedRoundPatient.patientId}`} · Bed: {selectedRoundPatient.bedNo} ({selectedRoundPatient.wardName})</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">{selectedRoundPatient.status}</Badge>
              </div>
              <ProgressNotesSection
                admissionId={selectedRoundPatient.id}
                patientId={selectedRoundPatient.patientId}
                patientName={selectedRoundPatient.patientName}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BigStatCard({
  title, value, color, icon: Icon, isLoading, to, testid,
}: {
  title: string; value: number; color: "emerald" | "rose" | "indigo";
  icon: React.ElementType; isLoading: boolean; to: string; testid: string;
}) {
  const palette = {
    emerald: { bar: "bg-emerald-500", iconBg: "bg-emerald-100 text-emerald-700" },
    rose: { bar: "bg-rose-500", iconBg: "bg-rose-100 text-rose-700" },
    indigo: { bar: "bg-indigo-500", iconBg: "bg-indigo-100 text-indigo-700" },
  }[color];
  return (
    <Link href={to} data-testid={testid}>
      <Card className="hover:shadow-md transition cursor-pointer">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-lg font-medium text-muted-foreground">{title}</div>
              <div className="text-4xl font-bold mt-2">
                {isLoading ? <Skeleton className="h-9 w-12" /> : value}
              </div>
            </div>
            <div className={`p-3 rounded-lg ${palette.iconBg}`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
          <div className={`mt-4 h-1 rounded-full ${palette.bar}`} />
        </CardContent>
      </Card>
    </Link>
  );
}

function MenuCard({ title, items }: { title: string; items: { label: string; to: string; icon: React.ElementType }[] }) {
  return (
    <Card>
      <div className="px-6 py-3 border-b font-semibold flex items-center gap-2 bg-blue-50/40">
        <FileText className="h-4 w-4 text-blue-600" />
        {title}
      </div>
      <CardContent className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {items.map((it) => (
            <Link
              key={it.label}
              href={it.to}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-blue-50 transition"
              data-testid={`menu-${it.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
            >
              <it.icon className="h-4 w-4 text-muted-foreground" />
              <span>{it.label}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
