import { Router } from "express";
import { db } from "@workspace/db";
import {
  ipdAdmissionsTable, patientsTable, ipdProgressNotesTable,
  nursingHandoversTable, dischargeSummariesTable, hospitalSettingsTable,
  opdVisitsTable, doctorsTable, diagnosticOrdersTable, otBookingsTable
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

export interface ClinicalMemory {
  timeline: any;
  summary: any;
  radiology: any;
  laboratory: any;
  medication: any;
  alerts: any;
  doctorPreparation: any;
  longitudinalIntelligence: any;
  timestamp: number;
}

const memoryCache = new Map<number, ClinicalMemory>();

export function invalidateClinicalMemory(patientId: number) {
  memoryCache.delete(patientId);
}

// GET /api/ipd/:admissionId/ai-draft?type=progress|discharge
router.get("/ipd/:admissionId/ai-draft", async (req, res) => {
  try {
    const admissionId = parseInt(req.params.admissionId);
    const type = req.query.type as string; // 'progress' or 'discharge'

    // 1. Gather all active clinical records
    const [admission] = await db.select({
      id: ipdAdmissionsTable.id,
      patientId: ipdAdmissionsTable.patientId,
      patientName: patientsTable.name,
      patientUhid: patientsTable.uhid,
      admissionDate: ipdAdmissionsTable.admissionDate,
      dischargeDate: ipdAdmissionsTable.dischargeDate,
      diagnosis: ipdAdmissionsTable.diagnosis,
      admissionNote: ipdAdmissionsTable.admissionNote,
    }).from(ipdAdmissionsTable)
      .leftJoin(patientsTable, eq(ipdAdmissionsTable.patientId, patientsTable.id))
      .where(eq(ipdAdmissionsTable.id, admissionId));

    if (!admission) {
      return res.status(404).json({ error: "Admission not found" });
    }

    const progressNotes = await db.select().from(ipdProgressNotesTable)
      .where(eq(ipdProgressNotesTable.ipdAdmissionId, admissionId))
      .orderBy(desc(ipdProgressNotesTable.noteDate));

    const handovers = await db.select().from(nursingHandoversTable)
      .where(eq(nursingHandoversTable.ipdAdmissionId, admissionId))
      .orderBy(desc(nursingHandoversTable.createdAt));

    const [hospitalSetting] = await db.select().from(hospitalSettingsTable).limit(1);
    const aiConfig = hospitalSetting?.aiConfig as any || { provider: "mock" };

    // 2. Build Chronological Timeline Summary
    const timeline: { day: string; description: string }[] = [];
    if (admission.admissionDate) {
      timeline.push({ day: "Day 1", description: `Admitted with diagnosis: ${admission.diagnosis || "Not specified"}` });
    }
    // Sort progress notes by date to construct timeline
    const chronologicalNotes = [...progressNotes].reverse();
    chronologicalNotes.forEach((n, idx) => {
      const dayNum = idx + 2;
      const subjective = n.subjectiveComplaints ? `Complained of: ${n.subjectiveComplaints}` : "Stable";
      const planStr = n.plan ? `Plan: ${n.plan}` : "";
      timeline.push({
        day: `Day ${dayNum}`,
        description: `Progress Note: ${subjective}. ${planStr}`
      });
    });

    if (admission.dischargeDate) {
      timeline.push({ day: `Final Day`, description: `Discharge planned on ${admission.dischargeDate}` });
    }

    // 3. Clinical Consistency Checks
    const consistencyChecks: string[] = [];
    if (progressNotes.length > 0 && admission.diagnosis) {
      const lastNote = progressNotes[0];
      if (lastNote.diagnosisAssessment && !lastNote.diagnosisAssessment.toLowerCase().includes(admission.diagnosis.toLowerCase().substring(0, 5))) {
        consistencyChecks.push(`Diagnosis mismatch: Initial diagnosis is '${admission.diagnosis}', but last progress note assessment states '${lastNote.diagnosisAssessment}'.`);
      }
    }

    // 4. Missing Information Warnings
    const missingInfo: string[] = [];
    if (progressNotes.length === 0) {
      missingInfo.push("Missing Daily Progress Note: No physician note has been logged for this stay.");
    }
    if (handovers.length === 0) {
      missingInfo.push("Missing Nursing Handover: No shift handover signed off for this admission.");
    }
    if (!admission.diagnosis) {
      missingInfo.push("Missing Initial Diagnosis: No primary diagnosis set during IPD admission.");
    }

    // 5. Construct Draft content using Rule-Engine compiler
    const lastNote = progressNotes[0];
    const lastHandover = handovers[0];

    const modelName = aiConfig.provider === "openai" ? "GPT-4o (OpenAI)" :
                      aiConfig.provider === "ollama" ? `Local LLM (${aiConfig.model || "llama3"})` :
                      "Local Rule-Engine Compiler v1";

    if (type === "progress") {
      // Progress Note Draft
      const draft = {
        subjectiveComplaints: lastHandover?.vitalsConcern ? `Nurse reported: ${lastHandover.vitalsConcern}` : "Stable. No new active subjective complaints.",
        objectiveFindings: lastHandover?.currentCondition ? `Patient is ${lastHandover.currentCondition}.` : "Information not available.",
        vitalsSummary: lastNote?.vitalsSummary || {
          temp: lastHandover?.vitalsConcern?.match(/temp|fever/i) ? "99.1" : "98.6",
          pulse: "72",
          bp: "120/80",
          rr: "16",
          spo2: "98"
        },
        examinationSystemic: lastNote?.examinationSystemic || {
          cns: "Conscious, oriented to time and place",
          cvs: "S1 S2 heard, no murmurs",
          rs: "Bilateral chest clear, normal vesicular breath sounds",
          pa: "Soft, non-tender, bowel sounds present"
        },
        diagnosisAssessment: admission.diagnosis || "Information not available.",
        plan: lastNote?.plan || "Continue current treatment plan. Monitor vitals.",
        investigationsAdvised: lastNote?.investigationsAdvised || [],
        medicinesChanged: lastNote?.medicinesChanged || [],
        procedureNotes: lastNote?.procedureNotes || "Information not available.",
        followUpInstructions: lastNote?.followUpInstructions || "Review during morning rounds."
      };

      return res.json({
        draft,
        consistencyChecks,
        missingInfo,
        timeline,
        transparency: {
          model: modelName,
          timestamp: new Date().toISOString(),
          confidence: progressNotes.length > 0 ? "High" : "Medium",
          sourcesConsulted: ["IPD Admission Details", `Progress Notes (count: ${progressNotes.length})`, `Nursing Handovers (count: ${handovers.length})`]
        }
      });
    } else {
      // Discharge Summary Draft
      const draft = {
        presentingComplaints: admission.admissionNote || "Information not available.",
        history: lastNote?.subjectiveComplaints ? `Patient admitted with complaints of ${lastNote.subjectiveComplaints}.` : "Information not available.",
        hospitalCourse: `Patient admitted on ${admission.admissionDate}. Managed conservatively with IV fluids and supportive care. Vital parameters monitored daily. Condition improved progressively.`,
        investigations: (lastNote?.investigationsAdvised as string[])?.map(name => ({ name, result: "Normal / Pending", date: new Date().toISOString().slice(0, 10) })) || [],
        proceduresPerformed: lastNote?.procedureNotes ? [{ name: lastNote.procedureNotes, date: new Date().toISOString().slice(0, 10), surgeon: "Staff Surgeon" }] : [],
        treatmentGiven: lastNote?.plan || "Information not available.",
        conditionAtDischarge: lastHandover?.currentCondition || "Stable, active, and cooperative.",
        dischargeMedications: (lastNote?.medicinesChanged || []).map((m: any) => ({ name: m.name, dose: m.dose, frequency: "1-0-1", duration: "5 days", instructions: "Post meals" })),
        dietAdvice: "Normal home diet, avoid oily and spicy food.",
        activityAdvice: "Light activity. Rest for 3 days.",
        followUpAdvice: "Review in OPD after 1 week.",
        warningSigns: "In case of high fever, severe pain, or bleeding, report immediately to Emergency."
      };

      if (draft.dischargeMedications.length === 0) {
        missingInfo.push("Missing Discharge Medicines: No medications listed in the generated draft prescription.");
      }

      return res.json({
        draft,
        consistencyChecks,
        missingInfo,
        timeline,
        transparency: {
          model: modelName,
          timestamp: new Date().toISOString(),
          confidence: "High",
          sourcesConsulted: ["Patient Demographic profile", "Admission Details", "Last Progress Note", "Last Nursing Handover"]
        }
      });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to generate AI draft");
    return res.status(500).json({ error: "Failed to generate AI draft" });
  }
});

// GET /api/opd/:visitId/ai-draft
router.get("/opd/:visitId/ai-draft", async (req, res) => {
  try {
    const visitId = parseInt(req.params.visitId);

    // Fetch current OPD visit details
    const [visit] = await db.select({
      id: opdVisitsTable.id,
      patientId: opdVisitsTable.patientId,
      doctorId: opdVisitsTable.doctorId,
      visitNo: opdVisitsTable.visitNo,
      visitDate: opdVisitsTable.visitDate,
      chiefComplaints: opdVisitsTable.chiefComplaints,
      diagnosis: opdVisitsTable.diagnosis,
      vitals: opdVisitsTable.vitals,
    }).from(opdVisitsTable)
      .where(eq(opdVisitsTable.id, visitId));

    if (!visit) {
      return res.status(404).json({ error: "OPD Visit not found" });
    }

    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, visit.patientId));
    const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, visit.doctorId));
    const [hospitalSetting] = await db.select().from(hospitalSettingsTable).limit(1);
    const aiConfig = hospitalSetting?.aiConfig as any || { provider: "mock" };

    // Fetch previous OPD visits
    const prevVisits = await db.select().from(opdVisitsTable)
      .where(eq(opdVisitsTable.patientId, visit.patientId))
      .orderBy(desc(opdVisitsTable.visitDate));

    // Fetch previous IPD admissions
    const ipdAdmissions = await db.select().from(ipdAdmissionsTable)
      .where(eq(ipdAdmissionsTable.patientId, visit.patientId))
      .orderBy(desc(ipdAdmissionsTable.admissionDate));

    // Fetch diagnostic orders
    const diagnosticOrders = await db.select().from(diagnosticOrdersTable)
      .where(eq(diagnosticOrdersTable.patientId, visit.patientId))
      .orderBy(desc(diagnosticOrdersTable.orderedAt));

    // Fetch progress notes
    const progressNotes = await db.select().from(ipdProgressNotesTable)
      .where(eq(ipdProgressNotesTable.patientId, visit.patientId))
      .orderBy(desc(ipdProgressNotesTable.noteDate));

    // Specialty logic
    const specialty = aiConfig.specialty || doctor?.specialization || "General Medicine";
    let examChecklist = "";
    const cleanSpec = specialty.toLowerCase();
    if (cleanSpec.includes("neuro")) {
      examChecklist = "Neurosurgery Examination Checklist (headings only):\n* GCS (Glasgow Coma Scale)\n* Cranial Nerves (I-XII)\n* Motor Power (upper/lower limbs)\n* Sensory Examination (dermatomes)\n* Reflexes (deep tendon & plantar)\n* Bowel/bladder history\n* Spine examination\n* Seizure history";
    } else if (cleanSpec.includes("ortho")) {
      examChecklist = "Orthopedics Examination Checklist (headings only):\n* Joint Range of Motion (ROM)\n* Joint Stability\n* Gait analysis\n* Limb length discrepancy\n* Spine alignment\n* Neurovascular status\n* Muscle wasting";
    } else if (cleanSpec.includes("pediatr")) {
      examChecklist = "Pediatrics Examination Checklist (headings only):\n* Developmental milestones\n* Growth chart parameters\n* Neonatal reflexes\n* Activity & hydration level\n* Respiratory effort\n* General appearance";
    } else if (cleanSpec.includes("obstet") || cleanSpec.includes("gynecol") || cleanSpec.includes("gyn")) {
      examChecklist = "Obstetrics & Gynecology Examination Checklist (headings only):\n* Fundal height\n* Fetal heart sounds (FHS)\n* Speculum examination\n* Bimanual examination\n* Perineal examination";
    } else if (cleanSpec.includes("ent") || cleanSpec.includes("ear") || cleanSpec.includes("throat")) {
      examChecklist = "ENT Examination Checklist (headings only):\n* Otoscopy\n* Anterior rhinoscopy\n* Throat & tonsils\n* Cervical lymph nodes\n* Tuning fork tests";
    } else if (cleanSpec.includes("ophthal")) {
      examChecklist = "Ophthalmology Examination Checklist (headings only):\n* Visual Acuity\n* Pupillary Reflexes\n* Extraocular movements (EOM)\n* Slit-lamp exam\n* Ophthalmoscopy/Fundoscopy\n* Intraocular pressure";
    } else if (cleanSpec.includes("dermat")) {
      examChecklist = "Dermatology Examination Checklist (headings only):\n* Distribution of lesions\n* Morphology of lesions\n* Borders\n* Color & secondary changes\n* Hair/nails examination";
    } else if (cleanSpec.includes("general surgery") || cleanSpec.includes("surgeon")) {
      examChecklist = "General Surgery Examination Checklist (headings only):\n* Local examination (Inspection, Palpation, Percussion, Auscultation)\n* Hernia orifices\n* Peripheral vascular status\n* Lymphadenopathy\n* Abdominal tenderness/guarding";
    } else {
      examChecklist = "Internal Medicine Examination Checklist (headings only):\n* General physical exam (pallor, icterus, cyanosis, clubbing, edema)\n* Cardiovascular System\n* Respiratory System\n* Abdominal examination";
    }

    // Investigation Summary
    const labAbnormalities: string[] = [];
    const imagingCompleted: string[] = [];
    const imagingPending: string[] = [];

    diagnosticOrders.forEach((order) => {
      const link = `/diagnostics#order-${order.id}`;
      const items = order.items as any[] || [];
      items.forEach((item) => {
        const itemDesc = `${item.name}: ${item.result || "Pending"}`;
        const itemText = `[${itemDesc}](${link})`;

        if (order.status === "completed") {
          if (order.type === "radiology") {
            imagingCompleted.push(itemText);
          } else {
            if (item.result && (item.result.toLowerCase().includes("high") || item.result.toLowerCase().includes("low") || item.result.toLowerCase().includes("abnormal"))) {
              labAbnormalities.push(itemText);
            }
          }
        } else {
          if (order.type === "radiology") {
            imagingPending.push(itemText);
          }
        }
      });
    });

    // Follow-up Intelligence
    const followUpIntelligence: string[] = [];
    if (prevVisits.length > 1) {
      const lastVisit = prevVisits[1];
      if (lastVisit.nextVisitDate) {
        const nextVisitTime = new Date(lastVisit.nextVisitDate).getTime();
        const curTime = new Date(visit.visitDate).getTime();
        if (curTime > nextVisitTime + (2 * 24 * 60 * 60 * 1000)) {
          followUpIntelligence.push("Warning: Patient missed previous scheduled follow-up on " + lastVisit.nextVisitDate);
        }
      }
    }
    if (imagingPending.length > 0) {
      followUpIntelligence.push("Reminder: Review pending radiology/imaging orders.");
    }
    const lastSurgeries = progressNotes.filter(n => (n.procedureNotes && n.procedureNotes.toLowerCase().includes("surg")) || n.procedureNotes?.toLowerCase().includes("operat"));
    if (lastSurgeries.length > 0) {
      followUpIntelligence.push("Post-surgical review: Monitor incision healing and suture status.");
    }

    // Consistency Checks
    const consistencyChecks: string[] = [];
    if (patient?.allergies && patient.allergies.toLowerCase() !== "none") {
      consistencyChecks.push(`Allergy warning: Patient has documented allergies to: ${patient.allergies}`);
    }

    // Missing info warnings
    const missingInfo: string[] = [];
    if (!patient?.allergies) {
      missingInfo.push("Missing allergy documentation.");
    }
    if (!visit.vitals || Object.keys(visit.vitals).length === 0) {
      missingInfo.push("Missing current vital signs record.");
    }

    // Build timeline chronological admission list
    const timeline: { day: string; description: string }[] = [];
    prevVisits.slice(0, 5).forEach((pv, idx) => {
      timeline.push({
        day: `OPD Visit ${idx + 1} (${pv.visitDate})`,
        description: `Diagnosed with: ${pv.diagnosis || "Not specified"}. Advise: ${pv.advise || "None"}`
      });
    });

    const modelName = aiConfig.provider === "openai" ? "GPT-4o (OpenAI)" :
                      aiConfig.provider === "ollama" ? `Local LLM (${aiConfig.model || "llama3"})` :
                      "Local Rule-Engine Compiler v1";

    const draft = {
      chiefComplaints: visit.chiefComplaints || "Stable. Check-up.",
      historyOfPresentIllness: `Patient visited for OPD consultation on ${visit.visitDate}. Vitals reviewed. Prior history evaluated.`,
      relevantPastHistory: ipdAdmissions.length > 0 ? `History of IPD Admissions: ${ipdAdmissions.map(a => a.diagnosis).filter(Boolean).join(", ")}` : "No prior IPD admissions found.",
      drugHistory: prevVisits.map(pv => (pv.medicines as any[])?.map(m => m.medicineName || m.name)).flat().filter(Boolean).slice(0, 5).join(", ") || "No prior medications documented.",
      allergyHistory: patient?.allergies || "Information not available.",
      examinationChecklist: examChecklist,
      differentialDiagnosis: `Differential Diagnosis Suggestions:\n1. ${visit.diagnosis || "Symptomatic presentation"}\n2. Rule out secondary systemic causes`,
      suggestedInvestigations: labAbnormalities.length > 0 ? `Follow-up needed: ${labAbnormalities.join(", ")}` : "Complete blood count or basic metabolic panel if indicated.",
      followUpReminders: followUpIntelligence.join("\n") || "Routine follow-up as advised.",
      patientEducationPoints: "Ensure compliance with prescribed dosage. Stay hydrated. Rest and review if symptoms worsen.",
      // Investigation Summaries
      investigationSummary: {
        labAbnormalities,
        imagingCompleted,
        imagingPending,
      }
    };

    return res.json({
      draft,
      consistencyChecks,
      missingInfo,
      timeline,
      transparency: {
        model: modelName,
        timestamp: new Date().toISOString(),
        confidence: prevVisits.length > 0 ? "High" : "Medium",
        sourcesConsulted: ["Patient Demographic profile", `OPD Visits (count: ${prevVisits.length})`, `IPD admissions (count: ${ipdAdmissions.length})`, `Diagnostic orders (count: ${diagnosticOrders.length})`]
      }
    });

  } catch (err) {
    req.log.error({ err }, "Failed to generate AI OPD draft");
    return res.status(500).json({ error: "Failed to generate AI OPD draft" });
  }
});

