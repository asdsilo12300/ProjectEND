import { ProductCard } from './ProductCard'
import { AppIcon } from '../../icons/FontAwesomeIcon'

function ShopState({ actionLabel, description, icon, onAction, title }) {
  return (
    <div className="grid min-h-[320px] flex-1 place-items-center rounded-2xl border border-dashed border-[#385242] bg-[#101914]/70 px-6 py-12 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#55dc91]/10 text-[#78eda8] ring-1 ring-[#55dc91]/20">
          <AppIcon className="h-7 w-7" name={icon} />
        </span>
        <strong className="mt-5 block text-lg text-slate-50">{title}</strong>
        <span className="mt-2 block text-sm leading-6 text-slate-400">{description}</span>
        {onAction ? (
          <button className="mt-5 min-h-11 rounded-xl border border-[#55dc91]/30 bg-[#55dc91]/10 px-5 text-sm font-bold text-[#9cf3bd] transition hover:bg-[#55dc91]/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf3bd]" type="button" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function ProductGrid({ buyingId = null, copy, error = false, favoriteIds, hasFilters = false, items, loading = false, onBuy, onClearFilters, onRetry, onToggleFavorite }) {
  if (loading) {
    return (
      <div className="grid flex-1 grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label={copy.loadingTitle} aria-busy="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="animate-pulse rounded-2xl bg-[#121c17] p-3.5 ring-1 ring-[#31463a]/55 motion-reduce:animate-none" key={index}>
            <div className="h-32 rounded-xl bg-white/[0.055]" />
            <div className="mt-4 h-3 w-20 rounded bg-white/[0.055]" />
            <div className="mt-3 h-4 w-2/3 rounded bg-white/[0.07]" />
            <div className="mt-3 h-9 rounded bg-white/[0.045]" />
            <div className="mt-4 h-11 rounded-xl bg-white/[0.06]" />
          </div>
        ))}
      </div>
    )
  }

  if (error) return <ShopState actionLabel={copy.retry} description={copy.errorDescription} icon="restartAlt" onAction={onRetry} title={copy.errorTitle} />

  if (!items.length) {
    return hasFilters
      ? <ShopState actionLabel={copy.resetFilters} description={copy.noMatchesDescription} icon="search" onAction={onClearFilters} title={copy.noMatchesTitle} />
      : <ShopState actionLabel={copy.retry} description={copy.emptyDescription} icon="shop" onAction={onRetry} title={copy.emptyTitle} />
  }

  return (
    <div className="grid flex-1 grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => (
        <ProductCard copy={copy} isBuying={buyingId === item.id} isFavorite={favoriteIds.has(item.id)} item={item} key={item.id} onBuy={onBuy} onToggleFavorite={onToggleFavorite} />
      ))}
    </div>
  )
}
