import { useEffect, useMemo, useRef } from 'react'
import { Html, useAnimations, useGLTF } from '@react-three/drei'
import { useLayoutEffect, useState } from 'react'
import { createPortal, useFrame } from '@react-three/fiber'
import { AnimationMixer, Box3, Color, DoubleSide, Vector3 } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { resolveAssetUrl } from '../../lib/api'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { GltfPlant } from './GltfPlant'
import { useGrowthAnimationPose } from './growthAnimationPose'
import { collectGenericPestAttachments, usePlantAttachments, useRegisterPlantAttachments } from './plantAttachments'
import { updateFungusMaterial } from './fungusMaterial'
import { attachPlantStressPivots, usePlantStressMotion } from './plantStressMotion'

const BASE_PLANT_SCALE = 1.1
const PLANT_BASE_LOCAL_Y = 1.45
const PLANT_PIVOT = [0.75, -0.105, 0]
const PLANT_LOCAL_OFFSET = [0, -PLANT_BASE_LOCAL_Y, 0]
const PLANT_ASSET_ALIGNMENT_POSITION = [-0.1, -0.026, 0.02]
const PLANT_ASSET_ALIGNMENT_SCALE = 0.9
const GENERIC_PLANT_TARGET_HEIGHT = 2.15
const GENERIC_MATURE_ANIMATION_FRACTION = 0.95
const TULIP_SOIL_EMBED_DEPTH = 0.2
const TULIP_GROWTH_TRANSITION_RESPONSE = 3.2
// Frames 0-82 in the uploaded Tulip clip contain extreme compensated bone
// transforms. Frames 83-257 are stable when sampled on their authored 24 fps
// boundaries, so biological growth is remapped to that safe window.
const TULIP_GROWTH_ANIMATION = Object.freeze({
  startFrame: 83,
  endFrame: 257,
  framesPerSecond: 24,
  excludedFrames: Object.freeze([161]),
  progressExponent: 1.2,
  transitionResponse: TULIP_GROWTH_TRANSITION_RESPONSE,
})
const DEAD_PLANT_OVERRIDES = {
  leafColor: '#6f5232',
  stemColor: '#493628',
  leafState: 'dead',
  stemState: 'dead',
  scale: 0.9,
}

const STEM_LEAN_BY_STATE = {
  dead: 0.15,
  leaning: 0.095,
  soft: -0.055,
  thin: 0.035,
  dry: -0.04,
  slow: 0.022,
  short: 0.018,
}

const LEAF_LEAN_BY_STATE = {
  dead: 0.05,
  wilted: 0.035,
  drooping: -0.025,
  burnt_edges: 0.018,
  root_burn: -0.018,
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0))
}

function smoothstep(value) {
  const progress = clamp(value, 0, 1)
  return progress * progress * (3 - 2 * progress)
}

function isTulipPlant(plantName = '') {
  const normalizedName = String(plantName).trim().toLowerCase()
  return normalizedName.includes('tulip') || normalizedName.includes('ทิวลิป')
}

function tulipGrowthScale(progress) {
  // Bulb establishment stays compact and then gains height as leaves emerge,
  // instead of showing a miniature mature flower at the start.
  return 0.34 + smoothstep(progress) * 0.66
}

function PlantGrowthGroup({ children, isTulip = false, pivotY = 0, progress = 1 }) {
  const group = useRef(null)
  const targetScale = isTulip ? tulipGrowthScale(progress) : 1
  const targetScaleRef = useRef(targetScale)
  const displayedScaleRef = useRef(targetScale)
  const [initialScale] = useState(targetScale)

  useLayoutEffect(() => {
    targetScaleRef.current = targetScale
  }, [targetScale])

  useFrame((_, delta) => {
    if (!group.current) return

    const blend = isTulip
      ? 1 - Math.exp(-Math.min(Math.max(delta, 0), 0.1) * TULIP_GROWTH_TRANSITION_RESPONSE)
      : 1
    displayedScaleRef.current += (targetScaleRef.current - displayedScaleRef.current) * blend
    group.current.scale.setScalar(displayedScaleRef.current)
  })

  return (
    <group
      name={isTulip ? 'Tulip_growth_pivot' : 'Plant_growth_pivot'}
      position={[0, pivotY, 0]}
      ref={group}
      scale={initialScale}
    >
      <group position={[0, -pivotY, 0]}>{children}</group>
    </group>
  )
}

