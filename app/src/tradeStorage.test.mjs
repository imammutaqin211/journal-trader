import test from 'node:test'
import assert from 'node:assert/strict'
import { getStoredCustomSymbols, getStoredEnabledFields, getStoredNoTradeReasons, getStoredSymbolFavorites, getStoredTrades, saveStoredCustomSymbols, saveStoredEnabledFields, saveStoredNoTradeReasons, saveStoredSymbolFavorites, saveStoredTrades } from './tradeStorage.js'

test('saveStoredTrades and getStoredTrades round-trip trade records', () => {
  const trades = [
    {
      id: 'trade-1',
      symbol: 'NQ',
      side: 'Long',
      instrument: 'Futures',
      status: 'Closed',
      entryPrice: 30292,
      exitPrice: 30345,
      shares: 1,
      notes: 'Breakout retest',
      pnl: 53,
      createdAt: '2026-10-26T19:23:00.000Z',
    },
  ]

  saveStoredTrades(trades)
  assert.deepEqual(getStoredTrades(), trades)
})

test('saveStoredEnabledFields and getStoredEnabledFields round-trip field settings', () => {
  const fields = ['Stop loss', 'Strategy', 'Timeframe']

  saveStoredEnabledFields(fields)
  assert.deepEqual(getStoredEnabledFields(), fields)
})

test('getStoredTrades drops malformed records and keeps valid trades', () => {
  const validTrade = {
    id: 'trade-valid',
    symbol: 'NQ',
    side: 'Long',
    instrument: 'Futures',
    status: 'Closed',
    entryPrice: 100,
    exitPrice: 101,
    shares: 1,
    createdAt: '2026-10-27T12:00:00.000Z',
    notes: '',
  }

  saveStoredTrades([
    validTrade,
    { ...validTrade, id: 'trade-invalid', entryPrice: 'not-a-number' },
    { ...validTrade, id: 'trade-invalid-side', side: 'Sideways' },
    null,
  ])

  assert.deepEqual(getStoredTrades().map((trade) => trade.id), ['trade-valid'])
})

test('trade screenshot IDs persist uniquely and ignore malformed values', () => {
  const trade = {
    id: 'trade-with-screenshots',
    symbol: 'NQ',
    side: 'Long',
    instrument: 'Futures',
    status: 'Closed',
    entryPrice: 100,
    exitPrice: 101,
    shares: 1,
    createdAt: '2026-10-27T12:00:00.000Z',
    notes: '',
    screenshotIds: ['image-1', 'image-1', '', 3],
  }

  saveStoredTrades([trade])
  assert.deepEqual(getStoredTrades()[0].screenshotIds, ['image-1'])
})

test('favorites and custom symbols persist and deduplicate by exchange and market type', () => {
  const custom = [
    { symbol: 'xyz', name: 'Example Equity', category: 'Stocks', marketType: 'equity', exchange: 'NYSE', isCustom: true },
    { symbol: 'XYZ', name: 'Example Equity', category: 'Stocks', marketType: 'equity', exchange: 'NYSE', isCustom: true },
    { symbol: 'XYZ', name: 'Example Future', category: 'Futures', marketType: 'futures', exchange: 'CME', isCustom: true },
  ]

  saveStoredCustomSymbols(custom)
  saveStoredSymbolFavorites(['XYZ|NYSE|equity', 'XYZ|NYSE|equity'])

  assert.equal(getStoredCustomSymbols().length, 2)
  assert.deepEqual(getStoredSymbolFavorites(), ['XYZ|NYSE|equity'])
})

test('no-trading reasons persist by date and reject invalid or empty entries', () => {
  assert.equal(saveStoredNoTradeReasons({
    '2026-10-27': '  No clear setup  ',
    'bad-date': 'Invalid key',
    '2026-10-28': '   ',
    '2026-10-29': 42,
  }), true)
  assert.deepEqual(getStoredNoTradeReasons(), { '2026-10-27': 'No clear setup' })
})
