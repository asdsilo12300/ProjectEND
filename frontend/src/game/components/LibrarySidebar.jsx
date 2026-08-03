import { useEffect, useState } from 'react'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { getAppLanguage } from '../../i18n/appI18n'
import { LibraryThumb } from './LibraryThumb'
import { LoadingSkeleton } from './LoadingSkeleton'

const ITEM_GROUPS = [
  {
    id: 'treatment',
    icon: 'shield',
    label: { en: 'Plant treatments', th: 'อุปกรณ์รักษาพืช' },
    detail: { en: 'Match a spray to the detected pest', th: 'เลือกสเปรย์ให้ตรงกับศัตรูพืช' },
    shellClass: 'border-emerald-200/12 bg-emerald-300/[0.035]',
    iconClass: 'bg-emerald-300/10 text-emerald-200',
  },
  {
    id: 'manual',
    icon: 'tool',
    label: { en: 'Manual tools', th: 'เครื่องมือกำจัดด้วยมือ' },
    detail: { en: 'Remove aphids or snails by hand', th: 'กำจัดเพลี้ยหรือหอยโดยไม่ใช้สเปรย์' },
    shellClass: 'border-amber-200/12 bg-amber-300/[0.035]',
    iconClass: 'bg-amber-300/10 text-amber-200',
  },
  {
    id: 'prank',
    icon: 'groups',
    label: { en: 'Friend pranks', th: 'ไอเทมแกล้งเพื่อน' },
    detail: { en: 'Use only while visiting a friend garden', th: 'ใช้เมื่อเข้าไปเยี่ยมสวนของเพื่อน' },
    shellClass: 'border-violet-200/12 bg-violet-300/[0.035]',
    iconClass: 'bg-violet-300/10 text-violet-200',
  },
]

function useAppLanguage() {
  const [language, setLanguage] = useState(() => getAppLanguage() === 'th' ? 'th' : 'en')

  useEffect(() => {
    function updateLanguage(event) {
      setLanguage(event?.detail?.language === 'th' || getAppLanguage() === 'th' ? 'th' : 'en')
    }

    window.addEventListener('plant-settings-change', updateLanguage)
    return () => window.removeEventListener('plant-settings-change', updateLanguage)
  }, [])

  return language
}

function itemGroupId(item) {
  const itemId = String(item?.itemKey ?? item?.id ?? '').toLowerCase()
  if (item?.friendUsable || itemId.includes('prank')) return 'prank'
  if (itemId === 'hand-pick' || itemId.includes('manual')) return 'manual'
  return 'treatment'
}

function hasBrokenEncoding(value) {
  const text = String(value ?? '')
  return text.includes('\u00c3') || text.includes('\u00c2') || text.includes('\u00e0') || text.includes('\ufffd')
}

function readableItemName(item) {
  const name = String(item?.name ?? '').trim()
  if (item?.id === 'sprout' && (!name || hasBrokenEncoding(name))) return 'Elephant Ear'
  return name || 'Plant'
}

function localizedPlantName(item, language) {
  const plant = item?.plantData ?? item ?? {}
  const preferredName = language === 'th' ? plant.name_th : plant.name_en
  const fallbackName = language === 'th' ? plant.name_en : plant.name_th
  const name = String(preferredName ?? fallbackName ?? item?.name ?? '').trim()

  if (!name || hasBrokenEncoding(name) || ['Simulation Sprout', 'Sprout'].includes(name)) {
    return language === 'th' ? 'ต้นหูช้าง' : 'Elephant Ear'
  }

  return name
}

