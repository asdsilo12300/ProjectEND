import { useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { buyShopItem, getShopItems, resolveAssetUrl } from '../../lib/api'
import { getAppLanguage } from '../../i18n/appI18n'
import { imageAssets } from '../data/gameData'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { shopItems } from './data/shopItems'
import { getShopCopy, localizeShopItem } from './shopCopy'
import { ProductGrid } from './components/ProductGrid'
import { ShopPagination } from './components/ShopPagination'
import { ShopSidebar } from './components/ShopSidebar'
import { ShopToolbar } from './components/ShopToolbar'
import { ParticleNetworkBackground } from '../components/ParticleNetworkBackground'

const fallbackByName = new Map(shopItems.map((item) => [item.name, item]))
const recentPurchasesKey = 'plantsim-shop-latest-purchases'
const itemsPerPage = 8
const defaultPriceRange = { min: 0, max: 100 }

function escapeHtml(value) {
  const entities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }

  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character])
}

function useAppLanguage() {
  const [language, setLanguage] = useState(() => getAppLanguage() === 'th' ? 'th' : 'en')

  useEffect(() => {
    const updateLanguage = (event) => {
      setLanguage(event?.detail?.language === 'th' || getAppLanguage() === 'th' ? 'th' : 'en')
    }
    window.addEventListener('plant-settings-change', updateLanguage)
    return () => window.removeEventListener('plant-settings-change', updateLanguage)
  }, [])

  return language
}

function mapApiShopItem(shopItem) {
  const item = shopItem.item ?? {}
  const fallback = fallbackByName.get(item.name) ?? {}
  const isFriendPrank = String(item.effect_type ?? '').startsWith('friend_pest:')

  return {
    ...fallback,
    id: `shop-${shopItem.id}`,
    backendId: shopItem.id,
    sourceName: item.name ?? fallback.name ?? 'Lab item',
    name: item.name ?? fallback.name ?? 'Lab item',
    category: isFriendPrank ? 'Friend Prank' : 'Lab Item',
    price: Number(shopItem.price_coin ?? fallback.price ?? 0),
    featured: true,
    visual: fallback.visual ?? 'spray',
    accent: fallback.accent ?? '#34d981',
    imageUrl: resolveAssetUrl(item.image_url) ?? fallback.imageUrl,
    description: fallback.description ?? item.description,
    effectType: item.effect_type ?? '',
    actionKey: item.action_key ?? fallback.id ?? '',
    modeScope: item.mode_scope ?? 'both',
  }
}

