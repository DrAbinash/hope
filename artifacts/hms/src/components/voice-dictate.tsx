import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onResult: (text: string) => void;
  lang?: string;
  title?: string;
  className?: string;
  size?: "icon" | "sm";
}

function getSR(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function detachAndStop(r: any) {
  if (!r) return;
  try { r.onresult = null; r.onerror = null; r.onend = null; r.onstart = null; } catch {}
  try { r.stop(); } catch {}
  try { r.abort?.(); } catch {}
}

export function VoiceDictate({ onResult, lang = "en-IN", title, className, size = "icon" }: Props) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      detachAndStop(recRef.current);
      recRef.current = null;
    };
  }, []);

  function toggle() {
    const SR = getSR();
    if (!SR) {
      toast.error("Voice dictation isn't supported in this browser. Try Chrome.");
      return;
    }
    if (listening || startingRef.current) {
      detachAndStop(recRef.current);
      recRef.current = null;
      startingRef.current = false;
      setListening(false);
      return;
    }
    startingRef.current = true;
    detachAndStop(recRef.current);
    const r = new SR();
    r.lang = lang;
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e: any) => {
      if (!mountedRef.current) return;
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      txt = txt.trim();
      if (txt) onResult(txt);
    };
    r.onerror = (e: any) => {
      if (!mountedRef.current) return;
      const msg = e?.error === "not-allowed" ? "Microphone permission denied" :
                  e?.error === "no-speech" ? "No speech detected" :
                  `Voice error: ${e?.error || "unknown"}`;
      toast.error(msg);
      startingRef.current = false;
      setListening(false);
    };
    r.onend = () => {
      if (!mountedRef.current) return;
      startingRef.current = false;
      setListening(false);
    };
    r.onstart = () => {
      if (!mountedRef.current) return;
      startingRef.current = false;
      setListening(true);
    };
    recRef.current = r;
    try {
      r.start();
    } catch (err: any) {
      startingRef.current = false;
      toast.error("Could not start mic: " + err.message);
    }
  }

  const ariaLabel = listening ? `Stop dictation${title ? ` for ${title}` : ""}` : `Dictate ${title || "field"} (${lang})`;

  return (
    <Button
      type="button"
      variant={listening ? "destructive" : "outline"}
      size={size}
      className={className ?? (size === "icon" ? "h-7 w-7" : "h-7 px-2")}
      onClick={toggle}
      title={ariaLabel}
      aria-label={ariaLabel}
      aria-pressed={listening}
      data-testid={`voice-dictate-${title?.toLowerCase().replace(/\s+/g, "-") || "field"}`}
    >
      {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
    </Button>
  );
}
