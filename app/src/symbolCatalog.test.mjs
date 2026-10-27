import test from 'node:test'
import assert from 'node:assert/strict'
import { findSymbol, getBuiltInSymbols, getSymbolIdentity, normalizeCustomSymbol } from './symbolCatalog.js'

test('catalog includes all required market groups and exchange-qualified CME futures', () => {
  const symbols = getBuiltInSymbols()
  const tickers = new Set(symbols.map((item) => item.symbol))
  for (const ticker of ['NQ', 'NKD', 'SR3', '6E', 'AAPL', 'APP', 'EURUSD', 'USDIDR', 'BTCUSD', 'ETHUSDC']) assert.ok(tickers.has(ticker), ticker)
  const cmeBitcoin = symbols.find((item) => item.symbol === 'BTC' && item.exchange === 'CME' && item.marketType === 'futures')
  assert.equal(cmeBitcoin?.contractMultiplier, 5)
  assert.equal(cmeBitcoin?.baseCurrency, 'BTC')
  assert.equal(cmeBitcoin?.quoteCurrency, 'USD')
  assert.notEqual(getSymbolIdentity(symbols.find((item) => item.symbol === 'BTCUSD')), getSymbolIdentity(cmeBitcoin))
})

test('catalog contains the requested ticker sets without duplicate identities', () => {
  const symbols = getBuiltInSymbols()
  const byCategory = (category) => new Set(symbols.filter((item) => item.category === category).map((item) => item.symbol))
  const futures = byCategory('Futures')
  const stocks = byCategory('Stocks')
  const forex = byCategory('Forex')
  const crypto = byCategory('Crypto')
  const assertContains = (actual, expected) => expected.split(' ').forEach((ticker) => assert.ok(actual.has(ticker), ticker))

  assertContains(futures, 'NQ MNQ ES MES YM MYM RTY M2K NKD CL MCL NG QG RB HO BZ GC MGC SI SIL HG PL PA ZB UB ZN TN ZF ZT SR3 ZC ZS ZW ZM ZL LE HE GF KC SB CC CT OJ 6E M6E 6B 6J 6A 6C 6S 6N 6M MBT MET BTC ETH')
  assertContains(stocks, 'AAPL MSFT NVDA AMD AVGO INTC QCOM MU ARM TXN AMAT LRCX ORCL IBM CSCO CRM PLTR NOW SNOW PANW GOOGL GOOG META AMZN NFLX TSLA UBER ABNB SHOP SPOT DASH PINS SNAP RBLX APP JPM BAC WFC GS MS C BLK SCHW V MA PYPL COIN HOOD AXP WMT COST TGT HD LOW MCD SBUX NKE LULU TPR TJX CMG KO PEP PG LLY NVO JNJ MRK ABBV PFE UNH ISRG ABT TMO AMGN GILD REGN MRNA CAT DE GE HON BA RTX LMT XOM CVX COP SLB F GM UPS FDX')
  assertContains(forex, 'EURUSD GBPUSD USDJPY USDCHF USDCAD AUDUSD NZDUSD EURGBP EURJPY EURCHF EURCAD EURAUD EURNZD GBPJPY GBPCHF GBPCAD GBPAUD GBPNZD AUDJPY AUDCAD AUDCHF AUDNZD CADJPY CADCHF CHFJPY NZDJPY NZDCAD NZDCHF USDSGD USDHKD USDCNH USDINR USDKRW USDMXN USDZAR USDTRY USDSEK USDNOK USDDKK USDPLN USDTHB USDIDR')
  assertContains(crypto, 'BTCUSD ETHUSD SOLUSD XRPUSD BNBUSD ADAUSD DOGEUSD AVAXUSD LINKUSD DOTUSD LTCUSD BCHUSD SUIUSD TONUSD TRXUSD HBARUSD XLMUSD UNIUSD NEARUSD AAVEUSD BTCUSDT ETHUSDT SOLUSDT XRPUSDT BNBUSDT DOGEUSDT BTCUSDC ETHUSDC')
  assert.equal(new Set(symbols.map(getSymbolIdentity)).size, symbols.length)
})

test('custom symbols normalize identity and preserve unverified metadata as empty', () => {
  const custom = normalizeCustomSymbol({ symbol: 'xyz', category: 'Stocks', exchange: '' })
  assert.equal(custom.symbol, 'XYZ')
  assert.equal(custom.name, null)
  assert.equal(custom.exchange, null)
  assert.equal(custom.isCustom, true)
})

test('legacy ticker resolution respects market type when catalog has collisions', () => {
  const symbols = getBuiltInSymbols()
  assert.equal(findSymbol('BTC', 'Futures', symbols)?.exchange, 'CME')
  assert.equal(findSymbol('BTC', 'Crypto', symbols), null)
})