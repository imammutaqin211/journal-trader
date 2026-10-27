export interface TradeRecord {
  id: string
  symbol: string
  side: 'Long' | 'Short'
  instrument: string
  status: string
  account?: string
  entryPrice: number
  exitPrice: number
  shares: number
  multiplier?: number
  commission?: number
  actualPnl?: number
  takeProfit?: number
  stopLoss?: number
  strategy?: string
  notes: string
  pnl?: number
  screenshotIds?: string[]
  createdAt: string
  entryDateTime?: string
  exitDateTime?: string
  date?: string
  time?: string
  contracts?: string | number
  entry?: string | number
  exit?: string | number
  customFields?: Record<string, string | number | boolean>
  symbolMetadata?: import('./symbolCatalog.js').SymbolRecord | null
}

export interface RealizedTrade {
  trade: TradeRecord
  pnl: number
  date: string
}

export function createTradeId(): string
export function getTradeMultiplier(trade: Pick<TradeRecord, 'instrument' | 'symbol'> & Partial<Pick<TradeRecord, 'multiplier' | 'symbolMetadata'>>): number | null
export function getTradeCommission(trade: TradeRecord): number | null
export function getTradeNetPnl(trade: TradeRecord): number | null
export function getTradeRiskReward(trade: Pick<TradeRecord, 'entryPrice' | 'exitPrice'> & Partial<Pick<TradeRecord, 'stopLoss'>>): number | null
export function getTradeDate(trade: TradeRecord): string | null
export function getTradeTime(trade: TradeRecord): string | null
export function getRealizedTrades(trades: TradeRecord[]): RealizedTrade[]
export function getTradeStats(trades: TradeRecord[]): {
  closedCount: number
  validCount: number
  invalidCount: number
  wins: number
  losses: number
  breakeven: number
  winRate: number
  totalPnl: number
  grossProfit: number
  grossLoss: number
  profitFactor: number
  averagePnl: number
  averageWin: number
  averageLoss: number
  biggestWin: number
  biggestLoss: number
  maxDrawdown: number
  commissions: number
  realizedTrades: RealizedTrade[]
}
export function getEquityCurve(trades: TradeRecord[]): (RealizedTrade & { equity: number })[]
export function groupRealizedPnl(trades: TradeRecord[], period?: 'day' | 'month'): { date: string; pnl: number; count: number }[]
export function getPerformanceBy(trades: TradeRecord[], key: string): { value: string; count: number; wins: number; pnl: number; winRate: number; averagePnl: number }[]