function getEffectiveVisualOverrides(visualOverrides = {}, health = 100) {
  if (Number(health) > 0) return visualOverrides

  return {
    ...visualOverrides,
    ...DEAD_PLANT_OVERRIDES,
  }
}

function getPlantPresentation(visualOverrides = {}) {
  const visualScale = clamp(visualOverrides.scale ?? 1, 0.5, 1.5)
  const stemLean = STEM_LEAN_BY_STATE[visualOverrides.stemState] ?? 0
  const leafLean = LEAF_LEAN_BY_STATE[visualOverrides.leafState] ?? 0
  const isDead = visualOverrides.leafState === 'dead' || visualOverrides.stemState === 'dead'

  return {
    scale: BASE_PLANT_SCALE * visualScale,
    heightScale: isDead ? 0.92 : 1,
    lean: clamp(stemLean + leafLean, -0.22, 0.22),
  }
}

function PlantPresentationGroup({ children, visualOverrides = {} }) {
  const presentation = getPlantPresentation(visualOverrides)

  return (
    <group
      position={PLANT_PIVOT}
      rotation={[0, 0, presentation.lean]}
      scale={[presentation.scale, presentation.scale * presentation.heightScale, presentation.scale]}
    >
      <group position={PLANT_LOCAL_OFFSET}>{children}</group>
    </group>
  )
}

function applyPlantOverrides(object, overrides = {}, health = 100) {
  const isHeatScorched = overrides.leafState === 'burnt_edges'
  const leafColor = isHeatScorched
    ? new Color('#6b3b25')
    : overrides.leafColor ? new Color(overrides.leafColor) : null
  const stemColor = isHeatScorched
    ? new Color('#4c2d22')
    : overrides.stemColor ? new Color(overrides.stemColor) : null
  const isStressState = (overrides.leafState && overrides.leafState !== 'upright')
    || (overrides.stemState && overrides.stemState !== 'upright')
  const isDead = overrides.leafState === 'dead' || overrides.stemState === 'dead'
  const healthStress = clamp((100 - Number(health ?? 100)) / 100, 0, 1)
  const stressTintStrength = isDead
    ? 0.94
    : isStressState
      ? isHeatScorched
        ? clamp(0.66 + healthStress * 0.3, 0.66, 0.94)
        : clamp(0.48 + healthStress * 0.4, 0.48, 0.84)
      : 0
  let targetedMaterialCount = 0

  function restoreOriginalMaterial(material) {
    if (!material) return material

    if (material.color) {
      const originalColor = material.userData?.plantOriginalColor ?? `#${material.color.getHexString()}`
      material.userData = {
        ...material.userData,
        plantOriginalColor: originalColor,
        plantOriginalMetalness: material.userData?.plantOriginalMetalness ?? material.metalness,
        plantOriginalRoughness: material.userData?.plantOriginalRoughness ?? material.roughness,
      }
      material.color.set(originalColor)
    }
    if (Number.isFinite(material.userData?.plantOriginalMetalness)) {
      material.metalness = material.userData.plantOriginalMetalness
    }
    if (Number.isFinite(material.userData?.plantOriginalRoughness)) {
      material.roughness = material.userData.plantOriginalRoughness
    }

    return material
  }

  object.traverse((child) => {
    if (!child.isMesh || !child.material) return

    child.castShadow = true
    child.receiveShadow = true
    const meshName = child.name?.toLowerCase?.() ?? ''
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    const nextMaterials = materials.map((material) => {
      const materialName = material?.name?.toLowerCase?.() ?? ''
      const isLeaf = materialName.includes('leaf') || meshName.includes('leaf')
      const isStem = materialName.includes('stem') || materialName.includes('trunk') || meshName.includes('stem') || meshName.includes('trunk')

      if (!isLeaf && !isStem) return material

      const nextMaterial = restoreOriginalMaterial(material)
      if (isStressState && nextMaterial.color && leafColor && isLeaf) {
        nextMaterial.color.lerp(leafColor, stressTintStrength)
      }
      if (isStressState && nextMaterial.color && stemColor && isStem) {
        nextMaterial.color.lerp(stemColor, stressTintStrength)
      }
      if (isDead) {
        nextMaterial.roughness = 1
        nextMaterial.metalness = 0
        if (nextMaterial.emissive) nextMaterial.emissive.set('#000000')
        nextMaterial.emissiveIntensity = 0
      } else if (isHeatScorched) {
        nextMaterial.roughness = Math.max(Number(nextMaterial.roughness ?? 0), 0.96)
        nextMaterial.metalness = 0
      }
      nextMaterial.needsUpdate = true
      targetedMaterialCount += 1
      return nextMaterial
    })

    child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0]
  })

  // Some uploaded GLTF files use one material for petals, stems, and leaves.
  // They have no leaf/stem names to target, so apply a restrained whole-model
  // stress tint while preserving the artist's original healthy colours.
  if (targetedMaterialCount === 0) {
    object.traverse((child) => {
      if (!child.isMesh || !child.material) return

      const materials = Array.isArray(child.material) ? child.material : [child.material]
      const nextMaterials = materials.map((material) => {
        const nextMaterial = restoreOriginalMaterial(material)
        const stressColor = leafColor ?? stemColor
        if (isStressState && nextMaterial.color && stressColor) {
          // The tulip asset uses one textured material for petals, leaves, and
          // stems. A stronger whole-model tint is needed for heat/cold/water
          // symptoms to remain visible through that texture.
          nextMaterial.color.lerp(stressColor, stressTintStrength)
        }
        if (isDead) {
          nextMaterial.roughness = 1
          nextMaterial.metalness = 0
          if (nextMaterial.emissive) nextMaterial.emissive.set('#000000')
          nextMaterial.emissiveIntensity = 0
        } else if (isHeatScorched) {
          nextMaterial.roughness = Math.max(Number(nextMaterial.roughness ?? 0), 0.96)
          nextMaterial.metalness = 0
        }
        nextMaterial.needsUpdate = true
        return nextMaterial
      })

      child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0]
    })
  }
}

