import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Download, Upload, RotateCcw, Settings } from "lucide-react";

interface TemplateCategory {
  name: string;
  storageKey: string;
  icon: string;
  color: string;
  description: string;
}

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { name: "Medications", storageKey: "medicineTemplates", icon: "💊", color: "red", description: "Medicine quick-select items" },
  { name: "Investigations", storageKey: "investigationTemplates", icon: "🔬", color: "purple", description: "Lab & Radiology tests" },
  { name: "Symptoms", storageKey: "symptomTemplates", icon: "🤒", color: "amber", description: "Patient symptoms" },
  { name: "Findings", storageKey: "findingTemplates", icon: "📋", color: "blue", description: "Physical examination findings" },
  { name: "Follow-ups", storageKey: "followupTemplates", icon: "📅", color: "cyan", description: "Follow-up instructions" },
  { name: "Prescriptions", storageKey: "prescriptionTemplates", icon: "📝", color: "green", description: "Prescription templates" },
];

export default function CentralTemplateManager() {
  const [activeTab, setActiveTab] = useState("Medications");
  const [templates, setTemplates] = useState<Record<string, any>>(() => {
    const all: Record<string, any> = {};
    TEMPLATE_CATEGORIES.forEach(cat => {
      const stored = localStorage.getItem(cat.storageKey);
      all[cat.storageKey] = stored ? JSON.parse(stored) : {};
    });
    return all;
  });

  const [showDialog, setShowDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | null>(null);
  const [newItemName, setNewItemName] = useState("");

  const getCurrentCategory = () => TEMPLATE_CATEGORIES.find(c => c.name === activeTab);
  const currentCategory = getCurrentCategory();
  const currentStorageKey = currentCategory?.storageKey || "";
  const currentItems = templates[currentStorageKey] || {};

  const addItem = () => {
    if (!newItemName.trim() || !currentStorageKey) return;
    const key = newItemName.trim();
    if (currentItems[key]) {
      toast.error("Item already exists");
      return;
    }

    const updated = { ...templates };
    if (Array.isArray(currentItems)) {
      updated[currentStorageKey] = [...currentItems, key];
    } else {
      updated[currentStorageKey] = { ...currentItems, [key]: key };
    }
    setTemplates(updated);
    localStorage.setItem(currentStorageKey, JSON.stringify(updated[currentStorageKey]));
    setNewItemName("");
    toast.success("Item added");
  };

  const removeItem = (itemKey: string) => {
    if (!currentStorageKey) return;
    const updated = { ...templates };
    if (Array.isArray(currentItems)) {
      updated[currentStorageKey] = currentItems.filter((x: string) => x !== itemKey);
    } else {
      const newObj = { ...currentItems };
      delete newObj[itemKey];
      updated[currentStorageKey] = newObj;
    }
    setTemplates(updated);
    localStorage.setItem(currentStorageKey, JSON.stringify(updated[currentStorageKey]));
    toast.success("Item removed");
  };

  const resetToDefaults = () => {
    if (!confirm("Reset this category to defaults? This cannot be undone.")) return;
    localStorage.removeItem(currentStorageKey);
    const updated = { ...templates };
    updated[currentStorageKey] = {};
    setTemplates(updated);
    toast.success("Reset to defaults");
  };

  const exportTemplates = () => {
    const allTemplates: Record<string, any> = {};
    TEMPLATE_CATEGORIES.forEach(cat => {
      const data = localStorage.getItem(cat.storageKey);
      if (data) {
        allTemplates[cat.name] = JSON.parse(data);
      }
    });

    const dataStr = JSON.stringify(allTemplates, null, 2);
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(dataStr));
    element.setAttribute("download", `templates-backup-${new Date().toISOString().split('T')[0]}.json`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Templates exported");
  };

  const importTemplates = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          let imported = 0;
          TEMPLATE_CATEGORIES.forEach(cat => {
            if (data[cat.name]) {
              localStorage.setItem(cat.storageKey, JSON.stringify(data[cat.name]));
              imported++;
            }
          });
          toast.success(`Imported ${imported} template categories`);
          window.location.reload();
        } catch (err) {
          toast.error("Invalid file format");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-500" />
              Template Manager
            </CardTitle>
            <CardDescription>Manage all quick-select templates across the system</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportTemplates} className="rounded-lg">
              <Download className="w-4 h-4 mr-1" /> Export
            </Button>
            <Button size="sm" variant="outline" onClick={importTemplates} className="rounded-lg">
              <Upload className="w-4 h-4 mr-1" /> Import
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-6 w-full mb-4">
            {TEMPLATE_CATEGORIES.map(cat => (
              <TabsTrigger key={cat.storageKey} value={cat.name} className="text-xs">
                <span className="mr-1">{cat.icon}</span>
                <span className="hidden sm:inline">{cat.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {TEMPLATE_CATEGORIES.map(category => (
            <TabsContent key={category.storageKey} value={category.name} className="space-y-3">
              <div className="text-sm text-muted-foreground mb-3">{category.description}</div>

              {/* Add New Item */}
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder={`Add new ${category.name.toLowerCase()}...`}
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  onKeyPress={e => {
                    if (e.key === "Enter" && activeTab === category.name) {
                      addItem();
                    }
                  }}
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setSelectedCategory(category);
                    addItem();
                  }}
                  className={`h-8 bg-${category.color}-700 text-white text-xs rounded-lg`}
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={resetToDefaults}
                  className="h-8 text-xs rounded-lg"
                >
                  <RotateCcw className="w-4 h-4 mr-1" /> Reset
                </Button>
              </div>

              {/* Items Grid */}
              <div className={`grid grid-cols-2 gap-2 p-3 bg-${category.color}-50 dark:bg-${category.color}-950/20 rounded-lg max-h-64 overflow-y-auto`}>
                {Array.isArray(currentItems) ? (
                  currentItems.length === 0 ? (
                    <div className="text-xs text-muted-foreground col-span-2 text-center py-4">
                      No {category.name.toLowerCase()} yet
                    </div>
                  ) : (
                    currentItems.map((item: string) => (
                      <div key={item} className={`flex items-center justify-between gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-${category.color}-200 dark:border-${category.color}-800`}>
                        <span className="text-xs font-medium truncate">{item}</span>
                        <button
                          type="button"
                          onClick={() => removeItem(item)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )
                ) : typeof currentItems === "object" ? (
                  Object.keys(currentItems).length === 0 ? (
                    <div className="text-xs text-muted-foreground col-span-2 text-center py-4">
                      No {category.name.toLowerCase()} yet
                    </div>
                  ) : (
                    Object.keys(currentItems).map((key: string) => (
                      <div key={key} className={`flex items-center justify-between gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-${category.color}-200 dark:border-${category.color}-800`}>
                        <span className="text-xs font-medium truncate">{key}</span>
                        <button
                          type="button"
                          onClick={() => removeItem(key)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )
                ) : null}
              </div>

              {/* Statistics */}
              <div className="text-xs text-muted-foreground">
                {Array.isArray(currentItems)
                  ? `${currentItems.length} ${category.name.toLowerCase()}`
                  : `${Object.keys(currentItems).length} ${category.name.toLowerCase()}`}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
