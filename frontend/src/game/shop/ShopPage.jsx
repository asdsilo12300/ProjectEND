import { useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { buyShopItem, getShopItems, resolveAssetUrl } from '../../lib/api'
import { imageAssets } from '../data/gameData'
import { shopItems } from './data/shopItems'
import { ProductGrid } from './components/ProductGrid'
import { ShopPagination } from './components/ShopPagination'
import { ShopSidebar } from './components/ShopSidebar'
import { ShopToolbar } from './components/ShopToolbar'

const fallbackByName = new Map(shopItems.map((item) => [item.name, item]))
const recentPurchasesKey = 'plantsim-shop-latest-purchases'
const itemsPerPage = 8
const defaultPriceRange = { min: 0, max: 100 }

function mapApiShopItem(shopItem) {
  const item = shopItem.item ?? {}
  const fallback = fallbackByName.get(item.name) ?? {}

  return {
    ...fallback,
    id: `shop-${shopItem.id}`,
    backendId: shopItem.id,
    name: item.name ?? fallback.name ?? 'Lab item',
    category: 'Lab Item',
    price: Number(shopItem.price_coin ?? fallback.price ?? 0),
    featured: true,
    visual: fallback.visual ?? 'spray',
    accent: fallback.accent ?? '#34d981',
    imageUrl: resolveAssetUrl(item.image_url) ?? fallback.imageUrl,
    description: item.description ?? fallback.description,
  }
}

export function ShopPage({ onInventoryItemChange, onUserUpdate }) {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [maxPrice, setMaxPrice] = useState(defaultPriceRange.max)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState('default')
  const [currentPage, setCurrentPage] = useState(1)
  const [favoriteIds, setFavoriteIds] = useState(() => new Set())
  const [apiItems, setApiItems] = useState([])
  const [buyingId, setBuyingId] = useState(null)
  const [shopMessage, setShopMessage] = useState('')
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
        if (!cancelled) setApiItems((payload.data ?? []).map(mapApiShopItem))
      })
      .catch(() => {
        if (!cancelled) setApiItems([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  const products = apiItems

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

  const effectiveMaxPrice = Math.min(Math.max(maxPrice, priceBounds.min), priceBounds.max)

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

  async function buyItem(item) {
    if (!item.backendId) {
      setShopMessage('Connect the backend shop before buying this item.')
      return
    }

    const confirmation = await Swal.fire({
      title: `Buy ${item.name}?`,
      html: `
        <div class="plantsim-shop-confirm">
          ${item.imageUrl ? `<img class="plantsim-shop-confirm__item" src="${item.imageUrl}" alt="">` : ''}
          <div class="plantsim-shop-confirm__price">
            <img src="${imageAssets.coin}" alt="">
            <strong>${item.price}</strong>
          </div>
          <p>This item will be added to your lab inventory.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Buy',
      cancelButtonText: 'Cancel',
      background: '#101511',
      color: '#eaf7df',
      buttonsStyling: false,
      reverseButtons: true,
      customClass: {
        popup: 'plantsim-shop-alert',
        title: 'plantsim-shop-alert__title',
        actions: 'plantsim-shop-alert__actions',
        confirmButton: 'plantsim-shop-alert__confirm',
        cancelButton: 'plantsim-shop-alert__cancel',
      },
    })

    if (!confirmation.isConfirmed) return

    setBuyingId(item.id)
    setShopMessage('')

    try {
      const payload = await buyShopItem(item.backendId, 1)
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
          price: item.price,
          accent: item.accent,
          imageUrl: item.imageUrl,
        }
        const next = [purchase, ...current.filter((entry) => entry.id !== item.id)].slice(0, 3)
        window.localStorage.setItem(recentPurchasesKey, JSON.stringify(next))
        return next
      })

      setShopMessage(`${item.name} added to your inventory.`)
    } catch (error) {
      setShopMessage(error.message || 'Could not buy this item.')
    } finally {
      setBuyingId(null)
    }
  }

  return (
    <section className="absolute inset-x-0 bottom-0 top-16 z-10 overflow-hidden bg-[#0b1215]" aria-label="Shop page">
      <div className="grid h-full w-full grid-cols-1 gap-6 px-5 py-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <ShopSidebar
          categories={categories}
          latestItems={latestPurchases}
          maxPrice={effectiveMaxPrice}
          onPriceChange={updateMaxPrice}
          priceRange={priceBounds}
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
          onSearchChange={updateSearchQuery}
          onSelectCategory={selectCategory}
        />
        <main className="flex min-h-0 flex-col">
          <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
            <ShopToolbar endIndex={endIndex} sortMode={sortMode} startIndex={startIndex} totalCount={filteredItems.length} onSortChange={updateSortMode} />
            {shopMessage && <span className="rounded-sm border border-[#34d981]/25 bg-[#34d981]/10 px-3 py-1 text-xs font-semibold text-[#9cf3bd]">{shopMessage}</span>}
          </div>
          <ProductGrid buyingId={buyingId} favoriteIds={favoriteIds} items={visibleItems} onBuy={buyItem} onToggleFavorite={toggleFavorite} />
          <ShopPagination currentPage={safeCurrentPage} pageCount={pageCount} onPageChange={setCurrentPage} />
        </main>
      </div>
    </section>
  )
}
