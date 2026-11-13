import type { Priority, Todo } from './db';

export interface FilterState {
  search: string;
  priority: Priority | 'all';
  tagId: number | 'all';
  completion: 'all' | 'incomplete' | 'completed';
  dueDateFrom: string | null;
  dueDateTo: string | null;
}

export const DEFAULT_FILTER_STATE: FilterState = {
  search: '',
  priority: 'all',
  tagId: 'all',
  completion: 'all',
  dueDateFrom: null,
  dueDateTo: null,
};

export function hasActiveFilters(f: FilterState): boolean {
  return (
    f.search.trim() !== '' ||
    f.priority !== 'all' ||
    f.tagId !== 'all' ||
    f.completion !== 'all' ||
    f.dueDateFrom !== null ||
    f.dueDateTo !== null
  );
}

export function applyFilters(todos: Todo[], filters: FilterState): Todo[] {
  let result = todos;

  // 1. Search (title OR any subtask title, case-insensitive)
  const query = filters.search.trim().toLowerCase();
  if (query) {
    result = result.filter((todo) => {
      if (todo.title.toLowerCase().includes(query)) return true;
      return (todo.subtasks ?? []).some((st) => st.title.toLowerCase().includes(query));
    });
  }

  // 2. Priority
  if (filters.priority !== 'all') {
    result = result.filter((todo) => todo.priority === filters.priority);
  }

  // 3. Tag
  if (filters.tagId !== 'all') {
    result = result.filter((todo) =>
      (todo.tags ?? []).some((tag) => tag.id === filters.tagId)
    );
  }

  // 4. Completion status
  if (filters.completion === 'incomplete') {
    result = result.filter((todo) => !todo.completed);
  } else if (filters.completion === 'completed') {
    result = result.filter((todo) => todo.completed);
  }

  // 5. Due date range
  if (filters.dueDateFrom || filters.dueDateTo) {
    result = result.filter((todo) => {
      if (!todo.due_date) return false;
      const due = todo.due_date.slice(0, 10);
      if (filters.dueDateFrom && due < filters.dueDateFrom) return false;
      if (filters.dueDateTo && due > filters.dueDateTo) return false;
      return true;
    });
  }

  return result;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string;
}

const PRESETS_KEY = 'todo-app:filter-presets';

export function loadPresets(): FilterPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePreset(preset: FilterPreset): FilterPreset[] {
  const presets = [...loadPresets(), preset];
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  return presets;
}

export function deletePreset(id: string): FilterPreset[] {
  const presets = loadPresets().filter((p) => p.id !== id);
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  return presets;
}

