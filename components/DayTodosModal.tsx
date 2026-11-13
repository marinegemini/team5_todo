'use client';

import type { Holiday, Priority, Todo } from '@/lib/db';

const PRIORITY_BADGES: Record<Priority, string> = {
  high: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
  medium:
    'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700',
  low: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700',
};

export function DayTodosModal({
  date,
  todos,
  holiday,
  onClose,
}: {
  date: string;
  todos: Todo[];
  holiday?: Holiday;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{date}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {holiday && (
          <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200 font-medium">
            🎉 Public Holiday: {holiday.name}
          </div>
        )}

        {todos.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No todos due on this date.
          </p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {todos.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <input type="checkbox" checked={t.completed} readOnly className="h-4 w-4" />
                  <span
                    className={`text-sm truncate ${
                      t.completed
                        ? 'line-through text-gray-400'
                        : 'text-gray-800 dark:text-gray-100'
                    }`}
                  >
                    {t.title}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${
                    PRIORITY_BADGES[t.priority]
                  }`}
                >
                  {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

