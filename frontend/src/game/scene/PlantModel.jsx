import { useEffect, useMemo, useRef } from 'react'
import { Html, useAnimations, useGLTF } from '@react-three/drei'
import { Box3, Color, DoubleSide, Vector3 } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { resolveAssetUrl } from '../../lib/api'
import { GltfPlant } from './GltfPlant'

const PLANT_ORIGIN = [0.75, -1.70, 0]

function applyPlantOverrides(object, overrides = {}) {
  const leafColor = overrides.leafColor ? new Color(overrides.leafColor) : null
  const stemColor = overrides.stemColor ? new Color(overrides.stemColor) : null

  object.traverse((child) => {
    if (!child.isMesh || !child.material) return

    const materialName = child.material.name?.toLowerCase?.() ?? ''
    const meshName = child.name?.toLowerCase?.() ?? ''
    const isLeaf = materialName.includes('leaf') || meshName.includes('leaf')
    const isStem = materialName.includes('stem') || materialName.includes('trunk') || meshName.includes('stem') || meshName.includes('trunk')

    if (!isLeaf && !isStem) return

    child.material = child.material.clone()

    if (leafColor && isLeaf) {
      child.material.color.lerp(leafColor, 0.35)
    }

    if (stemColor && isStem) {
      child.material.color.lerp(stemColor, 0.35)
    }
  })
}

function isBasePlantModel(modelUrl) {
  if (!modelUrl) return true
  return modelUrl === '/plant.gltf' || modelUrl.endsWith('/plant.gltf')
}

function GenericPlantModel({ modelUrl, visualOverrides, scale, lean, isMature = false, isPaused = false, growthProgress = 0 }) {
  const group = useRef(null)
  const { scene, animations } = useGLTF(modelUrl)
  const clonedScene = useMemo(() => scene.clone(true), [scene])
  const { actions } = useAnimations(animations, group)

  useEffect(() => {
    applyPlantOverrides(clonedScene, visualOverrides)
  }, [clonedScene, visualOverrides])

  useEffect(() => {
    Object.values(actions).forEach((action) => {
      if (!action) return

      const duration = action.getClip().duration
      const progress = Math.min(1, Math.max(0, Number(growthProgress) || 0))
      action.timeScale = isPaused ? 0 : 0.018
      action.time = isMature ? duration : duration * progress
      action.play()
      if (isMature || isPaused) {
        action.paused = true
      }
    })

    return () => Object.values(actions).forEach((action) => action?.stop())
  }, [actions, growthProgress, isMature, isPaused])

  return (
    <group ref={group} rotation={[0, 0, lean]} scale={scale} position={PLANT_ORIGIN}>
      <primitive object={clonedScene} />
    </group>
  )
}

export function PlantModel({ modelUrl = '/plant.gltf', visualOverrides = {}, isMature = false, isPaused = false, growthProgress = 0, ...props }) {
  const scale = 1.1
  const lean = 0

  if (isBasePlantModel(modelUrl)) {
    return (
      <group position={PLANT_ORIGIN} scale={scale} rotation={[0, 0, lean]} {...props}>
        <GltfPlant modelUrl="/plant.gltf" visualOverrides={visualOverrides} isMature={isMature} isPaused={isPaused} growthProgress={growthProgress} />
      </group>
    )
  }

  const resolvedModelUrl = resolveAssetUrl(modelUrl) || '/plant.gltf'

  return <GenericPlantModel modelUrl={resolvedModelUrl} visualOverrides={visualOverrides} scale={scale} lean={lean} isMature={isMature} isPaused={isPaused} growthProgress={growthProgress} {...props} />
}

const pestAnchors = {
  aphid: [
    { position: [0.24, 1.88, 0.34], rotation: [-0.34, -0.38, 0.08], size: 0.046, modelRotation: [0, 0, 0], modelOffset: [0, -0.035, 0] },
    { position: [-0.18, 1.74, 0.36], rotation: [-0.30, 0.46, -0.08], size: 0.044, modelRotation: [0, 0, 0], modelOffset: [0, -0.034, 0] },
    { position: [0.38, 2.04, 0.30], rotation: [-0.38, -0.62, 0.06], size: 0.044, modelRotation: [0, 0, 0], modelOffset: [0, -0.034, 0] },
    { position: [-0.30, 2.02, 0.30], rotation: [-0.34, 0.70, -0.06], size: 0.042, modelRotation: [0, 0, 0], modelOffset: [0, -0.032, 0] },
    { position: [0.08, 2.22, 0.26], rotation: [-0.42, -0.04, 0.08], size: 0.04, modelRotation: [0, 0, 0], modelOffset: [0, -0.03, 0] },
  ],
  snail: [
    { position: [0.18, 1.20, 0.22], rotation: [-0.16, 0.58, 0.02], size: 0.08, modelRotation: [0, 0, 0], modelOffset: [0, -0.025, 0] },
    { position: [-0.16, 1.38, 0.18], rotation: [-0.14, -0.46, -0.04], size: 0.074, modelRotation: [0, 0, 0], modelOffset: [0, -0.024, 0] },
    { position: [0.08, 1.60, 0.20], rotation: [-0.14, 0.12, 0.04], size: 0.072, modelRotation: [0, 0, 0], modelOffset: [0, -0.023, 0] },
  ],
  fungus: [
    { position: [0.16, 2.28, 0.1], rotation: [-0.26, 0.25, 0.1], scale: 0.055 },
    { position: [-0.12, 1.84, 0.08], rotation: [-0.2, -0.2, 0], scale: 0.052 },
    { position: [0.0, 1.48, 0.04], rotation: [-0.08, 0.18, 0.04], scale: 0.05 },
  ],
}


