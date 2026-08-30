import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { ACTION_MODEL_URLS } from './actionModelAssets'

const VISIBLE_PHASES = ['animating', 'applying', 'success']

function GltfActionModel({ url, maxSize = 1, ...groupProps }) {
  const { scene } = useGLTF(url)
  const prepared = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
    })
    const bounds = new THREE.Box3().setFromObject(clone)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const largestSide = Math.max(size.x, size.y, size.z, 0.001)
    clone.position.set(-center.x, -bounds.min.y, -center.z)
    return { clone, scale: maxSize / largestSide }
  }, [maxSize, scene])

  return (
    <group scale={prepared.scale} {...groupProps}>
      <primitive object={prepared.clone} />
    </group>
  )
}

function FallingParticles({ active, color = '#71c9ff', count = 20, spread = 0.32, size = 0.025 }) {
  const particleGroup = useRef(null)
  const points = useMemo(() => Array.from({ length: count }, (_, index) => ({
    x: (Math.sin(index * 12.9898) * 0.5) * spread,
    y: ((index * 11) % count) / count * 0.72,
    z: (Math.sin(index * 7.233 + 1.7) * 0.5) * spread,
  })), [count, spread])

  useFrame(({ clock }) => {
    if (!particleGroup.current || !active) return
    particleGroup.current.position.y = -((clock.elapsedTime * 0.62) % 0.72)
  })

  return active ? (
    <group ref={particleGroup}>
      {points.map((point, index) => (
        <mesh key={index} position={[point.x, point.y, point.z]} scale={[size * 0.7, size * 1.7, size * 0.7]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.28} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  ) : null
}

function WaterStream({ active, length = 0.8 }) {
  const droplets = useRef([])
  const points = useMemo(() => Array.from({ length: 18 }, (_, index) => ({
    x: Math.sin(index * 8.17) * 0.018,
    z: Math.cos(index * 5.31) * 0.014,
    offset: index / 18,
  })), [])

  useFrame(({ clock }) => {
    if (!active) return
    const fall = (clock.elapsedTime * 1.28) % 1
    droplets.current.forEach((droplet, index) => {
      if (!droplet) return
      const progress = (points[index].offset + fall) % 1
      droplet.position.y = -progress * length
      droplet.scale.y = 0.035 * (1 + progress * 0.7)
    })
  })

  if (!active) return null

  return (
    <group>
      {points.map((point, index) => (
        <mesh
          key={index}
          ref={(node) => { droplets.current[index] = node }}
          position={[point.x, -point.offset * length, point.z]}
          scale={[0.015, 0.035, 0.015]}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color="#72d7ff" emissive="#3aaee8" emissiveIntensity={0.22} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function WateringCan({ active }) {
  const tool = useRef(null)
  const stream = useRef(null)

  useFrame(({ clock }) => {
    if (!tool.current) return
    // The model's spout points to local -X. A positive Z rotation lowers that
    // side toward the soil; the previous negative angle lifted it away from
    // the planting area and made the water appear to fall from the can body.
    const tilt = (active ? 0.5 : 0.1) + Math.sin(clock.elapsedTime * 3.2) * 0.025
    tool.current.rotation.z = tilt
    // The stream anchor follows the actual rose/nozzle tip, while this inverse
    // rotation keeps the droplets falling vertically under gravity.
    if (stream.current) stream.current.rotation.z = -tilt
  })

  return (
    <group ref={tool}>
      <GltfActionModel url={ACTION_MODEL_URLS.water} maxSize={0.64} rotation={[0, -Math.PI / 2, 0]} />
      <group position={[-0.35, 0.16, -0.08]}>
        <group ref={stream}>
          <WaterStream active={active} length={0.56} />
        </group>
      </group>
    </group>
  )
}

function SprayBottle({ active }) {
  return (
    <group rotation={[0, 0, active ? -0.24 : 0]}>
      <mesh><boxGeometry args={[0.28, 0.46, 0.22]} /><meshStandardMaterial color="#ef6e79" roughness={0.52} /></mesh>
      <mesh position={[0.12, 0.31, 0]}><boxGeometry args={[0.34, 0.12, 0.14]} /><meshStandardMaterial color="#343c38" /></mesh>
      <mesh position={[0.31, 0.31, 0]}><boxGeometry args={[0.16, 0.06, 0.08]} /><meshStandardMaterial color="#a9b8b0" /></mesh>
      <group position={[0.53, 0.27, 0]} rotation={[0, 0, Math.PI / 2]}>
        <FallingParticles active={active} color="#dff8ed" count={24} spread={0.5} size={0.018} />
      </group>
    </group>
  )
}

function FertilizerOrbit({ active, plantCenter = [-0.62, -0.56, -0.62], plantingRadius = 0.96 }) {
  const pellets = useRef([])
  const ringRadius = THREE.MathUtils.clamp(Number(plantingRadius) * 0.66, 0.48, 0.78)
  const particles = useMemo(() => Array.from({ length: 34 }, (_, index) => ({
    angle: (index / 34) * Math.PI * 2,
    offset: ((index * 11) % 34) / 34,
    radius: ringRadius * (0.72 + ((index * 7) % 9) / 30),
  })), [ringRadius])

  useFrame(({ clock }) => {
    if (!active) return
    const cycle = clock.elapsedTime * 0.62
    pellets.current.forEach((pellet, index) => {
      if (!pellet) return
      const particle = particles[index]
      const progress = (cycle + particle.offset) % 1
      const eased = Math.sin(progress * Math.PI * 0.5)
      const angle = particle.angle + progress * Math.PI * 1.65
      const targetX = plantCenter[0] + Math.cos(angle) * particle.radius
      const targetZ = plantCenter[2] + Math.sin(angle) * particle.radius
      pellet.position.x = THREE.MathUtils.lerp(0.22, targetX, eased)
      pellet.position.y = THREE.MathUtils.lerp(-0.06, plantCenter[1] + 0.035, progress)
        + Math.sin(progress * Math.PI) * 0.24
      pellet.position.z = THREE.MathUtils.lerp(0, targetZ, eased)
      pellet.rotation.x = progress * Math.PI * 5 + index
      pellet.rotation.z = progress * Math.PI * 3
    })
  })

  if (!active) return null

  return (
    <group>
      {particles.map((particle, index) => (
        <mesh
          key={`${particle.angle}-${index}`}
          ref={(node) => { pellets.current[index] = node }}
          scale={[0.018, 0.034, 0.018]}
          castShadow
        >
          <sphereGeometry args={[1, 7, 5]} />
          <meshStandardMaterial color="#e7c653" emissive="#7c5b0a" emissiveIntensity={0.12} roughness={0.76} />
        </mesh>
      ))}
    </group>
  )
}

function FertilizerShaker({ active, plantCenter, plantingRadius }) {
  const tool = useRef(null)

  useFrame(({ clock }) => {
    if (!tool.current) return
    tool.current.rotation.z = (active ? -0.42 : -0.08) + Math.sin(clock.elapsedTime * 9) * 0.045
  })

  return (
    <group>
      <group ref={tool}>
        <GltfActionModel url={ACTION_MODEL_URLS.fertilizer} maxSize={0.65} rotation={[0, -0.35, 0]} />
      </group>
      <FertilizerOrbit active={active} plantCenter={plantCenter} plantingRadius={plantingRadius} />
    </group>
  )
}

function StrawMulch({ active, plantingRadius = 0.96 }) {
  const mulch = useRef(null)
  const ringRadius = THREE.MathUtils.clamp(Number(plantingRadius) * 0.58, 0.48, 0.68)
  const patches = useMemo(() => Array.from({ length: 8 }, (_, index) => {
    const angle = (index / 8) * Math.PI * 2
    return {
      position: [Math.cos(angle) * ringRadius, 0, Math.sin(angle) * ringRadius],
      rotation: [0, -angle + (index % 2 ? 0.24 : -0.18), 0],
      scale: index % 2 ? 0.94 : 1,
    }
  }), [ringRadius])

  useFrame(({ clock }) => {
    if (!mulch.current) return
    const reveal = active ? 1 + Math.sin(clock.elapsedTime * 3.5) * 0.025 : 0.92
    mulch.current.scale.setScalar(reveal)
  })

  return (
    <group ref={mulch}>
      {patches.map((patch, index) => (
        <group key={index} position={patch.position} rotation={patch.rotation} scale={patch.scale}>
          <GltfActionModel url={ACTION_MODEL_URLS.straw} maxSize={0.62} />
        </group>
      ))}
      <pointLight position={[0, 0.18, 0]} color="#e8b84e" intensity={active ? 0.3 : 0.12} distance={2.2} />
    </group>
  )
}

function DrainageTool({ active }) {
  return (
    <group rotation={[0, 0, active ? -0.5 : -0.12]}>
      <mesh position={[0, 0.15, 0]} rotation={[0, 0, -0.15]}><cylinderGeometry args={[0.045, 0.055, 0.65, 12]} /><meshStandardMaterial color="#9a6338" /></mesh>
      <mesh position={[0.06, -0.22, 0]} rotation={[0, 0, 0.08]}><coneGeometry args={[0.21, 0.34, 4]} /><meshStandardMaterial color="#8aa0a1" metalness={0.35} roughness={0.4} /></mesh>
      <group position={[0.22, -0.42, 0]}><FallingParticles active={active} color="#9f7751" count={30} spread={0.55} size={0.028} /></group>
    </group>
  )
}

function ShadeCloth({ active, plantScale = 1 }) {
  const heightScale = THREE.MathUtils.clamp(Number(plantScale) || 1, 0.88, 1.12)
  const roofHeight = 1.5 * heightScale
  return (
    <group scale={active ? 1 : 0.88}>
      {[-1, 1].flatMap((x) => [-0.66, 0.66].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, roofHeight / 2 - 0.06, z]}>
          <cylinderGeometry args={[0.03, 0.05, roofHeight + 0.12, 10]} />
          <meshStandardMaterial color="#394f3f" />
        </mesh>
      )))}
      <mesh position={[0, roofHeight, 0]} rotation={[0.04, 0, 0]}>
        <boxGeometry args={[2.12, 0.045, 1.48]} />
        <meshStandardMaterial color="#477b57" transparent opacity={0.78} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.72, 32]} />
        <meshBasicMaterial color="#284630" transparent opacity={active ? 0.17 : 0.08} depthWrite={false} />
      </mesh>
    </group>
  )
}

function WindLines({ active, color = '#b9e7ef' }) {
  const windGroup = useRef(null)
  const lines = useMemo(() => Array.from({ length: 5 }, (_, index) => ({
    y: index * 0.18 - 0.36,
    z: (index % 3) * 0.14 - 0.14,
    length: 0.62 + (index % 3) * 0.16,
  })), [])

  useFrame(({ clock }) => {
    if (!windGroup.current) return
    windGroup.current.position.x = active
      ? ((clock.elapsedTime * 0.9) % 1.1) - 0.55
      : 0
  })

  return (
    <group ref={windGroup}>
      {lines.map((line, index) => (
        <group key={index} position={[active ? -0.12 : 0.18, line.y, line.z]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.009, 0.017, line.length, 8]} />
            <meshBasicMaterial color={color} transparent opacity={active ? 0.74 : 0.32} depthTest={false} />
          </mesh>
          <mesh position={[line.length / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.038, 0.1, 8]} />
            <meshBasicMaterial color={color} transparent opacity={active ? 0.82 : 0.38} depthTest={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function WindbreakPanel({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      {[-0.64, 0.64].map((x) => (
        <mesh key={`post-${x}`} position={[x, 0.48, 0]}>
          <cylinderGeometry args={[0.038, 0.052, 1.12, 10]} />
          <meshStandardMaterial color="#7d522f" emissive="#2c180a" emissiveIntensity={0.12} />
        </mesh>
      ))}
      {[0.12, 0.35, 0.58, 0.81].map((y) => (
        <mesh key={`slat-${y}`} position={[0, y, 0]}>
          <boxGeometry args={[1.38, 0.13, 0.065]} />
          <meshStandardMaterial color="#a9713d" emissive="#2f1909" emissiveIntensity={0.1} roughness={0.72} />
        </mesh>
      ))}
    </group>
  )
}

function Windbreak({ plantScale = 1 }) {
  const fittedScale = THREE.MathUtils.clamp(Number(plantScale) || 1, 0.82, 1.24)
  const heightScale = 0.92 + (fittedScale - 0.82) * 0.24
  const perimeter = 1.22
  return (
    <group scale={[1, heightScale, 1]}>
      {/* Three sides sit just outside the planting ring, leaving the front open. */}
      <WindbreakPanel position={[0, 0, -perimeter]} />
      <WindbreakPanel position={[-perimeter, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <WindbreakPanel position={[perimeter, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  )
}

function FrostCover({ active, plantScale = 1 }) {
  const heightScale = THREE.MathUtils.clamp(Number(plantScale) || 1, 0.88, 1.18)
  const radius = 1.08
  return (
    <group scale={[1, heightScale, 1]}>
      <mesh position={[0, 0.01, 0]}>
        <sphereGeometry args={[radius, 30, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color="#dff4ef" transparent opacity={active ? 0.32 : 0.18} roughness={0.18} transmission={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.01, 0]} scale={1.006}>
        <sphereGeometry args={[radius, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#bdebe4" transparent opacity={0.1} wireframe />
      </mesh>
      {[[0.91, 0], [-0.91, 0], [0, 0.91], [0, -0.91]].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.17, z]}>
          <cylinderGeometry args={[0.018, 0.026, 0.48, 8]} />
          <meshStandardMaterial color="#8aada2" metalness={0.3} roughness={0.48} />
        </mesh>
      ))}
      <pointLight color="#c7f1ff" intensity={active ? 1.2 : 0.5} distance={3} />
    </group>
  )
}

function LightEffect({ active }) {
  return (
    <group>
      <pointLight position={[0, 0.3, 0]} color="#fff0ae" intensity={active ? 5 : 2.2} distance={5} decay={1.8} />
      <mesh position={[0, -0.85, 0]}>
        <coneGeometry args={[1.15, 2.8, 32, 1, true]} />
        <meshBasicMaterial color="#ffe7a2" transparent opacity={active ? 0.18 : 0.08} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh><sphereGeometry args={[0.16, 16, 12]} /><meshBasicMaterial color="#fff4bd" /></mesh>
    </group>
  )
}

function TemperatureEffect({ active, cold = false }) {
  const color = cold ? '#9adcf7' : '#ff8659'
  return (
    <group>
      {[0, 1, 2].map((index) => (
        <mesh key={index} position={[index * 0.3 - 0.3, index * 0.16 - 0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18 + index * 0.04, 0.018, 8, 24]} />
          <meshBasicMaterial color={color} transparent opacity={active ? 0.82 : 0.4} />
        </mesh>
      ))}
      <pointLight color={color} intensity={active ? 2.4 : 0.9} distance={3.5} />
    </group>
  )
}

function AnimatedItemModel({ active, animationKey, preset, url }) {
  const model = useRef(null)

  useFrame(({ clock }) => {
    if (!model.current) return
    const speed = THREE.MathUtils.clamp(Number(preset?.speed) || 1, 0.1, 5)
    const amplitude = THREE.MathUtils.clamp(Number(preset?.amplitude) || 1, 0, 3)
    const modelScale = THREE.MathUtils.clamp(Number(preset?.scale) || 1, 0.1, 5)
    const time = clock.elapsedTime * speed
    model.current.position.set(0, 0, 0)
    model.current.rotation.set(0, 0, 0)
    model.current.scale.setScalar(modelScale)

    if (['pour-liquid', 'watering-can'].includes(animationKey)) model.current.rotation.z = -0.48 + Math.sin(time * 3.4) * 0.04 * amplitude
    if (['scatter', 'fertilizer-pour'].includes(animationKey)) model.current.rotation.z = -0.28 + Math.sin(time * 10) * 0.07 * amplitude
    if (['spray-mist', 'pest-spray'].includes(animationKey)) model.current.rotation.z = -0.22 + Math.sin(time * 5) * 0.025 * amplitude
    if (['dig-mix', 'soil-mix'].includes(animationKey)) model.current.rotation.z = -0.38 + Math.sin(time * 4.5) * 0.24 * amplitude
    if (animationKey === 'sweep' || animationKey === 'hand-pick') model.current.rotation.y = Math.sin(time * 3.2) * 0.42 * amplitude
    if (animationKey === 'spin-activate') model.current.rotation.y = time * 4.2
    if (animationKey === 'hover-pulse') {
      model.current.position.y = 0.08 + Math.sin(time * 3) * 0.07 * amplitude
      model.current.scale.setScalar(modelScale * (1 + Math.sin(time * 4.5) * 0.055 * amplitude))
    }
    if (animationKey === 'bounce-drop') model.current.position.y = Math.abs(Math.sin(time * 4.2)) * 0.1 * amplitude
    if (animationKey === 'shake-use') {
      model.current.rotation.x = Math.sin(time * 13) * 0.07
      model.current.rotation.z = Math.cos(time * 11) * 0.09
    }
  })

  return (
    <group ref={model}>
      {url
        ? <GltfActionModel url={url} maxSize={0.72} />
        : (
          <group>
            <mesh castShadow position={[0, 0.18, 0]}><boxGeometry args={[0.36, 0.42, 0.26]} /><meshStandardMaterial color="#79c98b" metalness={0.18} roughness={0.48} /></mesh>
            <mesh castShadow position={[0, 0.48, 0]}><cylinderGeometry args={[0.055, 0.075, 0.24, 12]} /><meshStandardMaterial color="#d7e7d7" metalness={0.28} roughness={0.4} /></mesh>
          </group>
        )}
      {active && animationKey === 'spin-activate' && <pointLight color="#9cffbd" intensity={2.4} distance={2.8} />}
    </group>
  )
}

function CustomItemEffect({ active, animationKey, kind, preset }) {
  if (!active) return null
  const color = preset?.particle_color
  const requestedCount = Number(preset?.particle_count)
  const count = Math.max(0, Math.min(100, Number.isFinite(requestedCount) ? requestedCount : 24))
  if (kind === 'water') return <group position={[0, 0.08, 0]}><FallingParticles active color={color || '#72d7ff'} count={count} spread={0.42} size={0.019} /></group>
  if (kind === 'spray') return <group position={[0.42, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}><FallingParticles active color={color || '#dff8ed'} count={count} spread={0.5} size={0.017} /></group>
  if (kind === 'fertilizer') return <group position={[0.12, 0.05, 0]}><FallingParticles active color={color || '#e7c653'} count={count} spread={0.55} size={0.022} /></group>
  if (kind === 'drainage') return <group position={[0.18, -0.12, 0]}><FallingParticles active color={color || '#9f7751'} count={count} spread={0.48} size={0.026} /></group>
  if (['spin-activate', 'hover-pulse'].includes(animationKey)) {
    return <pointLight color="#9cffbd" intensity={2.1} distance={3} />
  }
  return null
}

function actionKind(animationKey) {
  if (/frost|cold/.test(animationKey)) return 'frost'
  if (/shade/.test(animationKey)) return 'shade'
  if (/windbreak/.test(animationKey)) return 'windbreak'
  if (/drainage|soil-mix|dig-mix/.test(animationKey)) return 'drainage'
  if (animationKey === 'soil' || /straw|mulch/.test(animationKey)) return 'straw'
  if (/spray|aphid|snail|fungus/.test(animationKey)) return 'spray'
  if (/water|pour-liquid/.test(animationKey)) return 'water'
  if (/fertilizer|scatter/.test(animationKey)) return 'fertilizer'
  if (/light/.test(animationKey)) return 'light'
  if (/air|wind/.test(animationKey)) return 'air'
  if (/temp/.test(animationKey)) return 'temperature'
  if (/soil/.test(animationKey)) return 'drainage'
  return 'none'
}

const TARGET_OFFSETS = {
  water: [0.42, 0.59, 0.34],
  spray: [0.72, 0.92, 0.7],
  fertilizer: [0.62, 0.56, 0.62],
  drainage: [0.72, 0.72, 0.58],
  straw: [0, 0.015, 0],
  shade: [0, 0, 0],
  windbreak: [0, 0, 0],
  frost: [0, 0, 0],
  light: [0, 2.7, 0],
  air: [0, 1.25, 0.35],
  temperature: [0, 1.25, 0.35],
  none: [0.8, 1.15, 0.45],
}

const PRESET_TARGET_OFFSETS = {
  plant: [0.62, 0.78, 0.62],
  soil: [0.18, 0.12, 0.18],
  pest: [0.72, 0.92, 0.7],
  scene: [0, 0.04, 0],
}

const GROUNDED_KINDS = new Set(['straw', 'shade', 'windbreak', 'frost'])

export function ActionAnimation({ actionState, plantingSurface, plantScale = 1 }) {
  const group = useRef(null)
  const start = useRef(0)
  const phase = actionState?.phase
  const asset = actionState?.asset
  const preset = asset?.animationPreset ?? null
  const animationKey = String(preset?.motion_type ?? asset?.animationKey ?? asset?.actionKey ?? '')
  const configuredEffect = String(preset?.effect_type ?? '')
  const kind = configuredEffect && configuredEffect !== 'none' ? configuredEffect : actionKind(animationKey)
  const customModelUrl = String(asset?.modelUrl ?? '').trim()
  const customPreset = Boolean(preset?.key && preset.key !== preset.motion_type)
  const usesGenericModel = Boolean(customModelUrl) || customPreset || ['place-down', 'pour-liquid', 'scatter', 'spray-mist', 'dig-mix', 'sweep', 'spin-activate', 'hover-pulse', 'bounce-drop', 'shake-use', 'hand-pick'].includes(animationKey)
  const visible = Boolean(asset) && VISIBLE_PHASES.includes(phase)
  const active = visible

  useEffect(() => {
    start.current = 0
  }, [asset?.id, animationKey, phase])

  useFrame(({ clock }) => {
    if (!group.current || !visible) return
    if (!start.current) start.current = clock.elapsedTime
    const elapsed = clock.elapsedTime - start.current
    const durationSeconds = THREE.MathUtils.clamp((Number(preset?.duration_ms) || 950) / 1000, 0.3, 10)
    const progress = phase === 'success' ? 1 : Math.min(1, elapsed / durationSeconds)
    const eased = Math.sin(progress * Math.PI * 0.5)
    const [centerX, groundY, centerZ] = plantingSurface?.position ?? [0.75, -0.38, 0]
    const customTarget = preset?.key && preset.key !== preset.motion_type ? PRESET_TARGET_OFFSETS[preset.target_type] : null
    const [offsetX, offsetY, offsetZ] = customTarget ?? TARGET_OFFSETS[kind] ?? TARGET_OFFSETS.none
    const targetX = centerX + offsetX
    const targetY = groundY + offsetY
    const targetZ = centerZ + offsetZ
    if (animationKey === 'bounce-drop') {
      const bounce = Math.abs(Math.sin(progress * Math.PI * 2.5)) * (1 - progress) * 0.18
      group.current.position.set(targetX, THREE.MathUtils.lerp(targetY + 2.2, targetY, eased) + bounce, targetZ)
      group.current.rotation.set(0, 0, 0)
      return
    }
    if (GROUNDED_KINDS.has(kind)) {
      group.current.position.set(targetX, targetY, targetZ)
      group.current.rotation.set(0, 0, 0)
      const reveal = 0.86 + eased * 0.14
      group.current.scale.setScalar(reveal)
      return
    }
    group.current.position.x = THREE.MathUtils.lerp(2.45, targetX, eased)
    group.current.position.y = THREE.MathUtils.lerp(targetY + 0.18, targetY, eased) + Math.sin(elapsed * 4) * 0.018
    group.current.position.z = THREE.MathUtils.lerp(0.9, targetZ, eased)
    if (kind === 'spray') {
      // The procedural bottle's nozzle points along local +X. Aim that axis
      // back at the planting centre instead of spraying away from the plant.
      const sprayYaw = Math.atan2(group.current.position.z - centerZ, centerX - group.current.position.x)
      group.current.rotation.y = sprayYaw + Math.sin(elapsed * 2.8) * 0.018
    } else if (kind === 'water' || kind === 'fertilizer') {
      // These tools already have authored local orientation. Keeping the outer
      // group neutral makes the nozzle and fertilizer ring line up exactly with
      // the planting centre.
      group.current.rotation.y = 0
    } else {
      group.current.rotation.y = -0.22 + Math.sin(elapsed * 2.8) * 0.025
    }
  })

  if (!visible) return null

  // Hand tools stay proportional to both supported plants.  The geometry itself
  // is authored around one world unit, so these values keep a watering can at
  // roughly 20-25% of a mature plant instead of covering the plant or panels.
  const scaleByKind = {
    water: 1,
    spray: 0.68,
    fertilizer: 1,
    drainage: 0.76,
    straw: 1,
    windbreak: 1,
  }
  const toolScale = scaleByKind[kind] ?? 1

  return (
    <group ref={group} position={[2.45, 1.3, 0.9]} scale={toolScale}>
      {!usesGenericModel && kind === 'water' && <WateringCan active={active} />}
      {!usesGenericModel && kind === 'spray' && <SprayBottle active={active} />}
      {!usesGenericModel && kind === 'fertilizer' && (
        <FertilizerShaker
          active={active}
          plantCenter={[-TARGET_OFFSETS.fertilizer[0], -TARGET_OFFSETS.fertilizer[1], -TARGET_OFFSETS.fertilizer[2]]}
          plantingRadius={plantingSurface?.radius ?? 0.96}
        />
      )}
      {!usesGenericModel && kind === 'drainage' && <DrainageTool active={active} />}
      {kind === 'straw' && <StrawMulch active={active} plantingRadius={plantingSurface?.radius ?? 0.96} />}
      {kind === 'shade' && <ShadeCloth active={active} plantScale={plantScale} />}
      {kind === 'windbreak' && <Windbreak active={active} plantScale={plantScale} />}
      {kind === 'frost' && <FrostCover active={active} plantScale={plantScale} />}
      {kind === 'light' && <LightEffect active={active} />}
      {kind === 'air' && <WindLines active={active} color="#a9e8f2" />}
      {kind === 'temperature' && <TemperatureEffect active={active} cold={Number(asset?.targetValue) < 18} />}
      {usesGenericModel && <AnimatedItemModel active={active} animationKey={animationKey} preset={preset} url={customModelUrl || null} />}
      {usesGenericModel && <CustomItemEffect active={active} animationKey={animationKey} kind={kind} preset={preset} />}
    </group>
  )
}

function modifierKey(modifier) {
  return String(modifier?.action_key ?? modifier?.action?.action_key ?? '')
}

export function ActiveCareEffects({ modifiers = [], plantingSurface, plantScale = 1 }) {
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const hasTimedModifier = modifiers.some((modifier) => Boolean(modifier?.expires_at))

  useEffect(() => {
    if (!hasTimedModifier) return undefined
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [hasTimedModifier])

  const keys = useMemo(() => new Set(modifiers
    .filter((modifier) => !modifier?.expires_at || Date.parse(modifier.expires_at) > currentTime)
    .map(modifierKey)
    .filter(Boolean)), [currentTime, modifiers])
  const surfacePosition = plantingSurface?.position ?? [0.75, -0.38, 0]

  return (
    <group position={surfacePosition}>
      {keys.has('mulch') && <StrawMulch active plantingRadius={plantingSurface?.radius ?? 0.96} />}
      {keys.has('windbreak') && <Windbreak active plantScale={plantScale} />}
      {keys.has('shade') && <ShadeCloth active plantScale={plantScale} />}
      {keys.has('frost-cover') && <FrostCover active plantScale={plantScale} />}
    </group>
  )
}
