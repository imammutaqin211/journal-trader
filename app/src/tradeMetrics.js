const futureMultipliers = {
  NQ: 20,
  MNQ: 2,
  ES: 50,
  MES: 5,
  YM: 5,
  MYM: 0.5,
  RTY: 50,
  M2K: 5,
  CL: 1000,
  MCL: 100,
  GC: 100,
  MGC: 10,
}

function finiteNumber(value) {
  if (value === '' || value === null || value === undefined || typeof value === 'boolean') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function getTradeMultiplier(trade) {
  const explicit = finiteNumber(trade.multiplier)
  if (explicit !== null && explicit > 0) return explicit
  const catalogMultiplier = finiteNumber(trade.symbolMetadata?.contractMultiplier)
  if (catalogMultiplier !== null && catalogMultiplier > 0) return catalogMultiplier

  const instrument = String(trade.instrument ?? '').toLowerCase()
  if (instrument === 'equity') return 1
  if (instrument === 'crypto') return String(trade.symbolMetadata?.marketType ?? '').toLowerCase() === 'perpetual' ? null : 1
  if (instrument === 'futures') return futureMultipliers[String(trade.symbol ?? '').toUpperCase()] ?? null
  return null
}

export function getTradeCommission(trade) {
  const customFields = trade.customFields ?? {}
  const raw = [trade.commission, customFields.Commission, customFields['Execution fees']].find((value) => value !== '' && value !== null && value !== undefined) ?? 0
  const commission = finiteNumber(raw)
  return commission !== null && commission >= 0 ? commission : null
}

export function getTradeNetPnl(trade) {
  if (String(trade.status ?? '').toLowerCase() !== 'closed') return null

  if (trade.actualPnl !== undefined && trade.actualPnl !== null && trade.actualPnl !== '') {
    const actualPnl = finiteNumber(trade.actualPnl)
    return actualPnl === null ? null : Math.round((actualPnl + Number.EPSILON) * 100) / 100
  }

  const entryPrice = finiteNumber(trade.entryPrice ?? trade.entry)
  const exitPrice = finiteNumber(trade.exitPrice ?? trade.exit)
  const quantity = finiteNumber(trade.shares ?? trade.contracts)
  const multiplier = getTradeMultiplier(trade)
  const commission = getTradeCommission(trade)

  if (entryPrice === null || exitPrice === null || entryPrice < 0 || exitPrice < 0 || quantity === null || quantity <= 0 || multiplier === null || commission === null) return null
  if (trade.side !== 'Long' && trade.side !== 'Short') return null

  const grossPnl = (trade.side === 'Long' ? exitPrice - entryPrice : entryPrice - exitPrice) * quantity * multiplier
  return Math.round((grossPnl - commission + Number.EPSILON) * 100) / 100
}

export function getTradeRiskReward(trade) {
  const entryPrice = finiteNumber(trade.entryPrice ?? trade.entry)
  const exitPrice = finiteNumber(trade.exitPrice ?? trade.exit)
  const stopLoss = finiteNumber(trade.stopLoss)
  if (entryPrice === null || exitPrice === null || stopLoss === null || entryPrice < 0 || exitPrice < 0 || stopLoss < 0) return null

  const risk = Math.abs(entryPrice - stopLoss)
  if (risk === 0) return null
  return Math.abs(exitPrice - entryPrice) / risk
}

export function getTradeDate(trade) {
  const candidates = [trade.exitDateTime, trade.date, trade.createdAt]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const isoDate = candidate.match(/^(\d{4}-\d{2}-\d{2})/)
    if (isoDate) return isoDate[1]
    const namedDate = candidate.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/)
    if (namedDate) {
      const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(namedDate[1].slice(0, 3).toLowerCase()) + 1
      if (month > 0) return `${namedDate[3]}-${String(month).padStart(2, '0')}-${String(Number(namedDate[2])).padStart(2, '0')}`
    }
    const usDate = candidate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (usDate) return `${usDate[3]}-${String(Number(usDate[1])).padStart(2, '0')}-${String(Number(usDate[2])).padStart(2, '0')}`
    const parsedDate = new Date(candidate)
    if (Number.isFinite(parsedDate.getTime())) return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`
  }
  return null
}

export function getTradeTime(trade) {
  const timestamp = trade.exitDateTime
  if (typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timestamp)) return timestamp.slice(11, 16)
  if (typeof trade.time === 'string' && /^\d{2}:\d{2}$/.test(trade.time)) return trade.time
  if (typeof trade.createdAt === 'string') {
    const createdTime = trade.createdAt.match(/T(\d{2}:\d{2})/)
    if (createdTime) return createdTime[1]
  }
  return null
}

export function getRealizedTrades(trades) {
  return trades
    .map((trade) => ({ trade, pnl: getTradeNetPnl(trade), date: getTradeDate(trade) }))
    .filter((row) => row.pnl !== null && row.date !== null)
    .sort((left, right) => left.date.localeCompare(right.date) || String(left.trade.exitDateTime ?? left.trade.createdAt).localeCompare(String(right.trade.exitDateTime ?? right.trade.createdAt)) || left.trade.id.localeCompare(right.trade.id))
}

export function getTradeStats(trades) {
  const closedCount = trades.filter((trade) => String(trade.status ?? '').toLowerCase() === 'closed').length
  const realizedTrades = getRealizedTrades(trades)
  const pnls = realizedTrades.map((row) => row.pnl)
  const wins = pnls.filter((pnl) => pnl > 0.005)
  const losses = pnls.filter((pnl) => pnl < -0.005)
  const breakeven = pnls.length - wins.length - losses.length
  const grossProfit = wins.reduce((sum, pnl) => sum + pnl, 0)
  const grossLoss = Math.abs(losses.reduce((sum, pnl) => sum + pnl, 0))
  let runningPnl = 0
  let peakPnl = 0
  let maxDrawdown = 0
  for (const pnl of pnls) {
    runningPnl += pnl
    peakPnl = Math.max(peakPnl, runningPnl)
    maxDrawdown = Math.max(maxDrawdown, peakPnl - runningPnl)
  }

  return {
    closedCount,
    validCount: pnls.length,
    invalidCount: closedCount - pnls.length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    winRate: pnls.length ? (wins.length / pnls.length) * 100 : 0,
    totalPnl: pnls.reduce((sum, pnl) => sum + pnl, 0),
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : 0,
    averagePnl: pnls.length ? pnls.reduce((sum, pnl) => sum + pnl, 0) / pnls.length : 0,
    averageWin: wins.length ? grossProfit / wins.length : 0,
    averageLoss: losses.length ? grossLoss / losses.length : 0,
    biggestWin: wins.length ? Math.max(...wins) : 0,
    biggestLoss: losses.length ? Math.min(...losses) : 0,
    maxDrawdown,
    commissions: realizedTrades.reduce((sum, row) => sum + (getTradeCommission(row.trade) ?? 0), 0),
    realizedTrades,
  }
}

export function getEquityCurve(trades) {
  let equity = 0
  return getRealizedTrades(trades).map((row) => {
    equity = Math.round((equity + row.pnl + Number.EPSILON) * 100) / 100
    return { ...row, equity }
  })
}

export function groupRealizedPnl(trades, period = 'day') {
  const grouped = new Map()
  for (const row of getRealizedTrades(trades)) {
    const key = period === 'month' ? row.date.slice(0, 7) : row.date
    const current = grouped.get(key) ?? { date: key, pnl: 0, count: 0 }
    current.pnl = Math.round((current.pnl + row.pnl + Number.EPSILON) * 100) / 100
    current.count += 1
    grouped.set(key, current)
  }
  return [...grouped.values()].sort((left, right) => left.date.localeCompare(right.date))
}

export function getPerformanceBy(trades, key) {
  const grouped = new Map()
  for (const row of getRealizedTrades(trades)) {
    const value = String(row.trade[key] ?? row.trade.customFields?.[key] ?? 'Not set')
    const current = grouped.get(value) ?? { value, count: 0, wins: 0, pnl: 0 }
    current.count += 1
    current.wins += row.pnl > 0.005 ? 1 : 0
    current.pnl = Math.round((current.pnl + row.pnl + Number.EPSILON) * 100) / 100
    grouped.set(value, current)
  }
  return [...grouped.values()].map((item) => ({ ...item, winRate: item.count ? (item.wins / item.count) * 100 : 0, averagePnl: item.count ? item.pnl / item.count : 0 })).sort((left, right) => right.pnl - left.pnl)
}

export function createTradeId() {
  return `trade-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}