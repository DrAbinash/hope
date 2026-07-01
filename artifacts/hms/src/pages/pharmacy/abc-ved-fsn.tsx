import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Layers, Play } from "lucide-react";
import { toast } from "sonner";

const ABC_COLORS: Record<string, string> = { A: "bg-red-500 text-white", B: "bg-amber-500 text-white", C: "bg-green-500 text-white", "?": "bg-gray-300" };
const VED_COLORS: Record<string, string> = { V: "bg-red-600 text-white", E: "bg-amber-600 text-white", D: "bg-blue-500 text-white", "?": "bg-gray-300" };
const FSN_COLORS: Record<string, string> = { F: "bg-green-600 text-white", S: "bg-amber-500 text-white", N: "bg-red-500 text-white", "?": "bg-gray-300" };

export default function AbcVedFsnPage() {
  const [list, setList] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [abc, setAbc] = useState("all");
  const [ved, setVed] = useState("all");
  const [fsn, setFsn] = useState("all");
  const [running, setRunning] = useState(false);

  useEffect(() => { load(); }, [abc, ved, fsn]);
  async function load() {
    const params = new URLSearchParams();
    if (abc !== "all") params.set("abc", abc);
    if (ved !== "all") params.set("ved", ved);
    if (fsn !== "all") params.set("fsn", fsn);
    const [l, s] = await Promise.all([
      (async () => { const r = await fetch(`/api/pharmacy/abc-ved-fsn?${params}`, { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); })(),
      (async () => { const r = await fetch("/api/pharmacy/abc-ved-fsn/summary", { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); })(),
    ]);
    setList(Array.isArray(l) ? l : []);
    setSummary(Array.isArray(s) ? s : []);
  }

  async function runAnalysis() {
    setRunning(true);
    const r = await fetch("/api/pharmacy/abc-ved-fsn/run", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ months: 12 }),
    });
    setRunning(false);
    if (r.ok) { toast.success("Analysis complete"); load(); }
    else toast.error("Failed");
  }

  async function setVedFor(id: number, v: string) {
    await fetch(`/api/pharmacy/abc-ved-fsn/${id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ved_class: v }),
    });
    load();
  }

  // Build A×V×F summary matrix
  const cells: Record<string, number> = {};
  summary.forEach(s => {
    const k = `${s.abc_class}|${s.ved_class || "?"}|${s.fsn_class || "?"}`;
    cells[k] = Number(s.count);
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Layers className="h-6 w-6" /> ABC / VED / FSN Analysis</h1>
        <Button onClick={runAnalysis} disabled={running} data-testid="run-analysis">
          <Play className="h-4 w-4 mr-1" /> {running ? "Running..." : "Re-run (12 mo)"}
        </Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Medicine List</TabsTrigger>
          <TabsTrigger value="matrix">A×V×F Matrix</TabsTrigger>
          <TabsTrigger value="legend">Legend</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="flex gap-2 mb-3">
            <Select value={abc} onValueChange={setAbc}><SelectTrigger className="w-32"><SelectValue placeholder="ABC" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All ABC</SelectItem><SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem><SelectItem value="C">C</SelectItem></SelectContent>
            </Select>
            <Select value={ved} onValueChange={setVed}><SelectTrigger className="w-32"><SelectValue placeholder="VED" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All VED</SelectItem><SelectItem value="V">V — Vital</SelectItem><SelectItem value="E">E — Essential</SelectItem><SelectItem value="D">D — Desirable</SelectItem></SelectContent>
            </Select>
            <Select value={fsn} onValueChange={setFsn}><SelectTrigger className="w-32"><SelectValue placeholder="FSN" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All FSN</SelectItem><SelectItem value="F">F — Fast</SelectItem><SelectItem value="S">S — Slow</SelectItem><SelectItem value="N">N — Non-moving</SelectItem></SelectContent>
            </Select>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Medicine</TableHead><TableHead>Formulation</TableHead>
                <TableHead>ABC</TableHead><TableHead>VED</TableHead><TableHead>FSN</TableHead>
                <TableHead>Stock</TableHead><TableHead>Set VED</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {list.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>{m.name}<div className="text-xs text-muted-foreground">{m.generic_name}</div></TableCell>
                    <TableCell className="text-xs">{m.formulation} {m.strength}</TableCell>
                    <TableCell><Badge className={ABC_COLORS[m.abc_class || "?"]}>{m.abc_class || "?"}</Badge></TableCell>
                    <TableCell><Badge className={VED_COLORS[m.ved_class || "?"]}>{m.ved_class || "?"}</Badge></TableCell>
                    <TableCell><Badge className={FSN_COLORS[m.fsn_class || "?"]}>{m.fsn_class || "?"}</Badge></TableCell>
                    <TableCell>{Number(m.current_stock)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {["V", "E", "D"].map(v => (
                          <Button key={v} size="sm" variant={m.ved_class === v ? "default" : "outline"} onClick={() => setVedFor(m.id, v)}>{v}</Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="matrix">
          <Card><CardHeader><CardTitle className="text-sm">ABC × VED count matrix (all FSN combined)</CardTitle></CardHeader>
            <CardContent>
              <table className="border-collapse">
                <thead><tr><th className="p-2"></th>{["V", "E", "D", "?"].map(v => <th key={v} className="p-2 text-center w-20"><Badge className={VED_COLORS[v]}>{v}</Badge></th>)}</tr></thead>
                <tbody>
                  {["A", "B", "C", "?"].map(a => (
                    <tr key={a}>
                      <td className="p-2"><Badge className={ABC_COLORS[a]}>{a}</Badge></td>
                      {["V", "E", "D", "?"].map(v => {
                        const total = ["F","S","N","?"].reduce((sum, f) => sum + (cells[`${a}|${v}|${f}`] || 0), 0);
                        return <td key={v} className="p-2 text-center border text-xl font-bold">{total || "·"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-4">
                <strong>A-V</strong> = highest priority (control stock-out, strict reorder). <strong>C-D-N</strong> = candidates for de-listing.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legend">
          <Card><CardContent className="p-4 space-y-3 text-sm">
            <div><strong>ABC (consumption value):</strong> A = top 70% value, B = next 20%, C = bottom 10%. Auto-calculated.</div>
            <div><strong>VED (clinical criticality):</strong> V = Vital (life-saving), E = Essential, D = Desirable. Manual — set per medicine.</div>
            <div><strong>FSN (movement):</strong> F = Fast (≥30 sales/period), S = Slow (5–29), N = Non-moving (&lt;5). Auto-calculated.</div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
