/* eslint-disable react-hooks/immutability -- Three.js animation state is updated imperatively inside useFrame. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  MathUtils,
  Object3D,
  Raycaster,
  Vector3,
} from 'three'
import { getRainVisualIntensity } from './rainUtils'

const RAIN_CENTER = Object.freeze({ x: 0.75, z: 0 })
const GROUND_FALLBACK_Y = -0.34
const RAIN_TOP = 7.5
const RAIN_RADIUS_X = 8.5
const RAIN_RADIUS_Z = 6.2
const DOWN = new Vector3(0, -1, 0)

function seededRandom(seed) {
  let state = seed >>> 0

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function getRainCapacity(reducedMotion) {
  if (reducedMotion) return 220
  if (typeof navigator === 'undefined') return 720

  const memory = Number(navigator.deviceMemory) || 4
  const cores = Number(navigator.hardwareConcurrency) || 4
  if (memory <= 2 || cores <= 4) return 440
  if (memory >= 8 && cores >= 8) return 980
  return 720
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
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

function createDropPool(capacity) {
  const random = seededRandom(842761)
  const pool = Array.from({ length: capacity }, () => ({
    x: RAIN_CENTER.x + (random() - 0.5) * RAIN_RADIUS_X * 2,
    y: GROUND_FALLBACK_Y + random() * (RAIN_TOP - GROUND_FALLBACK_Y),
    z: RAIN_CENTER.z + (random() - 0.5) * RAIN_RADIUS_Z * 2,
    speed: 8.5 + random() * 5.5,
    length: 0.22 + random() * 0.42,
  }))
  const positions = new Float32Array(capacity * 6)
  const geometry = new BufferGeometry()
  const positionAttribute = new BufferAttribute(positions, 3)
  positionAttribute.setUsage(DynamicDrawUsage)
  geometry.setAttribute('position', positionAttribute)
  geometry.setDrawRange(0, 0)

  return { capacity, geometry, pool, positions, random }
}

function getWindVector(speedKmh, directionDegrees) {
  const direction = ((Number(directionDegrees) || 0) + 180) * (Math.PI / 180)
  const speed = Math.min(4.5, Math.max(0, Number(speedKmh) || 0) * 0.06)

  return {
    x: Math.sin(direction) * speed,
    z: Math.cos(direction) * speed,
  }
}

function RainStreaks({ daylight, intensity, reducedMotion, windDirection, windSpeed }) {
  const materialRef = useRef(null)
  const capacity = useMemo(() => getRainCapacity(reducedMotion), [reducedMotion])
  const rain = useMemo(() => createDropPool(capacity), [capacity])
  const activeCount = intensity > 0
    ? Math.min(capacity, Math.round(70 + capacity * intensity))
    : 0
  const wind = useMemo(
    () => getWindVector(windSpeed, windDirection),
    [windDirection, windSpeed],
  )
  const rainColors = useMemo(
    () => ({ day: new Color('#d8efff'), night: new Color('#8fb5d3') }),
    [],
  )

  useEffect(() => () => rain.geometry.dispose(), [rain])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const groundY = GROUND_FALLBACK_Y

    for (let index = 0; index < activeCount; index += 1) {
      const drop = rain.pool[index]
      drop.y -= drop.speed * delta
      drop.x += wind.x * delta
      drop.z += wind.z * delta

      if (
        drop.y < groundY
        || Math.abs(drop.x - RAIN_CENTER.x) > RAIN_RADIUS_X
        || Math.abs(drop.z - RAIN_CENTER.z) > RAIN_RADIUS_Z
      ) {
        drop.x = RAIN_CENTER.x + (rain.random() - 0.5) * RAIN_RADIUS_X * 2
        drop.y = RAIN_TOP + rain.random() * 2.5
        drop.z = RAIN_CENTER.z + (rain.random() - 0.5) * RAIN_RADIUS_Z * 2
      }

      const offset = index * 6
      const travelTime = drop.length / drop.speed
      rain.positions[offset] = drop.x
      rain.positions[offset + 1] = drop.y
      rain.positions[offset + 2] = drop.z
      rain.positions[offset + 3] = drop.x - wind.x * travelTime
      rain.positions[offset + 4] = drop.y + drop.length
      rain.positions[offset + 5] = drop.z - wind.z * travelTime
    }

    rain.geometry.setDrawRange(0, activeCount * 2)
    rain.geometry.attributes.position.needsUpdate = true

    if (materialRef.current) {
      materialRef.current.color.lerpColors(
        rainColors.night,
        rainColors.day,
        MathUtils.clamp(daylight, 0, 1),
      )
      materialRef.current.opacity = 0.34 + intensity * 0.34
    }
  })

  if (activeCount === 0) return null

  return (
    <lineSegments geometry={rain.geometry} frustumCulled={false} renderOrder={6}>
      <lineBasicMaterial
        ref={materialRef}
        color="#c5e5fa"
        depthWrite={false}
        opacity={0.5}
        transparent
        toneMapped={false}
      />
    </lineSegments>
  )
}

function collectGroundMeshes(groundObject) {
  const meshes = []
  groundObject?.updateMatrixWorld?.(true)
  groundObject?.traverse?.((child) => {
    if (child.isMesh && child.geometry && child.visible) meshes.push(child)
  })
  return meshes
}

function createSplashPool(capacity, groundObject) {
  const random = seededRandom(395821)
  const groundMeshes = collectGroundMeshes(groundObject)
  const raycaster = new Raycaster()
  const origin = new Vector3()

  return Array.from({ length: capacity }, () => {
    const x = RAIN_CENTER.x + (random() - 0.5) * RAIN_RADIUS_X * 1.8
    const z = RAIN_CENTER.z + (random() - 0.5) * RAIN_RADIUS_Z * 1.8
    let y = GROUND_FALLBACK_Y

    if (groundMeshes.length > 0) {
      origin.set(x, 6, z)
      raycaster.set(origin, DOWN)
      const hit = raycaster.intersectObjects(groundMeshes, false)[0]
      if (hit) y = hit.point.y + 0.014
    }

    return {
      age: random(),
      delay: random() * 1.4,
      duration: 0.16 + random() * 0.22,
      x,
      y,
      z,
    }
  })
}

function RainSplashPool({ capacity, groundObject, intensity }) {
  const meshRef = useRef(null)
  const splashes = useMemo(
    () => createSplashPool(capacity, groundObject),
    [capacity, groundObject],
  )
  const transform = useMemo(() => new Object3D(), [])

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const delta = Math.min(rawDelta, 0.05)
    const visibleSplashes = Math.ceil(capacity * (0.18 + intensity * 0.82))
    splashes.forEach((splash, index) => {
      splash.age += delta
      const cycle = splash.duration + splash.delay
      const elapsed = splash.age % cycle
      const active = intensity > 0
        && index < visibleSplashes
        && elapsed < splash.duration

      if (!active) {
        transform.position.set(splash.x, splash.y, splash.z)
        transform.scale.setScalar(0)
      } else {
        const progress = elapsed / splash.duration
        const visibleScale = Math.sin(progress * Math.PI)
          * (0.07 + intensity * 0.13)
        transform.position.set(splash.x, splash.y, splash.z)
        transform.rotation.set(-Math.PI / 2, 0, 0)
        transform.scale.setScalar(visibleScale)
      }

      transform.updateMatrix()
      mesh.setMatrixAt(index, transform.matrix)
    })

    mesh.instanceMatrix.needsUpdate = true
    mesh.material.opacity = 0.16 + intensity * 0.3
  })

  if (intensity === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, capacity]}
      frustumCulled={false}
      renderOrder={7}
    >
      <ringGeometry args={[0.52, 1, 16]} />
      <meshBasicMaterial
        color="#b8ddf2"
        depthWrite={false}
        opacity={0.28}
        transparent
        toneMapped={false}
      />
    </instancedMesh>
  )
}

function RainSplashes({ groundObject, intensity, reducedMotion }) {
  const capacity = reducedMotion ? 14 : 52

  return (
    <RainSplashPool
      key={`${capacity}-${groundObject?.uuid ?? 'ground'}`}
      capacity={capacity}
      groundObject={groundObject}
      intensity={intensity}
    />
  )
}

export function OutdoorRain({
  daylight = 1,
  groundObject,
  rainfall = 0,
  windDirection = 0,
  windSpeed = 0,
}) {
  const reducedMotion = useReducedMotion()
  const intensity = getRainVisualIntensity(rainfall)

  if (intensity === 0) return null

  return (
    <group name="outdoor-weather-rain">
      <RainStreaks
        daylight={daylight}
        intensity={intensity}
        reducedMotion={reducedMotion}
        windDirection={windDirection}
        windSpeed={windSpeed}
      />
      <RainSplashes
        groundObject={groundObject}
        intensity={intensity}
        reducedMotion={reducedMotion}
      />
    </group>
  )
}
