import { Link } from "wouter";
import { useListOpdVisits } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Printer } from "lucide-react";

export default function TodayAppointments() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useListOpdVisits({ limit: 200 } as any);
  const visits = (data?.visits || []).filter((v: any) => (v.visitDate || "").slice(0, 10) === today);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Today's Appointment</h2>
        <p className="text-muted-foreground text-sm">{today} · {visits.length} appointment(s)</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>OPD No.</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Complaints</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : visits.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No appointments today.</TableCell></TableRow>
              ) : (
                visits.map((v: any, i: number) => (
                  <TableRow key={v.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{v.visitNo}</TableCell>
                    <TableCell className="font-semibold">{v.patientName}</TableCell>
                    <TableCell>{v.doctorName}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">{v.chiefComplaints || "—"}</TableCell>
                    <TableCell className="capitalize">{v.status}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" asChild><Link href={`/opd/${v.id}`}><Eye className="h-4 w-4 mr-1" />Open</Link></Button>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`${import.meta.env.BASE_URL}opd/${v.id}/print`} target="_blank" rel="noreferrer"><Printer className="h-4 w-4 mr-1" />Print</a>
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
  );
}
