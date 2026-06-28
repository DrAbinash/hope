import { useEffect, useState } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

export default function ReferralDoctorForm() {
  const [, navigate] = useLocation();
  const [matchEdit, params] = useRoute<{ id: string }>("/referrals/doctors/:id/edit");
  const id = matchEdit ? parseInt(params.id) : null;
  const isEdit = !!id;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<any>({
    name: "", specialization: "", qualification: "", phone: "", email: "", address: "",
    registrationNo: "", paymentType: "percentage", paymentValue: "10", notes: "", isActive: true,
  });
  const [saving, setSaving] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["/api/referral-doctors", id],
    enabled: isEdit,
    queryFn: async () => {
      const r = await fetch(`/api/referral-doctors/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });
  useEffect(() => {
    if (existing) setForm({
      name: existing.name || "", specialization: existing.specialization || "", qualification: existing.qualification || "",
      phone: existing.phone || "", email: existing.email || "", address: existing.address || "",
      registrationNo: existing.registrationNo || "", paymentType: existing.paymentType || "percentage",
      paymentValue: String(existing.paymentValue ?? "0"), notes: existing.notes || "", isActive: existing.isActive !== false,
    });
  }, [existing]);

  async function submit() {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    const v = Number(form.paymentValue);
    if (Number.isNaN(v) || v < 0) { toast({ title: "Invalid payment value", variant: "destructive" }); return; }
    if (form.paymentType === "percentage" && v > 100) { toast({ title: "Percentage cannot exceed 100", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const url = isEdit ? `/api/referral-doctors/${id}` : `/api/referral-doctors`;
      const method = isEdit ? "PUT" : "POST";
      const r = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, paymentValue: v }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      qc.invalidateQueries({ queryKey: ["/api/referral-doctors"] });
      toast({ title: isEdit ? "Referral doctor updated" : "Referral doctor created" });
      navigate("/referrals/doctors");
    } catch (e: any) { toast({ title: "Save failed", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{isEdit ? "Edit Referral Doctor" : "Add Referral Doctor"}</h1>
        <Link href="/referrals/doctors"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-1"/>Back</Button></Link>
      </div>

      <Card><CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Specialization</Label><Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} /></div>
          <div><Label>Qualification</Label><Input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} placeholder="e.g. MBBS, MD"/></div>
          <div><Label>Registration No.</Label><Input value={form.registrationNo} onChange={(e) => setForm({ ...form, registrationNo: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </div>

        <div className="border-t pt-4">
          <div className="font-semibold mb-2">Payment Configuration</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Payment Type</Label>
              <Select value={form.paymentType} onValueChange={(v) => setForm({ ...form, paymentType: v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">% of Service</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{form.paymentType === "percentage" ? "Percentage (%)" : "Fixed Amount (₹)"}</Label>
              <Input type="number" min="0" step="0.01" value={form.paymentValue} onChange={(e) => setForm({ ...form, paymentValue: e.target.value })} />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active
              </label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {form.paymentType === "percentage"
              ? "Doctor will earn this % of every service amount you record under their name."
              : "Doctor will earn this fixed amount per service recorded under their name."}
          </p>
        </div>

        <div><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => navigate("/referrals/doctors")}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : isEdit ? "Update" : "Create"}</Button>
        </div>
      </CardContent></Card>
    </div>
  );
}