function isBasePlantModel(modelUrl) {
  if (!modelUrl) return true
  // The original Elephant Ear asset is served from either the bundled path or
  // the API storage path. Both must use the purpose-built animated renderer.
  return modelUrl === '/plant.gltf' || modelUrl.endsWith('/plant.gltf')
}

function plantSoilEmbedDepth(plantName = '') {
  return isTulipPlant(plantName) ? TULIP_SOIL_EMBED_DEPTH : 0
}

function applyFungusToPlant(object, fungusRisk = 0) {
  const leafMaterials = new Map()
  const fallbackMaterials = new Map()

  object.traverse((child) => {
    if (!child.isMesh || !child.material || !child.geometry?.attributes?.uv) return

    const meshName = String(child.name ?? '').toLowerCase()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => {
      const materialName = String(material?.name ?? '').toLowerCase()
      if (!fallbackMaterials.has(material)) fallbackMaterials.set(material, child.geometry)
      if ((meshName.includes('leaf') || materialName.includes('leaf')) && !leafMaterials.has(material)) {
        leafMaterials.set(material, child.geometry)
      }
    })
  })

  const targets = leafMaterials.size > 0 ? leafMaterials : fallbackMaterials
  const targetEntries = [...targets.entries()]
  targetEntries.forEach(([material, geometry], index) => {
    updateFungusMaterial(material, fungusRisk, index * 2.37 + 1.4, geometry)
  })
}

