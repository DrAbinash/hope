import { useState } from "react";
import { useListInvoices, useGetBillingSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Search, Eye, IndianRupee } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  partial: "bg-yellow-100 text-yellow-800",
  unpaid: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-700",
};

export default function BillingPage() {
  const [search, setSearch] = useState("");
  const { data: invoicesData, isLoading } = useListInvoices({});
  const { data: summary } = useGetBillingSummary();
  const invoices = invoicesData?.invoices || [];

  const filtered = search
    ? invoices.filter((i: any) =>
        i.patientName?.toLowerCase().includes(search.toLowerCase()) ||
        i.invoiceNo?.toLowerCase().includes(search.toLowerCase())
      )
    : invoices;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground text-sm">Hospital invoices and payment tracking</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Today's Collection", value: summary?.todayCollection, prefix: "₹", color: "text-green-600" },
          { title: "Month Collection", value: summary?.monthCollection, prefix: "₹", color: "text-blue-600" },
          { title: "Outstanding Dues", value: summary?.totalOutstanding, prefix: "₹", color: "text-red-600" },
          { title: "Today's Invoices", value: summary?.todayInvoices, color: "text-foreground" },
          { title: "Hospital Revenue", value: summary?.hospitalRevenue, prefix: "₹", color: "text-foreground" },
          { title: "Pharmacy Revenue", value: summary?.pharmacyRevenue, prefix: "₹", color: "text-foreground" },
        ].map(({ title, value, prefix = "", color }) => (
          <Card key={title}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${color}`}>
                {value !== undefined ? `${prefix}${Number(value).toLocaleString()}` : "—"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by patient, invoice no..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 10 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center h-24 text-muted-foreground">No invoices found.</TableCell></TableRow>
              ) : (
                filtered.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs font-medium">{inv.invoiceNo}</TableCell>
                    <TableCell className="font-semibold">{inv.patientName}</TableCell>
                    <TableCell><Badge variant="outline">{inv.type}</Badge></TableCell>
                    <TableCell>{inv.invoiceDate}</TableCell>
                    <TableCell className="font-medium">₹{parseFloat(inv.totalAmount || "0").toLocaleString()}</TableCell>
                    <TableCell className="text-green-600">₹{parseFloat(inv.paidAmount || "0").toLocaleString()}</TableCell>
                    <TableCell className={parseFloat(inv.dueAmount || "0") > 0 ? "text-red-600 font-medium" : ""}>
                      ₹{parseFloat(inv.dueAmount || "0").toLocaleString()}
                    </TableCell>
                    <TableCell>{inv.paymentMode}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] || "bg-gray-100"}`}>
                        {inv.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/billing/${inv.id}`}><Eye className="h-4 w-4 mr-1" />View</Link>
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
