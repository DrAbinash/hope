import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PieChart, BedDouble, Stethoscope, Pill, ClipboardList, FileText,
  Receipt, Wallet, Share2, Users, Activity, BarChart3, ChevronRight,
} from "lucide-react";

type Item = { name: string; href?: string; available?: boolean };
type Section = { title: string; icon: any; tone: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    title: "Finance Reports", icon: Wallet, tone: "text-emerald-600",
    items: [
      { name: "Daily Collection Report", href: "/collection-report", available: true },
      { name: "Consolidated Report", href: "/reports?tab=financial", available: true },
      { name: "Discount Report", href: "/discounts", available: true },
      { name: "Doctor Wise Revenue", href: "/reports?tab=doctor", available: true },
      { name: "Head Wise Business" },
      { name: "Service Wise Collection" },
      { name: "Patient Billing Record" },
      { name: "User Wise Collection" },
      { name: "Refund Report" },
      { name: "Dues Patient List" },
      { name: "Doctor Wise Service Taken" },
      { name: "Daily Service Report" },
      { name: "All Patho & Radio Bill" },
      { name: "Doctor Wise OPD/IPD Report", href: "/reports?tab=opdipd", available: true },
      { name: "Overall Pathology Report" },
      { name: "Overall Radiology Report" },
      { name: "Census Report" },
      { name: "TAT Report" },
      { name: "Hospital Report", href: "/reports/hospital-stats", available: true },
    ],
  },
  {
    title: "IP Pharmacy Reports", icon: Pill, tone: "text-violet-600",
    items: [
      { name: "Issued-Medicines-Report" },
      { name: "Medicine Purchase Report" },
      { name: "IP Purchase Payment" },
      { name: "IP Payment History" },
    ],
  },
  {
    title: "Audit Report", icon: Activity, tone: "text-amber-600",
    items: [
      { name: "Total Revenue (No Pharmacy)" },
      { name: "Stock-on-Hand", href: "/reports/stock", available: true },
      { name: "Expiry Tracker", href: "/reports/stock", available: true },
      { name: "Reorder List", href: "/reports/stock", available: true },
      { name: "Stock Movement", href: "/reports/stock", available: true },
      { name: "Issued-Medicines List", href: "/reports/pharmacy", available: true },
      { name: "Medicine Purchase", href: "/reports/pharmacy", available: true },
      { name: "IP Payment History", href: "/reports/pharmacy", available: true },
      { name: "Outstanding Receivables", href: "/reports/patient-ledger", available: true },
      { name: "Patient Statement", href: "/reports/patient-ledger", available: true },
      { name: "Receipt-Details-Non-Pharmacy", href: "/reports/finance", available: true },
      { name: "Daily Service Report", href: "/reports/finance", available: true },
      { name: "Doctor-Wise Service Taken", href: "/reports/finance", available: true },
      { name: "Doctor Performance / Productivity", href: "/reports/doctor-performance", available: true },
      { name: "Department-wise Revenue & Service Mix", href: "/reports/department-revenue", available: true },
      { name: "Collection & Return Details" },
      { name: "Service Wise Report", href: "/reports/finance", available: true },
      { name: "GST Output (Sales)", href: "/reports/gst", available: true },
      { name: "GST Input (Purchases)", href: "/reports/gst", available: true },
      { name: "Net GST Liability", href: "/reports/gst", available: true },
      { name: "Total Revenue (Pharmacy)" },
    ],
  },
  {
    title: "OPD Reports", icon: Stethoscope, tone: "text-blue-600",
    items: [
      { name: "OPD Bill Record", href: "/reports/opd", available: true },
      { name: "OPD Patient", href: "/reports/opd", available: true },
      { name: "OPD To IPD", href: "/reports/opd", available: true },
      { name: "Consultant-Specific Report", href: "/reports/opd", available: true },
    ],
  },
  {
    title: "IPD Reports", icon: BedDouble, tone: "text-rose-600",
    items: [
      { name: "Admitted Patient List", href: "/reports/ipd", available: true },
      { name: "Admission Log By Date", href: "/reports/ipd", available: true },
      { name: "In Patient Due", href: "/reports/ipd", available: true },
      { name: "DP Dues Report", href: "/reports/ipd", available: true },
      { name: "Discharge Log", href: "/reports/ipd", available: true },
      { name: "Discharge Log by Date", href: "/reports/ipd", available: true },
      { name: "IPD Package Details", href: "/reports/ipd", available: true },
    ],
  },
  {
    title: "DayCare Reports", icon: ClipboardList, tone: "text-cyan-600",
    items: [{ name: "DayCare Patients" }, { name: "DayCare Billing" }],
  },
  {
    title: "Emergency Report", icon: Activity, tone: "text-red-600",
    items: [{ name: "Emergency Patient List" }, { name: "Emergency Billing" }],
  },
  {
    title: "OT Reports", icon: ClipboardList, tone: "text-indigo-600",
    items: [{ name: "OT Schedule" }, { name: "OT Done" }, { name: "OT Charges" }],
  },
  {
    title: "Lab Reports", icon: FileText, tone: "text-teal-600",
    items: [{ name: "Pathology Bills" }, { name: "Radiology Bills" }],
  },
  {
    title: "Procedure Reports", icon: ClipboardList, tone: "text-fuchsia-600",
    items: [
      { name: "Procedure Bill Wise Report" },
      { name: "Procedure List" },
      { name: "Consultant-Specific Report" },
    ],
  },
  {
    title: "TPA Report", icon: Receipt, tone: "text-sky-600",
    items: [{ name: "TPA Claims", href: "/insurance", available: true }],
  },
  {
    title: "Referral Report", icon: Share2, tone: "text-orange-600",
    items: [{ name: "Referrals", href: "/referrals", available: true }],
  },
  {
    title: "Registered Patient", icon: Users, tone: "text-slate-600",
    items: [{ name: "Patient Register", href: "/patients", available: true }],
  },
  {
    title: "Hospital Statistics", icon: BarChart3, tone: "text-green-600",
    items: [
      { name: "Average Occupancy", href: "/reports/hospital-stats", available: true },
      { name: "Daily Bed Occupancy", href: "/reports/hospital-stats", available: true },
      { name: "Daily Case Register", href: "/reports/hospital-stats", available: true },
    ],
  },
];

export default function ReportsHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><PieChart className="h-6 w-6" /> Reports</h2>
        <p className="text-muted-foreground text-sm">Browse all available reports. Greyed items are coming soon.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.title}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className={`h-5 w-5 ${s.tone}`} />
                  <span>{s.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <ul className="space-y-1 text-sm">
                  {s.items.map(it => (
                    <li key={it.name}>
                      {it.available && it.href ? (
                        <Link href={it.href} className="flex items-center justify-between hover:bg-accent rounded px-2 py-1 -mx-2">
                          <span className="flex items-center gap-2"><ChevronRight className="h-3 w-3 text-muted-foreground" /> {it.name}</span>
                          <Badge variant="default" className="text-[10px]">Open</Badge>
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between px-2 py-1 -mx-2 text-muted-foreground">
                          <span className="flex items-center gap-2"><ChevronRight className="h-3 w-3" /> {it.name}</span>
                          <Badge variant="outline" className="text-[10px]">Soon</Badge>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
