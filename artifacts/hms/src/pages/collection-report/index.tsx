import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet, CreditCard, Smartphone, Banknote, FileText } from "lucide-react";

interface DailyRow {
  date: string;
  entityId: number | null;
  paymentMode: string;
  collected: string;
  billed: string;
  due: string;
  invoices: number;
}
interface UserRow {
  collectedBy: string | null;
  collectorName: string;
  entityId: number | null;
  paymentMode: string;
  collected: string;
  invoices: number;
}
interface Entity { id: number; name: string }

const PAY_ICONS: Record<string, React.ReactNode> = {
  cash: <Banknote className="w-4 h-4" />,
  card: <CreditCard className="w-4 h-4" />,
  upi: <Smartphone className="w-4 h-4" />,
  online: <CreditCard className="w-4 h-4" />,
};
const PAY_COLORS: Record<string, string> = {
  cash: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  card: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  upi: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  online: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
};

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

type RangePreset = "today" | "yesterday" | "dby" | "week" | "month" | "year" | "custom";

function rangeFor(preset: Exclude<RangePreset, "custom">): { from: string; to: string } {
  switch (preset) {
    case "today": return { from: today(), to: today() };
    case "yesterday": return { from: daysAgo(1), to: daysAgo(1) };
    case "dby": return { from: daysAgo(2), to: daysAgo(2) };
    case "week": return { from: daysAgo(6), to: today() };
    case "month": return { from: daysAgo(29), to: today() };
    case "year": return { from: daysAgo(364), to: today() };
  }
}

