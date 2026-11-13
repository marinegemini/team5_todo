import type { RecurrencePattern } from './db';
import { addDays, fromSingaporeParts, toSingaporeParts } from './timezone';

function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export function calculateNextDueDate(
  currentDueDate: string,
  pattern: RecurrencePattern
): string {
  const { year, month, day, hour, minute } = toSingaporeParts(currentDueDate);

  switch (pattern) {
    case 'daily': {
      return fromSingaporeParts(addDays({ year, month, day }, 1), hour, minute);
    }
    case 'weekly': {
      return fromSingaporeParts(addDays({ year, month, day }, 7), hour, minute);
    }
    case 'monthly': {
      const targetMonth = month === 12 ? 1 : month + 1;
      const targetYear = month === 12 ? year + 1 : year;
      const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
      return fromSingaporeParts(
        { year: targetYear, month: targetMonth, day: clampedDay },
        hour,
        minute
      );
    }
    case 'yearly': {
      const targetYear = year + 1;
      const clampedDay = Math.min(day, daysInMonth(targetYear, month));
      return fromSingaporeParts({ year: targetYear, month, day: clampedDay }, hour, minute);
    }
  }
}

