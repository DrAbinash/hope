const ALLOWED = /^\/(objects|public-objects)\/[A-Za-z0-9._\/-]+$/;

export function toServedUrl(p?: string | null): string {
  if (!p) return "";
  if (ALLOWED.test(p)) return `/api/storage${p}`;
  return "";
}
