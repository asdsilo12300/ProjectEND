import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color } from 'three'

function seededRandom(seed) {
  let value = seed >>> 0
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 4294967296
  }
}

function ParticleField({ color, count, fallSpeed = 0.35, horizontalSpeed = 0.03, opacity = 0.55, size = 0.04, swirl = false }) {
  const pointsRef = useRef(null)
  const geometry = useMemo(() => {
    const random = seededRandom(count * 7919)
    const positions = new Float32Array(count * 3)
    const drift = new Float32Array(count)
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (random() - 0.5) * 7
      positions[index * 3 + 1] = random() * 4
      positions[index * 3 + 2] = (random() - 0.5) * 5
      drift[index] = 0.55 + random() * 0.9
    }
    const next = new BufferGeometry()
    next.setAttribute('position', new BufferAttribute(positions, 3))
    next.setAttribute('drift', new BufferAttribute(drift, 1))
    return next
  }, [count])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ clock }, delta) => {
    const points = pointsRef.current
    if (!points) return
    const position = points.geometry.attributes.position
    const drift = points.geometry.attributes.drift
    for (let index = 0; index < position.count; index += 1) {
      const multiplier = drift.getX(index)
      let y = position.getY(index) - delta * fallSpeed * multiplier
      let x = position.getX(index) + delta * horizontalSpeed * multiplier
      if (swirl) x += Math.sin(clock.elapsedTime * 1.3 + index) * delta * 0.08
      if (y < -0.3) y = 3.8
      if (x > 3.7) x = -3.7
      position.setXYZ(index, x, y, position.getZ(index))
    }
    position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial color={color} size={size} transparent opacity={opacity} depthWrite={false} blending={AdditiveBlending} sizeAttenuation />
    </points>
  )
}

function HeatHaze({ intensity }) {
  const groupRef = useRef(null)
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    groupRef.current.position.x = 0.75 + Math.sin(clock.elapsedTime * 0.65) * 0.04
    groupRef.current.scale.y = 1 + Math.sin(clock.elapsedTime * 1.1) * 0.035
  })
  return (
    <group ref={groupRef} position={[0.75, 0.05, -0.7]}>
      {[0, 1, 2].map((index) => (
        <mesh key={index} position={[0, index * 0.18, 0]} rotation={[-Math.PI / 2.35, 0, 0]}>
          <ringGeometry args={[0.55 + index * 0.22, 0.59 + index * 0.22, 64]} />
          <meshBasicMaterial color="#ffd27a" transparent opacity={0.025 + intensity * 0.035} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

export function SeasonalEffects({ context, reducedMotion = false }) {
  const day = context?.current ?? {}
  const season = context?.season_key ?? day.season_key
  const snow = Math.max(0, Number(day.snowfall ?? 0))
  const wind = Math.max(0, Number(day.wind_speed ?? 0))
  const temperature = Number(day.temperature_mean ?? 25)
  const cloud = Math.max(0, Number(day.cloud_cover ?? 0))
  const lowPower = typeof navigator !== 'undefined' && Number(navigator.deviceMemory ?? 8) <= 4
  const quality = reducedMotion ? 0.25 : lowPower ? 0.55 : 1
  const isAutumn = season === 'autumn'
  const isDry = ['hot', 'hot_dry', 'cool_dry'].includes(season) && Number(day.rain ?? 0) <= 0.2
  const isHot = temperature >= 32 && Number(day.rain ?? 0) <= 0.2
  const fogDensity = cloud >= 82 || (Number(day.humidity ?? 0) >= 88 && temperature < 24) ? 0.035 : 0.012

  return (
    <>
      <fog attach="fog" args={[new Color(snow > 0 ? '#cdd7df' : '#819083'), 8, fogDensity > 0.02 ? 20 : 34]} />
      {snow > 0 && <ParticleField color="#f4fbff" count={Math.round(Math.min(800, 240 + snow * 45) * quality)} fallSpeed={0.22 + Math.min(0.5, snow * 0.02)} horizontalSpeed={wind * 0.004} opacity={0.8} size={0.045} swirl />}
      {isAutumn && <ParticleField color="#d88539" count={Math.round(120 * quality)} fallSpeed={0.16} horizontalSpeed={0.08 + wind * 0.004} opacity={0.58} size={0.065} swirl />}
      {isDry && <ParticleField color="#d6bd84" count={Math.round(90 * quality)} fallSpeed={0.015} horizontalSpeed={0.04 + wind * 0.006} opacity={0.18} size={0.03} swirl />}
      {isHot && !reducedMotion && <HeatHaze intensity={Math.min(1, (temperature - 30) / 12)} />}
    </>
  )
}
