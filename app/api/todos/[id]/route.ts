import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB, todoDB, type RecurrencePattern } from '@/lib/db';
import { calculateNextDueDate } from '@/lib/recurrence';
import { validatePriority } from '@/lib/todoSort';

const VALID_PATTERNS: RecurrencePattern[] = ['daily', 'weekly', 'monthly', 'yearly'];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todo = todoDB.findByIdForUser(Number(id), session.userId);
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json(todo);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = Number(id);
  const existing = todoDB.findByIdForUser(todoId, session.userId);
  if (!existing) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  const body = await request.json();

  if (body.title !== undefined && !String(body.title).trim()) {
    return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
  }

  let priority = existing.priority;
  if (body.priority !== undefined) {
    if (body.priority === null) {
      return NextResponse.json(
        { error: "Invalid priority: null. Must be 'high', 'medium', or 'low'." },
        { status: 400 }
      );
    }
    try {
      priority = validatePriority(body.priority);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
  }

  const nextIsRecurring =
    body.is_recurring !== undefined ? Boolean(body.is_recurring) : existing.is_recurring;
  const nextDueDate = body.due_date !== undefined ? body.due_date : existing.due_date;
  const nextPattern =
    body.recurrence_pattern !== undefined
      ? body.recurrence_pattern
      : existing.recurrence_pattern;

  if (nextIsRecurring) {
    if (!nextDueDate) {
      return NextResponse.json(
        { error: 'Recurring todos require a due date' },
        { status: 400 }
      );
    }
    if (!VALID_PATTERNS.includes(nextPattern)) {
      return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 });
    }
  }

  const updated = todoDB.update(todoId, session.userId, {
    title: body.title !== undefined ? String(body.title).trim() : undefined,
    completed: body.completed !== undefined ? Boolean(body.completed) : undefined,
    due_date: body.due_date !== undefined ? body.due_date : undefined,
    priority: body.priority !== undefined ? priority : undefined,
    is_recurring: body.is_recurring !== undefined ? nextIsRecurring : undefined,
    recurrence_pattern:
      body.recurrence_pattern !== undefined ? body.recurrence_pattern : undefined,
    reminder_minutes:
      body.reminder_minutes !== undefined ? body.reminder_minutes : undefined,
    last_notification_sent:
      body.last_notification_sent !== undefined ? body.last_notification_sent : undefined,
    tag_ids: Array.isArray(body.tag_ids) ? body.tag_ids.map(Number) : undefined,
  });

  const justCompleted = body.completed === true && existing.completed === false;
  if (
    justCompleted &&
    existing.is_recurring &&
    existing.recurrence_pattern &&
    existing.due_date
  ) {
    const nextDue = calculateNextDueDate(existing.due_date, existing.recurrence_pattern);
    const tagIds = tagDB.getTagIdsForTodo(existing.id);

    const nextInstance = todoDB.create({
      user_id: session.userId,
      title: existing.title,
      priority: existing.priority,
      is_recurring: true,
      recurrence_pattern: existing.recurrence_pattern,
      reminder_minutes: existing.reminder_minutes ?? null,
      due_date: nextDue,
      tag_ids: tagIds,
    });

    return NextResponse.json({ todo: updated, nextInstance });
  }

  return NextResponse.json({ todo: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const deleted = todoDB.delete(Number(id), session.userId);
  if (!deleted) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

