import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subtaskDB, templateDB, todoDB, type TemplateSubtask } from '@/lib/db';
import { addMinutes, getSingaporeNow, normalizeSingaporeISO } from '@/lib/timezone';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const template = templateDB.findById(Number(id));
  if (!template || template.user_id !== session.userId) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const dueDate =
    template.due_date_offset_minutes != null
      ? normalizeSingaporeISO(addMinutes(getSingaporeNow(), template.due_date_offset_minutes))
      : null;

  const isRecurring = Boolean(template.is_recurring && dueDate);

  const todo = todoDB.create({
    user_id: session.userId,
    title: template.title_template,
    priority: template.priority,
    due_date: dueDate,
    is_recurring: isRecurring,
    recurrence_pattern: isRecurring ? template.recurrence_pattern : null,
    reminder_minutes: dueDate ? template.reminder_minutes : null,
  });

  let subtasks: TemplateSubtask[] = [];
  if (template.subtasks_json) {
    try {
      const parsed = JSON.parse(template.subtasks_json);
      if (Array.isArray(parsed)) subtasks = parsed;
    } catch {
      subtasks = [];
    }
  }

  for (let i = 0; i < subtasks.length; i++) {
    const s = subtasks[i];
    if (s && typeof s.title === 'string' && s.title.trim()) {
      subtaskDB.create(todo.id, {
        title: s.title.trim(),
        position: typeof s.position === 'number' ? s.position : i,
      });
    }
  }

  const fullTodo = todoDB.findByIdForUser(todo.id, session.userId);
  return NextResponse.json(fullTodo, { status: 201 });
}

