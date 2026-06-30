import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Pill, User, IndianRupee, FileText } from "lucide-react";

interface Entity {
  id: number;
  name: string;
  type: string;
  owner: string;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  mobile: string | null;
  email: string | null;
}

interface EntitySummary {
  entityId: number;
  entityName: string;
  entityType: string;
  owner: string;
  totalRevenue: number;
  totalCollection: number;
  totalOutstanding: number;
  invoiceCount: number;
}

export default function EntitiesPage() {
  const { data: entities, isLoading: entitiesLoading } = useQuery<Entity[]>({
    queryKey: ["/api/entities"],
    queryFn: async () => {
      const r = await fetch("/api/entities", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch entities");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: summaries, isLoading: summaryLoading } = useQuery<EntitySummary[]>({
    queryKey: ["/api/entities/summary"],
    queryFn: async () => {
      const r = await fetch("/api/entities/summary", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch summaries");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const isLoading = entitiesLoading || summaryLoading;
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const safeEntities = Array.isArray(entities) ? entities : [];
  const safeSummaries = Array.isArray(summaries) ? summaries : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Legal Entities</h2>
        <p className="text-muted-foreground text-sm">
          Hospital and Pharmacy operate as separate legal/financial entities. All bills, ledgers and inventory are tagged by <code className="text-xs bg-muted px-1 py-0.5 rounded">entity_id</code>.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {safeEntities.map((entity) => {
            const summary = safeSummaries.find((s) => s.entityId === entity.id);
            const isHospital = entity.type === "hospital";
            const Icon = isHospital ? Building2 : Pill;
            const accent = isHospital ? "text-blue-600" : "text-emerald-600";
            const bgAccent = isHospital ? "bg-blue-50 dark:bg-blue-950/30" : "bg-emerald-50 dark:bg-emerald-950/30";

            return (
              <Card key={entity.id} className="overflow-hidden">
                <CardHeader className={`${bgAccent} border-b`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-md bg-background ${accent}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{entity.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="capitalize">
                            {entity.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" /> {entity.owner}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>ID #{entity.id}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">GSTIN</div>
                      <div className="font-mono text-xs">{entity.gstin || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">PAN</div>
                      <div className="font-mono text-xs">{entity.pan || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Mobile</div>
                      <div>{entity.mobile || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Email</div>
                      <div>{entity.email || "—"}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs text-muted-foreground">Address</div>
                      <div>{entity.address || "—"}</div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="text-xs font-medium uppercase text-muted-foreground mb-2">
                      Financial Summary
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/40 rounded p-3">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <IndianRupee className="w-3 h-3" /> Revenue
                        </div>
                        <div className="text-lg font-semibold">{fmt(summary?.totalRevenue || 0)}</div>
                      </div>
                      <div className="bg-muted/40 rounded p-3">
                        <div className="text-xs text-muted-foreground">Collection</div>
                        <div className="text-lg font-semibold text-green-600">
                          {fmt(summary?.totalCollection || 0)}
                        </div>
                      </div>
                      <div className="bg-muted/40 rounded p-3">
                        <div className="text-xs text-muted-foreground">Outstanding</div>
                        <div className="text-lg font-semibold text-red-600">
                          {fmt(summary?.totalOutstanding || 0)}
                        </div>
                      </div>
                      <div className="bg-muted/40 rounded p-3">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Invoices
                        </div>
                        <div className="text-lg font-semibold">{summary?.invoiceCount || 0}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Entity Separation Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong className="text-foreground">Patients are shared</strong> — the same UHID (e.g.{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">HOPE00573</code>) can buy medicines from the
            Pharmacy and receive treatment in the Hospital without duplicate registration.
          </p>
          <p>
            <strong className="text-foreground">Books are separate</strong> — every invoice, voucher, ledger,
            inventory item and pharmacy sale carries an <code className="text-xs bg-muted px-1 py-0.5 rounded">entity_id</code> so
            P&amp;L, Trial Balance and Tally exports can be generated per legal entity.
          </p>
          <p>
            <strong className="text-foreground">Inter-entity flow</strong> — when the hospital buys medicines
            from the pharmacy for an IPD patient, it creates an <strong>inter-entity settlement</strong>
            voucher: Pharmacy books a sale, Hospital books an expense + payable.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
