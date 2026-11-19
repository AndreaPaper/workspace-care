/**
 * Browser-side mirror of backend/pb_hooks/lib/scadenze.js, used only to tell the user
 * "the next one will be on …" before a check is registered. The server stays the source of truth.
 */
import { CheckFrequency } from '../models/models';

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function dayOfMonth(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

/** 1 = Monday … 7 = Sunday: first such weekday at or after `start`. */
function weekdayOnOrAfter(start: Date, giorno: number): Date {
  const delta = (giorno % 7 - start.getDay() + 7) % 7;
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + delta);
}

/** Next due day (YYYY-MM-DD) once the check is done on `today`. */
export function nextAfterDone(frequency: CheckFrequency, giorno: number, today = new Date()): string {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (frequency === 'settimanale') return fmt(weekdayOnOrAfter(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1), giorno));
  if (frequency === 'bisettimanale') return fmt(weekdayOnOrAfter(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 8), giorno));
  const months = frequency === 'trimestrale' ? 3 : 1;
  return fmt(dayOfMonth(t.getFullYear(), t.getMonth() + months, giorno));
}
