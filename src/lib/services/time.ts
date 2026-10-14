/** Local calendar day (YYYY-MM-DD) and hour for a timezone, without a date library. */
export function localParts(tz: string, at = new Date()): { day: string; hour: number; label: string } {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false });
  const parts = Object.fromEntries(f.formatToParts(at).map((p) => [p.type, p.value]));
  const label = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(at);
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24, label };
}

export function daysBetween(fromISO: string, toDay: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromISO)) return null;
  const a = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10));
  const b = Date.UTC(+toDay.slice(0, 4), +toDay.slice(5, 7) - 1, +toDay.slice(8, 10));
  return Math.round((b - a) / 86400000);
}