function PlantLibraryCard({ item, itemLocked, itemName, lockLabel, onApply, onShowPlantInfo, selected, setDrawerOpen }) {
  return (
    <div
      className={`group relative flex min-w-0 items-center rounded-md border transition ${selected && !itemLocked ? 'border-lime-200/45 bg-[#9bcf82]/12 shadow-[inset_0_0_0_1px_rgba(155,207,130,.16)]' : 'border-lime-100/10 bg-white/[0.045]'} ${itemLocked ? 'opacity-70' : 'hover:border-lime-200/35 hover:bg-white/[0.075]'}`}
      data-plant-current={item.current ? 'true' : 'false'}
      data-tour="lab-plant-card"
    >
      <button
        aria-disabled={itemLocked}
        aria-pressed={selected}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded-l-md p-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${itemLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        data-lab-asset={item.id}
        disabled={itemLocked}
        onClick={() => {
          if (!itemLocked) {
            onApply(item)
            setDrawerOpen(false)
          }
        }}
        title={lockLabel ?? item.help}
        type="button"
      >
        <span className="w-12 shrink-0">
          <LibraryThumb item={item} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-[12px] text-lime-50" data-i18n-skip="true">{itemName}</strong>
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-400" aria-label={item.current ? 'Growing now' : item.planted ? 'Planted' : item.readOnly ? 'Not planted' : 'Ready to plant'}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.current ? 'bg-[#9bcf82] shadow-[0_0_0_3px_rgba(155,207,130,.16)]' : item.planted ? 'bg-sky-300 shadow-[0_0_0_3px_rgba(125,211,252,.12)]' : item.readOnly ? 'bg-rose-400 shadow-[0_0_0_3px_rgba(251,113,133,.12)]' : 'bg-slate-500 shadow-[0_0_0_3px_rgba(100,116,139,.12)]'}`} />
            <span className="shrink-0">{item.current ? 'Growing' : item.planted ? 'Planted' : item.readOnly ? 'Not planted' : 'Ready'}</span>
          </span>
        </span>
      </button>
      <button
        aria-label={`Open ${itemName} plant guide`}
        className="mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-lime-100/12 bg-black/20 text-slate-400 transition hover:border-emerald-200/30 hover:bg-emerald-300/10 hover:text-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
        onClick={() => onShowPlantInfo?.(item)}
        data-tour="lab-plant-guide-button"
        title={`Plant guide: ${itemName}`}
        type="button"
      >
        <AppIcon className="h-3.5 w-3.5" name="help" />
      </button>
    </div>
  )
}

function ItemLibraryCard({ item, inventoryMap, mockItems, onApply, readOnly, friendHasPlant, selectedAsset, setDrawerOpen }) {
  const itemName = readableItemName(item)
  const itemQuantity = inventoryMap[item.itemKey ?? item.id] ?? item.quantity
  const hasInventoryQuantity = Number.isFinite(Number(itemQuantity))
  const quantityBadge = hasInventoryQuantity ? `x${itemQuantity}` : item.quantityLabel ?? 'x0'
  const isZeroQuantity = hasInventoryQuantity && Number(itemQuantity) <= 0
  const ownGardenPrank = !readOnly && item.friendUsable
  const friendItemUnsupported = readOnly && !item.friendUsable
  const friendGardenEmpty = readOnly && item.friendUsable && !friendHasPlant
  const itemLocked = mockItems || isZeroQuantity || ownGardenPrank || friendItemUnsupported || friendGardenEmpty
  const selected = selectedAsset?.id === item.id
  const lockLabel = ownGardenPrank
    ? 'Available only while visiting a friend garden'
    : friendItemUnsupported
    ? 'Only friend prank items can be used here'
    : friendGardenEmpty
      ? 'This friend has no active plant to prank'
      : mockItems
        ? 'Friend tools are view-only'
        : isZeroQuantity
          ? 'Out of stock — visit Shop to get more'
          : undefined

  return (
    <button
      className={`group relative min-w-0 rounded-md border p-1.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${selected && !itemLocked ? 'border-lime-200/45 bg-[#9bcf82]/12 shadow-[inset_0_0_0_1px_rgba(155,207,130,.16)]' : 'border-lime-100/10 bg-white/[0.045]'} ${itemLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-lime-200/35 hover:bg-white/[0.075]'}`}
      type="button"
      disabled={itemLocked}
      data-lab-asset={item.id}
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
      <LibraryThumb item={item} display="contain" />
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
    </button>
  )
}

export function LibrarySidebar({ busy = false, error = '', friendHasPlant = true, loading = false, readOnly = false, mockItems = false, selectedAsset = null, inventoryMap = {}, sections, openSections, onToggle, onApply, onShowPlantInfo }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const language = useAppLanguage()

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
      <aside id="lab-asset-library" className="lab-library-drawer absolute bottom-0 left-0 top-16 z-40 flex w-[244px] flex-col overflow-hidden border-r border-lime-100/15 bg-[#101511]/95 text-slate-100" data-open={drawerOpen ? 'true' : 'false'} data-tour="lab-assets" aria-label="Plant and item library">
        <div className="flex shrink-0 items-center gap-3 border-b border-lime-100/10 px-3 py-3">
          <span className="min-w-0 flex-1">
            <strong className="block text-sm text-lime-50">Lab assets</strong>
            <span className="text-xs text-slate-400">{readOnly ? 'view planted species or choose a prank' : 'manage planted species or choose a treatment'}</span>
          </span>
          <button type="button" className="lab-library-close" aria-label="Close Lab assets" onClick={() => setDrawerOpen(false)}>
            <AppIcon className="h-4 w-4" name="panelClose" />
          </button>
        </div>

      <div className="game-themed-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-2">
        {error ? (
          <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-200/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-50" role="status">
            <AppIcon className="mt-0.5 h-4 w-4 shrink-0" name="warning" />
            <span>{error}</span>
          </div>
        ) : null}
        {Object.entries(sections).map(([section, items]) => {
          const expanded = openSections[section]
          const visibleItems = items
          const groupedItems = section === 'Items'
            ? ITEM_GROUPS
              .map((group) => ({ ...group, items: visibleItems.filter((item) => itemGroupId(item) === group.id) }))
              .filter((group) => group.items.length > 0)
            : []

          return (
            <section className="mb-2 min-w-0 max-w-full" data-tour={section === 'Plants' ? 'lab-plants' : 'lab-items'} key={section}>
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
                <div className={`mt-2 min-w-0 max-w-full overflow-hidden rounded-md border border-lime-100/10 bg-black/20 p-2 ${section === 'Plants' ? 'grid gap-1.5' : 'grid gap-2'}`}>
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
                  {!loading && section === 'Items' && groupedItems.map((group) => (
                    <section className={`min-w-0 max-w-full overflow-hidden rounded-lg border p-1.5 ${group.shellClass}`} key={group.id} data-item-group={group.id}>
                      <header className="mb-1.5 flex min-w-0 items-center gap-2 px-1 py-1">
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${group.iconClass}`}>
                          <AppIcon className="h-3.5 w-3.5" name={group.icon} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-[11px] font-extrabold text-lime-50">{group.label[language]}</strong>
                          <span className="block truncate text-[10px] text-slate-400">{group.detail[language]}</span>
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] font-bold text-slate-300" aria-label={`${group.items.length} items`}>
                          {group.items.length}
                        </span>
                      </header>
                      <div className="grid min-w-0 max-w-full grid-cols-2 gap-1.5">
                        {group.items.map((item) => (
                          <ItemLibraryCard
                            friendHasPlant={friendHasPlant}
                            inventoryMap={inventoryMap}
                            item={item}
                            key={item.id}
                            mockItems={mockItems}
                            onApply={onApply}
                            readOnly={readOnly}
                            selectedAsset={selectedAsset}
                            setDrawerOpen={setDrawerOpen}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                  {!loading && section === 'Plants' && visibleItems.map((item) => {
                    const itemName = localizedPlantName(item, language)
                    const friendPlantUnavailable = readOnly && !item.planted
                    const itemLocked = busy || friendPlantUnavailable
                    const lockLabel = friendPlantUnavailable
                      ? 'This friend has not planted this species'
                      : busy
                        ? 'Saving the current plant'
                        : undefined

                    return (
                      <PlantLibraryCard
                        item={{ ...item, readOnly }}
                        itemLocked={itemLocked}
                        itemName={itemName}
                        key={item.id}
                        lockLabel={lockLabel}
                        onApply={onApply}
                        onShowPlantInfo={onShowPlantInfo}
                        selected={Boolean(item.current)}
                        setDrawerOpen={setDrawerOpen}
                      />
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
