import Database from 'better-sqlite3';
import path from 'path';
import { normalizeSingaporeISO } from './timezone';

// ---------------------------------------------------------------------------
// Shared Types
// ---------------------------------------------------------------------------

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ReminderMinutes = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080;

export const PRIORITY_VALUES: Priority[] = ['high', 'medium', 'low'];

export const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const REMINDER_LABELS: Record<ReminderMinutes, string> = {
  15: '15m',
  30: '30m',
  60: '1h',
  120: '2h',
  1440: '1d',
  2880: '2d',
  10080: '1w',
};

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Authenticator {
  id: number;
  user_id: number;
  credential_id: string;
  credential_public_key: Buffer;
  counter: number;
  created_at: string;
}

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}

export interface CreateSubtaskDto {
  title: string;
  position?: number;
}

export interface UpdateSubtaskDto {
  title?: string;
  completed?: boolean;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface CreateTagInput {
  name: string;
  color?: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  completed: boolean;
  due_date: string | null;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string | null;
  subtasks?: Subtask[];
  tags?: Tag[];
}

export interface CreateTodoInput {
  user_id: number;
  title: string;
  completed?: boolean;
  due_date?: string | null;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
  tag_ids?: number[];
}

export interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
  due_date?: string | null;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
  last_notification_sent?: string | null;
  tag_ids?: number[];
}

export interface TemplateSubtask {
  title: string;
  position: number;
}

export interface Template {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  category: string | null;
  title_template: string;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  due_date_offset_minutes: number | null;
  subtasks_json: string | null;
  created_at: string;
}

export interface CreateTemplateInput {
  user_id: number;
  name: string;
  description?: string | null;
  category?: string | null;
  title_template: string;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
  due_date_offset_minutes?: number | null;
  subtasks_json?: string | null;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  category?: string | null;
  title_template?: string;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
  due_date_offset_minutes?: number | null;
  subtasks_json?: string | null;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
  created_at?: string;
}

export interface TodoExportItem
  extends Omit<Todo, 'id' | 'user_id' | 'updated_at' | 'last_notification_sent' | 'subtasks' | 'tags'> {
  subtasks: Array<Omit<Subtask, 'id' | 'todo_id' | 'created_at'>>;
  tags: Array<Pick<Tag, 'name' | 'color'>>;
}

export interface TodoExport {
  version: 1;
  exported_at: string;
  todos: TodoExportItem[];
}

export interface ImportResult {
  imported: number;
  tagsCreated: number;
  tagsReused: number;
}

// ---------------------------------------------------------------------------
// Database Connection & Initialization
// ---------------------------------------------------------------------------

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'todos.db');

const globalForDb = globalThis as unknown as { __sqliteDb?: Database.Database };

