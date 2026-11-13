import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB, type Todo, type TodoExport, type TodoExportItem } from '@/lib/db';
import { formatSingaporeDate, getSingaporeNow, normalizeSingaporeISO } from '@/lib/timezone';

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(todos: Todo[]): string {
  const header = 'ID,Title,Completed,Due Date,Priority,Recurring,Pattern,Reminder';
  const rows = todos.map((t) =>
    [
      String(t.id),
      t.title,
      t.completed ? 'true' : 'false',
      t.due_date ?? '',
      t.priority,
      t.is_recurring ? 'true' : 'false',
      t.recurrence_pattern ?? '',
      t.reminder_minutes !== null ? String(t.reminder_minutes) : '',
    ]
      .map(escapeCsvField)
      .join(',')
  );
  return [header, ...rows].join('\r\n');
}

function toExportItem(t: Todo): TodoExportItem {
  return {
    title: t.title,
    completed: t.completed,
    due_date: t.due_date,
    priority: t.priority,
    is_recurring: t.is_recurring,
    recurrence_pattern: t.recurrence_pattern,
    reminder_minutes: t.reminder_minutes,
    created_at: t.created_at,
    subtasks: (t.subtasks ?? []).map((s) => ({
      title: s.title,
      completed: s.completed,
      position: s.position,
    })),
    tags: (t.tags ?? []).map((tag) => ({
      name: tag.name,
      color: tag.color,
    })),
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get('format') ?? 'json';
  const todos = todoDB.findAllByUser(session.userId);
  const dateStr = formatSingaporeDate(getSingaporeNow(), 'yyyy-MM-dd');

  if (format === 'csv') {
    const csv = toCsv(todos);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="todos-${dateStr}.csv"`,
      },
    });
  }

  const payload: TodoExport = {
    version: 1,
    exported_at: normalizeSingaporeISO(getSingaporeNow()),
    todos: todos.map(toExportItem),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="todos-${dateStr}.json"`,
    },
  });
}

