import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { getSymbolIdentity, normalizeCustomSymbol, type SymbolRecord } from './symbolCatalog.js'

type SymbolSelectorProps = {
  value: SymbolRecord | null
  symbols: SymbolRecord[]
  favoriteKeys: Set<string>
  onSelect: (symbol: SymbolRecord) => void
  onToggleFavorite: (identity: string) => void
  onAddCustomSymbol: (symbol: SymbolRecord) => string | null
  onRemoveCustomSymbol: (identity: string) => void
}

const categories = ['All', 'Futures', 'Stocks', 'Forex', 'Crypto', 'Favorites']
const marketTypes = [
  { value: 'equity', label: 'Equity' },
  { value: 'spot', label: 'Spot' },
  { value: 'futures', label: 'Futures' },
  { value: 'perpetual', label: 'Perpetual' },
  { value: 'custom', label: 'Custom' },
]

function getSymbolOptionId(item: SymbolRecord) {
  return `symbol-option-${encodeURIComponent(getSymbolIdentity(item))}`
}

export default function SymbolSelector({ value, symbols, favoriteKeys, onSelect, onToggleFavorite, onAddCustomSymbol, onRemoveCustomSymbol }: SymbolSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [activeIndex, setActiveIndex] = useState(0)
  const [customOpen, setCustomOpen] = useState(false)
  const [customError, setCustomError] = useState('')
  const [customDraft, setCustomDraft] = useState({ symbol: '', name: '', category: 'Stocks', exchange: '', marketType: 'equity', baseCurrency: '', quoteCurrency: '', tickSize: '', tickValue: '', contractMultiplier: '' })
  const searchInput = useRef<HTMLInputElement>(null)

  const matches = symbols.filter((item) => {
    const isFavorite = favoriteKeys.has(getSymbolIdentity(item))
    const matchesCategory = category === 'All' || (category === 'Favorites' ? isFavorite : item.category === category)
    const searchable = `${item.symbol} ${item.name ?? ''} ${item.category} ${item.subcategory ?? ''} ${item.exchange ?? ''} ${item.marketType} ${item.baseCurrency ?? ''} ${item.quoteCurrency ?? ''}`.toLowerCase()
    return matchesCategory && searchable.includes(query.trim().toLowerCase())
  }).sort((left, right) => {
    const leftFavorite = favoriteKeys.has(getSymbolIdentity(left))
    const rightFavorite = favoriteKeys.has(getSymbolIdentity(right))
    return Number(rightFavorite) - Number(leftFavorite) || left.symbol.localeCompare(right.symbol) || String(left.exchange ?? '').localeCompare(String(right.exchange ?? ''))
  })
  const favoriteItems = category === 'Favorites' ? [] : matches.filter((item) => favoriteKeys.has(getSymbolIdentity(item)))
  const otherItems = category === 'Favorites' ? matches : matches.filter((item) => !favoriteKeys.has(getSymbolIdentity(item)))
  const displayedItems = [...favoriteItems, ...otherItems]

  useEffect(() => {
    if (open && !customOpen) searchInput.current?.focus()
  }, [open, customOpen])

  const close = () => {
    setOpen(false)
    setCustomOpen(false)
    setCustomError('')
  }

  const selectItem = (item: SymbolRecord) => {
    onSelect(item)
    close()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowDown' && displayedItems.length) {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % displayedItems.length)
    } else if (event.key === 'ArrowUp' && displayedItems.length) {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + displayedItems.length) % displayedItems.length)
    } else if (event.key === 'Enter' && displayedItems[activeIndex]) {
      event.preventDefault()
      selectItem(displayedItems[activeIndex])
    }
  }

  const handleCreateCustomSymbol = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const customSymbol = normalizeCustomSymbol(customDraft)
    if (!customSymbol) {
      setCustomError('Ticker wajib diisi.')
      return
    }
    const duplicate = symbols.some((item) => getSymbolIdentity(item) === getSymbolIdentity(customSymbol))
    if (duplicate) {
      setCustomError('Symbol dengan ticker, exchange, dan market type ini sudah tersedia.')
      return
    }
    const error = onAddCustomSymbol(customSymbol)
    if (error) {
      setCustomError(error)
      return
    }
    onSelect(customSymbol)
    close()
  }

  const customFormField = (label: string, key: keyof typeof customDraft, type = 'text') => <label className="symbol-custom-field">
    <span>{label}</span>
    <input type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? 'any' : undefined} value={customDraft[key]} onChange={(event) => setCustomDraft((previous) => ({ ...previous, [key]: event.target.value }))} />
  </label>

  const modal = open ? <div className="symbol-selector-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); close() } }}>
    <section className="symbol-selector-dialog" role="dialog" aria-modal="true" aria-label="Select symbol">
      <header className="symbol-selector-heading">
        <div><h2>{customOpen ? 'Add custom symbol' : 'Select symbol'}</h2><p>{customOpen ? 'Exchange and contract details are optional.' : 'Search by ticker, instrument, category, or exchange.'}</p></div>
        <button type="button" aria-label="Close symbol selector" onClick={close}>×</button>
      </header>
      {!customOpen ? <>
        <label className="symbol-search-field"><span aria-hidden="true">⌕</span><input ref={searchInput} autoComplete="off" placeholder="Search symbols" value={query} aria-activedescendant={displayedItems[activeIndex] ? getSymbolOptionId(displayedItems[activeIndex]) : undefined} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} onKeyDown={handleKeyDown} /></label>
        <div className="symbol-category-tabs" role="tablist" aria-label="Symbol categories">{categories.map((item) => <button key={item} type="button" role="tab" aria-selected={category === item} className={category === item ? 'selected' : ''} onClick={() => { setCategory(item); setActiveIndex(0) }}>{item}</button>)}</div>
        <div className="symbol-result-heading"><span>{category === 'Favorites' ? 'FAVORITES' : query ? 'SEARCH RESULTS' : favoriteItems.length ? 'FAVORITES' : 'SYMBOLS'}</span><small>{displayedItems.length} results</small></div>
        {displayedItems.length ? <div className="symbol-results" role="listbox" aria-label="Symbols">
          {favoriteItems.map((item, index) => <SymbolOption key={getSymbolIdentity(item)} item={item} favorite active={activeIndex === index} selected={value ? getSymbolIdentity(value) === getSymbolIdentity(item) : false} onChoose={() => selectItem(item)} onFavorite={() => onToggleFavorite(getSymbolIdentity(item))} onRemove={item.isCustom ? () => onRemoveCustomSymbol(getSymbolIdentity(item)) : undefined} />)}
          {otherItems.map((item, index) => <SymbolOption key={getSymbolIdentity(item)} item={item} favorite={favoriteKeys.has(getSymbolIdentity(item))} active={activeIndex === index + favoriteItems.length} selected={value ? getSymbolIdentity(value) === getSymbolIdentity(item) : false} onChoose={() => selectItem(item)} onFavorite={() => onToggleFavorite(getSymbolIdentity(item))} onRemove={item.isCustom ? () => onRemoveCustomSymbol(getSymbolIdentity(item)) : undefined} />)}
        </div> : <div className="symbol-empty-state"><strong>No symbols found</strong><span>Try another search or add a custom symbol.</span></div>}
        <footer className="symbol-selector-footer"><span>Exchange availability depends on your broker.</span><button type="button" onClick={() => { setCustomOpen(true); setCustomError('') }}>+ Add custom symbol</button></footer>
      </> : <form className="symbol-custom-form" onSubmit={handleCreateCustomSymbol}>
        <div className="symbol-custom-grid">
          {customFormField('Ticker *', 'symbol')}
          {customFormField('Name', 'name')}
          <label className="symbol-custom-field"><span>Category</span><select value={customDraft.category} onChange={(event) => setCustomDraft((previous) => ({ ...previous, category: event.target.value }))}><option>Futures</option><option>Stocks</option><option>Forex</option><option>Crypto</option><option>Custom</option></select></label>
          <label className="symbol-custom-field"><span>Market type</span><select value={customDraft.marketType} onChange={(event) => setCustomDraft((previous) => ({ ...previous, marketType: event.target.value }))}>{marketTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          {customFormField('Exchange / Provider', 'exchange')}
          {customFormField('Base currency', 'baseCurrency')}
          {customFormField('Quote currency', 'quoteCurrency')}
          {customFormField('Tick size', 'tickSize', 'number')}
          {customFormField('Tick value', 'tickValue', 'number')}
          {customFormField('Contract multiplier', 'contractMultiplier', 'number')}
        </div>
        {customError && <p className="symbol-custom-error" role="alert">{customError}</p>}
        <footer className="symbol-custom-actions"><button type="button" onClick={() => { setCustomOpen(false); setCustomError('') }}>Back to symbols</button><button type="submit">Add and select</button></footer>
      </form>}
    </section>
  </div> : null

  return <>
    <button className="symbol-selector-trigger" type="button" aria-label={value ? `Selected symbol ${value.symbol}, ${value.name ?? 'name not provided'}` : 'Select symbol'} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setQuery(''); setCategory('All'); setActiveIndex(0); setOpen(true) }}>
      <span className="symbol-selector-value">{value?.symbol ?? 'Select symbol'}</span>
      <span className="symbol-selector-description">{value ? [value.name, value.category, value.exchange].filter(Boolean).join(' · ') : 'Ticker, name or exchange'}</span>
      <span className="symbol-selector-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && typeof document !== 'undefined' ? createPortal(modal, document.body) : null}
  </>
}

