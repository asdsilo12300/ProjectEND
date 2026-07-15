import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { resolveAssetUrl } from '../../lib/api'

function getDirtModelUrl(dirtModelUrl) {
  const resolvedModelUrl = resolveAssetUrl(dirtModelUrl)

  if (!resolvedModelUrl || resolvedModelUrl.endsWith('/models/dirt.gltf')) return '/dirt.gltf'
  return resolvedModelUrl
}

function DirtGround({ dirtModelUrl, mode }) {
  const modelUrl = getDirtModelUrl(dirtModelUrl)
  const { scene } = useGLTF(modelUrl)
  const clonedScene = useMemo(() => scene.clone(true), [scene])
  const isOutdoor = mode === 'outdoor'

  return (
    <group position={[0.75, -0.42, 0]} scale={isOutdoor ? 1.68 : 1.6} rotation={[0, isOutdoor ? -0.1 : -0.18, 0]}>
      <primitive object={clonedScene} />
    </group>
  )
}

export function SceneEnvironment({ dirtModelUrl = null, mode = 'greenhouse' }) {
  return <DirtGround dirtModelUrl={dirtModelUrl} mode={mode} />
}

useGLTF.preload('/dirt.gltf')
