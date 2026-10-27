import { getRealizedTrades } from './tradeMetrics.js'

const STORAGE_KEY = 'traders-journal:app-settings'
const memoryStore = {}
const currencies = new Set(['USD', 'EUR', 'INR', 'IDR'])
const timezones = new Set(['UTC', 'Asia/Jakarta', 'America/New_York', 'Europe/London'])

export const DEFAULT_TRADING_ACCOUNT = {
  balance: 0,
  balanceType: 'starting',
  balanceAsOf: null,
  cashMovements: [],
  weeklyTarget: 0,
  monthlyTarget: 0,
  targetWinRate: 0,
  maxDrawdown: 0,
  targetRiskReward: 0,
}

export const DEFAULT_APP_SETTINGS = {
  accounts: [],
  profile: {
    firstName: '',
    lastName: '',
    username: 'trader',
    email: '',
    phone: '',
    about: '',
  },
  account: {
    balance: 0,
    balanceType: 'starting',
    balanceAsOf: null,
    cashMovements: [],
    weeklyTarget: 0,
    monthlyTarget: 0,
    targetWinRate: 0,
    maxDrawdown: 0,
    targetRiskReward: 0,
    timezone: 'Asia/Jakarta',
    baseCurrency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12-hour',
  },
}

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  } catch {}

  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null
    },
    setItem(key, value) {
      memoryStore[key] = String(value)
    },
  }
}

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function number(value, fallback = 0) {
  if (value === '' || value === null || value === undefined || typeof value === 'boolean') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export function normalizeAppSettings(value) {
  const rawAccounts = Array.isArray(value?.accounts) ? value.accounts.filter((item) => item?.id !== 'account-main') : DEFAULT_APP_SETTINGS.accounts
  const accounts = []
  const accountNames = new Set()
  const legacyAccount = value?.account && typeof value.account === 'object' ? value.account : {}
  rawAccounts.forEach((item, index) => {
    if (!item || typeof item !== 'object') return
    const id = text(item.id)
    const name = text(item.name)
    const normalizedName = name.toLocaleLowerCase()
    if (!id || !name || id === 'account-main' || accountNames.has(normalizedName)) return
    const financial = index === 0 ? { ...legacyAccount, ...item } : item
    const rawMovements = Array.isArray(financial.cashMovements) ? financial.cashMovements : []
    const cashMovements = rawMovements.flatMap((movement) => {
      if (!movement || typeof movement !== 'object') return []
      const movementId = text(movement.id)
      const date = text(movement.date)
      const amount = number(movement.amount, -1)
      const type = movement.type === 'deposit' || movement.type === 'withdrawal' ? movement.type : null
      if (!movementId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || amount <= 0 || !type) return []
      return [{ id: movementId, date, type, amount, note: text(movement.note), createdAt: text(movement.createdAt) || null }]
    })
    accounts.push({
      id,
      name,
      balance: number(financial.balance),
      balanceType: financial.balanceType === 'current' ? 'current' : 'starting',
      balanceAsOf: typeof financial.balanceAsOf === 'string' ? financial.balanceAsOf : null,
      cashMovements,
      weeklyTarget: number(financial.weeklyTarget),
      monthlyTarget: number(financial.monthlyTarget),
      targetWinRate: number(financial.targetWinRate),
      maxDrawdown: number(financial.maxDrawdown),
      targetRiskReward: number(financial.targetRiskReward),
    })
    accountNames.add(normalizedName)
  })
  const profile = value?.profile && typeof value.profile === 'object' ? value.profile : {}
  const account = value?.account && typeof value.account === 'object' ? value.account : {}
  const cashMovements = Array.isArray(account.cashMovements) ? account.cashMovements.flatMap((movement) => {
    if (!movement || typeof movement !== 'object') return []
    const id = text(movement.id)
    const date = text(movement.date)
    const amount = number(movement.amount, -1)
    const type = movement.type === 'deposit' || movement.type === 'withdrawal' ? movement.type : null
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date) || amount <= 0 || !type) return []
    return [{ id, date, type, amount, note: text(movement.note), createdAt: text(movement.createdAt) || null }]
  }) : []

  return {
    accounts,
    profile: {
      firstName: text(profile.firstName),
      lastName: text(profile.lastName),
      username: text(profile.username, DEFAULT_APP_SETTINGS.profile.username),
      email: text(profile.email),
      phone: text(profile.phone),
      about: text(profile.about),
    },
    account: {
      balance: number(account.balance),
      balanceType: account.balanceType === 'current' ? 'current' : 'starting',
      balanceAsOf: typeof account.balanceAsOf === 'string' ? account.balanceAsOf : null,
      cashMovements,
      weeklyTarget: number(account.weeklyTarget),
      monthlyTarget: number(account.monthlyTarget),
      targetWinRate: number(account.targetWinRate),
      maxDrawdown: number(account.maxDrawdown),
      targetRiskReward: number(account.targetRiskReward),
      timezone: timezones.has(account.timezone) ? account.timezone : DEFAULT_APP_SETTINGS.account.timezone,
      baseCurrency: currencies.has(account.baseCurrency) ? account.baseCurrency : DEFAULT_APP_SETTINGS.account.baseCurrency,
      dateFormat: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].includes(account.dateFormat) ? account.dateFormat : DEFAULT_APP_SETTINGS.account.dateFormat,
      timeFormat: account.timeFormat === '24-hour' ? '24-hour' : '12-hour',
    },
  }
}

