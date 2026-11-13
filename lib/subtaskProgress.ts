import type { Subtask } from './db';

export function calculateProgress(subtasks: Subtask[]): {
  completed: number;
  total: number;
  percent: number;
} {
  const total = subtasks.length;
  const completed = subtasks.filter((s) => s.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}

