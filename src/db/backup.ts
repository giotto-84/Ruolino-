import { db } from './db';

const FORMAT = 'giotto-pt-backup';
const VERSION = 1;
const TABLES = ['profile', 'programs', 'sessions', 'states', 'body', 'photos', 'checkins'] as const;

export interface BackupFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  data: Record<(typeof TABLES)[number], unknown[]>;
}

export async function exportBackup(): Promise<BackupFile> {
  const data = {} as BackupFile['data'];
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), data };
}

export function backupFileName(d = new Date()): string {
  return `giotto-pt-backup-${d.toISOString().slice(0, 10)}.json`;
}

/** Validate and replace all local data with the backup content. */
export async function importBackup(json: unknown): Promise<void> {
  const file = json as Partial<BackupFile>;
  if (!file || file.format !== FORMAT || typeof file.data !== 'object' || file.data === null) {
    throw new Error('Questo file non è un backup di Giotto PT.');
  }
  if ((file.version ?? 0) > VERSION) {
    throw new Error('Il backup è stato creato con una versione più recente dell\'app. Aggiorna l\'app e riprova.');
  }
  const data = file.data as BackupFile['data'];
  if (!Array.isArray(data.profile) || data.profile.length === 0) {
    throw new Error('Il backup non contiene un profilo.');
  }
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      const rows = data[t];
      if (Array.isArray(rows) && rows.length) await db.table(t).bulkPut(rows);
    }
  });
}

/** Share (on phones) or download the backup file. */
export async function saveBackup(): Promise<'shared' | 'downloaded'> {
  const backup = await exportBackup();
  const name = backupFileName();
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Backup Giotto PT' });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') throw e;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
