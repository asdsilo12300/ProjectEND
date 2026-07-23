import { useEffect, useRef, useState } from 'react'

export function ShopToolbar({ copy, endIndex, sortMode, startIndex, totalCount, onSortChange }) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)
  const sortOptions = [
    { label: copy.sortDefault, value: 'default' },
    { label: copy.sortPriceDesc, value: 'price-desc' },
    { label: copy.sortPriceAsc, value: 'price-asc' },
    { label: copy.sortNameAsc, value: 'name-asc' },
    { label: copy.sortNameDesc, value: 'name-desc' },
  ]
  const currentOption = sortOptions.find((option) => option.value === sortMode) ?? sortOptions[0]

  useEffect(() => {
    if (!open) return undefined

    function closeFromOutside(event) {
      if (!dropdownRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('pointerdown', closeFromOutside)
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      window.removeEventListener('pointerdown', closeFromOutside)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function chooseSort(value) {
    onSortChange(value)
    setOpen(false)
  }

  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold text-slate-400" aria-live="polite">
        {totalCount ? copy.showing(startIndex, endIndex, totalCount) : copy.noResultsCount}
      </p>
      <div className="relative w-full sm:w-auto" ref={dropdownRef}>
        <button
          className={`inline-flex min-h-11 w-full min-w-48 items-center justify-between gap-2 rounded-xl border px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55dc91] sm:w-auto ${
            open
              ? 'border-[#55dc91]/70 bg-[#13241d] text-lime-50 shadow-[0_0_0_3px_rgba(52,217,129,.12)]'
              : 'border-[#34483c] bg-[#111a16] text-slate-300 hover:border-[#55dc91]/45 hover:text-slate-100'
          }`}
          type="button"
          aria-label={copy.sortLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((value) => !value)}
        >
          <span>{currentOption.label}</span>
          <span className={`text-xs text-slate-500 transition ${open ? 'rotate-180 text-[#55dc91]' : ''}`}>⌄</span>
        </button>

        {open && (
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-full min-w-56 overflow-hidden rounded-xl border border-[#55dc91]/25 bg-[#0b1210] p-1.5 shadow-[0_14px_34px_rgba(0,0,0,.52)] sm:w-56" role="listbox">
            {sortOptions.map((option) => {
              const active = option.value === sortMode

              return (
                <button
                  className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#55dc91] ${
                    active
                      ? 'bg-[#55dc91]/15 text-lime-50'
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
                  }`}
                  type="button"
                  key={option.value}
                  role="option"
                  aria-selected={active}
                  onClick={() => chooseSort(option.value)}
                >
                  <span>{option.label}</span>
                  {active && <span className="text-xs font-black uppercase text-[#55dc91]">{copy.selected}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
