export type SymbolCategory = 'Futures' | 'Stocks' | 'Forex' | 'Crypto' | 'Custom' | string
export type SymbolMarketType = 'equity' | 'spot' | 'futures' | 'perpetual' | 'custom' | string

export interface SymbolRecord {
  symbol: string
  name: string | null
  category: SymbolCategory
  subcategory: string | null
  exchange: string | null
  marketType: SymbolMarketType
  baseCurrency: string | null
  quoteCurrency: string | null
  tickSize: number | null
  tickValue: number | null
  contractMultiplier: number | null
  isFavorite: boolean
  isCustom: boolean
}

export interface CustomSymbolInput {
  [key: string]: unknown
  symbol?: unknown
}

export function getBuiltInSymbols(): SymbolRecord[]
export function getSymbolIdentity(symbol: Pick<SymbolRecord, 'symbol' | 'exchange' | 'marketType'>): string
export function normalizeCustomSymbol(input: CustomSymbolInput): SymbolRecord | null
export function normalizeSymbolRecord(input: Partial<SymbolRecord>): SymbolRecord | null
export function findSymbol(symbol: string, instrument: string, symbols?: SymbolRecord[]): SymbolRecord | null