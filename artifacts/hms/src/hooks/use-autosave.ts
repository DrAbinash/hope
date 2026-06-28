import { useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useDebouncedAutosave<T>(
  value: T,
  save: (v: T) => Promise<void>,
  delayMs = 800,
  enabled = true,
) {
  const [state, setState] = useState<SaveState>("idle");
  const initialRef = useRef(true);
  const lastSavedRef = useRef<T>(value);
  const seqRef = useRef(0);
  const completedSeqRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (initialRef.current) {
      initialRef.current = false;
      lastSavedRef.current = value;
      return;
    }
    if (JSON.stringify(value) === JSON.stringify(lastSavedRef.current)) return;
    setState("saving");
    const mySeq = ++seqRef.current;
    const t = setTimeout(async () => {
      try {
        await save(value);
        if (mySeq < completedSeqRef.current) return;
        completedSeqRef.current = mySeq;
        lastSavedRef.current = value;
        if (mySeq === seqRef.current) setState("saved");
      } catch {
        if (mySeq === seqRef.current) setState("error");
      }
    }, delayMs);
    return () => clearTimeout(t);
  }, [value, enabled, delayMs, save]);

  return state;
}
