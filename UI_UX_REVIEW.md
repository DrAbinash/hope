# UI/UX Review
**Hope NeuroTrauma & MultiSpeciality Hospital ERP**
**Audit Date:** 2026-06-29

## Overall Assessment

The UI is built on shadcn/ui + Tailwind CSS v4 with a consistent design language. Navigation is sidebar-based with role-based filtering. Most pages follow a consistent pattern: page title + filter bar + data table or card grid.

## Strengths
- Consistent shadcn/ui component usage across all pages
- Sonner toast notifications used uniformly for success/error feedback
- Role-based navigation correctly hides unauthorized modules
- Print layouts for OPD prescriptions and billing use raw canvas coordinates (preserved per blueprint warning)
- Framer Motion animations on page transitions (subtle and appropriate)

## Issues Found

### HIGH — No Global Error Boundary
**Fixed:** `main.tsx` now wraps `<App>` in `<ErrorBoundary>`. Previously, any React render crash produced a blank white screen with no recovery option.

### HIGH — 7 Pharmacy Routes Unguarded
**Fixed:** Added 7 missing entries to `MODULE_CATALOG` in `permissions-catalog.ts`. Previously, `/pharmacy/barcode-scan`, `/pharmacy/pmjay-claims`, `/pharmacy/drug-licences`, `/pharmacy/consignment-stock`, `/pharmacy/abc-ved-fsn`, `/pharmacy/vendor-schemes`, `/pharmacy/kpi-scorecard` were accessible to all authenticated users regardless of role.

### MEDIUM — OPD Page Too Large (1,117 Lines)
`artifacts/hms/src/pages/opd/[id].tsx` combines clinical notes, prescription editor, AI draft panel, voice dictation, IPD conversion dialog, and autosave in a single component. This makes it hard to maintain and debug.

**Recommended refactor (non-breaking):**
1. Extract `<PrescriptionEditor>` component (rx state, medicine search, template apply)
2. Extract `<ClinicalNotesForm>` component (chief complaints, diagnosis, advice fields)
3. Extract `<AiDraftPanel>` component (AI loading, transparency info, accept/discard)
4. Extract `<IpdConversionDialog>` component (ward/bed selection, conversion form)

### MEDIUM — Demo Data in ai-finance.tsx
Hardcoded mock reconciliation entry (`"Ramesh Kumar"`, `matchedPharmacySaleId: 9011`) appears in production code. This should be removed and replaced with real AI-matched suggestions from the backend.

### MEDIUM — Dead UI State in ai-finance.tsx
`selectedDepartment` state (line ~42) is set via a department Select but never consumed in any query or render logic. The Select control appears to work but has no effect on displayed data.

### LOW — Inconsistent Loading States
- `accounting/ai-finance.tsx`: documents and bankTransactions tables render empty until data arrives (no skeleton)
- `billing-desk/index.tsx`: patient search results appear abruptly without loading feedback

### LOW — Index-Based Key Props
`key={i}` or `key={idx}` used in 157 places across 57 files. In most cases this is acceptable (static lists), but in the prescription drug list in `opd/[id].tsx` where items can be removed mid-list, this can cause incorrect component reuse (stale form values).

**Recommended fix:** Use `medicine_id` or a stable unique identifier as the key for rx list items.

### LOW — Voice Dictation PII Notice
The voice dictation component uses the browser's Web Speech API. In Chrome, audio is routed through Google's servers. No notice is shown to clinical staff.

**Recommended addition:** A one-time toast or tooltip: "Voice dictation uses your browser's built-in speech service. Avoid dictating patient identifiers."

## Navigation Review

| Route | Guard | Status |
|-------|-------|--------|
| All clinical routes | requireAuth | Correct |
| All admin routes | requireAuth + role check | Correct |
| 7 pharmacy sub-routes | Previously unguarded | Fixed via MODULE_CATALOG |
| `/accounting/ai-finance` | Parent `/accounting` guard | Acceptable |

## Print Layout Review
OPD prescription and billing print layouts use hardcoded CSS coordinates for A4/A5 paper. Per blueprint instruction, these were NOT modified. The print.tsx file uses `window.print()` with a dedicated print stylesheet.

## Files Reviewed
`App.tsx`, `main.tsx`, `components/layout.tsx`, `lib/permissions-catalog.ts`, `lib/auth.tsx`, all page files sampled, `components/ui/` (58 components).

## Files Modified
- `artifacts/hms/src/main.tsx` — added ErrorBoundary
- `artifacts/hms/src/lib/permissions-catalog.ts` — added 7 missing pharmacy routes
- `artifacts/hms/src/pages/opd/[id].tsx` — fixed React Hooks violation