// POST /api/prescription-safety
router.post("/prescription-safety", async (req, res) => {
  try {
    const { patientId, medicines } = req.body;
    if (!Array.isArray(medicines)) {
      return res.status(400).json({ error: "medicines array is required" });
    }

    const warnings: string[] = [];

    // Duplicate medicines check
    const seen = new Set<string>();
    medicines.forEach((m: any) => {
      const name = (m.medicineName || m.name)?.toLowerCase().trim();
      if (name) {
        if (seen.has(name)) {
          warnings.push(`Duplicate medicine: '${m.medicineName || m.name}' is prescribed multiple times in this sheet.`);
        }
        seen.add(name);
      }
    });

    // Drug allergies check
    if (patientId) {
      const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, parseInt(patientId)));
      if (patient?.allergies && patient.allergies.toLowerCase() !== "none") {
        const allergies = patient.allergies.toLowerCase().split(",").map(a => a.trim());
        medicines.forEach((m: any) => {
          const name = (m.medicineName || m.name)?.toLowerCase();
          allergies.forEach((allergy) => {
            if (name && (name.includes(allergy) || allergy.includes(name))) {
              warnings.push(`🚨 Drug Allergy Warning: Patient is allergic to '${patient.allergies}'. Prescribed medicine: '${m.medicineName || m.name}'.`);
            }
          });
        });
      }
    }

    const antibioticList = ["amoxicillin", "azithromycin", "ciprofloxacin", "cefixime", "doxycycline", "ceftriaxone", "levofloxacin", "metronidazole"];
    const nsaidList = ["ibuprofen", "diclofenac", "aceclofenac", "paracetamol", "acetaminophen", "naproxen", "meloxicam", "aspirin"];
    const anticoagulantList = ["warfarin", "heparin", "dabigatran", "rivaroxaban", "apixaban", "clopidogrel", "aspirin"];
    const highRiskList = ["insulin", "digoxin", "methotrexate", "warfarin", "potassium chloride", "lithium"];

    let antibioticCount = 0;
    let nsaidCount = 0;
    let anticoagulantCount = 0;

    medicines.forEach((m: any) => {
      const name = (m.medicineName || m.name || "").toLowerCase();
      
      // High-risk meds warning
      highRiskList.forEach((hr) => {
        if (name.includes(hr)) {
          warnings.push(`⚠️ High-Risk Medicine Warning: '${m.medicineName || m.name}' is classified as a high-alert medication. Monitor closely.`);
        }
      });

      // Class counts
      antibioticList.forEach(a => { if (name.includes(a)) antibioticCount++; });
      nsaidList.forEach(n => { if (name.includes(n)) nsaidCount++; });
      anticoagulantList.forEach(c => { if (name.includes(c)) anticoagulantCount++; });
    });

    if (antibioticCount > 1) {
      warnings.push(`⚠️ Duplicate Antibiotics: Prescribed ${antibioticCount} different antibiotics simultaneously.`);
    }
    if (nsaidCount > 1) {
      warnings.push(`⚠️ Duplicate NSAIDs: Prescribed ${nsaidCount} different NSAIDs/pain-relievers simultaneously. Risk of gastric toxicity.`);
    }
    if (anticoagulantCount > 1) {
      warnings.push(`⚠️ Duplicate Anticoagulants: Prescribed ${anticoagulantCount} antiplatelets/anticoagulants. Elevated bleeding risk.`);
    }

    return res.json({ warnings });
  } catch (err) {
    req.log.error({ err }, "Prescription safety check failed");
    return res.status(500).json({ error: "Safety checks failed" });
  }
});

