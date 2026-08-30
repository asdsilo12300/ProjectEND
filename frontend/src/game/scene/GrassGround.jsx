import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Html, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Box3, Color, DoubleSide, MeshStandardMaterial, Object3D, Raycaster, Vector3 } from 'three'
import { getRainVisualIntensity } from './rainUtils'
import { findGroundSurface, findPlantingHeight, PLANTING_CENTER, PLANTING_SURFACE_LIFT } from './plantingSurface'

const GRASS_MODEL_URLS = {
  meadow: '/scenes/grass/scene.gltf',
  pack: '/scenes/grass-pack-lp/scene.gltf',
  cemetery: '/scenes/grass-tuft-cemetery/scene.gltf',
}
const PLANTING_CLEAR_RADIUS = 1
const DOWN = new Vector3(0, -1, 0)

function seededRandom(seed) {
  let state = seed >>> 0

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function PlantingSpot({ groundObject, label = 'Planting area', plantSelected, plantingHeight: suppliedPlantingHeight }) {
  const ringRef = useRef(null)
  const calculatedPlantingHeight = useMemo(() => findPlantingHeight(groundObject), [groundObject])
  const plantingHeight = Number.isFinite(suppliedPlantingHeight)
    ? suppliedPlantingHeight
    : calculatedPlantingHeight

  useFrame(({ clock }) => {
    const ring = ringRef.current
    if (!ring) return

    const pulse = (Math.sin(clock.elapsedTime * 2.2) + 1) / 2
    const scale = plantSelected ? 1 : 1 + pulse * 0.025
    ring.scale.setScalar(scale)
    ring.material.opacity = plantSelected ? 0.28 : 0.5 + pulse * 0.18
  })

  return (
    <group position={[PLANTING_CENTER[0], plantingHeight + PLANTING_SURFACE_LIFT, PLANTING_CENTER[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <circleGeometry args={[0.88, 64]} />
        <meshBasicMaterial
          color="#162319"
          transparent
          opacity={plantSelected ? 0.08 : 0.14}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[0.86, 0.96, 72]} />
        <meshBasicMaterial
          color={plantSelected ? '#9bcf82' : '#c6ff9f'}
          side={DoubleSide}
          transparent
          opacity={plantSelected ? 0.28 : 0.58}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-3}
        />
      </mesh>
      {!plantSelected && (
        <group position={[0, 0.012, 0]}>
          <mesh>
            <boxGeometry args={[0.5, 0.018, 0.075]} />
            <meshBasicMaterial color="#d8ffc2" transparent opacity={0.72} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.075, 0.018, 0.5]} />
            <meshBasicMaterial color="#d8ffc2" transparent opacity={0.72} />
          </mesh>
        </group>
      )}
      <Html position={[0, 0.08, 1.08]} center zIndexRange={[8, 0]}>
        <div className={`pointer-events-none inline-flex select-none items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.09em] shadow-[0_7px_18px_rgba(0,0,0,.36)] backdrop-blur-sm ${plantSelected ? 'border-lime-100/18 bg-[#101511]/78 text-lime-100/75' : 'border-lime-100/30 bg-[#101511]/92 text-lime-50'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${plantSelected ? 'bg-[#9bcf82]/65' : 'bg-[#c6ff9f] shadow-[0_0_7px_rgba(198,255,159,.65)]'}`} aria-hidden="true" />
          {label}
        </div>
      </Html>
    </group>
  )
}

