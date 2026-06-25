import { AppIcon } from '../../icons/IconifyIcon'

export function ShopToolbar({ count }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Showing 1 - {count} of 18 results
      </p>
      <button className="inline-flex items-center gap-2 rounded-sm bg-[#111a20] px-3 py-2 text-[11px] font-semibold text-slate-400 ring-1 ring-slate-700/60 transition hover:text-slate-100" type="button">
        Default sorting
        <AppIcon className="h-3.5 w-3.5" name="arrowDown" />
      </button>
    </div>
  )
}
