const futuresGroups = [
  ['Futures', 'CME', [
    ['NQ', 'E-mini Nasdaq-100 Futures', 20], ['MNQ', 'Micro E-mini Nasdaq-100 Futures', 2],
    ['ES', 'E-mini S&P 500 Futures', 50], ['MES', 'Micro E-mini S&P 500 Futures', 5],
    ['YM', 'E-mini Dow ($5) Futures', 5], ['MYM', 'Micro E-mini Dow Jones Futures', 0.5],
    ['RTY', 'E-mini Russell 2000 Index Futures', 50], ['M2K', 'Micro E-mini Russell 2000 Index Futures', 5],
    ['NKD', 'Nikkei 225 USD Futures', null],
  ]],
  ['Futures', 'NYMEX', [
    ['CL', 'Light Sweet Crude Oil Futures', 1000], ['MCL', 'Micro WTI Crude Oil Futures', 100],
    ['NG', 'Henry Hub Natural Gas Futures', null], ['QG', 'E-mini Natural Gas Futures', null],
    ['RB', 'RBOB Gasoline Futures', null], ['HO', 'NY Harbor ULSD Futures', null], ['BZ', 'Brent Crude Oil Financial Futures', null],
  ]],
  ['Futures', 'COMEX', [
    ['GC', 'Gold Futures', 100], ['MGC', 'Micro Gold Futures', 10], ['SI', 'Silver Futures', null],
    ['SIL', 'Micro Silver Futures', null], ['HG', 'Copper Futures', null], ['PL', 'Platinum Futures', null], ['PA', 'Palladium Futures', null],
  ]],
  ['Futures', 'CBOT', [
    ['ZB', 'U.S. Treasury Bond Futures', null], ['UB', 'Ultra U.S. Treasury Bond Futures', null],
    ['ZN', '10-Year U.S. Treasury Note Futures', null], ['TN', 'Ultra 10-Year U.S. Treasury Note Futures', null],
    ['ZF', '5-Year U.S. Treasury Note Futures', null], ['ZT', '2-Year U.S. Treasury Note Futures', null],
  ]],
  ['Futures', 'CME', [['SR3', '3-Month SOFR Futures', null]]],
  ['Futures', 'CBOT', [
    ['ZC', 'Corn Futures', null], ['ZS', 'Soybean Futures', null], ['ZW', 'Chicago SRW Wheat Futures', null],
    ['ZM', 'Soybean Meal Futures', null], ['ZL', 'Soybean Oil Futures', null],
  ]],
  ['Futures', 'CME', [['LE', 'Live Cattle Futures', null], ['HE', 'Lean Hog Futures', null], ['GF', 'Feeder Cattle Futures', null]]],
  ['Futures', 'ICE US', [
    ['KC', 'Coffee C Futures', null], ['SB', 'Sugar No. 11 Futures', null], ['CC', 'Cocoa Futures', null],
    ['CT', 'Cotton No. 2 Futures', null], ['OJ', 'Frozen Concentrated Orange Juice Futures', null],
  ]],
  ['Futures', 'CME', [
    ['6E', 'Euro FX Futures', null], ['M6E', 'Micro EUR/USD Futures', null], ['6B', 'British Pound Futures', null],
    ['6J', 'Japanese Yen Futures', null], ['6A', 'Australian Dollar Futures', null], ['6C', 'Canadian Dollar Futures', null],
    ['6S', 'Swiss Franc Futures', null], ['6N', 'New Zealand Dollar Futures', null], ['6M', 'Mexican Peso Futures', null],
  ]],
  ['Futures', 'CME', [
    ['MBT', 'Micro Bitcoin Futures', 0.1], ['MET', 'Micro Ether Futures', 0.1],
    ['BTC', 'Bitcoin Futures', 5], ['ETH', 'Ether Futures', 50],
  ]],
]

