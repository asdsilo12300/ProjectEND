import { AppIcon } from '../icons/IconifyIcon'
import { LibraryThumb } from './LibraryThumb'

export function LibrarySidebar({ plantLocked = false, readOnly = false, mockItems = false, selectedAsset = null, inventoryMap = {}, sections, openSections, onToggle, onApply }) {
  return (
    <aside className="absolute bottom-0 left-0 top-16 z-40 w-[244px] overflow-visible border-r border-lime-100/15 bg-[#101511]/95 text-slate-100" aria-label="Plant and item library">
      <div className="border-b border-lime-100/10 px-3 py-3">
        <strong className="block text-sm text-lime-50">Lab assets</strong>
        <span className="text-[11px] text-slate-400">{readOnly ? 'view only tools' : 'click to select'}</span>
      </div>

      <div className="p-2">
        {Object.entries(sections).map(([section, items]) => {
          const expanded = openSections[section]
          const visibleItems = section === 'Plants' ? items.slice(0, 1) : items

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
                  {visibleItems.map((item) => {
                    const itemLocked = readOnly || (section === 'Plants' && plantLocked) || (section === 'Items' && mockItems)
                    const selected = selectedAsset?.id === item.id
                    const lockLabel = section === 'Plants'
                      ? readOnly ? 'Friend plant is view only' : 'A plant is already growing'
                      : mockItems ? 'Coming soon: pest prank item' : undefined
                    const itemQuantity = section === 'Items' ? inventoryMap[item.itemKey ?? item.id] : null
                    const hasInventoryQuantity = Number.isFinite(Number(itemQuantity))
                    const quantityBadge = section === 'Items'
                      ? hasInventoryQuantity
                        ? `x${itemQuantity}`
                        : item.quantityLabel ?? 'x0'
                      : null
                    const isZeroQuantity = hasInventoryQuantity && Number(itemQuantity) <= 0

                    return (
                      <button
                        className={`group relative min-w-0 rounded-md border text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${selected && !itemLocked ? 'border-lime-200/45 bg-[#9bcf82]/12 shadow-[inset_0_0_0_1px_rgba(155,207,130,.16)]' : 'border-lime-100/10 bg-white/[0.045]'} ${itemLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-lime-200/35 hover:bg-white/[0.075]'} ${section === 'Plants' ? 'flex items-center gap-2 p-2' : 'p-1.5'}`}
                        type="button"
                        disabled={itemLocked}
                        data-lab-asset={item.id}
                        key={item.id}
                        aria-disabled={itemLocked}
                        aria-pressed={selected}
                        title={lockLabel ?? item.help}
                        onClick={() => {
                          if (!itemLocked) onApply(item)
                        }}
                      >
                        {section === 'Plants' ? (
                          <>
                            <span className="w-12 shrink-0">
                              <LibraryThumb item={item} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <strong className="block truncate text-[12px] text-lime-50">{item.name}</strong>
                              <span className="block truncate text-[10px] text-slate-400">{readOnly ? 'Friend plant' : item.detail}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-slate-400" aria-label={item.planted ? 'Planted' : 'Not planted'}>
                              <span className={`h-2.5 w-2.5 rounded-full ${item.planted ? 'bg-[#9bcf82] shadow-[0_0_0_3px_rgba(155,207,130,.12)]' : 'bg-red-400 shadow-[0_0_0_3px_rgba(248,113,113,.12)]'}`} />
                              {item.planted ? '\u0e1b\u0e25\u0e39\u0e01\u0e41\u0e25\u0e49\u0e27' : '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e1b\u0e25\u0e39\u0e01'}
                            </span>
                          </>
                        ) : (
                          <>
                            <LibraryThumb item={item} />
                            {quantityBadge && (
                              <span className={`absolute left-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-black shadow-[0_3px_8px_rgba(0,0,0,.32)] ${isZeroQuantity ? 'bg-red-400 text-[#101511]' : 'bg-[#9bcf82] text-[#101511]'}`}>
                                {quantityBadge}
                              </span>
                            )}
                            <strong className="mt-1.5 block truncate text-[11px] text-lime-50">{item.name}</strong>
                            <span className="block truncate text-[10px] text-slate-400">{mockItems ? 'mock prank item' : item.detail}</span>
                            {!mockItems && (item.successText || item.failText) && (
                              <span className="pointer-events-none absolute left-1.5 right-1.5 top-[54px] z-30 rounded-md border border-lime-100/15 bg-[#07100b]/95 p-2 text-[9px] leading-relaxed text-slate-200 opacity-0 shadow-[0_10px_22px_rgba(0,0,0,.42)] transition group-hover:opacity-100 group-focus-visible:opacity-100">
                                <span className="block font-black text-lime-100">{item.successText}</span>
                                <span className="block text-slate-400">{item.failText}</span>
                              </span>
                            )}
                            {mockItems && (
                              <span className="mt-1 block rounded border border-lime-100/10 bg-black/25 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
                                Coming soon
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    )
                  })}
                  {section === 'Plants' && (
                    <div className="rounded-md border border-dashed border-lime-100/15 bg-[#101511]/70 px-3 py-3 text-center">
                      <strong className="block text-[11px] text-lime-50">More plants coming soon</strong>
                      <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-400">Please wait for the next update.</span>
                    </div>
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </aside>
  )
}
