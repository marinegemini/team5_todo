import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { templateDB, type RecurrencePattern } from '@/lib/db';
import { validatePriority } from '@/lib/todoSort';

const VALID_PATTERNS: RecurrencePattern[] = ['daily', 'weekly', 'monthly', 'yearly'];

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json(templateDB.findAllByUser(session.userId));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const titleTemplate =
    typeof body.title_template === 'string' ? body.title_template.trim() : '';

  if (!name || !titleTemplate) {
    return NextResponse.json(
      { error: 'Name and title_template are required' },
      { status: 400 }
    );
  }

  let priority;
  try {
    priority = validatePriority(body.priority);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const isRecurring = Boolean(body.is_recurring);
  const dueDateOffset =
    body.due_date_offset_minutes !== undefined && body.due_date_offset_minutes !== null
      ? Number(body.due_date_offset_minutes)
      : null;

  if (isRecurring) {
    if (!VALID_PATTERNS.includes(body.recurrence_pattern)) {
      return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 });
    }
    if (dueDateOffset === null) {
      return NextResponse.json(
        { error: 'Recurring templates require a due_date_offset_minutes' },
        { status: 400 }
      );
    }
  }

  const subtasksJson =
    Array.isArray(body.subtasks) && body.subtasks.length > 0
      ? JSON.stringify(
          body.subtasks.map((s: { title: string }, i: number) => ({
            title: String(s.title).trim(),
            position: i,
          }))
        )
      : null;

  const template = templateDB.create({
    user_id: session.userId,
    name,
    description: body.description ? String(body.description).trim() : null,
    category: body.category ? String(body.category).trim() : null,
    title_template: titleTemplate,
    priority,
    is_recurring: isRecurring,
    recurrence_pattern: isRecurring ? body.recurrence_pattern : null,
    reminder_minutes:
      body.reminder_minutes !== undefined && body.reminder_minutes !== null
        ? Number(body.reminder_minutes)
        : null,
    due_date_offset_minutes: dueDateOffset,
    subtasks_json: subtasksJson,
  });

  return NextResponse.json(template, { status: 201 });
}