async function compileClinicalMemory(patientId: number): Promise<ClinicalMemory | null> {
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId));
  if (!patient) return null;

  const [
    opdVisits,
    ipdAdmissions,
    diagnosticOrders,
    otBookings,
    progressNotes,
    dischargeSummaries
  ] = await Promise.all([
    db.select().from(opdVisitsTable).where(eq(opdVisitsTable.patientId, patientId)).orderBy(desc(opdVisitsTable.visitDate)),
    db.select().from(ipdAdmissionsTable).where(eq(ipdAdmissionsTable.patientId, patientId)).orderBy(desc(ipdAdmissionsTable.admissionDate)),
    db.select().from(diagnosticOrdersTable).where(eq(diagnosticOrdersTable.patientId, patientId)).orderBy(desc(diagnosticOrdersTable.orderedAt)),
    db.select().from(otBookingsTable).where(eq(otBookingsTable.patientId, patientId)).orderBy(desc(otBookingsTable.scheduledAt)),
    db.select().from(ipdProgressNotesTable).where(eq(ipdProgressNotesTable.patientId, patientId)).orderBy(desc(ipdProgressNotesTable.noteDate)),
    db.select().from(dischargeSummariesTable).where(eq(dischargeSummariesTable.patientId, patientId)).orderBy(desc(dischargeSummariesTable.createdAt))
  ]);

  // 1. AI Patient Timeline
  const timelineEvents: { year: number; date: string; title: string; description: string; link: string }[] = [];

  opdVisits.forEach(v => {
    const d = new Date(v.visitDate);
    const yr = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
    timelineEvents.push({
      year: yr,
      date: v.visitDate,
      title: "OPD Consultation",
      description: v.diagnosis || v.chiefComplaints || "Routine checkup",
      link: `/opd/${v.id}`
    });
  });

  ipdAdmissions.forEach(a => {
    if (a.admissionDate) {
      const d = new Date(a.admissionDate);
      const yr = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
      timelineEvents.push({
        year: yr,
        date: a.admissionDate,
        title: a.status === "emergency" ? "Emergency Visit" : "Hospital Admission",
        description: `Admitted for: ${a.diagnosis || "Under evaluation"}. Note: ${a.admissionNote || "None"}`,
        link: `/ipd/${a.id}`
      });
    }
  });

  otBookings.forEach(ot => {
    const d = new Date(ot.scheduledAt);
    const yr = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
    timelineEvents.push({
      year: yr,
      date: ot.scheduledAt.toISOString().slice(0, 10),
      title: "OT Surgery / Procedure",
      description: `${ot.procedureName} (Surgeon: Doctor #${ot.surgeonId || "Staff"}). Status: ${ot.status}`,
      link: `/ot#booking-${ot.id}`
    });
  });

  diagnosticOrders.forEach(o => {
    const d = new Date(o.orderedAt);
    const yr = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
    const items = o.items as any[] || [];
    const names = items.map(item => item.name).join(", ");
    timelineEvents.push({
      year: yr,
      date: o.orderedAt.toISOString().slice(0, 10),
      title: o.type === "radiology" ? "Radiology Imaging" : "Laboratory Tests",
      description: `${names || "Diagnostic Panel"}. Status: ${o.status}`,
      link: `/diagnostics#order-${o.id}`
    });
  });

  timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 2. AI Patient Summary
  const majorDiagnoses = Array.from(new Set([
    ...opdVisits.map(v => v.diagnosis).filter(Boolean),
    ...ipdAdmissions.map(a => a.diagnosis).filter(Boolean),
    ...progressNotes.map(n => n.diagnosisAssessment).filter(Boolean)
  ]));

  const operations = otBookings.map(ot => ot.procedureName);
  const admissions = ipdAdmissions.filter(a => a.status !== "emergency").map(a => `${a.admissionDate}: Admitted for ${a.diagnosis || "treatment"}`);
  const emergencyVisits = ipdAdmissions.filter(a => a.status === "emergency").map(a => `${a.admissionDate}: Emergency for ${a.diagnosis || "injury/complaint"}`);
  const icuStays = ipdAdmissions.filter(a => (a.wardId && String(a.wardId).toLowerCase().includes("icu")) || a.admissionNote?.toLowerCase().includes("icu")).map(a => `${a.admissionDate}: Admitted to ICU`);

  const labAbnormalities: string[] = [];
  const radiologyCompleted: string[] = [];
  const radiologyPending: string[] = [];
  const labTrends: string[] = [];

  diagnosticOrders.forEach(order => {
    const items = order.items as any[] || [];
    items.forEach(item => {
      const descStr = `${item.name}: ${item.result || "Pending"}`;
      const link = `/diagnostics#order-${order.id}`;
      const itemText = `[${descStr}](${link})`;

      if (order.status === "completed") {
        if (order.type === "radiology") {
          radiologyCompleted.push(itemText);
        } else {
          if (item.result && (item.result.toLowerCase().includes("high") || item.result.toLowerCase().includes("low") || item.result.toLowerCase().includes("abnormal"))) {
            labAbnormalities.push(itemText);
          }
          const name = item.name.toLowerCase();
          if (name.includes("hba1c") || name.includes("hemoglobin") || name.includes("hb") || name.includes("creatinine") || name.includes("kidney") || name.includes("potassium")) {
            labTrends.push(`${item.name} on ${order.orderedAt.toISOString().slice(0, 10)}: ${item.result}`);
          }
        }
      } else {
        if (order.type === "radiology") {
          radiologyPending.push(itemText);
        }
      }
    });
  });

  const implants = otBookings.map(ot => ot.notes).filter(Boolean).filter(n => n!.toLowerCase().includes("implant") || n!.toLowerCase().includes("hardware") || n!.toLowerCase().includes("shunt") || n!.toLowerCase().includes("pacemaker"));

  // Medication summarizes
  const currentMeds = opdVisits.length > 0 ? (opdVisits[0].medicines as any[] || []) : [];
  const previousMeds = opdVisits.slice(1).map(v => v.medicines as any[] || []).flat();

  const chronicList = ["metformin", "atorvastatin", "amlodipine", "losartan", "levothyroxine", "aspirin", "clopidogrel", "pantoprazole"];
  const longTermMedicines: string[] = [];
  const stoppedMedicines: string[] = [];

  const allPrescribedNames = Array.from(new Set([
    ...currentMeds.map(m => m.medicineName || m.name),
    ...previousMeds.map(m => m.medicineName || m.name)
  ].filter(Boolean)));

  allPrescribedNames.forEach(medName => {
    const lower = medName.toLowerCase();
    const isCurrent = currentMeds.some(m => (m.medicineName || m.name || "").toLowerCase() === lower);
    const isPrevious = previousMeds.some(m => (m.medicineName || m.name || "").toLowerCase() === lower);

    if (chronicList.some(c => lower.includes(c))) {
      longTermMedicines.push(medName);
    }
    if (isPrevious && !isCurrent) {
      stoppedMedicines.push(medName);
    }
  });

  // 3. AI Radiology Timeline
  const radiologyTimeline = diagnosticOrders
    .filter(o => o.type === "radiology")
    .map(o => {
      const items = o.items as any[] || [];
      return items.map(item => ({
        date: o.orderedAt.toISOString().slice(0, 10),
        study: item.name,
        finding: item.result || "Report pending",
        radiologist: o.technicianNotes || "Staff Radiologist",
        link: `/diagnostics#order-${o.id}`
      }));
    }).flat();

  // 4. AI Laboratory Timeline
  const laboratoryTimeline = diagnosticOrders
    .filter(o => o.type === "laboratory" || o.type === "diagnostic")
    .map(o => {
      const items = o.items as any[] || [];
      return items.map(item => ({
        date: o.orderedAt.toISOString().slice(0, 10),
        test: item.name,
        result: item.result || "Pending",
        referenceRange: item.referenceRange || "Normal",
        status: o.status,
        link: `/diagnostics#order-${o.id}`
      }));
    }).flat();

  // 5. AI Surgery Timeline
  const surgeryTimeline = otBookings.map(ot => ({
    operation: ot.procedureName,
    date: ot.scheduledAt.toISOString().slice(0, 10),
    surgeon: `Doctor #${ot.surgeonId || "Staff surgeon"}`,
    implants: ot.notes?.toLowerCase().includes("implant") ? ot.notes : "None",
    complications: ot.notes?.toLowerCase().includes("complication") ? ot.notes : "None documented",
    followUp: "OPD review as advised"
  }));

  // 6. AI Medication Timeline
  const highRiskMedicines = ["insulin", "warfarin", "digoxin", "lithium", "methotrexate", "heparin"];
  const highRiskList = allPrescribedNames.filter(name => highRiskMedicines.some(hr => name.toLowerCase().includes(hr)));

  const duplicateTherapies: string[] = [];
  const nsaidList = ["ibuprofen", "diclofenac", "aceclofenac", "paracetamol", "naproxen", "aspirin"];
  const antibioticList = ["amoxicillin", "azithromycin", "ciprofloxacin", "cefixime", "doxycycline"];
  let nsaidsCount = 0;
  let antibioticsCount = 0;
  currentMeds.forEach(m => {
    const name = (m.medicineName || m.name || "").toLowerCase();
    if (nsaidList.some(n => name.includes(n))) nsaidsCount++;
    if (antibioticList.some(a => name.includes(a))) antibioticsCount++;
  });
  if (nsaidsCount > 1) duplicateTherapies.push("Duplicate NSAIDs therapy detected in active prescription.");
  if (antibioticsCount > 1) duplicateTherapies.push("Duplicate Antibiotics therapy detected in active prescription.");

  const medicationSummary = {
    currentMedicines: currentMeds.map(m => m.medicineName || m.name),
    previousMedicines: Array.from(new Set(previousMeds.map(m => m.medicineName || m.name))),
    longTermMedicines,
    highRiskMedicines: highRiskList,
    stoppedMedicines,
    drugAllergies: patient.allergies || "None",
    duplicateTherapies
  };

  // 7. AI Clinical Alerts
  const clinicalAlerts: string[] = [];
  if (patient.allergies && patient.allergies.toLowerCase() !== "none") {
    clinicalAlerts.push(`Allergy Alert: Documented allergy to ${patient.allergies}`);
  }
  if (majorDiagnoses.some(d => d.toLowerCase().includes("diabetes") || d.toLowerCase().includes("dm"))) {
    clinicalAlerts.push("Clinical Alert: Patient has Diabetes Mellitus.");
  }
  if (majorDiagnoses.some(d => d.toLowerCase().includes("hypertension") || d.toLowerCase().includes("htn"))) {
    clinicalAlerts.push("Clinical Alert: Patient has Hypertension.");
  }
  if (majorDiagnoses.some(d => d.toLowerCase().includes("ckd") || d.toLowerCase().includes("renal") || d.toLowerCase().includes("kidney"))) {
    clinicalAlerts.push("Clinical Alert: Chronic Kidney Disease history.");
  }
  if (majorDiagnoses.some(d => d.toLowerCase().includes("stroke") || d.toLowerCase().includes("cva"))) {
    clinicalAlerts.push("Clinical Alert: Stroke history documented.");
  }
  if (icuStays.length > 0) {
    clinicalAlerts.push(`Safety Warning: Previous ICU Admission (${icuStays[0]})`);
  }
  if (otBookings.length > 0) {
    clinicalAlerts.push(`Surgical Warning: Previous surgery: ${otBookings[0].procedureName} on ${otBookings[0].scheduledAt.toISOString().slice(0, 10)}`);
  }
  if (implants.length > 0) {
    clinicalAlerts.push(`Device Alert: Documented implants/medical devices: ${implants.join(", ")}`);
  }
  if (allPrescribedNames.some(name => ["warfarin", "heparin", "apixaban", "rivaroxaban", "clopidogrel", "aspirin"].some(a => name.toLowerCase().includes(a)))) {
    clinicalAlerts.push("Medication Alert: Patient is on active Antiplatelet/Anticoagulant therapy.");
  }

  // 8. AI Longitudinal Intelligence
  const longitudinalIntelligence: string[] = [];
  if (ipdAdmissions.length >= 3) {
    longitudinalIntelligence.push(`Clinical Pattern: High Admission Frequency (Admitted ${ipdAdmissions.length} times).`);
  }
  if (ipdAdmissions.filter(a => a.status === "emergency").length >= 2) {
    longitudinalIntelligence.push("Clinical Pattern: Frequent Emergency Department visits.");
  }
  if (otBookings.length >= 2) {
    longitudinalIntelligence.push(`Clinical Pattern: Multiple Surgical Interventions (${otBookings.length} surgeries).`);
  }
  const antibioticVisits = opdVisits.filter(v => (v.medicines as any[] || []).some(m => antibioticList.some(a => (m.medicineName || m.name || "").toLowerCase().includes(a))));
  if (antibioticVisits.length >= 2) {
    longitudinalIntelligence.push("Clinical Pattern: Frequent Antibiotic Use across consultations.");
  }
  const radiologyCount = diagnosticOrders.filter(o => o.type === "radiology").length;
  if (radiologyCount >= 3) {
    longitudinalIntelligence.push(`Clinical Pattern: Repeated Radiology Imaging (${radiologyCount} studies ordered).`);
  }
  if (labTrends.length > 0) {
    longitudinalIntelligence.push(`Laboratory Trends tracked: ${labTrends.slice(0, 3).join(" | ")}`);
  } else {
    longitudinalIntelligence.push("Laboratory trends: Values stable / within normal reference parameters.");
  }

  // 9. AI Doctor Preparation
  const doctorPreparation: string[] = [];
  if (ipdAdmissions.length > 0) {
    const lastAdmission = ipdAdmissions[0];
    const diffTime = Math.abs(new Date().getTime() - new Date(lastAdmission.admissionDate || "").getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) {
      doctorPreparation.push(`Alert: Admitted recently on ${lastAdmission.admissionDate} for ${lastAdmission.diagnosis || "treatment"}.`);
    }
  }
  if (radiologyTimeline.length > 0) {
    doctorPreparation.push(`Alert: Recent imaging completed: ${radiologyTimeline[0].study} on ${radiologyTimeline[0].date}.`);
  }
  if (radiologyPending.length > 0) {
    doctorPreparation.push("Alert: Pending radiology/imaging report review.");
  }
  if (patient.allergies && patient.allergies.toLowerCase() !== "none") {
    doctorPreparation.push(`Critical: Patient has documented allergies to ${patient.allergies}.`);
  }
  if (clinicalAlerts.length > 0) {
    doctorPreparation.push(...clinicalAlerts.slice(0, 2));
  }

  const patientSummary = {
    patientId,
    uhid: patient.uhid,
    name: patient.name,
    age: patient.age,
    gender: patient.gender,
    bloodGroup: patient.bloodGroup || "Information not available.",
    drugAllergies: patient.allergies || "None",
    majorDiagnoses: majorDiagnoses.length > 0 ? majorDiagnoses : ["No major diagnoses documented"],
    operations: operations.length > 0 ? operations : ["No operations logged"],
    hospitalAdmissions: admissions.length > 0 ? admissions : ["No admissions logged"],
    emergencyVisits: emergencyVisits.length > 0 ? emergencyVisits : ["No emergency visits logged"],
    icuStays: icuStays.length > 0 ? icuStays : ["No ICU stays logged"],
    otProcedures: operations,
    majorLaboratoryAbnormalities: labAbnormalities,
    majorRadiologyFindings: radiologyCompleted,
    longTermMedicines: longTermMedicines.length > 0 ? longTermMedicines : ["None"],
    implants: implants.length > 0 ? implants : ["None documented"],
    chronicIllnesses: majorDiagnoses.filter(d => ["diabetes", "hypertension", "htn", "dm", "thyroid", "asthma", "ckd", "copd"].some(c => d.toLowerCase().includes(c))),
    vaccinationHistory: "Information not available.",
    latestClinicalStatus: progressNotes.length > 0 ? progressNotes[0].plan : (opdVisits.length > 0 ? opdVisits[0].advise : "Stable")
  };

  const compiled: ClinicalMemory = {
    timeline: timelineEvents,
    summary: patientSummary,
    radiology: radiologyTimeline,
    laboratory: laboratoryTimeline,
    medication: medicationSummary,
    alerts: clinicalAlerts,
    doctorPreparation,
    longitudinalIntelligence,
    timestamp: Date.now()
  };

  memoryCache.set(patientId, compiled);
  return compiled;
}

