import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";

const j = async (url: string) => {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Request failed");
  return r.json();
};
function inr(n: any) { return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; }

export default function ExpiryManagementPage() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["expiry-dashboard"],
    queryFn: () => j("/api/pharmacy/expiry-dashboard"),
  });

  const exportCsv = (items: any[], label: string) => {
    const header = "Medicine,Batch No,Expiry Date,Quantity,Purchase Rate,Value\n";
    const rows = items.map((b: any) =>
      `"${b.medicineName || ""}","${b.batchNo}","${b.expiryDate}",${b.quantity},"${b.purchaseRate || ""}","${(b.quantity * parseFloat(b.purchaseRate || "0")).toFixed(2)}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${label}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const BatchTable = ({ items, emptyMsg }: { items: any[]; emptyMsg: string }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Medicine</TableHead>
          <TableHead>Batch No</TableHead>
          <TableHead>Expiry Date</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Purchase Rate</TableHead>
          <TableHead className="text-right">Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 && (
          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">{emptyMsg}</TableCell></TableRow>
        )}
        {items.map((b: any) => (
          <TableRow key={b.id}>
            <TableCell className="font-medium">{b.medicineName}</TableCell>
            <TableCell className="font-mono text-xs">{b.batchNo}</TableCell>
            <TableCell className="text-sm">{b.expiryDate}</TableCell>
            <TableCell className="text-right">{b.quantity}</TableCell>
            <TableCell className="text-right">{b.purchaseRate ? inr(b.purchaseRate) : "—"}</TableCell>
            <TableCell className="text-right font-medium">{inr(b.quantity * parseFloat(b.purchaseRate || "0"))}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (isLoading) return <Skeleton className="h-80 m-4" />;

  const expired = data?.expired?.items || [];
  const expiring30 = data?.expiring30?.items || [];
  const expiring90 = data?.expiring90?.items || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-orange-500" />Expiry Management
        </h2>
        <p className="text-muted-foreground text-sm">Batch-wise expiry tracking · Prevent billing of expired stock</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Expired Batches", count: data?.expired?.count ?? 0, value: data?.expired?.value ?? 0, color: "text-red-600", bg: "bg-red-50" },
          { label: "Expiring in 30 Days", count: data?.expiring30?.count ?? 0, value: data?.expiring30?.value ?? 0, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Expiring in 90 Days", count: data?.expiring90?.count ?? 0, value: data?.expiring90?.value ?? 0, color: "text-yellow-600", bg: "bg-yellow-50" },
        ].map(({ label, count, value, color, bg }) => (
          <Card key={label} className={bg}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-medium">{label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className={`text-2xl font-bold ${color}`}>{count}</p>
              <p className={`text-sm ${color}`}>Value: {inr(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="expired">
        <TabsList>
          <TabsTrigger value="expired">
            Expired
            {expired.length > 0 && <Badge className="ml-2 bg-red-100 text-red-800 text-xs">{expired.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="expiring30">
            Expiring ≤ 30d
            {expiring30.length > 0 && <Badge className="ml-2 bg-orange-100 text-orange-800 text-xs">{expiring30.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="expiring90">
            Expiring ≤ 90d
            {expiring90.length > 0 && <Badge className="ml-2 bg-yellow-100 text-yellow-800 text-xs">{expiring90.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expired">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Expired Stock</CardTitle>
              <Button size="sm" variant="outline" onClick={() => exportCsv(expired, "expired_stock")}>
                <Download className="h-3 w-3 mr-1" />Export CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <BatchTable items={expired} emptyMsg="No expired batches." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiring30">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Expiring Within 30 Days</CardTitle>
              <Button size="sm" variant="outline" onClick={() => exportCsv(expiring30, "expiring_30d")}>
                <Download className="h-3 w-3 mr-1" />Export CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <BatchTable items={expiring30} emptyMsg="No batches expiring in 30 days." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiring90">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Expiring Within 90 Days</CardTitle>
              <Button size="sm" variant="outline" onClick={() => exportCsv(expiring90, "expiring_90d")}>
                <Download className="h-3 w-3 mr-1" />Export CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <BatchTable items={expiring90} emptyMsg="No batches expiring in 90 days." />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
