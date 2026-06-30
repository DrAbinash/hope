import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Handshake, Wallet, BarChart3, ArrowRight } from "lucide-react";

export default function ConsultantsHub() {
  const { data: summary } = useQuery({
    queryKey: ["/api/consultant-engagements", "summary"],
    queryFn: async () => {
      const r = await fetch("/api/consultant-engagements", { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ summary: { total: number; pending: number; paid: number; count: number } }>;
    },
  });
  const { data: consultants } = useQuery({
    queryKey: ["/api/consultants"],
    queryFn: async () => {
      const r = await fetch("/api/consultants", { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ consultants: any[] }>;
    },
  });

  const tiles = [
    { href: "/consultants/list", title: "Consultants", desc: "Manage on-job consultants & payment configuration", icon: Handshake, color: "bg-violet-50 text-violet-700" },
    { href: "/consultants/engagements", title: "Engagements & Payouts", desc: "Record consultant work and pay them out", icon: Wallet, color: "bg-emerald-50 text-emerald-700" },
    { href: "/consultants/report", title: "Consultant Report", desc: "Consultant-wise summary of services & payouts", icon: BarChart3, color: "bg-amber-50 text-amber-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Consultant on Job Module</h1>
        <p className="text-muted-foreground text-sm">Track external consultants engaged on cases. Payment by % of services or fixed amount.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Active Consultants</div><div className="text-2xl font-semibold mt-1">{(Array.isArray(consultants?.consultants) ? consultants.consultants : []).filter((c: any) => c.isActive).length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Engagements</div><div className="text-2xl font-semibold mt-1">{summary?.summary?.count ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pending Payout</div><div className="text-2xl font-semibold mt-1 text-amber-700">₹{(summary?.summary?.pending ?? 0).toLocaleString("en-IN")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Paid (Total)</div><div className="text-2xl font-semibold mt-1 text-emerald-700">₹{(summary?.summary?.paid ?? 0).toLocaleString("en-IN")}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${t.color} mb-3`}>
                  <t.icon className="w-5 h-5" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{t.title}</div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="text-sm text-muted-foreground mt-1">{t.desc}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