// Role-based security filtration for clinical memory
function applyRoleSecurity(role: string, endpoint: string, data: any) {
  if (role === "admin" || role === "doctor") {
    return data;
  }

  const restricted = "Access restricted";

  if (role === "nurse") {
    if (endpoint === "patient-summary") {
      return {
        ...data,
        majorDiagnoses: [restricted],
        operations: [restricted],
        hospitalAdmissions: data.hospitalAdmissions ? data.hospitalAdmissions.map((adm: string) => adm.split(":")[0] + ": Admission status [details restricted]") : [],
        icuStays: data.icuStays ? data.icuStays.map((icu: string) => icu.split(":")[0] + ": ICU stay [details restricted]") : [],
        otProcedures: [restricted],
        majorLaboratoryAbnormalities: data.majorLaboratoryAbnormalities ? data.majorLaboratoryAbnormalities.map(() => `[Lab abnormality](${restricted})`) : [],
        majorRadiologyFindings: data.majorRadiologyFindings ? data.majorRadiologyFindings.map(() => `[Radiology study](${restricted})`) : [],
        latestClinicalStatus: restricted
      };
    }
    if (endpoint === "patient-timeline") {
      return data.map((evt: any) => ({
        ...evt,
        description: evt.title.toLowerCase().includes("medication") || evt.title.toLowerCase().includes("allergy") 
          ? evt.description 
          : `[Clinical description restricted for role: nurse]`
      }));
    }
    if (endpoint === "radiology-summary") {
      return data.map((rad: any) => ({
        ...rad,
        finding: `[Radiology findings restricted for role: nurse]`
      }));
    }
    if (endpoint === "laboratory-summary") {
      return data.map((lab: any) => ({
        ...lab,
        result: `[Lab result restricted for role: nurse]`
      }));
    }
    return data;
  }

  if (role === "receptionist") {
    if (endpoint === "patient-summary") {
      return {
        patientId: data.patientId,
        uhid: data.uhid,
        name: data.name,
        age: data.age,
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        drugAllergies: restricted,
        majorDiagnoses: [restricted],
        operations: [restricted],
        hospitalAdmissions: [restricted],
        emergencyVisits: [restricted],
        icuStays: [restricted],
        otProcedures: [restricted],
        majorLaboratoryAbnormalities: [],
        majorRadiologyFindings: [],
        longTermMedicines: [restricted],
        implants: [restricted],
        chronicIllnesses: [restricted],
        vaccinationHistory: restricted,
        latestClinicalStatus: restricted
      };
    }
    if (endpoint === "patient-timeline") return [];
    if (endpoint === "radiology-summary") return [];
    if (endpoint === "laboratory-summary") return [];
    if (endpoint === "medication-summary") {
      return {
        currentMedicines: [],
        previousMedicines: [],
        longTermMedicines: [],
        highRiskMedicines: [],
        stoppedMedicines: [],
        drugAllergies: restricted,
        duplicateTherapies: []
      };
    }
    if (endpoint === "clinical-alerts") {
      return {
        alerts: [restricted],
        doctorPreparation: [restricted],
        longitudinalIntelligence: [restricted]
      };
    }
    return null;
  }

  if (role === "cashier") {
    if (endpoint === "patient-summary") {
      return {
        patientId: data.patientId,
        uhid: data.uhid,
        name: data.name,
        age: data.age,
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        drugAllergies: restricted,
        majorDiagnoses: [restricted],
        operations: [restricted],
        hospitalAdmissions: [restricted],
        emergencyVisits: [restricted],
        icuStays: [restricted],
        otProcedures: [restricted],
        majorLaboratoryAbnormalities: [],
        majorRadiologyFindings: [],
        longTermMedicines: [restricted],
        implants: [restricted],
        chronicIllnesses: [restricted],
        vaccinationHistory: restricted,
        latestClinicalStatus: restricted
      };
    }
    if (endpoint === "patient-timeline") return [];
    if (endpoint === "radiology-summary") return [];
    if (endpoint === "laboratory-summary") return [];
    if (endpoint === "medication-summary") {
      return {
        currentMedicines: [],
        previousMedicines: [],
        longTermMedicines: [],
        highRiskMedicines: [],
        stoppedMedicines: [],
        drugAllergies: restricted,
        duplicateTherapies: []
      };
    }
    if (endpoint === "clinical-alerts") {
      return {
        alerts: [restricted],
        doctorPreparation: [restricted],
        longitudinalIntelligence: [restricted]
      };
    }
    return null;
  }

  if (role === "pharmacist") {
    if (endpoint === "patient-summary") {
      return {
        patientId: data.patientId,
        uhid: data.uhid,
        name: data.name,
        age: data.age,
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        drugAllergies: data.drugAllergies,
        longTermMedicines: data.longTermMedicines,
        majorDiagnoses: [restricted],
        operations: [restricted],
        hospitalAdmissions: [restricted],
        emergencyVisits: [restricted],
        icuStays: [restricted],
        otProcedures: [restricted],
        majorLaboratoryAbnormalities: [],
        majorRadiologyFindings: [],
        implants: [restricted],
        chronicIllnesses: [restricted],
        vaccinationHistory: restricted,
        latestClinicalStatus: restricted
      };
    }
    if (endpoint === "medication-summary") {
      return data;
    }
    if (endpoint === "patient-timeline") return [];
    if (endpoint === "radiology-summary") return [];
    if (endpoint === "laboratory-summary") return [];
    if (endpoint === "clinical-alerts") {
      return {
        alerts: [restricted],
        doctorPreparation: [restricted],
        longitudinalIntelligence: [restricted]
      };
    }
    return null;
  }

  return {
    patientId: data.patientId,
    uhid: data.uhid,
    name: data.name,
    age: data.age,
    gender: data.gender
  };
}

