import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentIntegration } from "@/components/document-integration";
import { DocumentUpload } from "@/components/document-upload";
import { Search, Upload, FileText, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface Expense {
  id: number;
  vendorId: number;
  vendorName: string;
  amount: string;
  category: "purchase" | "maintenance" | "utility" | "other";
  date: string;
  description?: string;
  referenceNo?: string;
  documentId?: string;
}

export default function PharmacyExpensesPage() {
  const [search, setSearch] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<number | null>(null);

  const { data: expenses, isLoading } = useQuery<Expense[]>({
    queryKey: ["pharmacy-expenses", search],
    queryFn: async () => {
      const r = await fetch(`/api/vendors?search=${encodeURIComponent(search)}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to fetch expenses");
      return r.json();
    },
  });

  const expenseList = expenses || [];
  const total = expenseList.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

  const categoryColors = {
    purchase: "bg-blue-100 text-blue-800",
    maintenance: "bg-orange-100 text-orange-800",
    utility: "bg-green-100 text-green-800",
    other: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="space-y-4">
      <div className="pb-2">
        <h2 className="text-2xl font-bold tracking-tight">Pharmacy Expenses & Bills</h2>
        <p className="text-muted-foreground text-sm">Manage vendor bills, purchase orders, and expense documents</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-bold text-blue-600">
              ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Vendors</p>
            <p className="text-2xl font-bold">{new Set(expenseList.map(e => e.vendorId)).size}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Records</p>
            <p className="text-2xl font-bold">{expenseList.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Avg per Entry</p>
            <p className="text-2xl font-bold">
              ₹{expenseList.length > 0 ? (total / expenseList.length).toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "0"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="space-y-3">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="expenses">Expenses List</TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Upload Vendor Bills & Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200">
                <p className="text-xs text-muted-foreground mb-3">
                  Upload vendor bills, purchase invoices, receipts, and supporting documents. All documents are indexed by category and vendor.
                </p>

                <DocumentUpload
                  category="Vendor Bill"
                  patientId={0}
                  module="Pharmacy"
                  department="Pharmacy"
                  description="Vendor bill or purchase invoice"
                  tags={["vendor-bill", "expense"]}
                  multiple={true}
                  showPreview={true}
                />
              </div>

              {/* Pharmacy-wide Document View */}
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold">All Pharmacy Documents</h3>
                <DocumentIntegration
                  patientId={0}
                  module="Pharmacy"
                  title="Vendor Bills & Expense Documents"
                  showUpload={false}
                  maxDocuments={50}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-3">
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search vendor..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-4">Loading...</p>
              ) : expenseList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No expenses found</p>
              ) : (
                <div className="space-y-2">
                  {expenseList.map((expense) => (
                    <div
                      key={expense.id}
                      className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition"
                      onClick={() => setSelectedVendor(expense.vendorId)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-sm">{expense.vendorName}</p>
                          <p className="text-xs text-muted-foreground">{expense.date}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-base">
                            ₹{parseFloat(expense.amount || "0").toLocaleString("en-IN")}
                          </p>
                          <Badge
                            className={`text-xs mt-1 ${
                              categoryColors[expense.category as keyof typeof categoryColors] ||
                              categoryColors.other
                            }`}
                          >
                            {expense.category}
                          </Badge>
                        </div>
                      </div>
                      {expense.description && (
                        <p className="text-xs text-muted-foreground">{expense.description}</p>
                      )}
                      {expense.referenceNo && (
                        <p className="text-xs font-mono text-muted-foreground">Ref: {expense.referenceNo}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vendor Documents */}
          {selectedVendor && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {expenseList.find(e => e.vendorId === selectedVendor)?.vendorName} Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentIntegration
                  patientId={selectedVendor}
                  module="Pharmacy"
                  title={`${expenseList.find(e => e.vendorId === selectedVendor)?.vendorName} - Bills & Documents`}
                  showUpload={true}
                  maxDocuments={20}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
