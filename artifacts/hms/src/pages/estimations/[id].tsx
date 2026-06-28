import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, ArrowLeft, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  expired: "bg-amber-100 text-amber-800",
  cancelled: "bg-rose-100 text-rose-800",
};

export default function EstimationDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [data, setData] = useState<any>(null);
  const [hospital, setHospital] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/estimations/${params.id}`, { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      fetch(`/api/hospital-settings/1`, { credentials: "include" }).then((r) => r.ok ? r.json() : null),
    ]).then(([est, hs]) => {
      setData(est);
      setHospital(hs);
    }).finally(() => setLoading(false));
  }, [params.id]);

  async function setStatus(next: "sent" | "accepted") {
    if (!data) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/estimations/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: next }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const updated = await r.json();
      setData((d: any) => ({ ...d, status: updated.status }));
      toast.success(`Marked as ${next}`);
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-8"><Skeleton className="h-40 w-full" /></div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">Estimation not found.</div>;

  const items: any[] = Array.isArray(data.items) ? data.items : [];
  const subtotal = Number(data.subtotal || 0);
  const discount = Number(data.discount || 0);
  const gst = Number(data.gstAmount || 0);
  const total = Number(data.totalAmount || 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/estimations")}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
        <div className="flex items-center gap-2">
          {data.status === "draft" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus("sent")}>
              <Send className="h-4 w-4 mr-1" />Mark as Sent
            </Button>
          )}
          {(data.status === "draft" || data.status === "sent") && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus("accepted")}>
              <CheckCircle2 className="h-4 w-4 mr-1" />Mark as Accepted
            </Button>
          )}
          <Button size="sm" onClick={() => window.print()} data-testid="print-button">
            <Printer className="h-4 w-4 mr-1" />Print
          </Button>
        </div>
      </div>

      {/* Printable estimate */}
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-8">
          {/* Hospital header */}
          <div className="text-center border-b pb-4 mb-4">
            <div className="text-2xl font-bold tracking-tight">{hospital?.hospitalName || "Hope Hospital"}</div>
            {hospital?.tagline && <div className="text-sm text-muted-foreground italic">{hospital.tagline}</div>}
            <div className="text-xs text-muted-foreground mt-1">
              {[hospital?.address, hospital?.phone, hospital?.email].filter(Boolean).join(" · ")}
            </div>
          </div>

          {/* Title bar */}
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="uppercase text-xs tracking-wider text-muted-foreground">Cost Estimate</div>
              <div className="text-xl font-bold capitalize">{data.type} Estimation</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Estimation No</div>
              <div className="font-mono font-semibold">{data.estimationNo}</div>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[data.status] || ""}`}>
                {data.status}
              </span>
            </div>
          </div>

          {/* Patient + meta two columns */}
          <div className="grid grid-cols-2 gap-6 text-sm border rounded-md p-4 mb-4">
            <div className="space-y-1">
              <div><span className="text-muted-foreground">Patient:</span> <span className="font-semibold">{data.patientName}</span></div>
              <div><span className="text-muted-foreground">UHID:</span> <span className="font-mono">{data.uhid}</span></div>
              <div><span className="text-muted-foreground">Gender / Age:</span> {data.patientGender || "—"} / {data.patientAge || "—"} yrs</div>
              <div><span className="text-muted-foreground">Phone:</span> {data.patientPhone || "—"}</div>
              {data.patientAddress && <div><span className="text-muted-foreground">Address:</span> {data.patientAddress}</div>}
            </div>
            <div className="space-y-1">
              {data.surgeonName && <div><span className="text-muted-foreground">{data.type === "surgery" ? "Surgeon" : "Consultant"}:</span> {data.surgeonName}</div>}
              {data.procedureName && <div><span className="text-muted-foreground">Procedure:</span> {data.procedureName}</div>}
              {data.packageName && <div><span className="text-muted-foreground">Package:</span> {data.packageName}</div>}
              {data.wardCategory && <div><span className="text-muted-foreground">Ward:</span> {data.wardCategory}</div>}
              {data.expectedDays != null && <div><span className="text-muted-foreground">Expected Stay:</span> {data.expectedDays} days</div>}
              <div><span className="text-muted-foreground">Issue Date:</span> {new Date(data.createdAt).toISOString().slice(0, 10)}</div>
              <div><span className="text-muted-foreground">Valid Until:</span> {data.validUntil}</div>
            </div>
          </div>

          {/* Items */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-20 text-right">Qty</TableHead>
                <TableHead className="w-32 text-right">Rate</TableHead>
                <TableHead className="w-32 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, i) => (
                <TableRow key={i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>
                    {it.description}
                    {it.category && <span className="text-xs text-muted-foreground ml-2">({it.category})</span>}
                  </TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right">₹{Number(it.rate).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">₹{Number(it.amount).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Totals */}
          <div className="flex justify-end mt-4">
            <div className="w-full md:w-72 text-sm space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">₹{subtotal.toLocaleString()}</span></div>
              {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="font-mono">– ₹{discount.toLocaleString()}</span></div>}
              {gst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">GST / Other</span><span className="font-mono">+ ₹{gst.toLocaleString()}</span></div>}
              <div className="border-t pt-2 flex justify-between text-base">
                <span className="font-semibold">Estimated Total</span>
                <span className="font-bold">₹{total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {data.notes && (
            <div className="mt-6 border-t pt-4 text-sm">
              <div className="font-semibold mb-1">Notes</div>
              <div className="text-muted-foreground whitespace-pre-wrap">{data.notes}</div>
            </div>
          )}

          <div className="mt-8 text-xs text-muted-foreground border-t pt-3">
            This is an <strong>estimate only</strong> based on the services / package selected at the time of issue.
            Final billing may vary depending on consumables, complications, and length of stay. Valid until {data.validUntil}.
          </div>
        </CardContent>
      </Card>

      <style>{`@media print {
        body { background: white; }
        nav, aside, header, .print\\:hidden { display: none !important; }
        @page { size: A4; margin: 12mm; }
      }`}</style>
    </div>
  );
}