function SymbolOption({ item, favorite, active, selected, onChoose, onFavorite, onRemove }: { item: SymbolRecord; favorite?: boolean; active: boolean; selected: boolean; onChoose: () => void; onFavorite: () => void; onRemove?: () => void }) {
  return <div id={getSymbolOptionId(item)} className={`symbol-result-row ${active ? 'active' : ''} ${selected ? 'selected' : ''}`} role="option" aria-selected={selected}>
    <button type="button" className="symbol-result-select" onClick={onChoose}>
      <strong>{item.symbol}</strong>
      <span className="symbol-result-name">{item.name ?? 'Name not provided'}{item.subcategory ? ` · ${item.subcategory}` : ''}</span>
      <small>{item.category} · {item.exchange ?? 'Exchange / provider varies'} · {item.marketType}{item.quoteCurrency ? ` · ${item.quoteCurrency}` : ''}</small>
    </button>
    <button type="button" className={`symbol-favorite-button ${favorite ? 'favorite' : ''}`} aria-label={`${favorite ? 'Remove' : 'Add'} ${item.symbol} ${favorite ? 'from' : 'to'} favorites`} aria-pressed={favorite} onClick={onFavorite}>{favorite ? '★' : '☆'}</button>
    {onRemove && <button type="button" className="symbol-remove-custom-button" aria-label={`Delete custom symbol ${item.symbol}`} onClick={onRemove}>×</button>}
  </div>
}
