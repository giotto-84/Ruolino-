const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function localStamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

/**
 * Weekly recurring calendar event on the training days, with an alert at the start time.
 * Importing it in the phone calendar gives reliable reminders without a server.
 */
export function buildReminderIcs(trainingDays: number[], time: string, now = new Date()): string {
  const [h, m] = time.split(':').map(Number);
  const days = [...trainingDays].sort();
  // first occurrence: next training day from today
  const start = new Date(now);
  start.setHours(h, m, 0, 0);
  for (let i = 0; i < 7; i++) {
    if (days.includes(start.getDay()) && start.getTime() > now.getTime() - 60_000) break;
    start.setDate(start.getDate() + 1);
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const utc = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Giotto PT//IT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:giotto-pt-${utc}@giotto-pt`,
    `DTSTAMP:${utc}`,
    `DTSTART:${localStamp(start)}`,
    `DTEND:${localStamp(end)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => BYDAY[d]).join(',')}`,
    'SUMMARY:Allenamento Giotto PT',
    'DESCRIPTION:Apri Giotto PT e inizia l\'allenamento di oggi.',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:È ora di allenarsi!',
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
