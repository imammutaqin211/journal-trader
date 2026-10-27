import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './App.css'
import './reference.css'
import { getStoredCustomSymbols, getStoredEnabledFields, getStoredNoTradeReasons, getStoredScreenshots, getStoredSymbolFavorites, getStoredTrades, saveStoredCustomSymbols, saveStoredEnabledFields, saveStoredNoTradeReasons, saveStoredScreenshots, saveStoredSymbolFavorites, saveStoredTrades } from './tradeStorage.js'
import { createJournalBackup, restoreJournalBackup } from './journalBackup.js'
import { DEFAULT_TRADING_ACCOUNT, combineAccountEquityCurves, getAccountEquity, getAccountEquityCurve, getStoredAppSettings, saveStoredAppSettings, type AppSettings, type CashMovement, type TradingAccountSettings } from './appSettings.js'
import { createTradeId, getEquityCurve, getPerformanceBy, getRealizedTrades, getTradeDate, getTradeMultiplier, getTradeNetPnl, getTradeRiskReward, getTradeStats, getTradeTime, groupRealizedPnl, type TradeRecord } from './tradeMetrics.js'
import { findSymbol, getBuiltInSymbols, getSymbolIdentity, type SymbolRecord } from './symbolCatalog.js'
import SymbolSelector from './SymbolSelector'

type View = 'dashboard' | 'calendar' | 'trade-logging' | 'daily-journal' | 'analytics' | 'settings'
type AnalyticsTab = 'performance' | 'edge' | 'behavior' | 'progress'
type TradeScreenshot = { id: string; name: string; src: string }
const DEFAULT_ENABLED_FIELDS = ['Exit date & time', 'Stop loss', 'Take profit', 'Risk / reward', 'Strategy', 'Trade notes']
const STANDARD_TRADE_FIELDS = ['Exit date & time', 'Stop loss', 'Take profit', 'Risk / reward', 'Strategy', 'Execution fees', 'Market context', 'Trade notes', 'Trade tags', 'Emotional audit']
const LIBRARY_TRADE_FIELDS = ['Commission', 'Confidence After Trade', 'Confidence Before Trade', 'Confluence Count', 'Entry Quality', 'Entry Trigger', 'Exit Quality', 'Exit Reason', 'Followed Plan', 'Lesson Learned', 'Liquidity', 'MAE', 'MFE', 'Market Regime', 'Mistake Type', 'News Event', 'Planned R-Multiple', 'Position Size', 'R-Multiple', 'Risk Amount', 'Risk Percent', 'Rule Violated', 'Screenshot Notes', 'Session', 'Setup Grade', 'Slippage', 'Swap', 'Time in Trade', 'Timeframe', 'Volatility']
const CUSTOM_TRADE_FIELDS = ['Execution fees', 'Market context', 'Trade tags', 'Emotional audit', ...LIBRARY_TRADE_FIELDS]
const BUILT_IN_SYMBOLS = getBuiltInSymbols()

function getFieldKind(field: string): 'number' | 'boolean' | 'select' | 'text' {
  if (['Followed Plan', 'News Event'].includes(field)) return 'boolean'
  if (['Confidence After Trade', 'Confidence Before Trade', 'Entry Quality', 'Exit Quality', 'Exit Reason', 'Liquidity', 'Market Regime', 'Mistake Type', 'Session', 'Setup Grade', 'Timeframe', 'Volatility', 'Emotional audit'].includes(field)) return 'select'
  if (['Entry Trigger', 'Lesson Learned', 'Rule Violated', 'Market context', 'Trade tags'].includes(field)) return 'text'
  return 'number'
}

function getFieldOptions(field: string): string[] {
  if (field.includes('Confidence')) return ['1', '2', '3', '4', '5']
  if (['Entry Quality', 'Exit Quality', 'Setup Grade'].includes(field)) return ['A', 'B', 'C', 'D', 'F']
  if (field === 'Exit Reason') return ['Take profit', 'Stop loss', 'Manual close']
  if (field === 'Liquidity') return ['High', 'Medium', 'Low']
  if (field === 'Market Regime') return ['Trending', 'Ranging', 'Volatile']
  if (field === 'Mistake Type') return ['None', 'FOMO', 'Revenge trading', 'Early exit', 'Late entry']
  if (field === 'Session') return ['Pre-market', 'Market open', 'Mid-day', 'After-hours']
  if (field === 'Timeframe') return ['1m', '5m', '15m', '1h', '4h', 'Daily']
  if (field === 'Volatility') return ['Low', 'Medium', 'High']
  return ['Calm', 'Focused', 'Anxious', 'Overconfident']
}

function DateTime24Input({ value, onChange }: { value?: string; onChange: (value: string | undefined) => void }) {
  const [date, setDate] = useState(value?.slice(0, 10) ?? '')
  const [time, setTime] = useState(value?.slice(11, 16) ?? '')

  const updateDateTime = (nextDate: string, nextTime: string) => {
    const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(nextTime)
    const nextValue = nextDate ? (validTime ? `${nextDate}T${nextTime}` : nextTime ? undefined : nextDate) : undefined
    onChange(nextValue)
  }

  const handleTimeBlur = () => {
    if (!time) return
    const digits = time.replace(/\D/g, '')
    const normalized = digits.length === 3 ? `0${digits[0]}:${digits.slice(1)}` : digits.length === 4 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : time
    if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
      setTime(normalized)
      updateDateTime(date, normalized)
    } else {
      setTime('')
      updateDateTime(date, '')
    }
  }

  return <div className="datetime-24-input">
    <input aria-label="Exit date" type="date" value={date} onChange={(event) => { setDate(event.target.value); updateDateTime(event.target.value, time) }} />
    <input aria-label="Exit time (24-hour)" type="text" inputMode="numeric" placeholder="HH:MM" maxLength={5} pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" title="Enter time in 24-hour format, for example 18:45" value={time} onChange={(event) => { setTime(event.target.value); updateDateTime(date, event.target.value) }} onBlur={handleTimeBlur} />
  </div>
}

type MenuItem = {
  id: View
  label: string
  hasChevron?: boolean
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', hasChevron: true },
  { id: 'trade-logging', label: 'Trade Logging' },
  { id: 'daily-journal', label: 'Daily Journal' },
  { id: 'analytics', label: 'Analytics', hasChevron: true },
]

const pages = {
  dashboard: 'Dashboard',
  calendar: 'Trading Calendar',
  'trade-logging': 'Trade Logging',
  'daily-journal': 'Daily Journal',
  analytics: 'Analytics',
  settings: 'General Settings',
} as const
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function formatCurrency(value: number, currency = 'USD'): string {
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value))
  if (value === 0 || Object.is(value, -0)) return formatted
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatted}`
}

function ResultAmount({ value, currency = 'USD', className = '' }: { value: number; currency?: string; className?: string }) {
  return <span className={`${value < 0 ? 'negative' : ''} ${className}`.trim()}>{formatCurrency(value, currency)}</span>
}

function formatRiskReward(trade: Pick<TradeRecord, 'entryPrice' | 'exitPrice'> & Partial<Pick<TradeRecord, 'stopLoss'>>): string {
  const multiple = getTradeRiskReward(trade)
  return multiple === null ? 'Set stop loss to calculate R:R' : `1:${multiple.toFixed(2)}`
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function offsetDateKey(date: Date, offset: number): string {
  const shifted = new Date(date)
  shifted.setDate(shifted.getDate() + offset)
  return localDateKey(shifted)
}

function daysInMonth(year: number, monthIndex: number): number {
  if (monthIndex === 1) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  return [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][monthIndex]
}

function formatExitDateTime(value: string, settings: AppSettings['account']): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: settings.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: settings.timeFormat === '12-hour',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const dateLabel = settings.dateFormat === 'YYYY-MM-DD'
    ? `${values.year}-${values.month}-${values.day}`
    : settings.dateFormat === 'DD/MM/YYYY'
      ? `${values.day}/${values.month}/${values.year}`
      : `${values.month}/${values.day}/${values.year}`
  return `${dateLabel} · ${values.hour}:${values.minute}${values.dayPeriod ? ` ${values.dayPeriod}` : ''}`
}

function formatTradeDateLabel(value: string, format: AppSettings['account']['dateFormat']): string {
  const [year, month, day] = value.split('-')
  if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`
  return format === 'DD/MM/YYYY' ? `${day}/${month}/${year}` : `${month}/${day}/${year}`
}

function formatTradeClockTime(trade: TradeRecord, settings: AppSettings['account']): string {
  const explicitExitTime = trade.exitDateTime?.match(/T(\d{2}:\d{2})(Z|[+-]\d{2}:?\d{2})?$/)
  const utcTimestamp = !trade.exitDateTime && trade.createdAt ? new Date(trade.createdAt) : null
  if (!explicitExitTime && utcTimestamp && Number.isFinite(utcTimestamp.getTime())) {
    return new Intl.DateTimeFormat('en-US', { timeZone: settings.timezone, hour: 'numeric', minute: '2-digit', hour12: settings.timeFormat === '12-hour' }).format(utcTimestamp)
  }
  const rawTime = explicitExitTime?.[1] ?? trade.time ?? getTradeTime(trade)
  if (!rawTime) return '—'
  const date = new Date(`2000-01-01T${rawTime}:00Z`)
  if (!Number.isFinite(date.getTime())) return rawTime
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: settings.timeFormat === '12-hour' }).format(date)
}

function CalendarDayCell({ day, dateKey, muted, weekend, info, reason, compact, currency, onOpenJournal, onAddTrade, onEditReason }: { day: number; dateKey: string; muted: boolean; weekend: boolean; info?: { pnl: number; count: number }; reason?: string; compact?: boolean; currency: string; onOpenJournal: () => void; onAddTrade: () => void; onEditReason: () => void }) {
  if (muted) return <div className="calendar-day-cell outside" aria-hidden="true" />

  return <div className={`calendar-day-cell ${weekend ? 'weekend' : ''} ${info ? 'has-trade' : ''} ${compact ? 'dashboard-calendar-cell' : ''}`}>
    <button className="calendar-day-open" type="button" aria-label={`Open journal for ${dateKey}`} onClick={onOpenJournal}><span>{day}</span>{info && <span className="calendar-day-pnl"><ResultAmount value={info.pnl} currency={currency} /></span>}</button>
    {info && <span className="calendar-day-trades">{info.count} TRADES</span>}
    {weekend && !info?.count && !reason && <span className="calendar-weekend-label">WEEKEND · NO TRADES</span>}
    {reason && <span className="calendar-day-no-trade-reason" title={reason}>{reason}</span>}
    <div className="calendar-day-actions">
      {(!info?.count || reason) && <button type="button" className={`calendar-day-action ${reason ? 'has-reason' : ''}`} aria-label={`${reason ? 'Edit' : 'Add'} no-trading reason for ${dateKey}`} title={reason || 'Add no-trading reason'} onClick={onEditReason}><Icon name="moon" /></button>}
      <button type="button" className="calendar-day-action add-trade" aria-label={`Add trade for ${dateKey}`} title="Add trade on this date" onClick={onAddTrade}><Icon name="plus" /></button>
    </div>
  </div>
}

function NoTradeReasonDialog({ date, dateFormat, initialReason, onSave, onClose }: { date: string; dateFormat: AppSettings['account']['dateFormat']; initialReason: string; onSave: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState(initialReason)
  const [error, setError] = useState('')
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reason.trim()) {
      setError('Write a reason or remove this note.')
      return
    }
    onSave(reason.trim())
  }

  return <div className="settings-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
    <form className="settings-dialog no-trade-reason-dialog" role="dialog" aria-modal="true" aria-labelledby="no-trade-reason-title" onSubmit={submit}>
      <header><h2 id="no-trade-reason-title">No trade · {formatTradeDateLabel(date, dateFormat)}</h2><button type="button" aria-label="Close" onClick={onClose}>×</button></header>
      <label><span>Why did you not trade?</span><textarea autoFocus value={reason} maxLength={500} onChange={(event) => { setReason(event.target.value); setError('') }} placeholder="e.g. No clear setup, stayed out of high-impact news" /></label>
      {error && <p role="alert">{error}</p>}
      <footer>{initialReason && <button type="button" className="settings-cancel-button" onClick={() => onSave('')}>Remove reason</button>}<button type="button" className="settings-cancel-button" onClick={onClose}>Cancel</button><button type="submit">Save reason</button></footer>
    </form>
  </div>
}

function getInstrumentForSymbol(symbol: SymbolRecord): string {
  if (symbol.marketType === 'futures') return 'Futures'
  if (symbol.category === 'Forex') return 'Forex'
  if (symbol.category === 'Crypto') return 'Crypto'
  if (symbol.marketType === 'equity') return 'Equity'
  return symbol.category === 'Futures' ? 'Futures' : 'Equity'
}

function getTradeSymbolRecord(trade: TradeRecord, catalog: SymbolRecord[]): SymbolRecord {
  if (trade.symbolMetadata) return trade.symbolMetadata
  const resolved = findSymbol(trade.symbol, trade.instrument, catalog)
  if (resolved) return resolved
  const category = trade.instrument === 'Futures' ? 'Futures' : trade.instrument === 'Forex' ? 'Forex' : trade.instrument === 'Crypto' ? 'Crypto' : 'Stocks'
  return { symbol: trade.symbol, name: null, category, subcategory: null, exchange: null, marketType: trade.instrument === 'Futures' ? 'futures' : trade.instrument === 'Forex' ? 'spot' : trade.instrument === 'Crypto' ? 'spot' : 'equity', baseCurrency: null, quoteCurrency: null, tickSize: null, tickValue: null, contractMultiplier: trade.multiplier ?? null, isFavorite: false, isCustom: true }
}

function getTradeAccountName(trade: TradeRecord): string {
  if (trade.account === 'Live Account' || trade.account === 'Demo Account') return 'Imported'
  return trade.account?.trim() || 'Imported'
}

function getLegacyTradingAccountSettings(settings: AppSettings): Omit<TradingAccountSettings, 'id' | 'name'> {
  return {
    balance: settings.account.balance,
    balanceType: settings.account.balanceType,
    balanceAsOf: settings.account.balanceAsOf,
    cashMovements: settings.account.cashMovements,
    weeklyTarget: settings.account.weeklyTarget,
    monthlyTarget: settings.account.monthlyTarget,
    targetWinRate: settings.account.targetWinRate,
    maxDrawdown: settings.account.maxDrawdown,
    targetRiskReward: settings.account.targetRiskReward,
  }
}

function chartCoordinates(values: number[], xStart: number, xEnd: number, yStart: number, yEnd: number): { x: number; y: number }[] {
  if (!values.length) return []
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = max - min || 1
  return values.map((value, index) => {
    const x = values.length === 1 ? (xStart + xEnd) / 2 : xStart + (index / (values.length - 1)) * (xEnd - xStart)
    const y = yEnd - ((value - min) / range) * (yEnd - yStart)
    return { x, y }
  })
}

function chartPoints(values: number[], xStart: number, xEnd: number, yStart: number, yEnd: number): string {
  return chartCoordinates(values, xStart, xEnd, yStart, yEnd).map(({ x, y }) => `${x},${y}`).join(' ')
}

function formatAxisCurrency(value: number, currency = 'USD'): string {
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Math.abs(value))
  return `${value < 0 ? '-' : ''}${formatted}`
}

function getInitialView(): View {
  const hash = window.location.hash.replace('#', '') as View
  if (hash in pages) return hash
  return 'dashboard'
}

function Icon({ name }: { name: 'dashboard' | 'journal' | 'chart' | 'spark' | 'bell' | 'moon' | 'sun' | 'settings' | 'plus' | 'filter' | 'chevron' | 'grid' | 'user' | 'check' | 'trend' | 'calendar' | 'arrowRight' | 'flash' | 'doc' | 'support' | 'link' | 'search' | 'download' }) {
  const icons: Record<string, ReactNode> = {
    dashboard: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zm9 0h7v4h-7zm0 6h7v10h-7zM4 13h7v7H4z"/></svg>
    ),
    journal: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5A2.5 2.5 0 0 1 8.5 1h9A2.5 2.5 0 0 1 20 3.5v15.75A2.75 2.75 0 0 1 17.25 22H8.5A2.5 2.5 0 0 1 6 19.5zm2.5-1.5a.5.5 0 0 0-.5.5v15.5A1.5 1.5 0 0 0 9.5 19h7.75a.75.75 0 0 0 .75-.75V3.5a.5.5 0 0 0-.5-.5zM9 7h7M9 11h7M9 15h4"/></svg>
    ),
    chart: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18.5h16M7 14l3-3 3 2 5-7"/><path d="M4 18.5V6.5"/></svg>
    ),
    spark: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l1.8 5.7L19.5 10l-5.7 1.8L12 17.5l-1.8-5.7L4.5 10l5.7-1.8z"/></svg>
    ),
    bell: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0"/></svg>
    ),
    moon: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A7.5 7.5 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>
    ),
    sun: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>
    ),
    settings: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1l2.1-2.1M17 7l2.1-2.1M12 8.5A3.5 3.5 0 1 1 12 15.5A3.5 3.5 0 0 1 12 8.5Z"/></svg>
    ),
    plus: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
    ),
    filter: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
    ),
    chevron: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10l4 4 4-4"/></svg>
    ),
    arrowRight: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
    ),
    grid: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zm9 0h7v4h-7zm0 6h7v10h-7zM4 13h7v7H4z"/></svg>
    ),
    user: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.8-3.5 5-5 8-5s6.2 1.5 8 5"/></svg>
    ),
    check: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg>
    ),
    trend: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16l5-5 4 4 7-9"/><path d="M16 6h4v4"/></svg>
    ),
    calendar: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
    ),
    flash: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z"/></svg>
    ),
    doc: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8l4 4v13H6V5a2 2 0 0 1 2-2Z"/><path d="M16 3v5h4M9 13h6M9 17h6"/></svg>
    ),
    support: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.4 1.6c-1.1 1-1.9 1.3-1.9 2.9M12 17h.01"/></svg>
    ),
    link: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"/></svg>
    ),
    search: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
    ),
    download: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v4h16v-4"/></svg>
    ),
  }

  return icons[name]
}