function stableIndex(seed, length) {
  const text = String(seed ?? '')
  let hash = 0

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 9973
  }

  return hash % length
}

function getPestAnchor(name, index, id) {
  const key = pestAnchors[name] ? name : 'fungus'
  const anchors = pestAnchors[key]
  return anchors[stableIndex(`${name}-${id ?? index}`, anchors.length)]
}

function getVisiblePestAnchors(name, riskChance = 0, seed = '') {
  const anchors = pestAnchors[name] ?? pestAnchors.fungus
  const risk = Number(riskChance) || 0
  const count = risk >= 75 ? 3 : risk >= 45 ? 2 : 1
  const start = stableIndex(`${name}-${seed}-${Math.round(risk)}`, anchors.length)

  return Array.from({ length: Math.min(count, anchors.length) }, (_, index) => anchors[(start + index) % anchors.length])
}

function normalizePestName(pest) {
  const rawName = String(
    pest?.pest?.name_en
      ?? pest?.name_en
      ?? pest?.pest?.type
      ?? pest?.type
      ?? pest?.pest_type
      ?? pest?.pest?.name
      ?? pest?.name
      ?? 'fungus',
  ).toLowerCase()

  if (rawName.includes('aphid')) return 'aphid'
  if (rawName.includes('snail')) return 'snail'
  if (rawName.includes('fungus')) return 'fungus'

  return rawName
}

function pestModelUrl(name, pest) {
  if (name === 'aphid') return '/aphid.gltf'
  if (name === 'snail') return '/snails.gltf'
  return resolveAssetUrl(pest?.pest?.model_url ?? pest?.model_url)
}

export function PestModel({ pest, index = 0 }) {
  const name = normalizePestName(pest)
  const modelUrl = pestModelUrl(name, pest)
  const risk = Number(pest?.risk_chance) || 0
  const randomSeed = `${name}-${index}-${pest?.id ?? ''}-${Math.round(risk)}-${pest?.updated_at ?? pest?.created_at ?? ''}`

  if (!modelUrl) {
    const anchor = getPestAnchor(name, index, randomSeed)
    return <FungusPlaceholder anchor={anchor} />
  }

  return getVisiblePestAnchors(name, risk, randomSeed).map((anchor, anchorIndex) => (
    <LoadedPest key={`${name}-${index}-${anchorIndex}-${randomSeed}`} modelUrl={modelUrl} anchor={anchor} />
  ))
}
function LoadedPest({ modelUrl, anchor }) {
  const { scene } = useGLTF(modelUrl)
  const normalizedAsset = useMemo(() => {
    const clone = cloneSkeleton(scene)
    const box = new Box3().setFromObject(clone)
    const size = new Vector3()
    const center = new Vector3()

    box.getSize(size)
    box.getCenter(center)

    clone.traverse((child) => {
      if (!child.isMesh || !child.material) return

      child.frustumCulled = false
      child.material = child.material.clone()
      child.material.side = DoubleSide
      child.material.transparent = false
      child.material.depthWrite = true
      child.material.needsUpdate = true
    })

    const maxDimension = Math.max(size.x, size.y, size.z) || 1
    const targetSize = anchor.size ?? 0.12
    const scale = targetSize / maxDimension
    clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale)
    clone.scale.setScalar(scale)
    clone.updateMatrixWorld(true)

    return { scene: clone }
  }, [anchor.size, scene])

  return (
    <group position={PLANT_ORIGIN}>
      <group position={anchor.position} rotation={anchor.rotation}>
        <group position={anchor.modelOffset ?? [0, 0, 0]} rotation={anchor.modelRotation ?? [0, 0, 0]}>
          <primitive object={normalizedAsset.scene} />
        </group>
      </group>
    </group>
  )
}

function FungusPlaceholder({ anchor }) {
  return (
    <group position={PLANT_ORIGIN}>
      <group position={anchor.position} rotation={anchor.rotation} scale={anchor.scale}>
        <mesh position={[0, 0.04, 0]}>
          <sphereGeometry args={[0.08, 14, 10]} />
          <meshStandardMaterial color="#c8d6b8" roughness={0.9} />
        </mesh>
        <mesh position={[0.11, 0.02, 0.02]}>
          <sphereGeometry args={[0.05, 12, 8]} />
          <meshStandardMaterial color="#9fb38f" roughness={0.9} />
        </mesh>
        <mesh position={[-0.08, 0.018, -0.04]}>
          <sphereGeometry args={[0.045, 12, 8]} />
          <meshStandardMaterial color="#e4dcc8" roughness={0.9} />
        </mesh>
      </group>
    </group>
  )
}

export function Loading() {
  return (
    <Html center>
      <div className="rounded-md border border-lime-200/20 bg-zinc-950/90 px-3 py-2 text-sm text-lime-50 shadow-md">
        Loading model
      </div>
    </Html>
  )
}

useGLTF.preload('/plant.gltf')
useGLTF.preload('/aphid.gltf')
useGLTF.preload('/snails.gltf')











