import { useListWards, useGetBedAvailability } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BedDouble, TrendingUp, Grid, List, AlertCircle, RefreshCw, ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Ward { id: number; name: string; type: string; ratePerDay: string | number }
interface Bed { id: number; wardId: number; bedNo: string; status: string; patientId?: number | null; patientName?: string | null }

export default function WardsPage() {
  const qc = useQueryClient();
  const { data: wards, isLoading: wardsLoading } = useListWards();
  const { data: availability, isLoading: availLoading } = useGetBedAvailability();

  const { data: beds, isLoading: bedsLoading } = useQuery<Bed[]>({
    queryKey: ["/api/beds"],
    queryFn: async () => {
      const r = await fetch("/api/beds", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch beds");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [transferTargetWard, setTransferTargetWard] = useState("");
  const [transferTargetBed, setTransferTargetBed] = useState("");

  const totalBeds = (availability || []).reduce((s: number, w: any) => s + w.totalBeds, 0);
  const occupiedBeds = (availability || []).reduce((s: number, w: any) => s + w.occupiedBeds, 0);
  const availableBeds = totalBeds - occupiedBeds;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const quickTransfer = useMutation({
    mutationFn: async () => {
      if (!selectedBed) return;
      // Get the active IPD admission for this bed
      const admsRes = await fetch("/api/ipd", { credentials: "include" });
      if (!admsRes.ok) throw new Error("Failed to fetch admissions");
      const admsData = await admsRes.json();
      const admission = admsData.admissions?.find((a: any) => a.bedId === selectedBed.id && a.status === "admitted");
      if (!admission) throw new Error("No active patient admission found in this bed");

      const r = await fetch(`/api/ipd/${admission.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ wardId: Number(transferTargetWard), bedId: Number(transferTargetBed), reason: "Quick Transfer from Bed Manager" }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed to transfer patient");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Patient transferred successfully!");
      setSelectedBed(null);
      setTransferTargetWard("");
      setTransferTargetBed("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Bed Management Dashboard</h2>
          <p className="text-muted-foreground text-sm">Real-time visual layout and occupancy tracking</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { title: "Total Capacity", value: totalBeds, color: "text-slate-800 dark:text-white" },
          { title: "Occupied Beds", value: occupiedBeds, color: "text-rose-600" },
          { title: "Available Beds", value: availableBeds, color: "text-emerald-600" },
          { title: "Occupancy Rate", value: `${occupancyRate}%`, color: occupancyRate > 80 ? "text-rose-600" : occupancyRate > 60 ? "text-amber-600" : "text-emerald-600" },
        ].map(({ title, value, color }) => (
          <Card key={title} className="shadow-sm border">
            <CardHeader className="pb-1.5"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">{title}</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-bold ${color}`}>{availLoading ? "—" : value}</p></CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="visual" className="w-full">
        <TabsList className="bg-muted p-1 rounded-xl">
          <TabsTrigger value="visual" className="rounded-lg gap-2"><Grid className="w-4 h-4" /> Visual Bed Grid</TabsTrigger>
          <TabsTrigger value="list" className="rounded-lg gap-2"><List className="w-4 h-4" /> Wards Table</TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="mt-4 space-y-6">
          {bedsLoading || wardsLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          ) : (wards || []).map((ward) => {
            const wardBeds = (beds || []).filter((b) => b.wardId === ward.id);
            return (
              <Card key={ward.id} className="shadow-sm border">
                <CardHeader className="pb-3 border-b bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2"><BedDouble className="w-4 h-4 text-indigo-500" /> {ward.name}</CardTitle>
                      <CardDescription className="text-xs capitalize">{ward.type} Ward · Rate: ₹{ward.ratePerDay}/day</CardDescription>
                    </div>
                    <Badge variant="outline" className="font-semibold">{wardBeds.filter(b => b.status === "available").length} Available / {wardBeds.length} Total</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {wardBeds.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No beds provisioned in this ward.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                      {wardBeds.map((bed) => {
                        const isOccupied = bed.status === "occupied";
                        return (
                          <div
                            key={bed.id}
                            onClick={() => isOccupied && setSelectedBed(bed)}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                              isOccupied
                                ? "bg-rose-50 border-rose-200 hover:bg-rose-100 text-rose-700 shadow-sm"
                                : "bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            <BedDouble className="w-6 h-6 mb-1" />
                            <span className="font-bold text-xs font-mono">{bed.bedNo}</span>
                            <span className="text-[10px] uppercase font-semibold mt-0.5 tracking-wider">
                              {bed.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card className="shadow-sm border">
            <CardHeader><CardTitle className="text-base">Wards Summary</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ward Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Total Beds</TableHead>
                    <TableHead>Occupied</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Occupancy Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(availability || []).map((w: any) => (
                    <TableRow key={w.wardId}>
                      <TableCell className="font-semibold">{w.wardName}</TableCell>
                      <TableCell><span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">{w.wardType}</span></TableCell>
                      <TableCell>{w.totalBeds}</TableCell>
                      <TableCell className="text-rose-600 font-semibold">{w.occupiedBeds}</TableCell>
                      <TableCell className="text-emerald-600 font-semibold">{w.availableBeds}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5 w-24">
                            <div className={`h-1.5 rounded-full ${w.occupancyRate > 80 ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${w.occupancyRate}%` }} />
                          </div>
                          <span className="text-xs font-bold font-mono">{w.occupancyRate}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bed Action / Quick Transfer Modal */}
      <Dialog open={!!selectedBed} onOpenChange={() => setSelectedBed(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-indigo-600" /> Bed Transfer Manager</DialogTitle>
            <DialogDescription>Quickly transfer patient currently in Bed {selectedBed?.bedNo} to another ward/bed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label className="text-xs font-bold text-muted-foreground uppercase">Target Ward</Label>
              <Select value={transferTargetWard} onValueChange={setTransferTargetWard}>
                <SelectTrigger className="rounded-xl mt-1.5"><SelectValue placeholder="Select target ward" /></SelectTrigger>
                <SelectContent>
                  {(wards || []).map((w) => <SelectItem key={w.id} value={w.id.toString()}>{w.name} ({w.type})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {transferTargetWard && (
              <div>
                <Label className="text-xs font-bold text-muted-foreground uppercase">Target Bed</Label>
                <Select value={transferTargetBed} onValueChange={setTransferTargetBed}>
                  <SelectTrigger className="rounded-xl mt-1.5"><SelectValue placeholder="Select target bed" /></SelectTrigger>
                  <SelectContent>
                    {(beds || []).filter(b => b.wardId === Number(transferTargetWard) && b.status === "available").map((b) => (
                      <SelectItem key={b.id} value={b.id.toString()}>{b.bedNo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setSelectedBed(null)}>Cancel</Button>
            <Button className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!transferTargetBed || quickTransfer.isPending} onClick={() => quickTransfer.mutate()}>
              {quickTransfer.isPending ? "Transferring..." : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
