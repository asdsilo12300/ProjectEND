import { AppIcon } from '../icons/FontAwesomeIcon'

const pestIconMap = {
  snail: 'snail',
  aphid: 'aphid',
  fungus: 'fungus',
}

export function PestChance({ label, value, icon, color, imageUrl, active = false, onOpen }) {
  return (
    <button
      aria-label={`Open ${label} pest guide`}
      className={`group min-w-0 overflow-hidden rounded-lg border px-2 py-1.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${active ? 'border-amber-300/45 bg-amber-300/[0.08] shadow-[inset_0_0_0_1px_rgba(252,211,77,.08)] hover:border-amber-200/70' : 'border-lime-100/10 bg-white/[0.045] hover:border-sky-200/30 hover:bg-sky-300/[0.055]'}`}
      onClick={onOpen}
      title={`Open ${label} knowledge and treatment guide`}
      type="button"
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="grid h-11 w-14 shrink-0 place-items-center overflow-hidden rounded-md border border-white/10 text-[#101511]" style={{ backgroundColor: color }}>
          {imageUrl ? (
            <img className="h-full w-full object-cover" src={imageUrl} alt="" draggable="false" />
          ) : (
            <AppIcon className="h-6 w-6" name={pestIconMap[icon] ?? 'pest'} />
          )}
        </span>
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.045]">
          <AppIcon className="h-3 w-3 text-slate-500 transition group-hover:text-sky-200" name="help" />
        </span>
      </div>
      <span className="mt-1 block truncate text-[13px] font-bold leading-4 text-lime-50" title={label}>{label}</span>
      <div className="mt-1.5 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <span className={`min-w-0 truncate text-[9px] font-black uppercase leading-none ${active ? 'text-amber-200' : 'text-slate-400'}`}>
          {active ? 'ACTIVE' : 'RISK'}
        </span>
        <strong className="shrink-0 text-right text-xs leading-none text-lime-50">{value}%</strong>
      </div>
      <div className="mt-1 min-w-0">
        <div
          className="h-2 min-w-0 overflow-hidden rounded-sm border border-white/20 bg-black/45"
          role="progressbar"
          aria-label={`${label} risk${active ? ', currently active' : ''}`}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={value}
        >
          <div className="h-full rounded-[2px]" style={{ width: `${value}%`, backgroundColor: color }} />
        </div>
      </div>
    </button>
  )
}
