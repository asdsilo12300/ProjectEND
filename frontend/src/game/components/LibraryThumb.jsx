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
        <AppIcon className="h-8 w-8" name={libraryIconMap[item.icon] ?? 'leaf'} />
      )}
      <TargetBadges targets={item.targetImages} />
    </span>
  )
}

