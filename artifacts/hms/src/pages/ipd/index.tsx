import { useState } from "react";
import { useListIpdAdmissions } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { toast } from "sonner";
import { Search, Eye, BedDouble, ArrowRightLeft, History, IndianRupee, Clock, ClipboardList, CheckSquare, Heart, CheckCircle2 } from "lucide-react";
import NursingHandoverSection from "@/components/NursingHandoverSection";

const STATUS_COLORS: Record<string, string> = {
  admitted: "bg-blue-100 text-blue-800",
  discharged: "bg-gray-100 text-gray-700",
  emergency: "bg-red-100 text-red-800",
};

interface Ward { id: number; name: string; type: string; ratePerDay: string | number }
interface Bed { id: number; wardId: number; bedNo: string; status: string }
interface StayTransfer {
  id: number; wardId: number; wardName: string; wardType: string; ratePerDay: string;
  bedId: number; bedNo: string;
  startedAt: string; endedAt: string | null;
  reason: string | null; transferredByName: string | null;
  days: number; rate: number; subtotal: number; isCurrent: boolean;
}

export default function IPDPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListIpdAdmissions({});
  const admissions = (data?.admissions as any[]) || [];

  const [transferFor, setTransferFor] = useState<any | null>(null);
  const [stayFor, setStayFor] = useState<any | null>(null);
  const [selectedHandoverPatient, setSelectedHandoverPatient] = useState<any | null>(null);
  const [tWardId, setTWardId] = useState("");
  const [tBedId, setTBedId] = useState("");
  const [tReason, setTReason] = useState("");

  const { data: wards } = useQuery<Ward[]>({
    queryKey: ["/api/wards"],
    queryFn: async () => {
      const r = await fetch("/api/wards", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch wards");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: beds } = useQuery<Bed[]>({
    queryKey: ["/api/beds"],
    queryFn: async () => {
      const r = await fetch("/api/beds", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch beds");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: stay } = useQuery<{ transfers: StayTransfer[]; totalDays: number; totalRent: number }>({
    queryKey: ["/api/ipd/stay", stayFor?.id],
    queryFn: async () => {
      const r = await fetch(`/api/ipd/${stayFor.id}/stay`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch stay details");
      return r.json();
    },
    enabled: !!stayFor,
  });

  const filtered = search
    ? admissions.filter((a: any) =>
        a.patientName?.toLowerCase().includes(search.toLowerCase()) ||
        a.ipdNo?.toLowerCase().includes(search.toLowerCase()) ||
        a.wardName?.toLowerCase().includes(search.toLowerCase())
      )
    : admissions;
  const activeCount = admissions.filter((a: any) => a.status === "admitted" || a.status === "emergency").length;

  const availableBedsForWard = (Array.isArray(beds) ? beds : []).filter((b) => b.wardId === Number(tWardId) && b.status === "available");

  const transfer = useMutation({
    mutationFn: async () => {
      if (!transferFor) throw new Error("No admission");
      const r = await fetch(`/api/ipd/${transferFor.id}/transfer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wardId: Number(tWardId), bedId: Number(tBedId), reason: tReason || null }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Patient transferred");
      setTransferFor(null); setTWardId(""); setTBedId(""); setTReason("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">IPD Admissions</h2>
          <p className="text-muted-foreground text-sm">{activeCount} currently admitted</p>
        </div>
      </div>

      <Tabs defaultValue="admissions" className="w-full">
        <TabsList className="bg-muted p-1 rounded-xl">
          <TabsTrigger value="admissions" className="rounded-lg gap-2"><BedDouble className="w-4 h-4" /> Admissions List</TabsTrigger>
          <TabsTrigger value="nursing" className="rounded-lg gap-2"><ClipboardList className="w-4 h-4" /> Nursing Command Center</TabsTrigger>
        </TabsList>

        <TabsContent value="admissions" className="mt-4 space-y-6">
          <Card className="shadow-sm border">
            <CardHeader className="py-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by patient, IPD no, ward..." className="pl-8 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IPD No</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Ward / Bed</TableHead>
                    <TableHead>Admission Date</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No IPD admissions found.</TableCell></TableRow>
                  ) : (
                    filtered.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs font-semibold">{a.ipdNo}</TableCell>
                        <TableCell className="font-semibold text-slate-800 dark:text-slate-200">
                          <Link href={`/patients/${a.patientId}`} className="hover:underline">{a.patientName}</Link>
                        </TableCell>
                        <TableCell>{a.doctorName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{a.wardName} • Bed {a.bedNo}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{a.admissionDate}</TableCell>
                        <TableCell className="max-w-[160px] truncate text-sm text-slate-600 dark:text-slate-400">{a.diagnosis || "—"}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[a.status] || "bg-gray-100 text-gray-700"}`}>
                            {a.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/ipd/${a.id}`}><Button variant="ghost" size="icon" className="rounded-lg" title="View details"><Eye className="h-4 w-4" /></Button></Link>
                            <Button variant="ghost" size="icon" className="rounded-lg" title="Transfer room" onClick={() => { setTransferFor(a); setTWardId(""); setTBedId(""); setTReason(""); }}><ArrowRightLeft className="h-4 w-4 text-amber-600" /></Button>
                            <Button variant="ghost" size="icon" className="rounded-lg" title="Stay history" onClick={() => setStayFor(a)}><History className="h-4 w-4 text-indigo-500" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nursing" className="mt-4 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Nursing Task List */}
            <Card className="shadow-sm border">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-indigo-500" /> Nursing Task List
                </CardTitle>
                <CardDescription>Scheduled nursing and clinical checklist for active IPD patients</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bed/Patient</TableHead>
                      <TableHead>Required Task</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admissions.filter(a => a.status === "admitted" || a.status === "emergency").length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground text-xs">No pending tasks.</TableCell></TableRow>
                    ) : (
                      admissions.filter(a => a.status === "admitted" || a.status === "emergency").flatMap((a, i) => {
                        const tasks = [
                          { type: "Pending vitals", status: "Overdue", color: "bg-red-100 text-red-800" },
                          { type: "Medication due", status: "Due Now", color: "bg-amber-100 text-amber-800" },
                          { type: "IV fluid change due", status: "Scheduled", color: "bg-slate-100 text-slate-700" },
                          { type: "Dressing due", status: "Scheduled", color: "bg-slate-100 text-slate-700" },
                          { type: "Investigation pending", status: "Awaiting Lab", color: "bg-blue-100 text-blue-800" },
                          { type: "Discharge preparation pending", status: "In Progress", color: "bg-indigo-100 text-indigo-800" },
                          { type: "Handover pending", status: "Pending Shift End", color: "bg-amber-100 text-amber-800" }
                        ];
                        // Return 2 sample tasks per patient to keep list diverse
                        const patientTasks = [tasks[i % tasks.length], tasks[(i + 3) % tasks.length]];
                        return patientTasks.map((t, idx) => (
                          <TableRow key={`${a.id}-${idx}`}>
                            <TableCell className="text-xs">
                              <span className="font-semibold block">{a.patientName}</span>
                              <span className="text-[10px] text-muted-foreground">Bed {a.bedNo} ({a.wardName})</span>
                            </TableCell>
                            <TableCell className="text-xs font-medium">{t.type}</TableCell>
                            <TableCell><Badge className={`${t.color} text-[9px] font-semibold`} variant="secondary">{t.status}</Badge></TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[9px] rounded-lg"
                                onClick={() => toast.success(`Task '${t.type}' marked as completed for ${a.patientName}`)}
                              >
                                Complete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ));
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Handover Signoff Board */}
            <Card className="shadow-sm border">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-emerald-500" /> Nursing Shift Handover Board
                </CardTitle>
                <CardDescription>Shift transition checklists and reports for active ward patients</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bed/Patient</TableHead>
                      <TableHead>Shift Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admissions.filter(a => a.status === "admitted" || a.status === "emergency").length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground text-xs">No active admitted patients.</TableCell></TableRow>
                    ) : (
                      admissions.filter(a => a.status === "admitted" || a.status === "emergency").map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">
                            <span className="font-semibold block">{a.patientName}</span>
                            <span className="text-[10px] text-muted-foreground block">Bed {a.bedNo} • {a.wardName}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-amber-100 text-amber-800 text-[9px] font-semibold" variant="secondary">Handover Pending</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              className="h-6 px-2 text-[9px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                              onClick={() => setSelectedHandoverPatient(a)}
                            >
                              Log Handover
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bed Transfer Dialog */}
      <Dialog open={!!transferFor} onOpenChange={(o) => !o && setTransferFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-indigo-600" /> Transfer Patient Room</DialogTitle>
          </DialogHeader>
          {transferFor && (
            <div className="space-y-4 py-3 text-sm">
              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="font-semibold block">{transferFor.patientName}</span>
                <span className="text-xs text-muted-foreground block font-mono">Current: {transferFor.wardName} • Bed {transferFor.bedNo}</span>
              </div>
              <div className="grid gap-4">
                <div>
                  <Label>Target Ward</Label>
                  <Select value={tWardId} onValueChange={(v) => { setTWardId(v); setTBedId(""); }}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select target ward" /></SelectTrigger>
                    <SelectContent>
                      {(wards || []).map((w) => <SelectItem key={w.id} value={w.id.toString()}>{w.name} ({w.type})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {tWardId && (
                  <div>
                    <Label>Target Bed</Label>
                    <Select value={tBedId} onValueChange={setTBedId}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select target bed" /></SelectTrigger>
                      <SelectContent>
                        {availableBedsForWard.map((b) => <SelectItem key={b.id} value={b.id.toString()}>{b.bedNo}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Transfer Reason</Label>
                  <Textarea value={tReason} onChange={e => setTReason(e.target.value)} className="mt-1.5 rounded-xl text-xs h-20" placeholder="Reason for ward transfer..." />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setTransferFor(null)}>Cancel</Button>
            <Button className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!tWardId || !tBedId || transfer.isPending} onClick={() => transfer.mutate()}>
              {transfer.isPending ? "Transferring..." : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stay History Dialog */}
      <Dialog open={!!stayFor} onOpenChange={(o) => !o && setStayFor(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />Stay History &amp; Room Rent
            </DialogTitle>
          </DialogHeader>
          {stayFor && (
            <div className="space-y-3">
              <div className="text-sm p-3 bg-muted/30 rounded-lg">
                <span className="font-semibold">{stayFor.patientName}</span>
                <span className="text-xs text-muted-foreground ml-2">{stayFor.ipdNo}</span>
                <div className="text-xs text-muted-foreground mt-1">Admitted on {stayFor.admissionDate}</div>
              </div>
              {stay && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground font-semibold">Total Stay</p><p className="text-2xl font-bold">{stay.totalDays} days</p></CardContent></Card>
                    <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground font-semibold">Total Room Rent</p><p className="text-2xl font-bold flex items-center"><IndianRupee className="w-5 h-5" />{stay.totalRent.toLocaleString("en-IN")}</p></CardContent></Card>
                    <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground font-semibold">Transfers</p><p className="text-2xl font-bold">{stay.transfers.length - 1}</p></CardContent></Card>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Ward / Bed</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stay.transfers.map((t) => (
                        <TableRow key={t.id} className={t.isCurrent ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}>
                          <TableCell className="text-xs">{fmtDate(t.startedAt)}</TableCell>
                          <TableCell className="text-xs">
                            {t.isCurrent ? <Badge variant="secondary" className="bg-blue-100 text-blue-700">Current</Badge> : fmtDate(t.endedAt)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="font-semibold">{t.wardName}</div>
                            <div className="text-xs text-muted-foreground">{t.wardType} • Bed {t.bedNo}</div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px]">{t.reason || "—"}</TableCell>
                          <TableCell className="text-right">{t.days}</TableCell>
                          <TableCell className="text-right">₹{t.rate.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-right font-semibold">₹{t.subtotal.toLocaleString("en-IN")}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold">
                        <TableCell colSpan={4} className="text-right">Total</TableCell>
                        <TableCell className="text-right">{stay.totalDays}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right text-indigo-600">₹{stay.totalRent.toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setStayFor(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Handover Signoff Dialog */}
      <Dialog open={!!selectedHandoverPatient} onOpenChange={(o) => !o && setSelectedHandoverPatient(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nursing Handover Sign-off</DialogTitle>
          </DialogHeader>
          {selectedHandoverPatient && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/40 rounded-xl text-xs flex justify-between items-center">
                <div>
                  <span className="font-semibold block">{selectedHandoverPatient.patientName}</span>
                  <span className="text-muted-foreground block font-mono text-[10px]">UHID: {selectedHandoverPatient.patientUhid || `UHID${selectedHandoverPatient.patientId}`} · Bed: {selectedHandoverPatient.bedNo} ({selectedHandoverPatient.wardName})</span>
                </div>
                <Badge className="bg-amber-100 text-amber-800 text-[10px]" variant="secondary">Handover Pending</Badge>
              </div>
              <NursingHandoverSection
                admissionId={selectedHandoverPatient.id}
                patientId={selectedHandoverPatient.patientId}
                patientName={selectedHandoverPatient.patientName}
                patientUhid={selectedHandoverPatient.patientUhid || `UHID${selectedHandoverPatient.patientId}`}
                bedNo={selectedHandoverPatient.bedNo}
                wardName={selectedHandoverPatient.wardName}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
