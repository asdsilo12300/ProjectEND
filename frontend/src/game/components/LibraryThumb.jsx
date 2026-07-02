import { AppIcon } from '../icons/IconifyIcon'

const libraryIconMap = {
  sprout: 'sprout',
  vine: 'vine',
  leaf: 'leaf',
  fern: 'fern',
  hand: 'tool',
}

export function LibraryThumb({ item }) {
  return (
    <span className="grid h-12 w-full place-items-center overflow-hidden rounded-md border border-black/20 text-[#101511]" style={{ backgroundColor: item.color }}>
      {item.imageUrl ? (
        <img className="h-full w-full object-contain p-1.5" src={item.imageUrl} alt="" draggable="false" />
      ) : (
        <AppIcon className="h-8 w-8" name={libraryIconMap[item.icon] ?? 'leaf'} />
      )}
    </span>
  )
}
