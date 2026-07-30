const desktopPanelOrder = ['monitor', 'climate', 'comments', 'friends']
const desktopDockWidth = 174
const desktopDockGap = 8
const desktopDockRowGap = 8
const desktopDockRowHeight = 44

function viewportWidth() {
  return typeof window === 'undefined' ? 1440 : window.innerWidth
}

function viewportHeight() {
  return typeof window === 'undefined' ? 800 : window.innerHeight
}

export function panelExpandedPosition(id, width = viewportWidth(), height = viewportHeight()) {
  const positions = {
    monitor: { x: 268, y: 88 },
    climate: { x: 258, y: Math.max(88, height - 280) },
    comments: { x: Math.max(24, width - 400), y: 88 },
    friends: { x: Math.max(24, width - 380), y: Math.max(92, height - 420) },
  }

  return positions[id] ?? { x: 24, y: 88 }
}

export function panelDockPosition(id, width = viewportWidth(), height = viewportHeight()) {
  const index = Math.max(0, desktopPanelOrder.indexOf(id))
  const stageLeft = width >= 768 ? 244 : 0
  const stageWidth = Math.max(desktopDockWidth, width - stageLeft - 24)
  const columnLimit = width < 1040 ? 2 : desktopPanelOrder.length
  const columnCount = Math.max(
    1,
    Math.min(
      columnLimit,
      Math.floor((stageWidth + desktopDockGap) / (desktopDockWidth + desktopDockGap)),
    ),
  )
  const row = Math.floor(index / columnCount)
  const column = index % columnCount
  const rowCount = Math.ceil(desktopPanelOrder.length / columnCount)
  const itemsInRow = Math.min(columnCount, desktopPanelOrder.length - row * columnCount)
  const rowWidth = (itemsInRow * desktopDockWidth) + ((itemsInRow - 1) * desktopDockGap)
  const rowStart = stageLeft + Math.max(12, Math.round((width - stageLeft - rowWidth) / 2))
  const rowOffsetFromBottom = (rowCount - row - 1) * (desktopDockRowHeight + desktopDockRowGap)

  return {
    x: Math.min(
      Math.max(12, rowStart + column * (desktopDockWidth + desktopDockGap)),
      Math.max(12, width - desktopDockWidth - 12),
    ),
    y: Math.max(70, height - 56 - rowOffsetFromBottom),
  }
}

export function reflowWindowsForViewport(windows, width = viewportWidth(), height = viewportHeight()) {
  if (width < 768) return windows

  const panelWidths = { monitor: 360, climate: 520, friends: 360, comments: 370 }
  const shouldResponsiveCollapse = (id) => (
    (id === 'friends' && (width < 1120 || height < 720))
    || (id === 'comments' && width < 1040)
  )

  return Object.fromEntries(Object.entries(windows).map(([id, panel]) => {
    if (shouldResponsiveCollapse(id)) {
      return [id, {
        ...panel,
        ...panelDockPosition(id, width, height),
        collapsed: true,
        responsiveCollapsed: panel.collapsed ? Boolean(panel.responsiveCollapsed) : true,
      }]
    }

    if (panel.collapsed) {
      if (panel.responsiveCollapsed) {
        const fallback = panelExpandedPosition(id, width, height)
        const panelWidth = panelWidths[id] ?? 320
        const expandedX = Math.min(
          Math.max(12, fallback.x),
          Math.max(12, width - panelWidth - 12),
        )
        const expandedY = Math.min(
          Math.max(70, fallback.y),
          Math.max(70, height - 180),
        )

        return [id, {
          ...panel,
          x: expandedX,
          y: expandedY,
          expandedX,
          expandedY,
          collapsed: false,
          responsiveCollapsed: false,
        }]
      }

      return [id, { ...panel, ...panelDockPosition(id, width, height) }]
    }

    const fallback = panelExpandedPosition(id, width, height)
    const panelWidth = panelWidths[id] ?? 320
    const expandedX = Math.min(
      Math.max(12, Number(panel.expandedX ?? panel.x ?? fallback.x)),
      Math.max(12, width - panelWidth - 12),
    )
    const expandedY = Math.min(
      Math.max(70, Number(panel.expandedY ?? panel.y ?? fallback.y)),
      Math.max(70, height - 180),
    )

    return [id, {
      ...panel,
      x: expandedX,
      y: expandedY,
      expandedX,
      expandedY,
    }]
  }))
}

export function defaultWindows() {
  const width = viewportWidth()
  const height = viewportHeight()
  const isCompact = width < 768
  const isNarrowDesktop = width >= 768 && width < 1120
  const isTightDesktop = width >= 768 && width < 1040
  const monitor = panelExpandedPosition('monitor', width, height)
  const climate = panelExpandedPosition('climate', width, height)
  const friends = panelExpandedPosition('friends', width, height)
  const comments = panelExpandedPosition('comments', width, height)
  const friendsCollapsed = isCompact || isNarrowDesktop || height < 720
  const commentsCollapsed = isCompact || isTightDesktop
  const friendsCurrent = friendsCollapsed ? panelDockPosition('friends', width, height) : friends
  const commentsCurrent = commentsCollapsed ? panelDockPosition('comments', width, height) : comments

  return {
    monitor: {
      x: isCompact ? 16 : monitor.x,
      y: monitor.y,
      expandedX: isCompact ? 16 : monitor.x,
      expandedY: monitor.y,
      visible: true,
      collapsed: false,
      responsiveCollapsed: false,
    },
    climate: {
      x: isCompact ? 16 : climate.x,
      y: climate.y,
      expandedX: isCompact ? 16 : climate.x,
      expandedY: climate.y,
      visible: true,
      collapsed: false,
      responsiveCollapsed: false,
    },
    friends: {
      x: friendsCurrent.x,
      y: friendsCurrent.y,
      expandedX: friends.x,
      expandedY: friends.y,
      visible: true,
      collapsed: friendsCollapsed,
      responsiveCollapsed: friendsCollapsed,
    },
    comments: {
      x: commentsCurrent.x,
      y: commentsCurrent.y,
      expandedX: comments.x,
      expandedY: comments.y,
      visible: true,
      collapsed: commentsCollapsed,
      responsiveCollapsed: commentsCollapsed,
    },
  }
}


