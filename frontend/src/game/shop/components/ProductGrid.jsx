import { ProductCard } from './ProductCard'

export function ProductGrid({ buyingId = null, favoriteIds, items, onBuy, onToggleFavorite }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
      {items.map((item) => (
        <ProductCard isBuying={buyingId === item.id} isFavorite={favoriteIds.has(item.id)} item={item} key={item.id} onBuy={onBuy} onToggleFavorite={onToggleFavorite} />
      ))}
    </div>
  )
}