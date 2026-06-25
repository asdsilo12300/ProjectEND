import { MetricIcon } from '../icons/MetricIcon'

export function IconBar({ label, value, icon, color, compact = false }) {
  return (
    <div className={`grid items-center text-slate-200 ${compact ? 'grid-cols-[28px_66px_1fr_30px] gap-2 text-xs' : 'grid-cols-[32px_70px_1fr_34px] gap-3 text-sm'}`}>
      <MetricIcon type={icon} color={color} label={`${label} icon`} size={compact ? 'sm' : 'md'} />
      <span>{label}</span>
      <div
        className={`${compact ? 'h-2.5' : 'h-3'} overflow-hidden rounded-sm border border-white/25 bg-black/55 shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]`}
        role="progressbar"
        aria-label={label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={value}
      >
        <div className="h-full rounded-[2px]" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <strong className="text-right text-lime-50">{value}</strong>
    </div>
  )
}
