// Arabic UI, but always Latin (Western) digits in dates — `numberingSystem:"latn"`
// keeps month/label text Arabic while rendering 2026 instead of ٢٠٢٦.

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar", { numberingSystem: "latn", dateStyle: "medium" });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ar", { numberingSystem: "latn", dateStyle: "medium", timeStyle: "short" });
}
