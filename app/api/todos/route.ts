import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB, type RecurrencePattern } from '@/lib/db';
import { getSingaporeNow, parseSingaporeDate } from '@/lib/timezone';
import { validatePriority } from '@/lib/todoSort';

const VALID_PATTERNS: RecurrencePattern[] = ['daily', 'weekly', 'monthly', 'yearly'];
const VALID_REMINDERS = [15, 30, 60, 120, 1440, 2880, 10080];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let todos = todoDB.findAllByUser(session.userId);
  const priorityParam = request.nextUrl.searchParams.get('priority');
  if (priorityParam && ['high', 'medium', 'low'].includes(priorityParam)) {
    todos = todos.filter((t) => t.priority === priorityParam);
  }

  return NextResponse.json(todos);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  let priority;
  try {
    priority = validatePriority(body.priority);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const dueDate: string | null = body.due_date ? String(body.due_date) : null;
  if (dueDate) {
    const due = parseSingaporeDate(dueDate);
    if (Number.isNaN(due.getTime())) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
    }
    const minDue = new Date(getSingaporeNow().getTime() + 60_000);
    if (due < minDue) {
      return NextResponse.json(
        { error: 'Due date must be at least 1 minute in the future' },
        { status: 400 }
      );
    }
  }

  const isRecurring = Boolean(body.is_recurring);
  const recurrencePattern = body.recurrence_pattern ?? null;
  if (isRecurring) {
    if (!dueDate) {
      return NextResponse.json(
        { error: 'Recurring todos require a due date' },
        { status: 400 }
      );
    }
    if (!VALID_PATTERNS.includes(recurrencePattern)) {
      return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 });
    }
  }

  const reminderMinutes =
    body.reminder_minutes !== undefined && body.reminder_minutes !== null
      ? Number(body.reminder_minutes)
      : null;
  if (reminderMinutes !== null && !VALID_REMINDERS.includes(reminderMinutes)) {
    return NextResponse.json({ error: 'Invalid reminder minutes' }, { status: 400 });
  }
  if (reminderMinutes !== null && !dueDate) {
    return NextResponse.json(
      { error: 'Reminders require a due date' },
      { status: 400 }
    );
  }

  const todo = todoDB.create({
    user_id: session.userId,
    title,
    due_date: dueDate,
    priority,
    is_recurring: isRecurring,
    recurrence_pattern: isRecurring ? recurrencePattern : null,
    reminder_minutes: reminderMinutes,
    tag_ids: Array.isArray(body.tag_ids) ? body.tag_ids.map(Number) : [],
  });

  return NextResponse.json(todo, { status: 201 });
}

