import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const tagId = Number(id);
  const existing = tagDB.findById(tagId, session.userId);
  if (!existing) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  }

  const body = await request.json();
  const name = body.name !== undefined ? String(body.name).trim() : undefined;
  if (name !== undefined && !name) {
    return NextResponse.json({ error: 'Tag name cannot be empty' }, { status: 400 });
  }
  if (body.color !== undefined && !HEX_COLOR_RE.test(body.color)) {
    return NextResponse.json({ error: 'Color must be a valid hex code' }, { status: 400 });
  }

  try {
    const updated = tagDB.update(tagId, session.userId, {
      name,
      color: body.color,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: 'A tag with this name already exists' },
      { status: 409 }
    );
  }
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
  const deleted = tagDB.delete(Number(id), session.userId);
  if (!deleted) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

