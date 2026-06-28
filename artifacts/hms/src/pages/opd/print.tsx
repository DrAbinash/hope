import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { useGetOpdVisit } from "@workspace/api-client-react";
import { format } from "date-fns";
import { toServedUrl } from "@/lib/asset-url";
import { ShareMenu } from "@/components/share-menu";

interface Patient {
  id: number; uhid: string; name: string; age: number; gender: string; phone: string;
  email?: string | null; address?: string | null; bloodGroup?: string | null;
}
interface Doctor {
  id: number; name: string; specialization: string; qualification?: string | null;
  phone?: string | null; registrationNo?: string | null; signatureUrl?: string | null;
}
interface HospitalSettings {
  hospitalName: string; tagline?: string | null; address?: string | null;
  city?: string | null; state?: string | null; pincode?: string | null;
  mobile?: string | null; email?: string | null; logoUrl?: string | null;
  letterheadUrl?: string | null; letterheadFooterUrl?: string | null;
  signatureUrl?: string | null; prescriptionPrintMode?: string | null;
  billHeader?: string | null;
}

function isPdf(p?: string | null) { return !!p && /\.pdf(\?|$)/i.test(p); }

function AssetEmbed({ path, kind }: { path: string; kind: "header" | "footer" | "signature" }) {
  const url = toServedUrl(path);
  if (!url) return null;
  const widthFull = kind !== "signature";
  const height = kind === "signature" ? 60 : kind === "footer" ? 90 : 110;
  if (isPdf(path)) {
    return (
      <object
        data={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
        type="application/pdf"
        style={{ width: widthFull ? "100%" : 220, height, display: "block", border: "none" }}
        aria-label={kind}
      />
    );
  }
  return (
    <img
      src={url}
      alt={kind}
      style={{
        width: widthFull ? "100%" : "auto",
        height: kind === "signature" ? height : "auto",
        objectFit: "contain",
        display: "block",
      }}
    />
  );
}

function splitLines(s?: string | null): string[] {
  if (!s) return [];
  return s.split(/\r?\n|,|;|→/).map(x => x.trim()).filter(Boolean);
}

function buildPrescriptionShareText(args: {
  patient: Patient | null;
  doctor: Doctor | null;
  hospital: HospitalSettings | null;
  visit: any;
  visitDate: string;
  meds: any[];
  labs: string[];
  radio: string[];
  advice: string[];
  specialAdvise?: string;
  nextDateDisplay?: string;
}): string {
  const { patient, doctor, hospital, visit, visitDate, meds, labs, radio, advice, specialAdvise, nextDateDisplay } = args;
  const lines: string[] = [];
  if (hospital?.hospitalName) lines.push(`*${hospital.hospitalName}*`);
  lines.push(`Prescription — ${visitDate}`);
  lines.push("");
  if (patient) lines.push(`Patient: ${patient.name} (${patient.gender}, ${patient.age}y) · ${patient.uhid}`);
  if (doctor) lines.push(`Doctor: ${doctor.name}${doctor.specialization ? ` (${doctor.specialization})` : ""}`);
  if (visit?.chiefComplaints) lines.push(`Complaints: ${visit.chiefComplaints}`);
  if (visit?.diagnosis) lines.push(`Diagnosis: ${visit.diagnosis}`);
  if (meds.length) {
    lines.push("");
    lines.push("*Medicines:*");
    meds.forEach((m: any, i: number) => {
      const name = m.medicineName || m.name || "—";
      const dose = m.dosage || m.dose || "";
      const freq = m.frequency || m.timing || "";
      const dur = m.duration || "";
      const inst = m.instruction || m.instructions || "";
      const tail = [dose, freq, dur, inst].filter(Boolean).join(" · ");
      lines.push(`${i + 1}. ${name}${tail ? ` — ${tail}` : ""}`);
    });
  }
  if (labs.length) { lines.push(""); lines.push(`Lab tests: ${labs.join(", ")}`); }
  if (radio.length) { lines.push(`Radiology: ${radio.join(", ")}`); }
  if (advice.length) { lines.push(""); lines.push(`Advice: ${advice.join(" / ")}`); }
  if (specialAdvise) lines.push(`Special advice: ${specialAdvise}`);
  if (nextDateDisplay) lines.push(`Next visit: ${nextDateDisplay}`);
  return lines.join("\n");
}

export default function PrescriptionPrint() {
  const [, params] = useRoute("/opd/:id/print");
  const id = parseInt(params?.id || "0");
  const { data: visit, isLoading } = useGetOpdVisit(id);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [hospital, setHospital] = useState<HospitalSettings | null>(null);
  const [loaded, setLoaded] = useState(false);

  const search = useMemo(() => new URLSearchParams(window.location.search), []);
  const queryMode = search.get("mode")?.toLowerCase();
  const settingsDefault = (hospital?.prescriptionPrintMode || "plain").toLowerCase();
  const resolvedMode = queryMode === "plain" || queryMode === "letterpad"
    ? queryMode
    : (settingsDefault === "letterpad" ? "letterpad" : "plain");
  const isLetterpad = resolvedMode === "letterpad";

  useEffect(() => {
    if (!visit) return;
    const visitEntityId = (visit as any).entityId ?? 1;
    (async () => {
      const [pRes, dRes, hRes] = await Promise.all([
        fetch(`/api/patients/${visit.patientId}`, { credentials: "include" }),
        fetch(`/api/doctors/${visit.doctorId}`, { credentials: "include" }),
        fetch(`/api/hospital-settings/${visitEntityId}`, { credentials: "include" }),
      ]);
      if (pRes.ok) setPatient(await pRes.json());
      if (dRes.ok) setDoctor(await dRes.json());
      if (hRes.ok) setHospital(await hRes.json());
      setLoaded(true);
    })();
  }, [visit]);

  useEffect(() => {
    if (!loaded || !visit) return;
    const auto = search.get("auto") !== "0";
    if (!auto) return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [loaded, visit, search]);

  if (isLoading || !visit) return <div className="p-8 text-center text-gray-500">Loading prescription…</div>;

  const meds: any[] = Array.isArray(visit.medicines) ? visit.medicines : [];
  const labs = splitLines((visit as any).labTests);
  const radio = splitLines((visit as any).radiologyTests);
  const advice = splitLines((visit as any).advise);
  const specialAdvise = (visit as any).specialAdvise as string | undefined;
  const nextVisitDate = (visit as any).nextVisitDate as string | undefined;
  const visitDate = visit.visitDate ? format(new Date(visit.visitDate), "dd-MM-yyyy HH:mm") : "";
  const fallbackNext = visit.visitDate ? format(new Date(new Date(visit.visitDate).getTime() + 10 * 86400000), "dd-MM-yyyy") : "";
  const nextDateDisplay = nextVisitDate ? format(new Date(nextVisitDate), "dd-MM-yyyy") : fallbackNext;

  // Letterpad: blank top 35mm + bottom 25mm to clear pre-printed letterhead/footer.
  // Plain: render digital letterhead image (if set) or text header; render footer image at bottom.
  const topPad = isLetterpad ? "35mm" : "0mm";
  const bottomPad = isLetterpad ? "25mm" : "0mm";

  return (
    <div className="prescription-print bg-white text-black mx-auto" style={{ width: "210mm", minHeight: "297mm", padding: "12mm", fontFamily: "Arial, sans-serif", fontSize: "11pt" }}>
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          body { background: white !important; margin: 0; }
          .no-print { display: none !important; }
          .prescription-print { box-shadow: none !important; padding: 0 !important; width: auto !important; min-height: auto !important; }
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .prescription-print h1, .prescription-print h2, .prescription-print h3 { margin: 0; }
        .prescription-print table { border-collapse: collapse; width: 100%; }
        .prescription-print .rx-table th, .prescription-print .rx-table td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
        .prescription-print .rx-table th { background: #f3f4f6; font-weight: 600; }
        .prescription-print .label { font-weight: 600; color: #111; }
        .prescription-print .muted { color: #555; }
      `}</style>

      <div className="no-print mb-4 flex gap-2 justify-end print:hidden" style={{ position: "sticky", top: 0, background: "#fff", padding: "8px 0", borderBottom: "1px solid #eee", zIndex: 10 }}>
        <span style={{ alignSelf: "center", fontSize: 12, color: "#666", marginRight: 8 }}>Mode: <b>{isLetterpad ? "Pre-printed Letter Pad" : "Plain A4 (with letterhead)"}</b></span>
        <a href={`?mode=plain&auto=0`} style={{ padding: "6px 12px", background: isLetterpad ? "#fff" : "#0d4f8b", color: isLetterpad ? "#333" : "#fff", border: "1px solid #ccc", borderRadius: 4, textDecoration: "none", fontSize: 12 }}>Plain A4</a>
        <a href={`?mode=letterpad&auto=0`} style={{ padding: "6px 12px", background: isLetterpad ? "#0d4f8b" : "#fff", color: isLetterpad ? "#fff" : "#333", border: "1px solid #ccc", borderRadius: 4, textDecoration: "none", fontSize: 12 }}>Letter Pad</a>
        <ShareMenu
          doc={{
            title: `Prescription · ${patient?.name || "Patient"} · ${visitDate}`,
            toPhone: patient?.phone,
            toEmail: patient?.email,
            summary: `Hello${patient?.name ? ` ${patient.name}` : ""}, your prescription${hospital?.hospitalName ? ` from ${hospital.hospitalName}` : ""} dated ${visitDate} is ready. Please open the link below to view it.`,
            body: buildPrescriptionShareText({ patient, doctor, hospital, visit, visitDate, meds, labs, radio, advice, specialAdvise, nextDateDisplay }),
            linkUrl: typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?auto=0` : null,
          }}
        />
        <button onClick={() => window.print()} style={{ padding: "6px 14px", background: "#0d4f8b", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>Print</button>
        <button onClick={() => window.close()} style={{ padding: "6px 14px", background: "#fff", color: "#333", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer" }}>Close</button>
      </div>

      <div style={{ paddingTop: topPad, paddingBottom: bottomPad }}>

      {/* Letterhead — only in plain mode */}
      {!isLetterpad && hospital && (
        hospital.letterheadUrl ? (
          <div style={{ marginBottom: 10 }}>
            <AssetEmbed path={hospital.letterheadUrl} kind="header" />
          </div>
        ) : (
          <div style={{ borderBottom: "2px solid #0d4f8b", paddingBottom: 6, marginBottom: 10, textAlign: "center" }}>
            <div style={{ fontSize: "16pt", fontWeight: 700, color: "#0d4f8b" }}>{hospital.hospitalName}</div>
            {hospital.tagline && <div style={{ fontSize: "10pt", fontStyle: "italic" }}>{hospital.tagline}</div>}
            <div style={{ fontSize: "9pt" }}>
              {[hospital.address, hospital.city, hospital.state, hospital.pincode].filter(Boolean).join(", ")}
              {hospital.mobile && ` · Ph: ${hospital.mobile}`}
              {hospital.email && ` · ${hospital.email}`}
            </div>
          </div>
        )
      )}

      <table style={{ marginBottom: 8, fontSize: "10pt" }}>
        <tbody>
          <tr>
            <td style={{ width: "50%", paddingRight: 12, verticalAlign: "top" }}>
              <div><span className="label">Patient Name:</span> {patient ? `${patient.gender === "Male" ? "Mr." : patient.gender === "Female" ? "Ms." : ""} ${patient.name}` : visit.patientName}</div>
              <div><span className="label">Gender/Age:</span> {patient ? `${patient.gender} / ${patient.age} Years` : "—"}</div>
              <div><span className="label">Address:</span> {patient?.address || "—"}</div>
              <div><span className="label">Doctor:</span> {doctor ? doctor.name : visit.doctorName}{doctor?.qualification ? `, ${doctor.qualification}` : ""}{doctor?.registrationNo ? ` Reg. No. ${doctor.registrationNo}` : ""}</div>
            </td>
            <td style={{ width: "50%", verticalAlign: "top" }}>
              <div><span className="label">Patient ID:</span> {patient?.uhid || `#${visit.patientId}`}</div>
              <div><span className="label">Date:</span> {visitDate}</div>
              <div><span className="label">Phone:</span> {patient?.phone || "—"}</div>
              <div><span className="label">Specialisation:</span> {doctor?.specialization || "—"}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {visit.vitals && Object.keys(visit.vitals as any).length > 0 && (
        <div style={{ fontSize: "10pt", marginBottom: 6 }}>
          <span className="label">Vitals: </span>
          {Object.entries(visit.vitals as Record<string, string>).map(([k, v]) => `${k.toUpperCase()}: ${v}`).join("  ·  ")}
        </div>
      )}

      {visit.chiefComplaints && (
        <div style={{ fontSize: "10pt", marginBottom: 6 }}>
          <span className="label">Chief/Present Complaints:</span> {visit.chiefComplaints}
        </div>
      )}

      {visit.diagnosis && (
        <div style={{ fontSize: "10pt", marginBottom: 6 }}>
          <span className="label">Diagnosis:</span> {visit.diagnosis}
        </div>
      )}

      {(labs.length > 0 || radio.length > 0) && (
        <div style={{ fontSize: "10pt", marginBottom: 6 }}>
          <div className="label">Investigation:</div>
          {labs.map((t, i) => <div key={`l${i}`} style={{ marginLeft: 12 }}>→ {t}</div>)}
          {radio.map((t, i) => <div key={`r${i}`} style={{ marginLeft: 12 }}>→ {t} <span className="muted">(Radiology)</span></div>)}
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: "14pt", fontWeight: 700, fontStyle: "italic", marginBottom: 4 }}>R<sub>x</sub></div>
        {meds.length === 0 ? (
          <div className="muted" style={{ fontSize: "10pt" }}>No medicines prescribed.</div>
        ) : (
          <table className="rx-table" style={{ fontSize: "10pt" }}>
            <thead>
              <tr>
                <th style={{ width: 28 }}>#</th>
                <th>Medicine</th>
                <th style={{ width: 70 }}>Dose</th>
                <th style={{ width: 110 }}>When</th>
                <th style={{ width: 110 }}>Frequency</th>
                <th style={{ width: 80 }}>Duration</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {meds.map((m, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{m.medicineName || m.name || "—"}</td>
                  <td>{m.dose || "—"}</td>
                  <td>{m.timing || m.when || "—"}</td>
                  <td>{m.frequency || "—"}</td>
                  <td>{m.duration || "—"}</td>
                  <td>{m.notes || m.instructions || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {advice.length > 0 && (
        <div style={{ fontSize: "10pt", marginTop: 8 }}>
          <span className="label">Advice:</span> {advice.join(" / ")}
        </div>
      )}

      {specialAdvise && (
        <div style={{ fontSize: "10pt", marginTop: 6, padding: "6px 8px", border: "1px dashed #999", background: "#fafaf5" }}>
          <span className="label">Special Advise:</span> {specialAdvise}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 36, fontSize: "10pt", gap: 16 }}>
        {/* Bottom-left: Next Visit */}
        <div style={{ textAlign: "left" }}>
          <div><span className="label">Next Visit Date:</span> {nextDateDisplay || "—"}</div>
        </div>
        {/* Bottom-right: signature artwork + doctor name + degree */}
        <div style={{ minWidth: 220, textAlign: "right" }}>
          {(doctor?.signatureUrl || hospital?.signatureUrl) && (
            <div style={{ display: "inline-block", marginBottom: 2 }}>
              <AssetEmbed path={doctor?.signatureUrl || hospital?.signatureUrl || ""} kind="signature" />
            </div>
          )}
          <div style={{ borderTop: "1px solid #333", paddingTop: 4, display: "inline-block", minWidth: 200, textAlign: "right" }}>
            <div style={{ fontWeight: 700 }}>{doctor?.name || visit.doctorName}</div>
            {doctor?.qualification && <div className="muted">{doctor.qualification}</div>}
            {doctor?.specialization && <div className="muted" style={{ fontSize: "9pt" }}>{doctor.specialization}</div>}
            {doctor?.registrationNo && <div className="muted" style={{ fontSize: "9pt" }}>Reg. No. {doctor.registrationNo}</div>}
          </div>
        </div>
      </div>

      {/* Footer image / PDF — only in plain mode */}
      {!isLetterpad && hospital?.letterheadFooterUrl && (
        <div style={{ marginTop: 16 }}>
          <AssetEmbed path={hospital.letterheadFooterUrl} kind="footer" />
        </div>
      )}

      </div>
    </div>
  );
}