function DashboardView({ onNavigate, onAddTradeForDate, onEditNoTradeReason, noTradeReasons, trades, settings, accounts, accountSettings, selectedAccount, onSelectAccount }: { onNavigate: (view: View) => void; onAddTradeForDate: (date: string) => void; onEditNoTradeReason: (date: string) => void; noTradeReasons: Record<string, string>; trades: TradeRecord[]; settings: AppSettings; accounts: string[]; accountSettings: TradingAccountSettings[]; selectedAccount: string; onSelectAccount: (account: string) => void }) {
  const [filterOpen, setFilterOpen] = useState(false)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [dateRange, setDateRange] = useState('Last 30 Days')
  const [resultFilter, setResultFilter] = useState('All trades')
  const [today] = useState(() => new Date())
  const [dashboardMonth, setDashboardMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [hiddenMetrics, setHiddenMetrics] = useState<string[]>([])
  const todayKey = localDateKey(today)
  const rangeStart = dateRange === 'Year to Date'
    ? `${today.getFullYear()}-01-01`
    : dateRange === 'All Time'
      ? null
      : offsetDateKey(today, -(dateRange === 'Last 7 Days' ? 6 : dateRange === 'Last 90 Days' ? 89 : 29))
  const realizedRows = getRealizedTrades(trades)
  const filteredRows = realizedRows.filter(({ trade, pnl, date }) =>
    (selectedAccount === 'All Accounts' || getTradeAccountName(trade) === selectedAccount)
    && (!rangeStart || date >= rangeStart)
    && (resultFilter === 'All trades' || (resultFilter === 'Winning trades' ? pnl > 0.005 : resultFilter === 'Losing trades' ? pnl < -0.005 : Math.abs(pnl) <= 0.005)),
  )
  const rangeTrades = filteredRows.map((row) => row.trade)
  const stats = getTradeStats(rangeTrades)
  const totalPnL = stats.totalPnl
  const selectedAccountSettings = accountSettings.filter((item) => selectedAccount === 'All Accounts' || item.name === selectedAccount)
  const accountEquity = selectedAccountSettings.reduce((sum, item) => sum + getAccountEquity(trades.filter((trade) => getTradeAccountName(trade) === item.name), item), 0)
  const selectedAccountStarting = selectedAccountSettings.some((item) => item.balanceType === 'starting')
  const currentWeekStart = new Date(today)
  currentWeekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const currentWeekKey = localDateKey(currentWeekStart)
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const goalRows = [
    { label: 'Weekly target', value: realizedRows.filter((row) => row.date >= currentWeekKey && (selectedAccount === 'All Accounts' || getTradeAccountName(row.trade) === selectedAccount)).reduce((sum, row) => sum + row.pnl, 0), target: selectedAccountSettings.reduce((sum, item) => sum + item.weeklyTarget, 0) },
    { label: 'Monthly target', value: realizedRows.filter((row) => row.date.startsWith(currentMonthKey) && (selectedAccount === 'All Accounts' || getTradeAccountName(row.trade) === selectedAccount)).reduce((sum, row) => sum + row.pnl, 0), target: selectedAccountSettings.reduce((sum, item) => sum + item.monthlyTarget, 0) },
  ].filter((item) => item.target > 0)
  const todayRows = realizedRows.filter(({ trade, pnl, date }) => date === todayKey
    && (selectedAccount === 'All Accounts' || getTradeAccountName(trade) === selectedAccount)
    && (resultFilter === 'All trades' || (resultFilter === 'Winning trades' ? pnl > 0.005 : resultFilter === 'Losing trades' ? pnl < -0.005 : Math.abs(pnl) <= 0.005)))
  const todayStats = getTradeStats(todayRows.map((row) => row.trade))
  const pnlCurve = getEquityCurve(rangeTrades)
  const accountCurveTrades = realizedRows.filter(({ trade, pnl }) =>
    (selectedAccount === 'All Accounts' || getTradeAccountName(trade) === selectedAccount)
    && (resultFilter === 'All trades' || (resultFilter === 'Winning trades' ? pnl > 0.005 : resultFilter === 'Losing trades' ? pnl < -0.005 : Math.abs(pnl) <= 0.005)),
  ).map((row) => row.trade)
  const accountCurve = combineAccountEquityCurves(selectedAccountSettings.map((account) => getAccountEquityCurve(accountCurveTrades.filter((trade) => getTradeAccountName(trade) === account.name), account)))
  const visibleCurve = accountCurve.length ? accountCurve : pnlCurve
  const rangeCurve = accountCurve.length && rangeStart ? visibleCurve.filter((row) => row.date >= rangeStart) : visibleCurve
  const priorCurve = accountCurve.length && rangeStart ? visibleCurve.filter((row) => row.date < rangeStart) : []
  const chartRows = [...(priorCurve.length ? [priorCurve[priorCurve.length - 1]] : []), ...rangeCurve].slice(-12)
  const chartValues = chartRows.map((row) => row.equity)
  const chartMin = Math.min(0, ...chartValues)
  const chartMax = Math.max(0, ...chartValues)
  const chartRange = chartMax - chartMin || 1
  const zeroLineY = 240 - ((0 - chartMin) / chartRange) * 192
  const metrics = [
    { label: 'Net P&L', value: formatCurrency(totalPnL, settings.account.baseCurrency), detail: `${stats.validCount} valid closed trades`, icon: 'trend', color: 'text-emerald-500' },
    { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, detail: `${stats.wins} wins · ${stats.losses} losses · ${stats.breakeven} BE${selectedAccountSettings.reduce((sum, item) => sum + item.targetWinRate, 0) ? ` · target ${selectedAccountSettings.reduce((sum, item) => sum + item.targetWinRate, 0)}%` : ''}`, icon: 'chart', color: 'text-blue-500' },
    { label: 'Profit Factor', value: Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞', detail: `${formatCurrency(stats.grossProfit, settings.account.baseCurrency)} gross profit`, icon: 'flash', color: 'text-amber-400' },
    { label: 'Account Equity', value: formatCurrency(accountEquity, settings.account.baseCurrency), detail: selectedAccountStarting ? 'Selected account balances + P&L + cash flow' : 'Selected account balances + changes since baseline', icon: 'grid', color: 'text-purple-400' },
    { label: 'Risk : Reward', value: stats.averageLoss > 0 ? `${(stats.averageWin / stats.averageLoss).toFixed(2)}:1` : 'N/A', detail: selectedAccountSettings.reduce((sum, item) => sum + item.targetRiskReward, 0) ? `Average win / average loss · target 1:${selectedAccountSettings.reduce((sum, item) => sum + item.targetRiskReward, 0)}` : 'Average win / average loss', icon: 'trend', color: 'text-rose-500' },
  ] as const

  const calendarYear = dashboardMonth.getFullYear()
  const calendarMonthIndex = dashboardMonth.getMonth()
  const calendarFirstWeekday = dashboardMonth.getDay()
  const calendarDaysInMonth = daysInMonth(calendarYear, calendarMonthIndex)
  const previousMonthDays = daysInMonth(calendarMonthIndex === 0 ? calendarYear - 1 : calendarYear, (calendarMonthIndex + 11) % 12)
  const calendarWeeks = Math.ceil((calendarFirstWeekday + calendarDaysInMonth) / 7)
  const calendarMonthRows = realizedRows.filter((row) => row.date.startsWith(`${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, '0')}`) && (selectedAccount === 'All Accounts' || getTradeAccountName(row.trade) === selectedAccount))
  const calendarDayTotals = new Map(calendarMonthRows.map((row) => [Number(row.date.slice(8, 10)), { pnl: 0, count: 0 }]))
  calendarMonthRows.forEach((row) => {
    const day = Number(row.date.slice(8, 10))
    const total = calendarDayTotals.get(day) ?? { pnl: 0, count: 0 }
    total.pnl += row.pnl
    total.count += 1
    calendarDayTotals.set(day, total)
  })
  const calendarWeekTotals = Array.from({ length: calendarWeeks }, (_, weekIndex) => calendarMonthRows.filter((row) => Math.floor((Number(row.date.slice(8, 10)) + calendarFirstWeekday - 1) / 7) === weekIndex).reduce((sum, row) => sum + row.pnl, 0))
  const calendarDays = Array.from({ length: calendarWeeks * 7 }, (_, index) => {
    const dayNumber = index - calendarFirstWeekday + 1
    const inMonth = dayNumber > 0 && dayNumber <= calendarDaysInMonth
    const displayedDay = dayNumber < 1 ? previousMonthDays + dayNumber : dayNumber > calendarDaysInMonth ? dayNumber - calendarDaysInMonth : dayNumber
    return { day: displayedDay, dateKey: localDateKey(new Date(calendarYear, calendarMonthIndex, dayNumber)), muted: !inMonth, weekIndex: Math.floor(index / 7), info: inMonth ? calendarDayTotals.get(dayNumber) : undefined }
  })
  const winDegrees = stats.validCount ? (stats.wins / stats.validCount) * 360 : 0

  return (
    <>
      <main className="mx-auto w-full max-w-[1600px] px-2.5 pt-3 pb-4 md:px-6 md:pt-4 md:pb-8">
        <div className="mb-8 hidden items-center justify-between gap-6 md:flex md:flex-row">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 text-muted-foreground">
              <Icon name="calendar" />
              <span className="text-sm font-medium">{today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
          <div className="dashboard-daily-summary m-0 flex items-center justify-start gap-6">
            <div className="min-w-[90px] text-center">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Today&apos;s P&amp;L</div>
              <div className={`text-2xl font-bold ${todayStats.totalPnl < 0 ? 'negative' : 'text-emerald-500'}`}><ResultAmount value={todayStats.totalPnl} currency={settings.account.baseCurrency} /></div>
            </div>
            <div className="min-w-[70px] text-center">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Trades</div>
              <div className="text-2xl font-bold">{todayStats.validCount}</div>
            </div>
            <div className="min-w-[70px] text-center">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Wins</div>
              <div className="text-2xl font-bold text-emerald-500">{todayStats.wins}</div>
            </div>
          </div>
        </div>

        <div className="dashboard-controls mb-4 flex flex-col justify-between gap-3 md:mb-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <span className="hidden max-w-[240px] text-sm text-muted-foreground md:inline-block">Overview of your trading performance</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen(!filterOpen)} className="inline-flex h-9 items-center gap-2 rounded-md border border-border/60 bg-card/40 px-3 text-sm"><Icon name="filter" /> Filter</button>
            <button type="button" onClick={() => setTourOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-md border border-border/60 bg-card/40 px-3 text-sm"><Icon name="spark" /> Tour</button>
            <select aria-label="Dashboard date range" value={dateRange} onChange={(event) => setDateRange(event.target.value)} className="h-9 rounded-md border border-border/60 bg-card/40 px-3 text-sm text-foreground"><option>Last 7 Days</option><option>Last 30 Days</option><option>Last 90 Days</option><option>Year to Date</option><option>All Time</option></select>
            <button type="button" onClick={() => setCustomizeOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-md border border-border/60 bg-card/40 px-3 text-sm"><Icon name="settings" /> Customize</button>
          </div>
        </div>

        {filterOpen && <div className="dashboard-filter-panel"><label>Account<select value={selectedAccount} onChange={(event) => onSelectAccount(event.target.value)}><option>All Accounts</option>{accounts.map((name) => <option key={name}>{name}</option>)}</select></label><label>Trade result<select value={resultFilter} onChange={(event) => setResultFilter(event.target.value)}><option>All trades</option><option>Winning trades</option><option>Losing trades</option><option>Breakeven trades</option></select></label><button type="button" onClick={() => setFilterOpen(false)}>Apply</button></div>}

        <section className="dashboard-metrics mb-4 grid grid-cols-2 items-stretch gap-2 md:mb-8 md:gap-4 lg:grid-cols-5" aria-label="Trading metrics">
          {metrics.filter((metric) => !hiddenMetrics.includes(metric.label)).map((metric) => (
            <article key={metric.label} className={`dashboard-metric-card flex h-full flex-col justify-between rounded-lg border border-border/40 bg-card/40 p-2.5 shadow-sm backdrop-blur-sm md:p-4 ${metric.label === 'Account Equity' ? 'hidden md:flex' : ''}`}>
              <div className="mb-1.5 flex items-center gap-1.5 md:mb-3">
                <span className={`grid size-6 place-items-center rounded-md bg-background/80 ${metric.color}`}><Icon name={metric.icon} /></span>
                <span className="text-xs font-semibold text-muted-foreground md:text-sm">{metric.label}</span>
              </div>
              <div className="flex items-end justify-between gap-1.5">
                <div>
                  <div className={`text-lg font-bold tracking-tight md:text-xl ${metric.value.startsWith('-') ? 'negative' : metric.label === 'Net P&L' ? 'text-emerald-500' : ''}`}>{metric.value}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{metric.detail}</div>
                </div>
                {metric.label === 'Profit Factor' && <span className="flex h-9 items-end gap-0.5" aria-hidden="true">{[5, 13, 9, 22, 15, 28, 12].map((height, index) => <i key={index} className="w-1 rounded-t bg-amber-400" style={{ height }} />)}</span>}
                {metric.label === 'Account Equity' && <span className="h-px w-12 bg-purple-500" aria-hidden="true" />}
                {metric.label === 'Risk : Reward' && <span className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-500 to-rose-500" aria-hidden="true" />}
              </div>
            </article>
          ))}
        </section>

        {goalRows.length > 0 && <section className="dashboard-goals" aria-label="Profit target progress">{goalRows.map((goal) => <div className="dashboard-goal" key={goal.label}><div><strong>{goal.label}</strong><span><ResultAmount value={goal.value} currency={settings.account.baseCurrency} /> / <ResultAmount value={goal.target} currency={settings.account.baseCurrency} /></span></div><progress max={goal.target} value={Math.max(0, Math.min(goal.target, goal.value))} aria-label={`${goal.label} progress`} /></div>)}</section>}

        <section className="mb-4 grid grid-cols-1 gap-4 md:mb-8 lg:grid-cols-3" aria-label="Performance charts">
          <article className="flex h-full flex-col rounded-lg border border-border/40 bg-card/40 shadow-sm backdrop-blur-sm lg:col-span-2">
            <div className="flex flex-col space-y-1.5 p-4 pb-2 md:p-6 md:pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 md:gap-2.5">
                  <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-blue-500"><Icon name="chart" /></span>
                  <h2 className="line-clamp-1 text-base font-semibold tracking-tight text-foreground md:text-lg">{accountCurve.length ? 'Account Equity' : 'Cumulative Realized P&L'}</h2>
                </div>
              </div>
            </div>
            <div className="min-h-[300px] flex-1 px-4 pb-4 md:px-6">
              <svg viewBox="0 0 760 300" className="h-full min-h-[300px] w-full" role="img" aria-label={accountCurve.length ? 'Account equity over time' : 'Cumulative realized P&L over time'}>
                {[48, 96, 144, 192, 240].map((y) => <line key={y} x1="56" x2="724" y1={y} y2={y} stroke="rgba(161,161,170,.12)" strokeDasharray="3 4" />)}
                {Array.from({ length: 5 }, (_, index) => { const value = chartMax - (index * chartRange) / 4; return <text key={index} x="10" y={52 + index * 48} fill="#71717a" fontSize="9">{formatAxisCurrency(value, settings.account.baseCurrency)}</text> })}
                <line x1="56" x2="724" y1={zeroLineY} y2={zeroLineY} stroke="#71717a" strokeDasharray="3 4" />
                {chartRows.map((row, index) => <text key={`${row.date}-${index}`} x={chartRows.length === 1 ? 390 : 56 + (index / (chartRows.length - 1)) * 668} y="274" textAnchor="middle" fill="#71717a" fontSize="8">{row.date.slice(5)}</text>)}
                {chartValues.length > 0 ? <><polyline points={chartPoints(chartValues, 56, 724, 48, 240)} fill="none" stroke={chartValues[chartValues.length - 1] < 0 ? '#ef4444' : '#10b981'} strokeWidth="2" />{chartCoordinates(chartValues, 56, 724, 48, 240).map((point, index) => <circle key={`${chartRows[index].date}-${index}`} cx={point.x} cy={point.y} r="3" fill={chartValues[chartValues.length - 1] < 0 ? '#ef4444' : '#10b981'} />)}</> : <text x="390" y="150" textAnchor="middle" fill="#a1a1aa" fontSize="12">No closed trades in this range</text>}
              </svg>
              <div className="mt-1 flex justify-center gap-5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2"><i className="h-0.5 w-3 bg-emerald-500" /> {accountCurve.length ? 'Equity after P&L and cash movements' : 'Cumulative net P&L'}</span>
              </div>
            </div>
          </article>

          <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border/40 bg-card/40 shadow-sm backdrop-blur-sm">
            <div className="flex shrink-0 flex-col space-y-1.5 p-4 pb-2 md:p-6 md:pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-md bg-primary/10 text-blue-500"><Icon name="chart" /></span><h2 className="font-sans text-base font-semibold tracking-tight text-foreground md:text-lg">Performance Breakdown</h2></div>
              </div>
            </div>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {[
                  ['Biggest Win', stats.biggestWin ? formatCurrency(stats.biggestWin, settings.account.baseCurrency) : formatCurrency(0, settings.account.baseCurrency), 'text-emerald-500'],
                  ['Biggest Loss', stats.biggestLoss ? formatCurrency(stats.biggestLoss, settings.account.baseCurrency) : formatCurrency(0, settings.account.baseCurrency), 'text-rose-400'],
                  ['Average Win', stats.averageWin ? formatCurrency(stats.averageWin, settings.account.baseCurrency) : formatCurrency(0, settings.account.baseCurrency), 'text-emerald-500'],
                  ['Average Loss', stats.averageLoss ? formatCurrency(-stats.averageLoss, settings.account.baseCurrency) : formatCurrency(0, settings.account.baseCurrency), 'text-rose-400'],
                  ['Max Drawdown', stats.maxDrawdown ? formatCurrency(-stats.maxDrawdown, settings.account.baseCurrency) : formatCurrency(0, settings.account.baseCurrency), 'text-rose-400'],
                  ['Calmar Ratio', 'N/A', 'text-foreground'],
                  ['Commissions', stats.commissions ? formatCurrency(-stats.commissions, settings.account.baseCurrency) : formatCurrency(0, settings.account.baseCurrency), 'text-muted-foreground'],
                ].map(([label, value, color]) => <tr key={label} className="border-b border-border/10 last:border-0"><td className="px-4 py-3 text-sm font-medium text-muted-foreground md:px-4">{label}</td><td className={`px-4 py-3 text-right font-mono text-sm font-semibold ${value.startsWith('-') ? 'negative' : color}`}>{value}</td></tr>)}
              </tbody>
            </table>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Calendar and performance">
          <article className="flex flex-col rounded-lg border border-border/40 bg-card/40 shadow-sm backdrop-blur-sm lg:col-span-2">
            <div className="flex items-center justify-center gap-2 border-b border-border/10 p-3">
              <button type="button" className="grid size-8 place-items-center rounded-md hover:bg-accent" aria-label="Previous month" onClick={() => setDashboardMonth(new Date(calendarYear, calendarMonthIndex - 1, 1))}>‹</button>
              <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border/50 px-3 text-sm">{dashboardMonth.toLocaleString('en-US', { month: 'long' })}</span>
              <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border/50 px-3 text-sm">{calendarYear}</span>
              <button type="button" className="grid size-8 place-items-center rounded-md hover:bg-accent" aria-label="Next month" onClick={() => setDashboardMonth(new Date(calendarYear, calendarMonthIndex + 1, 1))}>›</button>
            </div>
            <div className="grid grid-cols-8 border-b border-border/10 text-center text-[10px] font-medium text-muted-foreground">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S', 'WEEK'].map((day, index) => <span key={`${day}-${index}`} className="py-2">{day}</span>)}
            </div>
            <div className="grid grid-cols-8 text-center">
              {calendarDays.map(({ day, dateKey, muted, info }, index) => <CalendarDayCell key={`${dateKey}-${index}`} day={day} dateKey={dateKey} muted={muted} weekend={index % 7 === 0 || index % 7 === 6} info={info} reason={noTradeReasons[dateKey]} compact currency={settings.account.baseCurrency} onOpenJournal={() => { if (info?.count) onNavigate('daily-journal') }} onAddTrade={() => onAddTradeForDate(dateKey)} onEditReason={() => onEditNoTradeReason(dateKey)} />).flatMap((cell, index) => index % 7 === 6 ? [cell, <div key={`dashboard-week-${index}`} className="calendar-week-total"><span>Week {Math.floor(index / 7) + 1}</span>{calendarWeekTotals[Math.floor(index / 7)] ? <strong><ResultAmount value={calendarWeekTotals[Math.floor(index / 7)]} currency={settings.account.baseCurrency} /></strong> : <strong>—</strong>}</div>] : [cell])}
            </div>
          </article>
          <article className="rounded-lg border border-border/40 bg-card/40 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between p-4"><h2 className="text-base font-semibold">Performance</h2><button type="button" className="rounded border border-border/50 px-2 py-1 text-[10px] font-semibold">ALL</button></div>
            <div className="flex min-h-[240px] items-center justify-center">
              <div className="relative grid size-40 place-items-center rounded-full" style={{ background: `conic-gradient(#155dfc 0deg ${winDegrees}deg, rgba(63,63,70,.8) ${winDegrees}deg 360deg)` }}>
                <div className="absolute inset-5 grid place-content-center rounded-full bg-card text-center"><strong className="text-lg">{stats.validCount ? `${stats.winRate.toFixed(1)}%` : '—'}</strong><span className="text-xs text-muted-foreground">win rate</span></div>
              </div>
            </div>
          </article>
        </section>
        {customizeOpen && <div className="dashboard-dialog-backdrop" role="presentation" onClick={() => setCustomizeOpen(false)}><section className="dashboard-dialog" role="dialog" aria-modal="true" aria-label="Customize dashboard" onClick={(event) => event.stopPropagation()}><header><h2>Customize dashboard</h2><button type="button" aria-label="Close" onClick={() => setCustomizeOpen(false)}>×</button></header>{metrics.map((metric) => <label key={metric.label}><span>{metric.label}</span><input type="checkbox" checked={!hiddenMetrics.includes(metric.label)} onChange={() => setHiddenMetrics((previous) => previous.includes(metric.label) ? previous.filter((value) => value !== metric.label) : [...previous, metric.label])} /></label>)}</section></div>}
        {tourOpen && <div className="dashboard-dialog-backdrop" role="presentation" onClick={() => setTourOpen(false)}><section className="dashboard-dialog" role="dialog" aria-modal="true" aria-label="Dashboard tour" onClick={(event) => event.stopPropagation()}><header><h2>Dashboard tour</h2><button type="button" aria-label="Close" onClick={() => setTourOpen(false)}>×</button></header><p>Overview of your trading performance</p><button type="button" onClick={() => { setTourOpen(false); onNavigate('trade-logging') }}>Open Trade Logging</button></section></div>}
      </main>
    </>
  )
}

function TradeLoggingView({ screenshots, existingScreenshots, setScreenshots, onTradeSaved, editingTrade, onEditingComplete, onTradeLogged, initialTradeDate, enabledFields, setEnabledFields, account, accounts, customSymbols, symbolFavorites, onAddCustomSymbol, onToggleSymbolFavorite, onRemoveCustomSymbol }: { screenshots: TradeScreenshot[]; existingScreenshots: TradeScreenshot[]; setScreenshots: React.Dispatch<React.SetStateAction<TradeScreenshot[]>>; onTradeSaved: React.Dispatch<React.SetStateAction<TradeRecord[]>>; editingTrade: TradeRecord | null; onEditingComplete: () => void; onTradeLogged: () => void; initialTradeDate: string | null; enabledFields: Set<string>; setEnabledFields: React.Dispatch<React.SetStateAction<Set<string>>>; account: string; accounts: string[]; customSymbols: SymbolRecord[]; symbolFavorites: Set<string>; onAddCustomSymbol: (symbol: SymbolRecord) => string | null; onToggleSymbolFavorite: (identity: string) => void; onRemoveCustomSymbol: (identity: string) => void }) {
  const [mode, setMode] = useState('Manual')
  const [side, setSide] = useState<'Long' | 'Short'>(editingTrade?.side ?? 'Long')
  const [instrument, setInstrument] = useState(editingTrade?.instrument ?? 'Equity')
  const catalogSymbols = [...BUILT_IN_SYMBOLS, ...customSymbols]
  const [symbolMetadata, setSymbolMetadata] = useState<SymbolRecord | null>(() => editingTrade ? getTradeSymbolRecord(editingTrade, catalogSymbols) : null)
  const accountContextKey = `${editingTrade?.id ?? 'new'}:${account}:${accounts.join('|')}`
  const initialTradeAccount = editingTrade ? getTradeAccountName(editingTrade) : account === 'All Accounts' ? accounts[0] ?? '' : account
  const [accountSelection, setAccountSelection] = useState(() => ({ contextKey: accountContextKey, value: initialTradeAccount }))
  if (accountSelection.contextKey !== accountContextKey) setAccountSelection({ contextKey: accountContextKey, value: initialTradeAccount })
  const tradeAccount = accountSelection.value
  const setTradeAccount = (value: string) => setAccountSelection((previous) => ({ ...previous, value }))
  const [fieldSearch, setFieldSearch] = useState('')
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const [symbol, setSymbol] = useState(editingTrade?.symbol ?? '')
  const [attachedScreenshotIds, setAttachedScreenshotIds] = useState<string[]>(() => editingTrade?.screenshotIds?.slice(0, 1) ?? [])
  const [entryPrice, setEntryPrice] = useState(String(editingTrade?.entryPrice ?? ''))
  const [exitPrice, setExitPrice] = useState(String(editingTrade?.exitPrice ?? ''))
  const [shares, setShares] = useState(String(editingTrade?.shares ?? '1'))
  const [actualPnl, setActualPnl] = useState(String(editingTrade?.actualPnl ?? ''))
  const [stopLoss, setStopLoss] = useState(String(editingTrade?.stopLoss ?? ''))
  const [takeProfit, setTakeProfit] = useState(String(editingTrade?.takeProfit ?? ''))
  const [multiplier, setMultiplier] = useState(String(editingTrade?.multiplier ?? symbolMetadata?.contractMultiplier ?? (editingTrade ? getTradeMultiplier(editingTrade) : '') ?? ''))
  const [exitDateTime, setExitDateTime] = useState(editingTrade?.exitDateTime ?? initialTradeDate ?? '')
  const [dateTimeResetKey, setDateTimeResetKey] = useState(0)
  const [saved, setSaved] = useState(false)
  const [formError, setFormError] = useState('')
  const [notes, setNotes] = useState(editingTrade?.notes ?? '')
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number | boolean>>(editingTrade?.customFields ?? {})
  const notesInput = useRef<HTMLTextAreaElement>(null)
  const screenshotInput = useRef<HTMLInputElement>(null)
  const saveLock = useRef(false)
  const attachedScreenshots = screenshots.filter((screenshot) => attachedScreenshotIds.includes(screenshot.id)).slice(0, 1)
  const screenshotOptions = [...attachedScreenshots, ...existingScreenshots.filter((screenshot) => !attachedScreenshotIds.includes(screenshot.id))]
  const visibleLibraryFields = LIBRARY_TRADE_FIELDS.filter((field) => field.toLowerCase().includes(fieldSearch.toLowerCase()))
  const numericEntry = Number(entryPrice)
  const numericExit = Number(exitPrice)
  const numericShares = Number(shares)
  const configuredMultiplier = getTradeMultiplier({ instrument, symbol, symbolMetadata })
  const effectiveMultiplier = multiplier ? Number(multiplier) : configuredMultiplier
  const requiresMultiplier = instrument !== 'Equity' && (instrument !== 'Crypto' || symbolMetadata?.marketType === 'perpetual')
  const previewPnl = getTradeNetPnl({
    id: 'preview', symbol, side, instrument, status: 'Closed', entryPrice: numericEntry, exitPrice: numericExit,
    shares: numericShares, multiplier: effectiveMultiplier ?? undefined, symbolMetadata: symbolMetadata ?? undefined, customFields: customFieldValues,
    actualPnl: actualPnl === '' ? undefined : Number(actualPnl), createdAt: '', notes: '',
  })
  const riskReward = formatRiskReward({ entryPrice: numericEntry, exitPrice: numericExit, stopLoss: stopLoss === '' ? undefined : Number(stopLoss) })
  const pnl = !entryPrice || !exitPrice ? '—' : previewPnl === null ? 'Set multiplier' : previewPnl.toFixed(2)

  const toggleField = (field: string) => {
    setEnabledFields((previous) => {
      const next = new Set(previous)
      if (next.has(field)) {
        next.delete(field)
        if (field === 'Stop loss') next.delete('Risk / reward')
      } else {
        next.add(field)
        if (field === 'Risk / reward') next.add('Stop loss')
      }
      return next
    })
  }

  const formatNotes = (format: 'bold' | 'italic' | 'bullet' | 'numbered' | 'link') => {
    const input = notesInput.current
    if (!input) return
    const start = input.selectionStart
    const end = input.selectionEnd
    const selected = notes.slice(start, end)
    const wrappers = format === 'bold' ? ['**', '**'] : format === 'italic' ? ['*', '*'] : format === 'link' ? ['[', '](https://)'] : ['', '']
    const replacement = format === 'bullet'
      ? selected.split('\n').map((line) => `- ${line}`).join('\n')
      : format === 'numbered'
        ? selected.split('\n').map((line, index) => `${index + 1}. ${line}`).join('\n')
        : `${wrappers[0]}${selected || (format === 'link' ? 'link text' : '')}${wrappers[1]}`
    const nextNotes = `${notes.slice(0, start)}${replacement}${notes.slice(end)}`
    setNotes(nextNotes)
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(start + wrappers[0].length, start + replacement.length - wrappers[1].length)
    })
  }

  const addScreenshots = (files: FileList | null) => {
    if (!files) return
    const uploads = Array.from(files).filter((file) => file.type.startsWith('image/')).slice(0, Math.max(0, 1 - attachedScreenshotIds.length))
    const uploadIds = uploads.map(() => `screenshot-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`)
    setAttachedScreenshotIds((previous) => [...previous, ...uploadIds])
    uploads.forEach((file, index) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== 'string') return
        setScreenshots((previous) => [...previous, { id: uploadIds[index], name: file.name, src: reader.result as string }])
      }
      reader.readAsDataURL(file)
    })
  }

  const handleSymbolSelect = (selected: SymbolRecord) => {
    setSymbol(selected.symbol)
    setSymbolMetadata(selected)
    setInstrument(getInstrumentForSymbol(selected))
    setMultiplier(String(selected.contractMultiplier ?? ''))
    setFormError('')
  }

  return (
    <div className="trade-page">
      <div className="trade-mode-row">
        <div className="trade-mode-tabs" role="tablist" aria-label="Trade entry mode">
          {['Chat', 'Manual'].map((tab) => (
            <button key={tab} type="button" role="tab" aria-selected={mode === tab} className={mode === tab ? 'selected' : ''} onClick={() => setMode(tab)}>
              {tab === 'Chat' ? <Icon name="spark" /> : <Icon name="journal" />}
              {tab}
            </button>
          ))}
        </div>
        <div className="trade-header-actions"><button type="button" className="trade-help"><Icon name="support" /> Help</button><button type="button" className="trade-help fields-toggle-button" aria-expanded={fieldsOpen} onClick={() => setFieldsOpen(!fieldsOpen)}><Icon name="settings" /> {fieldsOpen ? 'Hide fields' : 'Show fields'}</button></div>
      </div>

      <div className={`trade-workspace ${fieldsOpen ? '' : 'fields-collapsed'}`}>
        <form className="trade-form" onSubmit={(event) => {
          event.preventDefault()
          if (saveLock.current) return
          saveLock.current = true

          const formData = new FormData(event.currentTarget)
          const symbolValue = String(formData.get('symbol') ?? '').trim()
          const entryValue = Number(formData.get('entryPrice') ?? 0)
          const exitValue = Number(formData.get('exitPrice') ?? 0)
          const shareValue = Number(formData.get('shares') ?? 1)
          const actualPnlInput = String(formData.get('actualPnl') ?? '')
          const takeProfitValue = Number(formData.get('takeProfit') ?? 0)
          const stopLossValue = Number(formData.get('stopLoss') ?? 0)
          const instrumentValue = instrument
          const configuredMultiplierValue = getTradeMultiplier({ instrument: instrumentValue, symbol: symbolValue })
          const multiplierInput = String(formData.get('multiplier') ?? '')
          const multiplierValue = instrumentValue === 'Equity' || (instrumentValue === 'Crypto' && symbolMetadata?.marketType !== 'perpetual')
            ? 1
            : Number(multiplierInput || multiplier || configuredMultiplierValue || 0)
          const strategy = String(formData.get('strategy') ?? '')
          const notesValue = String(formData.get('notes') ?? '')
          const customFields = { ...(editingTrade?.customFields ?? {}) }
          CUSTOM_TRADE_FIELDS.forEach((field) => {
            if (!enabledFields.has(field)) return
            const name = `custom-${field}`
            if (getFieldKind(field) === 'boolean') customFields[field] = formData.has(name)
            else if (getFieldKind(field) === 'number') {
              const value = String(formData.get(name) ?? '')
              customFields[field] = value === '' ? '' : Number(value)
            } else customFields[field] = String(formData.get(name) ?? '')
          })

          if (!symbolValue || !tradeAccount || !Number.isFinite(entryValue) || !Number.isFinite(exitValue) || !Number.isFinite(shareValue) || shareValue <= 0) {
            setFormError(!tradeAccount ? 'Add or select an account before saving this trade.' : 'Isi simbol, harga, dan quantity dengan nilai yang valid.')
            setSaved(false)
            saveLock.current = false
            return
          }
          if (actualPnlInput !== '' && !Number.isFinite(Number(actualPnlInput))) {
            setFormError('Actual P&L harus berupa angka yang valid.')
            setSaved(false)
            saveLock.current = false
            return
          }

          const nextTrade: TradeRecord = {
            id: editingTrade?.id ?? createTradeId(),
            symbol: symbolValue.toUpperCase(),
            side,
            instrument: instrumentValue,
            status: String(formData.get('status') ?? 'Closed'),
            account: tradeAccount,
            entryPrice: entryValue,
            exitPrice: exitValue,
            shares: shareValue,
            screenshotIds: attachedScreenshotIds.slice(0, 1),
            symbolMetadata: symbolMetadata ?? undefined,
            actualPnl: actualPnlInput === '' ? undefined : Number(actualPnlInput),
            multiplier: multiplierValue,
            takeProfit: enabledFields.has('Take profit') ? (Number.isFinite(takeProfitValue) && takeProfitValue !== 0 ? takeProfitValue : undefined) : editingTrade?.takeProfit,
            stopLoss: enabledFields.has('Stop loss') ? (Number.isFinite(stopLossValue) && stopLossValue !== 0 ? stopLossValue : undefined) : editingTrade?.stopLoss,
            strategy: enabledFields.has('Strategy') ? strategy || 'Not set' : editingTrade?.strategy,
            notes: enabledFields.has('Trade notes') ? notesValue.trim() : editingTrade?.notes ?? '',
            customFields,
            pnl: 0,
            createdAt: editingTrade?.createdAt ?? new Date().toISOString(),
            entryDateTime: editingTrade?.entryDateTime,
            exitDateTime: enabledFields.has('Exit date & time') ? exitDateTime || undefined : editingTrade?.exitDateTime,
          }

          const netPnl = getTradeNetPnl(nextTrade)
          if (netPnl === null) {
            setFormError('PnL tidak dapat dihitung. Periksa multiplier, komisi, harga, dan quantity.')
            setSaved(false)
            saveLock.current = false
            return
          }
          nextTrade.pnl = netPnl
          setFormError('')

          if (editingTrade) {
            onTradeSaved((previous) => previous.map((trade) => trade.id === nextTrade.id ? nextTrade : trade))
            onEditingComplete()
          } else {
            onTradeSaved((previous) => [nextTrade, ...previous])
          }
          setSaved(true)
          saveLock.current = false
          setSide('Long')
          setInstrument('Equity')
          setSymbolMetadata(null)
          setSymbol('')
          setEntryPrice('')
          setExitPrice('')
          setShares('1')
          setActualPnl('')
          setStopLoss('')
          setTakeProfit('')
          setMultiplier('')
          setExitDateTime('')
          setDateTimeResetKey((previous) => previous + 1)
          setNotes('')
          setCustomFieldValues({})
          setAttachedScreenshotIds([])
          setTradeAccount(account === 'All Accounts' ? accounts[0] ?? '' : account)
          onTradeLogged()
          event.currentTarget.reset()
        }}>
          <section className="trade-section">
            <div className="trade-section-heading"><h2>THE TRADE</h2><span>Required</span></div>
            <div className="trade-fields-grid">
              <div className="trade-control symbol-control"><span>SYMBOL <b>*</b></span><SymbolSelector value={symbolMetadata} symbols={catalogSymbols} favoriteKeys={symbolFavorites} onSelect={handleSymbolSelect} onToggleFavorite={onToggleSymbolFavorite} onAddCustomSymbol={onAddCustomSymbol} onRemoveCustomSymbol={onRemoveCustomSymbol} /><input type="hidden" name="symbol" value={symbol} /></div>
              <fieldset className="trade-control side-control"><legend>SIDE <b>*</b></legend><div><button type="button" className={side === 'Long' ? 'selected long' : ''} onClick={() => setSide('Long')}>Long</button><button type="button" className={side === 'Short' ? 'selected short' : ''} onClick={() => setSide('Short')}>Short</button></div></fieldset>
              <label className="trade-control"><span>ACCOUNT <b>*</b></span><select name="account" required value={tradeAccount} onChange={(event) => setTradeAccount(event.target.value)}><option value="">Select account</option>{accounts.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label className="trade-control"><span>INSTRUMENT <b>*</b></span><select name="instrument" value={instrument} onChange={(event) => { setInstrument(event.target.value); setMultiplier(''); setSymbolMetadata((previous) => previous ? { ...previous, marketType: event.target.value === 'Futures' ? 'futures' : event.target.value === 'Forex' ? 'spot' : event.target.value === 'Crypto' ? 'spot' : 'equity' } : previous) }}><option>Equity</option><option>Options</option><option>Futures</option><option>Forex</option><option>Commodity</option><option>Crypto</option></select></label>
              <label className="trade-control"><span>STATUS <b>*</b></span><select name="status" defaultValue="Closed"><option value="Closed">Closed</option></select></label>
              <label className="trade-control"><span>ENTRY PRICE <b>*</b></span><input required name="entryPrice" type="number" min="0" step="any" value={entryPrice} onChange={(event) => setEntryPrice(event.target.value)} /></label>
              <label className="trade-control"><span>EXIT PRICE <b>*</b></span><input required name="exitPrice" type="number" min="0" step="any" value={exitPrice} onChange={(event) => setExitPrice(event.target.value)} /></label>
              <label className="trade-control"><span>SHARES <b>*</b></span><input required name="shares" type="number" min="0" step="any" value={shares} onChange={(event) => setShares(event.target.value)} /></label>
              {requiresMultiplier && <label className="trade-control"><span>CONTRACT MULTIPLIER <b>*</b></span><input required name="multiplier" type="number" min="0.000001" step="any" value={multiplier || configuredMultiplier || ''} onChange={(event) => setMultiplier(event.target.value)} /></label>}
              {enabledFields.has('Take profit') && <label className="trade-control"><span>TAKE PROFIT</span><input name="takeProfit" type="number" min="0" step="any" value={takeProfit} onChange={(event) => setTakeProfit(event.target.value)} /></label>}
              {enabledFields.has('Stop loss') && <label className="trade-control"><span>STOP LOSS</span><input name="stopLoss" type="number" min="0" step="any" value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} /></label>}
              {enabledFields.has('Risk / reward') && <label className="trade-control"><span>RISK / REWARD</span><input readOnly value={riskReward} /></label>}
            </div>
            <div className="trade-pnl-row"><div><span>ESTIMATED NET P&amp;L</span><strong className={pnl.startsWith('-') ? 'negative' : 'positive'}>{pnl}</strong></div><label><span>ACTUAL P&amp;L</span><input name="actualPnl" type="number" step="any" value={actualPnl} onChange={(event) => setActualPnl(event.target.value)} /></label></div>
          </section>

          <section className="trade-section">
            <div className="trade-section-heading"><h2>TIMING &amp; CONTEXT</h2></div>
            <div className="trade-context-grid">
              {enabledFields.has('Exit date & time') && <label className="trade-control"><span>EXIT DATE &amp; TIME</span><DateTime24Input key={`${editingTrade?.id ?? 'new-trade'}-${dateTimeResetKey}`} value={exitDateTime || undefined} onChange={(value) => setExitDateTime(value ?? '')} /></label>}
              {enabledFields.has('Strategy') && <label className="trade-control"><span>STRATEGY</span><select name="strategy" defaultValue={editingTrade?.strategy === 'Not set' ? '' : editingTrade?.strategy ?? ''}><option value="">Not set</option><option>Breakout</option><option>Pullback</option><option>Reversal</option><option>Momentum</option><option>Mean Reversion</option><option>News Based</option></select></label>}
            </div>
          </section>

          {CUSTOM_TRADE_FIELDS.some((field) => enabledFields.has(field)) && <section className="trade-section">
            <div className="trade-section-heading"><h2>YOUR FIELDS</h2><span>{CUSTOM_TRADE_FIELDS.filter((field) => enabledFields.has(field)).length} active</span></div>
            <div className="trade-fields-grid">{CUSTOM_TRADE_FIELDS.filter((field) => enabledFields.has(field)).map((field) => {
              const kind = getFieldKind(field)
              const value = customFieldValues[field] ?? ''
              const updateValue = (nextValue: string | number | boolean) => setCustomFieldValues((previous) => ({ ...previous, [field]: nextValue }))
              return <label className="trade-control" key={field}><span>{field.toUpperCase()}</span>{kind === 'boolean' ? <input name={`custom-${field}`} type="checkbox" checked={Boolean(value)} onChange={(event) => updateValue(event.target.checked)} /> : kind === 'select' ? <select name={`custom-${field}`} value={String(value)} onChange={(event) => updateValue(event.target.value)}><option value="">Select</option>{getFieldOptions(field).map((option) => <option key={option}>{option}</option>)}</select> : <input name={`custom-${field}`} type={kind === 'number' ? 'number' : 'text'} step={kind === 'number' ? 'any' : undefined} value={String(value)} onChange={(event) => updateValue(kind === 'number' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value)} />}</label>
            })}</div>
          </section>}

          <section className="trade-section trade-notes-section">
            <div className="trade-section-heading"><h2>NOTES &amp; MEDIA</h2><span>Optional</span></div>
            <div className="notes-editor">
              <div className="notes-toolbar"><button type="button" aria-label="Bold" title="Bold" onClick={() => formatNotes('bold')}><b>B</b></button><button type="button" aria-label="Italic" title="Italic" onClick={() => formatNotes('italic')}><i>I</i></button><button type="button" aria-label="Bulleted list" title="Bulleted list" onClick={() => formatNotes('bullet')}>&#8226;</button><button type="button" aria-label="Numbered list" title="Numbered list" onClick={() => formatNotes('numbered')}>1.</button><button type="button" aria-label="Insert link" title="Insert link" onClick={() => formatNotes('link')}><Icon name="link" /></button></div>
              {enabledFields.has('Trade notes') && <textarea ref={notesInput} name="notes" placeholder="Share your thoughts on this trade..." value={notes} onChange={(event) => setNotes(event.target.value)} />}
              {screenshotOptions.length > 0 && <label className="trade-control screenshot-existing-picker"><span>ATTACH SAVED SCREENSHOT</span><select aria-label="Attach saved screenshot" value={attachedScreenshotIds[0] ?? ''} onChange={(event) => setAttachedScreenshotIds(event.target.value ? [event.target.value] : [])}><option value="">No screenshot</option>{screenshotOptions.map((screenshot) => <option key={screenshot.id} value={screenshot.id}>{screenshot.name}</option>)}</select></label>}
              {attachedScreenshots.length > 0 && <div className="trade-screenshot-previews">{attachedScreenshots.map((screenshot) => <figure key={screenshot.id}><img src={screenshot.src} alt={screenshot.name} /><figcaption>{screenshot.name}</figcaption><button type="button" aria-label={`Detach ${screenshot.name}`} onClick={() => setAttachedScreenshotIds([])}>×</button></figure>)}</div>}
              <input ref={screenshotInput} className="screenshot-upload-input" type="file" accept="image/*" onChange={(event) => { addScreenshots(event.target.files); event.currentTarget.value = '' }} />
              <button type="button" className="add-chart-button" onClick={() => screenshotInput.current?.click()} disabled={attachedScreenshotIds.length >= 1}><Icon name="plus" /> SCREENSHOT <span>{attachedScreenshots.length} / 1</span></button>
            </div>
            <div className="trade-save-row"><button type="submit" className="save-trade-button"><Icon name="check" /> Save trade</button>{saved && <span role="status">Trade saved</span>}{formError && <span role="alert">{formError}</span>}</div>
          </section>
        </form>

        {fieldsOpen && <aside className="fields-drawer" aria-label="Trade fields">
          <div className="fields-drawer-heading"><h2>Fields</h2><button type="button" aria-label="Close fields" onClick={() => setFieldsOpen(false)}>×</button></div>
          <input className="fields-search" placeholder="Search fields" value={fieldSearch} onChange={(event) => setFieldSearch(event.target.value)} />
          <h3>Standard fields</h3>
          <div className="standard-field-list">{STANDARD_TRADE_FIELDS.map((field) => <label key={field}><span>{field}</span><input type="checkbox" checked={enabledFields.has(field)} onChange={() => toggleField(field)} /></label>)}</div>
          <h3>Field library</h3>
          <div className="field-library-list">{visibleLibraryFields.map((field) => <label key={field}><span><strong>{field}</strong><small>{getFieldKind(field)}</small></span><input type="checkbox" checked={enabledFields.has(field)} onChange={() => toggleField(field)} /></label>)}</div>
          <button type="button" className="create-field-button">Create a field</button>
        </aside>}
      </div>
    </div>
  )
}

function DailyJournalView({ onNavigate, screenshots, trades, onUpdateTrade, onDeleteTrade, onSelectForEdit, enabledFields, catalogSymbols, symbolFavorites, onAddCustomSymbol, onToggleSymbolFavorite, onRemoveCustomSymbol, settings }: { onNavigate: (view: View) => void; screenshots: TradeScreenshot[]; trades: TradeRecord[]; onUpdateTrade: (updatedTrade: TradeRecord) => void; onDeleteTrade: (tradeId: string) => void; onSelectForEdit: (tradeId: string) => void; enabledFields: Set<string>; catalogSymbols: SymbolRecord[]; symbolFavorites: Set<string>; onAddCustomSymbol: (symbol: SymbolRecord) => string | null; onToggleSymbolFavorite: (identity: string) => void; onRemoveCustomSymbol: (identity: string) => void; settings: AppSettings }) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(trades.find((trade) => trade.status.toLowerCase() === 'closed')?.id ?? '')
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [symbolFilter, setSymbolFilter] = useState('All')
  const [resultFilter, setResultFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState('')
  const [draftState, setDraftState] = useState<TradeRecord | null>(null)
  const [expandedScreenshot, setExpandedScreenshot] = useState<TradeScreenshot | null>(null)
  const screenshotTriggerRef = useRef<HTMLButtonElement | null>(null)
  const screenshotCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  const visibleTrades = trades.filter((trade) => {
    if (trade.status.toLowerCase() !== 'closed') return false
    const pnl = getTradeNetPnl(trade)
    const matchesResult = resultFilter === 'All' || (resultFilter === 'Winners' ? pnl !== null && pnl > 0.005 : resultFilter === 'Losers' ? pnl !== null && pnl < -0.005 : pnl !== null && Math.abs(pnl) <= 0.005)
    return (symbolFilter === 'All' || trade.symbol === symbolFilter)
      && (!dateFilter || getTradeDate(trade) === dateFilter)
      && matchesResult
      && `${trade.symbol} ${trade.side} ${trade.strategy ?? ''} ${getTradeDate(trade) ?? ''}`.toLowerCase().includes(search.toLowerCase())
  })
  const selectedTrade = visibleTrades.find((trade) => trade.id === selectedId) ?? visibleTrades[0] ?? null
  const draftTrade = draftState?.id === selectedTrade?.id ? draftState : selectedTrade
  const visibleScreenshots = screenshots.filter((screenshot) => draftTrade?.screenshotIds?.includes(screenshot.id)).slice(0, 1)

  useEffect(() => {
    if (!expandedScreenshot) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpandedScreenshot(null)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    screenshotCloseButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
      screenshotTriggerRef.current?.focus()
    }
  }, [expandedScreenshot])

  const groups = [...new Set(visibleTrades.map(getTradeDate).filter((date): date is string => Boolean(date)))].sort((left, right) => right.localeCompare(left))

  const updateDraftField = <K extends keyof TradeRecord>(field: K, value: TradeRecord[K]) => {
    setDraftState((previous) => {
      const current = previous?.id === selectedTrade?.id ? previous : selectedTrade
      return current ? { ...current, [field]: value } : current
    })
  }

  const updateCustomField = (field: string, value: string | number | boolean) => {
    setDraftState((previous) => {
      const current = previous?.id === selectedTrade?.id ? previous : selectedTrade
      return current ? { ...current, customFields: { ...current.customFields, [field]: value } } : current
    })
  }

  const selectDraftSymbol = (selected: SymbolRecord) => {
    setDraftState((previous) => {
      const current = previous?.id === selectedTrade?.id ? previous : selectedTrade
      return current ? {
        ...current,
        symbol: selected.symbol,
        instrument: getInstrumentForSymbol(selected),
        symbolMetadata: selected,
        multiplier: selected.contractMultiplier ?? undefined,
      } : current
    })
  }

  const handleSaveTrade = () => {
    if (!draftTrade) return
    const pnl = getTradeNetPnl(draftTrade)
    if (pnl === null) {
      setSaveError('PnL tidak dapat dihitung. Periksa multiplier, harga, dan quantity trade.')
      setSaved(false)
      return
    }
    onUpdateTrade({
      ...draftTrade,
      pnl,
    })
    setSaveError('')
    setSaved(true)
  }

  const handleDeleteTrade = () => {
    if (!selectedTrade) return
    onDeleteTrade(selectedTrade.id)
    setSelectedId(visibleTrades.find((trade) => trade.id !== selectedTrade.id)?.id ?? '')
    setDraftState(null)
    setSaved(false)
  }

  return (
    <div className="journal-page">
      <div className="journal-intro">
        <div className="journal-actions"><button type="button" onClick={() => onNavigate('trade-logging')}><Icon name="plus" /> NEW TRADE</button><label><Icon name="download" /> CSV IMPORT<input type="file" accept=".csv,text/csv" /></label></div>
      </div>

      <div className="journal-layout">
        <aside className="journal-trade-list" aria-label="Trade list">
          <div className="journal-search-row"><label><Icon name="search" /><input placeholder="Search trades..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><Icon name="filter" /> FILTERS</button></div>
          {filtersOpen && <div className="journal-filter-options"><label>Symbol<select value={symbolFilter} onChange={(event) => setSymbolFilter(event.target.value)}><option>All</option>{[...new Set(trades.filter((trade) => trade.status.toLowerCase() === 'closed').map((trade) => trade.symbol))].sort().map((symbol) => <option key={symbol}>{symbol}</option>)}</select></label><label>Result<select value={resultFilter} onChange={(event) => setResultFilter(event.target.value)}><option>All</option><option>Winners</option><option>Losers</option><option>Breakeven</option></select></label><label>Date<input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label></div>}
          <div className="journal-closed-heading">CLOSED TRADES</div>
          <div className="journal-result-count">Showing {visibleTrades.length ? 1 : 0} to {visibleTrades.length} of {visibleTrades.length} trades (50 per page)</div>
          <div className="journal-groups">
            {groups.map((date) => {
              const dayTrades = visibleTrades.filter((trade) => getTradeDate(trade) === date)
              const dateLabel = formatTradeDateLabel(date, settings.account.dateFormat)
              return <section className="journal-day-group" key={date}><div className="journal-day-heading">{dateLabel}<span>·</span>{dayTrades.length}</div><div className="journal-day-trades">{dayTrades.map((trade) => { const pnl = getTradeNetPnl(trade); return <button key={trade.id} type="button" className={`journal-trade-item ${selectedTrade?.id === trade.id ? 'selected' : ''}`} onClick={() => { setSelectedId(trade.id); setSaved(false) }}><span className="trade-symbol-tile">{trade.symbol}</span><span className="trade-item-content"><strong>{trade.symbol} <i className={trade.side.toLowerCase()}>{trade.side}</i></strong><small>{formatTradeClockTime(trade, settings.account)} <b>·</b> {trade.strategy ?? 'No Strategy'}</small><small className="trade-tag">◯ &nbsp;No Tag</small></span><b className="trade-item-pnl">{pnl === null ? 'PnL unavailable' : <ResultAmount value={pnl} currency={settings.account.baseCurrency} />}</b></button> })}</div></section>
            })}
            {!visibleTrades.length && <div className="journal-empty">No trades found</div>}
          </div>
          <div className="journal-pagination"><span>Page 1 of 1</span><button type="button" disabled>Prev</button><button type="button" disabled>Next</button></div>
        </aside>

        <section className="journal-review-column" aria-label="Trade review">
          {selectedTrade && draftTrade ? <article className="journal-review-card">
            <div className="journal-review-summary"><div><strong>{draftTrade.symbol}</strong><span>{draftTrade.side}</span><small>{draftTrade.strategy ?? 'No Strategy'}</small></div><div><span>Exit {draftTrade.exitDateTime ? formatExitDateTime(draftTrade.exitDateTime, settings.account) : '—'}</span><b>·</b><span>{formatCurrency(draftTrade.entryPrice, settings.account.baseCurrency).replace('+', '')}</span><b>→</b><span>{formatCurrency(draftTrade.exitPrice, settings.account.baseCurrency).replace('+', '')}</span><b>·</b><span>{draftTrade.shares} shares</span></div><small>{draftTrade.instrument} · estimated P&amp;L</small><strong className="review-pnl">{getTradeNetPnl(draftTrade) === null ? 'PnL unavailable' : <ResultAmount value={getTradeNetPnl(draftTrade) ?? 0} currency={settings.account.baseCurrency} />}</strong></div>
            <div className="journal-edit-grid">
              <label className="journal-symbol-control"><span>SYMBOL</span><SymbolSelector value={getTradeSymbolRecord(draftTrade, catalogSymbols)} symbols={catalogSymbols} favoriteKeys={symbolFavorites} onSelect={selectDraftSymbol} onToggleFavorite={onToggleSymbolFavorite} onAddCustomSymbol={onAddCustomSymbol} onRemoveCustomSymbol={onRemoveCustomSymbol} /></label>
              <label><span>SIDE</span><select value={draftTrade.side} onChange={(event) => updateDraftField('side', event.target.value as TradeRecord['side'])}><option>Long</option><option>Short</option></select></label>
              <label><span>ENTRY PRICE</span><input value={draftTrade.entryPrice} type="number" onChange={(event) => updateDraftField('entryPrice', Number(event.target.value) || 0)} /></label>
              <label><span>EXIT PRICE</span><input value={draftTrade.exitPrice} type="number" onChange={(event) => updateDraftField('exitPrice', Number(event.target.value) || 0)} /></label>
              <label><span>SHARES</span><input value={draftTrade.shares} type="number" onChange={(event) => updateDraftField('shares', Number(event.target.value) || 1)} /></label>
              {enabledFields.has('Exit date & time') && <label><span>EXIT DATE &amp; TIME</span><DateTime24Input key={draftTrade.id} value={draftTrade.exitDateTime} onChange={(value) => updateDraftField('exitDateTime', value)} /></label>}
              {enabledFields.has('Stop loss') && <label><span>STOP LOSS</span><input value={draftTrade.stopLoss ?? ''} type="number" onChange={(event) => updateDraftField('stopLoss', event.target.value ? Number(event.target.value) : undefined)} /></label>}
              {enabledFields.has('Take profit') && <label><span>TAKE PROFIT</span><input value={draftTrade.takeProfit ?? ''} type="number" onChange={(event) => updateDraftField('takeProfit', event.target.value ? Number(event.target.value) : undefined)} /></label>}
              {enabledFields.has('Strategy') && <label><span>STRATEGY</span><select value={draftTrade.strategy ?? ''} onChange={(event) => updateDraftField('strategy', event.target.value || undefined)}><option value="">No Strategy</option><option>Breakout</option><option>Pullback</option><option>Reversal</option><option>Momentum</option><option>Mean Reversion</option><option>News Based</option></select></label>}
              {enabledFields.has('Trade notes') && <label className="journal-notes-input"><span>TRADE NOTES</span><input value={draftTrade.notes} onChange={(event) => updateDraftField('notes', event.target.value)} /></label>}
              {enabledFields.has('Risk / reward') && <label><span>RISK / REWARD</span><input readOnly value={formatRiskReward(draftTrade)} /></label>}
              {CUSTOM_TRADE_FIELDS.filter((field) => enabledFields.has(field)).map((field) => {
                const kind = getFieldKind(field)
                const value = draftTrade.customFields?.[field]
                return <label key={field}><span>{field.toUpperCase()}</span>{kind === 'boolean' ? <input type="checkbox" checked={Boolean(value)} onChange={(event) => updateCustomField(field, event.target.checked)} /> : kind === 'select' ? <select value={String(value ?? '')} onChange={(event) => updateCustomField(field, event.target.value)}><option value="">Select</option>{getFieldOptions(field).map((option) => <option key={option}>{option}</option>)}</select> : <input type={kind === 'number' ? 'number' : 'text'} value={String(value ?? '')} onChange={(event) => updateCustomField(field, kind === 'number' ? Number(event.target.value) || 0 : event.target.value)} />}</label>
              })}
            </div>
            <div className="journal-save-row"><button type="button" className="collapse-review" aria-label="Collapse review">⌃</button><span>{saved ? 'Saved' : 'tap header to collapse'}</span>{saveError && <span role="alert">{saveError}</span>}<button type="button" onClick={() => onSelectForEdit(draftTrade.id)}>Edit in Trade Logging</button><button type="button" onClick={handleSaveTrade}>Save</button><button type="button" className="delete-trade-button" onClick={handleDeleteTrade}>Delete</button></div>
          </article> : <div className="journal-empty">No trades found</div>}
          <section className="journal-screenshot-gallery" aria-label="Trade screenshots">
            <header><h3>TRADE SCREENSHOTS</h3><button type="button" onClick={() => onNavigate('trade-logging')}>Manage in Trade Logging</button></header>
            {visibleScreenshots.length > 0 ? <div className="journal-screenshot-grid">{visibleScreenshots.map((screenshot) => <figure key={screenshot.id}><button className="journal-screenshot-preview" type="button" aria-label={`View ${screenshot.name} full size`} onClick={(event) => { screenshotTriggerRef.current = event.currentTarget; setExpandedScreenshot(screenshot) }}><img src={screenshot.src} alt={screenshot.name} /></button><figcaption>{screenshot.name}</figcaption></figure>)}</div> : <div className="journal-screenshot-empty"><span>No screenshots attached to this trade</span><button type="button" onClick={() => onNavigate('trade-logging')}><Icon name="plus" /> Add screenshot in Trade Logging</button></div>}
          </section>
        </section>
      </div>
      {expandedScreenshot && typeof document !== 'undefined' && createPortal(<div className="journal-screenshot-lightbox" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setExpandedScreenshot(null) }}><section className="journal-screenshot-lightbox-content" role="dialog" aria-modal="true" aria-label={`Screenshot: ${expandedScreenshot.name}`}><button ref={screenshotCloseButtonRef} className="journal-screenshot-lightbox-close" type="button" aria-label="Close enlarged screenshot" onClick={() => setExpandedScreenshot(null)}>×</button><figure><img src={expandedScreenshot.src} alt={expandedScreenshot.name} /><figcaption>{expandedScreenshot.name}</figcaption></figure></section></div>, document.body)}
    </div>
  )
}

