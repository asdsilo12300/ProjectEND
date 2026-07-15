import { useEffect, useMemo, useRef } from 'react'
import { Html, useAnimations, useGLTF } from '@react-three/drei'
import { Box3, Color, DoubleSide, Vector3 } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { resolveAssetUrl } from '../../lib/api'
import { GltfPlant } from './GltfPlant'

const BASE_PLANT_SCALE = 1.1
const PLANT_BASE_LOCAL_Y = 1.45
const PLANT_PIVOT = [0.75, -0.105, 0]
const PLANT_LOCAL_OFFSET = [0, -PLANT_BASE_LOCAL_Y, 0]
const PLANT_ASSET_ALIGNMENT_POSITION = [-0.1, -0.026, 0.02]
const PLANT_ASSET_ALIGNMENT_SCALE = 0.9

const STEM_LEAN_BY_STATE = {
  leaning: 0.095,
  soft: -0.055,
  thin: 0.035,
  dry: -0.04,
  slow: 0.022,
  short: 0.018,
}

const LEAF_LEAN_BY_STATE = {
  wilted: 0.035,
  drooping: -0.025,
  burnt_edges: 0.018,
  root_burn: -0.018,
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0))
}

function getPlantPresentation(visualOverrides = {}) {
  const visualScale = clamp(visualOverrides.scale ?? 1, 0.5, 1.5)
  const stemLean = STEM_LEAN_BY_STATE[visualOverrides.stemState] ?? 0
  const leafLean = LEAF_LEAN_BY_STATE[visualOverrides.leafState] ?? 0

  return {
    scale: BASE_PLANT_SCALE * visualScale,
    lean: clamp(stemLean + leafLean, -0.14, 0.14),
  }
}

function PlantPresentationGroup({ children, visualOverrides = {} }) {
  const presentation = getPlantPresentation(visualOverrides)

  return (
    <group position={PLANT_PIVOT} rotation={[0, 0, presentation.lean]} scale={presentation.scale}>
      <group position={PLANT_LOCAL_OFFSET}>{children}</group>
    </group>
  )
}

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

function GenericPlantModel({ modelUrl, visualOverrides, isMature = false, isPaused = false, growthProgress = 0 }) {
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
    <PlantPresentationGroup visualOverrides={visualOverrides}>
      <group ref={group}>
        <primitive object={clonedScene} />
      </group>
    </PlantPresentationGroup>
  )
}

export function PlantModel({ modelUrl = '/plant.gltf', visualOverrides = {}, isMature = false, isPaused = false, growthProgress = 0, ...props }) {
  if (isBasePlantModel(modelUrl)) {
    return (
      <group {...props}>
        <PlantPresentationGroup visualOverrides={visualOverrides}>
          <GltfPlant modelUrl="/plant.gltf" visualOverrides={visualOverrides} isMature={isMature} isPaused={isPaused} growthProgress={growthProgress} />
        </PlantPresentationGroup>
      </group>
    )
  }

  const resolvedModelUrl = resolveAssetUrl(modelUrl) || '/plant.gltf'

  return <GenericPlantModel modelUrl={resolvedModelUrl} visualOverrides={visualOverrides} isMature={isMature} isPaused={isPaused} growthProgress={growthProgress} {...props} />
}

