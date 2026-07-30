import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { LoopOnce } from 'three'

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

function normalizedOptions(value) {
  if (typeof value === 'number') {
    return {
      maximumFraction: clamp01(value),
      startFrame: null,
      endFrame: null,
      framesPerSecond: null,
      excludedFrames: [],
      progressExponent: 1,
      transitionResponse: 0,
    }
  }

  const startFrame = Number(value?.startFrame)
  const endFrame = Number(value?.endFrame)
  const framesPerSecond = Number(value?.framesPerSecond)

  return {
    maximumFraction: clamp01(value?.maximumFraction ?? 1),
    startFrame: Number.isFinite(startFrame) ? Math.max(0, startFrame) : null,
    endFrame: Number.isFinite(endFrame) ? Math.max(0, endFrame) : null,
    framesPerSecond: Number.isFinite(framesPerSecond) && framesPerSecond > 0
      ? framesPerSecond
      : null,
    excludedFrames: Array.isArray(value?.excludedFrames)
      ? value.excludedFrames.map(Number).filter(Number.isFinite)
      : [],
    progressExponent: Math.max(0.05, Number(value?.progressExponent) || 1),
    transitionResponse: Math.max(0, Number(value?.transitionResponse) || 0),
  }
}

function actionTimeAtProgress(action, progress, options) {
  const duration = action.getClip().duration
  const curvedProgress = clamp01(progress) ** options.progressExponent
  const usesSafeFrameWindow = options.startFrame !== null
    && options.endFrame !== null
    && options.framesPerSecond !== null

  if (usesSafeFrameWindow) {
    const firstFrame = Math.min(options.startFrame, options.endFrame)
    const lastFrame = Math.max(options.startFrame, options.endFrame)
    // Uploaded clips can contain unstable compensated bone transforms between
    // authored frames. Selecting an exact baked frame prevents Three.js from
    // interpolating through invalid intermediate matrices.
    const desiredFrame = firstFrame + (lastFrame - firstFrame) * curvedProgress
    let frame = Math.round(desiredFrame)
    if (options.excludedFrames.includes(frame)) {
      const direction = desiredFrame >= frame ? 1 : -1
      let candidate = frame
      do {
        candidate += direction
      } while (
        candidate >= firstFrame
        && candidate <= lastFrame
        && options.excludedFrames.includes(candidate)
      )
      if (candidate < firstFrame || candidate > lastFrame) {
        candidate = frame
        do {
          candidate -= direction
        } while (
          candidate >= firstFrame
          && candidate <= lastFrame
          && options.excludedFrames.includes(candidate)
        )
      }
      frame = Math.min(lastFrame, Math.max(firstFrame, candidate))
    }
    return Math.min(duration, frame / options.framesPerSecond)
  }

  return Math.min(duration, duration * curvedProgress * options.maximumFraction)
}

function applyGrowthPose(actions, mixer, progress, options, lastPoseRef) {
  const availableActions = Object.values(actions).filter(Boolean)
  if (availableActions.length === 0) return

  const poseSignature = availableActions
    .map((action) => actionTimeAtProgress(action, progress, options).toFixed(6))
    .join(':')
  if (poseSignature === lastPoseRef.current) return

  availableActions.forEach((action) => {
    action.time = actionTimeAtProgress(action, progress, options)
  })
  mixer.update(0)
  lastPoseRef.current = poseSignature
}

/**
 * Keeps a GLTF growth clip at the pose dictated by canonical simulation
 * progress. The clip never advances by wall-clock time, so it cannot outrun a
 * Slow or Paused growth calculation and never needs to reset on API updates.
 */
export function useGrowthAnimationPose(actions, mixer, growthProgress, configuration = 1) {
  const options = useMemo(() => normalizedOptions(configuration), [configuration])
  const targetProgress = clamp01(growthProgress)
  const targetProgressRef = useRef(targetProgress)
  const displayedProgressRef = useRef(null)
  const lastPoseRef = useRef('')

  useLayoutEffect(() => {
    targetProgressRef.current = targetProgress
    const availableActions = Object.values(actions).filter(Boolean)
    if (availableActions.length === 0) return

    availableActions.forEach((action) => {
      action.enabled = true
      action.setLoop(LoopOnce, 1)
      action.clampWhenFinished = true
      action.play()
      action.paused = true
    })

    if (displayedProgressRef.current === null || options.transitionResponse <= 0) {
      displayedProgressRef.current = targetProgress
    }
    lastPoseRef.current = ''
    applyGrowthPose(actions, mixer, displayedProgressRef.current, options, lastPoseRef)
  }, [actions, mixer, options, targetProgress])

  useFrame((_, delta) => {
    if (options.transitionResponse <= 0 || displayedProgressRef.current === null) return

    const target = targetProgressRef.current
    const blend = 1 - Math.exp(-Math.min(Math.max(delta, 0), 0.1) * options.transitionResponse)
    const difference = target - displayedProgressRef.current
    displayedProgressRef.current = Math.abs(difference) < 0.0002
      ? target
      : displayedProgressRef.current + difference * blend

    applyGrowthPose(actions, mixer, displayedProgressRef.current, options, lastPoseRef)
  })

  useEffect(() => () => {
    Object.values(actions).forEach((action) => action?.stop?.())
    displayedProgressRef.current = null
    lastPoseRef.current = ''
  }, [actions])
}
