import { getSymbolIdentity, normalizeCustomSymbol, normalizeSymbolRecord } from './symbolCatalog.js'

const STORAGE_KEY = 'traders-journal:trades'
const SCREENSHOT_KEY = 'traders-journal:screenshots'
const FIELDS_KEY = 'traders-journal:enabled-fields'
const FAVORITES_KEY = 'traders-journal:symbol-favorites'
const CUSTOM_SYMBOLS_KEY = 'traders-journal:custom-symbols'
const NO_TRADE_REASONS_KEY = 'traders-journal:no-trade-reasons'
const memoryStore = {}

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
    removeItem(key) {
      delete memoryStore[key]
    },
  }
}

function finiteNumber(value) {
  if (value === '' || value === null || value === undefined || typeof value === 'boolean') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeTrade(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entryPrice = finiteNumber(value.entryPrice ?? value.entry)
  const exitPrice = finiteNumber(value.exitPrice ?? value.exit)
  const shares = finiteNumber(value.shares ?? value.contracts)
  if (typeof value.id !== 'string' || !value.id.trim() || typeof value.symbol !== 'string' || !value.symbol.trim()) return null
  if (!['Long', 'Short'].includes(value.side) || entryPrice === null || exitPrice === null || entryPrice < 0 || exitPrice < 0 || shares === null || shares <= 0) return null
  if (typeof value.createdAt !== 'string' || !Number.isFinite(new Date(value.createdAt).getTime())) return null

  const customFields = value.customFields && typeof value.customFields === 'object' && !Array.isArray(value.customFields)
    ? Object.fromEntries(Object.entries(value.customFields).filter(([, fieldValue]) => ['string', 'number', 'boolean'].includes(typeof fieldValue) && (typeof fieldValue !== 'number' || Number.isFinite(fieldValue))))
    : undefined
  const normalized = {
    ...value,
    id: value.id,
    symbol: value.symbol.trim().toUpperCase(),
    side: value.side,
    instrument: typeof value.instrument === 'string' && value.instrument ? value.instrument : 'Equity',
    status: typeof value.status === 'string' ? value.status : 'Closed',
    entryPrice,
    exitPrice,
    shares,
    notes: typeof value.notes === 'string' ? value.notes : '',
    createdAt: value.createdAt,
  }
  if (customFields) normalized.customFields = customFields
  else delete normalized.customFields
  if (Array.isArray(value.screenshotIds)) normalized.screenshotIds = [...new Set(value.screenshotIds.filter((id) => typeof id === 'string' && id.trim()))]
  else delete normalized.screenshotIds
  const multiplier = finiteNumber(value.multiplier)
  const commission = finiteNumber(value.commission)
  if (value.multiplier !== undefined && multiplier !== null && multiplier > 0) normalized.multiplier = multiplier
  else delete normalized.multiplier
  if (value.commission !== undefined && commission !== null && commission >= 0) normalized.commission = commission
  else delete normalized.commission
  const pnl = finiteNumber(value.pnl)
  if (pnl !== null) normalized.pnl = pnl
  else delete normalized.pnl
  const actualPnl = finiteNumber(value.actualPnl)
  if (value.actualPnl !== undefined && actualPnl !== null) normalized.actualPnl = actualPnl
  else delete normalized.actualPnl
  const symbolMetadata = normalizeSymbolRecord(value.symbolMetadata)
  if (symbolMetadata) normalized.symbolMetadata = symbolMetadata
  else delete normalized.symbolMetadata
  return normalized
}

export function getStoredTrades() {
  const storage = getStorage()

  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeTrade).filter(Boolean) : []
  } catch {
    return []
  }
}

export function saveStoredTrades(trades) {
  const storage = getStorage()

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(trades))
    return true
  } catch {
    return false
  }
}

export function getStoredScreenshots() {
  const storage = getStorage()

  try {
    const raw = storage.getItem(SCREENSHOT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredScreenshots(screenshots) {
  const storage = getStorage()

  try {
    storage.setItem(SCREENSHOT_KEY, JSON.stringify(screenshots))
    return true
  } catch {
    return false
  }
}

export function getStoredEnabledFields() {
  const storage = getStorage()

  try {
    const raw = storage.getItem(FIELDS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((field) => typeof field === 'string') : null
  } catch {
    return null
  }
}

export function saveStoredEnabledFields(fields) {
  const storage = getStorage()

  try {
    storage.setItem(FIELDS_KEY, JSON.stringify(fields))
    return true
  } catch {
    return false
  }
}

export function getStoredSymbolFavorites() {
  const storage = getStorage()

  try {
    const raw = storage.getItem(FAVORITES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? [...new Set(parsed.filter((value) => typeof value === 'string'))] : []
  } catch {
    return []
  }
}

export function saveStoredSymbolFavorites(favorites) {
  const storage = getStorage()

  try {
    storage.setItem(FAVORITES_KEY, JSON.stringify([...new Set(favorites.filter((value) => typeof value === 'string'))]))
    return true
  } catch {
    return false
  }
}

export function getStoredCustomSymbols() {
  const storage = getStorage()

  try {
    const raw = storage.getItem(CUSTOM_SYMBOLS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const normalized = parsed.map(normalizeCustomSymbol).filter(Boolean)
    return [...new Map(normalized.map((item) => [getSymbolIdentity(item), item])).values()]
  } catch {
    return []
  }
}

export function saveStoredCustomSymbols(symbols) {
  const storage = getStorage()

  try {
    const normalized = symbols.map(normalizeCustomSymbol).filter(Boolean)
    const unique = [...new Map(normalized.map((item) => [getSymbolIdentity(item), item])).values()]
    storage.setItem(CUSTOM_SYMBOLS_KEY, JSON.stringify(unique))
    return true
  } catch {
    return false
  }
}

export function getStoredNoTradeReasons() {
  const storage = getStorage()

  try {
    const raw = storage.getItem(NO_TRADE_REASONS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).flatMap(([date, reason]) => {
      const trimmed = typeof reason === 'string' ? reason.trim().slice(0, 500) : ''
      return /^\d{4}-\d{2}-\d{2}$/.test(date) && trimmed ? [[date, trimmed]] : []
    }))
  } catch {
    return {}
  }
}

export function saveStoredNoTradeReasons(reasons) {
  const storage = getStorage()

  try {
    const normalized = Object.fromEntries(Object.entries(reasons).flatMap(([date, reason]) => {
      const trimmed = typeof reason === 'string' ? reason.trim().slice(0, 500) : ''
      return /^\d{4}-\d{2}-\d{2}$/.test(date) && trimmed ? [[date, trimmed]] : []
    }))
    storage.setItem(NO_TRADE_REASONS_KEY, JSON.stringify(normalized))
    return true
  } catch {
    return false
  }
}
