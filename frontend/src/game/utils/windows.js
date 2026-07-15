export function defaultWindows() {
  const width = typeof window === 'undefined' ? 1440 : window.innerWidth
  const height = typeof window === 'undefined' ? 800 : window.innerHeight
  const isCompact = width < 768
  const hasLowerDockSpace = height >= 820

  return {
    monitor: { x: isCompact ? 16 : 268, y: 88, visible: true, collapsed: false },
    climate: {
      x: isCompact ? 16 : hasLowerDockSpace ? 258 : Math.max(24, width - 560),
      y: hasLowerDockSpace ? Math.max(76, height - 190) : 88,
      visible: true,
      collapsed: true,
    },
    friends: { x: Math.max(24, width - 350), y: Math.max(76, height - 124), visible: true, collapsed: true },
    comments: { x: Math.max(24, width - 400), y: hasLowerDockSpace ? 88 : 144, visible: true, collapsed: true },
  }
}


