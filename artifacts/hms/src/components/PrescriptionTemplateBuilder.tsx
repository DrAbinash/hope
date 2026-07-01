import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Edit3, Trash2, Zap, Settings } from "lucide-react";

interface MedicineTemplate {
  name: string;
  genericName?: string;
  dose: string;
  timing: string;
  frequency: string;
  duration: string;
}

interface TestTemplate {
  name: string;
  type: "lab" | "radiology";
}

interface PrescriptionTemplate {
  id: string;
  name: string;
  description: string;
  chiefComplaints: string[];
  diagnosis: string;
  medicines: MedicineTemplate[];
  labTests: TestTemplate[];
  radiologyTests: TestTemplate[];
  advise: string;
  specialAdvise: string;
  followUpDays: number;
}

// Default prescription templates by condition
const DEFAULT_PRESCRIPTION_TEMPLATES: Record<string, PrescriptionTemplate> = {
  fever: {
    id: "fever",
    name: "Fever",
    description: "Common fever management",
    chiefComplaints: ["Fever", "Chills", "Body ache"],
    diagnosis: "Fever (Viral/Bacterial)",
    medicines: [
      { name: "Paracetamol", genericName: "Acetaminophen", dose: "500mg", timing: "After meals", frequency: "1-1-1", duration: "5 days" },
      { name: "Ibuprofen", genericName: "Ibuprofen", dose: "400mg", timing: "After meals", frequency: "1-0-1", duration: "5 days" },
    ],
    labTests: [
      { name: "CBC", type: "lab" },
      { name: "Blood Culture", type: "lab" },
    ],
    radiologyTests: [],
    advise: "Rest, hydration, light diet",
    specialAdvise: "Monitor temperature, drink plenty of fluids",
    followUpDays: 3,
  },
  cough: {
    id: "cough",
    name: "Cough",
    description: "Acute cough management",
    chiefComplaints: ["Cough", "Throat irritation"],
    diagnosis: "Acute Cough (URTI)",
    medicines: [
      { name: "Cough Syrup", genericName: "Dextromethorphan", dose: "10ml", timing: "After meals", frequency: "3 times", duration: "7 days" },
      { name: "Throat Lozenges", genericName: "Benzocaine", dose: "1 lozenge", timing: "As needed", frequency: "Every 2 hours", duration: "7 days" },
    ],
    labTests: [],
    radiologyTests: [
      { name: "Chest X-Ray", type: "radiology" },
    ],
    advise: "Avoid smoking, stay hydrated",
    specialAdvise: "Seek immediate attention if difficulty breathing",
    followUpDays: 5,
  },
  hypertension: {
    id: "hypertension",
    name: "Hypertension",
    description: "Blood pressure management",
    chiefComplaints: ["High BP", "Headache"],
    diagnosis: "Essential Hypertension",
    medicines: [
      { name: "Amlodipine", genericName: "Amlodipine", dose: "5mg", timing: "Morning", frequency: "Once daily", duration: "Ongoing" },
      { name: "Lisinopril", genericName: "Lisinopril", dose: "10mg", timing: "Morning", frequency: "Once daily", duration: "Ongoing" },
    ],
    labTests: [
      { name: "Lipid Profile", type: "lab" },
      { name: "Renal Panel", type: "lab" },
    ],
    radiologyTests: [],
    advise: "Low salt diet, regular exercise",
    specialAdvise: "Monitor BP daily, avoid stress",
    followUpDays: 30,
  },
  diabetes: {
    id: "diabetes",
    name: "Diabetes Type 2",
    description: "Diabetes management",
    chiefComplaints: ["High blood sugar", "Fatigue"],
    diagnosis: "Type 2 Diabetes Mellitus",
    medicines: [
      { name: "Metformin", genericName: "Metformin", dose: "500mg", timing: "With meals", frequency: "2-2-1", duration: "Ongoing" },
      { name: "Glipizide", genericName: "Glipizide", dose: "5mg", timing: "Before breakfast", frequency: "Once daily", duration: "Ongoing" },
    ],
    labTests: [
      { name: "Fasting Blood Sugar", type: "lab" },
      { name: "HbA1c", type: "lab" },
      { name: "Lipid Profile", type: "lab" },
    ],
    radiologyTests: [],
    advise: "Regular diet plan, daily exercise",
    specialAdvise: "Monitor blood sugar, maintain weight",
    followUpDays: 14,
  },
};

