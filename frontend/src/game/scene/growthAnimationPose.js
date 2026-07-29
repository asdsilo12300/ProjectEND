import { useEffect, useLayoutEffect } from 'react'
import { LoopOnce } from 'three'

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

/**
 * Keeps a GLTF growth clip at the pose dictated by canonical simulation
 * progress. The clip never advances by wall-clock time, so it cannot outrun a
 * Slow or Paused growth calculation and never needs to reset on API updates.
 */
export function useGrowthAnimationPose(actions, mixer, growthProgress, maximumFraction = 1) {
  const targetProgress = clamp01(growthProgress) * clamp01(maximumFraction)

  useLayoutEffect(() => {
    const availableActions = Object.values(actions).filter(Boolean)
    if (availableActions.length === 0) return

    availableActions.forEach((action) => {
      const duration = action.getClip().duration
      action.enabled = true
      action.setLoop(LoopOnce, 1)
      action.clampWhenFinished = true
      action.play()
      action.paused = true
      action.time = Math.min(duration, Math.max(0, duration * targetProgress))
    })

    // Evaluate the new pose immediately without advancing animation time.
    mixer.update(0)
  }, [actions, mixer, targetProgress])

  useEffect(() => () => {
    Object.values(actions).forEach((action) => action?.stop?.())
  }, [actions])
}
