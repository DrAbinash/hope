import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save, Building2, Sparkles } from "lucide-react";
import { ImageUpload } from "@/components/image-upload";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Entity { id: number; name: string; type: string }
interface Settings {
  id?: number;
  entityId: number;
  hospitalName: string;
  tagline?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  gstin?: string | null;
  pan?: string | null;
  mobile?: string | null;
  email?: string | null;
  website?: string | null;
  billHeader?: string | null;
  billFooter?: string | null;
  termsConditions?: string | null;
  invoicePrefix?: string | null;
  receiptPrefix?: string | null;
  uhidPrefix?: string | null;
  defaultBillType?: string | null;
  logoUrl?: string | null;
  letterheadUrl?: string | null;
  letterheadFooterUrl?: string | null;
  signatureUrl?: string | null;
  prescriptionPrintMode?: string | null;
  aiConfig?: any;
}

function EntitySettingsForm({ entityId }: { entityId: number }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings | null>(null);

  const { data, isLoading } = useQuery<Settings>({
    queryKey: ["/api/hospital-settings", entityId],
    queryFn: async () => {
      const r = await fetch(`/api/hospital-settings/${entityId}`, { credentials: "include" });
      return r.ok ? r.json() : null;
    },
  });

  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/hospital-settings/${entityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Failed to save");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["/api/hospital-settings", entityId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !form) return <div className="space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;

  const upd = (k: keyof Settings, v: string) => setForm({ ...form, [k]: v });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Identity</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Hospital / Pharmacy Name *</Label>
            <Input value={form.hospitalName || ""} onChange={(e) => upd("hospitalName", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Tagline</Label>
            <Input value={form.tagline || ""} onChange={(e) => upd("tagline", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Address</Label>
            <Input value={form.address || ""} onChange={(e) => upd("address", e.target.value)} />
          </div>
          <div><Label>City</Label><Input value={form.city || ""} onChange={(e) => upd("city", e.target.value)} /></div>
          <div><Label>State</Label><Input value={form.state || ""} onChange={(e) => upd("state", e.target.value)} /></div>
          <div><Label>Pincode</Label><Input value={form.pincode || ""} onChange={(e) => upd("pincode", e.target.value)} /></div>
          <div><Label>Mobile</Label><Input value={form.mobile || ""} onChange={(e) => upd("mobile", e.target.value)} /></div>
          <div><Label>Email</Label><Input value={form.email || ""} onChange={(e) => upd("email", e.target.value)} /></div>
          <div><Label>Website</Label><Input value={form.website || ""} onChange={(e) => upd("website", e.target.value)} /></div>
          <div className="col-span-2">
            <Label>Logo</Label>
            <div className="mt-2">
              <ImageUpload
                label="Logo"
                value={form.logoUrl}
                onChange={(p) => setForm({ ...form, logoUrl: p })}
                hint="Image or PDF · shown in the header and shared documents"
                previewClassName="max-h-24"
                allowPdf
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tax & Registration</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div><Label>GSTIN</Label><Input value={form.gstin || ""} onChange={(e) => upd("gstin", e.target.value)} /></div>
          <div><Label>PAN</Label><Input value={form.pan || ""} onChange={(e) => upd("pan", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Document Prefixes</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div><Label>UHID Prefix</Label><Input value={form.uhidPrefix || ""} onChange={(e) => upd("uhidPrefix", e.target.value)} /></div>
          <div><Label>Invoice Prefix</Label><Input value={form.invoicePrefix || ""} onChange={(e) => upd("invoicePrefix", e.target.value)} /></div>
          <div><Label>Receipt Prefix</Label><Input value={form.receiptPrefix || ""} onChange={(e) => upd("receiptPrefix", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pharmacy Billing</CardTitle></CardHeader>
        <CardContent>
          <div>
            <Label>Default Bill Type</Label>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant={(form.defaultBillType || "final") === "final" ? "default" : "outline"}
                size="sm"
                onClick={() => upd("defaultBillType", "final")}
              >Final (payment captured)</Button>
              <Button
                type="button"
                variant={form.defaultBillType === "provisional" ? "default" : "outline"}
                size="sm"
                onClick={() => upd("defaultBillType", "provisional")}
              >Provisional (pay later)</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Default bill type used when creating a new pharmacy sale. Provisional bills decrement stock but are not posted to accounting until finalized with payment.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prescription Print</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Choose the default paper mode and upload header / footer / signature artwork. Images (PNG / JPEG / WebP) and PDF are accepted (max 5MB each).
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label>Default Print Mode</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              <Button
                type="button"
                variant={(form.prescriptionPrintMode || "plain") === "plain" ? "default" : "outline"}
                size="sm"
                onClick={() => upd("prescriptionPrintMode", "plain")}
                data-testid="print-mode-plain"
              >Plain A4 (uploaded letterhead)</Button>
              <Button
                type="button"
                variant={form.prescriptionPrintMode === "letterpad" ? "default" : "outline"}
                size="sm"
                onClick={() => upd("prescriptionPrintMode", "letterpad")}
                data-testid="print-mode-letterpad"
              >Pre-printed Letter Pad</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Plain A4 prints the uploaded header/footer artwork below. Letter Pad mode leaves blank space at top/bottom for pre-printed stationery. Users can still switch on the print preview.
            </p>
          </div>

          <div>
            <Label>Letterhead (top of page)</Label>
            <div className="mt-2">
              <ImageUpload
                label="Letterhead"
                value={form.letterheadUrl}
                onChange={(p) => setForm({ ...form, letterheadUrl: p })}
                hint="Image or PDF · suggested ~1000×220 px"
                previewClassName="max-h-24"
                allowPdf
              />
            </div>
          </div>
          <div>
            <Label>Footer (bottom of page)</Label>
            <div className="mt-2">
              <ImageUpload
                label="Footer"
                value={form.letterheadFooterUrl}
                onChange={(p) => setForm({ ...form, letterheadFooterUrl: p })}
                hint="Image or PDF · suggested ~1000×120 px"
                previewClassName="max-h-20"
                allowPdf
              />
            </div>
          </div>
          <div>
            <Label>Default Signature (bottom-right of prescription)</Label>
            <div className="mt-2">
              <ImageUpload
                label="Signature"
                value={form.signatureUrl}
                onChange={(p) => setForm({ ...form, signatureUrl: p })}
                hint="Image or PDF · used when the doctor has no own signature on file"
                previewClassName="max-h-20"
                allowPdf
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Bill / Receipt Print</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Bill Header (printed at top of invoice)</Label>
            <Textarea rows={2} value={form.billHeader || ""} onChange={(e) => upd("billHeader", e.target.value)} />
          </div>
          <div>
            <Label>Bill Footer (printed at bottom)</Label>
            <Textarea rows={2} value={form.billFooter || ""} onChange={(e) => upd("billFooter", e.target.value)} />
          </div>
          <div>
            <Label>Terms & Conditions</Label>
            <Textarea rows={3} value={form.termsConditions || ""} onChange={(e) => upd("termsConditions", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            AI Clinical Assistant Configuration
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Configure the default AI LLM provider. The system defaults to the local Rule-Engine compiler if not set or offline.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2 text-xs">
            <Label>AI Provider</Label>
            <Select
              value={form.aiConfig?.provider || "mock"}
              onValueChange={(v) => setForm({ ...form, aiConfig: { ...form.aiConfig, provider: v } })}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mock">Local Rule-Engine Compiler (Offline Default)</SelectItem>
                <SelectItem value="openai">OpenAI (Cloud API)</SelectItem>
                <SelectItem value="ollama">Ollama (Local LLM)</SelectItem>
                <SelectItem value="lmstudio">LM Studio / Open WebUI (Local/External API)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.aiConfig?.provider && form.aiConfig.provider !== "mock" && (
            <>
              <div className="text-xs">
                <Label>Model Name</Label>
                <Input
                  className="mt-1"
                  placeholder={form.aiConfig?.provider === "openai" ? "gpt-4o" : "llama3"}
                  value={form.aiConfig?.model || ""}
                  onChange={(e) => setForm({ ...form, aiConfig: { ...form.aiConfig, model: e.target.value } })}
                />
              </div>
              <div className="text-xs">
                <Label>{form.aiConfig?.provider === "openai" ? "API Key" : "API Host / URL"}</Label>
                <Input
                  className="mt-1"
                  type={form.aiConfig?.provider === "openai" ? "password" : "text"}
                  placeholder={form.aiConfig?.provider === "openai" ? "sk-..." : "http://localhost:11434"}
                  value={form.aiConfig?.apiKey || ""}
                  onChange={(e) => setForm({ ...form, aiConfig: { ...form.aiConfig, apiKey: e.target.value } })}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {save.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: entities } = useQuery<Entity[]>({
    queryKey: ["/api/entities"],
    queryFn: async () => {
      const r = await fetch("/api/entities", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch entities");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const safeEntities = Array.isArray(entities) ? entities : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Hospital Settings</h2>
        <p className="text-muted-foreground text-sm">Configure identity, tax info, document prefixes, and bill print templates per entity.</p>
      </div>

      {safeEntities.length > 0 ? (
        <Tabs defaultValue={String(safeEntities[0].id)}>
          <TabsList>
            {safeEntities.map((e) => (
              <TabsTrigger key={e.id} value={String(e.id)} className="gap-2">
                <Building2 className="w-4 h-4" />{e.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {safeEntities.map((e) => (
            <TabsContent key={e.id} value={String(e.id)} className="mt-4">
              <EntitySettingsForm entityId={e.id} />
            </TabsContent>
          ))}
        </Tabs>
      ) : <Skeleton className="h-32" />}
    </div>
  );
}