const pestAnchors = {
  aphid: [
    { position: [-0.02, 2.185, 0.025], rotation: [-0.08, 0.15, 0.04], size: 0.072, modelOffset: [0, 0.004, 0] },
    { position: [0.12, 2.375, -0.035], rotation: [0.12, -0.42, -0.08], size: 0.069, modelOffset: [0, 0.004, 0] },
    { position: [-0.08, 2.595, -0.075], rotation: [-0.16, 0.32, 0.06], size: 0.069, modelOffset: [0, 0.004, 0] },
    { position: [-0.18, 2.972, -0.12], rotation: [0.2, 0.58, -0.1], size: 0.066, modelOffset: [0, 0.004, 0] },
    { position: [0.08, 3.278, -0.08], rotation: [-0.12, -0.28, 0.08], size: 0.064, modelOffset: [0, 0.004, 0] },
  ],
  snail: [
    { position: [0.46, 1.3, 0.3], rotation: [0, 0.16, 0], size: 0.28, modelOffset: [0, 0.002, 0] },
    { position: [-0.42, 1.3, 0.26], rotation: [0, -0.18, 0], size: 0.27, modelOffset: [0, 0.002, 0] },
    { position: [0.12, 1.29, 0.34], rotation: [0, 0.04, 0], size: 0.26, modelOffset: [0, 0.002, 0] },
  ],
  fungus: [
    { position: [0.025, 2.19, 0.035], rotation: [-0.08, 0.12, 0.04], surface: 'leaf', scale: 1 },
    { position: [0.12, 2.38, -0.03], rotation: [0.12, -0.38, -0.08], surface: 'leaf', scale: 0.9 },
    { position: [-0.1, 2.60, -0.06], rotation: [-0.16, 0.28, 0.06], surface: 'leaf', scale: 0.84 },
    { position: [0.015, 1.82, 0.055], rotation: [0, 0.12, -0.04], surface: 'stem', scale: 0.72 },
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

function getVisiblePestAnchors(name, riskChance = 0, seed = '') {
  const anchors = pestAnchors[name] ?? pestAnchors.fungus
  const risk = Number(riskChance) || 0
  const count = name === 'fungus'
    ? (risk >= 75 ? 4 : risk >= 45 ? 3 : 2)
    : name === 'aphid'
      ? (risk >= 75 ? 4 : risk >= 45 ? 3 : 2)
    : (risk >= 75 ? 3 : risk >= 45 ? 2 : 1)
  const start = stableIndex(`${name}-${seed}`, anchors.length)

  return Array.from({ length: Math.min(count, anchors.length) }, (_, index) => anchors[(start + index) % anchors.length])
}

function getGrowthAdjustedAnchor(anchor, growthProgress, pestName) {
  if (pestName === 'snail') return anchor

  const progress = clamp(growthProgress, 0, 1)
  const growthFactor = 0.38 + Math.sqrt(progress) * 0.62
  const [x, y, z] = anchor.position

  return {
    ...anchor,
    position: [
      x * growthFactor,
      PLANT_BASE_LOCAL_Y + (y - PLANT_BASE_LOCAL_Y) * growthFactor,
      z * growthFactor,
    ],
  }
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
  const configuredModelUrl = resolveAssetUrl(pest?.pest?.model_url ?? pest?.model_url)

  // The bundled assets mirror the seeded database models and remain same-origin
  // in development. Static files served from the API storage endpoint do not
  // carry CORS headers, which would otherwise make GLTFLoader hide these pests.
  if (name === 'aphid' && (!configuredModelUrl || configuredModelUrl.endsWith('/models/aphid.gltf'))) return '/aphid.gltf'
  if (name === 'snail' && (!configuredModelUrl || configuredModelUrl.endsWith('/models/snails.gltf'))) return '/snails.gltf'
  if (configuredModelUrl) return configuredModelUrl
  if (name === 'aphid') return '/aphid.gltf'
  if (name === 'snail') return '/snails.gltf'
  return null
}

export function PestModel({ pest, index = 0, visualOverrides = {}, growthProgress = 0 }) {
  const name = normalizePestName(pest)
  const modelUrl = pestModelUrl(name, pest)
  const useSurfaceFungus = name === 'fungus' || !modelUrl
  const useProceduralSnail = name === 'snail' && modelUrl === '/snails.gltf'
  const risk = Number(pest?.risk_chance) || 0
  const stableSeed = `${name}-${pest?.id ?? index}`
  const anchors = getVisiblePestAnchors(name, risk, stableSeed)
    .map((anchor) => getGrowthAdjustedAnchor(anchor, growthProgress, name))
  const pestVisuals = useProceduralSnail
    ? anchors.map((anchor, anchorIndex) => (
        <SnailSurfaceModel key={`${stableSeed}-${anchorIndex}`} anchor={anchor} />
      ))
    : !useSurfaceFungus
      ? anchors.map((anchor, anchorIndex) => (
          <LoadedPest key={`${stableSeed}-${anchorIndex}`} modelUrl={modelUrl} anchor={anchor} />
        ))
      : anchors.map((anchor, anchorIndex) => (
          <FungusSurfacePatch key={`${stableSeed}-${anchorIndex}`} anchor={anchor} variant={anchorIndex} />
        ))

  return (
    <PlantPresentationGroup visualOverrides={visualOverrides}>
      {name === 'snail'
        ? pestVisuals
        : (
            <group position={PLANT_ASSET_ALIGNMENT_POSITION} scale={PLANT_ASSET_ALIGNMENT_SCALE}>
              {pestVisuals}
            </group>
          )}
    </PlantPresentationGroup>
  )
}

function SnailSurfaceModel({ anchor }) {
  const modelScale = (anchor.size ?? 0.28) / 0.28

  return (
    <group position={anchor.position} rotation={anchor.rotation} scale={modelScale}>
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.19, 0.075, 1]}>
        <circleGeometry args={[1, 20]} />
        <meshBasicMaterial color="#172015" transparent opacity={0.32} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.04, 0.015]} scale={[1, 0.31, 0.42]}>
        <sphereGeometry args={[0.16, 18, 12]} />
        <meshStandardMaterial color="#9daa6f" roughness={0.9} />
      </mesh>
      <mesh position={[0.15, 0.055, 0.018]}>
        <sphereGeometry args={[0.055, 14, 10]} />
        <meshStandardMaterial color="#b6c58b" roughness={0.88} />
      </mesh>
      <mesh position={[-0.035, 0.13, 0.005]} scale={[1, 1, 0.48]}>
        <sphereGeometry args={[0.12, 20, 14]} />
        <meshStandardMaterial color="#a85d2b" roughness={0.76} metalness={0.02} />
      </mesh>
      <mesh position={[-0.035, 0.13, 0.064]}>
        <torusGeometry args={[0.064, 0.012, 8, 24]} />
        <meshStandardMaterial color="#e0a056" roughness={0.72} />
      </mesh>
      {[-0.034, 0.034].map((zOffset) => (
        <group key={zOffset} position={[0.174, 0.092, zOffset]} rotation={[0, 0, -0.42]}>
          <mesh position={[0, 0.052, 0]}>
            <cylinderGeometry args={[0.005, 0.007, 0.11, 7]} />
            <meshStandardMaterial color="#b6c58b" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.112, 0]}>
            <sphereGeometry args={[0.012, 8, 6]} />
            <meshStandardMaterial color="#263020" roughness={0.82} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function LoadedPest({ modelUrl, anchor }) {
  const { scene } = useGLTF(modelUrl)
  const normalizedAsset = useMemo(() => {
    const clone = cloneSkeleton(scene)
    const ownedMaterials = []
    const box = new Box3().setFromObject(clone)
    const size = new Vector3()
    const center = new Vector3()

    box.getSize(size)
    box.getCenter(center)

    clone.traverse((child) => {
      if (!child.isMesh || !child.material) return

      child.frustumCulled = false
      const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material]
      const clonedMaterials = sourceMaterials.map((sourceMaterial) => {
        const material = sourceMaterial.clone()
        material.side = DoubleSide
        material.transparent = false
        material.depthWrite = true
        material.needsUpdate = true
        ownedMaterials.push(material)
        return material
      })

      child.material = Array.isArray(child.material) ? clonedMaterials : clonedMaterials[0]
    })

    const maxDimension = Math.max(size.x, size.y, size.z) || 1
    const targetSize = anchor.size ?? 0.12
    const scale = targetSize / maxDimension
    clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
    clone.scale.setScalar(scale)
    clone.updateMatrixWorld(true)

    return { scene: clone, materials: ownedMaterials }
  }, [anchor.size, scene])

  useEffect(() => () => {
    normalizedAsset.materials.forEach((material) => material.dispose())
  }, [normalizedAsset])

  return (
    <group position={anchor.position} rotation={anchor.rotation}>
      <group position={anchor.modelOffset ?? [0, 0, 0]} rotation={anchor.modelRotation ?? [0, 0, 0]}>
        <primitive object={normalizedAsset.scene} />
      </group>
    </group>
  )
}

