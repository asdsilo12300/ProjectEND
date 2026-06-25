import { AppIcon } from '../icons/IconifyIcon'

const pestIconMap = {
  snail: 'snail',
  aphid: 'aphid',
  fungus: 'fungus',
}

export function PestChance({ label, value, icon, color }) {
  return (
    <div className="min-w-0 rounded-md border border-lime-100/10 bg-white/[0.045] p-2">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#101511]" style={{ backgroundColor: color }}>
          <AppIcon className="h-4 w-4" name={pestIconMap[icon] ?? 'pest'} />
        </span>
        <span className="truncate text-[11px] font-semibold text-lime-50">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="h-2 flex-1 overflow-hidden rounded-sm border border-white/20 bg-black/45"
          role="progressbar"
          aria-label={`${label} chance`}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={value}
        >
          <div className="h-full rounded-[2px]" style={{ width: `${value}%`, backgroundColor: color }} />
        </div>
        <strong className="w-7 text-right text-[11px] text-lime-50">{value}%</strong>
      </div>
    </div>
  )
}
