import { Button } from "@/components/ui/button";

export const HINDI_DOSE = ["1", "½", "2", "1 चम्मच", "1 बूँद", "1-0-1", "1-1-1", "0-0-1"];
export const HINDI_TIMING = ["खाना खाने के बाद", "खाना खाने से पहले", "सुबह खाली पेट", "सोते समय", "After Food", "Before Food"];
export const HINDI_FREQ = ["दिन में एक बार", "दिन में दो बार", "दिन में तीन बार", "ज़रूरत पड़ने पर (SOS)", "OD", "BD", "TDS", "QID"];

// Bilingual advice quick-pick chips (Hindi / English) — mirrors Purnank reference.
export const ADVICE_CHIPS = [
  "मरीज़ मेरी बात नहीं मान रहा है / अगर मेरी बात समझ नहीं आ रहा है तो डॉक्टर बदल लें / If you find it difficult to follow my Advice or understand",
  "ADMIT / मरीज़ को ऑब्ज़रवेशन के लिए एडमिट / भर्ती करना है",
  "दवा लगातार चलने से ही आराम होने की उम्मीद है / दवा अपने मन से बंद नहीं करें / समय से आ कर अपना इलाज करें / Take your medicine regularly",
  "PATIENT IS SERIOUS, IF YOU HAVE ANY OTHER ALTERNATIVE, TRY / मरीज़ की हालत अच्छी नहीं है। आप के पास कोई और रास्ता है तो कोशिश करें",
  "ज़मीन में लैट्रिन पिसाब नहीं करें / कमोड (इंग्लिश टॉयलेट) का प्रयोग करें / पूजा पाठ भी कुर्सी पर करें / AVOID SQUATTING / USE COMODE",
  "REFD.",
  "to stop medicines",
  "Plenty of fluids / खूब पानी पीयें",
  "Rest for 2-3 days / 2-3 दिन आराम करें",
  "Follow up after 7 days / 7 दिन बाद मिलें",
];

// Next-Visit-After presets — mirrors Purnank reference dropdown.
export const NEXT_VISIT_PRESETS: Array<{ label: string; days: number }> = [
  { label: "3 Days", days: 3 },
  { label: "5 Days", days: 5 },
  { label: "1 Week", days: 7 },
  { label: "10 Days", days: 10 },
  { label: "15 Days", days: 15 },
  { label: "20 Days", days: 20 },
  { label: "2 Week", days: 14 },
  { label: "1 Month", days: 30 },
  { label: "2 Month", days: 60 },
  { label: "3 Month", days: 90 },
  { label: "6 Month", days: 180 },
];

export function ChipRow({ items, onPick }: { items: string[]; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {items.map(v => (
        <Button
          key={v}
          type="button"
          size="sm"
          variant="outline"
          className="h-5 px-1.5 text-[10px] rounded font-normal"
          onClick={() => onPick(v)}
          tabIndex={-1}
        >
          {v}
        </Button>
      ))}
    </div>
  );
}
