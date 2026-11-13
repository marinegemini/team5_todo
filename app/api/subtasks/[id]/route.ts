import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subtaskDB } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const subtaskId = Number(id);
  const existing = subtaskDB.findByIdWithOwner(subtaskId);
  if (!existing || existing.user_id !== session.userId) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
  }

  const body = await request.json();
  if (body.title !== undefined && !String(body.title).trim()) {
    return NextResponse.json({ error: 'Subtask title cannot be empty' }, { status: 400 });
  }

  const updated = subtaskDB.update(subtaskId, {
    title: body.title !== undefined ? String(body.title).trim() : undefined,
    completed: body.completed !== undefined ? Boolean(body.completed) : undefined,
  });

  return NextResponse.json(updated);
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
  const subtaskId = Number(id);
  const existing = subtaskDB.findByIdWithOwner(subtaskId);
  if (!existing || existing.user_id !== session.userId) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
  }

  subtaskDB.delete(subtaskId);
  return NextResponse.json({ success: true });
}

