export interface ProfileSettings {
  firstName: string
  lastName: string
  username: string
  email: string
  phone: string
  about: string
}

export interface CashMovement {
  id: string
  date: string
  type: 'deposit' | 'withdrawal'
  amount: number
  note: string
  createdAt: string | null
}

export interface TradingAccountSettings extends Omit<AccountSettings, 'timezone' | 'baseCurrency' | 'dateFormat' | 'timeFormat'> {
  id: string
  name: string
}

export interface AccountSettings {
  balance: number
  balanceType: 'starting' | 'current'
  balanceAsOf: string | null
  cashMovements: CashMovement[]
  weeklyTarget: number
  monthlyTarget: number
  targetWinRate: number
  maxDrawdown: number
  targetRiskReward: number
  timezone: string
  baseCurrency: 'USD' | 'EUR' | 'INR' | 'IDR'
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
  timeFormat: '12-hour' | '24-hour'
}

export interface AppSettings {
  accounts: TradingAccountSettings[]
  profile: ProfileSettings
  account: AccountSettings
}

export const DEFAULT_APP_SETTINGS: AppSettings
export const DEFAULT_TRADING_ACCOUNT: Omit<TradingAccountSettings, 'id' | 'name'>
export function normalizeAppSettings(value: Partial<AppSettings>): AppSettings
export function getStoredAppSettings(): AppSettings
export function saveStoredAppSettings(settings: AppSettings): boolean
export type AccountEquitySettings = Pick<TradingAccountSettings, 'balance' | 'balanceType' | 'balanceAsOf' | 'cashMovements'>
export function getAccountEquity(trades: import('./tradeMetrics.js').TradeRecord[], account: AccountEquitySettings): number
export function getAccountEquityCurve(trades: import('./tradeMetrics.js').TradeRecord[], account: AccountEquitySettings): { date: string; equity: number }[]
export function combineAccountEquityCurves(curves: { date: string; equity: number }[][]): { date: string; equity: number }[]