function GenericPlantModel({ modelUrl, plantName = '', visualOverrides, fungusRisk = 0, health = 100, isMature = false, growthProgress = 0, ...props }) {
  const group = useRef(null)
  const isTulip = isTulipPlant(plantName)
  const { scene, animations } = useGLTF(modelUrl)
  const clonedScene = useMemo(() => {
    const clone = cloneSkeleton(scene)
    const decorativeGroundMeshes = []
    const planterGroups = []

    clone.traverse((child) => {
      const meshName = String(child.name ?? '').toLowerCase()
      if (meshName === 'pot_0' || meshName === 'soil_1') {
        planterGroups.push(child)
        return
      }

      if (!child.isMesh) return

      const materialNames = (Array.isArray(child.material) ? child.material : [child.material])
        .map((material) => String(material?.name ?? '').toLowerCase())
      const isPlanterMesh = meshName.includes('pot')
        || materialNames.some((name) => name.includes('pot_mat') || name.includes('soil_mat'))
      if (isPlanterMesh) {
        planterGroups.push(child)
      } else if (meshName.includes('ground') || materialNames.some((name) => name.includes('ground'))) {
        decorativeGroundMeshes.push(child)
      }

      const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material]
      const displayMaterials = sourceMaterials.map((sourceMaterial) => {
        if (!sourceMaterial?.clone) return sourceMaterial

        const material = sourceMaterial.clone()
        // Some uploaded GLTF exports mark every plant material as blended.
        // That makes foliage look translucent and render behind the ground.
        // Keep texture cut-outs while rendering the plant as a solid model.
        material.transparent = false
        material.opacity = 1
        material.depthWrite = true
        material.alphaTest = material.alphaMap ? Math.max(material.alphaTest ?? 0, 0.02) : 0
        material.side = DoubleSide
        material.needsUpdate = true
        return material
      })
      child.material = Array.isArray(child.material) ? displayMaterials : displayMaterials[0]
    })

    planterGroups.forEach((object) => object.parent?.remove(object))
    decorativeGroundMeshes.forEach((mesh) => mesh.parent?.remove(mesh))

    let measurementMixer = null
    if (animations.length > 0) {
      const clip = animations[0]
      measurementMixer = new AnimationMixer(clone)
      measurementMixer.clipAction(clip).play()
      measurementMixer.setTime(isTulip
        ? Math.min(clip.duration, TULIP_GROWTH_ANIMATION.endFrame / TULIP_GROWTH_ANIMATION.framesPerSecond)
        : clip.duration * GENERIC_MATURE_ANIMATION_FRACTION)
      clone.updateMatrixWorld(true)
    }

    const sourceBox = new Box3().setFromObject(clone)
    const sourceSize = new Vector3()
    sourceBox.getSize(sourceSize)

    // Uploaded assets are not always authored Y-up. Tulip/Sketchfab exports,
    // for example, can arrive Z-up and otherwise appear flat or far too large.
    let sourceUpAxis = 'y'
    if (sourceSize.z > sourceSize.y * 1.25 && sourceSize.z >= sourceSize.x) {
      clone.rotation.x = Math.PI / 2
      sourceUpAxis = 'z'
    } else if (sourceSize.x > sourceSize.y * 1.25 && sourceSize.x > sourceSize.z) {
      clone.rotation.z = Math.PI / 2
      sourceUpAxis = 'x'
    }
    clone.updateMatrixWorld(true)

    const box = new Box3().setFromObject(clone)
    const size = new Vector3()
    const center = new Vector3()
    box.getSize(size)
    box.getCenter(center)

    const scale = GENERIC_PLANT_TARGET_HEIGHT / Math.max(size.y, 0.001)
    clone.scale.setScalar(scale)
    clone.position.set(
      -center.x * scale,
      PLANT_BASE_LOCAL_Y - box.min.y * scale - plantSoilEmbedDepth(plantName),
      -center.z * scale,
    )
    clone.updateMatrixWorld(true)

    if (measurementMixer) {
      measurementMixer.setTime(0)
      measurementMixer.stopAllAction()
      measurementMixer.uncacheRoot(clone)
      clone.updateMatrixWorld(true)
    }

    attachPlantStressPivots(clone, { upAxis: sourceUpAxis })
    clone.userData.pestAttachments = collectGenericPestAttachments(clone)

    return clone
  }, [animations, isTulip, plantName, scene])
  const { actions, mixer } = useAnimations(animations, group)
  const progress = Math.min(1, Math.max(0, Number(growthProgress) || 0))
  const displayedGrowthProgress = isMature ? 1 : progress
  useGrowthAnimationPose(
    actions,
    mixer,
    displayedGrowthProgress,
    isTulip ? TULIP_GROWTH_ANIMATION : GENERIC_MATURE_ANIMATION_FRACTION,
  )
  usePlantStressMotion(clonedScene.userData?.plantStressPivots, visualOverrides, health, fungusRisk)
  useRegisterPlantAttachments(clonedScene.userData?.pestAttachments)

  useEffect(() => {
    applyPlantOverrides(clonedScene, visualOverrides, health)
  }, [clonedScene, health, visualOverrides])

  useEffect(() => {
    applyFungusToPlant(clonedScene, fungusRisk)
  }, [clonedScene, fungusRisk, visualOverrides])

  return (
    <group {...props}>
      <PlantPresentationGroup visualOverrides={visualOverrides}>
        <PlantGrowthGroup
          isTulip={isTulip}
          pivotY={PLANT_BASE_LOCAL_Y - plantSoilEmbedDepth(plantName)}
          progress={displayedGrowthProgress}
        >
          <group ref={group}>
            <primitive object={clonedScene} />
          </group>
        </PlantGrowthGroup>
      </PlantPresentationGroup>
    </group>
  )
}

