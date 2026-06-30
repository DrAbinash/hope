import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, FlaskConical } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);
const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
const ninetyAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

async function fetchDeadStock(days: number) { const r = await fetch(`/api/pharmacy/analytics/dead-stock?days=${days}`, { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); }
async function fetchFastMoving(days: number) { const r = await fetch(`/api/pharmacy/analytics/fast-moving?days=${days}&limit=20`, { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); }
async function fetchAntibiotics(from: string, to: string) { const r = await fetch(`/api/pharmacy/analytics/antibiotic-usage?fromDate=${from}&toDate=${to}`, { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); }
async function fetchMargin() { const r = await fetch("/api/pharmacy/analytics/margin-check", { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); }

export default function PharmacyAnalyticsPage() {
  const [deadDays, setDeadDays] = useState(90);
  const [fastDays, setFastDays] = useState(30);
  const [abFrom, setAbFrom] = useState(thirtyAgo);
  const [abTo, setAbTo] = useState(today);

  const { data: dead } = useQuery({ queryKey: ["dead-stock", deadDays], queryFn: () => fetchDeadStock(deadDays) });
  const { data: fast } = useQuery({ queryKey: ["fast-moving", fastDays], queryFn: () => fetchFastMoving(fastDays) });
  const { data: antibiotics } = useQuery({ queryKey: ["antibiotic-usage", abFrom, abTo], queryFn: () => fetchAntibiotics(abFrom, abTo) });
  const { data: margin = [] } = useQuery({ queryKey: ["margin-check"], queryFn: fetchMargin });

  const safeMargin = Array.isArray(margin) ? margin : [];
  const deadItems: any[] = Array.isArray(dead?.items) ? dead.items : [];
  const fastItems: any[] = Array.isArray(fast?.items) ? fast.items : [];
  const abItems: any[] = Array.isArray(antibiotics?.items) ? antibiotics.items : [];
  const belowMargin = safeMargin.filter((m: any) => m.below_min_margin);

  const totalDeadValue = deadItems.reduce((s, i) => s + parseFloat(i.blocked_value ?? "0"), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Pharmacy Analytics</h1>
        <p className="text-sm text-muted-foreground">Dead stock, fast-moving, antibiotic stewardship, margin analysis</p>
      </div>

      <Tabs defaultValue="dead">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="dead">Dead Stock</TabsTrigger>
          <TabsTrigger value="fast">Fast-Moving</TabsTrigger>
          <TabsTrigger value="antibiotic">Antibiotic Usage</TabsTrigger>
          <TabsTrigger value="margin">Margin Check</TabsTrigger>
        </TabsList>

        {/* Dead Stock */}
        <TabsContent value="dead" className="mt-4 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">No movement in</Label>
              <Select value={String(deadDays)} onValueChange={v => setDeadDays(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="30">30 days</SelectItem><SelectItem value="60">60 days</SelectItem><SelectItem value="90">90 days</SelectItem><SelectItem value="180">180 days</SelectItem></SelectContent>
              </Select>
            </div>
            {totalDeadValue > 0 && <div className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-sm font-medium text-red-700">₹{totalDeadValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })} blocked in dead stock</div>}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Blocked Value</TableHead><TableHead>Last Movement</TableHead></TableRow></TableHeader>
                <TableBody>
                  {deadItems.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No dead stock found</TableCell></TableRow>
                    : deadItems.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell><div className="font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.generic_name}</div></TableCell>
                        <TableCell><Badge variant="outline">{item.category || "—"}</Badge></TableCell>
                        <TableCell className="text-right">{item.stock}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">₹{Number(item.blocked_value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.last_movement_date ? new Date(item.last_movement_date).toLocaleDateString("en-IN") : "Never"}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fast Moving */}
        <TabsContent value="fast" className="mt-4 space-y-4">
          <div className="flex items-center gap-4">
            <Select value={String(fastDays)} onValueChange={v => setFastDays(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="7">7 days</SelectItem><SelectItem value="15">15 days</SelectItem><SelectItem value="30">30 days</SelectItem><SelectItem value="90">90 days</SelectItem></SelectContent>
            </Select>
          </div>
          {fastItems.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Top 10 by Revenue</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={fastItems.slice(0, 10)} layout="vertical">
                    <XAxis type="number" tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} />
                    <Bar dataKey="total_value" radius={[0, 4, 4, 0]}>
                      {fastItems.slice(0, 10).map((_: any, i: number) => (
                        <Cell key={i} fill={`hsl(${220 + i * 10}, 70%, ${55 - i * 2}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Medicine</TableHead><TableHead className="text-right">Qty Sold</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Txns</TableHead></TableRow></TableHeader>
                <TableBody>
                  {fastItems.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>
                    : fastItems.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell><div className="font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.generic_name}</div></TableCell>
                        <TableCell className="text-right font-semibold">{Number(item.total_qty).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold text-green-700">₹{Number(item.total_value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{item.movement_count}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Antibiotic Usage */}
        <TabsContent value="antibiotic" className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2"><Label className="text-xs whitespace-nowrap">From</Label><Input type="date" value={abFrom} onChange={e => setAbFrom(e.target.value)} className="w-36" /></div>
            <div className="flex items-center gap-2"><Label className="text-xs whitespace-nowrap">To</Label><Input type="date" value={abTo} onChange={e => setAbTo(e.target.value)} className="w-36" /></div>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Class</TableHead><TableHead>Antibiotic</TableHead><TableHead className="text-right">Qty Used</TableHead><TableHead className="text-right">Patients</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
                <TableBody>
                  {abItems.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground"><FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No antibiotic usage data for this period</p></TableCell></TableRow>
                    : abItems.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell><Badge variant="outline">{item.antibiotic_class || "—"}</Badge></TableCell>
                        <TableCell><div className="font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.generic_name}</div></TableCell>
                        <TableCell className="text-right font-semibold">{Number(item.total_qty).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{item.patient_count}</TableCell>
                        <TableCell className="text-right">₹{Number(item.total_value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Margin Check */}
        <TabsContent value="margin" className="mt-4 space-y-4">
          {belowMargin.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200 w-fit">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">{belowMargin.length} medicines below minimum margin</span>
            </div>
          )}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead className="text-right">Purchase Rate</TableHead><TableHead className="text-right">Sale Rate</TableHead><TableHead className="text-right">MRP</TableHead><TableHead className="text-right">Actual Margin</TableHead><TableHead className="text-right">Min Margin</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {safeMargin.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>
                    : safeMargin.map((item: any, i: number) => (
                      <TableRow key={i} className={item.below_min_margin ? "bg-red-50/40" : ""}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right">₹{Number(item.purchase_rate).toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{Number(item.sale_rate).toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{Number(item.mrp).toFixed(2)}</TableCell>
                        <TableCell className={`text-right font-semibold ${parseFloat(item.actual_margin_percent) < 0 ? "text-red-600" : parseFloat(item.actual_margin_percent) < 10 ? "text-amber-600" : "text-green-600"}`}>{item.actual_margin_percent ? `${item.actual_margin_percent}%` : "—"}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{item.min_margin_percent ? `${item.min_margin_percent}%` : "—"}</TableCell>
                        <TableCell>
                          {item.below_min_margin && <Badge className="bg-red-100 text-red-700">Below Min</Badge>}
                          {!item.below_min_margin && item.actual_margin_percent && <Badge className="bg-green-100 text-green-700">OK</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
