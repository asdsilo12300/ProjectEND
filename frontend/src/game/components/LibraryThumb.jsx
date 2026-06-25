import { AppIcon } from '../icons/IconifyIcon'

const libraryIconMap = {
  sprout: 'sprout',
  vine: 'vine',
  leaf: 'leaf',
  fern: 'fern',
  drop: 'drop',
  bolt: 'bolt',
  plus: 'plus',
  soil: 'soil',
}

export function LibraryThumb({ item }) {
  return (
    <span className="grid h-12 w-full place-items-center rounded-md border border-black/20 text-[#101511]" style={{ backgroundColor: item.color }}>
      <AppIcon className="h-8 w-8" name={libraryIconMap[item.icon] ?? 'leaf'} />
    </span>
  )
}
