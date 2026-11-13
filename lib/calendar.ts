import { formatSingaporeDate, getSingaporeNow } from './timezone';

export interface CalendarDay {
  date: string; // YYYY-MM-DD, Singapore-local
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
}

export function generateCalendarGrid(year: number, month: number): CalendarDay[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = firstOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const today = formatSingaporeDate(getSingaporeNow(), 'YYYY-MM-DD');
  const cells: CalendarDay[] = [];
  const totalCells = 42;
  const leadingDays = startWeekday;

  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - leadingDays + 1;
    const cellDate = new Date(Date.UTC(year, month - 1, dayOffset));
    const dateStr = cellDate.toISOString().slice(0, 10);
    const weekday = cellDate.getUTCDay();

    cells.push({
      date: dateStr,
      isCurrentMonth: dayOffset >= 1 && dayOffset <= daysInMonth,
      isToday: dateStr === today,
      isPast: dateStr < today,
      isWeekend: weekday === 0 || weekday === 6,
    });
  }

  return cells;
}