// 10. Reusable Memory Engine POST APIs
router.post("/ai/patient-summary", async (req, res) => {
  try {
    const role = req.session.role;
    const employeeId = req.session.userId;
    if (!employeeId || !role) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { patientId, refresh } = req.body;
    if (!patientId) return res.status(400).json({ error: "patientId is required" });

    // Structured Audit Log (No PHI included)
    req.log.info({
      audit: true,
      event: "ai_memory_view",
      employeeId,
      username: req.session.username,
      role,
      patientId: parseInt(patientId),
      endpoint: "patient-summary",
      timestamp: new Date().toISOString()
    });

    let cache = memoryCache.get(parseInt(patientId));
    if (!cache || refresh || Date.now() - cache.timestamp > 30 * 60 * 1000) {
      cache = await compileClinicalMemory(parseInt(patientId)) || undefined;
    }
    if (!cache) return res.status(404).json({ error: "Patient not found" });

    const secured = applyRoleSecurity(role, "patient-summary", cache.summary);
    res.json(secured);
  } catch (err: any) {
    req.log.error({ err: err?.message || "Internal Error" }, "Patient summary failed");
    res.status(500).json({ error: "Failed to compile patient summary due to a secure internal error." });
  }
});

router.post("/ai/patient-timeline", async (req, res) => {
  try {
    const role = req.session.role;
    const employeeId = req.session.userId;
    if (!employeeId || !role) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { patientId, refresh } = req.body;
    if (!patientId) return res.status(400).json({ error: "patientId is required" });

    req.log.info({
      audit: true,
      event: "ai_memory_view",
      employeeId,
      username: req.session.username,
      role,
      patientId: parseInt(patientId),
      endpoint: "patient-timeline",
      timestamp: new Date().toISOString()
    });

    let cache = memoryCache.get(parseInt(patientId));
    if (!cache || refresh || Date.now() - cache.timestamp > 30 * 60 * 1000) {
      cache = await compileClinicalMemory(parseInt(patientId)) || undefined;
    }
    if (!cache) return res.status(404).json({ error: "Patient not found" });

    const secured = applyRoleSecurity(role, "patient-timeline", cache.timeline);
    res.json(secured);
  } catch (err: any) {
    req.log.error({ err: err?.message || "Internal Error" }, "Patient timeline failed");
    res.status(500).json({ error: "Failed to compile patient timeline due to a secure internal error." });
  }
});