const stockGroups = [
  ['Technology & Semiconductors', 'AAPL MSFT NVDA AMD AVGO INTC QCOM MU ARM TXN AMAT LRCX ORCL IBM CSCO CRM PLTR NOW SNOW PANW'],
  ['Internet & Communications', 'GOOGL GOOG META AMZN NFLX TSLA UBER ABNB SHOP SPOT DASH PINS SNAP RBLX APP'],
  ['Financials & Payments', 'JPM BAC WFC GS MS C BLK SCHW V MA PYPL COIN HOOD AXP'],
  ['Consumer, Retail & Restaurants', 'WMT COST TGT HD LOW MCD SBUX NKE LULU TPR TJX CMG KO PEP PG'],
  ['Healthcare & Pharmaceuticals', 'LLY NVO JNJ MRK ABBV PFE UNH ISRG ABT TMO AMGN GILD REGN MRNA'],
  ['Industrials, Energy & Transportation', 'CAT DE GE HON BA RTX LMT XOM CVX COP SLB F GM UPS FDX'],
]

const stockNames = {
  AAPL: 'Apple Inc.', MSFT: 'Microsoft Corporation', NVDA: 'NVIDIA Corporation', AMD: 'Advanced Micro Devices, Inc.', AVGO: 'Broadcom Inc.', INTC: 'Intel Corporation', QCOM: 'QUALCOMM Incorporated', MU: 'Micron Technology, Inc.', ARM: 'Arm Holdings plc', TXN: 'Texas Instruments Incorporated', AMAT: 'Applied Materials, Inc.', LRCX: 'Lam Research Corporation', ORCL: 'Oracle Corporation', IBM: 'International Business Machines Corporation', CSCO: 'Cisco Systems, Inc.', CRM: 'Salesforce, Inc.', PLTR: 'Palantir Technologies Inc.', NOW: 'ServiceNow, Inc.', SNOW: 'Snowflake Inc.', PANW: 'Palo Alto Networks, Inc.',
  GOOGL: 'Alphabet Inc. Class A', GOOG: 'Alphabet Inc. Class C', META: 'Meta Platforms, Inc.', AMZN: 'Amazon.com, Inc.', NFLX: 'Netflix, Inc.', TSLA: 'Tesla, Inc.', UBER: 'Uber Technologies, Inc.', ABNB: 'Airbnb, Inc.', SHOP: 'Shopify Inc.', SPOT: 'Spotify Technology S.A.', DASH: 'DoorDash, Inc.', PINS: 'Pinterest, Inc.', SNAP: 'Snap Inc.', RBLX: 'Roblox Corporation', APP: 'AppLovin Corporation',
  JPM: 'JPMorgan Chase & Co.', BAC: 'Bank of America Corporation', WFC: 'Wells Fargo & Company', GS: 'The Goldman Sachs Group, Inc.', MS: 'Morgan Stanley', C: 'Citigroup Inc.', BLK: 'BlackRock, Inc.', SCHW: 'The Charles Schwab Corporation', V: 'Visa Inc.', MA: 'Mastercard Incorporated', PYPL: 'PayPal Holdings, Inc.', COIN: 'Coinbase Global, Inc.', HOOD: 'Robinhood Markets, Inc.', AXP: 'American Express Company',
  WMT: 'Walmart Inc.', COST: 'Costco Wholesale Corporation', TGT: 'Target Corporation', HD: 'The Home Depot, Inc.', LOW: "Lowe's Companies, Inc.", MCD: "McDonald's Corporation", SBUX: 'Starbucks Corporation', NKE: 'NIKE, Inc.', LULU: 'lululemon athletica inc.', TPR: 'Tapestry, Inc.', TJX: 'The TJX Companies, Inc.', CMG: 'Chipotle Mexican Grill, Inc.', KO: 'The Coca-Cola Company', PEP: 'PepsiCo, Inc.', PG: 'The Procter & Gamble Company',
  LLY: 'Eli Lilly and Company', NVO: 'Novo Nordisk A/S', JNJ: 'Johnson & Johnson', MRK: 'Merck & Co., Inc.', ABBV: 'AbbVie Inc.', PFE: 'Pfizer Inc.', UNH: 'UnitedHealth Group Incorporated', ISRG: 'Intuitive Surgical, Inc.', ABT: 'Abbott Laboratories', TMO: 'Thermo Fisher Scientific Inc.', AMGN: 'Amgen Inc.', GILD: 'Gilead Sciences, Inc.', REGN: 'Regeneron Pharmaceuticals, Inc.', MRNA: 'Moderna, Inc.',
  CAT: 'Caterpillar Inc.', DE: 'Deere & Company', GE: 'GE Aerospace', HON: 'Honeywell International Inc.', BA: 'The Boeing Company', RTX: 'RTX Corporation', LMT: 'Lockheed Martin Corporation', XOM: 'Exxon Mobil Corporation', CVX: 'Chevron Corporation', COP: 'ConocoPhillips', SLB: 'SLB Limited', F: 'Ford Motor Company', GM: 'General Motors Company', UPS: 'United Parcel Service, Inc.', FDX: 'FedEx Corporation',
}

