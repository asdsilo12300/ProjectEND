import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Group, MathUtils } from 'three'
import { resolveAssetUrl } from '../../lib/api'
import { GrassGround, PlantingSpot } from './GrassGround'
import { OutdoorRain } from './OutdoorRain'
import { getRainVisualIntensity } from './rainUtils'

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

export function SceneEnvironment({
  daylight = 1,
  dirtModelUrl = null,
  mode = 'greenhouse',
  plantingAreaLabel = 'Planting area',
  plantSelected = false,
  rainfall = 0,
  windDirection = 0,
  windSpeed = 0,
}) {
  const modelUrl = getDirtModelUrl(dirtModelUrl)
  const { scene } = useGLTF(modelUrl)
  const wetnessRef = useRef(0)
  const ground = useMemo(() => {
    // This asset is the laboratory soil and scattered stones. Keep its central
    // soil surface: the pot belongs to a plant model, not the environment.
    const root = new Group()
    const wetMaterials = []
    const materialCopies = new Map()
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

      const sourceMaterials = Array.isArray(child.material)
        ? child.material
        : [child.material]
      const clonedMaterials = sourceMaterials.map((sourceMaterial) => {
        const existingMaterial = materialCopies.get(sourceMaterial)
        if (existingMaterial) return existingMaterial

        const material = sourceMaterial.clone()
        materialCopies.set(sourceMaterial, material)
        wetMaterials.push({
          baseColor: material.color?.clone?.() ?? null,
          baseEnvMapIntensity: Number(material.envMapIntensity ?? 1),
          baseMetalness: Number(material.metalness ?? 0),
          baseRoughness: Number(material.roughness ?? 1),
          material,
        })
        return material
      })
      child.material = Array.isArray(child.material)
        ? clonedMaterials
        : clonedMaterials[0]
    })
    root.add(groundScene)
    root.updateMatrixWorld(true)

    return { object: root, wetMaterials }
  }, [mode, scene])
  const groundObject = ground.object
  const targetWetness = mode === 'outdoor' ? getRainVisualIntensity(rainfall) : 0

  useFrame((_, delta) => {
    if (mode !== 'outdoor' && wetnessRef.current === 0) return

    const response = targetWetness > wetnessRef.current ? 1.9 : 0.14
    wetnessRef.current = MathUtils.damp(
      wetnessRef.current,
      targetWetness,
      response,
      Math.min(delta, 0.05),
    )
    const wetness = wetnessRef.current

    ground.wetMaterials.forEach((entry) => {
      const { material } = entry
      if (entry.baseColor && material.color) {
        material.color.copy(entry.baseColor).multiplyScalar(1 - wetness * 0.24)
      }
      if ('roughness' in material) {
        material.roughness = MathUtils.lerp(entry.baseRoughness, 0.38, wetness)
      }
      if ('metalness' in material) {
        material.metalness = MathUtils.lerp(entry.baseMetalness, 0.04, wetness)
      }
      if ('envMapIntensity' in material) {
        material.envMapIntensity = MathUtils.lerp(entry.baseEnvMapIntensity, 1.25, wetness)
      }
    })
  })

  useEffect(() => () => {
    ground.wetMaterials.forEach(({ material }) => material.dispose())
  }, [ground])

  return (
    <group>
      <primitive object={groundObject} />
      <PlantingSpot groundObject={groundObject} label={plantingAreaLabel} plantSelected={plantSelected} />
      {mode === 'outdoor' && (
        <>
          <GrassGround
            daylight={daylight}
            groundObject={groundObject}
            mode={mode}
            rainfall={rainfall}
          />
          <OutdoorRain
            daylight={daylight}
            groundObject={groundObject}
            rainfall={rainfall}
            windDirection={windDirection}
            windSpeed={windSpeed}
          />
        </>
      )}
    </group>
  )
}

useGLTF.preload('/dirt.gltf')
