import { AppIcon } from '../icons/IconifyIcon'
import { LibraryThumb } from './LibraryThumb'

export function LibrarySidebar({ sections, openSections, onToggle, onApply }) {
  return (
    <aside className="absolute bottom-0 left-0 top-16 z-40 w-[244px] overflow-hidden border-r border-lime-100/15 bg-[#101511]/95 text-slate-100" aria-label="Plant and item library">
      <div className="border-b border-lime-100/10 px-3 py-3">
        <strong className="block text-sm text-lime-50">Lab assets</strong>
        <span className="text-[11px] text-slate-400">drag or click to apply</span>
      </div>

      <div className="p-2">
        {Object.entries(sections).map(([section, items]) => {
          const expanded = openSections[section]

          return (
            <section className="mb-2" key={section}>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-lime-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
                type="button"
                aria-expanded={expanded}
                onClick={() => onToggle(section)}
              >
                <AppIcon className="h-4 w-4 shrink-0 text-slate-400" name={section === 'Plants' ? 'plant' : 'shop'} />
                <span className="flex-1 text-left">{section}</span>
                <AppIcon className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} name="arrowDown" />
              </button>

              {expanded && (
                <div className={`mt-2 rounded-md border border-lime-100/10 bg-black/20 p-2 ${section === 'Plants' ? 'grid gap-1.5' : 'grid grid-cols-2 gap-2'}`}>
                  {items.map((item) => (
                    <button
                      className={`group min-w-0 rounded-md border border-lime-100/10 bg-white/[0.045] text-left transition hover:border-lime-200/35 hover:bg-white/[0.075] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${section === 'Plants' ? 'flex items-center gap-2 p-2' : 'p-1.5'}`}
                      type="button"
                      draggable
                      data-lab-asset={item.id}
                      key={item.id}
                      onClick={() => onApply(item)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('application/x-lab-asset', JSON.stringify(item))
                        event.dataTransfer.effectAllowed = 'copy'
                      }}
                    >
                      {section === 'Plants' ? (
                        <>
                          <span className="w-12 shrink-0">
                            <LibraryThumb item={item} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate text-[12px] text-lime-50">{item.name}</strong>
                            <span className="block truncate text-[10px] text-slate-400">{item.detail}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-slate-400" aria-label={item.planted ? 'Planted' : 'Not planted'}>
                            <span className={`h-2.5 w-2.5 rounded-full ${item.planted ? 'bg-[#9bcf82] shadow-[0_0_0_3px_rgba(155,207,130,.12)]' : 'bg-red-400 shadow-[0_0_0_3px_rgba(248,113,113,.12)]'}`} />
                            {item.planted ? '\u0e1b\u0e25\u0e39\u0e01\u0e41\u0e25\u0e49\u0e27' : '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e1b\u0e25\u0e39\u0e01'}
                          </span>
                        </>
                      ) : (
                        <>
                          <LibraryThumb item={item} />
                          <strong className="mt-1.5 block truncate text-[11px] text-lime-50">{item.name}</strong>
                          <span className="block truncate text-[10px] text-slate-400">{item.detail}</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </aside>
  )
}
