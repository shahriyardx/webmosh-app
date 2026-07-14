/** Format an invoice's sequential number as "#00042" (5-digit padded). */
export function formatInvoiceNumber(n: number | null | undefined): string {
  if (typeof n !== "number") return "#—"
  return `#${n.toString().padStart(5, "0")}`
}
