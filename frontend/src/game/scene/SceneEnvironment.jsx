import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Group } from 'three'
import { resolveAssetUrl } from '../../lib/api'
import { GrassGround } from './GrassGround'

function getDirtModelUrl(dirtModelUrl) {
  const resolvedModelUrl = resolveAssetUrl(dirtModelUrl)

  if (!resolvedModelUrl || resolvedModelUrl.endsWith('/models/dirt.gltf')) return '/dirt.gltf'
  return resolvedModelUrl
}

export function SceneEnvironment({ dirtModelUrl = null, mode = 'greenhouse', plantSelected = false }) {
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
    root.add(scene.clone(true))
    root.updateMatrixWorld(true)

    return root
  }, [mode, scene])

  return (
    <group>
      <primitive object={groundObject} />
      <GrassGround groundObject={groundObject} mode={mode} plantSelected={plantSelected} />
    </group>
  )
}

useGLTF.preload('/dirt.gltf')
