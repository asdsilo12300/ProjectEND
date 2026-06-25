import { AppIcon } from '../../icons/IconifyIcon'

export function ShopPagination() {
  const pages = ['01', '02', '03']

  return (
    <nav className="mt-5 flex shrink-0 justify-center gap-2" aria-label="Shop pages">
      <button className="grid h-8 min-w-8 place-items-center rounded-sm bg-[#111a20] px-2 text-xs text-slate-500 ring-1 ring-slate-700/50" type="button">01</button>
      {pages.slice(1).map((page, index) => (
        <button
          className={`grid h-8 min-w-8 place-items-center rounded-sm px-2 text-xs font-bold ring-1 ring-slate-700/50 ${index === 0 ? 'bg-[#34d981] text-[#08110c]' : 'bg-[#111a20] text-slate-400'}`}
          type="button"
          key={page}
        >
          {page}
        </button>
      ))}
      <button className="grid h-8 min-w-8 place-items-center rounded-sm bg-[#111a20] px-2 text-xs text-slate-400 ring-1 ring-slate-700/50" type="button">...</button>
      <button className="grid h-8 min-w-8 place-items-center rounded-sm bg-[#111a20] px-2 text-xs text-slate-400 ring-1 ring-slate-700/50" type="button">18</button>
      <button className="grid h-8 min-w-8 place-items-center rounded-sm bg-[#111a20] px-2 text-xs text-slate-400 ring-1 ring-slate-700/50" type="button" aria-label="Next page">
        <AppIcon className="h-3.5 w-3.5" name="arrowForward" />
      </button>
    </nav>
  )
}