function CalendarView({ onNavigate, onAddTradeForDate, onEditNoTradeReason, noTradeReasons, trades, settings }: { onNavigate: (view: View) => void; onAddTradeForDate: (date: string) => void; onEditNoTradeReason: (date: string) => void; noTradeReasons: Record<string, string>; trades: TradeRecord[]; settings: AppSettings }) {
  const [month, setMonth] = useState(() => { const today = new Date(); return new Date(today.getFullYear(), today.getMonth(), 1) })
  const [breakdownPeriod, setBreakdownPeriod] = useState<'Month' | 'Year'>('Month')
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstWeekday = month.getDay()
  const daysInCalendarMonth = daysInMonth(year, monthIndex)
  const previousMonthDays = daysInMonth(monthIndex === 0 ? year - 1 : year, (monthIndex + 11) % 12)
  const weeks = Math.ceil((firstWeekday + daysInCalendarMonth) / 7)
  const monthRows = getRealizedTrades(trades).filter((row) => row.date.startsWith(`${year}-${String(monthIndex + 1).padStart(2, '0')}`))
  const dayTotals = new Map<number, { pnl: number; count: number }>()
  monthRows.forEach((row) => {
    const day = Number(row.date.slice(8, 10))
    const total = dayTotals.get(day) ?? { pnl: 0, count: 0 }
    total.pnl += row.pnl
    total.count += 1
    dayTotals.set(day, total)
  })
  const weekTotals = Array.from({ length: weeks }, (_, weekIndex) => {
    const weekRows = monthRows.filter((row) => Math.floor((Number(row.date.slice(8, 10)) + firstWeekday - 1) / 7) === weekIndex)
    const weekStats = getTradeStats(weekRows.map((row) => row.trade))
    return { count: weekStats.validCount, wins: weekStats.wins, losses: weekStats.losses, pnl: weekStats.totalPnl, grossProfit: weekStats.grossProfit, grossLoss: weekStats.grossLoss }
  })
  const monthlyBreakdown = Array.from({ length: 12 }, (_, monthNumber) => {
    const monthKey = `${year}-${String(monthNumber + 1).padStart(2, '0')}`
    const monthTrades = getRealizedTrades(trades).filter((row) => row.date.startsWith(monthKey))
    const monthStats = getTradeStats(monthTrades.map((row) => row.trade))
    return { label: MONTH_NAMES[monthNumber].slice(0, 3), count: monthStats.validCount, wins: monthStats.wins, losses: monthStats.losses, pnl: monthStats.totalPnl, grossProfit: monthStats.grossProfit, grossLoss: monthStats.grossLoss }
  }).filter((item) => item.count > 0)
  const breakdownRows = breakdownPeriod === 'Month'
    ? weekTotals.map((item, index) => ({ ...item, label: `Week ${index + 1}` })).filter((item) => item.count > 0)
    : monthlyBreakdown
  const changeMonth = (offset: number) => setMonth(new Date(year, monthIndex + offset, 1))

  return (
    <div className="calendar-page">
      <div className="calendar-view-main">
        <section className="calendar-month-panel">
          <div className="calendar-view-header"><button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button><div><select aria-label="Month" value={monthIndex} onChange={(event) => setMonth(new Date(year, Number(event.target.value), 1))}>{MONTH_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}</select><select aria-label="Year" value={year} onChange={(event) => setMonth(new Date(Number(event.target.value), monthIndex, 1))}>{[year - 1, year, year + 1].map((value) => <option key={value}>{value}</option>)}</select></div><button type="button" onClick={() => changeMonth(1)} aria-label="Next month">›</button></div>
          <div className="calendar-view-weekdays">{['S', 'M', 'T', 'W', 'T', 'F', 'S', 'WEEK'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div className="calendar-view-grid" style={{ gridTemplateRows: `repeat(${weeks}, minmax(114px, 1fr))` }}>
            {Array.from({ length: weeks * 7 }, (_, index) => {
              const dayNumber = index - firstWeekday + 1
              const inMonth = dayNumber > 0 && dayNumber <= daysInCalendarMonth
              const displayDay = dayNumber < 1 ? previousMonthDays + dayNumber : dayNumber > daysInCalendarMonth ? dayNumber - daysInCalendarMonth : dayNumber
              const info = inMonth ? dayTotals.get(dayNumber) : undefined
              const dateKey = localDateKey(new Date(year, monthIndex, dayNumber))
              return <CalendarDayCell key={`${dateKey}-${index}`} day={displayDay} dateKey={dateKey} muted={!inMonth} weekend={index % 7 === 0 || index % 7 === 6} info={info} reason={noTradeReasons[dateKey]} currency={settings.account.baseCurrency} onOpenJournal={() => { if (info?.count) onNavigate('daily-journal') }} onAddTrade={() => onAddTradeForDate(dateKey)} onEditReason={() => onEditNoTradeReason(dateKey)} />
            }).flatMap((cell, index) => index % 7 === 6 ? [cell, <div className="calendar-week-total" key={`week-${index}`}><span>Week {Math.floor(index / 7) + 1}</span><strong>{weekTotals[Math.floor(index / 7)]?.count ? <ResultAmount value={weekTotals[Math.floor(index / 7)].pnl} currency={settings.account.baseCurrency} className={weekTotals[Math.floor(index / 7)].pnl > 0 ? 'positive' : ''} /> : '—'}</strong>{weekTotals[Math.floor(index / 7)]?.count > 0 && <small>{weekTotals[Math.floor(index / 7)].count} TRADES</small>}</div>] : [cell])}
          </div>
        </section>
        <section className="weekly-breakdown-panel">
          <div className="weekly-breakdown-header"><h2>Weekly Breakdown</h2><div>{(['Month', 'Year'] as const).map((value) => <button key={value} type="button" aria-pressed={breakdownPeriod === value} className={breakdownPeriod === value ? 'selected' : ''} onClick={() => setBreakdownPeriod(value)}>{value}</button>)}</div></div>
          <table><thead><tr><th>{breakdownPeriod === 'Month' ? 'WEEK' : 'MONTH'}</th><th>TRADE</th><th>WIN</th><th>LOSS</th><th>GROSS GAIN</th><th>GROSS LOSS</th></tr></thead><tbody>{breakdownRows.length ? <>{breakdownRows.map((item) => <tr key={item.label}><td>{item.label}</td><td>{item.count}</td><td className="positive">{item.wins}</td><td className="negative">{item.losses}</td><td><ResultAmount value={item.grossProfit} currency={settings.account.baseCurrency} className="positive" /></td><td><ResultAmount value={-item.grossLoss} currency={settings.account.baseCurrency} /></td></tr>)}<tr><td>Total</td><td>{breakdownRows.reduce((sum, item) => sum + item.count, 0)}</td><td>{breakdownRows.reduce((sum, item) => sum + item.wins, 0)}</td><td className="negative">{breakdownRows.reduce((sum, item) => sum + item.losses, 0)}</td><td><ResultAmount value={breakdownRows.reduce((sum, item) => sum + item.grossProfit, 0)} currency={settings.account.baseCurrency} className="positive" /></td><td><ResultAmount value={-breakdownRows.reduce((sum, item) => sum + item.grossLoss, 0)} currency={settings.account.baseCurrency} /></td></tr></> : <tr><td colSpan={6}>No closed trades for this {breakdownPeriod.toLowerCase()}.</td></tr>}</tbody></table>
        </section>
      </div>
    </div>
  )
}

function AnalyticsView({ activeTab, onTabChange, trades, settings, accounts, accountSettings, selectedAccount, onSelectAccount }: { activeTab: AnalyticsTab; onTabChange: (tab: AnalyticsTab) => void; trades: TradeRecord[]; settings: AppSettings; accounts: string[]; accountSettings: TradingAccountSettings[]; selectedAccount: string; onSelectAccount: (account: string) => void }) {
  const [period, setPeriod] = useState('ALL')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [instrumentFilter, setInstrumentFilter] = useState('All instruments')
  const [strategyFilter, setStrategyFilter] = useState('All strategies')
  const [symbolFilter, setSymbolFilter] = useState('All symbols')
  const [today] = useState(() => new Date())
  const periods = ['7D', '30D', '60D', '90D', '1Y', 'ALL']
  const periodDays: Record<string, number | null> = { '7D': 7, '30D': 30, '60D': 60, '90D': 90, '1Y': 365, ALL: null }
  const cutoffDate = periodDays[period] === null ? null : offsetDateKey(today, -(periodDays[period] ?? 1) + 1)
  const allRows = getRealizedTrades(trades)
  const tradeSymbols = new Map(trades.map((trade) => [trade.id, getTradeSymbolRecord(trade, BUILT_IN_SYMBOLS)]))
  const symbolOptions = [...new Map([...tradeSymbols.values()].map((item) => [getSymbolIdentity(item), item])).values()]
  const filteredRows = allRows.filter(({ trade, date }) =>
    (selectedAccount === 'All Accounts' || getTradeAccountName(trade) === selectedAccount)
    && (instrumentFilter === 'All instruments' || trade.instrument === instrumentFilter)
    && (strategyFilter === 'All strategies' || (trade.strategy ?? 'Not set') === strategyFilter)
    && (symbolFilter === 'All symbols' || getSymbolIdentity(tradeSymbols.get(trade.id) ?? getTradeSymbolRecord(trade, BUILT_IN_SYMBOLS)) === symbolFilter)
    && (!cutoffDate || date >= cutoffDate),
  )
  const filteredTrades = filteredRows.map((row) => row.trade)
  const stats = getTradeStats(filteredTrades)
  const selectedFinancialSettings = accountSettings.filter((item) => selectedAccount === 'All Accounts' || item.name === selectedAccount)
  const configuredBalance = selectedFinancialSettings.reduce((sum, item) => sum + item.balance, 0)
  const configuredMaxDrawdown = selectedFinancialSettings.length === 1 ? selectedFinancialSettings[0].maxDrawdown : null
  const instruments = [...new Set(trades.map((trade) => trade.instrument).filter(Boolean))].sort()
  const strategies = [...new Set(trades.map((trade) => trade.strategy || 'Not set'))].sort()
  const strategyStats = getPerformanceBy(filteredTrades, 'strategy')
  const instrumentStats = getPerformanceBy(filteredTrades, 'instrument')
  const sideStats = getPerformanceBy(filteredTrades, 'side')
  const mostTradedInstrument = [...instrumentStats].sort((left, right) => right.count - left.count)[0]
  const bestStrategy = strategyStats[0]
  const weakestStrategy = [...strategyStats].sort((left, right) => left.pnl - right.pnl)[0]
  const bestSide = [...sideStats].sort((left, right) => right.pnl - left.pnl)[0]
  const sessionStats = getPerformanceBy(filteredTrades, 'Session').filter((item) => item.value !== 'Not set')
  const exitReasonStats = getPerformanceBy(filteredTrades, 'Exit Reason').filter((item) => item.value !== 'Not set')
  const mistakeStats = getPerformanceBy(filteredTrades, 'Mistake Type').filter((item) => !['Not set', 'None'].includes(item.value))
  const emotionalStats = getPerformanceBy(filteredTrades, 'Emotional audit').filter((item) => item.value !== 'Not set')
  const entryQualityStats = getPerformanceBy(filteredTrades, 'Entry Quality').filter((item) => item.value !== 'Not set')
  const followedRows = filteredRows.filter(({ trade }) => typeof trade.customFields?.['Followed Plan'] === 'boolean')
  const followedCount = followedRows.filter(({ trade }) => trade.customFields?.['Followed Plan'] === true).length
  const followedRate = followedRows.length ? (followedCount / followedRows.length) * 100 : 0
  const reviewedCount = filteredRows.filter(({ trade }) => Boolean(String(trade.customFields?.['Lesson Learned'] ?? trade.notes ?? '').trim())).length
  const setupGrades = filteredRows.map(({ trade }) => String(trade.customFields?.['Setup Grade'] ?? '')).filter(Boolean)
  const greatTrades = setupGrades.filter((grade) => ['A', 'B'].includes(grade)).length
  const poorTrades = setupGrades.filter((grade) => ['D', 'F'].includes(grade)).length
  const ratedGreatRate = setupGrades.length ? (greatTrades / setupGrades.length) * 100 : 0
  const ratedPoorRate = setupGrades.length ? (poorTrades / setupGrades.length) * 100 : 0
  const lessonsCount = filteredRows.filter(({ trade }) => Boolean(String(trade.customFields?.['Lesson Learned'] ?? '').trim())).length
  const monthlyFollowed = new Map()
  followedRows.forEach((row) => {
    const month = row.date.slice(0, 7)
    const counts = monthlyFollowed.get(month) ?? { month, followed: 0, total: 0 }
    counts.total += 1
    counts.followed += row.trade.customFields?.['Followed Plan'] === true ? 1 : 0
    monthlyFollowed.set(month, counts)
  })
  const monthlyAdherence = [...monthlyFollowed.values()].sort((left, right) => left.month.localeCompare(right.month)).map((item) => (item.followed / item.total) * 100)
  const actualRMultiples = filteredRows.flatMap(({ trade, pnl }) => {
    const multiplier = getTradeMultiplier(trade)
    const quantity = Number(trade.shares ?? trade.contracts)
    const risk = Math.abs(Number(trade.entryPrice) - Number(trade.stopLoss)) * quantity * (multiplier ?? 0)
    return trade.stopLoss !== undefined && Number.isFinite(risk) && risk > 0 ? [pnl / risk] : []
  })
  const averageActualR = actualRMultiples.length ? actualRMultiples.reduce((sum, value) => sum + value, 0) / actualRMultiples.length : null
  const dailyStats = groupRealizedPnl(filteredTrades)
  const monthlyStats = groupRealizedPnl(filteredTrades, 'month')
  const equityCurve = getEquityCurve(filteredTrades)
  const rollingWinRate = filteredRows.map((_, index) => {
    const windowRows = filteredRows.slice(Math.max(0, index - 9), index + 1)
    return (windowRows.filter((item) => item.pnl > 0.005).length / windowRows.length) * 100
  })
  const drawdownSeries = equityCurve.reduce((result, row) => {
    const peak = Math.max(result.peak, row.equity)
    return { peak, values: [...result.values, row.equity - peak] }
  }, { peak: 0, values: [] as number[] }).values
  const chartSeries = [
    { title: 'Cumulative PnL', values: equityCurve.map((row) => row.equity), color: '#10b981' },
    { title: 'Drawdown Curve', values: drawdownSeries, color: '#fb7185' },
    { title: 'Daily PnL', values: dailyStats.map((row) => row.pnl), color: '#60a5fa' },
    { title: 'Fees vs Profit', values: stats.validCount ? [stats.grossProfit, stats.commissions, stats.totalPnl] : [], color: '#fbbf24' },
    { title: 'Rolling Win Rate (10-trade)', values: rollingWinRate, color: '#a78bfa' },
  ]
  const metrics = [
    { label: 'WIN RATE', value: `${stats.winRate.toFixed(1)}%`, detail: `${stats.validCount} valid closed trades`, color: 'blue', icon: 'chart' },
    { label: 'TOTAL REALIZED PNL', value: formatCurrency(stats.totalPnl, settings.account.baseCurrency), detail: `${stats.wins} wins · ${stats.losses} losses · ${stats.breakeven} breakeven`, color: 'green', icon: 'trend' },
    { label: 'PROFIT FACTOR', value: Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞', detail: <><ResultAmount value={stats.grossProfit} currency={settings.account.baseCurrency} /> / <ResultAmount value={-stats.grossLoss} currency={settings.account.baseCurrency} /></>, color: 'amber', icon: 'flash' },
    { label: 'EXPECTANCY', value: formatCurrency(stats.averagePnl, settings.account.baseCurrency), detail: 'net PnL per closed trade', color: 'green', icon: 'trend' },
    { label: 'MONTHLY ROI', value: configuredBalance > 0 ? `${((stats.totalPnl / configuredBalance) * 100).toFixed(2)}%` : 'N/A', detail: configuredBalance > 0 ? `realized P&L / selected account balance` : 'configure account balance in Settings', color: 'purple', icon: 'chart' },
    { label: 'MAX DRAWDOWN', value: stats.maxDrawdown ? formatCurrency(-stats.maxDrawdown, settings.account.baseCurrency) : formatCurrency(0, settings.account.baseCurrency), detail: configuredMaxDrawdown ? `peak to trough · limit ${configuredMaxDrawdown}%` : 'peak to trough', color: 'rose', icon: 'trend' },
    { label: 'WIN / LOSS', value: <><ResultAmount value={stats.averageWin} currency={settings.account.baseCurrency} /> / <ResultAmount value={-stats.averageLoss} currency={settings.account.baseCurrency} /></>, detail: 'average outcomes', color: 'cyan', icon: 'arrowRight' },
  ] as const

  return (
    <div className="analytics-page">
      <div className="analytics-toolbar">
        <div className="analytics-tabs" role="tablist" aria-label="Analytics views">
          {([['performance', 'Performance'], ['edge', 'Edge Analysis'], ['behavior', 'Behavior'], ['progress', 'Progress']] as const).map(([tab, label]) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'selected' : ''} onClick={() => onTabChange(tab)}><Icon name={tab === 'edge' ? 'trend' : tab === 'behavior' ? 'user' : tab === 'progress' ? 'spark' : 'chart'} />{label}</button>)}
        </div>
        <div className="analytics-filterbar">
          {activeTab === 'performance' && <div className="period-options">{periods.map((value) => <button key={value} type="button" className={period === value ? 'selected' : ''} onClick={() => setPeriod(value)}>{value}</button>)}</div>}
          <button type="button" className="analytics-filter-button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><Icon name="filter" /> Filter</button>
          <div className="analytics-account-wrap"><button type="button" className="analytics-account-button" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}><Icon name="user" /> {selectedAccount} <Icon name="chevron" /></button>{accountOpen && <div className="header-menu" role="menu"><button type="button" role="menuitem" onClick={() => { onSelectAccount('All Accounts'); setAccountOpen(false) }}>All Accounts</button>{accounts.map((name) => <button key={name} type="button" role="menuitem" onClick={() => { onSelectAccount(name); setAccountOpen(false) }}>{name}</button>)}</div>}</div>
        </div>
      </div>
      {filtersOpen && <div className="analytics-filter-panel"><label>Symbol<select value={symbolFilter} onChange={(event) => setSymbolFilter(event.target.value)}><option>All symbols</option>{symbolOptions.map((item) => <option key={getSymbolIdentity(item)} value={getSymbolIdentity(item)}>{item.symbol}{item.exchange ? ` · ${item.exchange}` : ''}{item.marketType ? ` · ${item.marketType}` : ''}</option>)}</select></label><label>Instrument<select value={instrumentFilter} onChange={(event) => setInstrumentFilter(event.target.value)}><option>All instruments</option>{instruments.map((value) => <option key={value}>{value}</option>)}</select></label><label>Strategy<select value={strategyFilter} onChange={(event) => setStrategyFilter(event.target.value)}><option>All strategies</option>{strategies.map((value) => <option key={value}>{value}</option>)}</select></label><button type="button" onClick={() => setFiltersOpen(false)}>Done</button></div>}

      {activeTab === 'performance' && <>
        <section className="analytics-metric-grid" aria-label="Performance metrics">{metrics.map((metric) => <article key={metric.label} className={`analytics-metric-card ${metric.color}`}><div><span>{metric.label}</span><strong className={typeof metric.value === 'string' && metric.value.startsWith('-') ? 'negative' : ''}>{metric.value}</strong><small>{metric.detail}</small></div><i><Icon name={metric.icon} /></i></article>)}</section>
        <section className="analytics-chart-grid" aria-label="Performance charts">{chartSeries.map(({ title, values, color }) => { const resultColor = values[values.length - 1] < 0 ? '#ef4444' : color; return <article key={title} className="analytics-chart-card"><header><span><Icon name="trend" /></span><h2>{title}</h2></header>{values.length ? <svg viewBox="0 0 620 300" role="img" aria-label={`${title} chart`}><g className="analytics-grid-lines">{[44, 96, 148, 200, 252].map((y) => <line key={y} x1="48" x2="600" y1={y} y2={y} />)}</g><polyline points={chartPoints(values, 48, 600, 44, 252)} fill="none" stroke={resultColor} strokeWidth="2" />{chartCoordinates(values, 48, 600, 44, 252).map((point, index) => <circle key={`${title}-${index}`} cx={point.x} cy={point.y} r="3" fill={resultColor} />)}<text x="48" y="278" className="analytics-chart-labels">{values.length} data points</text></svg> : <div className="analytics-empty-chart">No closed trades for these filters</div>}</article> })}</section>
      </>}

      {activeTab === 'edge' && <section className="analytics-detail-view">
        <div className="analytics-section-heading"><h2>Strategy Performance</h2><span>{stats.validCount} valid closed trades</span></div>
        <div className="analytics-strategy-table"><div className="table-head"><span>STRATEGY</span><span>WIN RATE</span><span>AVG PNL</span><span>EXPECTANCY</span></div>{strategyStats.map((item) => <div key={item.value}><strong>{item.value.toUpperCase()}</strong><span>{item.winRate.toFixed(1)}%</span><ResultAmount value={item.averagePnl} currency={settings.account.baseCurrency} /><ResultAmount value={item.averagePnl} currency={settings.account.baseCurrency} /></div>)}{!strategyStats.length && <div className="analytics-empty-chart">No closed trades for these filters</div>}</div>
        <div className="analytics-detail-cards edge-highlights"><article><span>TOP STRATEGY</span><strong>{bestStrategy?.value ?? '—'}</strong><small>{bestStrategy ? <>{bestStrategy.winRate.toFixed(1)}% win · <ResultAmount value={bestStrategy.pnl} currency={settings.account.baseCurrency} /></> : 'No closed trade data'}</small></article><article><span>WEAKEST STRATEGY</span><strong>{weakestStrategy?.value ?? '—'}</strong><small>{weakestStrategy ? <>{weakestStrategy.winRate.toFixed(1)}% win · <ResultAmount value={weakestStrategy.pnl} currency={settings.account.baseCurrency} /></> : 'No closed trade data'}</small></article></div>
        <section className="analytics-session-panel"><header><h2>Session Performance</h2><div><span>WIN RATE</span><span>AVG PNL</span></div></header>{sessionStats.length ? sessionStats.map((item) => <div className="session-performance-row" key={item.value}><span>{item.value}</span><i><b style={{ width: `${item.winRate}%` }} /></i><strong>{item.winRate.toFixed(1)}%</strong><em><ResultAmount value={item.averagePnl} currency={settings.account.baseCurrency} /></em></div>) : <div className="analytics-empty-chart">No session values recorded on closed trades</div>}</section>
        <div className="analytics-edge-grid"><article><header><h2>Most Traded</h2></header><strong>{mostTradedInstrument?.value ?? '—'}</strong><small>Instrument</small><span>{mostTradedInstrument ? <>{mostTradedInstrument.count} closed trades · <ResultAmount value={mostTradedInstrument.pnl} currency={settings.account.baseCurrency} /></> : 'No closed trade data'}</span></article><article><header><h2>Best Performing Side</h2></header><strong>{bestSide?.value ?? '—'}</strong><small>Position side</small><span>{bestSide ? <>{bestSide.winRate.toFixed(1)}% win rate · <ResultAmount value={bestSide.averagePnl} currency={settings.account.baseCurrency} /> avg</> : 'No closed trade data'}</span></article></div>
        <div className="analytics-detail-cards"><article><span>Setup Quality</span><strong>{entryQualityStats.length ? entryQualityStats.map((item) => `${item.value}: ${item.winRate.toFixed(0)}% win`).join(' · ') : 'No setup quality values'}</strong><small>Based on saved Entry Quality values</small></article><article><span>Confidence</span><strong>{getPerformanceBy(filteredTrades, 'Confidence After Trade').filter((item) => item.value !== 'Not set').map((item) => `${item.value}: ${item.winRate.toFixed(0)}%`).join(' · ') || 'No confidence values'}</strong><small>Based on saved confidence values</small></article><article><span>Time Heatmap</span><strong>{sessionStats.map((item) => `${item.value} ${item.count}`).join(' · ') || 'No session values'}</strong><small>Trade count by recorded session</small></article></div>
      </section>}

      {activeTab === 'behavior' && <section className="analytics-detail-view">
        <section className="psychology-panel"><header><h2>Psychology Status</h2></header><div>{[['Followed plan', followedRows.length ? `${followedRate.toFixed(1)}%` : 'N/A', `${followedCount}/${followedRows.length} recorded`, 'green'], ['Deviated', followedRows.length ? `${(100 - followedRate).toFixed(1)}%` : 'N/A', 'of recorded plans', 'rose'], ['Discipline', followedRows.length ? `${followedRate.toFixed(1)}%` : 'N/A', 'followed plan', 'blue'], ['Mistakes', stats.validCount ? `${((mistakeStats.reduce((sum, item) => sum + item.count, 0) / stats.validCount) * 100).toFixed(1)}%` : 'N/A', `${mistakeStats.reduce((sum, item) => sum + item.count, 0)} recorded`, 'amber']].map(([label, value, detail, color]) => <article key={label} className={color}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}</div></section>
        <article className="analytics-behavior-chart"><header><h2>Plan Adherence Trend</h2><span>{monthlyAdherence.length ? `${monthlyAdherence.length} months` : 'No plan data'}</span></header>{monthlyAdherence.length ? <svg viewBox="0 0 620 180" role="img" aria-label="Monthly plan adherence trend"><g className="analytics-grid-lines">{[30, 60, 90, 120, 150].map((y) => <line key={y} x1="32" x2="600" y1={y} y2={y} />)}</g><polyline points={chartPoints(monthlyAdherence, 32, 600, 30, 150)} fill="none" stroke="#10b981" strokeWidth="2" /></svg> : <div className="analytics-empty-chart">Log Followed Plan to see adherence</div>}</article>
        <div className="analytics-detail-cards"><article><span>Mistake Leaderboard</span><strong>{mistakeStats.length ? mistakeStats.map((item) => `${item.value} (${item.count})`).join(' · ') : 'No mistakes recorded'}</strong><small>From closed trades in this filter</small></article><article><span>Emotional State → Outcome</span><strong>{emotionalStats.length ? emotionalStats.map((item) => `${item.value}: ${item.winRate.toFixed(1)}% win`).join(' · ') : 'No emotional audit values'}</strong><small>{emotionalStats.length ? emotionalStats.map((item) => <span key={item.value}>{item.value} <ResultAmount value={item.averagePnl} currency={settings.account.baseCurrency} /> avg · </span>) : 'Add emotional audit to a trade'}</small></article></div>
        <section className="analytics-session-panel"><header><h2>Execution Quality</h2></header>{entryQualityStats.length ? <div className="analytics-strategy-table"><div className="table-head"><span>ENTRY QUALITY</span><span>TRADES</span><span>WIN RATE</span><span>AVG PNL</span></div>{entryQualityStats.map((item) => <div key={item.value}><strong>{item.value}</strong><span>{item.count}</span><span>{item.winRate.toFixed(1)}%</span><ResultAmount value={item.averagePnl} currency={settings.account.baseCurrency} /></div>)}</div> : <div className="analytics-empty-chart">No entry quality values recorded</div>}</section>
        <section className="analytics-session-panel"><header><h2>EXIT TYPE PERFORMANCE ANALYTICS</h2></header>{exitReasonStats.length ? <div className="analytics-strategy-table"><div className="table-head"><span>OUTCOME PATH</span><span>OCCURRENCE RATE</span><span>REALIZED IMPACT</span></div>{exitReasonStats.map((item) => <div key={item.value}><strong>{item.value.toUpperCase()}</strong><span>{stats.validCount ? `${((item.count / stats.validCount) * 100).toFixed(1)}%` : '0%'}</span><ResultAmount value={item.pnl} currency={settings.account.baseCurrency} /></div>)}</div> : <div className="analytics-empty-chart">No exit reason values recorded</div>}</section>
        <article className="analytics-behavior-chart"><header><h2>Planned vs Actual RRR</h2><span>{averageActualR === null ? 'N/A' : `${averageActualR.toFixed(2)}R average`}</span></header><div className="analytics-empty-chart">{averageActualR === null ? 'Add Stop Loss to closed trades to calculate realized R' : `${actualRMultiples.length} trades with valid risk data`}</div></article>
      </section>}

          {activeTab === 'progress' && <section className="analytics-detail-view">
        <div className="analytics-detail-cards behavior-metrics">{[
          ['REVIEWS DONE', `${reviewedCount}/${stats.validCount}`, stats.validCount ? `${((reviewedCount / stats.validCount) * 100).toFixed(1)}% of closed trades have notes or lessons` : 'No closed trade data'],
          ['GREAT SETUPS', setupGrades.length ? `${ratedGreatRate.toFixed(1)}%` : 'N/A', `${greatTrades} of ${setupGrades.length} rated trades`],
          ['POOR SETUPS', setupGrades.length ? `${ratedPoorRate.toFixed(1)}%` : 'N/A', `${poorTrades} of ${setupGrades.length} rated trades`],
        ].map(([label, value, detail]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}</div>
        <div className="analytics-chart-grid behavior-charts"><article className="analytics-chart-card"><header><span><Icon name="chart" /></span><h2>Monthly Realized P&amp;L</h2></header>{monthlyStats.length ? <svg viewBox="0 0 620 220" role="img" aria-label="Monthly realized PnL"><g className="analytics-grid-lines">{[30, 70, 110, 150, 190].map((y) => <line key={y} x1="48" x2="600" y1={y} y2={y} />)}</g><polyline points={chartPoints(monthlyStats.map((item) => item.pnl), 48, 600, 30, 190)} fill="none" stroke={monthlyStats[monthlyStats.length - 1].pnl < 0 ? '#ef4444' : '#10b981'} strokeWidth="2" /></svg> : <div className="analytics-empty-chart">No closed trades in this range</div>}</article><article className="analytics-chart-card"><header><span><Icon name="chart" /></span><h2>Plan Adherence by Month</h2></header>{monthlyAdherence.length ? <svg viewBox="0 0 620 220" role="img" aria-label="Plan adherence by month"><g className="analytics-grid-lines">{[30, 70, 110, 150, 190].map((y) => <line key={y} x1="48" x2="600" y1={y} y2={y} />)}</g><polyline points={chartPoints(monthlyAdherence, 48, 600, 30, 190)} fill="none" stroke="#60a5fa" strokeWidth="2" /></svg> : <div className="analytics-empty-chart">No Followed Plan values recorded</div>}</article></div>
        <div className="analytics-detail-cards behavior-metrics">{[
          ['CURRENT WIN RATE', `${stats.winRate.toFixed(1)}%`, `${stats.wins} wins · ${stats.losses} losses · ${stats.breakeven} breakeven`],
          ['LEARNING NOTES', String(lessonsCount), 'Closed trades with a Lesson Learned value'],
          ['REVISITED PATTERN', mistakeStats[0]?.value ?? 'No mistakes recorded', mistakeStats[0] ? `${mistakeStats[0].count} occurrence(s)` : 'No mistake type data'],
          ['REVIEW COVERAGE', stats.validCount ? `${((reviewedCount / stats.validCount) * 100).toFixed(1)}%` : 'N/A', 'Trades with notes or lessons'],
        ].map(([label, value, detail]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}</div>
        <div className="analytics-chart-grid behavior-charts">{[
          { title: 'Cumulative PnL', values: equityCurve.map((row) => row.equity) },
          { title: 'Drawdown', values: drawdownSeries },
          { title: 'Rolling Win Rate', values: rollingWinRate },
        ].map(({ title, values }) => <article className="analytics-chart-card" key={title}><header><span><Icon name="chart" /></span><h2>{title}</h2></header>{values.length ? <svg viewBox="0 0 620 180" role="img" aria-label={`${title} progress chart`}><g className="analytics-grid-lines">{[30, 60, 90, 120, 150].map((y) => <line key={y} x1="32" x2="600" y1={y} y2={y} />)}</g><polyline points={chartPoints(values, 32, 600, 30, 150)} fill="none" stroke={values[values.length - 1] < 0 ? '#ef4444' : '#a78bfa'} strokeWidth="2" /></svg> : <div className="analytics-empty-chart">No closed trades for these filters</div>}</article>)}</div>
        <section className="knowledge-panel"><h2>KNOWLEDGE COMPOUND EFFECT</h2><p>{lessonsCount ? `${lessonsCount} LESSON(S) RECORDED` : 'NO LESSONS TAGGED YET'}</p><span>{lessonsCount ? 'Learning insights are based on saved trade lessons.' : 'Add Lesson Learned values to track insights.'}</span></section>
      </section>}
    </div>
  )
}

function SettingsView({ settings, accounts, selectedAccount, onSelectAccount, onSave, onRenameAccount, onRemoveAccount, onRequestAddAccount }: { settings: AppSettings; accounts: (TradingAccountSettings & { tradeCount: number })[]; selectedAccount: string; onSelectAccount: (account: string) => void; onSave: (settings: AppSettings) => void; onRenameAccount: (id: string, name: string) => string | null; onRemoveAccount: (id: string) => string | null; onRequestAddAccount: () => void }) {
  const [section, setSection] = useState<'profile' | 'account'>('profile')
  const [draft, setDraft] = useState<AppSettings>({ ...settings, accounts })
  const [editingProfile, setEditingProfile] = useState(false)
  const [movementType, setMovementType] = useState<CashMovement['type'] | null>(null)
  const [movementDate, setMovementDate] = useState(() => localDateKey(new Date()))
  const [movementAmount, setMovementAmount] = useState('')
  const [movementNote, setMovementNote] = useState('')
  const [message, setMessage] = useState('')
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [accountNameDraft, setAccountNameDraft] = useState('')
  const [accountError, setAccountError] = useState('')
  const backupFileRef = useRef<HTMLInputElement>(null)
  const activeAccountName = selectedAccount === 'All Accounts' ? accounts[0]?.name ?? '' : selectedAccount
  const activeAccount = draft.accounts.find((item) => item.name === activeAccountName) ?? accounts.find((item) => item.name === activeAccountName)

  const updateProfile = <K extends keyof AppSettings['profile']>(field: K, value: AppSettings['profile'][K]) => {
    setDraft((previous) => ({ ...previous, profile: { ...previous.profile, [field]: value } }))
  }
  const updateAccount = <K extends Exclude<keyof TradingAccountSettings, 'id' | 'name'>>(field: K, value: TradingAccountSettings[K]) => {
    if (!activeAccount) return
    setDraft((previous) => {
      const update = (item: TradingAccountSettings) => {
        const next = { ...item, [field]: value }
        if (field === 'balance' || field === 'balanceType') next.balanceAsOf = next.balanceType === 'current' ? new Date().toISOString() : null
        return next
      }
      const exists = previous.accounts.some((item) => item.id === activeAccount.id)
      return { ...previous, accounts: exists ? previous.accounts.map((item) => item.id === activeAccount.id ? update(item) : item) : [...previous.accounts, update(activeAccount)] }
    })
  }
  const updateDisplay = <K extends keyof AppSettings['account']>(field: K, value: AppSettings['account'][K]) => {
    setDraft((previous) => ({ ...previous, account: { ...previous.account, [field]: value } }))
  }
  const save = () => {
    onSave(draft)
    setMessage('Changes saved')
  }
  const addMovement = () => {
    const amount = Number(movementAmount)
    if (!activeAccount || !movementType || !Number.isFinite(amount) || amount <= 0 || !movementDate) return
    const movement: CashMovement = {
      id: `movement-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
      date: movementDate,
      type: movementType,
      amount,
      note: movementNote.trim(),
      createdAt: new Date().toISOString(),
    }
    updateAccount('cashMovements', [...activeAccount.cashMovements, movement].sort((left, right) => left.date.localeCompare(right.date)))
    setMovementAmount('')
    setMovementNote('')
    setMovementType(null)
  }
  const saveAccountName = (id: string) => {
    const error = onRenameAccount(id, accountNameDraft)
    if (error) {
      setAccountError(error)
      return
    }
    setEditingAccountId(null)
    setAccountError('')
    setDraft((previous) => ({ ...previous, accounts: previous.accounts.map((account) => account.id === id ? { ...account, name: accountNameDraft.trim() } : account) }))
  }
  const removeAccountFromDraft = (id: string) => {
    const error = onRemoveAccount(id)
    setAccountError(error ?? '')
    if (!error) setDraft((previous) => ({ ...previous, accounts: previous.accounts.filter((account) => account.id !== id) }))
  }
  const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: draft.account.baseCurrency, maximumFractionDigits: 2 }).format(amount)
  const profileName = [draft.profile.firstName, draft.profile.lastName].filter(Boolean).join(' ') || draft.profile.username || 'Trader'
  const currencyOptions = [['USD', 'USD - $'], ['EUR', 'EUR - €'], ['INR', 'INR - ₹'], ['IDR', 'IDR - Rp']]
  const downloadBackup = () => {
    const backup = createJournalBackup(window.localStorage)
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `journal-trader-backup-${localDateKey(new Date())}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage('Backup downloaded')
  }
  const restoreBackup = async (file: File | undefined) => {
    if (!file) return
    try {
      const backup: unknown = JSON.parse(await file.text())
      if (!window.confirm('Restoring this backup replaces all journal data in this browser. Continue?')) return
      restoreJournalBackup(backup, window.localStorage)
      window.location.reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not restore this backup')
    }
  }

  return <div className="settings-page">
    <aside className="settings-section-list" aria-label="Settings sections">
      <button type="button" className={section === 'profile' ? 'selected' : ''} onClick={() => setSection('profile')}><span className="settings-section-icon">◎</span><span><strong>Profile</strong><small>Personal information &amp; contact</small></span><b>›</b></button>
      <button type="button" className={section === 'account' ? 'selected' : ''} onClick={() => setSection('account')}><span className="settings-section-icon">▣</span><span><strong>Account</strong><small>Balance, goals &amp; display</small></span><b>›</b></button>
    </aside>

    <section className="settings-panel">
      <header className="settings-panel-header"><div><h2>{section === 'profile' ? 'Profile' : 'Account'}</h2><p>{section === 'profile' ? 'Manage your personal information and contact details.' : 'Balance, goals, and display formatting.'}</p></div><div>{message && <span className="settings-save-message" role="status">{message}</span>}<button type="button" className="settings-save-button" onClick={save}>Save Changes</button></div></header>

      {section === 'profile' ? <div className="settings-profile-content">
        <div className="settings-profile-hero"><div className="settings-avatar">{profileName.slice(0, 1).toUpperCase()}</div><div><h3>{profileName}</h3><span>@{draft.profile.username || 'username'}</span></div><button type="button" onClick={() => { setEditingProfile(!editingProfile); setMessage('') }}>{editingProfile ? 'Done editing' : 'Edit Profile'}</button></div>
        <div className="settings-profile-columns">
          <section><h3>Personal details</h3><div className="settings-detail-list">
            {([['First name', 'firstName'], ['Last name', 'lastName'], ['Email address', 'email']] as const).map(([label, field]) => <label key={field}><span>{label}</span>{editingProfile ? <input type={field === 'email' ? 'email' : 'text'} value={draft.profile[field]} onChange={(event) => updateProfile(field, event.target.value)} /> : <strong>{draft.profile[field] || 'Not set'}</strong>}</label>)}
          </div></section>
          <section><h3>Contact &amp; reach</h3><div className="settings-detail-list">
            {([['Username', 'username'], ['Phone number', 'phone']] as const).map(([label, field]) => <label key={field}><span>{label}</span>{editingProfile ? <input type="text" value={draft.profile[field]} onChange={(event) => updateProfile(field, event.target.value)} /> : <strong>{draft.profile[field] || 'Not set'}</strong>}</label>)}
          </div></section>
        </div>
        <section className="settings-about-section"><h3>About you</h3><label className="settings-about-field"><span>About you</span>{editingProfile ? <textarea value={draft.profile.about} maxLength={500} onChange={(event) => updateProfile('about', event.target.value)} placeholder="Add a short profile description" /> : <p>{draft.profile.about || 'No description yet.'}</p>}</label></section>
        <section className="settings-backup-section"><h3>Journal data</h3><p>Backups stay on your device. Restore a backup to move your journal to another browser or public link.</p><div><button type="button" className="settings-action-button" onClick={downloadBackup}>Download backup</button><button type="button" className="settings-action-button secondary" onClick={() => backupFileRef.current?.click()}>Restore backup</button><input ref={backupFileRef} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void restoreBackup(file) }} /></div></section>
      </div> : <div className="settings-account-content">
        <label className="settings-account-picker"><span>Selected account</span><select value={activeAccountName} onChange={(event) => onSelectAccount(event.target.value)} disabled={!accounts.length}>{accounts.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
        {!activeAccount && <div className="settings-no-account"><strong>No accounts yet</strong><span>Add an account before configuring its balance or logging trades.</span><button type="button" className="settings-action-button" onClick={onRequestAddAccount}>＋ Add Account</button></div>}
        <section className="settings-account-section"><h3>Account balance</h3><div className="settings-balance-row"><label className="settings-input-field"><span>{activeAccount?.balanceType === 'current' ? 'Current balance' : 'Starting balance'}</span><input type="number" min="0" step="any" disabled={!activeAccount} value={activeAccount?.balance || ''} onChange={(event) => updateAccount('balance', Number(event.target.value) || 0)} /></label><div className="settings-segment-field"><span>Balance type</span><div role="group" aria-label="Balance type"><button type="button" disabled={!activeAccount} aria-pressed={activeAccount?.balanceType === 'starting'} className={activeAccount?.balanceType === 'starting' ? 'selected' : ''} onClick={() => updateAccount('balanceType', 'starting')}>Starting</button><button type="button" disabled={!activeAccount} aria-pressed={activeAccount?.balanceType === 'current'} className={activeAccount?.balanceType === 'current' ? 'selected' : ''} onClick={() => updateAccount('balanceType', 'current')}>Current</button></div></div></div><small className="settings-hint">{activeAccount?.balanceType === 'current' ? 'Used as this account’s current equity baseline.' : 'Used as this account’s baseline for its equity curve.'}</small></section>

        <section className="settings-account-section"><header className="settings-section-heading"><div><h3>Cash movements</h3><p>Deposits and withdrawals update this account’s equity on their date.</p></div><div><button type="button" className="settings-action-button" disabled={!activeAccount} onClick={() => setMovementType('deposit')}>＋ Deposit</button><button type="button" className="settings-action-button secondary" disabled={!activeAccount} onClick={() => setMovementType('withdrawal')}>− Withdrawal</button></div></header>
          {movementType && <div className="settings-movement-form"><label><span>Date</span><input type="date" value={movementDate} onChange={(event) => setMovementDate(event.target.value)} /></label><label><span>Amount</span><input type="number" min="0.01" step="any" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} /></label><label className="settings-movement-note"><span>Note</span><input value={movementNote} onChange={(event) => setMovementNote(event.target.value)} placeholder="Optional" /></label><button type="button" disabled={!activeAccount || !Number(movementAmount)} onClick={addMovement}>Add {movementType}</button><button type="button" className="settings-cancel-button" onClick={() => setMovementType(null)}>Cancel</button></div>}
          <div className="settings-movements-table"><div className="settings-table-head"><span>Date</span><span>Movement</span><span>Note</span><span>Amount</span><span /></div>{activeAccount?.cashMovements.length ? [...activeAccount.cashMovements].reverse().map((movement) => <div className="settings-table-row" key={movement.id}><span>{movement.date}</span><span>{movement.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</span><span>{movement.note || '—'}</span><strong className={movement.type === 'deposit' ? 'positive' : 'negative'}>{movement.type === 'deposit' ? '+' : '−'}{formatMoney(movement.amount)}</strong><button type="button" aria-label={`Remove ${movement.type}`} onClick={() => updateAccount('cashMovements', activeAccount.cashMovements.filter((item) => item.id !== movement.id))}>×</button></div>) : <div className="settings-movements-empty">No cash movements for this account</div>}</div>
        </section>

        <section className="settings-account-section"><header className="settings-section-heading"><div><h3>Trading accounts</h3><p>Rename accounts here. Accounts with trades cannot be removed.</p></div><button type="button" className="settings-action-button" onClick={onRequestAddAccount}>＋ Add Account</button></header>
          <div className="settings-managed-accounts">{accounts.length ? accounts.map((item) => <div className="settings-managed-account" key={item.id}><div><strong>{item.name}</strong><small>{item.tradeCount} {item.tradeCount === 1 ? 'trade' : 'trades'}</small></div>{editingAccountId === item.id ? <div className="settings-account-edit"><input aria-label={`Rename ${item.name}`} value={accountNameDraft} onChange={(event) => { setAccountNameDraft(event.target.value); setAccountError('') }} maxLength={40} /><button type="button" onClick={() => saveAccountName(item.id)}>Save</button><button type="button" className="settings-cancel-button" onClick={() => setEditingAccountId(null)}>Cancel</button></div> : <div className="settings-account-actions"><button type="button" onClick={() => { setEditingAccountId(item.id); setAccountNameDraft(item.name); setAccountError('') }}>Rename</button><button type="button" disabled={item.tradeCount > 0} title={item.tradeCount > 0 ? 'Move its trades before removing this account.' : 'Remove account'} onClick={() => removeAccountFromDraft(item.id)}>Remove</button></div>}</div>) : <div className="settings-movements-empty">No accounts yet. Add one to start logging trades.</div>}</div>
          {accountError && <p className="settings-account-error" role="alert">{accountError}</p>}
        </section>

        <section className="settings-account-section"><h3>Profit targets</h3><div className="settings-number-grid"><label><span>Weekly target</span><input type="number" min="0" step="any" disabled={!activeAccount} value={activeAccount?.weeklyTarget || ''} onChange={(event) => updateAccount('weeklyTarget', Number(event.target.value) || 0)} /></label><label><span>Monthly target</span><input type="number" min="0" step="any" disabled={!activeAccount} value={activeAccount?.monthlyTarget || ''} onChange={(event) => updateAccount('monthlyTarget', Number(event.target.value) || 0)} /></label></div></section>

        <section className="settings-account-section"><h3>Performance</h3><div className="settings-number-grid three"><label><span>Win rate target (%)</span><input type="number" min="0" max="100" step="any" disabled={!activeAccount} value={activeAccount?.targetWinRate || ''} onChange={(event) => updateAccount('targetWinRate', Math.min(100, Number(event.target.value) || 0))} /></label><label><span>Max drawdown (%)</span><input type="number" min="0" max="100" step="any" disabled={!activeAccount} value={activeAccount?.maxDrawdown || ''} onChange={(event) => updateAccount('maxDrawdown', Math.min(100, Number(event.target.value) || 0))} /></label><label><span>Risk / reward target</span><input type="number" min="0" step="0.1" disabled={!activeAccount} value={activeAccount?.targetRiskReward || ''} onChange={(event) => updateAccount('targetRiskReward', Number(event.target.value) || 0)} /></label></div></section>

        <section className="settings-account-section"><h3>Display formatting</h3><div className="settings-number-grid two"><label><span>Timezone</span><select value={draft.account.timezone} onChange={(event) => updateDisplay('timezone', event.target.value)}><option value="Asia/Jakarta">Western Indonesia Time (Jakarta)</option><option value="UTC">UTC</option><option value="America/New_York">Eastern Time (New York)</option><option value="Europe/London">London</option></select></label><label><span>Base currency</span><select value={draft.account.baseCurrency} onChange={(event) => updateDisplay('baseCurrency', event.target.value as AppSettings['account']['baseCurrency'])}>{currencyOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small className="settings-hint">Changes display format only; no exchange-rate conversion is applied.</small></label><label><span>Date format</span><select value={draft.account.dateFormat} onChange={(event) => updateDisplay('dateFormat', event.target.value as AppSettings['account']['dateFormat'])}><option>MM/DD/YYYY</option><option>DD/MM/YYYY</option><option>YYYY-MM-DD</option></select></label><label><span>Time format</span><select value={draft.account.timeFormat} onChange={(event) => updateDisplay('timeFormat', event.target.value as AppSettings['account']['timeFormat'])}><option>12-hour</option><option>24-hour</option></select></label></div></section>
      </div>}
    </section>
  </div>
}

function AddAccountDialog({ existingNames, onAdd, onClose }: { existingNames: string[]; onAdd: (name: string) => string | null; onClose: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter an account name.')
      return
    }
    const duplicate = existingNames.some((existing) => existing.toLocaleLowerCase() === trimmed.toLocaleLowerCase())
    if (duplicate) {
      setError('An account with this name already exists.')
      return
    }
    const addError = onAdd(trimmed)
    if (addError) setError(addError)
  }

  return <div className="settings-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <form className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="add-account-title" onSubmit={submit}>
      <header><h2 id="add-account-title">Add Account</h2><button type="button" aria-label="Close" onClick={onClose}>×</button></header>
      <label><span>Account name</span><input autoFocus autoComplete="off" value={name} onChange={(event) => { setName(event.target.value); setError('') }} placeholder="e.g. Swing account" maxLength={40} /></label>
      {error && <p role="alert">{error}</p>}
      <footer><button type="button" className="settings-cancel-button" onClick={onClose}>Cancel</button><button type="submit">Add Account</button></footer>
    </form>
  </div>
}

function App() {
  const [activeView, setActiveView] = useState<View>(getInitialView)
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('performance')
  const [analyticsExpanded, setAnalyticsExpanded] = useState(getInitialView() === 'analytics')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [openHeaderMenu, setOpenHeaderMenu] = useState<'currency' | 'account' | 'notifications' | null>(null)
  const [appSettings, setAppSettings] = useState<AppSettings>(() => getStoredAppSettings())
  const [currency, setCurrency] = useState(() => getStoredAppSettings().account.baseCurrency)
  const [selectedAccount, setSelectedAccount] = useState('All Accounts')
  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [darkTheme, setDarkTheme] = useState(true)
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null)
  const [savedTrades, setSavedTrades] = useState<TradeRecord[]>(() => getStoredTrades())
  const [tradeScreenshots, setTradeScreenshots] = useState<TradeScreenshot[]>(() => getStoredScreenshots())
  const [noTradeReasons, setNoTradeReasons] = useState<Record<string, string>>(() => getStoredNoTradeReasons())
  const [noTradeDialogDate, setNoTradeDialogDate] = useState<string | null>(null)
  const [pendingTradeDate, setPendingTradeDate] = useState<string | null>(null)
  const [customSymbols, setCustomSymbols] = useState<SymbolRecord[]>(() => getStoredCustomSymbols())
  const [symbolFavorites, setSymbolFavorites] = useState<Set<string>>(() => new Set(getStoredSymbolFavorites()))
  const [enabledTradeFields, setEnabledTradeFields] = useState<Set<string>>(() => {
    const fields = new Set((getStoredEnabledFields() ?? DEFAULT_ENABLED_FIELDS).map((field) => field === 'Entry date & time' ? 'Exit date & time' : field))
    if (fields.has('Risk / reward')) fields.add('Stop loss')
    return fields
  })

  useEffect(() => {
    saveStoredTrades(savedTrades)
  }, [savedTrades])

  useEffect(() => {
    saveStoredAppSettings(appSettings)
  }, [appSettings])

  useEffect(() => {
    saveStoredScreenshots(tradeScreenshots)
  }, [tradeScreenshots])

  useEffect(() => {
    saveStoredNoTradeReasons(noTradeReasons)
  }, [noTradeReasons])

  useEffect(() => {
    saveStoredCustomSymbols(customSymbols)
  }, [customSymbols])

  useEffect(() => {
    saveStoredSymbolFavorites([...symbolFavorites])
  }, [symbolFavorites])

  useEffect(() => {
    saveStoredEnabledFields([...enabledTradeFields])
  }, [enabledTradeFields])

  useEffect(() => {
    const syncHash = () => {
      const nextView = getInitialView()
      setActiveView(nextView)
      if (nextView === 'analytics') setAnalyticsExpanded(true)
    }

    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  const changeView = (next: View) => {
    if (next !== 'trade-logging') setPendingTradeDate(null)
    setActiveView(next)
    window.history.pushState(null, '', `#${next}`)
  }

  const addTradeForDate = (date: string) => {
    setPendingTradeDate(date)
    setEditingTradeId(null)
    changeView('trade-logging')
  }

  const saveNoTradeReason = (date: string, reason: string) => {
    setNoTradeReasons((previous) => {
      const next = { ...previous }
      if (reason.trim()) next[date] = reason.trim()
      else delete next[date]
      return next
    })
    setNoTradeDialogDate(null)
  }

  const saveSettings = (next: AppSettings) => {
    const nextAccountsById = new Map(next.accounts.map((item) => [item.id, item]))
    const mergedAccounts = [
      ...appSettings.accounts.map((current) => ({ ...current, ...(nextAccountsById.get(current.id) ?? {}) })),
      ...next.accounts.filter((item) => !appSettings.accounts.some((current) => current.id === item.id)),
    ]
    const normalized = { ...next, accounts: mergedAccounts, account: { ...next.account, balanceAsOf: next.account.balanceType === 'starting' ? null : next.account.balanceAsOf } }
    setAppSettings(normalized)
    setCurrency(normalized.account.baseCurrency)
  }

  const openTradeForEdit = (tradeId: string) => {
    setEditingTradeId(tradeId)
    changeView('trade-logging')
  }

  const toggleSymbolFavorite = (identity: string) => {
    setSymbolFavorites((previous) => {
      const next = new Set(previous)
      if (next.has(identity)) next.delete(identity)
      else next.add(identity)
      return next
    })
  }

  const addCustomSymbol = (newSymbol: SymbolRecord): string | null => {
    const identity = getSymbolIdentity(newSymbol)
    if ([...BUILT_IN_SYMBOLS, ...customSymbols].some((item) => getSymbolIdentity(item) === identity)) return 'Symbol dengan ticker, exchange, dan market type ini sudah tersedia.'
    setCustomSymbols((previous) => [...previous, newSymbol])
    return null
  }

  const removeCustomSymbol = (identity: string) => {
    setCustomSymbols((previous) => previous.filter((item) => getSymbolIdentity(item) !== identity))
    setSymbolFavorites((previous) => { const next = new Set(previous); next.delete(identity); return next })
  }

  const accountRegistry = new Map<string, TradingAccountSettings>()
  appSettings.accounts.forEach((item) => accountRegistry.set(item.name.toLocaleLowerCase(), item))
  const legacyAccountSettings = getLegacyTradingAccountSettings(appSettings)
  savedTrades.forEach((trade) => {
    const name = getTradeAccountName(trade)
    const key = name.toLocaleLowerCase()
    if (!accountRegistry.has(key)) accountRegistry.set(key, { id: `imported-${encodeURIComponent(key)}`, name, ...(appSettings.accounts.length ? DEFAULT_TRADING_ACCOUNT : legacyAccountSettings) })
  })
  const accountEntries = [...accountRegistry.values()].map((item) => ({
    ...item,
    tradeCount: savedTrades.filter((trade) => getTradeAccountName(trade) === item.name).length,
  }))
  const accountOptions = accountEntries.map((item) => item.name)
  const tradeBeingEdited = savedTrades.find((trade) => trade.id === editingTradeId) ?? null
  const existingScreenshots = tradeScreenshots.filter((screenshot) => !savedTrades.some((trade) => trade.id !== editingTradeId && trade.screenshotIds?.includes(screenshot.id)) && !tradeBeingEdited?.screenshotIds?.includes(screenshot.id))
  const addAccount = (name: string): string | null => {
    if (accountOptions.some((existing) => existing.toLocaleLowerCase() === name.toLocaleLowerCase())) return 'An account with this name already exists.'
    const id = `account-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
    setAppSettings((previous) => ({ ...previous, accounts: [...previous.accounts, { id, name, ...(previous.accounts.length ? DEFAULT_TRADING_ACCOUNT : getLegacyTradingAccountSettings(previous)) }] }))
    setSelectedAccount(name)
    setAddAccountOpen(false)
    return null
  }
  const renameAccount = (id: string, value: string): string | null => {
    const name = value.trim()
    if (!name) return 'Enter an account name.'
    const current = accountEntries.find((item) => item.id === id)
    if (!current) return 'This account is no longer available.'
    if (accountEntries.some((item) => item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return 'An account with this name already exists.'
    setAppSettings((previous) => ({ ...previous, accounts: previous.accounts.some((item) => item.id === id)
      ? previous.accounts.map((item) => item.id === id ? { ...item, name } : item)
      : [...previous.accounts, { id: `account-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`, name, ...DEFAULT_TRADING_ACCOUNT }] }))
    setSavedTrades((previous) => previous.map((trade) => getTradeAccountName(trade) === current.name ? { ...trade, account: name } : trade))
    if (selectedAccount === current.name) setSelectedAccount(name)
    return null
  }
  const removeAccount = (id: string): string | null => {
    const current = accountEntries.find((item) => item.id === id)
    if (!current) return 'This account is no longer available.'
    if (current.tradeCount > 0) return 'Move or delete its trades before removing this account.'
    setAppSettings((previous) => ({ ...previous, accounts: previous.accounts.filter((item) => item.id !== id) }))
    if (selectedAccount === current.name) setSelectedAccount('All Accounts')
    return null
  }

  return (
    <div className={`dashboard-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${darkTheme ? '' : 'light-mode'}`}>
      <aside className="sidebar">
        <div className="brand-row">
          <div className="logo-mark"><img src="/trading-journal-logo.svg" alt="" /></div>
          <div className="brand-copy">
            <strong>Traders Journal</strong>
          </div>
        </div>

        <button className="primary-button" type="button" onClick={() => changeView('trade-logging')}>
          <Icon name="plus" />
          <span>Add Trade</span>
        </button>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {menuItems.map((item) => (
            <div key={item.id} className="nav-group">
              <button type="button" className={`nav-button ${activeView === item.id || (item.id === 'dashboard' && activeView === 'calendar') ? 'active' : ''}`} onClick={() => { if (item.id === 'analytics') { setAnalyticsExpanded(true); changeView('analytics') } else changeView(item.id) }}>
                <span className="nav-icon"><Icon name={item.id === 'dashboard' ? 'dashboard' : item.id === 'trade-logging' ? 'journal' : item.id === 'daily-journal' ? 'calendar' : 'chart'} /></span>
                <span>{item.label}</span>
                {item.hasChevron && <Icon name="chevron" />}
              </button>
              {item.id === 'dashboard' && (activeView === 'dashboard' || activeView === 'calendar') && <div className="nested-menu"><button type="button" className={`nested-link ${activeView === 'calendar' ? 'active' : ''}`} onClick={() => changeView('calendar')}>Calendar</button></div>}
              {item.id === 'analytics' && analyticsExpanded && <div className="nested-menu">{([['performance', 'Performance'], ['edge', 'Edge Analysis'], ['behavior', 'Behavior'], ['progress', 'Progress']] as const).map(([tab, label]) => <button key={tab} type="button" className={`nested-link ${activeView === 'analytics' && analyticsTab === tab ? 'active' : ''}`} onClick={() => { setAnalyticsExpanded(true); if (activeView !== 'analytics') changeView('analytics'); setAnalyticsTab(tab) }}>{label}</button>)}</div>}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className={`ghost-button ${activeView === 'settings' ? 'active' : ''}`} onClick={() => changeView('settings')}>
            <Icon name="settings" />
            <span>Settings</span>
          </button>
        </div>

      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="square-button" aria-label="Toggle Sidebar" aria-pressed={sidebarCollapsed} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
              <Icon name="grid" />
            </button>
            <h1>{pages[activeView]}</h1>
          </div>

          <div className="topbar-actions">
            <div className="header-menu-wrap"><button type="button" className="small-select" aria-expanded={openHeaderMenu === 'currency'} onClick={() => setOpenHeaderMenu(openHeaderMenu === 'currency' ? null : 'currency')}><span className="currency">{currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'INR' ? '₹' : 'Rp'}</span><Icon name="chevron" /></button>{openHeaderMenu === 'currency' && <div className="header-menu" role="menu">{(['USD', 'EUR', 'INR', 'IDR'] as const).map((value) => <button key={value} type="button" role="menuitem" onClick={() => { setCurrency(value); setAppSettings((previous) => ({ ...previous, account: { ...previous.account, baseCurrency: value } })); setOpenHeaderMenu(null) }}>{value}</button>)}</div>}</div>
            <div className="header-menu-wrap"><button type="button" className="small-select account-select" aria-expanded={openHeaderMenu === 'account'} onClick={() => setOpenHeaderMenu(openHeaderMenu === 'account' ? null : 'account')}><span>{selectedAccount}</span><Icon name="chevron" /></button>{openHeaderMenu === 'account' && <div className="header-menu" role="menu"><button type="button" role="menuitem" onClick={() => { setSelectedAccount('All Accounts'); setOpenHeaderMenu(null) }}>All Accounts</button>{accountOptions.map((name) => <button key={name} type="button" role="menuitem" onClick={() => { setSelectedAccount(name); setOpenHeaderMenu(null) }}>{name}</button>)}<div className="header-menu-divider" /><button type="button" role="menuitem" onClick={() => { setAddAccountOpen(true); setOpenHeaderMenu(null) }}>＋ Add Account</button></div>}</div>
            <button type="button" className="icon-button" aria-label="Notifications" aria-expanded={openHeaderMenu === 'notifications'} onClick={() => setOpenHeaderMenu(openHeaderMenu === 'notifications' ? null : 'notifications')}>
              <Icon name="bell" />
            </button>
            {openHeaderMenu === 'notifications' && <div className="notification-popover">You&apos;re all caught up.</div>}
            <button type="button" className="icon-button" aria-label="Theme toggle" aria-pressed={!darkTheme} onClick={() => setDarkTheme(!darkTheme)}>
              <Icon name={darkTheme ? 'moon' : 'sun'} />
            </button>
          </div>
        </header>

        <main className="page-body">
          {activeView === 'dashboard' && <DashboardView onNavigate={changeView} onAddTradeForDate={addTradeForDate} onEditNoTradeReason={setNoTradeDialogDate} noTradeReasons={noTradeReasons} trades={savedTrades} settings={appSettings} accounts={accountOptions} accountSettings={accountEntries} selectedAccount={selectedAccount} onSelectAccount={setSelectedAccount} />}

          {activeView === 'calendar' && <CalendarView onNavigate={changeView} onAddTradeForDate={addTradeForDate} onEditNoTradeReason={setNoTradeDialogDate} noTradeReasons={noTradeReasons} trades={savedTrades} settings={appSettings} />}

          {activeView === 'trade-logging' && <TradeLoggingView screenshots={tradeScreenshots} existingScreenshots={existingScreenshots} setScreenshots={setTradeScreenshots} onTradeSaved={setSavedTrades} editingTrade={tradeBeingEdited} onEditingComplete={() => setEditingTradeId(null)} onTradeLogged={() => setPendingTradeDate(null)} initialTradeDate={pendingTradeDate} enabledFields={enabledTradeFields} setEnabledFields={setEnabledTradeFields} account={selectedAccount} accounts={accountOptions} customSymbols={customSymbols} symbolFavorites={symbolFavorites} onAddCustomSymbol={addCustomSymbol} onToggleSymbolFavorite={toggleSymbolFavorite} onRemoveCustomSymbol={removeCustomSymbol} />}

          {activeView === 'daily-journal' && <DailyJournalView onNavigate={changeView} screenshots={tradeScreenshots} trades={savedTrades} settings={appSettings} enabledFields={enabledTradeFields} onSelectForEdit={openTradeForEdit} onUpdateTrade={(updatedTrade) => setSavedTrades((previous) => previous.map((trade) => trade.id === updatedTrade.id ? updatedTrade : trade))} onDeleteTrade={(tradeId) => {
            const deletedScreenshotIds = new Set(savedTrades.find((trade) => trade.id === tradeId)?.screenshotIds ?? [])
            const retainedScreenshotIds = new Set(savedTrades.filter((trade) => trade.id !== tradeId).flatMap((trade) => trade.screenshotIds ?? []))
            setSavedTrades((previous) => previous.filter((trade) => trade.id !== tradeId))
            setTradeScreenshots((previous) => previous.filter((screenshot) => !deletedScreenshotIds.has(screenshot.id) || retainedScreenshotIds.has(screenshot.id)))
          }} catalogSymbols={[...BUILT_IN_SYMBOLS, ...customSymbols]} symbolFavorites={symbolFavorites} onAddCustomSymbol={addCustomSymbol} onToggleSymbolFavorite={toggleSymbolFavorite} onRemoveCustomSymbol={removeCustomSymbol} />}

          {activeView === 'analytics' && <AnalyticsView activeTab={analyticsTab} onTabChange={setAnalyticsTab} trades={savedTrades} settings={appSettings} accounts={accountOptions} accountSettings={accountEntries} selectedAccount={selectedAccount} onSelectAccount={setSelectedAccount} />}

          {activeView === 'settings' && <SettingsView settings={appSettings} accounts={accountEntries} selectedAccount={selectedAccount} onSelectAccount={setSelectedAccount} onSave={saveSettings} onRenameAccount={renameAccount} onRemoveAccount={removeAccount} onRequestAddAccount={() => setAddAccountOpen(true)} />}

        </main>
      </div>
      {addAccountOpen && <AddAccountDialog existingNames={accountOptions} onAdd={addAccount} onClose={() => setAddAccountOpen(false)} />}
      {noTradeDialogDate && <NoTradeReasonDialog date={noTradeDialogDate} dateFormat={appSettings.account.dateFormat} initialReason={noTradeReasons[noTradeDialogDate] ?? ''} onSave={(reason) => saveNoTradeReason(noTradeDialogDate, reason)} onClose={() => setNoTradeDialogDate(null)} />}
    </div>
  )
}

export default App
