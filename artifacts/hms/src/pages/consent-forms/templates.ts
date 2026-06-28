export interface ConsentTemplate {
  type: "admission" | "surgery" | "anaesthesia" | "refusal" | "discharge";
  title: string;
  description: string;
  variables: { key: string; label: string; type?: "text" | "textarea" }[];
  body: string;
}

export const CONSENT_TEMPLATES: ConsentTemplate[] = [
  {
    type: "admission",
    title: "General Consent for Hospital Admission & Treatment",
    description: "Standard inpatient admission consent — diagnostic procedures, routine treatment, photography for medical records.",
    variables: [
      { key: "admittingDoctor", label: "Admitting Doctor" },
      { key: "provisionalDiagnosis", label: "Provisional Diagnosis", type: "textarea" },
    ],
    body: `I, {{patientName}} (UHID: {{patientUhid}}), aged {{patientAge}} years, residing at {{patientAddress}}, hereby voluntarily consent to admission and treatment at {{entityName}} under the care of {{admittingDoctor}}.

PROVISIONAL DIAGNOSIS: {{provisionalDiagnosis}}

I CONSENT TO:
1. Such routine diagnostic procedures, laboratory investigations, radiological examinations, and treatments as may be deemed necessary by the treating doctor.
2. Administration of medications, intravenous fluids, blood products (if required, separate consent will be obtained), and standard nursing care.
3. Photography or video recording for medical records, teaching, or research purposes (with identifying features anonymised).
4. The use of medical students, residents, or other trainees as part of my care under qualified supervision.

I UNDERSTAND THAT:
- No guarantee or assurance has been given to me about the result of treatment.
- I have been explained the nature of my condition in a language I understand.
- I may withdraw this consent at any time, and any such withdrawal shall not affect my future care.
- I am responsible for all hospital charges as per the entity's published rate card.

I have read (or had read to me) and understood the contents of this form.`,
  },
  {
    type: "surgery",
    title: "Informed Consent for Surgical Procedure",
    description: "High-risk procedure consent — explains nature, alternatives, risks, complications, and authorises additional procedures if required.",
    variables: [
      { key: "procedureName", label: "Procedure Name" },
      { key: "surgeonName", label: "Surgeon" },
      { key: "indication", label: "Indication / Reason", type: "textarea" },
      { key: "risks", label: "Specific Risks Discussed", type: "textarea" },
    ],
    body: `I, {{patientName}} (UHID: {{patientUhid}}), aged {{patientAge}} years, hereby authorise Dr. {{surgeonName}} and such assistants as may be selected to perform upon me the following operation:

PROCEDURE: {{procedureName}}
INDICATION: {{indication}}

NATURE & PURPOSE explained: I have been informed of the nature, purpose, expected benefits, and likely outcome of the proposed procedure.

ALTERNATIVES: I have been informed about alternative methods of treatment, including their risks and benefits, and the consequences of refusing treatment.

RISKS & COMPLICATIONS: The following risks have been specifically explained to me:
{{risks}}

In addition, I understand that any surgical procedure carries general risks including but not limited to: bleeding, infection, allergic reaction to anaesthesia, blood clot formation, organ injury, scarring, and in rare cases, death.

ADDITIONAL PROCEDURES: I authorise the surgeon to perform such additional or alternative operations or procedures as may be deemed necessary or advisable during the course of the planned procedure to deal with unforeseen findings or emergencies.

DISPOSAL OF TISSUES: I consent to the examination and disposal by hospital authorities of any tissues or parts that may be removed.

NO GUARANTEE: I acknowledge that no guarantee or assurance has been given to me as to the results that may be obtained.

I have read this form and have had the opportunity to ask questions, all of which have been answered to my satisfaction.`,
  },
  {
    type: "anaesthesia",
    title: "Consent for Administration of Anaesthesia",
    description: "Pre-anaesthesia consent — type of anaesthesia, fasting compliance, anaesthesia-specific risks.",
    variables: [
      { key: "anaesthesiaType", label: "Type of Anaesthesia" },
      { key: "anaesthetistName", label: "Anaesthetist" },
      { key: "asaGrade", label: "ASA Grade" },
    ],
    body: `I, {{patientName}} (UHID: {{patientUhid}}), aged {{patientAge}} years, consent to the administration of anaesthesia by Dr. {{anaesthetistName}} and team.

TYPE OF ANAESTHESIA PROPOSED: {{anaesthesiaType}}
ASA PHYSICAL STATUS GRADE: {{asaGrade}}

I CONFIRM THAT:
1. I have observed the prescribed period of fasting (NPO) — no solid food for ≥6 hours and no clear fluids for ≥2 hours.
2. I have disclosed all my current medications, including over-the-counter drugs and herbal supplements.
3. I have disclosed all known allergies, prior anaesthesia exposures, and any adverse reactions.
4. I have disclosed any history of bleeding disorders, heart disease, lung disease, kidney disease, diabetes, or any other major illness.

RISKS EXPLAINED: I have been informed of the risks specific to the proposed anaesthesia, which may include — but are not limited to — sore throat, nausea/vomiting, dental injury, awareness during anaesthesia, allergic/anaphylactic reaction, breathing difficulty, nerve injury (with regional/spinal blocks), post-dural puncture headache, hypotension, cardiac arrhythmia, and in extremely rare cases, brain damage or death.

CHANGE OF TECHNIQUE: I consent to a change in the anaesthesia technique if circumstances during the procedure make it advisable in the opinion of the anaesthetist.

POST-OPERATIVE PAIN MANAGEMENT: I consent to such post-operative analgesic management (including epidural, PCA, or IV analgesia) as may be deemed appropriate.

I have understood the above and had my questions answered.`,
  },
  {
    type: "refusal",
    title: "Refusal of Treatment / LAMA (Leave Against Medical Advice)",
    description: "When patient declines recommended treatment, leaves AMA, or refuses specific intervention (transfusion, surgery, etc).",
    variables: [
      { key: "refusedTreatment", label: "Treatment Being Refused", type: "textarea" },
      { key: "consequencesExplained", label: "Consequences Explained", type: "textarea" },
      { key: "reason", label: "Reason for Refusal", type: "textarea" },
    ],
    body: `I, {{patientName}} (UHID: {{patientUhid}}), aged {{patientAge}} years, after having received complete information about my condition and the recommended treatment, hereby REFUSE the following:

TREATMENT BEING REFUSED: {{refusedTreatment}}

REASON FOR REFUSAL: {{reason}}

I ACKNOWLEDGE THAT:
1. The treating doctor has explained my condition, the recommended treatment, and the expected benefits in a language I understand.
2. The following potential consequences of refusing treatment have been clearly explained to me:
{{consequencesExplained}}
3. I have been informed that delay in receiving the recommended treatment may significantly worsen my condition, lead to permanent disability, or result in death.
4. I have been offered alternative treatment options, where applicable.
5. I am taking this decision of my own free will, while being mentally competent and not under the influence of any sedating medication.
6. I release {{entityName}}, the treating doctors, nursing staff, and the management from any responsibility or liability arising out of my refusal of the recommended treatment or my decision to leave against medical advice (LAMA).

The hospital remains willing to provide any treatment I may consent to in the future and to receive me again if I change my mind.`,
  },
  {
    type: "discharge",
    title: "Discharge Acknowledgement & Instructions",
    description: "Patient acknowledges discharge condition, has received discharge summary, medications, and follow-up instructions.",
    variables: [
      { key: "dischargeDiagnosis", label: "Discharge Diagnosis", type: "textarea" },
      { key: "treatmentSummary", label: "Treatment Summary", type: "textarea" },
      { key: "followUpInstructions", label: "Follow-Up Instructions", type: "textarea" },
      { key: "medications", label: "Medications at Discharge", type: "textarea" },
    ],
    body: `I, {{patientName}} (UHID: {{patientUhid}}), aged {{patientAge}} years, acknowledge my discharge from {{entityName}} on this day.

DISCHARGE DIAGNOSIS:
{{dischargeDiagnosis}}

TREATMENT SUMMARY:
{{treatmentSummary}}

MEDICATIONS AT DISCHARGE:
{{medications}}

FOLLOW-UP INSTRUCTIONS:
{{followUpInstructions}}

I ACKNOWLEDGE & CONFIRM:
1. I have received a copy of my discharge summary, including diagnosis, treatment received, and prescribed medications.
2. The discharge medications, dosage schedule, and duration have been explained to me, and I understand them.
3. The follow-up plan, including next appointment date, investigations to be performed before follow-up, and warning signs that should prompt immediate return to the hospital, has been clearly explained.
4. Diet, activity restrictions, and lifestyle modifications have been discussed.
5. I have been informed about the contact number of the hospital for any emergency consultation.
6. I have settled all hospital dues, or arrangements have been made for the same.

I have had the opportunity to ask questions about my condition and discharge plan, all of which have been answered to my satisfaction.`,
  },
];
