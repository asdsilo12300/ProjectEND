import { useMemo, useState } from 'react'
import { priceRange, shopItems } from './data/shopItems'
import { ProductGrid } from './components/ProductGrid'
import { ShopPagination } from './components/ShopPagination'
import { ShopSidebar } from './components/ShopSidebar'
import { ShopToolbar } from './components/ShopToolbar'

export function ShopPage() {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [maxPrice, setMaxPrice] = useState(priceRange.max)
  const [favoriteIds, setFavoriteIds] = useState(() => new Set())

  const visibleItems = useMemo(() => {
    return shopItems
      .filter((item) => {
        const matchesCategory = !selectedCategory || item.category.toLowerCase() === selectedCategory.toLowerCase()
        const matchesPrice = item.price >= priceRange.min && item.price <= maxPrice

        return matchesCategory && matchesPrice
      })
      .sort((left, right) => {
        const leftFavorite = favoriteIds.has(left.id)
        const rightFavorite = favoriteIds.has(right.id)

        if (leftFavorite === rightFavorite) return 0
        return leftFavorite ? -1 : 1
      })
  }, [favoriteIds, maxPrice, selectedCategory])

  function selectCategory(category) {
    setSelectedCategory((value) => (value === category ? null : category))
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

  return (
    <section className="absolute inset-x-0 bottom-0 top-16 z-10 overflow-hidden bg-[#0b1215]" aria-label="Shop page">
      <div className="grid h-full w-full grid-cols-1 gap-6 px-5 py-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <ShopSidebar
          maxPrice={maxPrice}
          onPriceChange={setMaxPrice}
          selectedCategory={selectedCategory}
          onSelectCategory={selectCategory}
        />
        <main className="flex min-h-0 flex-col">
          <ShopToolbar count={visibleItems.length} />
          <ProductGrid favoriteIds={favoriteIds} items={visibleItems} onToggleFavorite={toggleFavorite} />
          <ShopPagination />
        </main>
      </div>
    </section>
  )
}
