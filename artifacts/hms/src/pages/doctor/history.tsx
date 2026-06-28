import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useListPatients } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { format } from "date-fns";

function safeDate(s: string | undefined | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : format(d, "dd MMM yyyy");
}

export default function PatientHistoryPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: patientsData } = useListPatients({});
  const patients = patientsData?.patients || [];
  const matched = search
    ? patients.filter((p: any) =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.uhid?.toLowerCase().includes(search.toLowerCase()) ||
        p.phone?.includes(search))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Old Patient History</h2>
        <p className="text-muted-foreground text-sm">Search a patient to view all their OPD/IPD visits and bills</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, UHID or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              data-testid="history-search"
            />
          </div>
          {search && matched.length === 0 && <div className="text-sm text-muted-foreground">No matching patients.</div>}
          {matched.length > 0 && (
            <div className="border rounded-md divide-y max-h-72 overflow-auto">
              {matched.slice(0, 20).map((p: any) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left px-3 py-2 hover:bg-muted/50 ${selectedId === p.id ? "bg-blue-50" : ""}`}
                  data-testid={`history-patient-${p.id}`}
                >
                  <div className="font-semibold">{p.name} <span className="text-xs text-muted-foreground">({p.uhid})</span></div>
                  <div className="text-xs text-muted-foreground">{p.gender} · {p.age}y · {p.phone}</div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedId && <HistoryDetail id={selectedId} />}
    </div>
  );
}

function HistoryDetail({ id }: { id: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    fetch(`/api/patients/${id}/history`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-20 w-full" /></CardContent></Card>;
  if (err) return <Card><CardContent className="p-6 text-destructive">Failed to load: {err}</CardContent></Card>;
  if (!data) return null;

  const { patient, opdVisits = [], ipdAdmissions = [], invoices = [] } = data;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="font-semibold text-lg">{patient.name}</div>
          <div className="text-sm text-muted-foreground">
            UHID {patient.uhid} · {patient.gender} · {patient.age}y · {patient.phone}
          </div>
          {patient.address && <div className="text-sm text-muted-foreground">{patient.address}</div>}
        </CardContent>
      </Card>

      <Card>
        <div className="px-4 py-2 border-b font-semibold">OPD Visits ({opdVisits.length})</div>
        <CardContent className="p-0">
          {opdVisits.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No OPD visits.</div>
          ) : (
            <div className="divide-y">
              {opdVisits.map((v: any) => (
                <div key={v.id} className="p-4 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">{v.visitNo}</div>
                    <div className="font-medium">{v.visitDate}</div>
                    <div className="text-xs text-muted-foreground">{v.doctorName}</div>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    {v.chiefComplaints && <div><span className="text-muted-foreground">Complaints:</span> {v.chiefComplaints}</div>}
                    {v.diagnosis && <div><span className="text-muted-foreground">Diagnosis:</span> {v.diagnosis}</div>}
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" size="sm" asChild><Link href={`/opd/${v.id}`}>Open</Link></Button>
                      <Button variant="outline" size="sm" asChild><a href={`${import.meta.env.BASE_URL}opd/${v.id}/print`} target="_blank" rel="noreferrer">Print</a></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="px-4 py-2 border-b font-semibold">IPD Admissions ({ipdAdmissions.length})</div>
        <CardContent className="p-0">
          {ipdAdmissions.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No IPD admissions.</div>
          ) : (
            <div className="divide-y">
              {ipdAdmissions.map((a: any) => (
                <div key={a.id} className="p-4 text-sm">
                  <div className="font-mono text-xs text-muted-foreground">{a.ipdNo}</div>
                  <div>
                    <span className="font-medium">{a.admissionDate}</span>
                    {a.dischargeDate && <span className="text-muted-foreground"> → {a.dischargeDate}</span>}
                    {" · "}{a.wardName} / Bed {a.bedNo}
                  </div>
                  {a.diagnosis && <div className="text-muted-foreground mt-1">Diagnosis: {a.diagnosis}</div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="px-4 py-2 border-b font-semibold">Invoices ({invoices.length})</div>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No invoices.</div>
          ) : (
            <div className="divide-y text-sm">
              {invoices.map((inv: any) => (
                <div key={inv.id} className="p-3 flex justify-between">
                  <div>
                    <div className="font-mono text-xs">{inv.invoiceNo}</div>
                    <div className="text-xs text-muted-foreground">{safeDate(inv.createdAt)}</div>
                  </div>
                  <div className="font-semibold">₹{parseFloat(String(inv.totalAmount || 0)).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
