const BACKUP_FORMAT = 'journal-trader-backup'
const STORAGE_KEYS = [
  'traders-journal:trades',
  'traders-journal:screenshots',
  'traders-journal:enabled-fields',
  'traders-journal:symbol-favorites',
  'traders-journal:custom-symbols',
  'traders-journal:no-trade-reasons',
  'traders-journal:app-settings',
]

export function createJournalBackup(storage = globalThis.localStorage) {
  const data = Object.fromEntries(STORAGE_KEYS.map((key) => [key, storage.getItem(key)]))
  return { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), data }
}

export function restoreJournalBackup(backup, storage = globalThis.localStorage) {
  const data = backup?.data
  if (backup?.format !== BACKUP_FORMAT || backup?.version !== 1 || !data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('This is not a supported journal backup.')
  }
  if (Object.keys(data).length !== STORAGE_KEYS.length || STORAGE_KEYS.some((key) => !Object.hasOwn(data, key) || (data[key] !== null && typeof data[key] !== 'string'))) {
    throw new Error('The backup file is incomplete or invalid.')
  }
  for (const value of Object.values(data)) {
    if (value !== null) {
      try {
        JSON.parse(value)
      } catch {
        throw new Error('The backup file contains invalid journal data.')
      }
    }
  }

  const previous = Object.fromEntries(STORAGE_KEYS.map((key) => [key, storage.getItem(key)]))
  try {
    for (const key of STORAGE_KEYS) {
      if (data[key] === null) storage.removeItem(key)
      else storage.setItem(key, data[key])
    }
  } catch {
    for (const key of STORAGE_KEYS) {
      try {
        if (previous[key] === null) storage.removeItem(key)
        else storage.setItem(key, previous[key])
      } catch {}
    }
    throw new Error('Could not write the backup to browser storage.')
  }
}