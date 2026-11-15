const dayMs = 86400000;
const minuteMs = 60000;
const vietnamOffsetMs = 7 * 60 * minuteMs;

export function vietnamDate(now = new Date()) {
  return new Date(now.getTime() + vietnamOffsetMs).toISOString().slice(0, 10);
}

export function calendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    return null;
  return date;
}

export function occurrenceAt(date, time) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    date.getTime() + (hours * 60 + minutes) * minuteMs - vietnamOffsetMs,
  );
}

export function firstOccurrence(rule) {
  const start = new Date(rule.recurrenceStart);
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(start.getTime() + offset * dayMs);
    if (rule.recurrenceEnd && date > new Date(rule.recurrenceEnd)) return null;
    if (rule.recurrenceWeekdays.includes(date.getUTCDay() || 7))
      return occurrenceAt(date, rule.startTime);
  }
  return null;
}

export function recurringOverlap(first, second) {
  if (first.startTime >= second.endTime || first.endTime <= second.startTime)
    return false;
  const start = new Date(
    Math.max(
      new Date(first.recurrenceStart).getTime(),
      new Date(second.recurrenceStart).getTime(),
    ),
  );
  const end = Math.min(
    first.recurrenceEnd ? new Date(first.recurrenceEnd).getTime() : Infinity,
    second.recurrenceEnd ? new Date(second.recurrenceEnd).getTime() : Infinity,
  );
  for (const weekday of first.recurrenceWeekdays) {
    if (!second.recurrenceWeekdays.includes(weekday)) continue;
    const offset = (weekday - (start.getUTCDay() || 7) + 7) % 7;
    if (start.getTime() + offset * dayMs <= end) return true;
  }
  return false;
}

export function recurringOverlapsSlot(rule, slot) {
  const localStart = new Date(
    new Date(slot.startsAt).getTime() + vietnamOffsetMs,
  );
  const localEnd = new Date(new Date(slot.endsAt).getTime() + vietnamOffsetMs);
  const firstDay = Date.UTC(
    localStart.getUTCFullYear(),
    localStart.getUTCMonth(),
    localStart.getUTCDate(),
  );
  const lastDay = Date.UTC(
    localEnd.getUTCFullYear(),
    localEnd.getUTCMonth(),
    localEnd.getUTCDate(),
  );
  for (let dateMs = firstDay; dateMs <= lastDay; dateMs += dayMs) {
    const date = new Date(dateMs);
    if (
      date < new Date(rule.recurrenceStart) ||
      (rule.recurrenceEnd && date > new Date(rule.recurrenceEnd))
    )
      continue;
    if (!rule.recurrenceWeekdays.includes(date.getUTCDay() || 7)) continue;
    if (
      occurrenceAt(date, rule.startTime) < new Date(slot.endsAt) &&
      occurrenceAt(date, rule.endTime) > new Date(slot.startsAt)
    )
      return true;
  }
  return false;
}
