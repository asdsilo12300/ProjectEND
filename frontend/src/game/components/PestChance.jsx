import { AppIcon } from '../icons/FontAwesomeIcon'

const pestIconMap = {
  snail: 'snail',
  aphid: 'aphid',
  fungus: 'fungus',
}

export function PestChance({ label, value, icon, color, imageUrl, active = false }) {
  return (
    <div className={`min-w-0 overflow-hidden rounded-md border p-2 transition ${active ? 'border-amber-300/45 bg-amber-300/[0.08] shadow-[inset_0_0_0_1px_rgba(252,211,77,.08)]' : 'border-lime-100/10 bg-white/[0.045]'}`}>
      <div className="mb-2 grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-x-1.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md text-[#101511]" style={{ backgroundColor: color }}>
          {imageUrl ? (
            <img className="h-full w-full object-contain p-0.5" src={imageUrl} alt="" draggable="false" />
          ) : (
            <AppIcon className="h-4 w-4" name={pestIconMap[icon] ?? 'pest'} />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold leading-tight text-lime-50">{label}</span>
          {active && (
            <span className="mt-1 inline-flex max-w-full items-center overflow-hidden rounded bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-black leading-none tracking-[0.04em] text-amber-200">
              ACTIVE
            </span>
          )}
        </span>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_1.75rem] items-center gap-2">
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
        <strong className="min-w-0 text-right text-xs leading-none text-lime-50">{value}%</strong>
      </div>
    </div>
  )
}
