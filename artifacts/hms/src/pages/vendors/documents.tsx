import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentIntegration } from "@/components/document-integration";
import { DocumentUpload } from "@/components/document-upload";
import { Search, FileText, Tag } from "lucide-react";

interface Vendor {
  id: number;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
}

export default function VendorDocumentsPage() {
  const [search, setSearch] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const { data: vendors, isLoading } = useQuery<Vendor[]>({
    queryKey: ["vendors", search],
    queryFn: async () => {
      const r = await fetch(`/api/vendors?search=${encodeURIComponent(search)}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to fetch vendors");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const vendorList = vendors || [];

  return (
    <div className="space-y-4">
      <div className="pb-2">
        <h2 className="text-2xl font-bold tracking-tight">Vendor Bills & Documents</h2>
        <p className="text-muted-foreground text-sm">Manage vendor invoices, purchase orders, and supporting documents</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Vendors List */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Vendors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search vendor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-8 text-xs"
                />
              </div>

              {isLoading ? (
                <p className="text-xs text-muted-foreground py-4">Loading...</p>
              ) : vendorList.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No vendors found</p>
              ) : (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {vendorList.map((vendor) => (
                    <div
                      key={vendor.id}
                      onClick={() => setSelectedVendor(vendor)}
                      className={`p-2 border rounded-lg cursor-pointer transition text-xs ${
                        selectedVendor?.id === vendor.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      <p className="font-semibold truncate">{vendor.name}</p>
                      {vendor.contactPerson && (
                        <p className="text-muted-foreground truncate">{vendor.contactPerson}</p>
                      )}
                      {vendor.phone && (
                        <p className="text-muted-foreground truncate">{vendor.phone}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Vendor Details & Documents */}
        <div className="lg:col-span-2 space-y-3">
          {selectedVendor ? (
            <>
              {/* Vendor Info Card */}
              <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
                <CardContent className="p-3 pt-4">
                  <p className="font-bold text-base">{selectedVendor.name}</p>
                  <div className="text-xs text-muted-foreground space-y-1 mt-2">
                    {selectedVendor.contactPerson && (
                      <p>Contact: {selectedVendor.contactPerson}</p>
                    )}
                    {selectedVendor.phone && <p>Phone: {selectedVendor.phone}</p>}
                    {selectedVendor.email && <p>Email: {selectedVendor.email}</p>}
                    {selectedVendor.gstNumber && <p>GST: {selectedVendor.gstNumber}</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Document Upload & Tabs */}
              <Tabs defaultValue="upload" className="space-y-3">
                <TabsList className="grid w-full max-w-sm grid-cols-2">
                  <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
                </TabsList>

                <TabsContent value="upload">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Upload Vendor Documents
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-3">
                        Upload invoices, purchase orders, payment receipts, and other vendor documents.
                      </p>
                      <DocumentUpload
                        category="Vendor Invoice"
                        patientId={selectedVendor.id}
                        module="Pharmacy"
                        department="Vendor Purchases"
                        tags={["vendor-invoice", `vendor-${selectedVendor.id}`]}
                        multiple={true}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="documents">
                  <DocumentIntegration
                    patientId={selectedVendor.id}
                    module="Pharmacy"
                    title={`${selectedVendor.name} - All Documents`}
                    showUpload={true}
                    maxDocuments={30}
                  />
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card className="h-96 flex items-center justify-center">
              <div className="text-center space-y-3">
                <Tag className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">Select a vendor to view and manage documents</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
