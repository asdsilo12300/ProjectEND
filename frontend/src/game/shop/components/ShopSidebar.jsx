import { AppIcon } from '../../icons/IconifyIcon'
import { imageAssets } from '../../data/gameData'

export function ShopSidebar({ categories = [], copy, hasActiveFilters = false, latestItems = [], maxPrice, onPriceChange, onResetFilters, priceRange, searchQuery = '', selectedCategory, onSearchChange, onSelectCategory }) {
  const priceProgress = ((maxPrice - priceRange.min) / (priceRange.max - priceRange.min)) * 100
  const safeProgress = Number.isFinite(priceProgress) ? priceProgress : 100

  return (
    <aside className="space-y-5 rounded-2xl border border-[#30453a]/70 bg-[#101914]/80 p-4 text-slate-300 lg:sticky lg:top-4" aria-label={copy.filters}>
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#75dca0]">{copy.filters}</p>
          {hasActiveFilters ? <span className="mt-1 block text-xs text-slate-400">{copy.activeFilters([searchQuery.trim(), selectedCategory, maxPrice < priceRange.max].filter(Boolean).length)}</span> : null}
        </div>
        <button className="min-h-10 rounded-lg px-2.5 text-xs font-bold text-[#8eeab4] transition hover:bg-[#55dc91]/10 disabled:cursor-default disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf3bd]" type="button" disabled={!hasActiveFilters} onClick={onResetFilters}>
          {copy.resetFilters}
        </button>
      </div>
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-xs font-black text-[#75dca0]">
          <AppIcon className="h-4 w-4" name="search" />
          {copy.search}
        </h2>
        <label className="relative block">
          <span className="sr-only">{copy.searchItem}</span>
          <input
            className="min-h-11 w-full rounded-xl border border-[#34483c] bg-[#0b1210] px-3 pr-10 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-[#55dc91] focus:ring-2 focus:ring-[#55dc91]/10"
            placeholder={copy.searchPlaceholder}
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <AppIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" name="search" />
        </label>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-black text-[#75dca0]">
          <AppIcon className="h-4 w-4" name="sort" />
          {copy.filterByPrice}
        </h2>
        <div className="rounded-xl bg-[#0b1210] p-3.5 ring-1 ring-[#34483c]">
          <label className="block" htmlFor="shop-price-range">
            <span className="sr-only">{copy.maximumPrice}</span>
            <span className="relative block h-10">
              <span className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-700" />
              <span
                className="pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#55dc91]"
                style={{ width: `${safeProgress}%` }}
              />
              <span
                className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#55dc91] ring-2 ring-[#0b1210]"
                style={{ left: `${safeProgress}%` }}
                aria-hidden="true"
              />
              <input
                className="absolute inset-0 z-10 h-10 w-full cursor-pointer opacity-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55dc91]"
                id="shop-price-range"
                max={priceRange.max}
                min={priceRange.min}
                step="1"
                type="range"
                value={maxPrice}
                onChange={(event) => onPriceChange(Number(event.target.value))}
                onInput={(event) => onPriceChange(Number(event.currentTarget.value))}
              />
            </span>
          </label>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <img className="h-3.5 w-3.5" src={imageAssets.coin} alt="" />
              {priceRange.min}
            </span>
            <strong className="inline-flex items-center gap-1 font-black text-[#78eda8]">
              <span className="font-semibold text-slate-500">{copy.upTo}</span>
              <img className="h-3.5 w-3.5" src={imageAssets.coin} alt="" />
              {maxPrice}
            </strong>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-black text-[#75dca0]">
          <AppIcon className="h-4 w-4" name="shop" />
          {copy.categories}
        </h2>
        <div className="rounded-xl bg-[#0b1210] p-2 ring-1 ring-[#34483c]">
          {categories.length === 0 && (
            <div className="rounded-sm border border-dashed border-slate-700/60 px-3 py-4 text-center">
              <strong className="block text-xs text-slate-300">{copy.noCategories}</strong>
            </div>
          )}
          {categories.map((category) => {
            const active = selectedCategory === category.label

            return (
              <button
                className={`flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.05] hover:text-[#78eda8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55dc91] ${
                  active ? 'bg-[#55dc91]/12 text-[#78eda8]' : 'text-slate-400'
                }`}
                key={category.label}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectCategory(category.label)}
              >
                <span className="text-xs font-semibold">{category.label === 'Lab Item' ? copy.labItem : category.label}</span>
                <span className={`text-xs font-semibold ${active ? 'text-[#78eda8]' : 'text-slate-500'}`}>{category.count}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="hidden lg:block">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-black text-[#75dca0]">
          <AppIcon className="h-4 w-4" name="history" />
          {copy.latestPurchases}
        </h2>
        <div className="space-y-2 rounded-xl bg-[#0b1210] p-2 ring-1 ring-[#34483c]">
          {latestItems.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#34483c] px-3 py-4 text-center">
              <strong className="block text-xs text-slate-300">{copy.noPurchases}</strong>
              <span className="mt-1 block text-[11px] leading-4 text-slate-500">{copy.noPurchasesHint}</span>
            </div>
          )}
          {latestItems.map((item) => (
            <article className="flex items-center gap-3 rounded-lg bg-[#152119] p-2" key={item.id}>
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#08100c]">
                {item.imageUrl ? (
                  <img className="h-10 w-10 object-contain" src={item.imageUrl} alt="" draggable="false" />
                ) : (
                  <span className="text-xs font-black" style={{ color: item.accent }}>{item.name.slice(0, 2).toUpperCase()}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs text-slate-100">{item.name}</strong>
                <small className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <img className="h-3 w-3" src={imageAssets.coin} alt="" />
                  {item.price}
                </small>
              </span>
            </article>
          ))}
        </div>
      </section>
    </aside>
  )
}







