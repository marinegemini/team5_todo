'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  REMINDER_LABELS,
  type Priority,
  type RecurrencePattern,
  type ReminderMinutes,
  type Subtask,
  type Tag,
  type Template,
  type Todo,
} from '@/lib/types';
import {
  applyFilters,
  DEFAULT_FILTER_STATE,
  deletePreset,
  hasActiveFilters,
  loadPresets,
  savePreset,
  type FilterPreset,
  type FilterState,
} from '@/lib/filters';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { calculateProgress } from '@/lib/subtaskProgress';
import {
  formatSingaporeDate,
  getSingaporeNow,
  parseSingaporeDate,
  toDateTimeLocalValue,
} from '@/lib/timezone';
import { sectionTodos } from '@/lib/todoSort';

const PRIORITY_STYLES: Record<Priority, string> = {
  high: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
  medium:
    'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700',
  low: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_STYLES[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function TagPill({
  tag,
  selected = false,
  onClick,
}: {
  tag: Tag;
  selected?: boolean;
  onClick?: (tag: Tag) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(tag)}
      style={selected ? { backgroundColor: tag.color } : undefined}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
        selected
          ? 'text-white border-transparent'
          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
      }`}
    >
      {selected && <span aria-hidden>✓</span>}
      <span className="truncate max-w-[10rem]">{tag.name}</span>
    </button>
  );
}

function ProgressBar({
  completed,
  total,
  percent,
}: {
  completed: number;
  total: number;
  percent: number;
}) {
  if (total === 0) return null;
  const barColor = percent === 100 ? 'bg-green-500' : 'bg-blue-500';
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>
          {completed}/{total} subtasks
        </span>
        <span>{percent}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-200`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { permission, requestPermission } = useNotifications();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create form state
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('daily');
  const [reminderMinutes, setReminderMinutes] = useState<ReminderMinutes | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  // Edit modal state
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editPattern, setEditPattern] = useState<RecurrencePattern>('daily');
  const [editReminder, setEditReminder] = useState<ReminderMinutes | null>(null);
  const [editTagIds, setEditTagIds] = useState<number[]>([]);

  // Subtasks UI state
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<number, boolean>>({});
  const [subtaskInputs, setSubtaskInputs] = useState<Record<number, string>>({});

  // Filter state
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const debouncedSearch = useDebounce(filters.search, 300);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [presets, setPresets] = useState<FilterPreset[]>(() => loadPresets());
  const [saveFilterModalOpen, setSaveFilterModalOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Tag modal state
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [tagError, setTagError] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('#3B82F6');

  // Template modal state
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplDescription, setTplDescription] = useState('');
  const [tplCategory, setTplCategory] = useState('');
  const [tplOffsetMinutes, setTplOffsetMinutes] = useState('');
  const [tplSubtasks, setTplSubtasks] = useState<string[]>([]);
  const [tplNewSubtask, setTplNewSubtask] = useState('');

  // Export/Import state
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [todosRes, tagsRes, tplRes] = await Promise.all([
        fetch('/api/todos'),
        fetch('/api/tags'),
        fetch('/api/templates'),
      ]);
      if (todosRes.status === 401) {
        router.push('/login');
        return;
      }
      if (todosRes.ok) setTodos(await todosRes.json());
      if (tagsRes.ok) setTags(await tagsRes.json());
      if (tplRes.ok) setTemplates(await tplRes.json());
    } catch {
      setError('Failed to load todos');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchAll();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchAll]);

  // Close edit modal on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingTodo(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // Create Todo
  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      return;
    }

    if (dueDate) {
      const due = parseSingaporeDate(dueDate);
      const minDue = new Date(getSingaporeNow().getTime() + 60_000);
      if (due < minDue) {
        setError('Due date must be at least 1 minute in the future');
        return;
      }
    }

    if (isRecurring && !dueDate) {
      setError('Recurring todos require a due date');
      return;
    }

    const tempId = -Date.now();
    const selectedTagObjects = tags.filter((t) => selectedTagIds.includes(t.id));
    const optimistic: Todo = {
      id: tempId,
      user_id: 0,
      title: trimmed,
      completed: false,
      due_date: dueDate ? parseSingaporeDate(dueDate).toISOString() : null,
      priority,
      is_recurring: isRecurring,
      recurrence_pattern: isRecurring ? recurrencePattern : null,
      reminder_minutes: dueDate ? reminderMinutes : null,
      last_notification_sent: null,
      created_at: new Date().toISOString(),
      updated_at: null,
      subtasks: [],
      tags: selectedTagObjects,
    };

    setTodos((prev) => [optimistic, ...prev]);
    setTitle('');
    setPriority('medium');
    setDueDate('');
    setIsRecurring(false);
    setRecurrencePattern('daily');
    setReminderMinutes(null);
    setSelectedTagIds([]);

    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmed,
          priority,
          due_date: dueDate || null,
          is_recurring: isRecurring,
          recurrence_pattern: isRecurring ? recurrencePattern : null,
          reminder_minutes: dueDate ? reminderMinutes : null,
          tag_ids: selectedTagIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTodos((prev) => prev.filter((t) => t.id !== tempId));
        setError(data.error || 'Failed to create todo');
        return;
      }
      setTodos((prev) => prev.map((t) => (t.id === tempId ? data : t)));
    } catch {
      setTodos((prev) => prev.filter((t) => t.id !== tempId));
      setError('Failed to create todo');
    }
  };

  // Toggle Todo Completion
  const handleToggleTodo = async (todo: Todo) => {
    const nextCompleted = !todo.completed;
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id
          ? { ...t, completed: nextCompleted, updated_at: new Date().toISOString() }
          : t
      )
    );

    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: nextCompleted }),
      });
      if (!res.ok) {
        setTodos((prev) => prev.map((t) => (t.id === todo.id ? todo : t)));
        return;
      }
      const data = await res.json();
      const updated: Todo = data.todo ?? data;
      const nextInstance: Todo | undefined = data.nextInstance;
      setTodos((prev) => {
        const mapped = prev.map((t) => (t.id === todo.id ? updated : t));
        return nextInstance ? [nextInstance, ...mapped] : mapped;
      });
    } catch {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? todo : t)));
    }
  };

  // Delete Todo (optimistic, no confirmation)
  const handleDeleteTodo = async (id: number) => {
    const previous = todos;
    setTodos((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      if (!res.ok) setTodos(previous);
    } catch {
      setTodos(previous);
    }
  };

  // Open Edit Modal
  const openEditModal = (todo: Todo) => {
    setEditingTodo(todo);
    setEditTitle(todo.title);
    setEditPriority(todo.priority);
    setEditDueDate(toDateTimeLocalValue(todo.due_date));
    setEditIsRecurring(todo.is_recurring);
    setEditPattern(todo.recurrence_pattern ?? 'daily');
    setEditReminder((todo.reminder_minutes as ReminderMinutes | null) ?? null);
    setEditTagIds((todo.tags ?? []).map((t) => t.id));
  };

  const handleUpdateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTodo) return;
    const trimmed = editTitle.trim();
    if (!trimmed) return;

    const res = await fetch(`/api/todos/${editingTodo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: trimmed,
        priority: editPriority,
        due_date: editDueDate || null,
        is_recurring: editIsRecurring,
        recurrence_pattern: editIsRecurring ? editPattern : null,
        reminder_minutes: editDueDate ? editReminder : null,
        tag_ids: editTagIds,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const updated: Todo = data.todo ?? data;
      setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTodo(null);
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to update todo');
    }
  };

  // Subtask Operations
  const handleAddSubtask = async (todoId: number) => {
    const text = (subtaskInputs[todoId] ?? '').trim();
    if (!text) return;

    const res = await fetch(`/api/todos/${todoId}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: text }),
    });
    if (res.ok) {
      const created: Subtask = await res.json();
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todoId ? { ...t, subtasks: [...(t.subtasks ?? []), created] } : t
        )
      );
      setSubtaskInputs((prev) => ({ ...prev, [todoId]: '' }));
    }
  };

  const handleToggleSubtask = async (todoId: number, subtask: Subtask) => {
    const nextCompleted = !subtask.completed;
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todoId
          ? {
              ...t,
              subtasks: (t.subtasks ?? []).map((s) =>
                s.id === subtask.id ? { ...s, completed: nextCompleted } : s
              ),
            }
          : t
      )
    );

    const res = await fetch(`/api/subtasks/${subtask.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: nextCompleted }),
    });
    if (!res.ok) fetchAll();
  };

  const handleDeleteSubtask = async (todoId: number, subtaskId: number) => {
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todoId
          ? { ...t, subtasks: (t.subtasks ?? []).filter((s) => s.id !== subtaskId) }
          : t
      )
    );
    await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
  };

  // Tag Operations
  const handleCreateTag = async () => {
    setTagError(null);
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTagName, color: newTagColor }),
    });
    const data = await res.json();
    if (!res.ok) {
      setTagError(data.error || 'Failed to create tag');
      return;
    }
    setTags((prev) => [...prev, data]);
    setNewTagName('');
    setNewTagColor('#3B82F6');
  };

  const handleUpdateTag = async (id: number) => {
    setTagError(null);
    const res = await fetch(`/api/tags/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editTagName, color: editTagColor }),
    });
    const data = await res.json();
    if (!res.ok) {
      setTagError(data.error || 'Failed to update tag');
      return;
    }
    setTags((prev) => prev.map((t) => (t.id === id ? data : t)));
    setTodos((prev) =>
      prev.map((todo) => ({
        ...todo,
        tags: (todo.tags ?? []).map((t) => (t.id === id ? data : t)),
      }))
    );
    setEditingTagId(null);
  };

  const handleDeleteTag = async (id: number) => {
    if (!window.confirm('Delete this tag from all todos?')) return;
    const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTags((prev) => prev.filter((t) => t.id !== id));
      setTodos((prev) =>
        prev.map((todo) => ({
          ...todo,
          tags: (todo.tags ?? []).filter((t) => t.id !== id),
        }))
      );
      if (filters.tagId === id) {
        setFilters((prev) => ({ ...prev, tagId: 'all' }));
      }
    }
  };

  // Template Operations
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: tplName,
        description: tplDescription || undefined,
        category: tplCategory || undefined,
        title_template: title.trim(),
        priority,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : undefined,
        reminder_minutes: reminderMinutes ?? undefined,
        due_date_offset_minutes: tplOffsetMinutes ? Number(tplOffsetMinutes) : undefined,
        subtasks: tplSubtasks.map((s, i) => ({ title: s, position: i })),
      }),
    });
    if (res.ok) {
      const created: Template = await res.json();
      setTemplates((prev) => [created, ...prev]);
      setSaveTemplateOpen(false);
      setTplName('');
      setTplDescription('');
      setTplCategory('');
      setTplOffsetMinutes('');
      setTplSubtasks([]);
      setBanner({ type: 'success', text: `Template "${created.name}" saved` });
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to save template');
    }
  };

  const handleUseTemplate = async (templateId: number) => {
    const res = await fetch(`/api/templates/${templateId}/use`, { method: 'POST' });
    if (res.ok) {
      const created: Todo = await res.json();
      setTodos((prev) => [created, ...prev]);
      setTemplateManagerOpen(false);
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!window.confirm('Delete this template?')) return;
    const res = await fetch(`/api/templates/${templateId}`, { method: 'DELETE' });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    }
  };

  // Export / Import
  const handleDownload = (format: 'json' | 'csv') => {
    const a = document.createElement('a');
    a.href = `/api/todos/export?format=${format}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setBanner(null);
    try {
      const text = await file.text();
      const body = JSON.parse(text);
      const res = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to import todos');
      setBanner({ type: 'success', text: `Successfully imported ${data.imported} todos` });
      await fetchAll();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof SyntaxError ? 'Invalid JSON format' : (err as Error).message,
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Filter Presets
  const handleSaveFilterPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;
    const next = savePreset({
      id: crypto.randomUUID(),
      name: presetName.trim(),
      filters: { ...filters },
      createdAt: getSingaporeNow().toISOString(),
    });
    setPresets(next);
    setPresetName('');
    setSaveFilterModalOpen(false);
  };

  const handleDeletePreset = (id: string) => {
    if (!window.confirm('Delete this saved filter preset?')) return;
    setPresets(deletePreset(id));
  };

  // Computed filtered + sectioned todos
  const effectiveFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch]
  );

  const filteredTodos = useMemo(
    () => applyFilters(todos, effectiveFilters),
    [todos, effectiveFilters]
  );

  const { overdue, pending, completed } = useMemo(
    () => sectionTodos(filteredTodos, getSingaporeNow()),
    [filteredTodos]
  );

  const filtersActive = hasActiveFilters(filters);

  const renderTodoCard = (todo: Todo) => {
    const subtasks = todo.subtasks ?? [];
    const progress = calculateProgress(subtasks);
    const isExpanded = Boolean(expandedSubtasks[todo.id]);

    return (
      <li
        key={todo.id}
        data-testid={`todo-item-${todo.id}`}
        className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => handleToggleTodo(todo)}
              aria-label={`Mark "${todo.title}" as ${
                todo.completed ? 'incomplete' : 'complete'
              }`}
              className="mt-1 h-5 w-5 rounded border-gray-300 dark:border-gray-600 cursor-pointer"
            />
            <div className="min-w-0 flex-1">
              <p
                className={`font-medium break-words ${
                  todo.completed
                    ? 'line-through text-gray-400 dark:text-gray-500'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {todo.title}
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <PriorityBadge priority={todo.priority} />

                {todo.due_date && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    📅 {formatSingaporeDate(todo.due_date)}
                  </span>
                )}

                {todo.is_recurring && todo.recurrence_pattern && (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-700">
                    🔄 {todo.recurrence_pattern}
                  </span>
                )}

                {todo.reminder_minutes !== null && (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700">
                    🔔{' '}
                    {REMINDER_LABELS[todo.reminder_minutes as ReminderMinutes] ??
                      `${todo.reminder_minutes}m`}
                  </span>
                )}

                {(todo.tags ?? []).map((tag) => (
                  <TagPill
                    key={tag.id}
                    tag={tag}
                    selected
                    onClick={(clicked) =>
                      setFilters((prev) => ({ ...prev, tagId: clicked.id }))
                    }
                  />
                ))}
              </div>

              {/* Subtasks Toggle + Progress */}
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSubtasks((prev) => ({ ...prev, [todo.id]: !isExpanded }))
                  }
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {isExpanded ? '▼' : '▶'} Subtasks
                </button>

                <ProgressBar
                  completed={progress.completed}
                  total={progress.total}
                  percent={progress.percent}
                />

                {isExpanded && (
                  <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
                    {subtasks.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={s.completed}
                          onChange={() => handleToggleSubtask(todo.id, s)}
                          className="h-4 w-4 rounded cursor-pointer"
                        />
                        <span
                          className={`flex-1 ${
                            s.completed
                              ? 'line-through text-gray-400'
                              : 'text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {s.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubtask(todo.id, s.id)}
                          aria-label={`Delete subtask ${s.title}`}
                          className="text-red-500 hover:text-red-700 text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={subtaskInputs[todo.id] ?? ''}
                        onChange={(e) =>
                          setSubtaskInputs((prev) => ({ ...prev, [todo.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSubtask(todo.id);
                          }
                        }}
                        placeholder="Add subtask..."
                        className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddSubtask(todo.id)}
                        className="px-2.5 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm shrink-0">
            <button
              type="button"
              onClick={() => openEditModal(todo)}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => handleDeleteTodo(todo.id)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header Toolbar */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">✅ Todo App</h1>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/calendar"
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium"
            >
              📅 Calendar
            </Link>

            <button
              type="button"
              onClick={() => setTemplateManagerOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
            >
              📋 Templates
            </button>

            <button
              type="button"
              onClick={requestPermission}
              disabled={permission === 'granted'}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                permission === 'granted'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {permission === 'granted' ? '🔔 Notifications On' : '🔔 Enable Notifications'}
            </button>

            <button
              type="button"
              onClick={() => handleDownload('json')}
              className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => handleDownload('csv')}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportFile}
            />

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {banner && (
          <div
            role="status"
            className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between ${
              banner.type === 'success'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
            }`}
          >
            <span>{banner.text}</span>
            <button type="button" onClick={() => setBanner(null)}>
              ✕
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 px-4 py-3 text-sm flex items-center justify-between"
          >
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)}>
              ✕
            </button>
          </div>
        )}

        {/* Create Todo Form */}
        <form
          onSubmit={handleCreateTodo}
          className="rounded-xl bg-white dark:bg-gray-800 p-5 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4"
        >
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="flex-1 min-w-[220px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              aria-label="Priority"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                if (!e.target.value) {
                  setIsRecurring(false);
                  setReminderMinutes(null);
                }
              }}
              aria-label="Due date"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-blue-600 hover:bg-blue-700 px-5 py-2 text-sm font-medium text-white"
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            {/* Recurrence */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  disabled={!dueDate}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
                Repeat
              </label>
              {isRecurring && (
                <select
                  value={recurrencePattern}
                  onChange={(e) =>
                    setRecurrencePattern(e.target.value as RecurrencePattern)
                  }
                  aria-label="Recurrence pattern"
                  className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}
              {!dueDate && (
                <span className="text-xs text-gray-400">Set a due date to enable repeat</span>
              )}
            </div>

            {/* Reminder */}
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Reminder:</span>
              <select
                value={reminderMinutes ?? ''}
                disabled={!dueDate}
                aria-label="Reminder"
                onChange={(e) =>
                  setReminderMinutes(
                    e.target.value ? (Number(e.target.value) as ReminderMinutes) : null
                  )
                }
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs disabled:opacity-50"
              >
                <option value="">None</option>
                <option value={15}>15 minutes before</option>
                <option value={30}>30 minutes before</option>
                <option value={60}>1 hour before</option>
                <option value={120}>2 hours before</option>
                <option value={1440}>1 day before</option>
                <option value={2880}>2 days before</option>
                <option value={10080}>1 week before</option>
              </select>
            </div>

            {/* Quick Use Template */}
            {templates.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleUseTemplate(Number(e.target.value));
                }}
                aria-label="Use Template"
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs"
              >
                <option value="">Use Template...</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.category ? `${tpl.name} (${tpl.category})` : tpl.name}
                  </option>
                ))}
              </select>
            )}

            {title.trim() && (
              <button
                type="button"
                onClick={() => setSaveTemplateOpen(true)}
                className="px-2.5 py-1 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200 text-xs font-medium hover:bg-indigo-200"
              >
                💾 Save as Template
              </button>
            )}
          </div>

          {/* Tag Pills + Manage Tags */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {tags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <TagPill
                  key={tag.id}
                  tag={tag}
                  selected={selected}
                  onClick={() =>
                    setSelectedTagIds((prev) =>
                      selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                    )
                  }
                />
              );
            })}
            <button
              type="button"
              onClick={() => setManageTagsOpen(true)}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              + Manage Tags
            </button>
          </div>
        </form>

        {/* Search & Filter Bar */}
        <section className="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                🔍
              </span>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Search todos and subtasks..."
                className="w-full pl-9 pr-9 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={filters.priority}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  priority: e.target.value as Priority | 'all',
                }))
              }
              aria-label="Filter by priority"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>

            <select
              value={filters.tagId}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  tagId: e.target.value === 'all' ? 'all' : Number(e.target.value),
                }))
              }
              aria-label="Filter by tag"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
            >
              <option value="all">All Tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setAdvancedOpen((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                advancedOpen
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
              }`}
            >
              {advancedOpen ? '▼ Advanced' : '▶ Advanced'}
            </button>

            {filtersActive && (
              <>
                <button
                  type="button"
                  onClick={() => setFilters(DEFAULT_FILTER_STATE)}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setSaveFilterModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
                >
                  💾 Save Filter
                </button>
              </>
            )}
          </div>

          {advancedOpen && (
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <select
                    value={filters.completion}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        completion: e.target.value as FilterState['completion'],
                      }))
                    }
                    className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1"
                  >
                    <option value="all">All Todos</option>
                    <option value="incomplete">Incomplete Only</option>
                    <option value="completed">Completed Only</option>
                  </select>
                </label>

                <label className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">Due From:</span>
                  <input
                    type="date"
                    value={filters.dueDateFrom ?? ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        dueDateFrom: e.target.value || null,
                      }))
                    }
                    className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1"
                  />
                </label>

                <label className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">Due To:</span>
                  <input
                    type="date"
                    value={filters.dueDateTo ?? ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        dueDateTo: e.target.value || null,
                      }))
                    }
                    className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1"
                  />
                </label>
              </div>

              {presets.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Saved Presets:</span>
                  {presets.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => setFilters(p.filters)}
                        className="font-medium hover:underline"
                      >
                        {p.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePreset(p.id)}
                        aria-label={`Delete preset ${p.name}`}
                        className="text-gray-400 hover:text-red-500 ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Todo Sections */}
        {loading ? (
          <p className="text-center text-gray-500 py-8">Loading todos...</p>
        ) : filteredTodos.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            {todos.length === 0 ? 'No todos yet. Add one above!' : 'No todos match your filters.'}
          </p>
        ) : (
          <div className="space-y-6">
            {overdue.length > 0 && (
              <section>
                <h2 className="text-sm font-bold uppercase tracking-wide text-red-600 dark:text-red-400 mb-3">
                  Overdue ({overdue.length})
                </h2>
                <ul className="space-y-3">{overdue.map(renderTodoCard)}</ul>
              </section>
            )}

            {pending.length > 0 && (
              <section>
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-3">
                  Pending ({pending.length})
                </h2>
                <ul className="space-y-3">{pending.map(renderTodoCard)}</ul>
              </section>
            )}

            {completed.length > 0 && (
              <section>
                <h2 className="text-sm font-bold uppercase tracking-wide text-green-700 dark:text-green-400 mb-3">
                  Completed ({completed.length})
                </h2>
                <ul className="space-y-3">{completed.map(renderTodoCard)}</ul>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Edit Todo Modal */}
      {editingTodo && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setEditingTodo(null)}
        >
          <form
            onSubmit={handleUpdateTodo}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg space-y-4 shadow-xl"
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Todo</h2>

            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as Priority)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <input
                type="datetime-local"
                value={editDueDate}
                onChange={(e) => {
                  setEditDueDate(e.target.value);
                  if (!e.target.value) {
                    setEditIsRecurring(false);
                    setEditReminder(null);
                  }
                }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editIsRecurring}
                  disabled={!editDueDate}
                  onChange={(e) => setEditIsRecurring(e.target.checked)}
                />
                Repeat
              </label>
              {editIsRecurring && (
                <select
                  value={editPattern}
                  onChange={(e) => setEditPattern(e.target.value as RecurrencePattern)}
                  className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}

              <select
                value={editReminder ?? ''}
                disabled={!editDueDate}
                onChange={(e) =>
                  setEditReminder(
                    e.target.value ? (Number(e.target.value) as ReminderMinutes) : null
                  )
                }
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs"
              >
                <option value="">No Reminder</option>
                <option value={15}>15 minutes before</option>
                <option value={30}>30 minutes before</option>
                <option value={60}>1 hour before</option>
                <option value={120}>2 hours before</option>
                <option value={1440}>1 day before</option>
                <option value={2880}>2 days before</option>
                <option value={10080}>1 week before</option>
              </select>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const selected = editTagIds.includes(tag.id);
                  return (
                    <TagPill
                      key={tag.id}
                      tag={tag}
                      selected={selected}
                      onClick={() =>
                        setEditTagIds((prev) =>
                          selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                        )
                      }
                    />
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingTodo(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Update
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manage Tags Modal */}
      {manageTagsOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setManageTagsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl"
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Manage Tags</h2>

            {tagError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {tagError}
              </p>
            )}

            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {tags.map((tag) => (
                <li key={tag.id} className="flex items-center justify-between gap-2">
                  {editingTagId === tag.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        value={editTagName}
                        onChange={(e) => setEditTagName(e.target.value)}
                        className="flex-1 rounded border px-2 py-1 text-sm dark:bg-gray-700"
                      />
                      <input
                        type="color"
                        value={editTagColor}
                        onChange={(e) => setEditTagColor(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateTag(tag.id)}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                      >
                        Update
                      </button>
                    </div>
                  ) : (
                    <>
                      <TagPill tag={tag} selected />
                      <div className="flex gap-2 text-sm">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTagId(tag.id);
                            setEditTagName(tag.name);
                            setEditTagColor(tag.color);
                          }}
                          className="text-blue-600 dark:text-blue-400"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTag(tag.id)}
                          className="text-red-600 dark:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name"
                className="flex-1 rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm dark:bg-gray-700"
              />
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                aria-label="Tag color"
              />
              <input
                type="text"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-20 rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-xs dark:bg-gray-700"
              />
              <button
                type="button"
                onClick={handleCreateTag}
                className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm hover:bg-blue-700"
              >
                Create Tag
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setManageTagsOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {saveTemplateOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSaveTemplateOpen(false)}
        >
          <form
            onSubmit={handleSaveTemplate}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md space-y-3 shadow-xl"
          >
            <h2 className="text-lg font-bold">Save as Template</h2>
            <input
              type="text"
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              placeholder="Template name"
              required
              className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-700"
            />
            <textarea
              value={tplDescription}
              onChange={(e) => setTplDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-700"
            />
            <input
              type="text"
              value={tplCategory}
              onChange={(e) => setTplCategory(e.target.value)}
              placeholder="Category (e.g. Work, Personal, Finance)"
              className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-700"
            />
            <input
              type="number"
              value={tplOffsetMinutes}
              onChange={(e) => setTplOffsetMinutes(e.target.value)}
              placeholder="Due date offset in minutes (optional)"
              className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-700"
            />

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500">Template Subtasks (optional)</p>
              {tplSubtasks.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span>• {s}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setTplSubtasks((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tplNewSubtask}
                  onChange={(e) => setTplNewSubtask(e.target.value)}
                  placeholder="Add template subtask..."
                  className="flex-1 rounded border px-2 py-1 text-xs dark:bg-gray-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (tplNewSubtask.trim()) {
                      setTplSubtasks((prev) => [...prev, tplNewSubtask.trim()]);
                      setTplNewSubtask('');
                    }
                  }}
                  className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSaveTemplateOpen(false)}
                className="px-3 py-1.5 rounded border text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!tplName.trim()}
                className="px-4 py-1.5 rounded bg-indigo-600 text-white text-sm font-medium"
              >
                Save Template
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Template Manager Modal */}
      {templateManagerOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setTemplateManagerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Template Manager</h2>
              <button type="button" onClick={() => setTemplateManagerOpen(false)}>
                ✕
              </button>
            </div>

            {templates.length === 0 ? (
              <p className="text-sm text-gray-500">
                No templates yet. Type a todo title and click &quot;Save as Template&quot;.
              </p>
            ) : (
              <ul className="space-y-3 max-h-96 overflow-y-auto">
                {templates.map((tpl) => (
                  <li
                    key={tpl.id}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm">{tpl.name}</strong>
                        {tpl.category && (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                            {tpl.category}
                          </span>
                        )}
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-gray-500">{tpl.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        <PriorityBadge priority={tpl.priority} />
                        {tpl.is_recurring && tpl.recurrence_pattern && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                            🔄 {tpl.recurrence_pattern}
                          </span>
                        )}
                        {tpl.reminder_minutes !== null && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            🔔{' '}
                            {REMINDER_LABELS[tpl.reminder_minutes as ReminderMinutes] ??
                              `${tpl.reminder_minutes}m`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUseTemplate(tpl.id)}
                        className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                      >
                        Use
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        className="px-3 py-1 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Save Filter Preset Modal */}
      {saveFilterModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSaveFilterModalOpen(false)}
        >
          <form
            onSubmit={handleSaveFilterPreset}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl"
          >
            <h2 className="text-lg font-bold">Save Filter Preset</h2>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name (e.g. Today's High Priority)"
              required
              className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-700"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaveFilterModalOpen(false)}
                className="px-3 py-1.5 rounded border text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-green-600 text-white text-sm font-medium"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
