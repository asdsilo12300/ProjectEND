import { AppIcon } from '../../icons/FontAwesomeIcon'

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

export function ShopPagination({ copy, currentPage, pageCount, onPageChange }) {
  if (pageCount <= 1) return null

  return (
    <nav className="mt-7 flex shrink-0 flex-wrap justify-center gap-2" aria-label={copy.pageLabel}>
      {pageWindow(currentPage, pageCount).map((page, index) => {
        if (typeof page === 'string') {
          return (
            <span className="grid h-11 min-w-11 place-items-center rounded-xl bg-[#111a16] px-2 text-xs text-slate-500 ring-1 ring-[#34483c]" key={`${page}-${index}`}>
              ...
            </span>
          )
        }

        const active = page === currentPage

        return (
          <button
            className={`grid h-11 min-w-11 place-items-center rounded-xl px-2 text-sm font-bold ring-1 ring-[#34483c] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#55dc91] ${
              active ? 'bg-[#55dc91] text-[#08110c]' : 'bg-[#111a16] text-slate-300 hover:bg-white/[0.06] hover:text-slate-100'
            }`}
            type="button"
            key={page}
            aria-current={active ? 'page' : undefined}
            aria-label={copy.pageNumber(page)}
            onClick={() => onPageChange(page)}
          >
            {formatPage(page)}
          </button>
        )
      })}
      <button
        className="grid h-11 min-w-11 place-items-center rounded-xl bg-[#111a16] px-2 text-xs text-slate-300 ring-1 ring-[#34483c] transition hover:bg-white/[0.06] hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#55dc91]"
        type="button"
        aria-label={copy.nextPage}
        disabled={currentPage >= pageCount}
        onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
      >
        <AppIcon className="h-3.5 w-3.5" name="arrowForward" />
      </button>
    </nav>
  )
}
