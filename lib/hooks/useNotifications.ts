import { useCallback, useEffect, useState } from 'react';
import { formatSingaporeDate, getSingaporeNow } from '@/lib/timezone';
import type { Todo } from '@/lib/db';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  useEffect(() => {
    if (permission !== 'granted') return;

    const poll = async () => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') {
        setPermission(Notification.permission);
        return;
      }

      try {
        const res = await fetch('/api/notifications/check');
        if (!res.ok) return;
        const json = await res.json();
        const dueTodos: Todo[] = json.data ?? [];

        for (const todo of dueTodos) {
          new Notification(todo.title, {
            body: todo.due_date ? `Due ${formatSingaporeDate(todo.due_date)}` : 'Todo reminder',
            tag: `todo-${todo.id}`,
          });

          await fetch(`/api/todos/${todo.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              last_notification_sent: getSingaporeNow().toISOString(),
            }),
          });
        }
      } catch {
        // Ignore transient network errors during polling
      }
    };

    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [permission]);

  return { permission, requestPermission };
}

