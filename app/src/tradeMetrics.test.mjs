import test from 'node:test'
import assert from 'node:assert/strict'
import { createTradeId, getEquityCurve, getTradeDate, getTradeNetPnl, getTradeRiskReward, getTradeStats } from './tradeMetrics.js'

function trade(overrides = {}) {
  return {
    id: 'trade-1',
    symbol: 'ABC',
    side: 'Long',
    instrument: 'Equity',
    status: 'Closed',
    entryPrice: 100,
    exitPrice: 110,
    shares: 2,
    createdAt: '2026-10-27T12:00:00.000Z',
    notes: '',
    ...overrides,
  }
}

test('creates unique trade IDs', () => {
  const ids = Array.from({ length: 100 }, createTradeId)
  assert.equal(new Set(ids).size, ids.length)
})

test('calculates closed long and short PnL and deducts fees once', () => {
  assert.equal(getTradeNetPnl(trade({ commission: 3 })), 17)
  assert.equal(getTradeNetPnl(trade({ side: 'Short', commission: 3 })), -23)
  assert.equal(getTradeNetPnl(trade({ customFields: { Commission: 3, 'Execution fees': 8 } })), 17)
  assert.equal(getTradeNetPnl(trade({ commission: 5, actualPnl: 14 })), 14)
})

test('uses known futures multipliers and rejects unsupported contract multipliers', () => {
  assert.equal(getTradeNetPnl(trade({ symbol: 'NQ', instrument: 'Futures' })), 400)
  assert.equal(getTradeNetPnl(trade({ symbol: 'UNKNOWN', instrument: 'Futures' })), null)
  assert.equal(getTradeNetPnl(trade({ instrument: 'Options' })), null)
})

test('requires contract metadata for crypto perpetual PnL', () => {
  const perpetual = trade({ instrument: 'Crypto', symbolMetadata: { marketType: 'perpetual', contractMultiplier: null } })
  assert.equal(getTradeNetPnl(perpetual), null)
  assert.equal(getTradeNetPnl({ ...perpetual, symbolMetadata: { marketType: 'perpetual', contractMultiplier: 0.1 } }), 2)
  assert.equal(getTradeNetPnl({ ...perpetual, actualPnl: 1.5 }), 1.5)
})

test('ignores open and invalid trades and calculates safe summary values', () => {
  const stats = getTradeStats([
    trade(),
    trade({ id: 'loss', exitPrice: 90 }),
    trade({ id: 'flat', exitPrice: 100 }),
    trade({ id: 'open', status: 'Open' }),
    trade({ id: 'bad', entryPrice: Number.NaN }),
  ])

  assert.equal(stats.closedCount, 4)
  assert.equal(stats.validCount, 3)
  assert.equal(stats.invalidCount, 1)
  assert.equal(stats.wins, 1)
  assert.equal(stats.losses, 1)
  assert.equal(stats.breakeven, 1)
  assert.equal(stats.totalPnl, 0)
  assert.ok(Math.abs(stats.winRate - 100 / 3) < 1e-10)
})

test('orders equity curve by exit date and uses exit date without timezone conversion', () => {
  const curve = getEquityCurve([
    trade({ id: 'later', exitDateTime: '2026-10-28T08:30', exitPrice: 120 }),
    trade({ id: 'earlier', exitDateTime: '2026-10-27T23:45', exitPrice: 105 }),
  ])

  assert.deepEqual(curve.map((row) => [row.date, row.equity]), [['2026-10-27', 10], ['2026-10-28', 50]])
  assert.equal(getTradeDate(trade({ exitDateTime: undefined, date: 'OCT 27, 2026' })), '2026-10-27')
})

test('calculates realized risk/reward from entry, exit, and stop loss', () => {
  assert.equal(getTradeRiskReward(trade({ entryPrice: 100, exitPrice: 105, stopLoss: 95 })), 1)
  assert.equal(getTradeRiskReward(trade({ entryPrice: 100, exitPrice: 110, stopLoss: 95 })), 2)
  assert.equal(getTradeRiskReward(trade({ entryPrice: 100, exitPrice: 90, stopLoss: 95 })), 2)
  assert.equal(getTradeRiskReward(trade({ entryPrice: 100, exitPrice: 110 })), null)
  assert.equal(getTradeRiskReward(trade({ entryPrice: 100, exitPrice: 110, stopLoss: 100 })), null)
})