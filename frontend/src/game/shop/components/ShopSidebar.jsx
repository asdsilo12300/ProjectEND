import { AppIcon } from '../../icons/IconifyIcon'
import { shopCategories, shopItems, priceRange } from '../data/shopItems'

export function ShopSidebar({ maxPrice, onPriceChange, selectedCategory, onSelectCategory }) {
  const featured = shopItems.filter((item) => item.featured)
  const priceProgress = ((maxPrice - priceRange.min) / (priceRange.max - priceRange.min)) * 100

  return (
    <aside className="space-y-5 text-slate-300" aria-label="Shop filters">
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase text-[#59d98e]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#59d98e]" />
          Search
        </h2>
        <label className="relative block">
          <span className="sr-only">Search item</span>
          <input
            className="h-9 w-full rounded-sm border border-slate-700/70 bg-[#111a20] px-3 pr-9 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-[#34d981]"
            placeholder="Search here"
            type="search"
          />
          <AppIcon className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" name="search" />
        </label>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase text-[#59d98e]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#59d98e]" />
          Filter by price
        </h2>
        <div className="rounded-sm bg-[#111a20] p-3 ring-1 ring-slate-700/50">
          <label className="block" htmlFor="shop-price-range">
            <span className="sr-only">Maximum price</span>
            <span className="relative block h-6">
              <span className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-700" />
              <span
                className="pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#34d981]"
                style={{ width: `${priceProgress}%` }}
              />
              <span
                className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#34d981] ring-2 ring-[#111a20]"
                style={{ left: `${priceProgress}%` }}
                aria-hidden="true"
              />
              <input
                className="absolute inset-0 z-10 h-6 w-full cursor-pointer opacity-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#34d981]"
                id="shop-price-range"
                max={priceRange.max}
                min={priceRange.min}
                step="10"
                type="range"
                value={maxPrice}
                onChange={(event) => onPriceChange(Number(event.target.value))}
                onInput={(event) => onPriceChange(Number(event.currentTarget.value))}
              />
            </span>
          </label>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span>${priceRange.min}.00</span>
            <strong className="font-black text-[#34d981]">${maxPrice}.00</strong>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase text-[#59d98e]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#59d98e]" />
          Featured products
        </h2>
        <div className="space-y-2 rounded-sm bg-[#111a20] p-2 ring-1 ring-slate-700/50">
          {featured.map((item) => (
            <article className="flex items-center gap-3 rounded-sm bg-[#172229] p-2" key={item.id}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-sm bg-[#0b1215] text-xs font-black" style={{ color: item.accent }}>
                {item.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-[11px] text-slate-100">{item.name}</strong>
                <small className="text-[10px] text-slate-500">${item.price}</small>
              </span>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase text-[#59d98e]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#59d98e]" />
          Categories
        </h2>
        <div className="rounded-sm bg-[#111a20] p-2 ring-1 ring-slate-700/50">
          {shopCategories.map((category) => {
            const active = selectedCategory === category.label

            return (
              <button
                className={`flex w-full items-center justify-between border-b border-slate-700/40 px-1 py-2 text-left transition last:border-b-0 hover:text-[#34d981] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34d981] ${
                  active ? 'text-[#34d981]' : 'text-slate-400'
                }`}
                key={category.label}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectCategory(category.label)}
              >
                <span className="text-[11px] uppercase">{category.label}</span>
                <span className={`text-[11px] font-semibold ${active ? 'text-[#34d981]' : 'text-slate-500'}`}>{category.count}</span>
              </button>
            )
          })}
        </div>
      </section>
    </aside>
  )
}







