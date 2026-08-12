import { AppIcon } from '../icons/FontAwesomeIcon'

const libraryIconMap = {
  sprout: 'sprout',
  vine: 'vine',
  leaf: 'leaf',
  fern: 'fern',
  hand: 'tool',
  bug: 'bug',
  snail: 'snail',
}

const actionIconMap = {
  water: 'drop',
  fertilizer: 'fertilizer',
  drainage: 'soil',
  shade: 'shade',
  windbreak: 'wind',
  'frost-cover': 'frost',
}

function TargetBadges({ targets }) {
  if (!targets?.length) return null

  return (
    <span className="absolute right-1 top-1 flex items-center gap-0.5" aria-hidden="true">
      {targets.slice(0, 2).map((target) => (
        <span className="grid h-5 w-5 place-items-center rounded-full border border-white/55 bg-[#101511]/85 p-0.5 shadow-[0_2px_4px_rgba(0,0,0,.28)]" key={target.label} title={target.label}>
          <img className="h-full w-full object-contain" src={target.imageUrl} alt="" draggable="false" />
        </span>
      ))}
    </span>
  )
}

export function LibraryThumb({ item, display = 'cover' }) {
  const showFullImage = display === 'contain'
  const actionKey = item.actionKey ?? item.itemKey ?? ''
  const fallbackIcon = actionIconMap[actionKey] ?? libraryIconMap[item.icon] ?? 'leaf'

  return (
    <span
      className={`relative grid w-full place-items-center overflow-hidden rounded-md border border-black/20 text-[#101511] ${showFullImage ? 'h-16' : 'h-12'}`}
      style={{ backgroundColor: item.color }}
    >
      {item.imageUrl ? (
        <img
          className={`h-full w-full object-center ${showFullImage ? 'object-contain p-1' : 'object-cover'}`}
          src={item.imageUrl}
          alt=""
          draggable="false"
        />
      ) : (
        <span className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white/30 shadow-[0_5px_14px_rgba(18,64,35,.12)]">
          <AppIcon className="h-6 w-6" name={fallbackIcon} />
        </span>
      )}
      <TargetBadges targets={item.targetImages} />
    </span>
  )
}

