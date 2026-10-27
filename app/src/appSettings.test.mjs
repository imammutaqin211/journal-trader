import test from 'node:test'
import assert from 'node:assert/strict'
import { combineAccountEquityCurves, getAccountEquity, getAccountEquityCurve, getStoredAppSettings, saveStoredAppSettings } from './appSettings.js'

test('settings persist profile and account preferences', () => {
  const settings = getStoredAppSettings()
  settings.profile.firstName = 'Alex'
  settings.account.balance = 50000
  settings.account.baseCurrency = 'IDR'
  settings.account.cashMovements = [{ id: 'deposit-1', date: '2026-10-27', type: 'deposit', amount: 1000, note: 'Fund account' }]

  assert.equal(saveStoredAppSettings(settings), true)
  const saved = getStoredAppSettings()
  assert.equal(saved.profile.firstName, 'Alex')
  assert.equal(saved.account.balance, 50000)
  assert.equal(saved.account.baseCurrency, 'IDR')
  assert.equal(saved.account.cashMovements[0].amount, 1000)
})

test('settings normalization rejects invalid financial values and preferences', () => {
  const settings = getStoredAppSettings()
  settings.account.balance = -1
  settings.account.baseCurrency = 'FAKE'
  settings.account.cashMovements.push({ id: 'bad', date: 'not-a-date', type: 'deposit', amount: 5 })

  assert.equal(saveStoredAppSettings(settings), true)
  const saved = getStoredAppSettings()
  assert.equal(saved.account.balance, 0)
  assert.equal(saved.account.baseCurrency, 'USD')
  assert.equal(saved.account.cashMovements.length, 1)
})

test('starting balance includes all realized PnL and cash movements', () => {
  const trades = [{ id: 'trade-1', symbol: 'ABC', side: 'Long', instrument: 'Equity', status: 'Closed', entryPrice: 100, exitPrice: 110, shares: 1, createdAt: '2026-10-27T13:00:00.000Z' }]
  const account = {
    balance: 1000,
    balanceType: 'starting',
    cashMovements: [
      { date: '2026-10-26', type: 'deposit', amount: 200 },
      { date: '2026-10-27', type: 'withdrawal', amount: 50 },
    ],
  }

  assert.equal(getAccountEquity(trades, account), 1160)
})

test('current balance only adds trades and movements after its baseline timestamp', () => {
  const trades = [
    { id: 'before', symbol: 'ABC', side: 'Long', instrument: 'Equity', status: 'Closed', entryPrice: 100, exitPrice: 105, shares: 1, createdAt: '2026-10-27T11:00:00.000Z' },
    { id: 'after', symbol: 'ABC', side: 'Long', instrument: 'Equity', status: 'Closed', entryPrice: 100, exitPrice: 110, shares: 1, createdAt: '2026-10-27T13:00:00.000Z' },
  ]
  const account = {
    balance: 5000,
    balanceType: 'current',
    balanceAsOf: '2026-10-27T12:00:00.000Z',
    cashMovements: [
      { date: '2026-10-27', type: 'deposit', amount: 50, createdAt: '2026-10-27T14:00:00.000Z' },
      { date: '2026-10-27', type: 'withdrawal', amount: 25, createdAt: '2026-10-27T10:00:00.000Z' },
    ],
  }

  assert.equal(getAccountEquity(trades, account), 5060)
})

test('equity curve applies the baseline and cash movements in date order', () => {
  const trades = [{ id: 'trade-1', symbol: 'ABC', side: 'Long', instrument: 'Equity', status: 'Closed', entryPrice: 100, exitPrice: 110, shares: 1, createdAt: '2026-10-27T13:00:00.000Z' }]
  const account = {
    balance: 1000,
    balanceType: 'starting',
    cashMovements: [
      { date: '2026-10-26', type: 'deposit', amount: 100, createdAt: '2026-10-26T12:00:00.000Z' },
      { date: '2026-10-28', type: 'withdrawal', amount: 25, createdAt: '2026-10-28T12:00:00.000Z' },
    ],
  }

  assert.deepEqual(getAccountEquityCurve(trades, account), [
    { date: '2026-10-26', equity: 1000 },
    { date: '2026-10-26', equity: 1100 },
    { date: '2026-10-27', equity: 1110 },
    { date: '2026-10-28', equity: 1085 },
  ])
})

test('named accounts persist and duplicate names normalize case-insensitively', () => {
  const settings = getStoredAppSettings()
  settings.account.balance = 0
  settings.account.cashMovements = []
  settings.accounts = [
    { id: 'account-core', name: 'Core', balance: 5000, cashMovements: [{ id: 'core-deposit', date: '2026-10-27', type: 'deposit', amount: 100 }] },
    { id: 'account-swing', name: 'Swing', balance: 250 },
    { id: 'account-swing-copy', name: 'sWING' },
  ]

  assert.equal(saveStoredAppSettings(settings), true)
  const accounts = getStoredAppSettings().accounts
  assert.deepEqual(accounts.map(({ id, name }) => ({ id, name })), [{ id: 'account-core', name: 'Core' }, { id: 'account-swing', name: 'Swing' }])
  assert.equal(accounts[0].balance, 5000)
  assert.equal(accounts[0].cashMovements[0].amount, 100)
  assert.equal(accounts[1].balance, 250)
  assert.equal(accounts[1].cashMovements.length, 0)
})

test('removes the previous seeded Main account during settings migration', () => {
  const settings = getStoredAppSettings()
  settings.accounts = [{ id: 'account-main', name: 'Main' }]

  assert.equal(saveStoredAppSettings(settings), true)
  assert.deepEqual(getStoredAppSettings().accounts, [])
})

test('combined equity curve adds account balances and cash movements by date', () => {
  assert.deepEqual(combineAccountEquityCurves([
    [{ date: '2026-10-26', equity: 1100 }, { date: '2026-10-27', equity: 1110 }],
    [{ date: '2026-10-27', equity: 500 }, { date: '2026-10-28', equity: 450 }],
  ]), [
    { date: '2026-10-26', equity: 1100 },
    { date: '2026-10-27', equity: 1610 },
    { date: '2026-10-28', equity: 1560 },
  ])
})