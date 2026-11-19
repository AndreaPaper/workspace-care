/** PocketBase dates look like "2026-11-23 00:00:00.000Z"; checks and requests only care about the calendar day. */
export function toDay(value: string): string {
  return (value ?? '').slice(0, 10);
}

export function todayDay(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDay(day: string): string {
  const [y, m, d] = toDay(day).split('-');
  return y ? `${d}/${m}/${y}` : '';
}

/** Date value to store in PocketBase for a calendar day. */
export function toStored(day: string): string {
  return `${day} 00:00:00.000Z`;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative when `to` is earlier. */
export function diffDays(from: string, to: string): number {
  const utc = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** Italian weekday name of a YYYY-MM-DD day, lower case (e.g. "mercoledì"). */
export function weekdayName(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'long' });
}

/** "dd/mm" of a YYYY-MM-DD day. */
export function shortDay(day: string): string {
  const [, m, d] = toDay(day).split('-');
  return `${d}/${m}`;
}

/** "mercoledì 18 novembre" for a YYYY-MM-DD day. */
export function longDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}
