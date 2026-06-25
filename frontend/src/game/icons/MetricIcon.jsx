import { AppIcon } from './IconifyIcon'

const metricIconMap = {
  heart: 'heart',
  leaf: 'leaf',
  shield: 'shield',
  drop: 'drop',
  bolt: 'bolt',
  plus: 'plus',
  soil: 'soil',
  wind: 'wind',
  temp: 'temp',
}

export function MetricIcon({ type, color, label, className = '', size = 'md' }) {
  const boxClass = size === 'sm' ? 'h-7 w-7 rounded-md' : 'h-8 w-8 rounded-md'
  const iconClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <span className={`grid shrink-0 place-items-center text-[#101511] ${boxClass}`} style={{ backgroundColor: color }}>
      <AppIcon className={`${iconClass} ${className}`} label={label} name={metricIconMap[type] ?? 'leaf'} />
    </span>
  )
}
