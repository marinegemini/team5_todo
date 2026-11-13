import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCalendarGrid } from '../lib/calendar';
import type { Todo } from '../lib/db';
import { applyFilters, DEFAULT_FILTER_STATE } from '../lib/filters';
import { calculateNextDueDate } from '../lib/recurrence';
import { calculateProgress } from '../lib/subtaskProgress';
import { sortTodos, validatePriority } from '../lib/todoSort';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 1,
    user_id: 1,
    title: 'Sample Todo',
    completed: false,
    due_date: null,
    priority: 'medium',
    is_recurring: false,
    recurrence_pattern: null,
    reminder_minutes: null,
    last_notification_sent: null,
    created_at: '2026-01-01T00:00:00+08:00',
    updated_at: null,
    subtasks: [],
    tags: [],
    ...overrides,
  };
}

test('validatePriority accepts valid values and defaults null/undefined', () => {
  assert.equal(validatePriority('high'), 'high');
  assert.equal(validatePriority('medium'), 'medium');
  assert.equal(validatePriority('low'), 'low');
  assert.equal(validatePriority(undefined), 'medium');
  assert.equal(validatePriority(null), 'medium');
  assert.throws(() => validatePriority('urgent'));
  assert.throws(() => validatePriority('HIGH'));
});

test('sortTodos orders by priority, then due_date asc (null last), then created_at desc without mutating', () => {
  const input = [
    makeTodo({ id: 1, priority: 'low', due_date: null }),
    makeTodo({ id: 2, priority: 'medium', due_date: '2026-11-20T09:00:00+08:00' }),
    makeTodo({ id: 3, priority: 'high', due_date: '2026-11-15T09:00:00+08:00' }),
    makeTodo({ id: 4, priority: 'high', due_date: '2026-11-14T09:00:00+08:00' }),
    makeTodo({ id: 5, priority: 'low', due_date: '2026-11-15T09:00:00+08:00' }),
  ];
  const snapshot = input.map((t) => t.id);
  const sorted = sortTodos(input);
  assert.deepEqual(
    sorted.map((t) => t.id),
    [4, 3, 2, 5, 1]
  );
  assert.deepEqual(
    input.map((t) => t.id),
    snapshot
  );
});

test('calculateNextDueDate handles daily, weekly, monthly clamping, and leap-year yearly clamping', () => {
  assert.equal(
    calculateNextDueDate('2025-11-10T14:00:00+08:00', 'daily'),
    '2025-11-11T14:00:00+08:00'
  );
  assert.equal(
    calculateNextDueDate('2025-11-10T14:00:00+08:00', 'weekly'),
    '2025-11-17T14:00:00+08:00'
  );
  assert.equal(
    calculateNextDueDate('2025-01-31T09:00:00+08:00', 'monthly'),
    '2025-02-28T09:00:00+08:00'
  );
  assert.equal(
    calculateNextDueDate('2024-01-31T09:00:00+08:00', 'monthly'),
    '2024-02-29T09:00:00+08:00'
  );
  assert.equal(
    calculateNextDueDate('2025-12-31T09:00:00+08:00', 'monthly'),
    '2026-01-31T09:00:00+08:00'
  );
  assert.equal(
    calculateNextDueDate('2024-02-29T09:00:00+08:00', 'yearly'),
    '2025-02-28T09:00:00+08:00'
  );
});

test('calculateProgress computes completed, total, and rounded percent', () => {
  assert.deepEqual(calculateProgress([]), { completed: 0, total: 0, percent: 0 });
  assert.deepEqual(
    calculateProgress([
      { id: 1, todo_id: 1, title: 'a', completed: true, position: 0, created_at: '' },
      { id: 2, todo_id: 1, title: 'b', completed: false, position: 1, created_at: '' },
      { id: 3, todo_id: 1, title: 'c', completed: true, position: 2, created_at: '' },
    ]),
    { completed: 2, total: 3, percent: 67 }
  );
});

test('applyFilters filters by title, subtask title, priority, tag, completion, and date range', () => {
  const todos = [
    makeTodo({
      id: 1,
      title: 'Prepare deck',
      priority: 'high',
      due_date: '2026-11-15T10:00:00+08:00',
      subtasks: [
        { id: 10, todo_id: 1, title: 'Rehearse speech', completed: false, position: 0, created_at: '' },
      ],
      tags: [{ id: 5, user_id: 1, name: 'Work', color: '#3B82F6', created_at: '' }],
    }),
    makeTodo({
      id: 2,
      title: 'Buy milk',
      completed: true,
      priority: 'low',
      due_date: '2026-11-20T10:00:00+08:00',
    }),
  ];

  assert.equal(
    applyFilters(todos, { ...DEFAULT_FILTER_STATE, search: 'rehearse' }).length,
    1
  );
  assert.equal(
    applyFilters(todos, { ...DEFAULT_FILTER_STATE, priority: 'high', tagId: 5 }).length,
    1
  );
  assert.equal(
    applyFilters(todos, { ...DEFAULT_FILTER_STATE, completion: 'completed' })[0].id,
    2
  );
  assert.equal(
    applyFilters(todos, { ...DEFAULT_FILTER_STATE, dueDateFrom: '2026-11-18' })[0].id,
    2
  );
});

test('generateCalendarGrid emits 42 cells and handles leap year February 2028', () => {
  const grid = generateCalendarGrid(2028, 2);
  assert.equal(grid.length, 42);
  const currentDays = grid.filter((c) => c.isCurrentMonth);
  assert.equal(currentDays.length, 29);
  assert.equal(currentDays[28].date, '2028-02-29');
  assert.equal(grid[0].isWeekend, true); // Sunday
  assert.equal(grid[6].isWeekend, true); // Saturday
  assert.equal(grid[1].isWeekend, false); // Monday
});

