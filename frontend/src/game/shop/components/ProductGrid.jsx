import { ProductCard } from './ProductCard'

export function ProductGrid({ buyingId = null, favoriteIds, items, onBuy, onToggleFavorite }) {
  if (!items.length) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center rounded-sm border border-dashed border-slate-700/60 bg-[#111a20]/35 px-6 text-center">
        <div>
          <strong className="block text-sm text-slate-100">No shop items in database</strong>
          <span className="mt-2 block max-w-sm text-xs leading-6 text-slate-500">
            Add active shop items in the database or run the game simulation seeder.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
      {items.map((item) => (
        <ProductCard isBuying={buyingId === item.id} isFavorite={favoriteIds.has(item.id)} item={item} key={item.id} onBuy={onBuy} onToggleFavorite={onToggleFavorite} />
      ))}
    </div>
  )
}
