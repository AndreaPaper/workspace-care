// Due-date rules for periodic checks. Dates are handled as local calendar days
// (the app runs on the user's own PC) and stored as "YYYY-MM-DD 00:00:00.000Z".

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function todayLocal() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function format(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' 00:00:00.000Z';
}

// Day `day` of the month containing `year`/`month`, clamped to the month length.
function dayOfMonth(year, month, day) {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

// 1 = Monday ... 7 = Sunday. First such weekday at or after `start`.
function weekdayOnOrAfter(start, giorno) {
  const target = giorno % 7; // JS: 0 = Sunday
  const delta = (target - start.getDay() + 7) % 7;
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + delta);
}

// First due date for a new or modified check: the next occurrence from today, today included.
function initialDue(frequenza, giorno, today) {
  if (frequenza === 'settimanale') return weekdayOnOrAfter(today, giorno);
  const thisMonth = dayOfMonth(today.getFullYear(), today.getMonth(), giorno);
  return thisMonth >= today ? thisMonth : dayOfMonth(today.getFullYear(), today.getMonth() + 1, giorno);
}

// Next due date once the check has been done today. Counted from today, not from the old due
// date, so a late check does not leave a backlog of overdue occurrences.
function nextAfterDone(frequenza, giorno, today) {
  if (frequenza === 'settimanale') {
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    return weekdayOnOrAfter(tomorrow, giorno);
  }
  const months = frequenza === 'trimestrale' ? 3 : 1;
  return dayOfMonth(today.getFullYear(), today.getMonth() + months, giorno);
}

module.exports = { todayLocal, format, initialDue, nextAfterDone };
