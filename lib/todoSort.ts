import { PRIORITY_ORDER, type Priority, type Todo } from './types';

export function validatePriority(value: unknown): Priority {
  if (value === undefined || value === null) return 'medium';
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  throw new Error(`Invalid priority: ${String(value)}. Must be 'high', 'medium', or 'low'.`);
}

export function compareTodos(a: Todo, b: Todo): number {
  const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (priorityDiff !== 0) return priorityDiff;

  if (a.due_date && b.due_date) {
    const dueDiff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (dueDiff !== 0) return dueDiff;
  } else if (a.due_date && !b.due_date) {
    return -1;
  } else if (!a.due_date && b.due_date) {
    return 1;
  }

  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort(compareTodos);
}

export function sectionTodos(todos: Todo[], now: Date) {
  const nowMs = now.getTime();
  const incomplete = todos.filter((t) => !t.completed);
  const overdue = sortTodos(
    incomplete.filter((t) => t.due_date !== null && new Date(t.due_date).getTime() < nowMs)
  );
  const pending = sortTodos(
    incomplete.filter((t) => t.due_date === null || new Date(t.due_date).getTime() >= nowMs)
  );
  const completed = [...todos]
    .filter((t) => t.completed)
    .sort(
      (a, b) =>
        new Date(b.updated_at ?? b.created_at).getTime() -
        new Date(a.updated_at ?? a.created_at).getTime()
    );

  return { overdue, pending, completed };
}
