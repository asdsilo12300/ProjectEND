export function defaultWindows() {
  const width = typeof window === 'undefined' ? 1440 : window.innerWidth
  const height = typeof window === 'undefined' ? 800 : window.innerHeight
  const hasLowerDockSpace = height >= 820

  return {
    monitor: { x: 268, y: 88, visible: true, collapsed: false },
    climate: {
      x: hasLowerDockSpace ? 258 : Math.max(24, width - 450),
      y: hasLowerDockSpace ? Math.max(76, height - 190) : 88,
      visible: true,
      collapsed: false,
    },
    friends: { x: Math.max(24, width - 350), y: Math.max(76, height - 72), visible: true, collapsed: true },
    comments: { x: Math.max(24, width - 400), y: hasLowerDockSpace ? 88 : 282, visible: true, collapsed: false },
  }
}