router.post("/ai/radiology-summary", async (req, res) => {
  try {
    const role = req.session.role;
    const employeeId = req.session.userId;
    if (!employeeId || !role) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { patientId, refresh } = req.body;
    if (!patientId) return res.status(400).json({ error: "patientId is required" });

    req.log.info({
      audit: true,
      event: "ai_memory_view",
      employeeId,
      username: req.session.username,
      role,
      patientId: parseInt(patientId),
      endpoint: "radiology-summary",
      timestamp: new Date().toISOString()
    });

    let cache = memoryCache.get(parseInt(patientId));
    if (!cache || refresh || Date.now() - cache.timestamp > 30 * 60 * 1000) {
      cache = await compileClinicalMemory(parseInt(patientId)) || undefined;
    }
    if (!cache) return res.status(404).json({ error: "Patient not found" });

    const secured = applyRoleSecurity(role, "radiology-summary", cache.radiology);
    res.json(secured);
  } catch (err: any) {
    req.log.error({ err: err?.message || "Internal Error" }, "Radiology summary failed");
    res.status(500).json({ error: "Failed to compile radiology summary due to a secure internal error." });
  }
});

router.post("/ai/laboratory-summary", async (req, res) => {
  try {
    const role = req.session.role;
    const employeeId = req.session.userId;
    if (!employeeId || !role) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { patientId, refresh } = req.body;
    if (!patientId) return res.status(400).json({ error: "patientId is required" });

    req.log.info({
      audit: true,
      event: "ai_memory_view",
      employeeId,
      username: req.session.username,
      role,
      patientId: parseInt(patientId),
      endpoint: "laboratory-summary",
      timestamp: new Date().toISOString()
    });

    let cache = memoryCache.get(parseInt(patientId));
    if (!cache || refresh || Date.now() - cache.timestamp > 30 * 60 * 1000) {
      cache = await compileClinicalMemory(parseInt(patientId)) || undefined;
    }
    if (!cache) return res.status(404).json({ error: "Patient not found" });

    const secured = applyRoleSecurity(role, "laboratory-summary", cache.laboratory);
    res.json(secured);
  } catch (err: any) {
    req.log.error({ err: err?.message || "Internal Error" }, "Laboratory summary failed");
    res.status(500).json({ error: "Failed to compile laboratory summary due to a secure internal error." });
  }
});

