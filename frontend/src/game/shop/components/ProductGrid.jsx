import { ProductCard } from './ProductCard'

export function ProductGrid({ favoriteIds, items, onToggleFavorite }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
      {items.map((item) => (
        <ProductCard isFavorite={favoriteIds.has(item.id)} item={item} key={item.id} onToggleFavorite={onToggleFavorite} />
      ))}
    </div>
  )
}
