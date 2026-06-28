import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScanLine, Check, X, AlertCircle, Search } from "lucide-react";
import { toast } from "sonner";

type Medicine = { id: number; name: string; generic_name?: string; formulation?: string; strength?: string; mrp?: number; barcode?: string };
type Batch = { id: number; batch_no: string; expiry_date?: string; mrp?: number; qty_in_stock?: number };

export default function BarcodeScanPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ medicine: Medicine; batches: Batch[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanLog, setScanLog] = useState<any[]>([]);
  const [scanType, setScanType] = useState<"dispense" | "receive" | "verify">("dispense");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); refreshLog(); }, []);

  async function refreshLog() {
    try {
      const r = await fetch("/api/pharmacy/barcode/log?limit=50", { credentials: "include" });
      if (r.ok) setScanLog(await r.json());
    } catch {}
  }

  async function resolve(barcode: string) {
    if (!barcode.trim()) return;
    setError(null); setResult(null);
    try {
      const r = await fetch(`/api/pharmacy/barcode/resolve/${encodeURIComponent(barcode.trim())}`, { credentials: "include" });
      if (!r.ok) {
        const j = await r.json();
        setError(j.error || "Not found");
        await fetch("/api/pharmacy/barcode/log", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode: barcode.trim(), scan_type: scanType, result: "not_found" }),
        });
        toast.error(`Barcode "${barcode}" not recognised`);
      } else {
        const data = await r.json();
        setResult(data);
        await fetch("/api/pharmacy/barcode/log", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode: barcode.trim(), scan_type: scanType, medicine_id: data.medicine.id, result: "success" }),
        });
        toast.success(`✓ ${data.medicine.name}`);
      }
      setCode("");
      inputRef.current?.focus();
      refreshLog();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); resolve(code); }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ScanLine className="h-6 w-6" /> Barcode / QR Scan</h1>
        <div className="flex gap-2">
          {(["dispense", "receive", "verify"] as const).map(t => (
            <Button key={t} size="sm" variant={scanType === t ? "default" : "outline"} onClick={() => setScanType(t)} data-testid={`scan-mode-${t}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Scan or type barcode → press Enter</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={onKey}
              placeholder="Scan barcode here..."
              className="font-mono text-lg"
              autoFocus
              data-testid="barcode-input"
            />
            <Button onClick={() => resolve(code)} data-testid="scan-resolve"><Search className="h-4 w-4 mr-1" /> Look up</Button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Mode: <Badge variant="secondary">{scanType}</Badge> — every scan is logged for audit.
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4 flex items-center gap-2 text-red-700">
            <X className="h-5 w-5" /> {error}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <Check className="h-5 w-5" /> {result.medicine.name}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {result.medicine.generic_name && <>Generic: {result.medicine.generic_name} · </>}
              {result.medicine.formulation} {result.medicine.strength} · MRP ₹{result.medicine.mrp}
            </div>
          </CardHeader>
          <CardContent>
            <h3 className="font-medium mb-2">Available batches ({result.batches.length})</h3>
            {result.batches.length === 0 ? (
              <p className="text-amber-700 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> No active stock</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Batch</TableHead><TableHead>Expiry</TableHead><TableHead>MRP</TableHead><TableHead>Stock</TableHead></TableRow></TableHeader>
                <TableBody>
                  {result.batches.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono">{b.batch_no}</TableCell>
                      <TableCell>{b.expiry_date || "—"}</TableCell>
                      <TableCell>₹{b.mrp}</TableCell>
                      <TableCell><Badge>{b.qty_in_stock}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="log">
        <TabsList>
          <TabsTrigger value="log">Recent Scans ({scanLog.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="log">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Time</TableHead><TableHead>Barcode</TableHead><TableHead>Mode</TableHead>
                  <TableHead>Medicine</TableHead><TableHead>Result</TableHead><TableHead>By</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {scanLog.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs">{new Date(s.created_at).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{s.barcode}</TableCell>
                      <TableCell><Badge variant="outline">{s.scan_type}</Badge></TableCell>
                      <TableCell>{s.medicine_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.result === "success" ? "default" : "destructive"}>{s.result}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{s.scanned_by_name}</TableCell>
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
