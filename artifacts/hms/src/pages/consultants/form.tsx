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

export default function ConsultantForm() {
  const [, navigate] = useLocation();
  const [matchEdit, params] = useRoute<{ id: string }>("/consultants/:id/edit");
  const id = matchEdit ? parseInt(params.id) : null;
  const isEdit = !!id;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<any>({
    name: "", specialization: "", qualification: "", phone: "", email: "",
    registrationNo: "", paymentType: "percentage", paymentValue: "10", notes: "", isActive: true,
  });
  const [saving, setSaving] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["/api/consultants", id],
    enabled: isEdit,
    queryFn: async () => {
      const r = await fetch(`/api/consultants/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });
  useEffect(() => {
    if (existing) setForm({
      name: existing.name || "", specialization: existing.specialization || "", qualification: existing.qualification || "",
      phone: existing.phone || "", email: existing.email || "",
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
      const url = isEdit ? `/api/consultants/${id}` : `/api/consultants`;
      const method = isEdit ? "PUT" : "POST";
      const r = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, paymentValue: v }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      qc.invalidateQueries({ queryKey: ["/api/consultants"] });
      toast({ title: isEdit ? "Consultant updated" : "Consultant created" });
      navigate("/consultants/list");
    } catch (e: any) { toast({ title: "Save failed", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{isEdit ? "Edit Consultant" : "Add Consultant"}</h1>
        <Link href="/consultants/list"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-1"/>Back</Button></Link>
      </div>

      <Card><CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Specialization</Label><Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} /></div>
          <div><Label>Qualification</Label><Input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} placeholder="e.g. MBBS, MD"/></div>
          <div><Label>Registration No.</Label><Input value={form.registrationNo} onChange={(e) => setForm({ ...form, registrationNo: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
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
              ? "Consultant is paid this % of every service amount on each engagement."
              : "Consultant is paid this fixed amount per engagement."}
          </p>
        </div>

        <div><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => navigate("/consultants/list")}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : isEdit ? "Update" : "Create"}</Button>
        </div>
      </CardContent></Card>
    </div>
  );
}
