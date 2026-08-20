import { useEffect, useState } from 'react'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { getAppLanguage } from '../../i18n/appI18n'
import { LibraryThumb } from './LibraryThumb'
import { LoadingSkeleton } from './LoadingSkeleton'

const ITEM_GROUPS = [
  {
    id: 'care',
    icon: 'drop',
    label: { en: 'Plant & weather care', th: 'อุปกรณ์ดูแลพืชและสภาพอากาศ' },
    detail: { en: 'Water, feed, and protect the active plant', th: 'ให้น้ำ ปุ๋ย และป้องกันพืชจากอากาศ' },
    shellClass: 'border-sky-200/12 bg-sky-300/[0.035]',
    iconClass: 'bg-sky-300/10 text-sky-200',
  },
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
    label: { en: 'Condition tools', th: 'เครื่องมือปรับสภาพ' },
    detail: { en: 'Local weather and growing-condition protection', th: 'ปรับสภาพและป้องกันสภาพอากาศรอบต้น' },
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
  const actionKey = String(item?.actionKey ?? itemId)
  if (item?.friendUsable || itemId.includes('prank')) return 'prank'
  if (
    itemId.includes('manual')
    || ['drainage', 'shade', 'windbreak', 'frost-cover'].includes(actionKey)
  ) return 'manual'
  if (['water', 'fertilizer'].includes(actionKey)) return 'care'
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

function activeItemSeconds(activeModifiers, actionKey, currentTime) {
  const expirations = (activeModifiers ?? [])
    .filter((modifier) => String(modifier?.action_key ?? modifier?.action?.action_key ?? '') === actionKey)
    .map((modifier) => Date.parse(modifier?.expires_at ?? ''))
    .filter((expiresAt) => Number.isFinite(expiresAt) && expiresAt > currentTime)

  if (expirations.length === 0) return null
  return Math.max(0, Math.ceil((Math.max(...expirations) - currentTime) / 1000))
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

function plantStatusLabel(item, language) {
  if (item.current) return language === 'th' ? 'กำลังปลูก' : 'Growing'
  if (item.planted) return language === 'th' ? 'ปลูกแล้ว' : 'Planted'
  if (item.readOnly) return language === 'th' ? 'ยังไม่ได้ปลูก' : 'Not planted'
  return language === 'th' ? 'พร้อมปลูก' : 'Ready'
}

function PlantLibraryCard({ item, itemLocked, itemName, language, lockLabel, onApply, onShowPlantInfo, selected, setDrawerOpen }) {
  const statusLabel = plantStatusLabel(item, language)
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
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-400" aria-label={statusLabel}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.current ? 'bg-[#9bcf82] shadow-[0_0_0_3px_rgba(155,207,130,.16)]' : item.planted ? 'bg-sky-300 shadow-[0_0_0_3px_rgba(125,211,252,.12)]' : item.readOnly ? 'bg-rose-400 shadow-[0_0_0_3px_rgba(251,113,133,.12)]' : 'bg-slate-500 shadow-[0_0_0_3px_rgba(100,116,139,.12)]'}`} />
            <span className="shrink-0">{statusLabel}</span>
          </span>
        </span>
      </button>
      <button
        aria-label={language === 'th' ? `เปิดคู่มือพืช ${itemName}` : `Open ${itemName} plant guide`}
        className="mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-lime-100/12 bg-black/20 text-slate-400 transition hover:border-emerald-200/30 hover:bg-emerald-300/10 hover:text-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
        onClick={() => onShowPlantInfo?.(item)}
        data-tour="lab-plant-guide-button"
        title={language === 'th' ? `คู่มือพืช: ${itemName}` : `Plant guide: ${itemName}`}
        type="button"
      >
        <AppIcon className="h-3.5 w-3.5" name="help" />
      </button>
    </div>
  )
}

function ItemLibraryCard({ activeModifiers, currentTime, item, inventoryMap, language, mockItems, onApply, readOnly, friendHasPlant, growingMode, plantNeeds, seasonalAvailableActions, selectedAsset, setDrawerOpen }) {
  const itemName = language === 'th' ? (item.nameTh || readableItemName(item)) : readableItemName(item)
  const itemDetail = language === 'th' ? (item.detailTh || item.detail) : item.detail
  const successText = language === 'th' ? (item.successTextTh || item.successText) : item.successText
  const failText = language === 'th' ? (item.failTextTh || item.failText) : item.failText
  const helpText = language === 'th' ? (item.helpTh || item.help) : item.help
  const itemQuantity = inventoryMap[item.itemKey ?? item.id] ?? item.quantity
  const hasInventoryQuantity = Number.isFinite(Number(itemQuantity))
  const quantityBadge = hasInventoryQuantity ? `x${itemQuantity}` : item.quantityLabel ?? 'x0'
  const isZeroQuantity = hasInventoryQuantity && Number(itemQuantity) <= 0
  const ownGardenPrank = !readOnly && item.friendUsable
  const friendItemUnsupported = readOnly && !item.friendUsable
  const friendGardenEmpty = readOnly && item.friendUsable && !friendHasPlant
  const wrongGrowingMode = !readOnly
    && ['greenhouse', 'outdoor'].includes(item.modeScope)
    && Boolean(growingMode)
    && item.modeScope !== growingMode
    && !(growingMode === 'seasonal' && item.modeScope === 'outdoor')
  const actionKey = String(item.actionKey ?? item.itemKey ?? item.id)
  const activeSeconds = activeItemSeconds(activeModifiers, actionKey, currentTime)
  const temporaryEffectActive = activeSeconds !== null
  const isBasicPlantSupply = ['water', 'fertilizer'].includes(actionKey)
  const seasonalEmergencyUnavailable = !readOnly
    && growingMode === 'seasonal'
    && ['drainage', 'shade', 'windbreak', 'frost-cover'].includes(actionKey)
    && !seasonalAvailableActions?.has(actionKey)
  const reserveFull = !readOnly
    && ['water', 'fertilizer'].includes(actionKey)
    && Number(plantNeeds?.[actionKey] ?? -1) >= 100
  const itemLocked = mockItems || isZeroQuantity || ownGardenPrank || friendItemUnsupported || friendGardenEmpty || wrongGrowingMode || seasonalEmergencyUnavailable || reserveFull || temporaryEffectActive
  const selected = selectedAsset?.id === item.id
  const lockLabel = ownGardenPrank
    ? (language === 'th' ? 'ใช้ได้เมื่อเยี่ยมชมสวนของเพื่อนเท่านั้น' : 'Available only while visiting a friend garden')
    : friendItemUnsupported
    ? (language === 'th' ? 'ที่สวนเพื่อนใช้ได้เฉพาะไอเท็มแกล้งเพื่อน' : 'Only friend prank items can be used here')
    : friendGardenEmpty
      ? (language === 'th' ? 'เพื่อนคนนี้ไม่มีพืชที่กำลังปลูกให้แกล้ง' : 'This friend has no active plant to prank')
      : mockItems
        ? (language === 'th' ? 'เครื่องมือของเพื่อนดูได้เท่านั้น' : 'Friend tools are view-only')
        : wrongGrowingMode
          ? (language === 'th'
              ? `ใช้ได้เฉพาะ${item.modeScope === 'outdoor' ? 'โหมดกลางแจ้ง' : 'โหมดควบคุมสภาพแวดล้อม'}`
              : `${item.modeScope === 'outdoor' ? 'Outdoor' : 'Environment Control'} mode only`)
        : seasonalEmergencyUnavailable
          ? (language === 'th'
              ? 'เครื่องมือนี้จะใช้ได้เมื่อมีคำเตือนฤดูกาลที่ตรงกัน'
              : 'Available when a matching seasonal warning is active')
        : reserveFull
          ? (language === 'th'
              ? actionKey === 'water' ? 'หลอดน้ำสำรองเต็มแล้ว' : 'หลอดธาตุอาหารเต็มแล้ว'
              : actionKey === 'water' ? 'Water reserve is full' : 'Nutrient reserve is full')
        : isZeroQuantity
          ? (language === 'th' ? 'สินค้าหมด — ไปที่ร้านค้าเพื่อซื้อเพิ่ม' : 'Out of stock — visit Shop to get more')
          : temporaryEffectActive
            ? (language === 'th' ? `กำลังทำงาน เหลือ ${activeSeconds} วินาที` : `Active for ${activeSeconds} more seconds`)
            : undefined

  return (
    <button
      className={`group relative min-w-0 rounded-md border p-1.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${selected && !itemLocked ? 'border-lime-200/45 bg-[#9bcf82]/12 shadow-[inset_0_0_0_1px_rgba(155,207,130,.16)]' : 'border-lime-100/10 bg-white/[0.045]'} ${itemLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-lime-200/35 hover:bg-white/[0.075]'}`}
      type="button"
      disabled={itemLocked}
      data-lab-asset={item.id}
      aria-disabled={itemLocked}
      aria-pressed={selected}
      title={lockLabel ?? helpText}
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
      {seasonalEmergencyUnavailable && (
        <span
          className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full border border-amber-200/25 bg-[#241d0d]/90 text-amber-200 shadow-[0_3px_10px_rgba(0,0,0,.35)]"
          aria-label={lockLabel}
        >
          <AppIcon className="h-2.5 w-2.5" name="lock" />
        </span>
      )}
      {temporaryEffectActive && (
        <span
          className="absolute right-2 top-2 inline-flex min-w-[42px] items-center justify-center gap-1 rounded-full border border-cyan-100/25 bg-[#09242a]/95 px-1.5 py-1 text-[10px] font-black tabular-nums text-cyan-100 shadow-[0_4px_12px_rgba(0,0,0,.4)]"
          aria-label={lockLabel}
          role="timer"
        >
          <AppIcon className="h-2.5 w-2.5" name="clock" />
          {language === 'th' ? `${activeSeconds} วิ` : `${activeSeconds}s`}
        </span>
      )}
      <strong className="mt-1.5 block truncate text-xs text-lime-50">{itemName}</strong>
      {(!isBasicPlantSupply || mockItems || isZeroQuantity) && (
        <span className="block truncate text-xs text-slate-400">{mockItems ? (language === 'th' ? 'เร็ว ๆ นี้' : 'Coming soon') : isZeroQuantity ? (language === 'th' ? 'สินค้าหมด' : 'Out of stock') : itemDetail}</span>
      )}
      {!isBasicPlantSupply && !mockItems && (successText || failText) && (
        <span className="pointer-events-none absolute left-1.5 right-1.5 top-[54px] z-30 rounded-md border border-lime-100/15 bg-[#07100b]/95 p-2 text-xs leading-relaxed text-slate-200 opacity-0 shadow-[0_10px_22px_rgba(0,0,0,.42)] transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="block font-black text-lime-100">{successText}</span>
          <span className="block text-slate-400">{failText}</span>
        </span>
      )}
      {mockItems && (
        <span className="mt-1 block rounded border border-lime-100/10 bg-black/25 px-1.5 py-0.5 text-xs font-semibold text-slate-400">
          {language === 'th' ? 'เร็ว ๆ นี้' : 'Coming soon'}
        </span>
      )}
    </button>
  )
}

export function LibrarySidebar({ activeEvents = [], activeModifiers = [], busy = false, error = '', friendHasPlant = true, growingMode = null, loading = false, plantNeeds = null, readOnly = false, mockItems = false, seasonalContext = null, selectedAsset = null, inventoryMap = {}, sections, openSections, onToggle, onApply, onShowPlantInfo }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeItemGroup, setActiveItemGroup] = useState('care')
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const language = useAppLanguage()
  const effectiveItemGroup = readOnly ? 'prank' : activeItemGroup

  useEffect(() => {
    if (!(activeModifiers ?? []).some((modifier) => Boolean(modifier?.expires_at))) return undefined
    const immediateTimer = window.setTimeout(() => setCurrentTime(Date.now()), 0)
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => {
      window.clearTimeout(immediateTimer)
      window.clearInterval(timer)
    }
  }, [activeModifiers])

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
        {language === 'th' ? 'อุปกรณ์ห้องทดลอง' : 'Lab assets'}
      </button>
      <aside id="lab-asset-library" className="lab-library-drawer absolute bottom-0 left-0 top-16 z-40 flex w-[244px] flex-col overflow-hidden border-r border-lime-100/15 bg-[#101511]/95 text-slate-100" data-open={drawerOpen ? 'true' : 'false'} data-tour="lab-assets" aria-label={language === 'th' ? 'คลังพืชและไอเทม' : 'Plant and item library'}>
        <div className="flex shrink-0 items-center gap-3 border-b border-lime-100/10 px-3 py-3">
          <span className="min-w-0 flex-1">
            <strong className="block text-sm text-lime-50">{language === 'th' ? 'อุปกรณ์ห้องทดลอง' : 'Lab assets'}</strong>
            <span className="text-xs text-slate-400">{readOnly
              ? (language === 'th' ? 'ดูพืชที่ปลูกหรือเลือกไอเทมแกล้งเพื่อน' : 'view planted species or choose a prank')
              : (language === 'th' ? 'จัดการพืชที่ปลูกหรือเลือกวิธีดูแล' : 'manage planted species or choose a treatment')}</span>
          </span>
          <button type="button" className="lab-library-close" aria-label={language === 'th' ? 'ปิดอุปกรณ์ห้องทดลอง' : 'Close Lab assets'} onClick={() => setDrawerOpen(false)}>
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
          const sectionLabel = section === 'Items'
            ? language === 'th' ? 'เครื่องมือ' : 'Tools'
            : section === 'Plants'
              ? language === 'th' ? 'พืช' : 'Plants'
              : section
          const recommendedActions = new Set([
            seasonalContext?.current?.recommended_action,
            seasonalContext?.forecast?.[0]?.recommended_action,
            ...activeEvents.flatMap((event) => event.response_action_keys ?? []),
          ].filter(Boolean))
          // Keep seasonal emergency tools visible so players can learn what is
          // available. Individual cards stay locked until a matching warning.
          const visibleItems = items
          const groupedItems = section === 'Items'
            ? ITEM_GROUPS
              .map((group) => ({ ...group, items: visibleItems.filter((item) => itemGroupId(item) === group.id) }))
              .filter((group) => group.items.length > 0)
            : []
          const selectedGroup = groupedItems.find((group) => group.id === effectiveItemGroup) ?? groupedItems[0]

          return (
            <section className="mb-2 min-w-0 max-w-full" data-tour={section === 'Plants' ? 'lab-plants' : 'lab-items'} key={section}>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-lime-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
                type="button"
                aria-expanded={expanded}
                onClick={() => onToggle(section)}
              >
                <AppIcon className="h-4 w-4 shrink-0 text-slate-400" name={section === 'Plants' ? 'plant' : 'shop'} />
                <span className="flex-1 text-left">{sectionLabel}</span>
                <AppIcon className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} name="arrowDown" />
              </button>

              {expanded && (
                <div className={`mt-2 min-w-0 max-w-full overflow-hidden rounded-md border border-lime-100/10 bg-black/20 p-2 ${section === 'Plants' ? 'grid gap-1.5' : 'grid gap-2'}`}>
                  {loading && (
                    <div className={section === 'Items' ? 'col-span-2' : ''}>
                      <LoadingSkeleton count={section === 'Plants' ? 2 : 4} label={language === 'th' ? `กำลังโหลด${section === 'Plants' ? 'พืช' : 'เครื่องมือ'}` : `Loading ${section.toLowerCase()}`} variant="list" />
                    </div>
                  )}
                  {!loading && visibleItems.length === 0 && (
                    <div className={`${section === 'Items' ? 'col-span-2' : ''} rounded-md border border-dashed border-lime-100/15 bg-[#101511]/70 px-3 py-3 text-center`}>
                      <strong className="block text-xs text-lime-50">{language === 'th' ? `ยังไม่มี${section === 'Plants' ? 'พืช' : 'เครื่องมือ'}ในฐานข้อมูล` : `No ${section.toLowerCase()} in database`}</strong>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{language === 'th' ? 'เพิ่มข้อมูลในฐานข้อมูลเพื่อเปิดใช้งานส่วนนี้' : 'Run the seeder or add records to enable this section.'}</span>
                    </div>
                  )}
                  {!loading && section === 'Items' && groupedItems.length > 0 && (
                    <nav className="grid grid-cols-4 gap-1.5" aria-label={language === 'th' ? 'หมวดเครื่องมือ' : 'Tool categories'}>
                      {groupedItems.map((group) => (
                        <button
                          key={group.id}
                          type="button"
                          aria-label={`${group.label[language]} — ${group.detail[language]} (${group.items.length})`}
                          aria-pressed={selectedGroup?.id === group.id}
                          className={`relative grid h-10 min-w-0 place-items-center rounded-md border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${selectedGroup?.id === group.id ? `${group.shellClass} border-lime-200/35 text-lime-50` : 'border-white/10 bg-black/15 text-slate-400 hover:border-white/20 hover:text-slate-200'}`}
                          onClick={() => setActiveItemGroup(group.id)}
                          title={`${group.label[language]} — ${group.detail[language]}`}
                        >
                          <AppIcon className={`h-4 w-4 ${selectedGroup?.id === group.id ? group.iconClass.split(' ').at(-1) : ''}`} name={group.icon} />
                          <span className="absolute right-1 top-1 min-w-4 rounded-full bg-black/35 px-1 py-0.5 text-center text-[9px] font-black leading-none">{group.items.length}</span>
                        </button>
                      ))}
                    </nav>
                  )}
                  {!loading && section === 'Items' && selectedGroup && (
                    <section className={`min-w-0 max-w-full overflow-hidden rounded-lg border p-1.5 ${selectedGroup.shellClass}`} key={selectedGroup.id} data-item-group={selectedGroup.id}>
                      <header className="mb-1.5 flex min-w-0 items-center gap-2 px-1 py-1">
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${selectedGroup.iconClass}`}>
                          <AppIcon className="h-3.5 w-3.5" name={selectedGroup.icon} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block text-[12px] font-extrabold leading-tight text-lime-50">{selectedGroup.label[language]}</strong>
                          <span className="mt-0.5 block text-[11px] leading-tight text-slate-400">{selectedGroup.detail[language]}</span>
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] font-bold text-slate-300" aria-label={language === 'th' ? `${selectedGroup.items.length} ไอเทม` : `${selectedGroup.items.length} items`}>
                          {selectedGroup.items.length}
                        </span>
                      </header>
                      <div className="grid min-w-0 max-w-full grid-cols-2 gap-1.5">
                        {selectedGroup.items.map((item) => (
                          <ItemLibraryCard
                            activeModifiers={activeModifiers}
                            currentTime={currentTime}
                            friendHasPlant={friendHasPlant}
                            growingMode={growingMode}
                            inventoryMap={inventoryMap}
                            item={item}
                            key={item.id}
                            language={language}
                            mockItems={mockItems}
                            onApply={onApply}
                            plantNeeds={plantNeeds}
                            readOnly={readOnly}
                            seasonalAvailableActions={recommendedActions}
                            selectedAsset={selectedAsset}
                            setDrawerOpen={setDrawerOpen}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                  {!loading && section === 'Plants' && visibleItems.map((item) => {
                    const itemName = localizedPlantName(item, language)
                    const friendPlantUnavailable = readOnly && !item.planted
                    const itemLocked = busy || friendPlantUnavailable
                    const lockLabel = friendPlantUnavailable
                      ? (language === 'th' ? 'เพื่อนคนนี้ยังไม่ได้ปลูกพืชชนิดนี้' : 'This friend has not planted this species')
                      : busy
                        ? (language === 'th' ? 'กำลังบันทึกพืชปัจจุบัน' : 'Saving the current plant')
                        : undefined

                    return (
                      <PlantLibraryCard
                        item={{ ...item, readOnly }}
                        itemLocked={itemLocked}
                        itemName={itemName}
                        language={language}
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