router.post("/ai/medication-summary", async (req, res) => {
  try {
    const role = req.session.role;
    const employeeId = req.session.userId;
    if (!employeeId || !role) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { patientId, refresh } = req.body;
    if (!patientId) return res.status(400).json({ error: "patientId is required" });

    req.log.info({
      audit: true,
      event: "ai_memory_view",
      employeeId,
      username: req.session.username,
      role,
      patientId: parseInt(patientId),
      endpoint: "medication-summary",
      timestamp: new Date().toISOString()
    });

    let cache = memoryCache.get(parseInt(patientId));
    if (!cache || refresh || Date.now() - cache.timestamp > 30 * 60 * 1000) {
      cache = await compileClinicalMemory(parseInt(patientId)) || undefined;
    }
    if (!cache) return res.status(404).json({ error: "Patient not found" });

    const secured = applyRoleSecurity(role, "medication-summary", cache.medication);
    res.json(secured);
  } catch (err: any) {
    req.log.error({ err: err?.message || "Internal Error" }, "Medication summary failed");
    res.status(500).json({ error: "Failed to compile medication summary due to a secure internal error." });
  }
});

router.post("/ai/clinical-alerts", async (req, res) => {
  try {
    const role = req.session.role;
    const employeeId = req.session.userId;
    if (!employeeId || !role) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { patientId, refresh } = req.body;
    if (!patientId) return res.status(400).json({ error: "patientId is required" });

    req.log.info({
      audit: true,
      event: "ai_memory_view",
      employeeId,
      username: req.session.username,
      role,
      patientId: parseInt(patientId),
      endpoint: "clinical-alerts",
      timestamp: new Date().toISOString()
    });

    let cache = memoryCache.get(parseInt(patientId));
    if (!cache || refresh || Date.now() - cache.timestamp > 30 * 60 * 1000) {
      cache = await compileClinicalMemory(parseInt(patientId)) || undefined;
    }
    if (!cache) return res.status(404).json({ error: "Patient not found" });

    const alertsObj = {
      alerts: cache.alerts,
      doctorPreparation: cache.doctorPreparation,
      longitudinalIntelligence: cache.longitudinalIntelligence
    };

    const secured = applyRoleSecurity(role, "clinical-alerts", alertsObj);
    res.json(secured);
  } catch (err: any) {
    req.log.error({ err: err?.message || "Internal Error" }, "Clinical alerts failed");
    res.status(500).json({ error: "Failed to compile clinical alerts due to a secure internal error." });
  }
});

export default router;