const currencyNames = { USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', JPY: 'Japanese Yen', CHF: 'Swiss Franc', CAD: 'Canadian Dollar', AUD: 'Australian Dollar', NZD: 'New Zealand Dollar', SGD: 'Singapore Dollar', HKD: 'Hong Kong Dollar', CNH: 'Chinese Yuan', INR: 'Indian Rupee', KRW: 'South Korean Won', MXN: 'Mexican Peso', ZAR: 'South African Rand', TRY: 'Turkish Lira', SEK: 'Swedish Krona', NOK: 'Norwegian Krone', DKK: 'Danish Krone', PLN: 'Polish Zloty', THB: 'Thai Baht', IDR: 'Indonesian Rupiah' }
const cryptoNames = { BTC: 'Bitcoin', ETH: 'Ether', SOL: 'Solana', XRP: 'XRP', BNB: 'BNB', ADA: 'Cardano', DOGE: 'Dogecoin', AVAX: 'Avalanche', LINK: 'Chainlink', DOT: 'Polkadot', LTC: 'Litecoin', BCH: 'Bitcoin Cash', SUI: 'Sui', TON: 'Toncoin', TRX: 'TRON', HBAR: 'Hedera', XLM: 'Stellar', UNI: 'Uniswap', NEAR: 'NEAR Protocol', AAVE: 'Aave' }

function makeSymbol({ symbol, name = null, category, subcategory = null, exchange = null, marketType, baseCurrency = null, quoteCurrency = null, tickSize = null, tickValue = null, contractMultiplier = null, isFavorite = false, isCustom = false }) {
  return { symbol, name, category, subcategory, exchange, marketType, baseCurrency, quoteCurrency, tickSize, tickValue, contractMultiplier, isFavorite, isCustom }
}

const builtInSymbols = [
  ...futuresGroups.flatMap(([category, exchange, entries]) => entries.map(([symbol, name, contractMultiplier]) => {
    const baseCurrency = ['MBT', 'BTC'].includes(symbol) ? 'BTC' : ['MET', 'ETH'].includes(symbol) ? 'ETH' : null
    return makeSymbol({ symbol, name, category, exchange, marketType: 'futures', baseCurrency, quoteCurrency: baseCurrency ? 'USD' : null, contractMultiplier })
  })),
  ...stockGroups.flatMap(([subcategory, tickers]) => tickers.split(' ').map((symbol) => makeSymbol({ symbol, name: stockNames[symbol] ?? null, category: 'Stocks', subcategory, marketType: 'equity' }))),
  ...['EURUSD GBPUSD USDJPY USDCHF USDCAD AUDUSD NZDUSD', 'EURGBP EURJPY EURCHF EURCAD EURAUD EURNZD GBPJPY GBPCHF GBPCAD GBPAUD GBPNZD AUDJPY AUDCAD AUDCHF AUDNZD CADJPY CADCHF CHFJPY NZDJPY NZDCAD NZDCHF', 'USDSGD USDHKD USDCNH USDINR USDKRW USDMXN USDZAR USDTRY USDSEK USDNOK USDDKK USDPLN USDTHB USDIDR'].flatMap((group) => group.split(' ').map((symbol) => {
    const baseCurrency = symbol.slice(0, 3)
    const quoteCurrency = symbol.slice(3, 6)
    const name = currencyNames[baseCurrency] && currencyNames[quoteCurrency] ? `${currencyNames[baseCurrency]} / ${currencyNames[quoteCurrency]}` : null
    return makeSymbol({ symbol, name, category: 'Forex', marketType: 'spot', baseCurrency, quoteCurrency })
  })),
  ...['BTCUSD ETHUSD SOLUSD XRPUSD BNBUSD ADAUSD DOGEUSD AVAXUSD LINKUSD DOTUSD LTCUSD BCHUSD SUIUSD TONUSD TRXUSD HBARUSD XLMUSD UNIUSD NEARUSD AAVEUSD', 'BTCUSDT ETHUSDT SOLUSDT XRPUSDT BNBUSDT DOGEUSDT', 'BTCUSDC ETHUSDC'].flatMap((group) => group.split(' ').map((symbol) => {
    const quoteCurrency = symbol.endsWith('USDT') ? 'USDT' : symbol.endsWith('USDC') ? 'USDC' : 'USD'
    const baseCurrency = symbol.slice(0, -quoteCurrency.length)
    return makeSymbol({ symbol, name: cryptoNames[baseCurrency] ?? null, category: 'Crypto', marketType: 'spot', baseCurrency, quoteCurrency })
  })),
]

export function getBuiltInSymbols() {
  return builtInSymbols.map((item) => ({ ...item }))
}

export function getSymbolIdentity(item) {
  return `${item.symbol.toUpperCase()}|${String(item.exchange ?? '').toUpperCase()}|${String(item.marketType ?? '').toLowerCase()}`
}

export function normalizeCustomSymbol(input) {
  const symbol = String(input.symbol ?? '').trim().toUpperCase()
  if (!symbol) return null
  return normalizeSymbolRecord({
    symbol,
    name: String(input.name ?? '').trim() || null,
    category: input.category || 'Custom',
    exchange: String(input.exchange ?? '').trim() || null,
    marketType: input.marketType || 'custom',
    baseCurrency: String(input.baseCurrency ?? '').trim().toUpperCase() || null,
    quoteCurrency: String(input.quoteCurrency ?? '').trim().toUpperCase() || null,
    tickSize: input.tickSize,
    tickValue: input.tickValue,
    contractMultiplier: input.contractMultiplier,
    isCustom: true,
  })
}

export function normalizeSymbolRecord(input) {
  if (!input || typeof input !== 'object') return null
  const symbol = String(input.symbol ?? '').trim().toUpperCase()
  const marketType = String(input.marketType ?? '').trim()
  const category = String(input.category ?? '').trim()
  if (!symbol || !marketType || !category) return null
  const optionalPositiveNumber = (value) => {
    if (value === '' || value === null || value === undefined) return null
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? number : null
  }
  return makeSymbol({
    symbol,
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : null,
    category,
    subcategory: typeof input.subcategory === 'string' && input.subcategory.trim() ? input.subcategory.trim() : null,
    exchange: typeof input.exchange === 'string' && input.exchange.trim() ? input.exchange.trim() : null,
    marketType,
    baseCurrency: typeof input.baseCurrency === 'string' && input.baseCurrency.trim() ? input.baseCurrency.trim().toUpperCase() : null,
    quoteCurrency: typeof input.quoteCurrency === 'string' && input.quoteCurrency.trim() ? input.quoteCurrency.trim().toUpperCase() : null,
    tickSize: optionalPositiveNumber(input.tickSize),
    tickValue: optionalPositiveNumber(input.tickValue),
    contractMultiplier: optionalPositiveNumber(input.contractMultiplier),
    isFavorite: Boolean(input.isFavorite),
    isCustom: Boolean(input.isCustom),
  })
}

export function findSymbol(symbol, instrument, symbols = builtInSymbols) {
  const ticker = String(symbol ?? '').trim().toUpperCase()
  const marketType = { Equity: 'equity', Futures: 'futures', Forex: 'spot', Crypto: 'spot' }[instrument]
  return symbols.find((item) => item.symbol === ticker && (!marketType || item.marketType === marketType)) ?? null
}