function createGrassPlacements(mode, groundObject) {
  const placements = []
  const groundSurface = findGroundSurface(groundObject)
  if (!groundSurface) return placements

  const isOutdoor = mode === 'outdoor' || mode === 'seasonal'
  const seed = isOutdoor ? 48271 : 91357
  const random = seededRandom(seed)
  const groundBounds = new Box3().setFromObject(groundSurface)
  const groundSize = groundBounds.getSize(new Vector3())
  const edgeMargin = 0.18
  const fieldWidth = Math.max(0, groundSize.x - edgeMargin * 2)
  const fieldDepth = Math.max(0, groundSize.z - edgeMargin * 2)
  const targetSpacing = isOutdoor ? 0.54 : 0.58
  const columns = Math.min(38, Math.max(22, Math.ceil(fieldWidth / targetSpacing)))
  const rows = Math.min(30, Math.max(18, Math.ceil(fieldDepth / targetSpacing)))
  const cellWidth = fieldWidth / columns
  const cellDepth = fieldDepth / rows
  const raycaster = new Raycaster()
  const rayOrigin = new Vector3()

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = groundBounds.min.x + edgeMargin + (column + 0.5) * cellWidth
        + (random() - 0.5) * cellWidth * 0.72
      const z = groundBounds.min.z + edgeMargin + (row + 0.5) * cellDepth
        + (random() - 0.5) * cellDepth * 0.72

      if (Math.hypot(x - PLANTING_CENTER[0], z - PLANTING_CENTER[1]) < PLANTING_CLEAR_RADIUS) {
        continue
      }

      rayOrigin.set(x, groundBounds.max.y + 4, z)
      raycaster.set(rayOrigin, DOWN)

      const groundHit = raycaster.intersectObject(groundSurface, false)[0]
      if (!groundHit) continue

      const typeRoll = random()
      const kind = typeRoll < 0.54
        ? 'meadow'
        : typeRoll < 0.96
          ? 'pack'
          : 'cemetery'
      const scaleRange = kind === 'cemetery'
        ? [0.25, 0.37]
        : kind === 'pack'
          ? [0.27, 0.43]
          : [0.29, 0.47]
      const scale = scaleRange[0] + random() * (scaleRange[1] - scaleRange[0])
      const embedDepth = Math.max(0.022, scale * 0.1)

      placements.push({
        kind,
        variant: Math.floor(random() * 10000),
        x,
        y: groundHit.point.y - embedDepth,
        z,
        rotation: random() * Math.PI * 2,
        scale,
        width: 0.78 + random() * 0.5,
        tint: random(),
      })
    }
  }

  return placements
}

function normalizeGrassAssets(scene, includeAllMeshes = false) {
  scene.updateMatrixWorld(true)

  const sourceMeshes = []
  scene.traverse((child) => {
    if (!child.isMesh || !child.geometry || !child.material) return
    if (includeAllMeshes || sourceMeshes.length === 0) sourceMeshes.push(child)
  })

  return sourceMeshes.flatMap((sourceMesh) => {
    const geometry = sourceMesh.geometry.clone()
    geometry.applyMatrix4(sourceMesh.matrixWorld)
    geometry.computeBoundingBox()

    const bounds = geometry.boundingBox
      ?? new Box3().setFromBufferAttribute(geometry.attributes.position)
    const center = bounds.getCenter(new Vector3())
    const size = bounds.getSize(new Vector3())
    const sourceHeight = size.y

    if (!Number.isFinite(sourceHeight) || sourceHeight < 0.001) {
      geometry.dispose()
      return []
    }

    // Give every source a common one-unit height and a root at y=0. This lets
    // unlike models share the same placement and terrain-embedding rules.
    geometry.translate(-center.x, -bounds.min.y, -center.z)
    geometry.scale(1 / sourceHeight, 1 / sourceHeight, 1 / sourceHeight)
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()

    const sourceMaterial = Array.isArray(sourceMesh.material)
      ? sourceMesh.material[0]
      : sourceMesh.material
    // Some grass packs use an unlit material, which stays neon green even when
    // the night HDRI is dark. A standard material makes every variant respond
    // to the sun, environment and the focused night lamp.
    const material = new MeshStandardMaterial({
      alphaMap: sourceMaterial.alphaMap ?? null,
      alphaTest: Math.max(0.28, sourceMaterial.alphaTest ?? 0),
      aoMap: sourceMaterial.aoMap ?? null,
      color: sourceMaterial.color?.clone?.() ?? new Color('#ffffff'),
      map: sourceMaterial.map ?? null,
      metalness: 0,
      normalMap: sourceMaterial.normalMap ?? null,
      opacity: sourceMaterial.opacity ?? 1,
      roughness: 0.96,
      side: DoubleSide,
      transparent: true,
    })
    material.depthWrite = true
    material.emissive.set('#000000')
    material.emissiveIntensity = 0
    material.toneMapped = true
    material.needsUpdate = true

    return [{ geometry, material }]
  })
}