export function ShopPage({ coinBalance = 0, onInventoryItemChange, onUserUpdate }) {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [maxPrice, setMaxPrice] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState('default')
  const [currentPage, setCurrentPage] = useState(1)
  const [favoriteIds, setFavoriteIds] = useState(() => new Set())
  const [apiItems, setApiItems] = useState([])
  const [buyingId, setBuyingId] = useState(null)
  const [shopNotice, setShopNotice] = useState(null)
  const [catalogStatus, setCatalogStatus] = useState('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [latestPurchases, setLatestPurchases] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(recentPurchasesKey) ?? '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    let cancelled = false

    getShopItems()
      .then((payload) => {
        if (!cancelled) {
          setApiItems((payload.data ?? []).map(mapApiShopItem))
          setCatalogStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiItems([])
          setCatalogStatus('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const language = useAppLanguage()
  const copy = getShopCopy(language)

  const products = useMemo(() => apiItems.map((item) => localizeShopItem(item, language)), [apiItems, language])
  const localizedLatestPurchases = useMemo(
    () => latestPurchases.map((item) => localizeShopItem(item, language)),
    [language, latestPurchases],
  )

  const priceBounds = useMemo(() => {
    if (!products.length) return defaultPriceRange

    const prices = products.map((item) => Number(item.price ?? 0))
    const min = Math.min(...prices)
    const max = Math.max(...prices)

    return {
      min: Math.max(0, min),
      max: Math.max(min, max),
    }
  }, [products])

  const effectiveMaxPrice = maxPrice === null
    ? priceBounds.max
    : Math.min(Math.max(maxPrice, priceBounds.min), priceBounds.max)

  const categories = useMemo(() => {
    const counts = products.reduce((map, item) => {
      map.set(item.category, (map.get(item.category) ?? 0) + 1)
      return map
    }, new Map())

    return Array.from(counts, ([label, count]) => ({ label, count }))
  }, [products])

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return products
      .filter((item) => {
        const matchesCategory = !selectedCategory || item.category.toLowerCase() === selectedCategory.toLowerCase()
        const matchesPrice = item.price >= priceBounds.min && item.price <= effectiveMaxPrice
        const searchableText = `${item.name} ${item.category} ${item.description ?? ''}`.toLowerCase()
        const matchesSearch = !query || searchableText.includes(query)

        return matchesCategory && matchesPrice && matchesSearch
      })
      .sort((left, right) => {
        if (sortMode === 'price-desc') return right.price - left.price
        if (sortMode === 'price-asc') return left.price - right.price
        if (sortMode === 'name-asc') return left.name.localeCompare(right.name)
        if (sortMode === 'name-desc') return right.name.localeCompare(left.name)

        const leftFavorite = favoriteIds.has(left.id)
        const rightFavorite = favoriteIds.has(right.id)

        if (leftFavorite === rightFavorite) return 0
        return leftFavorite ? -1 : 1
      })
  }, [effectiveMaxPrice, favoriteIds, priceBounds.min, products, searchQuery, selectedCategory, sortMode])

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const startIndex = filteredItems.length === 0 ? 0 : ((safeCurrentPage - 1) * itemsPerPage) + 1
  const endIndex = Math.min(filteredItems.length, safeCurrentPage * itemsPerPage)
  const visibleItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage
    return filteredItems.slice(start, start + itemsPerPage)
  }, [filteredItems, safeCurrentPage])

  function selectCategory(category) {
    setCurrentPage(1)
    setSelectedCategory((value) => (value === category ? null : category))
  }

  function updateMaxPrice(value) {
    setCurrentPage(1)
    setMaxPrice(value)
  }

  function resetFilters() {
    setCurrentPage(1)
    setSearchQuery('')
    setSelectedCategory(null)
    setMaxPrice(null)
  }

  function retryCatalog() {
    setShopNotice(null)
    setCatalogStatus('loading')
    setReloadKey((value) => value + 1)
  }

  function updateSearchQuery(value) {
    setCurrentPage(1)
    setSearchQuery(value)
  }

  function updateSortMode(value) {
    setCurrentPage(1)
    setSortMode(value)
  }

  function toggleFavorite(itemId) {
    setFavoriteIds((value) => {
      const next = new Set(value)

      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }

      return next
    })
  }

  async function buyItem(item, selectedQuantity = 1) {
    if (!item.backendId) {
      setShopNotice({ type: 'error', text: copy.buyUnavailable })
      return
    }

    const maximumAffordableQuantity = item.price > 0
      ? Math.min(99, Math.max(0, Math.floor(Number(coinBalance) / item.price)))
      : 99
    const quantity = Number(selectedQuantity)

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      setShopNotice({ type: 'error', text: copy.quantityError })
      return
    }

    if (item.price > 0 && quantity > maximumAffordableQuantity) {
      setShopNotice({ type: 'error', text: copy.notEnoughCurrency })
      return
    }

    const safeItemName = escapeHtml(item.name)
    const safeImageUrl = escapeHtml(item.imageUrl)
    const totalPrice = item.price * quantity
    const finalConfirmation = await Swal.fire({
      title: copy.finalConfirmTitle,
      html: `
        <div class="plantsim-shop-confirm plantsim-shop-confirm--final">
          ${item.imageUrl ? `<img class="plantsim-shop-confirm__item" src="${safeImageUrl}" alt="">` : ''}
          <strong class="plantsim-shop-confirm__name">${safeItemName}</strong>
          <div class="plantsim-shop-confirm__summary">
            <span>${copy.finalQuantity}<strong>${quantity}</strong></span>
            <span>${copy.totalPrice}<strong class="plantsim-shop-confirm__summary-price"><img src="${imageAssets.coin}" alt="">${totalPrice}</strong></span>
          </div>
          <p>${copy.finalConfirmDescription}</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: copy.confirmPurchase,
      cancelButtonText: copy.cancel,
      focusCancel: true,
      reverseButtons: true,
      background: '#101511',
      color: '#eaf7df',
      buttonsStyling: false,
      customClass: {
        popup: 'plantsim-shop-alert',
        title: 'plantsim-shop-alert__title',
        actions: 'plantsim-shop-alert__actions',
        confirmButton: 'plantsim-shop-alert__confirm',
        cancelButton: 'plantsim-shop-alert__cancel',
      },
    })

    if (!finalConfirmation.isConfirmed) return

    setBuyingId(item.id)
    setShopNotice(null)

    try {
      const payload = await buyShopItem(item.backendId, quantity)
      const inventory = payload.data ?? payload.inventory ?? null

      if (inventory) {
        onInventoryItemChange?.(inventory)
      }

      if (payload.user) {
        onUserUpdate?.(payload.user)
      }

      setLatestPurchases((current) => {
        const purchase = {
          id: item.id,
          name: item.name,
          price: totalPrice,
          quantity,
          accent: item.accent,
          imageUrl: item.imageUrl,
        }
        const next = [purchase, ...current.filter((entry) => entry.id !== item.id)].slice(0, 3)
        window.localStorage.setItem(recentPurchasesKey, JSON.stringify(next))
        return next
      })

      setShopNotice({ type: 'success', text: copy.purchaseSuccess(item.name, quantity) })
    } catch (error) {
      const message = String(error?.message ?? '')
      const localizedMessage = language === 'th'
        ? /not enough currency/i.test(message)
          ? copy.notEnoughCurrency
          : /no longer available|not found/i.test(message)
            ? copy.unavailableError
            : copy.purchaseError
        : message || copy.purchaseError
      setShopNotice({ type: 'error', text: localizedMessage })
    } finally {
      setBuyingId(null)
    }
  }

  const hasActiveFilters = Boolean(searchQuery.trim() || selectedCategory || (maxPrice !== null && effectiveMaxPrice < priceBounds.max))
  const activeFilterCount = [searchQuery.trim(), selectedCategory, maxPrice !== null && effectiveMaxPrice < priceBounds.max].filter(Boolean).length

  return (
    <section className="user-page user-page--shop particle-network-surface particle-network-surface--game absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto bg-[#0b1210] text-slate-100" aria-label={copy.pageLabel}>
      <ParticleNetworkBackground variant="shop" />
      <div className="relative z-[1] mx-auto min-h-full w-full max-w-[1540px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#30453a]/65 pb-6 sm:flex-row sm:items-end sm:justify-between" data-tour="shop-header">
          <div className="flex items-start gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e9b95f]/12 text-[#f3ce7a] ring-1 ring-[#e9b95f]/25">
              <AppIcon className="h-6 w-6" name="shop" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e9b95f]">{copy.eyebrow}</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">{copy.title}</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{copy.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="text-xs font-semibold text-slate-500">{copy.itemCount(products.length)}</span>
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#55dc91]/25 bg-[#55dc91]/10 px-3.5 text-sm font-bold text-[#9cf3bd] transition hover:bg-[#55dc91]/16 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf3bd] lg:hidden"
              type="button"
              aria-controls="shop-filters"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((value) => !value)}
            >
              <AppIcon className="h-4 w-4" name="sort" />
              {filtersOpen ? copy.hideFilters : copy.showFilters}
              {activeFilterCount ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#55dc91] px-1 text-xs text-[#07120d]">{activeFilterCount}</span> : null}
            </button>
          </div>
        </header>

        <div className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className={`${filtersOpen ? 'block' : 'hidden'} lg:block`} data-tour="shop-filters" id="shop-filters">
            <ShopSidebar
              categories={categories}
              copy={copy}
              hasActiveFilters={hasActiveFilters}
              latestItems={localizedLatestPurchases}
              maxPrice={effectiveMaxPrice}
              onPriceChange={updateMaxPrice}
              onResetFilters={resetFilters}
              priceRange={priceBounds}
              searchQuery={searchQuery}
              selectedCategory={selectedCategory}
              onSearchChange={updateSearchQuery}
              onSelectCategory={selectCategory}
            />
          </div>
          <main className="min-w-0" data-tour="shop-catalog">
            {shopNotice ? (
              <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${shopNotice.type === 'error' ? 'border-rose-300/20 bg-rose-500/10 text-rose-100' : 'border-[#55dc91]/25 bg-[#55dc91]/10 text-[#9cf3bd]'}`} role={shopNotice.type === 'error' ? 'alert' : 'status'}>
                {shopNotice.text}
              </div>
            ) : null}
            {catalogStatus === 'ready' ? <ShopToolbar copy={copy} endIndex={endIndex} sortMode={sortMode} startIndex={startIndex} totalCount={filteredItems.length} onSortChange={updateSortMode} /> : null}
            <ProductGrid
              buyingId={buyingId}
              coinBalance={coinBalance}
              copy={copy}
              error={catalogStatus === 'error'}
              favoriteIds={favoriteIds}
              hasFilters={hasActiveFilters}
              items={visibleItems}
              loading={catalogStatus === 'loading'}
              onBuy={buyItem}
              onClearFilters={resetFilters}
              onRetry={retryCatalog}
              onToggleFavorite={toggleFavorite}
            />
            {catalogStatus === 'ready' && filteredItems.length > 0 ? <ShopPagination copy={copy} currentPage={safeCurrentPage} pageCount={pageCount} onPageChange={setCurrentPage} /> : null}
          </main>
        </div>
      </div>
    </section>
  )
}
