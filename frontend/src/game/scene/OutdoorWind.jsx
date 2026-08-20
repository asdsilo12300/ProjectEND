/* eslint-disable react-hooks/immutability -- Three.js buffers are animated imperatively inside useFrame. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, MathUtils } from 'three'

const WIND_CENTER = Object.freeze({ x: 0.75, y: 1.15, z: 0 })

function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ))
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!media) return undefined
    const update = () => setReducedMotion(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])
  return reducedMotion
}

function windTier(speed) {
  if (speed < 4) return { count: 0, opacity: 0, width: 1, speed: 0 }
  if (speed < 13) return { count: 7, opacity: 0.18, width: 1, speed: 0.52 }
  if (speed < 25) return { count: 12, opacity: 0.3, width: 1.35, speed: 0.82 }
  if (speed < 40) return { count: 18, opacity: 0.42, width: 1.7, speed: 1.12 }
  return { count: 24, opacity: 0.54, width: 2.05, speed: 1.42 }
}

function createStreamPool(count, segments) {
  const random = seededRandom(729137)
  const streams = Array.from({ length: count }, (_, index) => ({
    offset: random() * 10,
    y: -0.15 + random() * 3.45,
    z: (random() - 0.5) * 5.6,
    length: 0.75 + random() * 1.5,
    amplitude: 0.035 + random() * 0.13,
    phase: random() * Math.PI * 2,
    speed: 0.72 + random() * 0.62,
    lift: (random() - 0.5) * 0.1,
    index,
  }))
  const positions = new Float32Array(count * segments * 2 * 3)
  const geometry = new BufferGeometry()
  const attribute = new BufferAttribute(positions, 3)
  attribute.setUsage(DynamicDrawUsage)
  geometry.setAttribute('position', attribute)
  geometry.setDrawRange(0, 0)
  return { geometry, positions, streams }
}

/** Curved, arrow-free wind streaks shared by Outdoor and Seasonal modes. */
export function OutdoorWind({ daylight = 1, windDirection = 0, windSpeed = 0 }) {
  const lineRef = useRef(null)
  const reducedMotion = useReducedMotion()
  const speed = Math.max(0, Number(windSpeed) || 0)
  const tier = windTier(speed)
  const activeCount = Math.max(0, Math.round(tier.count * (reducedMotion ? 0.42 : 1)))
  const segments = 8
  const pool = useMemo(() => createStreamPool(24, segments), [])
  const color = useMemo(() => new Color(), [])
  const downwindRadians = ((Number(windDirection) || 0) + 180) * Math.PI / 180

  useEffect(() => () => pool.geometry.dispose(), [pool])

  useFrame(({ clock }, rawDelta) => {
    const lines = lineRef.current
    if (!lines || activeCount === 0) {
      pool.geometry.setDrawRange(0, 0)
      return
    }
    const delta = Math.min(rawDelta, 0.05)
    const elapsed = clock.elapsedTime
    const gust = 0.76 + Math.sin(elapsed * (0.72 + speed * 0.012)) * 0.16 + Math.sin(elapsed * 1.83 + 1.2) * 0.08

    for (let streamIndex = 0; streamIndex < activeCount; streamIndex += 1) {
      const stream = pool.streams[streamIndex]
      stream.offset = (stream.offset + delta * tier.speed * gust * stream.speed) % 10
      const head = ((stream.offset / 10) * 8.8) - 4.4
      for (let segmentIndex = 0; segmentIndex < segments; segmentIndex += 1) {
        const progressA = segmentIndex / segments
        const progressB = (segmentIndex + 1) / segments
        const xA = head - stream.length * (1 - progressA)
        const xB = head - stream.length * (1 - progressB)
        const waveA = Math.sin(elapsed * 1.35 + stream.phase + progressA * Math.PI * 1.7)
        const waveB = Math.sin(elapsed * 1.35 + stream.phase + progressB * Math.PI * 1.7)
        const yA = stream.y + waveA * stream.amplitude + progressA * stream.lift
        const yB = stream.y + waveB * stream.amplitude + progressB * stream.lift
        const zA = stream.z + Math.cos(elapsed * 0.82 + stream.phase + progressA * 2.4) * stream.amplitude * 0.65
        const zB = stream.z + Math.cos(elapsed * 0.82 + stream.phase + progressB * 2.4) * stream.amplitude * 0.65
        const offset = (streamIndex * segments + segmentIndex) * 6
        pool.positions[offset] = xA
        pool.positions[offset + 1] = yA
        pool.positions[offset + 2] = zA
        pool.positions[offset + 3] = xB
        pool.positions[offset + 4] = yB
        pool.positions[offset + 5] = zB
      }
    }

    pool.geometry.setDrawRange(0, activeCount * segments * 2)
    pool.geometry.attributes.position.needsUpdate = true
    color.set(daylight < 0.25 ? '#9bc7db' : '#e4f7ed')
    lines.material.color.copy(color)
    lines.material.opacity = tier.opacity * MathUtils.clamp(0.72 + gust * 0.28, 0.72, 1.08)
    lines.material.linewidth = tier.width
  })

  if (activeCount === 0) return null

  return (
    <group position={[WIND_CENTER.x, WIND_CENTER.y, WIND_CENTER.z]} rotation={[0, Math.PI / 2 - downwindRadians, 0]}>
      <lineSegments ref={lineRef} geometry={pool.geometry} frustumCulled={false} renderOrder={5}>
        <lineBasicMaterial color="#e4f7ed" transparent opacity={tier.opacity} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </lineSegments>
    </group>
  )
}
