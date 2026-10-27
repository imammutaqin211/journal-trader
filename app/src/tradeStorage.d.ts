import type { TradeRecord } from './tradeMetrics.js'
import type { SymbolRecord } from './symbolCatalog.js'

export function getStoredTrades(): TradeRecord[]
export function saveStoredTrades(trades: TradeRecord[]): boolean
export function getStoredScreenshots(): any[]
export function saveStoredScreenshots(screenshots: any[]): boolean
export function getStoredEnabledFields(): string[] | null
export function saveStoredEnabledFields(fields: string[]): boolean
export function getStoredSymbolFavorites(): string[]
export function saveStoredSymbolFavorites(favorites: string[]): boolean
export function getStoredCustomSymbols(): SymbolRecord[]
export function saveStoredCustomSymbols(symbols: SymbolRecord[]): boolean
export function getStoredNoTradeReasons(): Record<string, string>
export function saveStoredNoTradeReasons(reasons: Record<string, string>): boolean
