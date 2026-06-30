import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { resolveAssetUrl } from '../../lib/api'

function DirtGround({ modelUrl = '/dirt.gltf' }) {
  const resolvedModelUrl = resolveAssetUrl(modelUrl) || '/dirt.gltf'
  const { scene } = useGLTF(resolvedModelUrl)
  const clonedScene = useMemo(() => scene.clone(true), [scene])

  return (
    <group position={[0.75, -0.42, 0]} scale={1.6} rotation={[0, -0.18, 0]}>
      <primitive object={clonedScene} />
    </group>
  )
}

export function SceneEnvironment({ dirtModelUrl }) {
  return <DirtGround modelUrl={dirtModelUrl} />
}

useGLTF.preload('/dirt.gltf')
