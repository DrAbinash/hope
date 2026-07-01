import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Share2, Wallet, BarChart3, ArrowRight } from "lucide-react";

export default function ReferralsHub() {
  const { data: summary } = useQuery({
    queryKey: ["/api/referral-payouts", "summary"],
    queryFn: async () => {
      const r = await fetch("/api/referral-payouts", { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ summary: { total: number; pending: number; paid: number; count: number } }>;
    },
  });
  const { data: docs } = useQuery({
    queryKey: ["/api/referral-doctors"],
    queryFn: async () => {
      const r = await fetch("/api/referral-doctors", { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ doctors: any[] }>;
    },
  });

  const safeDoctors = Array.isArray(docs?.doctors) ? docs.doctors : [];
  const summaryData = summary?.summary || { total: 0, pending: 0, paid: 0, count: 0 };

  const tiles = [
    { href: "/referrals/doctors", title: "Referral Doctors", desc: "Manage referral doctors & payment configuration", icon: Share2, color: "bg-blue-50 text-blue-700" },
    { href: "/referrals/payouts", title: "Referral Shares", desc: "Record and pay out referral shares", icon: Wallet, color: "bg-emerald-50 text-emerald-700" },
    { href: "/referrals/report", title: "Share Report", desc: "Doctor-wise summary of services & payouts", icon: BarChart3, color: "bg-purple-50 text-purple-700" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Referral Doctor Module</h1>
          <p className="text-muted-foreground text-sm">Track referrals and compute share-based payouts (% of services or fixed amount).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Active Referral Doctors</div><div className="text-2xl font-semibold mt-1">{safeDoctors.filter((d: any) => d.isActive).length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Shares (records)</div><div className="text-2xl font-semibold mt-1">{summaryData.count}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pending Payout</div><div className="text-2xl font-semibold mt-1 text-amber-700">₹{summaryData.pending.toLocaleString("en-IN")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Paid (Total)</div><div className="text-2xl font-semibold mt-1 text-emerald-700">₹{summaryData.paid.toLocaleString("en-IN")}</div></CardContent></Card>
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
