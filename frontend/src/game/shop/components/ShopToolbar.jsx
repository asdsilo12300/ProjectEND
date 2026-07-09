import { useEffect, useRef, useState } from 'react'

const sortOptions = [
  { label: 'Default sorting', value: 'default' },
  { label: 'Price high to low', value: 'price-desc' },
  { label: 'Price low to high', value: 'price-asc' },
  { label: 'Name A-Z', value: 'name-asc' },
  { label: 'Name Z-A', value: 'name-desc' },
]

export function ShopToolbar({ endIndex, sortMode, startIndex, totalCount, onSortChange }) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)
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
    <div className="mb-5 flex items-center justify-between gap-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Showing {startIndex} - {endIndex} of {totalCount} results
      </p>
      <div className="relative" ref={dropdownRef}>
        <button
          className={`inline-flex h-8 min-w-36 items-center justify-between gap-2 rounded border px-2.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34d981] ${
            open
              ? 'border-[#34d981]/70 bg-[#13241d] text-lime-50 shadow-[0_0_0_3px_rgba(52,217,129,.12)]'
              : 'border-slate-700/70 bg-[#111a20] text-slate-300 hover:border-[#34d981]/45 hover:text-slate-100'
          }`}
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((value) => !value)}
        >
          <span>{currentOption.label}</span>
          <span className={`text-xs text-slate-500 transition ${open ? 'rotate-180 text-[#34d981]' : ''}`}>v</span>
        </button>

        {open && (
          <div className="absolute right-0 top-9 z-50 w-44 overflow-hidden rounded border border-[#34d981]/25 bg-[#0b1215] p-1 shadow-[0_14px_34px_rgba(0,0,0,.42)]" role="listbox">
            {sortOptions.map((option) => {
              const active = option.value === sortMode

              return (
                <button
                  className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#34d981] ${
                    active
                      ? 'bg-[#34d981]/15 text-lime-50'
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
                  }`}
                  type="button"
                  key={option.value}
                  role="option"
                  aria-selected={active}
                  onClick={() => chooseSort(option.value)}
                >
                  <span>{option.label}</span>
                  {active && <span className="text-[9px] font-black uppercase text-[#34d981]">Set</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
