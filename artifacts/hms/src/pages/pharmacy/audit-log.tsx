import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, ChevronRight } from "lucide-react";

const j = async (url: string) => {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Request failed");
  return r.json();
};
const today = () => new Date().toISOString().slice(0, 10);

const ACTION_COLORS: Record<string, string> = {
  batch_add: "bg-blue-100 text-blue-800",
  batch_edit: "bg-indigo-100 text-indigo-800",
  sales_return_create: "bg-yellow-100 text-yellow-800",
  sales_return_complete: "bg-green-100 text-green-800",
  shift_close: "bg-gray-100 text-gray-800",
  stock_adjust: "bg-orange-100 text-orange-800",
  ndps_sale: "bg-red-100 text-red-800",
};

const ACTION_LABELS: Record<string, string> = {
  batch_add: "Batch Added",
  batch_edit: "Batch Edited",
  sales_return_create: "Sales Return Created",
  sales_return_complete: "Sales Return Processed",
  shift_close: "Shift Closed",
  stock_adjust: "Stock Adjusted",
  ndps_sale: "NDPS Sale",
};

export default function PharmacyAuditLogPage() {
  const [from, setFrom] = useState(today().slice(0, 7) + "-01");
  const [to, setTo] = useState(today());
  const [actionType, setActionType] = useState("all");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<any>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["pharmacy-audit", from, to, actionType, page],
    queryFn: () => j(
      `/api/pharmacy/audit-log?from=${from}&to=${to}&page=${page}&limit=50` +
      (actionType !== "all" ? `&actionType=${actionType}` : "")
    ),
  });

  const entries = data?.items || [];
  const totalPages = Math.ceil((data?.total || 0) / 50);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />Pharmacy Audit Log
        </h2>
        <p className="text-muted-foreground text-sm">Complete audit trail for all pharmacy actions</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Action Type</Label>
              <Select value={actionType} onValueChange={v => { setActionType(v); setPage(1); }}>
                <SelectTrigger className="w-48 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="batch_add">Batch Added</SelectItem>
                  <SelectItem value="batch_edit">Batch Edited</SelectItem>
                  <SelectItem value="sales_return_create">Sales Return Created</SelectItem>
                  <SelectItem value="sales_return_complete">Sales Return Processed</SelectItem>
                  <SelectItem value="shift_close">Shift Closed</SelectItem>
                  <SelectItem value="stock_adjust">Stock Adjusted</SelectItem>
                  <SelectItem value="ndps_sale">NDPS Sale</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <Skeleton className="h-40 m-4" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Ref ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No audit entries found.</TableCell></TableRow>
                )}
                {entries.map((e: any) => (
                  <TableRow key={e.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetail(e)}>
                    <TableCell className="text-xs font-mono whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${ACTION_COLORS[e.actionType] || "bg-gray-100 text-gray-700"}`}>
                        {ACTION_LABELS[e.actionType] || e.actionType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{e.entityType?.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm">{e.entityRefId || "—"}</TableCell>
                    <TableCell className="text-sm">{e.userId || "—"}</TableCell>
                    <TableCell>
                      {e.userRole && <Badge variant="outline" className="text-xs capitalize">{e.userRole}</Badge>}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{e.reason || "—"}</TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-sm self-center">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {/* Detail Dialog */}
      {detail && (
        <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Audit Entry #{detail.id}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Action:</span> <Badge className={`text-xs ${ACTION_COLORS[detail.actionType] || ""}`}>{ACTION_LABELS[detail.actionType] || detail.actionType}</Badge></div>
                <div><span className="text-muted-foreground">Entity:</span> {detail.entityType}</div>
                <div><span className="text-muted-foreground">Ref ID:</span> {detail.entityRefId || "—"}</div>
                <div><span className="text-muted-foreground">User:</span> {detail.userId || "—"}</div>
                <div><span className="text-muted-foreground">Role:</span> {detail.userRole || "—"}</div>
                <div><span className="text-muted-foreground">IP:</span> {detail.ipAddress || "—"}</div>
              </div>
              {detail.reason && <div><span className="text-muted-foreground">Reason:</span> {detail.reason}</div>}
              {detail.newValue && (
                <div>
                  <p className="text-muted-foreground mb-1">New Value:</p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">{JSON.stringify(detail.newValue, null, 2)}</pre>
                </div>
              )}
              {detail.oldValue && (
                <div>
                  <p className="text-muted-foreground mb-1">Old Value:</p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">{JSON.stringify(detail.oldValue, null, 2)}</pre>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