export function PlantModel({ modelUrl = '/plant.gltf', plantName = '', visualOverrides = {}, fungusRisk = 0, health = 100, isMature = false, growthProgress = 0, ...props }) {
  const effectiveVisualOverrides = useMemo(
    () => getEffectiveVisualOverrides(visualOverrides, health),
    [health, visualOverrides],
  )

  if (isBasePlantModel(modelUrl)) {
    return (
      <group {...props}>
        <PlantPresentationGroup visualOverrides={effectiveVisualOverrides}>
          <GltfPlant modelUrl="/plant.gltf" visualOverrides={effectiveVisualOverrides} fungusRisk={fungusRisk} health={health} isMature={isMature} growthProgress={growthProgress} />
        </PlantPresentationGroup>
      </group>
    )
  }

  const resolvedModelUrl = resolveAssetUrl(modelUrl) || '/plant.gltf'

  return <GenericPlantModel modelUrl={resolvedModelUrl} plantName={plantName} visualOverrides={effectiveVisualOverrides} fungusRisk={fungusRisk} health={health} isMature={isMature} growthProgress={growthProgress} {...props} />
}

const pestAnchors = {
  aphid: [
    { position: [-0.02, 2.185, 0.025], rotation: [-0.08, 0.15, 0.04], size: 0.072, modelOffset: [0, -0.006, 0] },
    { position: [0.12, 2.375, -0.035], rotation: [0.12, -0.42, -0.08], size: 0.069, modelOffset: [0, -0.006, 0] },
    { position: [-0.08, 2.595, -0.075], rotation: [-0.16, 0.32, 0.06], size: 0.069, modelOffset: [0, -0.006, 0] },
    { position: [-0.18, 2.972, -0.12], rotation: [0.2, 0.58, -0.1], size: 0.066, modelOffset: [0, -0.005, 0] },
    { position: [0.08, 3.278, -0.08], rotation: [-0.12, -0.28, 0.08], size: 0.064, modelOffset: [0, -0.005, 0] },
  ],
  snail: [
    { position: [0.46, 1.3, 0.3], rotation: [0, 0.16, 0], size: 0.11, modelOffset: [0, 0.002, 0] },
    { position: [-0.42, 1.3, 0.26], rotation: [0, -0.18, 0], size: 0.105, modelOffset: [0, 0.002, 0] },
    { position: [0.12, 1.29, 0.34], rotation: [0, 0.04, 0], size: 0.1, modelOffset: [0, 0.002, 0] },
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
  const plantAttachments = usePlantAttachments()
  if (useSurfaceFungus) return null

  const anchors = getVisiblePestAnchors(name, risk, stableSeed)
    .map((anchor) => getGrowthAdjustedAnchor(anchor, growthProgress, name))
  const attachmentStart = plantAttachments.length > 0
    ? stableIndex(`surface-${stableSeed}`, plantAttachments.length)
    : 0
  const pestVisuals = useProceduralSnail
    ? anchors.map((anchor, anchorIndex) => (
        <SnailSurfaceModel key={`${stableSeed}-${anchorIndex}`} anchor={anchor} />
      ))
    : anchors.map((anchor, anchorIndex) => (
        <LoadedPest
          key={`${stableSeed}-${anchorIndex}`}
          modelUrl={modelUrl}
          anchor={anchor}
          attachment={name === 'aphid' && plantAttachments.length > 0
            ? plantAttachments[(attachmentStart + anchorIndex) % plantAttachments.length]
            : null}
          pestName={name}
        />
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

function LoadedPest({ modelUrl, anchor, attachment = null, pestName }) {
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

  const visual = (
    <>
      {pestName === 'aphid' && (
        <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.35, 0.72, 1]} renderOrder={1}>
          <circleGeometry args={[0.018, 16]} />
          <meshBasicMaterial color="#152012" transparent opacity={0.24} depthWrite={false} />
        </mesh>
      )}
      <group position={anchor.modelOffset ?? [0, 0, 0]} rotation={anchor.modelRotation ?? [0, 0, 0]}>
        <primitive object={normalizedAsset.scene} />
      </group>
    </>
  )

  if (attachment?.object) {
    return createPortal(
      <group position={attachment.position} rotation={attachment.rotation}>
        <group rotation={anchor.rotation}>
          {visual}
        </group>
      </group>,
      attachment.object,
    )
  }

  return (
    <group position={anchor.position} rotation={anchor.rotation}>
      {visual}
    </group>
  )
}

export function Loading() {
  return (
    <Html center>
      <div className="w-56 rounded-lg border border-lime-200/20 bg-zinc-950/90 p-3 shadow-md">
        <LoadingSkeleton count={1} label="Loading 3D plant model" variant="panel" />
      </div>
    </Html>
  )
}

useGLTF.preload('/plant.gltf')
useGLTF.preload('/aphid.gltf')