export default function CollectionReportPage() {
  const [preset, setPreset] = useState<RangePreset>("today");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());

  const applyPreset = (p: Exclude<RangePreset, "custom">) => {
    const r = rangeFor(p);
    setPreset(p);
    setFrom(r.from);
    setTo(r.to);
  };

  const { data: daily, isLoading: dl } = useQuery<{ rows: DailyRow[] }>({
    queryKey: ["/api/reports/daily-collection", from, to],
    queryFn: () => fetch(`/api/reports/daily-collection?from=${from}&to=${to}`).then((r) => r.json()),
  });
  const { data: byUser, isLoading: ul } = useQuery<{ rows: UserRow[] }>({
    queryKey: ["/api/reports/user-collection", from, to],
    queryFn: () => fetch(`/api/reports/user-collection?from=${from}&to=${to}`).then((r) => r.json()),
  });
  const { data: entities } = useQuery<Entity[]>({
    queryKey: ["/api/entities"],
    queryFn: () => fetch("/api/entities").then((r) => r.json()),
  });

  const entName = (id: number | null) => entities?.find((e) => e.id === id)?.name || "—";

  const dailyRows = daily?.rows || [];
  const userRows = byUser?.rows || [];

  const totalCollected = dailyRows.reduce((s, r) => s + Number(r.collected), 0);
  const totalBilled = dailyRows.reduce((s, r) => s + Number(r.billed), 0);
  const totalDue = dailyRows.reduce((s, r) => s + Number(r.due), 0);
  const totalInvoices = dailyRows.reduce((s, r) => s + r.invoices, 0);

  const normMode = (m: string) => (m || "").toLowerCase();
  const byMode = dailyRows.reduce((acc, r) => {
    const k = normMode(r.paymentMode);
    acc[k] = (acc[k] || 0) + Number(r.collected);
    return acc;
  }, {} as Record<string, number>);

  // Pivot daily rows into per-date totals
  const dailyByDate = dailyRows.reduce((acc, r) => {
    const k = `${r.date}|${r.entityId}`;
    if (!acc[k]) acc[k] = { date: r.date, entityId: r.entityId, modes: {} as Record<string, number>, total: 0, invoices: 0 };
    acc[k].modes[normMode(r.paymentMode)] = (acc[k].modes[normMode(r.paymentMode)] || 0) + Number(r.collected);
    acc[k].total += Number(r.collected);
    acc[k].invoices += r.invoices;
    return acc;
  }, {} as Record<string, { date: string; entityId: number | null; modes: Record<string, number>; total: number; invoices: number }>);
  const dailyPivot = Object.values(dailyByDate).sort((a, b) => b.date.localeCompare(a.date));

  // Pivot user rows
  const userPivot = userRows.reduce((acc, r) => {
    const k = `${r.collectedBy || "x"}|${r.entityId}`;
    if (!acc[k]) acc[k] = { name: r.collectorName, entityId: r.entityId, modes: {} as Record<string, number>, total: 0, invoices: 0 };
    acc[k].modes[normMode(r.paymentMode)] = (acc[k].modes[normMode(r.paymentMode)] || 0) + Number(r.collected);
    acc[k].total += Number(r.collected);
    acc[k].invoices += r.invoices;
    return acc;
  }, {} as Record<string, { name: string; entityId: number | null; modes: Record<string, number>; total: number; invoices: number }>);
  const userList = Object.values(userPivot).sort((a, b) => b.total - a.total);

  const allModes = ["cash", "card", "upi", "online"];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Collection Report</h2>
          <p className="text-muted-foreground text-sm">Daily and user-wise collection across cash, card, UPI and online payments.</p>
        </div>
        <div className="flex gap-3 items-end">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} className="w-40" />
          </div>
        </div>
      </div>

      <Tabs value={preset === "custom" ? "" : preset} onValueChange={(v) => applyPreset(v as Exclude<RangePreset, "custom">)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="yesterday">Yesterday</TabsTrigger>
          <TabsTrigger value="dby">Day Before Yesterday</TabsTrigger>
          <TabsTrigger value="week">Last 1 Week</TabsTrigger>
          <TabsTrigger value="month">Last 1 Month</TabsTrigger>
          <TabsTrigger value="year">Last 1 Year</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="w-3 h-3" />Total Collected</p>
            <p className="text-2xl font-bold mt-1">₹{totalCollected.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" />Total Billed</p>
            <p className="text-2xl font-bold mt-1">₹{totalBilled.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-bold mt-1 text-red-600">₹{totalDue.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Invoices</p>
            <p className="text-2xl font-bold mt-1">{totalInvoices}</p>
          </CardContent>
        </Card>
      </div>

      {/* Mode-wise breakdown */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Payment Mode Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {allModes.map((m) => (
              <div key={m} className="border rounded-lg p-3">
                <Badge variant="secondary" className={`mb-2 capitalize ${PAY_COLORS[m] || ""}`}>
                  <span className="flex items-center gap-1">{PAY_ICONS[m]} {m}</span>
                </Badge>
                <p className="text-xl font-bold">₹{(byMode[m] || 0).toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground">{totalCollected > 0 ? Math.round(((byMode[m] || 0) / totalCollected) * 100) : 0}% of total</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Daily Collection</TabsTrigger>
          <TabsTrigger value="user">User-wise Collection</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {dl ? <Skeleton className="h-40" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead className="text-right">Cash</TableHead>
                      <TableHead className="text-right">Card</TableHead>
                      <TableHead className="text-right">UPI</TableHead>
                      <TableHead className="text-right">Online</TableHead>
                      <TableHead className="text-right">Invoices</TableHead>
                      <TableHead className="text-right font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyPivot.map((r) => (
                      <TableRow key={`${r.date}-${r.entityId}`}>
                        <TableCell className="font-mono text-xs">{r.date}</TableCell>
                        <TableCell className="text-sm">{entName(r.entityId)}</TableCell>
                        <TableCell className="text-right">{r.modes.cash ? `₹${r.modes.cash.toLocaleString("en-IN")}` : "—"}</TableCell>
                        <TableCell className="text-right">{r.modes.card ? `₹${r.modes.card.toLocaleString("en-IN")}` : "—"}</TableCell>
                        <TableCell className="text-right">{r.modes.upi ? `₹${r.modes.upi.toLocaleString("en-IN")}` : "—"}</TableCell>
                        <TableCell className="text-right">{r.modes.online ? `₹${r.modes.online.toLocaleString("en-IN")}` : "—"}</TableCell>
                        <TableCell className="text-right text-sm">{r.invoices}</TableCell>
                        <TableCell className="text-right font-bold">₹{r.total.toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    ))}
                    {dailyPivot.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No collections in this date range</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {ul ? <Skeleton className="h-40" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Collected By</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead className="text-right">Cash</TableHead>
                      <TableHead className="text-right">Card</TableHead>
                      <TableHead className="text-right">UPI</TableHead>
                      <TableHead className="text-right">Online</TableHead>
                      <TableHead className="text-right">Invoices</TableHead>
                      <TableHead className="text-right font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userList.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-sm">{entName(r.entityId)}</TableCell>
                        <TableCell className="text-right">{r.modes.cash ? `₹${r.modes.cash.toLocaleString("en-IN")}` : "—"}</TableCell>
                        <TableCell className="text-right">{r.modes.card ? `₹${r.modes.card.toLocaleString("en-IN")}` : "—"}</TableCell>
                        <TableCell className="text-right">{r.modes.upi ? `₹${r.modes.upi.toLocaleString("en-IN")}` : "—"}</TableCell>
                        <TableCell className="text-right">{r.modes.online ? `₹${r.modes.online.toLocaleString("en-IN")}` : "—"}</TableCell>
                        <TableCell className="text-right text-sm">{r.invoices}</TableCell>
                        <TableCell className="text-right font-bold">₹{r.total.toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    ))}
                    {userList.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No collections in this date range</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
