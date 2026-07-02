import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useGraph } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { Color, LoopOnce } from 'three'
import { SkeletonUtils } from 'three-stdlib'

const LEAF_MATERIALS = ['1st_Leaf_Mat', '2nd_Leaf_Mat', '3rd_Leaf_Mat', '4th_Leaf_Mat', '5th_Leaf_Mat']

function clonePlantMaterials(materials) {
  const cloned = { ...materials }

  LEAF_MATERIALS.forEach((name) => {
    if (!materials[name]) return
    cloned[name] = materials[name].clone()
  })

  return cloned
}

export function GltfPlant({ modelUrl = '/plant.gltf', visualOverrides = {}, isMature = false, isPaused = false, growthProgress = 0, ...props }) {
  const group = useRef(null)
  const { scene, animations } = useGLTF(modelUrl)
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { nodes, materials } = useGraph(clone)
  const plantMaterials = useMemo(() => clonePlantMaterials(materials), [materials])
  const { actions } = useAnimations(animations, group)
  const progress = Math.min(1, Math.max(0, Number(growthProgress) || 0))
  const leafState = visualOverrides?.leafState ?? 'upright'
  const isStressed = leafState !== 'upright'
  const stressMarkOpacity = isStressed ? 0.78 : 0
  const targetLeafColor = useMemo(() => new Color(visualOverrides?.leafColor ?? '#9bcf82'), [visualOverrides?.leafColor])

  useFrame(() => {
    LEAF_MATERIALS.forEach((name) => {
      const material = plantMaterials[name]
      if (!material) return

      material.color.lerp(targetLeafColor, 0.0035)
      material.emissive?.lerp?.(targetLeafColor, 0.003)
      material.emissiveIntensity += ((isStressed ? 0.025 : 0) - material.emissiveIntensity) * 0.008
    })
  })

  useEffect(() => {

    Object.values(actions).forEach((action) => {
      if (!action) return

      const duration = action.getClip().duration
      action.reset()
      action.setLoop(LoopOnce, 1)
      action.clampWhenFinished = true
      action.timeScale = isPaused ? 0 : 0.018
      action.time = isMature ? duration : duration * progress
      action.play()

      if (isMature || isPaused) {
        action.paused = true
      }
    })

    return () => Object.values(actions).forEach((action) => action?.stop?.())
  }, [actions, isMature, isPaused, progress])

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Scene">
        <group name="Sketchfab_model" position={[0, -0.026, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <group name="root">
            <group name="GLTF_SceneRootNode" rotation={[Math.PI / 2, 0, 0]}>
              <group name="Plant_alignment" position={[-0.1, 0, 0.02]} scale={0.9}>
                <group name="1st_Leaf_337">
                  <group name="GLTF_created_0">
                    <primitive object={nodes.GLTF_created_0_rootJoint} />
                    <group name="1st_Leaf001_336" />
                    <group name="1st_Stem_335" />
                    <skinnedMesh name="Object_11" geometry={nodes.Object_11.geometry} material={plantMaterials['1st_Leaf_Mat']} skeleton={nodes.Object_11.skeleton} />
                    <skinnedMesh name="Object_13" geometry={nodes.Object_13.geometry} material={plantMaterials['1st_Leaf_Mat']} skeleton={nodes.Object_13.skeleton} />
                  </group>
                </group>
                <group name="2nd_Leaf_673">
                  <group name="GLTF_created_1">
                    <primitive object={nodes.GLTF_created_1_rootJoint} />
                    <group name="2nd_Leaf001_672" />
                    <group name="2nd_Stem_671" />
                    <skinnedMesh name="Object_351" geometry={nodes.Object_351.geometry} material={plantMaterials['2nd_Leaf_Mat']} skeleton={nodes.Object_351.skeleton} />
                    <skinnedMesh name="Object_353" geometry={nodes.Object_353.geometry} material={plantMaterials['2nd_Leaf_Mat']} skeleton={nodes.Object_353.skeleton} />
                  </group>
                </group>
                <group name="3rd_Leaf_1009">
                  <group name="GLTF_created_2">
                    <primitive object={nodes.GLTF_created_2_rootJoint} />
                    <group name="3rd_Leaf001_1008" />
                    <group name="3rd_Stem_1007" />
                    <skinnedMesh name="Object_691" geometry={nodes.Object_691.geometry} material={plantMaterials['3rd_Leaf_Mat']} skeleton={nodes.Object_691.skeleton} />
                    <skinnedMesh name="Object_693" geometry={nodes.Object_693.geometry} material={plantMaterials['3rd_Leaf_Mat']} skeleton={nodes.Object_693.skeleton} />
                  </group>
                </group>
                <group name="4th_Leaf_1345">
                  <group name="GLTF_created_3">
                    <primitive object={nodes.GLTF_created_3_rootJoint} />
                    <group name="4th_Leaf001_1344" />
                    <group name="4th_Stem_1343" />
                    <skinnedMesh name="Object_1031" geometry={nodes.Object_1031.geometry} material={plantMaterials['4th_Leaf_Mat']} skeleton={nodes.Object_1031.skeleton} />
                    <skinnedMesh name="Object_1033" geometry={nodes.Object_1033.geometry} material={plantMaterials['4th_Leaf_Mat']} skeleton={nodes.Object_1033.skeleton} />
                  </group>
                </group>
                <group name="5th_Leaf_1681">
                  <group name="GLTF_created_4">
                    <primitive object={nodes.GLTF_created_4_rootJoint} />
                    <group name="5th_Leaf001_1680" />
                    <group name="5th_Stem_1679" />
                    <skinnedMesh name="Object_1371" geometry={nodes.Object_1371.geometry} material={plantMaterials['5th_Leaf_Mat']} skeleton={nodes.Object_1371.skeleton} />
                    <skinnedMesh name="Object_1373" geometry={nodes.Object_1373.geometry} material={plantMaterials['5th_Leaf_Mat']} skeleton={nodes.Object_1373.skeleton} />
                  </group>
                </group>
              {isStressed && (
                <group name="Stress_marks" position={[-0.03, 0.03, 0.18]}>
                  <mesh position={[0.08, 0.38, 0.04]} rotation={[-0.55, 0.2, 0.25]}>
                    <circleGeometry args={[0.035, 14]} />
                    <meshStandardMaterial color="#6f4a2a" roughness={1} transparent opacity={stressMarkOpacity} />
                  </mesh>
                  <mesh position={[-0.1, 0.62, -0.02]} rotation={[-0.48, -0.2, -0.18]}>
                    <circleGeometry args={[0.026, 12]} />
                    <meshStandardMaterial color="#d1b06a" roughness={1} transparent opacity={stressMarkOpacity * 0.92} />
                  </mesh>
                  <mesh position={[0.16, 0.84, 0.01]} rotation={[-0.55, 0.1, 0.1]}>
                    <circleGeometry args={[0.022, 12]} />
                    <meshStandardMaterial color="#4f3d24" roughness={1} transparent opacity={stressMarkOpacity * 0.86} />
                  </mesh>
                </group>
              )}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/plant.gltf')


