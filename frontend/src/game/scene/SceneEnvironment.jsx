import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Group } from 'three'
import { resolveAssetUrl } from '../../lib/api'
import { GrassGround, PlantingSpot } from './GrassGround'

function getDirtModelUrl(dirtModelUrl) {
  const resolvedModelUrl = resolveAssetUrl(dirtModelUrl)

  if (!resolvedModelUrl || resolvedModelUrl.endsWith('/models/dirt.gltf')) return '/dirt.gltf'
  return resolvedModelUrl
}

function isScatteredRock(object) {
  const name = String(object?.name ?? '').toLowerCase()

  return name.startsWith('soil_clod_')
    || name.includes('scattered_rock')
    || name.includes('scattered_stone')
    || name.includes('pebble')
}

export function SceneEnvironment({ daylight = 1, dirtModelUrl = null, mode = 'greenhouse', plantingAreaLabel = 'Planting area', plantSelected = false }) {
  const modelUrl = getDirtModelUrl(dirtModelUrl)
  const { scene } = useGLTF(modelUrl)
  const groundObject = useMemo(() => {
    // This asset is the laboratory soil and scattered stones. Keep its central
    // soil surface: the pot belongs to a plant model, not the environment.
    const root = new Group()
    const isOutdoor = mode === 'outdoor'

    root.name = 'simulation-ground'
    root.position.set(0.75, -0.42, 0)
    root.scale.setScalar(isOutdoor ? 1.68 : 1.6)
    root.rotation.set(0, isOutdoor ? -0.1 : -0.18, 0)
    const groundScene = scene.clone(true)
    groundScene.traverse((child) => {
      if (!isOutdoor && isScatteredRock(child)) {
        child.visible = false
        return
      }

      if (!child.isMesh) return
      child.castShadow = false
      child.receiveShadow = true
    })
    root.add(groundScene)
    root.updateMatrixWorld(true)

    return root
  }, [mode, scene])

  return (
    <group>
      <primitive object={groundObject} />
      <PlantingSpot groundObject={groundObject} label={plantingAreaLabel} plantSelected={plantSelected} />
      {mode === 'outdoor' && (
        <GrassGround daylight={daylight} groundObject={groundObject} mode={mode} />
      )}
    </group>
  )
}

useGLTF.preload('/dirt.gltf')
