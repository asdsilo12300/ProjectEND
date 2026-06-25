import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'

function DirtGround() {
  const { scene } = useGLTF('/dirt.gltf')
  const clonedScene = useMemo(() => scene.clone(true), [scene])

  return (
    <group position={[0.75, -0.42, 0]} scale={1.6} rotation={[0, -0.18, 0]}>
      <primitive object={clonedScene} />
    </group>
  )
}

export function SceneEnvironment() {
  return <DirtGround />
}

useGLTF.preload('/dirt.gltf')



