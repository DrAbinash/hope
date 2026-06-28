import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Package, AlertTriangle } from "lucide-react";

export interface MedicineLite {
  id: number;
  name: string;
  genericName?: string | null;
  stock: number;
  unit?: string | null;
  saleRate?: string | null;
  mrp?: string | null;
  formulation?: string | null;
}

interface Props {
  onSelect: (m: MedicineLite) => void;
  placeholder?: string;
  autoFocus?: boolean;
  clearOnSelect?: boolean;
}

export function MedicineSearch({ onSelect, placeholder = "Type medicine name (e.g. Tab Defocad)…", autoFocus, clearOnSelect = true }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MedicineLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pharmacy/medicines?search=${encodeURIComponent(query.trim())}`, { signal: ctrl.signal, credentials: "include" });
        if (!res.ok) throw new Error("search failed");
        const list: MedicineLite[] = await res.json();
        setResults(list.slice(0, 12));
        setActiveIdx(0);
      } catch (e: any) {
        if (e.name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(m: MedicineLite) {
    onSelect(m);
    if (clearOnSelect) { setQuery(""); setResults([]); }
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(results[activeIdx]); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          autoFocus={autoFocus}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className="pl-8"
          data-testid="medicine-search-input"
        />
      </div>
      {open && query.trim() && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-80 overflow-auto" data-testid="medicine-search-results">
          {loading && <div className="p-3 text-sm text-muted-foreground">Searching…</div>}
          {!loading && results.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">No medicines match "{query}". Add to pharmacy stock first.</div>
          )}
          {results.map((m, i) => {
            const low = m.stock <= 0;
            const warn = m.stock > 0 && m.stock < 10;
            return (
              <button
                type="button"
                key={m.id}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => pick(m)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 border-b last:border-b-0 ${i === activeIdx ? "bg-accent" : "hover:bg-accent/50"}`}
                data-testid={`medicine-option-${m.id}`}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.name}</div>
                  {m.genericName && <div className="text-xs text-muted-foreground truncate">{m.genericName}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {low ? (
                    <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Out of stock</Badge>
                  ) : warn ? (
                    <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700"><Package className="h-3 w-3" />{m.stock} {m.unit || "pcs"}</Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1"><Package className="h-3 w-3" />{m.stock} {m.unit || "pcs"}</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
