import { AppIcon } from '../icons/IconifyIcon'

export function Panel({ id, title, subtitle, windows, setWindows, children, className = '', headerActions = null }) {
  const current = windows[id]

  if (!current.visible) return null

  const canDrag = id === 'climate'

  function clampPanelPosition(x, y) {
    return {
      x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - 96)),
      y: Math.min(Math.max(70, y), Math.max(70, window.innerHeight - 56)),
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

      if (id === 'friends') {
        return {
          ...value,
          [id]: {
            ...value[id],
            x: Math.max(24, window.innerWidth - 350),
            y: nextCollapsed ? Math.max(76, window.innerHeight - 72) : Math.max(92, window.innerHeight - 400),
            collapsed: nextCollapsed,
          },
        }
      }

      if (id === 'climate') {
        const dockY = Math.max(76, window.innerHeight - 56)
        const expandedY = value[id].expandedY ?? value[id].y

        return {
          ...value,
          [id]: {
            ...value[id],
            y: nextCollapsed ? dockY : expandedY,
            expandedY: nextCollapsed ? value[id].y : expandedY,
            collapsed: nextCollapsed,
          },
        }
      }

      return { ...value, [id]: { ...value[id], collapsed: nextCollapsed } }
    })
  }

  return (
    <section
      className={`absolute left-0 top-0 z-30 w-[320px] overflow-hidden rounded-lg border border-lime-100/15 bg-[#101511]/92 text-slate-100 shadow-[0_12px_28px_rgba(0,0,0,.36)] ${className}`}
      style={{ transform: `translate(${current.x}px, ${current.y}px)` }}
    >
      <header className={`flex h-11 items-center gap-3 border-b border-lime-100/10 bg-lime-100/[0.045] px-3 ${canDrag ? 'cursor-grab select-none active:cursor-grabbing' : ''}`} onPointerDown={startDrag}>
        <span className="h-6 w-1.5 rounded-full bg-[#9bcf82]" />
        <span className="min-w-0 flex-1 leading-none">
          <strong className="block truncate text-sm font-bold text-lime-50">{title}</strong>
          <small className="mt-1 block truncate text-[11px] text-slate-300">{subtitle}</small>
        </span>
        {headerActions && <div className="mr-1 flex items-center gap-1">{headerActions}</div>}
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
      {!current.collapsed && <div className="relative p-4">{children}</div>}
    </section>
  )
}

