'use client';

import type { CalendarDay } from '@/lib/calendar';
import type { Holiday, Priority, Todo } from '@/lib/db';

const MAX_VISIBLE_TODOS = 3;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRIORITY_PILL_CLASSES: Record<Priority, string> = {
  high: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-200 dark:border-red-700',
  medium:
    'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-200 dark:border-yellow-700',
  low: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700',
};

interface CalendarGridProps {
  year: number;
  month: number;
  days: CalendarDay[];
  todos: Todo[];
  holidays: Holiday[];
  onSelectDay: (date: string) => void;
  onNavigate: (nextYear: number, nextMonth: number) => void;
  onToday: () => void;
}

export function CalendarGrid({
  year,
  month,
  days,
  todos,
  holidays,
  onSelectDay,
  onNavigate,
  onToday,
}: CalendarGridProps) {
  const prevMonth = () => {
    if (month === 1) onNavigate(year - 1, 12);
    else onNavigate(year, month - 1);
  };

  const nextMonth = () => {
    if (month === 12) onNavigate(year + 1, 1);
    else onNavigate(year, month + 1);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Previous month"
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={onToday}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Today
          </button>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Next month"
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            ▶
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayTodos = todos.filter((t) => t.due_date?.startsWith(day.date));
          const visible = dayTodos.slice(0, MAX_VISIBLE_TODOS);
          const overflow = dayTodos.length - visible.length;
          const holiday = holidays.find((h) => h.date === day.date);

          const bgClass = day.isToday
            ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-inset ring-blue-500'
            : day.isWeekend
            ? 'bg-gray-50/80 dark:bg-gray-800/60'
            : 'bg-white dark:bg-gray-800';

          const textOpacity = !day.isCurrentMonth
            ? 'opacity-40'
            : day.isPast
            ? 'opacity-70'
            : '';

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDay(day.date)}
              data-date={day.date}
              className={`min-h-[110px] p-2 border-b border-r border-gray-200 dark:border-gray-700 text-left flex flex-col gap-1 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${bgClass} ${textOpacity}`}
            >
              <span
                className={`text-xs font-semibold ${
                  day.isToday
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {Number(day.date.split('-')[2])}
              </span>

              {holiday && (
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 truncate w-full">
                  🎉 {holiday.name}
                </span>
              )}

              {visible.map((t) => (
                <span
                  key={t.id}
                  className={`text-[11px] px-1.5 py-0.5 rounded border truncate w-full ${
                    PRIORITY_PILL_CLASSES[t.priority]
                  } ${t.completed ? 'line-through opacity-60' : ''}`}
                >
                  {t.title}
                </span>
              ))}

              {overflow > 0 && (
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  +{overflow} more
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

