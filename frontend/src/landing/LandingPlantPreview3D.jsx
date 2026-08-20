import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { PlantModel } from '../game/scene/PlantModel'

export default function LandingPlantPreview3D({ health, light, visualOverrides, water }) {
  const lightStrength = 0.55 + (Number(light) / 100) * 1.9
  const soilColor = Number(water) >= 72
    ? '#40372f'
    : Number(water) >= 42
      ? '#574b3f'
      : '#786554'

  return (
    <Canvas
      camera={{ fov: 34, near: 0.1, far: 60, position: [3.7, 2.65, 5.2] }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      shadows
    >
      <color attach="background" args={['#6c6a62']} />
      <fog attach="fog" args={['#6c6a62', 7, 14]} />
      <hemisphereLight color="#e9f5df" groundColor="#463d34" intensity={0.95} />
      <directionalLight
        castShadow
        color={Number(light) > 75 ? '#fff1c8' : '#dcebd8'}
        intensity={lightStrength}
        position={[-3.5, 6, 4.5]}
        shadow-mapSize-height={1024}
        shadow-mapSize-width={1024}
      />
      <ambientLight intensity={0.24} />

      <group position={[-0.75, 0.12, 0]}>
        <PlantModel
          growthProgress={1}
          health={health}
          isMature
          modelUrl="/plant.gltf"
          plantName="Elephant Ear"
          visualOverrides={visualOverrides}
        />
      </group>

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.035, 0]}>
        <circleGeometry args={[2.25, 72]} />
        <meshStandardMaterial color={soilColor} roughness={Number(water) > 72 ? 0.72 : 0.96} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
        <ringGeometry args={[2.25, 2.31, 72]} />
        <meshBasicMaterial color="#a9c990" transparent opacity={0.72} />
      </mesh>

      <OrbitControls
        enablePan={false}
        enableZoom
        maxDistance={8}
        maxPolarAngle={Math.PI / 2.04}
        minDistance={3.8}
        minPolarAngle={Math.PI / 4.2}
        target={[0, 1.25, 0]}
      />
    </Canvas>
  )
}
