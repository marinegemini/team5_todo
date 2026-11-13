const SINGAPORE_TZ = 'Asia/Singapore';

export interface SingaporeDateParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number; // 0-59
  second: number; // 0-59
}

export function getSingaporeNow(): Date {
  return new Date();
}

/**
 * Parse a date input (Date or ISO string). If a string has no timezone offset
 * (e.g. from <input type="datetime-local"> like "2026-11-14T15:30"), treat it as Asia/Singapore (+08:00).
 */
export function parseSingaporeDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  const trimmed = input.trim();
  // If it's YYYY-MM-DD only
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00+08:00`);
  }
  // If it has no Z and no +/- offset at the end
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed)) {
    const normalized = trimmed.replace(' ', 'T');
    const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
    return new Date(`${withSeconds}+08:00`);
  }
  return new Date(trimmed);
}

/**
 * Normalize a due_date string into ISO 8601 with +08:00 offset so that
 * .slice(0, 10) always yields the Singapore-local YYYY-MM-DD date.
 */
export function normalizeSingaporeISO(input: Date | string): string {
  const date = parseSingaporeDate(input);
  const parts = toSingaporeParts(date);
  return fromSingaporeParts(parts, parts.hour, parts.minute, parts.second);
}

export function toSingaporeParts(input: Date | string): SingaporeDateParts {
  const date = parseSingaporeDate(input);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: SINGAPORE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const hour = get('hour');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: hour === 24 ? 0 : hour,
    minute: get('minute'),
    second: get('second'),
  };
}

export function fromSingaporeParts(
  datePart: { year: number; month: number; day: number },
  hour = 0,
  minute = 0,
  second = 0
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${datePart.year}-${pad(datePart.month)}-${pad(datePart.day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+08:00`;
}

export function addDays(
  datePart: { year: number; month: number; day: number },
  days: number
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(datePart.year, datePart.month - 1, datePart.day + days));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

export function addMinutes(input: Date | string, minutes: number): Date {
  const date = parseSingaporeDate(input);
  return new Date(date.getTime() + minutes * 60_000);
}

export function formatSingaporeDate(input: Date | string, formatStr?: string): string {
  const parts = toSingaporeParts(input);
  const pad = (n: number) => String(n).padStart(2, '0');

  if (!formatStr) {
    const date = parseSingaporeDate(input);
    return new Intl.DateTimeFormat('en-SG', {
      timeZone: SINGAPORE_TZ,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }

  return formatStr
    .replace(/yyyy|YYYY/g, String(parts.year))
    .replace(/MM/g, pad(parts.month))
    .replace(/dd|DD/g, pad(parts.day))
    .replace(/HH/g, pad(parts.hour))
    .replace(/mm/g, pad(parts.minute))
    .replace(/ss/g, pad(parts.second));
}

export function toDateTimeLocalValue(isoString: string | null): string {
  if (!isoString) return '';
  return formatSingaporeDate(isoString, 'YYYY-MM-DDTHH:mm');
}

