export interface JournalBackup {
  format: 'journal-trader-backup'
  version: 1
  exportedAt: string
  data: Record<string, string | null>
}

export function createJournalBackup(storage?: Pick<Storage, 'getItem'>): JournalBackup
export function restoreJournalBackup(backup: unknown, storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): void