const DEFAULT_MEDICATIONS = [
  "Paracetamol", "Ibuprofen", "Aspirin", "Cough Syrup", "Throat Lozenges",
  "Amlodipine", "Lisinopril", "Metformin", "Glipizide", "Omeprazole",
  "Amoxicillin", "Azithromycin", "Ceftriaxone", "Ciprofloxacin", "Doxycycline",
];

const DEFAULT_LAB_TESTS = [
  "CBC", "Hemoglobin", "Hematocrit", "WBC Count", "Platelet Count",
  "Blood Glucose", "Fasting Blood Sugar", "HbA1c", "Lipid Profile", "LFT",
  "KFT", "Urea", "Creatinine", "Blood Culture", "Urinalysis",
];

const DEFAULT_RADIOLOGY_TESTS = [
  "Chest X-Ray", "Abdominal X-Ray", "CT Scan", "MRI", "Ultrasound", "Echocardiography",
];

interface Props {
  onSelectMedicines?: (medicines: MedicineTemplate[]) => void;
  onSelectTests?: (labTests: TestTemplate[], radiologyTests: TestTemplate[]) => void;
  onSelectPrescription?: (template: PrescriptionTemplate) => void;
}

export default function PrescriptionTemplateBuilder({ onSelectMedicines, onSelectTests, onSelectPrescription }: Props) {
  const [templates, setTemplates] = useState<Record<string, PrescriptionTemplate>>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("prescriptionTemplates");
      return stored ? JSON.parse(stored) : DEFAULT_PRESCRIPTION_TEMPLATES;
    }
    return DEFAULT_PRESCRIPTION_TEMPLATES;
  });

  const [medications, setMedications] = useState<Record<string, MedicineTemplate>>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("medicineTemplates");
      return stored ? JSON.parse(stored) : {};
    }
    return {};
  });

  const [labTests, setLabTests] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("labTestTemplates");
      return stored ? JSON.parse(stored) : DEFAULT_LAB_TESTS;
    }
    return DEFAULT_LAB_TESTS;
  });

  const [radiologyTests, setRadiologyTests] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("radiologyTestTemplates");
      return stored ? JSON.parse(stored) : DEFAULT_RADIOLOGY_TESTS;
    }
    return DEFAULT_RADIOLOGY_TESTS;
  });

  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [selectedMeds, setSelectedMeds] = useState<string[]>([]);
  const [selectedLabTests, setSelectedLabTests] = useState<string[]>([]);
  const [selectedRadTests, setSelectedRadTests] = useState<string[]>([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PrescriptionTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");

  const toggleTemplate = (id: string) => {
    const updated = selectedTemplates.includes(id)
      ? selectedTemplates.filter(x => x !== id)
      : [...selectedTemplates, id];
    setSelectedTemplates(updated);

    if (updated.length > 0) {
      // Merge selected templates
      const mergedMeds: Record<string, MedicineTemplate> = {};
      const mergedLabTests = new Set<string>();
      const mergedRadTests = new Set<string>();
      let mergedAdvice = "";
      let mergedSpecialAdvice = "";
      let maxFollowUp = 0;

      updated.forEach(id => {
        const template = templates[id];
        if (template) {
          template.medicines.forEach(med => {
            mergedMeds[med.name] = med;
          });
          template.labTests.forEach(test => mergedLabTests.add(test.name));
          template.radiologyTests.forEach(test => mergedRadTests.add(test.name));
          mergedAdvice = template.advise || mergedAdvice;
          mergedSpecialAdvice = template.specialAdvise || mergedSpecialAdvice;
          maxFollowUp = Math.max(maxFollowUp, template.followUpDays);
        }
      });

      const finalMeds: MedicineTemplate[] = Object.values(mergedMeds);
      const finalLabTests: TestTemplate[] = Array.from(mergedLabTests).map(name => ({ name, type: "lab" }));
      const finalRadTests: TestTemplate[] = Array.from(mergedRadTests).map(name => ({ name, type: "radiology" }));

      if (onSelectMedicines) onSelectMedicines(finalMeds);
      if (onSelectTests) onSelectTests(finalLabTests, finalRadTests);

      toast.success(`Merged ${updated.length} template(s) - ${finalMeds.length} medicines, ${finalLabTests.length + finalRadTests.length} tests`);
    }
  };

  const toggleMedicine = (med: string) => {
    const updated = selectedMeds.includes(med)
      ? selectedMeds.filter(x => x !== med)
      : [...selectedMeds, med];
    setSelectedMeds(updated);

    const medicineList: MedicineTemplate[] = updated.map(m => ({
      name: m,
      dose: "As prescribed",
      timing: "As per doctor advice",
      frequency: "As per doctor advice",
      duration: "As per doctor advice",
    }));

    if (onSelectMedicines) onSelectMedicines(medicineList);
  };

  const toggleLabTest = (test: string) => {
    const updated = selectedLabTests.includes(test)
      ? selectedLabTests.filter(x => x !== test)
      : [...selectedLabTests, test];
    setSelectedLabTests(updated);

    const testList: TestTemplate[] = updated.map(t => ({ name: t, type: "lab" }));
    if (onSelectTests) onSelectTests(testList, selectedRadTests.map(t => ({ name: t, type: "radiology" })));
  };

  const toggleRadTest = (test: string) => {
    const updated = selectedRadTests.includes(test)
      ? selectedRadTests.filter(x => x !== test)
      : [...selectedRadTests, test];
    setSelectedRadTests(updated);

    const testList: TestTemplate[] = updated.map(t => ({ name: t, type: "radiology" }));
    if (onSelectTests) onSelectTests(selectedLabTests.map(t => ({ name: t, type: "lab" })), testList);
  };

  const addMedicineTemplate = (name: string) => {
    if (!name.trim() || medications[name.trim()]) return;
    const updated = { ...medications, [name.trim()]: { name: name.trim(), dose: "", timing: "", frequency: "", duration: "" } };
    setMedications(updated);
    localStorage.setItem("medicineTemplates", JSON.stringify(updated));
    toast.success("Medicine template added");
  };

  const removeMedicineTemplate = (name: string) => {
    const updated = { ...medications };
    delete updated[name];
    setMedications(updated);
    localStorage.setItem("medicineTemplates", JSON.stringify(updated));
    setSelectedMeds(selectedMeds.filter(x => x !== name));
  };

  const saveTemplate = () => {
    if (!newTemplateName.trim()) {
      toast.error("Template name required");
      return;
    }

    if (editingTemplate) {
      const updated = { ...templates, [editingTemplate.id]: { ...editingTemplate, name: newTemplateName } };
      setTemplates(updated);
      localStorage.setItem("prescriptionTemplates", JSON.stringify(updated));
      toast.success("Template updated");
    } else {
      const id = newTemplateName.toLowerCase().replace(/\s+/g, "-");
      const newTemplate: PrescriptionTemplate = {
        id,
        name: newTemplateName,
        description: "",
        chiefComplaints: [],
        diagnosis: "",
        medicines: selectedMeds.map(m => ({ name: m, dose: "", timing: "", frequency: "", duration: "" })),
        labTests: selectedLabTests.map(t => ({ name: t, type: "lab" })),
        radiologyTests: selectedRadTests.map(t => ({ name: t, type: "radiology" })),
        advise: "",
        specialAdvise: "",
        followUpDays: 7,
      };
      const updated = { ...templates, [id]: newTemplate };
      setTemplates(updated);
      localStorage.setItem("prescriptionTemplates", JSON.stringify(updated));
      toast.success("Template created");
    }

    setNewTemplateName("");
    setEditingTemplate(null);
    setShowTemplateEditor(false);
  };

  const deleteTemplate = (id: string) => {
    const updated = { ...templates };
    delete updated[id];
    setTemplates(updated);
    localStorage.setItem("prescriptionTemplates", JSON.stringify(updated));
    setSelectedTemplates(selectedTemplates.filter(x => x !== id));
    toast.success("Template deleted");
  };

  return (
    <div className="space-y-4">
      {/* Condition-Based Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-500" />
            Quick Prescription Templates
          </CardTitle>
          <CardDescription>Select one or multiple templates to merge</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(templates).map(([id, template]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={selectedTemplates.includes(id) ? "default" : "outline"}
                onClick={() => toggleTemplate(id)}
                className="rounded-lg"
              >
                {template.name}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => { setEditingTemplate(null); setNewTemplateName(""); setShowTemplateEditor(true); }}
            className="text-blue-600"
          >
            <Plus className="w-4 h-4 mr-1" /> Create Template
          </Button>
        </CardContent>
      </Card>

      {/* Medicines Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-red-500" />
              Medicines (Click to Select)
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setShowTemplateEditor(true)}>
              ⚙ Manage
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg max-h-48 overflow-y-auto">
            {DEFAULT_MEDICATIONS.map(med => (
              <button
                key={med}
                type="button"
                onClick={() => toggleMedicine(med)}
                className={`px-3 py-2 text-xs rounded-lg border-2 font-semibold transition ${
                  selectedMeds.includes(med)
                    ? "bg-red-400 text-red-900 border-red-600 shadow-md scale-105"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-red-200 dark:border-red-800 hover:shadow-sm"
                }`}
              >
                {med}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lab Tests Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-500" />
              Lab Tests (Click to Select)
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setShowTemplateEditor(true)}>
              ⚙ Manage
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg max-h-48 overflow-y-auto">
            {labTests.map(test => (
              <button
                key={test}
                type="button"
                onClick={() => toggleLabTest(test)}
                className={`px-3 py-2 text-xs rounded-lg border-2 font-semibold transition ${
                  selectedLabTests.includes(test)
                    ? "bg-green-400 text-green-900 border-green-600 shadow-md scale-105"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-green-200 dark:border-green-800 hover:shadow-sm"
                }`}
              >
                {test}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Radiology Tests Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" />
              Radiology Tests (Click to Select)
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setShowTemplateEditor(true)}>
              ⚙ Manage
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg max-h-40 overflow-y-auto">
            {radiologyTests.map(test => (
              <button
                key={test}
                type="button"
                onClick={() => toggleRadTest(test)}
                className={`px-3 py-2 text-xs rounded-lg border-2 font-semibold transition ${
                  selectedRadTests.includes(test)
                    ? "bg-purple-400 text-purple-900 border-purple-600 shadow-md scale-105"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-purple-200 dark:border-purple-800 hover:shadow-sm"
                }`}
              >
                {test}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Template Manager Dialog */}
      <Dialog open={showTemplateEditor} onOpenChange={setShowTemplateEditor}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Template Manager</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs">
            {/* Add/Edit Prescription Template */}
            <div className="border rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
              <Label className="font-semibold">Create/Edit Prescription Template</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Template name (e.g., Seasonal Fever)"
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button type="button" onClick={saveTemplate} className="h-8 bg-blue-700 text-white text-xs rounded-lg">
                  {editingTemplate ? "Update" : "Create"}
                </Button>
              </div>
            </div>

            {/* Existing Templates */}
            <div className="border rounded-lg p-3 space-y-2">
              <Label className="font-semibold">Prescription Templates</Label>
              <div className="space-y-2">
                {Object.entries(templates).map(([id, template]) => (
                  <div key={id} className="flex items-center justify-between bg-slate-100 dark:bg-slate-900 p-2 rounded-lg">
                    <div className="text-sm">
                      <div className="font-medium">{template.name}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">{template.medicines.length} medicines, {template.labTests.length + template.radiologyTests.length} tests</div>
                    </div>
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingTemplate(template); setNewTemplateName(template.name); }} className="h-6 w-6 p-0">
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => deleteTemplate(id)} className="h-6 w-6 p-0 text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Manage Medicine Templates */}
            <div className="border rounded-lg p-3 bg-red-50/50 dark:bg-red-950/20 space-y-2">
              <Label className="font-semibold">Add Custom Medicine</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add new medicine (e.g., Ciprofloxacin)"
                  onKeyPress={e => {
                    if (e.key === "Enter") {
                      addMedicineTemplate((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                  className="h-8 text-xs flex-1"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.keys(medications).map(med => (
                  <Badge key={med} variant="secondary" className="flex items-center gap-1 text-[10px] bg-red-100">
                    {med}
                    <button type="button" onClick={() => removeMedicineTemplate(med)} className="text-red-600 font-bold ml-1">×</button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowTemplateEditor(false)} className="rounded-xl">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
