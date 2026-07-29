import { useState } from 'react'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { LibraryThumb } from './LibraryThumb'
import { LoadingSkeleton } from './LoadingSkeleton'

function hasBrokenEncoding(value) {
  const text = String(value ?? '')
  return text.includes('\u00c3') || text.includes('\u00c2') || text.includes('\u00e0') || text.includes('\ufffd')
}

function readableItemName(item) {
  const name = String(item?.name ?? '').trim()
  if (item?.id === 'sprout' && (!name || hasBrokenEncoding(name))) return 'Elephant Ear'
  return name || 'Plant'
}

export function LibrarySidebar({ busy = false, error = '', friendHasPlant = true, loading = false, readOnly = false, mockItems = false, selectedAsset = null, inventoryMap = {}, sections, openSections, onToggle, onApply }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="lab-library-toggle"
        aria-controls="lab-asset-library"
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen((value) => !value)}
      >
        <AppIcon className="h-4 w-4" name="plant" />
        Lab assets
      </button>
      <aside id="lab-asset-library" className="lab-library-drawer absolute bottom-0 left-0 top-16 z-40 w-[244px] overflow-visible border-r border-lime-100/15 bg-[#101511]/95 text-slate-100" data-open={drawerOpen ? 'true' : 'false'} data-tour="lab-assets" aria-label="Plant and item library">
        <div className="flex items-center gap-3 border-b border-lime-100/10 px-3 py-3">
          <span className="min-w-0 flex-1">
            <strong className="block text-sm text-lime-50">Lab assets</strong>
            <span className="text-xs text-slate-400">{readOnly ? 'view planted species or choose a prank' : 'manage planted species or choose a treatment'}</span>
          </span>
          <button type="button" className="lab-library-close" aria-label="Close Lab assets" onClick={() => setDrawerOpen(false)}>
            <AppIcon className="h-4 w-4" name="panelClose" />
          </button>
        </div>

      <div className="p-2">
        {error ? (
          <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-200/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-50" role="status">
            <AppIcon className="mt-0.5 h-4 w-4 shrink-0" name="warning" />
            <span>{error}</span>
          </div>
        ) : null}
        {Object.entries(sections).map(([section, items]) => {
          const expanded = openSections[section]
          const visibleItems = items

          return (
            <section className="mb-2" data-tour={section === 'Plants' ? 'lab-plants' : 'lab-items'} key={section}>
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
                  {loading && (
                    <div className={section === 'Items' ? 'col-span-2' : ''}>
                      <LoadingSkeleton count={section === 'Plants' ? 2 : 4} label={`Loading ${section.toLowerCase()}`} variant="list" />
                    </div>
                  )}
                  {!loading && visibleItems.length === 0 && (
                    <div className={`${section === 'Items' ? 'col-span-2' : ''} rounded-md border border-dashed border-lime-100/15 bg-[#101511]/70 px-3 py-3 text-center`}>
                      <strong className="block text-xs text-lime-50">No {section.toLowerCase()} in database</strong>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">Run the seeder or add records to enable this section.</span>
                    </div>
                  )}
                  {!loading && visibleItems.map((item) => {
                    const itemName = readableItemName(item)
                    const itemQuantity = section === 'Items' ? (inventoryMap[item.itemKey ?? item.id] ?? item.quantity) : null
                    const hasInventoryQuantity = Number.isFinite(Number(itemQuantity))
                    const quantityBadge = section === 'Items'
                      ? hasInventoryQuantity
                        ? `x${itemQuantity}`
                        : item.quantityLabel ?? 'x0'
                      : null
                    const isZeroQuantity = hasInventoryQuantity && Number(itemQuantity) <= 0
                    const friendPlantUnavailable = readOnly && section === 'Plants' && !item.planted
                    const friendItemUnsupported = readOnly && section === 'Items' && !item.friendUsable
                    const friendGardenEmpty = readOnly && section === 'Items' && item.friendUsable && !friendHasPlant
                    const itemLocked = (section === 'Plants' && (busy || friendPlantUnavailable))
                      || (section === 'Items' && (mockItems || isZeroQuantity || friendItemUnsupported || friendGardenEmpty))
                    const selected = section === 'Plants' ? Boolean(item.current) : selectedAsset?.id === item.id
                    const lockLabel = friendPlantUnavailable
                      ? 'This friend has not planted this species'
                      : friendItemUnsupported
                        ? 'Only friend prank items can be used here'
                        : friendGardenEmpty
                          ? 'This friend has no active plant to prank'
                        : section === 'Plants' && busy
                        ? 'Saving the current plant'
                        : section === 'Items' && mockItems
                          ? 'Friend tools are view-only'
                          : isZeroQuantity
                            ? 'Out of stock — visit Shop to get more'
                            : undefined

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
                          if (!itemLocked) {
                            onApply(item)
                            setDrawerOpen(false)
                          }
                        }}
                      >
                        {section === 'Plants' ? (
                          <>
                            <span className="w-12 shrink-0">
                              <LibraryThumb item={item} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <strong className="block truncate text-[12px] text-lime-50">{itemName}</strong>
                              <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-400" aria-label={item.current ? 'Growing now' : item.planted ? 'Planted' : readOnly ? 'Not planted' : 'Ready to plant'}>
                                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.current ? 'bg-[#9bcf82] shadow-[0_0_0_3px_rgba(155,207,130,.16)]' : item.planted ? 'bg-sky-300 shadow-[0_0_0_3px_rgba(125,211,252,.12)]' : readOnly ? 'bg-rose-400 shadow-[0_0_0_3px_rgba(251,113,133,.12)]' : 'bg-slate-500 shadow-[0_0_0_3px_rgba(100,116,139,.12)]'}`} />
                                <span className="shrink-0">{item.current ? 'Growing' : item.planted ? 'Planted' : readOnly ? 'Not planted' : 'Ready'}</span>
                              </span>
                            </span>
                          </>
                        ) : (
                          <>
                            <LibraryThumb item={item} />
                            {quantityBadge && (
                              <span className={`absolute left-2 top-2 rounded-full px-1.5 py-0.5 text-xs font-black shadow-[0_3px_8px_rgba(0,0,0,.32)] ${isZeroQuantity ? 'bg-red-400 text-[#101511]' : 'bg-[#9bcf82] text-[#101511]'}`}>
                                {quantityBadge}
                              </span>
                            )}
                            <strong className="mt-1.5 block truncate text-xs text-lime-50">{itemName}</strong>
                            <span className="block truncate text-xs text-slate-400">{mockItems ? 'Coming soon' : isZeroQuantity ? 'Out of stock' : item.detail}</span>
                            {!mockItems && (item.successText || item.failText) && (
                              <span className="pointer-events-none absolute left-1.5 right-1.5 top-[54px] z-30 rounded-md border border-lime-100/15 bg-[#07100b]/95 p-2 text-xs leading-relaxed text-slate-200 opacity-0 shadow-[0_10px_22px_rgba(0,0,0,.42)] transition group-hover:opacity-100 group-focus-visible:opacity-100">
                                <span className="block font-black text-lime-100">{item.successText}</span>
                                <span className="block text-slate-400">{item.failText}</span>
                              </span>
                            )}
                            {mockItems && (
                              <span className="mt-1 block rounded border border-lime-100/10 bg-black/25 px-1.5 py-0.5 text-xs font-semibold text-slate-400">
                                Coming soon
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
        </div>
      </aside>
    </>
  )
}