function GrassInstances({ asset, daylight = 1, placements, rainfall = 0, seasonKey = null }) {
  const instanceRef = useRef(null)

  useLayoutEffect(() => {
    const grass = instanceRef.current
    if (!grass) return

    const transform = new Object3D()
    const color = new Color()
    const wetness = getRainVisualIntensity(rainfall)

    placements.forEach((placement, index) => {
      transform.position.set(placement.x, placement.y, placement.z)
      transform.rotation.set(0, placement.rotation, 0)
      transform.scale.set(
        placement.scale * placement.width,
        placement.scale,
        placement.scale * placement.width,
      )
      transform.updateMatrix()
      grass.setMatrixAt(index, transform.matrix)

      const tintBase = placement.kind === 'pack' ? 0.87 : 0.76
      const tintRange = placement.kind === 'pack' ? 0.11 : 0.13
      const daylightMix = Math.min(1, Math.max(0, daylight))
      const dayRed = tintBase + placement.tint * tintRange
      const dayGreen = tintBase + 0.08 + placement.tint * tintRange
      const dayBlue = tintBase - 0.04 + placement.tint * tintRange
      const nightVariation = placement.tint * 0.025
      const isDrySeason = ['autumn', 'cool_dry', 'hot_dry'].includes(seasonKey)
      const isWinter = ['winter', 'deep_winter'].includes(seasonKey)
      const redSeason = isDrySeason ? 1.08 : (isWinter ? 0.93 : 1)
      const greenSeason = isDrySeason ? 0.78 : (isWinter ? 0.86 : 1)
      const blueSeason = isDrySeason ? 0.62 : (isWinter ? 0.92 : 1)
      color.setRGB(
        (0.09 + nightVariation + ((dayRed * redSeason - 0.09 - nightVariation) * daylightMix)) * (1 - wetness * 0.18),
        (0.12 + nightVariation + ((dayGreen * greenSeason - 0.12 - nightVariation) * daylightMix)) * (1 - wetness * 0.1),
        (0.085 + nightVariation + ((dayBlue * blueSeason - 0.085 - nightVariation) * daylightMix)) * (1 - wetness * 0.14),
      )
      grass.setColorAt(index, color)
    })

    grass.instanceMatrix.needsUpdate = true
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true
  }, [daylight, placements, rainfall, seasonKey])

  return (
    <instancedMesh
      ref={instanceRef}
      args={[asset.geometry, asset.material, placements.length]}
      frustumCulled={false}
      receiveShadow
    />
  )
}

export function GrassGround({ daylight = 1, groundObject, mode = 'outdoor', rainfall = 0, seasonKey = null }) {
  const meadowGltf = useGLTF(GRASS_MODEL_URLS.meadow)
  const packGltf = useGLTF(GRASS_MODEL_URLS.pack)
  const cemeteryGltf = useGLTF(GRASS_MODEL_URLS.cemetery)
  const normalizedGrass = useMemo(() => ({
    meadow: normalizeGrassAssets(meadowGltf.scene),
    pack: normalizeGrassAssets(packGltf.scene, true),
    cemetery: normalizeGrassAssets(cemeteryGltf.scene),
  }), [cemeteryGltf.scene, meadowGltf.scene, packGltf.scene])
  const placements = useMemo(
    () => createGrassPlacements(mode, groundObject),
    [groundObject, mode],
  )
  const instanceGroups = useMemo(() => {
    const groups = []

    Object.entries(normalizedGrass).forEach(([kind, assets]) => {
      assets.forEach((asset, assetIndex) => {
        const assetPlacements = placements.filter((placement) => (
          placement.kind === kind && placement.variant % assets.length === assetIndex
        ))
        if (assetPlacements.length > 0) {
          groups.push({
            asset,
            key: `${kind}-${assetIndex}`,
            placements: assetPlacements,
          })
        }
      })
    })

    return groups
  }, [normalizedGrass, placements])

  useEffect(() => () => {
    Object.values(normalizedGrass).flat().forEach(({ geometry, material }) => {
      geometry.dispose()
      material.dispose()
    })
  }, [normalizedGrass])

  return (
    <group>
      {instanceGroups.map((group) => (
        <GrassInstances
          key={`${group.key}-${group.placements.length}`}
          asset={group.asset}
          daylight={daylight}
          placements={group.placements}
          rainfall={rainfall}
          seasonKey={seasonKey}
        />
      ))}
    </group>
  )
}
