/**
 * Drug-drug interaction checker.
 *
 * Curated list of clinically significant interactions commonly seen in
 * outpatient practice. Matching is done by generic/salt name (case-insensitive
 * substring) and falls back to the brand/medicine name. This is a screening
 * aid, not a substitute for clinical judgement.
 *
 * To extend, add an entry to `INTERACTIONS` below. Each `drugs` entry is a
 * list of name fragments that should match (any one is enough).
 */

export type InteractionSeverity = "severe" | "moderate" | "minor";

export interface InteractionRule {
  drugs: [string[], string[]];
  severity: InteractionSeverity;
  effect: string;
  advice: string;
}

export interface MedicineForCheck {
  medicineName: string;
  genericName?: string;
}

export interface InteractionWarning {
  severity: InteractionSeverity;
  drugA: string;
  drugB: string;
  effect: string;
  advice: string;
}

const N = (s: string) => s.toLowerCase().normalize("NFKD");

function hay(m: MedicineForCheck): string {
  // Pad with spaces and lowercase, so word-boundary checks work uniformly.
  return ` ${N(m.genericName || "")} ${N(m.medicineName || "")} `;
}

// Word-boundary match: a fragment hits only when it is surrounded by
// non-letter characters in the haystack. This prevents tiny ambiguous
// fragments (e.g. "iron", "soy", "ntg") from matching unrelated brand names
// like "iron**y**" or "**so**lution". Multi-word fragments are matched as
// a whole, with internal whitespace collapsed to a single space.
function frag(f: string): RegExp {
  const norm = N(f).trim().replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${norm}([^a-z0-9]|$)`);
}

function has(h: string, frags: string[]): boolean {
  return frags.some((f) => frag(f).test(h));
}

// Shared synonym lists so a fix in one place propagates everywhere.
const WARFARIN = ["warfarin", "acitrom", "acenocoumarol", "nicoumalone"];
const NITRATES = ["isosorbide", "nitroglycerin", "nicorandil", "glyceryl trinitrate"];

const INTERACTIONS: InteractionRule[] = [
  {
    drugs: [WARFARIN, ["aspirin", "ibuprofen", "diclofenac", "naproxen", "ketorolac", "nimesulide", "indomethacin", "piroxicam", "mefenamic"]],
    severity: "severe",
    effect: "Greatly increased bleeding risk (anticoagulant + NSAID).",
    advice: "Avoid combination. Use paracetamol for analgesia. If unavoidable, monitor INR and watch for GI bleeding.",
  },
  {
    drugs: [WARFARIN, ["ciprofloxacin", "ofloxacin", "levofloxacin", "moxifloxacin", "metronidazole", "fluconazole", "trimethoprim", "co-trimoxazole", "septran", "bactrim"]],
    severity: "severe",
    effect: "Potentiates warfarin → bleeding (CYP2C9/3A4 inhibition).",
    advice: "Recheck INR within 3–5 days; consider 25–50% warfarin dose reduction.",
  },
  {
    drugs: [["aspirin"], ["ibuprofen", "diclofenac", "naproxen"]],
    severity: "moderate",
    effect: "NSAID can blunt cardioprotective effect of aspirin.",
    advice: "Take aspirin ≥2 h before NSAID, or prefer paracetamol.",
  },
  {
    drugs: [["enalapril", "lisinopril", "ramipril", "perindopril", "captopril", "telmisartan", "losartan", "olmesartan", "valsartan", "candesartan"], ["spironolactone", "eplerenone", "amiloride", "triamterene", "potassium chloride"]],
    severity: "severe",
    effect: "Hyperkalemia risk (ACEi/ARB + K-sparing diuretic / K supplement).",
    advice: "Monitor serum potassium and creatinine within 1 week; avoid in CKD stage ≥3 unless specialist advice.",
  },
  {
    drugs: [["enalapril", "lisinopril", "ramipril", "telmisartan", "losartan"], ["ibuprofen", "diclofenac", "naproxen", "indomethacin"]],
    severity: "moderate",
    effect: "Reduced antihypertensive effect; AKI risk in elderly/dehydrated.",
    advice: "Limit NSAID duration; monitor BP and creatinine.",
  },
  {
    drugs: [["clopidogrel"], ["omeprazole", "esomeprazole"]],
    severity: "moderate",
    effect: "Reduced antiplatelet effect (CYP2C19 inhibition).",
    advice: "Switch PPI to pantoprazole or rabeprazole.",
  },
  {
    drugs: [["atorvastatin", "simvastatin", "rosuvastatin", "lovastatin"], ["clarithromycin", "erythromycin", "itraconazole", "ketoconazole"]],
    severity: "severe",
    effect: "Increased statin levels → myopathy/rhabdomyolysis.",
    advice: "Hold statin during the antibiotic/antifungal course, or use azithromycin.",
  },
  {
    drugs: [["atorvastatin", "simvastatin", "rosuvastatin"], ["gemfibrozil", "fenofibrate"]],
    severity: "moderate",
    effect: "Additive myopathy risk.",
    advice: "Prefer fenofibrate over gemfibrozil; warn about muscle pain; check CK if symptoms.",
  },
  {
    drugs: [["digoxin"], ["amiodarone", "verapamil", "diltiazem", "clarithromycin", "erythromycin"]],
    severity: "severe",
    effect: "Increased digoxin level → toxicity (nausea, arrhythmia).",
    advice: "Reduce digoxin dose by ~50% and monitor levels/ECG.",
  },
  {
    drugs: [["sildenafil", "tadalafil", "vardenafil"], NITRATES],
    severity: "severe",
    effect: "Profound hypotension.",
    advice: "Absolute contraindication. Allow ≥24 h (sildenafil) / 48 h (tadalafil) gap.",
  },
  {
    drugs: [["tramadol", "pethidine", "fentanyl"], ["fluoxetine", "sertraline", "escitalopram", "paroxetine", "citalopram", "venlafaxine", "duloxetine", "amitriptyline", "linezolid"]],
    severity: "severe",
    effect: "Serotonin syndrome risk.",
    advice: "Avoid combination; if essential, use lowest doses and monitor for agitation/hyperthermia/clonus.",
  },
  {
    drugs: [["methotrexate"], ["ibuprofen", "diclofenac", "naproxen", "aspirin", "co-trimoxazole", "septran", "bactrim", "trimethoprim"]],
    severity: "severe",
    effect: "Methotrexate toxicity (pancytopenia, mucositis).",
    advice: "Avoid; use paracetamol. If NSAID needed, monitor CBC and renal function closely.",
  },
  {
    drugs: [["theophylline", "aminophylline"], ["ciprofloxacin", "erythromycin", "clarithromycin"]],
    severity: "severe",
    effect: "Theophylline toxicity (seizures, arrhythmia).",
    advice: "Reduce theophylline dose by 50% and monitor levels.",
  },
  {
    drugs: [["ciprofloxacin", "ofloxacin", "levofloxacin", "norfloxacin", "tetracycline", "doxycycline"], ["calcium", "iron", "ferrous", "magnesium", "aluminium", "antacid", "sucralfate", "zinc"]],
    severity: "moderate",
    effect: "Reduced antibiotic absorption (chelation).",
    advice: "Separate doses by ≥2 hours.",
  },
  {
    drugs: [["levothyroxine", "thyroxine", "eltroxin"], ["calcium", "iron", "ferrous", "antacid", "omeprazole", "esomeprazole", "pantoprazole", "rabeprazole", "soy"]],
    severity: "moderate",
    effect: "Reduced thyroxine absorption.",
    advice: "Take thyroxine on empty stomach, ≥4 hours before these drugs.",
  },
  {
    drugs: [["metformin"], ["iodinated contrast", "contrast media"]],
    severity: "moderate",
    effect: "Risk of lactic acidosis with contrast-induced AKI.",
    advice: "Hold metformin 48 h around contrast study if eGFR <60.",
  },
  {
    drugs: [["phenytoin", "carbamazepine", "phenobarbitone", "phenobarbital"], WARFARIN],
    severity: "moderate",
    effect: "Bidirectional CYP induction/inhibition; unpredictable INR.",
    advice: "Recheck INR within a week of starting/stopping; titrate warfarin.",
  },
  {
    drugs: [["fluoxetine", "sertraline", "escitalopram", "paroxetine", "citalopram", "venlafaxine", "duloxetine"], ["aspirin", "ibuprofen", "diclofenac", "naproxen", "clopidogrel", ...WARFARIN]],
    severity: "moderate",
    effect: "Increased GI bleeding risk.",
    advice: "Add PPI cover; counsel on melena/haematemesis.",
  },
  {
    drugs: [["amlodipine", "nifedipine", "felodipine"], ["clarithromycin", "erythromycin", "itraconazole"]],
    severity: "moderate",
    effect: "Increased CCB levels → hypotension/oedema.",
    advice: "Use azithromycin instead, or monitor BP closely.",
  },
  {
    drugs: [["metronidazole", "tinidazole"], WARFARIN],
    severity: "severe",
    effect: "Markedly increases INR.",
    advice: "Reduce warfarin by 25–50%; recheck INR in 3 days.",
  },
  {
    drugs: [["linezolid"], ["fluoxetine", "sertraline", "escitalopram", "paroxetine", "venlafaxine", "duloxetine", "amitriptyline", "tramadol", "pethidine"]],
    severity: "severe",
    effect: "Serotonin syndrome (linezolid is a weak MAOI).",
    advice: "Avoid; if essential, hold serotonergic agent and monitor.",
  },
];

export function checkInteractions(meds: MedicineForCheck[]): InteractionWarning[] {
  if (!meds || meds.length < 2) return [];
  const items = meds.map((m) => ({ m, h: hay(m) }));
  const order: Record<InteractionSeverity, number> = { severe: 0, moderate: 1, minor: 2 };

  // Key by canonical drug-pair only. If multiple rules fire for the same pair
  // we keep the most severe one and merge the effect/advice text.
  const byPair = new Map<string, InteractionWarning>();

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      for (const rule of INTERACTIONS) {
        const [g1, g2] = rule.drugs;
        const match = (has(a.h, g1) && has(b.h, g2)) || (has(a.h, g2) && has(b.h, g1));
        if (!match) continue;
        const labelA = a.m.medicineName;
        const labelB = b.m.medicineName;
        const key = [labelA, labelB].sort().join("||");
        const candidate: InteractionWarning = {
          severity: rule.severity,
          drugA: labelA,
          drugB: labelB,
          effect: rule.effect,
          advice: rule.advice,
        };
        const existing = byPair.get(key);
        if (!existing) {
          byPair.set(key, candidate);
        } else if (order[candidate.severity] < order[existing.severity]) {
          byPair.set(key, candidate);
        } else if (
          order[candidate.severity] === order[existing.severity] &&
          existing.effect !== candidate.effect &&
          !existing.effect.includes(candidate.effect)
        ) {
          byPair.set(key, {
            ...existing,
            effect: `${existing.effect} ${candidate.effect}`,
            advice: existing.advice.includes(candidate.advice)
              ? existing.advice
              : `${existing.advice} ${candidate.advice}`,
          });
        }
      }
    }
  }

  return [...byPair.values()].sort((x, y) => order[x.severity] - order[y.severity]);
}
