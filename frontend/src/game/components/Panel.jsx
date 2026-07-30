import { AppIcon } from '../icons/FontAwesomeIcon'
import { panelDockPosition, panelExpandedPosition } from '../utils/windows'

export function Panel({ id, title, subtitle, windows, setWindows, children, className = '', headerActions = null }) {
  const current = windows[id]

  if (!current.visible) return null

  const canDrag = id === 'climate' && !current.collapsed
  const panelWidths = { monitor: 360, climate: 520, friends: 360, comments: 370 }
  const currentWidth = panelWidths[id] ?? 320
  const lowerPanelTop = Object.entries(windows)
    .filter(([panelId, panel]) => {
      if (panelId === id || !panel.visible || panel.collapsed || panel.y <= current.y) return false
      const panelWidth = panelWidths[panelId] ?? 320
      return current.x < panel.x + panelWidth && current.x + currentWidth > panel.x
    })
    .map(([, panel]) => panel.y)
    .sort((first, second) => first - second)[0]
  const dockTop = Object.entries(windows)
    .filter(([panelId, panel]) => panelId !== id && panel.visible && panel.collapsed)
    .map(([, panel]) => panel.y)
    .sort((first, second) => first - second)[0]
  const viewportHeight = window.innerHeight - current.y - 12
  const collisionHeight = lowerPanelTop == null ? viewportHeight : lowerPanelTop - current.y - 8
  const dockHeight = dockTop == null || dockTop <= current.y
    ? viewportHeight
    : dockTop - current.y - 8
  const availableHeight = Math.max(96, Math.min(viewportHeight, collisionHeight, dockHeight))

  function clampPanelPosition(x, y) {
    return {
      x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - 96)),
      y: Math.min(Math.max(70, y), Math.max(70, window.innerHeight - 180)),
    }
  }

  function startDrag(event) {
    if (!canDrag || event.button !== 0) return
    if (event.target.closest('button, a, input, textarea, select')) return

    event.preventDefault()

    const startX = event.clientX
    const startY = event.clientY
    const startPanelX = current.x
    const startPanelY = current.y
    let frame = 0

    function movePanel(moveEvent) {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const next = clampPanelPosition(
          startPanelX + moveEvent.clientX - startX,
          startPanelY + moveEvent.clientY - startY,
        )

        setWindows((value) => ({
          ...value,
          [id]: {
            ...value[id],
            x: next.x,
            y: next.y,
            expandedX: next.x,
            expandedY: next.y,
          },
        }))
      })
    }

    function stopDrag() {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', movePanel)
      window.removeEventListener('pointerup', stopDrag)
      window.removeEventListener('pointercancel', stopDrag)
    }

    window.addEventListener('pointermove', movePanel)
    window.addEventListener('pointerup', stopDrag, { once: true })
    window.addEventListener('pointercancel', stopDrag, { once: true })
  }

  function toggleCollapse(event) {
    event.stopPropagation()
    setWindows((value) => {
      const nextCollapsed = !value[id].collapsed

      if (window.matchMedia('(max-width: 767px)').matches && !nextCollapsed) {
        return Object.fromEntries(Object.entries(value).map(([panelId, panel]) => [
          panelId,
          {
            ...panel,
            visible: panelId === id ? true : panel.visible,
            collapsed: panelId === id ? false : true,
          },
        ]))
      }

      const panel = value[id]
      const fallbackExpanded = panelExpandedPosition(id)
      const expanded = {
        x: Number(panel.expandedX ?? fallbackExpanded.x),
        y: Number(panel.expandedY ?? fallbackExpanded.y),
      }
      const nextPosition = nextCollapsed ? panelDockPosition(id) : expanded

      return {
        ...value,
        [id]: {
          ...panel,
          ...nextPosition,
          expandedX: nextCollapsed ? panel.x : expanded.x,
          expandedY: nextCollapsed ? panel.y : expanded.y,
          collapsed: nextCollapsed,
          responsiveCollapsed: false,
        },
      }
    })
  }

  return (
    <section
      className={`lab-panel absolute left-0 top-0 z-30 w-[320px] overflow-hidden rounded-lg border border-lime-100/15 bg-[#101511]/92 text-slate-100 shadow-[0_12px_28px_rgba(0,0,0,.36)] ${className}`}
      data-panel-id={id}
      data-panel-collapsed={current.collapsed ? 'true' : 'false'}
      style={{
        transform: `translate(${current.x}px, ${current.y}px)`,
        maxHeight: current.collapsed ? 44 : availableHeight,
      }}
    >
      <header className={`group flex h-11 items-center gap-3 border-b border-lime-100/10 bg-lime-100/[0.045] px-3 ${canDrag ? 'cursor-grab select-none active:cursor-grabbing' : ''}`} onPointerDown={startDrag}>
        <span className="lab-panel__accent h-6 w-1.5 rounded-full" />
        <span className="min-w-0 flex-1 leading-none">
          <strong className="block truncate text-sm font-bold text-lime-50">{title}</strong>
          <small className="lab-panel__subtitle mt-1 block truncate text-xs text-slate-300">{subtitle}</small>
        </span>
        {headerActions && <div className="lab-panel__header-actions mr-1 flex items-center gap-1">{headerActions}</div>}
        {canDrag && (
          <span
            className="lab-panel__drag-handle mr-1 grid h-7 w-7 place-items-center rounded-md border border-lime-100/10 bg-white/[0.04] text-lime-100/70 transition group-hover:border-lime-100/20 group-hover:bg-white/[0.07] group-hover:text-lime-100"
            aria-label={`Drag ${title} panel`}
            title="Drag to move"
          >
            <AppIcon className="h-3.5 w-3.5" name="move" />
          </span>
        )}
        <button
          type="button"
          className="grid h-6 w-6 place-items-center rounded-md border border-lime-100/15 bg-white/5 text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-200"
          aria-label={`${current.collapsed ? 'Expand' : 'Collapse'} ${title}`}
          aria-expanded={!current.collapsed}
          onClick={toggleCollapse}
        >
          <AppIcon className={`h-4 w-4 transition ${current.collapsed ? 'rotate-180' : ''}`} name="arrowUp" />
        </button>
      </header>
      {!current.collapsed && <div className="lab-panel__body relative overflow-y-auto p-4" style={{ maxHeight: Math.max(52, availableHeight - 44) }}>{children}</div>}
    </section>
  )
}

