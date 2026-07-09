import { AppIcon } from '../../icons/IconifyIcon'

function formatPage(page) {
  return String(page).padStart(2, '0')
}

function pageWindow(currentPage, pageCount) {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const start = Math.max(1, Math.min(currentPage - 1, pageCount - 3))
  const pages = [start, start + 1, start + 2]

  if (start > 1) pages.unshift('start-gap')
  if (start + 2 < pageCount) pages.push('end-gap')

  return [1, ...pages.filter((page) => page !== 1 && page !== pageCount), pageCount]
}

export function ShopPagination({ currentPage, pageCount, onPageChange }) {
  if (pageCount <= 1) return null

  return (
    <nav className="mt-5 flex shrink-0 justify-center gap-2" aria-label="Shop pages">
      {pageWindow(currentPage, pageCount).map((page, index) => {
        if (typeof page === 'string') {
          return (
            <span className="grid h-8 min-w-8 place-items-center rounded-sm bg-[#111a20] px-2 text-xs text-slate-500 ring-1 ring-slate-700/50" key={`${page}-${index}`}>
              ...
            </span>
          )
        }

        const active = page === currentPage

        return (
          <button
            className={`grid h-8 min-w-8 place-items-center rounded-sm px-2 text-xs font-bold ring-1 ring-slate-700/50 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#34d981] ${
              active ? 'bg-[#34d981] text-[#08110c]' : 'bg-[#111a20] text-slate-400 hover:text-slate-100'
            }`}
            type="button"
            key={page}
            aria-current={active ? 'page' : undefined}
            onClick={() => onPageChange(page)}
          >
            {formatPage(page)}
          </button>
        )
      })}
      <button
        className="grid h-8 min-w-8 place-items-center rounded-sm bg-[#111a20] px-2 text-xs text-slate-400 ring-1 ring-slate-700/50 transition hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#34d981]"
        type="button"
        aria-label="Next page"
        disabled={currentPage >= pageCount}
        onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
      >
        <AppIcon className="h-3.5 w-3.5" name="arrowForward" />
      </button>
    </nav>
  )
}