function createConnection(): Database.Database {
  const conn = new Database(DB_PATH);
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');

  conn.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS authenticators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credential_id TEXT UNIQUE NOT NULL,
      credential_public_key BLOB NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id);

    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      username TEXT PRIMARY KEY,
      challenge TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_pattern TEXT,
      reminder_minutes INTEGER,
      last_notification_sent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
    CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3B82F6',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

    CREATE TABLE IF NOT EXISTS todo_tags (
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (todo_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id);

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      title_template TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_pattern TEXT,
      reminder_minutes INTEGER,
      due_date_offset_minutes INTEGER,
      subtasks_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);

    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
  `);

  return conn;
}

export const db: Database.Database = globalForDb.__sqliteDb ?? createConnection();
if (process.env.NODE_ENV !== 'production') {
  globalForDb.__sqliteDb = db;
}

// ---------------------------------------------------------------------------
// Row Mappers
// ---------------------------------------------------------------------------

interface RawTodoRow {
  id: number;
  user_id: number;
  title: string;
  completed: number;
  due_date: string | null;
  priority: string;
  is_recurring: number;
  recurrence_pattern: string | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string | null;
}

interface RawSubtaskRow {
  id: number;
  todo_id: number;
  title: string;
  completed: number;
  position: number;
  created_at: string;
}

interface RawTemplateRow {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  category: string | null;
  title_template: string;
  priority: string;
  is_recurring: number;
  recurrence_pattern: string | null;
  reminder_minutes: number | null;
  due_date_offset_minutes: number | null;
  subtasks_json: string | null;
  created_at: string;
}

function mapTodo(row: RawTodoRow, subtasks: Subtask[] = [], tags: Tag[] = []): Todo {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    completed: Boolean(row.completed),
    due_date: row.due_date ?? null,
    priority: (row.priority as Priority) ?? 'medium',
    is_recurring: Boolean(row.is_recurring),
    recurrence_pattern: (row.recurrence_pattern as RecurrencePattern) ?? null,
    reminder_minutes: row.reminder_minutes ?? null,
    last_notification_sent: row.last_notification_sent ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
    subtasks,
    tags,
  };
}

function mapSubtask(row: RawSubtaskRow): Subtask {
  return {
    id: row.id,
    todo_id: row.todo_id,
    title: row.title,
    completed: Boolean(row.completed),
    position: row.position,
    created_at: row.created_at,
  };
}

function mapTemplate(row: RawTemplateRow): Template {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description ?? null,
    category: row.category ?? null,
    title_template: row.title_template,
    priority: (row.priority as Priority) ?? 'medium',
    is_recurring: Boolean(row.is_recurring),
    recurrence_pattern: (row.recurrence_pattern as RecurrencePattern) ?? null,
    reminder_minutes: row.reminder_minutes ?? null,
    due_date_offset_minutes: row.due_date_offset_minutes ?? null,
    subtasks_json: row.subtasks_json ?? null,
    created_at: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// User & Authenticator & Challenge DB
// ---------------------------------------------------------------------------

export const userDB = {
  findById(id: number): User | null {
    return (db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined) ?? null;
  },

  findByUsername(username: string): User | null {
    return (
      (db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined) ??
      null
    );
  },

  create(username: string): User {
    const info = db.prepare('INSERT INTO users (username) VALUES (?)').run(username);
    return this.findById(Number(info.lastInsertRowid))!;
  },
};

export const authenticatorDB = {
  findByUserId(userId: number): Authenticator[] {
    return db
      .prepare('SELECT * FROM authenticators WHERE user_id = ?')
      .all(userId) as Authenticator[];
  },

  findByCredentialId(credentialId: string): Authenticator | null {
    return (
      (db
        .prepare('SELECT * FROM authenticators WHERE credential_id = ?')
        .get(credentialId) as Authenticator | undefined) ?? null
    );
  },

  create(input: {
    user_id: number;
    credential_id: string;
    credential_public_key: Buffer;
    counter: number;
  }): Authenticator {
    const info = db
      .prepare(
        `INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter)
         VALUES (?, ?, ?, ?)`
      )
      .run(
        input.user_id,
        input.credential_id,
        input.credential_public_key,
        input.counter ?? 0
      );
    return db
      .prepare('SELECT * FROM authenticators WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as Authenticator;
  },

  updateCounter(id: number, counter: number): void {
    db.prepare('UPDATE authenticators SET counter = ? WHERE id = ?').run(counter ?? 0, id);
  },
};

export const challengeDB = {
  save(username: string, challenge: string, ttlMs = 5 * 60_000): void {
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    db.prepare(
      `INSERT INTO webauthn_challenges (username, challenge, expires_at)
       VALUES (?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET challenge = excluded.challenge, expires_at = excluded.expires_at`
    ).run(username, challenge, expiresAt);
  },

  consume(username: string): string | null {
    const row = db
      .prepare('SELECT challenge, expires_at FROM webauthn_challenges WHERE username = ?')
      .get(username) as { challenge: string; expires_at: string } | undefined;
    db.prepare('DELETE FROM webauthn_challenges WHERE username = ?').run(username);
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;
    return row.challenge;
  },
};

// ---------------------------------------------------------------------------
// Subtask DB
// ---------------------------------------------------------------------------

export const subtaskDB = {
  findByTodoId(todoId: number): Subtask[] {
    const rows = db
      .prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC, id ASC')
      .all(todoId) as RawSubtaskRow[];
    return rows.map(mapSubtask);
  },

  findByIdWithOwner(id: number): (Subtask & { user_id: number }) | null {
    const row = db
      .prepare(
        `SELECT s.*, t.user_id
         FROM subtasks s
         JOIN todos t ON t.id = s.todo_id
         WHERE s.id = ?`
      )
      .get(id) as (RawSubtaskRow & { user_id: number }) | undefined;
    if (!row) return null;
    return { ...mapSubtask(row), user_id: row.user_id };
  },

  create(todoId: number, data: CreateSubtaskDto): Subtask {
    const maxRow = db
      .prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM subtasks WHERE todo_id = ?')
      .get(todoId) as { maxPos: number };
    const position = data.position ?? maxRow.maxPos + 1;
    const info = db
      .prepare('INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)')
      .run(todoId, data.title, position);
    const row = db
      .prepare('SELECT * FROM subtasks WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as RawSubtaskRow;
    return mapSubtask(row);
  },

  update(id: number, data: UpdateSubtaskDto): Subtask | null {
    const existing = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as
      | RawSubtaskRow
      | undefined;
    if (!existing) return null;

    const title = data.title !== undefined ? data.title : existing.title;
    const completed =
      data.completed !== undefined ? (data.completed ? 1 : 0) : existing.completed;

    db.prepare('UPDATE subtasks SET title = ?, completed = ? WHERE id = ?').run(
      title,
      completed,
      id
    );
    const updated = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as RawSubtaskRow;
    return mapSubtask(updated);
  },

  delete(id: number): void {
    db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
  },
};

// ---------------------------------------------------------------------------
// Tag DB
// ---------------------------------------------------------------------------

export const tagDB = {
  findAllByUser(userId: number): Tag[] {
    return db
      .prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC')
      .all(userId) as Tag[];
  },

  findById(id: number, userId: number): Tag | null {
    return (
      (db
        .prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?')
        .get(id, userId) as Tag | undefined) ?? null
    );
  },

  findByTodoId(todoId: number): Tag[] {
    return db
      .prepare(
        `SELECT tg.*
         FROM tags tg
         JOIN todo_tags tt ON tt.tag_id = tg.id
         WHERE tt.todo_id = ?
         ORDER BY tg.name COLLATE NOCASE ASC`
      )
      .all(todoId) as Tag[];
  },

  getTagIdsForTodo(todoId: number): number[] {
    const rows = db
      .prepare('SELECT tag_id FROM todo_tags WHERE todo_id = ?')
      .all(todoId) as Array<{ tag_id: number }>;
    return rows.map((r) => r.tag_id);
  },

  create(userId: number, input: CreateTagInput): Tag {
    const info = db
      .prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)')
      .run(userId, input.name, input.color ?? '#3B82F6');
    return db.prepare('SELECT * FROM tags WHERE id = ?').get(Number(info.lastInsertRowid)) as Tag;
  },

  update(id: number, userId: number, input: UpdateTagInput): Tag | null {
    const existing = this.findById(id, userId);
    if (!existing) return null;

    const name = input.name !== undefined ? input.name : existing.name;
    const color = input.color !== undefined ? input.color : existing.color;
    db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?').run(
      name,
      color,
      id,
      userId
    );
    return this.findById(id, userId);
  },

  delete(id: number, userId: number): boolean {
    const info = db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(id, userId);
    return info.changes > 0;
  },

  setTodoTags(todoId: number, tagIds: number[], userId?: number): void {
    const run = db.transaction((ids: number[]) => {
      db.prepare('DELETE FROM todo_tags WHERE todo_id = ?').run(todoId);
      const insert = db.prepare(
        'INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)'
      );
      for (const tagId of ids) {
        if (userId !== undefined) {
          const owned = this.findById(tagId, userId);
          if (!owned) continue;
        }
        insert.run(todoId, tagId);
      }
    });
    run(tagIds);
  },

  attachToTodo(todoId: number, tagId: number): void {
    db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(
      todoId,
      tagId
    );
  },

  detachFromTodo(todoId: number, tagId: number): void {
    db.prepare('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?').run(todoId, tagId);
  },
};

// ---------------------------------------------------------------------------
// Todo DB
// ---------------------------------------------------------------------------

export const todoDB = {
  findAllByUser(userId: number): Todo[] {
    const rows = db
      .prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY id DESC')
      .all(userId) as RawTodoRow[];

    if (rows.length === 0) return [];

    const todoIds = rows.map((r) => r.id);
    const placeholders = todoIds.map(() => '?').join(',');

    const subtaskRows = db
      .prepare(
        `SELECT * FROM subtasks WHERE todo_id IN (${placeholders}) ORDER BY position ASC, id ASC`
      )
      .all(...todoIds) as RawSubtaskRow[];

    const tagRows = db
      .prepare(
        `SELECT tt.todo_id, tg.*
         FROM todo_tags tt
         JOIN tags tg ON tg.id = tt.tag_id
         WHERE tt.todo_id IN (${placeholders})
         ORDER BY tg.name COLLATE NOCASE ASC`
      )
      .all(...todoIds) as Array<Tag & { todo_id: number }>;

    const subtasksByTodo = new Map<number, Subtask[]>();
    for (const s of subtaskRows) {
      const list = subtasksByTodo.get(s.todo_id) ?? [];
      list.push(mapSubtask(s));
      subtasksByTodo.set(s.todo_id, list);
    }

    const tagsByTodo = new Map<number, Tag[]>();
    for (const t of tagRows) {
      const list = tagsByTodo.get(t.todo_id) ?? [];
      list.push({
        id: t.id,
        user_id: t.user_id,
        name: t.name,
        color: t.color,
        created_at: t.created_at,
      });
      tagsByTodo.set(t.todo_id, list);
    }

    return rows.map((r) =>
      mapTodo(r, subtasksByTodo.get(r.id) ?? [], tagsByTodo.get(r.id) ?? [])
    );
  },

  findById(id: number): Todo | null {
    const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as
      | RawTodoRow
      | undefined;
    if (!row) return null;
    return mapTodo(row, subtaskDB.findByTodoId(row.id), tagDB.findByTodoId(row.id));
  },

  findByIdForUser(id: number, userId: number): Todo | null {
    const row = db
      .prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?')
      .get(id, userId) as RawTodoRow | undefined;
    if (!row) return null;
    return mapTodo(row, subtaskDB.findByTodoId(row.id), tagDB.findByTodoId(row.id));
  },

  create(input: CreateTodoInput): Todo {
    const normalizedDue = input.due_date ? normalizeSingaporeISO(input.due_date) : null;
    const info = db
      .prepare(
        `INSERT INTO todos (
          user_id, title, completed, due_date, priority,
          is_recurring, recurrence_pattern, reminder_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.user_id,
        input.title,
        input.completed ? 1 : 0,
        normalizedDue,
        input.priority ?? 'medium',
        input.is_recurring ? 1 : 0,
        input.is_recurring ? input.recurrence_pattern ?? null : null,
        input.reminder_minutes ?? null
      );

    const todoId = Number(info.lastInsertRowid);
    if (input.tag_ids && input.tag_ids.length > 0) {
      tagDB.setTodoTags(todoId, input.tag_ids, input.user_id);
    }
    return this.findById(todoId)!;
  },

  update(id: number, userId: number, input: UpdateTodoInput): Todo | null {
    const existing = this.findByIdForUser(id, userId);
    if (!existing) return null;

    const nextDue =
      input.due_date !== undefined
        ? input.due_date
          ? normalizeSingaporeISO(input.due_date)
          : null
        : existing.due_date;

    const nextReminder =
      input.reminder_minutes !== undefined
        ? input.reminder_minutes
        : existing.reminder_minutes;

    const dueChanged = input.due_date !== undefined && nextDue !== existing.due_date;
    const reminderChanged =
      input.reminder_minutes !== undefined && nextReminder !== existing.reminder_minutes;

    let nextLastNotification = existing.last_notification_sent;
    if (dueChanged || reminderChanged) {
      nextLastNotification = null;
    } else if (input.last_notification_sent !== undefined) {
      nextLastNotification = input.last_notification_sent;
    }

    const nextIsRecurring =
      input.is_recurring !== undefined ? input.is_recurring : existing.is_recurring;
    const nextPattern = nextIsRecurring
      ? input.recurrence_pattern !== undefined
        ? input.recurrence_pattern
        : existing.recurrence_pattern
      : null;

    db.prepare(
      `UPDATE todos SET
        title = ?,
        completed = ?,
        due_date = ?,
        priority = ?,
        is_recurring = ?,
        recurrence_pattern = ?,
        reminder_minutes = ?,
        last_notification_sent = ?,
        updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    ).run(
      input.title !== undefined ? input.title : existing.title,
      input.completed !== undefined ? (input.completed ? 1 : 0) : existing.completed ? 1 : 0,
      nextDue,
      input.priority !== undefined ? input.priority : existing.priority,
      nextIsRecurring ? 1 : 0,
      nextPattern,
      nextReminder ?? null,
      nextLastNotification,
      id,
      userId
    );

    if (input.tag_ids !== undefined) {
      tagDB.setTodoTags(id, input.tag_ids, userId);
    }

    return this.findByIdForUser(id, userId);
  },

  delete(id: number, userId: number): boolean {
    const info = db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(id, userId);
    return info.changes > 0;
  },

  findDueReminders(userId: number, nowUtcIso: string): Todo[] {
    const rows = db
      .prepare(
        `SELECT * FROM todos
         WHERE user_id = ?
           AND completed = 0
           AND due_date IS NOT NULL
           AND reminder_minutes IS NOT NULL
           AND last_notification_sent IS NULL
           AND datetime(due_date, '-' || reminder_minutes || ' minutes') <= datetime(?)`
      )
      .all(userId, nowUtcIso) as RawTodoRow[];
    return rows.map((r) => mapTodo(r));
  },

  importAll(userId: number, items: TodoExportItem[]): ImportResult {
    let tagsCreated = 0;
    let tagsReused = 0;

    const insertTodo = db.prepare(
      `INSERT INTO todos (
        user_id, title, completed, due_date, priority,
        is_recurring, recurrence_pattern, reminder_minutes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertSubtask = db.prepare(
      'INSERT INTO subtasks (todo_id, title, completed, position) VALUES (?, ?, ?, ?)'
    );
    const findTagByNameCI = db.prepare(
      'SELECT id FROM tags WHERE user_id = ? AND LOWER(name) = LOWER(?)'
    );
    const insertTag = db.prepare(
      'INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)'
    );
    const linkTodoTag = db.prepare(
      'INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)'
    );

    const run = db.transaction((exportItems: TodoExportItem[]) => {
      for (const item of exportItems) {
        const normalizedDue = item.due_date ? normalizeSingaporeISO(item.due_date) : null;
        const todoId = Number(
          insertTodo.run(
            userId,
            item.title,
            item.completed ? 1 : 0,
            normalizedDue,
            item.priority ?? 'medium',
            item.is_recurring ? 1 : 0,
            item.is_recurring ? item.recurrence_pattern ?? null : null,
            item.reminder_minutes ?? null,
            item.created_at || new Date().toISOString()
          ).lastInsertRowid
        );

        item.subtasks.forEach((s, i) => {
          insertSubtask.run(todoId, s.title, s.completed ? 1 : 0, s.position ?? i);
        });

        for (const tag of item.tags) {
          const existing = findTagByNameCI.get(userId, tag.name) as { id: number } | undefined;
          let tagId: number;
          if (existing) {
            tagsReused++;
            tagId = existing.id;
          } else {
            tagsCreated++;
            tagId = Number(
              insertTag.run(userId, tag.name, tag.color || '#3B82F6').lastInsertRowid
            );
          }
          linkTodoTag.run(todoId, tagId);
        }
      }
    });

    run(items);
    return { imported: items.length, tagsCreated, tagsReused };
  },
};

// ---------------------------------------------------------------------------
// Template DB
// ---------------------------------------------------------------------------

export const templateDB = {
  findAllByUser(userId: number): Template[] {
    const rows = db
      .prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY id DESC')
      .all(userId) as RawTemplateRow[];
    return rows.map(mapTemplate);
  },

  findById(id: number): Template | null {
    const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as
      | RawTemplateRow
      | undefined;
    return row ? mapTemplate(row) : null;
  },

  create(input: CreateTemplateInput): Template {
    const info = db
      .prepare(
        `INSERT INTO templates (
          user_id, name, description, category, title_template,
          priority, is_recurring, recurrence_pattern, reminder_minutes,
          due_date_offset_minutes, subtasks_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.user_id,
        input.name,
        input.description ?? null,
        input.category ?? null,
        input.title_template,
        input.priority ?? 'medium',
        input.is_recurring ? 1 : 0,
        input.is_recurring ? input.recurrence_pattern ?? null : null,
        input.reminder_minutes ?? null,
        input.due_date_offset_minutes ?? null,
        input.subtasks_json ?? null
      );
    return this.findById(Number(info.lastInsertRowid))!;
  },

  update(id: number, userId: number, input: UpdateTemplateInput): Template | null {
    const existing = this.findById(id);
    if (!existing || existing.user_id !== userId) return null;

    const nextIsRecurring =
      input.is_recurring !== undefined ? input.is_recurring : existing.is_recurring;

    db.prepare(
      `UPDATE templates SET
        name = ?,
        description = ?,
        category = ?,
        title_template = ?,
        priority = ?,
        is_recurring = ?,
        recurrence_pattern = ?,
        reminder_minutes = ?,
        due_date_offset_minutes = ?,
        subtasks_json = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      input.name !== undefined ? input.name : existing.name,
      input.description !== undefined ? input.description : existing.description,
      input.category !== undefined ? input.category : existing.category,
      input.title_template !== undefined ? input.title_template : existing.title_template,
      input.priority !== undefined ? input.priority : existing.priority,
      nextIsRecurring ? 1 : 0,
      nextIsRecurring
        ? input.recurrence_pattern !== undefined
          ? input.recurrence_pattern
          : existing.recurrence_pattern
        : null,
      input.reminder_minutes !== undefined ? input.reminder_minutes : existing.reminder_minutes,
      input.due_date_offset_minutes !== undefined
        ? input.due_date_offset_minutes
        : existing.due_date_offset_minutes,
      input.subtasks_json !== undefined ? input.subtasks_json : existing.subtasks_json,
      id,
      userId
    );
    return this.findById(id);
  },

  delete(id: number, userId: number): boolean {
    const info = db
      .prepare('DELETE FROM templates WHERE id = ? AND user_id = ?')
      .run(id, userId);
    return info.changes > 0;
  },
};

// ---------------------------------------------------------------------------
// Holiday DB
// ---------------------------------------------------------------------------

export const holidayDB = {
  findAll(): Holiday[] {
    return db.prepare('SELECT * FROM holidays ORDER BY date ASC').all() as Holiday[];
  },

  findByMonth(year: number, month: number): Holiday[] {
    // Include +/- 7 days padding to cover leading/trailing calendar grid cells
    const start = new Date(Date.UTC(year, month - 1, -6)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(year, month, 7)).toISOString().slice(0, 10);
    return db
      .prepare('SELECT * FROM holidays WHERE date >= ? AND date <= ? ORDER BY date ASC')
      .all(start, end) as Holiday[];
  },

  upsert(date: string, name: string): void {
    db.prepare(
      `INSERT INTO holidays (date, name) VALUES (?, ?)
       ON CONFLICT(date) DO UPDATE SET name = excluded.name`
    ).run(date, name);
  },
};