const FUNGUS_SPOTS = [
  { offset: [0, 0], size: [0.071, 0.047], color: '#5f8e4f', rotation: 0.2 },
  { offset: [0.056, -0.014], size: [0.044, 0.033], color: '#8ab877', rotation: -0.5 },
  { offset: [-0.052, 0.018], size: [0.039, 0.029], color: '#739f61', rotation: 0.65 },
  { offset: [0.019, 0.044], size: [0.027, 0.022], color: '#eef2e7', rotation: -0.2 },
  { offset: [-0.018, -0.039], size: [0.022, 0.017], color: '#faf9ed', rotation: 0.35 },
  { offset: [0.068, 0.032], size: [0.016, 0.014], color: '#e1ead8', rotation: 0 },
]

function FungusSurfacePatch({ anchor, variant = 0 }) {
  const isStem = anchor.surface === 'stem'
  const patchScale = anchor.scale ?? 1

  return (
    <group position={anchor.position} rotation={anchor.rotation} scale={patchScale}>
      {FUNGUS_SPOTS.map((spot, spotIndex) => {
        const [offsetA, offsetB] = spot.offset
        const position = isStem
          ? [offsetA, offsetB, 0.003 + spotIndex * 0.0003]
          : [offsetA, 0.003 + spotIndex * 0.0003, offsetB]
        const rotation = isStem
          ? [0, 0, spot.rotation + variant * 0.12]
          : [-Math.PI / 2, 0, spot.rotation + variant * 0.12]

        return (
          <mesh
            key={`${spot.color}-${spotIndex}`}
            position={position}
            rotation={rotation}
            scale={[spot.size[0], spot.size[1], 1]}
            renderOrder={3}
          >
            <circleGeometry args={[1, 10]} />
            <meshStandardMaterial
              color={spot.color}
              emissive={spot.color}
              emissiveIntensity={spotIndex >= 3 ? 0.035 : 0.012}
              roughness={0.94}
              metalness={0}
              side={DoubleSide}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
        )
      })}
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











