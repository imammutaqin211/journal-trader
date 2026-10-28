import test from 'node:test'
import assert from 'node:assert/strict'
import { createJournalBackup, restoreJournalBackup } from './journalBackup.js'

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

test('backup round-trip preserves all journal storage and clears keys absent in the backup', () => {
  const source = createStorage({
    'traders-journal:trades': '[{"id":"trade-1"}]',
    'traders-journal:app-settings': '{"profile":{"username":"alex"}}',
  })
  const target = createStorage({ 'traders-journal:trades': '[]', 'traders-journal:no-trade-reasons': '{"2026-10-27":"holiday"}' })

  restoreJournalBackup(createJournalBackup(source), target)

  assert.equal(target.getItem('traders-journal:trades'), '[{"id":"trade-1"}]')
  assert.equal(target.getItem('traders-journal:app-settings'), '{"profile":{"username":"alex"}}')
  assert.equal(target.getItem('traders-journal:no-trade-reasons'), null)
})

test('backup round-trip preserves screenshot Base64 data', () => {
  const image = { id: 'image-1', name: 'chart.png', src: 'data:image/png;base64,aGVsbG8=' }
  const source = createStorage({ 'traders-journal:screenshots': JSON.stringify([image]) })
  const target = createStorage()

  restoreJournalBackup(createJournalBackup(source), target)

  assert.deepEqual(JSON.parse(target.getItem('traders-journal:screenshots')), [image])
})

test('invalid backups are rejected without changing existing data', () => {
  const target = createStorage({ 'traders-journal:trades': '[{"id":"keep"}]' })

  assert.throws(() => restoreJournalBackup({ format: 'journal-trader-backup', version: 1, data: {} }, target), /incomplete or invalid/)
  assert.equal(target.getItem('traders-journal:trades'), '[{"id":"keep"}]')
})