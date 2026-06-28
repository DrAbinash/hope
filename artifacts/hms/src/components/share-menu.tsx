import { useState } from "react";
import { Share2, MessageCircle, Mail, Link as LinkIcon, Check } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export interface ShareDocument {
  /** Document title used as message heading and email subject. */
  title: string;
  /** Patient phone number in any format; non-digits are stripped. Default country code can be supplied. */
  toPhone?: string | null;
  /** Patient email address (optional). */
  toEmail?: string | null;
  /** Short, PHI-free message that ships in the URL by default (e.g. "Your prescription from Apollo Hospital is ready."). */
  summary: string;
  /** Full-detail body containing PHI. Only embedded when the user explicitly opts in via the "Include details" toggle. */
  body: string;
  /** Public/shareable URL of the document. Defaults to current page URL. */
  linkUrl?: string | null;
  /** Default phone country code if `toPhone` has no leading +/country digits. e.g. "91" for India. */
  defaultCountryCode?: string;
}

function normalizePhone(raw: string | null | undefined, defaultCc = "91"): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  // If it already has a country code (>=11 digits) we keep it; otherwise prepend default.
  if (digits.length === 10) digits = defaultCc + digits;
  return digits;
}

export function ShareMenu({
  doc,
  label = "Share",
  className,
}: {
  doc: ShareDocument;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [includeDetails, setIncludeDetails] = useState(false);

  const link = doc.linkUrl ?? (typeof window !== "undefined" ? window.location.href : "");
  // PHI-aware: default messages contain *only* a friendly summary + link.
  // Full prescription contents only ride along when the user explicitly opts in.
  const messageBody = includeDetails ? doc.body : doc.summary;
  const fullText = link ? `${messageBody}\n\n${link}` : messageBody;
  const phone = normalizePhone(doc.toPhone, doc.defaultCountryCode);

  const waUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(fullText)}`
    : `https://wa.me/?text=${encodeURIComponent(fullText)}`;

  const mailUrl = `mailto:${encodeURIComponent(doc.toEmail || "")}?subject=${encodeURIComponent(doc.title)}&body=${encodeURIComponent(fullText)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link || fullText);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy. Long-press the link instead.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="share-menu-trigger"
          className={
            className ||
            "inline-flex items-center gap-1 px-3 py-1.5 rounded border bg-white text-sm text-gray-700 hover:bg-gray-50"
          }
        >
          <Share2 className="w-4 h-4" />
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Send to patient</DropdownMenuLabel>
        <label
          className="flex items-start gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted rounded"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={includeDetails}
            onChange={(e) => setIncludeDetails(e.target.checked)}
            className="mt-0.5"
            data-testid="share-include-details"
          />
          <span>
            <span className="font-medium">Include details (PHI)</span>
            <br />
            <span className="text-muted-foreground">
              {includeDetails
                ? "Full prescription text will be embedded in the message."
                : "Default: link only, no patient details in URL."}
            </span>
          </span>
        </label>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="share-whatsapp"
            className="flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>WhatsApp{phone ? "" : " (pick contact)"}</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={mailUrl}
            data-testid="share-email"
            className="flex items-center gap-2"
          >
            <Mail className="w-4 h-4 text-sky-600" />
            <span>Email{doc.toEmail ? "" : "…"}</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopy} data-testid="share-copy-link">
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <LinkIcon className="w-4 h-4" />}
          <span>{copied ? "Copied!" : "Copy link"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
