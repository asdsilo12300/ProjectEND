import { useEffect, useMemo, useRef } from 'react'
import { Html, useAnimations, useGLTF } from '@react-three/drei'
import { Box3, Color, Vector3 } from 'three'
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
  const resolvedModelUrl = resolveAssetUrl(modelUrl) || '/plant.gltf'
  const scale = 1.1
  const lean = 0

  if (isBasePlantModel(resolvedModelUrl)) {
    return (
      <group position={PLANT_ORIGIN} scale={scale} rotation={[0, 0, lean]} {...props}>
        <GltfPlant visualOverrides={visualOverrides} isMature={isMature} isPaused={isPaused} growthProgress={growthProgress} />
      </group>
    )
  }

  return <GenericPlantModel modelUrl={resolvedModelUrl} visualOverrides={visualOverrides} scale={scale} lean={lean} isMature={isMature} isPaused={isPaused} growthProgress={growthProgress} {...props} />
}

const pestAnchors = {
  aphid: [
    { position: [0.02, 1.34, 0.08], rotation: [0.2, -0.45, 0.15], size: 0.055 },
    { position: [-0.18, 1.04, -0.06], rotation: [0.12, 0.85, -0.12], size: 0.048 },
    { position: [0.16, 0.72, 0.1], rotation: [0.18, -0.1, 0.2], size: 0.044 },
  ],
  snail: [
    { position: [0.2, 0.84, 0.1], rotation: [0.1, 0.7, -0.1], size: 0.085 },
    { position: [-0.16, 0.52, -0.08], rotation: [0.12, -0.55, 0.08], size: 0.078 },
    { position: [0.05, 0.18, 0.12], rotation: [0, 0.25, 0], size: 0.092 },
  ],
  fungus: [
    { position: [0.12, 0.72, -0.04], rotation: [0.05, 0.25, 0.1], scale: 0.08 },
    { position: [-0.08, 0.38, 0.08], rotation: [-0.1, -0.2, 0], scale: 0.07 },
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

export function PestModel({ pest, index = 0 }) {
  const modelUrl = resolveAssetUrl(pest?.pest?.model_url)
  const name = pest?.pest?.name_en ?? 'fungus'
  const anchor = getPestAnchor(name, index, pest?.id)

  if (!modelUrl) {
    return <FungusPlaceholder anchor={anchor} />
  }

  return <LoadedPest modelUrl={modelUrl} name={name} anchor={anchor} />
}

function LoadedPest({ modelUrl, name, anchor }) {
  const { scene } = useGLTF(modelUrl)
  const normalizedAsset = useMemo(() => {
    const clone = scene.clone(true)
    const box = new Box3().setFromObject(clone)
    const size = new Vector3()
    const center = new Vector3()

    box.getSize(size)
    box.getCenter(center)

    const maxDimension = Math.max(size.x, size.y, size.z) || 1
    const targetSize = anchor.size ?? (name === 'aphid' ? 0.05 : 0.08)

    return {
      scene: clone,
      offset: center.multiplyScalar(-1),
      scale: targetSize / maxDimension,
    }
  }, [anchor.size, name, scene])

  return (
    <group position={PLANT_ORIGIN}>
      <group position={anchor.position} scale={normalizedAsset.scale} rotation={anchor.rotation}>
        <primitive object={normalizedAsset.scene} position={normalizedAsset.offset} />
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