export function getStoredAppSettings() {
  try {
    const raw = getStorage().getItem(STORAGE_KEY)
    return raw ? normalizeAppSettings(JSON.parse(raw)) : normalizeAppSettings(DEFAULT_APP_SETTINGS)
  } catch {
    return normalizeAppSettings(DEFAULT_APP_SETTINGS)
  }
}

export function saveStoredAppSettings(settings) {
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(normalizeAppSettings(settings)))
    return true
  } catch {
    return false
  }
}

export function getAccountEquity(trades, account) {
  const curve = getAccountEquityCurve(trades, account)
  return curve.length ? curve[curve.length - 1].equity : account.balance
}

export function getAccountEquityCurve(trades, account) {
  const baselineTime = account.balanceType === 'current' && account.balanceAsOf ? Date.parse(account.balanceAsOf) : null
  const events = getRealizedTrades(trades).flatMap(({ trade, pnl, date }) => {
    const timestamp = Date.parse(trade.exitDateTime ?? trade.createdAt)
    return Number.isFinite(timestamp) && (baselineTime === null || timestamp > baselineTime) ? [{ date, timestamp, amount: pnl }] : []
  })
  events.push(...account.cashMovements.flatMap((movement) => {
    const timestamp = movement.createdAt ? Date.parse(movement.createdAt) : Date.parse(`${movement.date}T00:00:00`)
    return Number.isFinite(timestamp) && (baselineTime === null || timestamp > baselineTime) ? [{ date: movement.date, timestamp, amount: movement.type === 'deposit' ? movement.amount : -movement.amount }] : []
  }))
  events.sort((left, right) => left.timestamp - right.timestamp)
  if (!events.length && account.balance === 0) return []

  let equity = account.balance
  const firstDate = account.balanceType === 'current' && account.balanceAsOf
    ? account.balanceAsOf.slice(0, 10)
    : events[0]?.date ?? new Date().toISOString().slice(0, 10)
  const curve = [{ date: firstDate, equity }]
  const dailyEvents = new Map()
  events.forEach((event) => dailyEvents.set(event.date, (dailyEvents.get(event.date) ?? 0) + event.amount))
  for (const [date, amount] of [...dailyEvents].sort(([left], [right]) => left.localeCompare(right))) {
    equity = Math.round((equity + amount + Number.EPSILON) * 100) / 100
    curve.push({ date, equity })
  }
  return curve
}

export function combineAccountEquityCurves(curves) {
  const dates = [...new Set(curves.flatMap((curve) => curve.map((point) => point.date)))].sort()
  return dates.map((date) => {
    const equity = curves.reduce((total, curve) => {
      let latest = 0
      for (const point of curve) {
        if (point.date > date) break
        latest = point.equity
      }
      return total + latest
    }, 0)
    return { date, equity: Math.round((equity + Number.EPSILON) * 100) / 100 }
  })
}