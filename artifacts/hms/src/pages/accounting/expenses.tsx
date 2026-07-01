import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DocumentIntegration } from "@/components/document-integration";
import { DocumentUpload } from "@/components/document-upload";
import { Plus, FileText, DollarSign, Calendar, User } from "lucide-react";
import { toast } from "sonner";

interface ExpenseEntry {
  id: string;
  date: string;
  category: "utilities" | "maintenance" | "supplies" | "travel" | "meals" | "other";
  vendor: string;
  amount: number;
  description: string;
  approvedBy?: string;
  documentId?: string;
}

const EXPENSE_CATEGORIES = [
  "utilities",
  "maintenance",
  "supplies",
  "travel",
  "meals",
  "other",
];

const categoryLabels: Record<string, string> = {
  utilities: "Utilities (Electricity, Water, etc.)",
  maintenance: "Maintenance & Repairs",
  supplies: "Office Supplies",
  travel: "Travel & Transport",
  meals: "Meals & Catering",
  other: "Other Expenses",
};

export default function AccountingExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("utilities");
  const [newExpense, setNewExpense] = useState({
    date: new Date().toISOString().split("T")[0],
    vendor: "",
    amount: "",
    description: "",
  });

  const handleAddExpense = () => {
    if (!newExpense.vendor || !newExpense.amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    const expense: ExpenseEntry = {
      id: `EXP-${Date.now()}`,
      date: newExpense.date,
      category: selectedCategory as ExpenseEntry["category"],
      vendor: newExpense.vendor,
      amount: parseFloat(newExpense.amount),
      description: newExpense.description,
    };

    setExpenses([expense, ...expenses]);
    setNewExpense({ date: new Date().toISOString().split("T")[0], vendor: "", amount: "", description: "" });
    setShowForm(false);
    toast.success("Expense added");
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const categoryTotals = EXPENSE_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="pb-2">
        <h2 className="text-2xl font-bold tracking-tight">Accounting & Expenses</h2>
        <p className="text-muted-foreground text-sm">Track all operational expenses and upload supporting documents</p>
      </div>

      <Tabs defaultValue="documents" className="space-y-3">
        <TabsList className="grid w-full max-w-sm grid-cols-3">
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Upload Expense Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200">
                <p className="text-xs text-muted-foreground mb-3">
                  Upload receipts, invoices, bills, and supporting documents for all expenses. Documents are automatically categorized by expense type.
                </p>

                <DocumentUpload
                  category="Expense Receipt"
                  patientId={0}
                  module="Accounting"
                  department="Finance"
                  description="Expense bill or receipt"
                  tags={["expense", "receipt"]}
                  multiple={true}
                />
              </div>

              {/* All Expense Documents */}
              <DocumentIntegration
                patientId={0}
                module="Accounting"
                title="All Expense Documents"
                showUpload={false}
                maxDocuments={100}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold text-red-600">
                  ₹{totalExpenses.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
            {EXPENSE_CATEGORIES.slice(0, 3).map((cat) => (
              <Card key={cat}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground truncate">{categoryLabels[cat]}</p>
                  <p className="text-xl font-bold">
                    ₹{categoryTotals[cat].toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Expense Form */}
          {showForm && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Add New Expense</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input
                      type="date"
                      value={newExpense.date}
                      onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-xs">
                            {categoryLabels[cat]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Vendor / Payee</Label>
                    <Input
                      placeholder="Company or person name"
                      value={newExpense.vendor}
                      onChange={(e) => setNewExpense({ ...newExpense, vendor: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Amount (₹)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input
                    placeholder="Brief description of the expense"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 text-xs" onClick={handleAddExpense}>
                    Add Expense
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!showForm && (
            <Button size="sm" className="h-8 text-xs" onClick={() => setShowForm(true)}>
              <Plus className="w-3 h-3 mr-1" />
              Add Expense
            </Button>
          )}

          {/* Expenses List */}
          {expenses.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Recent Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {expenses.map((expense) => (
                    <div key={expense.id} className="border rounded-lg p-2 hover:bg-muted/50 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs font-medium">{expense.date}</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs">{categoryLabels[expense.category]}</span>
                          </div>
                          <p className="text-xs font-medium">{expense.vendor}</p>
                          {expense.description && (
                            <p className="text-xs text-muted-foreground mt-1">{expense.description}</p>
                          )}
                        </div>
                        <div className="text-right ml-2">
                          <p className="font-bold text-sm">
                            ₹{expense.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EXPENSE_CATEGORIES.map((cat) => (
              <Card key={cat}>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {categoryLabels[cat]}
                    </p>
                    <div className="flex items-end justify-between">
                      <p className="text-2xl font-bold">
                        ₹{categoryTotals[cat].toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {expenses.filter(e => e.category === cat).length} entries
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Category-wise Documents */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Documents by Expense Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {EXPENSE_CATEGORIES.map((cat) => (
                <div key={cat} className="border rounded-lg p-3">
                  <p className="text-xs font-semibold mb-2">{categoryLabels[cat]}</p>
                  <DocumentIntegration
                    patientId={0}
                    module="Accounting"
                    title={`${categoryLabels[cat]} Documents`}
                    showUpload={false}
                    maxDocuments={10}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
