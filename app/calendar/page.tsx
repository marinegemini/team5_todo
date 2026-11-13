'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarGrid } from '@/components/CalendarGrid';
import { DayTodosModal } from '@/components/DayTodosModal';
import { generateCalendarGrid } from '@/lib/calendar';
import type { Holiday, Todo } from '@/lib/db';
import { getSingaporeNow, toSingaporeParts } from '@/lib/timezone';

function parseMonthParam(raw: string | null): { year: number; month: number } {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-').map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m };
  }
  const nowParts = toSingaporeParts(getSingaporeNow());
  return { year: nowParts.year, month: nowParts.month };
}

function CalendarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { year, month } = parseMonthParam(searchParams.get('month'));

  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/todos')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTodos(Array.isArray(d) ? d : []))
      .catch(() => {});

    fetch(`/api/holidays?year=${year}&month=${month}`)
      .then((r) => (r.ok ? r.json() : { holidays: [] }))
      .then((d) => setHolidays(d.holidays ?? []))
      .catch(() => {});
  }, [year, month]);

  const navigate = (nextYear: number, nextMonth: number) => {
    router.replace(`/calendar?month=${nextYear}-${String(nextMonth).padStart(2, '0')}`);
  };

  const handleToday = () => {
    const nowParts = toSingaporeParts(getSingaporeNow());
    navigate(nowParts.year, nowParts.month);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const days = generateCalendarGrid(year, month);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">📅 Calendar</h1>
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              ← Todo List
            </Link>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <CalendarGrid
          year={year}
          month={month}
          days={days}
          todos={todos}
          holidays={holidays}
          onSelectDay={setSelectedDate}
          onNavigate={navigate}
          onToday={handleToday}
        />
      </main>

      {selectedDate && (
        <DayTodosModal
          date={selectedDate}
          todos={todos.filter((t) => t.due_date?.startsWith(selectedDate))}
          holiday={holidays.find((h) => h.date === selectedDate)}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500">
          Loading calendar...
        </div>
      }
    >
      <CalendarContent />
    </Suspense>
  );
}

