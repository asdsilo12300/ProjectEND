import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useGraph } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { Color, DoubleSide, LoopOnce } from 'three'
import { SkeletonUtils } from 'three-stdlib'

const LEAF_MATERIALS = ['1st_Leaf_Mat', '2nd_Leaf_Mat', '3rd_Leaf_Mat', '4th_Leaf_Mat', '5th_Leaf_Mat']

function clonePlantMaterials(materials) {
  const cloned = { leaves: {}, stems: {} }

  LEAF_MATERIALS.forEach((name) => {
    if (!materials[name]) return
    cloned.leaves[name] = materials[name].clone()
    cloned.stems[name] = materials[name].clone()
  })

  return cloned
}

function getStressPalette(leafState) {
  if (leafState === 'yellowing') return ['#e3ce63', '#f1dc78', '#9f8434']
  if (leafState === 'darkened') return ['#425c52', '#60766b', '#31493f']
  if (leafState === 'wilted' || leafState === 'drooping') return ['#87623d', '#aa8051', '#5f472f']
  return ['#6f4a2a', '#d1b06a', '#4f3d24']
}

export function GltfPlant({ modelUrl = '/plant.gltf', visualOverrides = {}, isMature = false, isPaused = false, growthProgress = 0, ...props }) {
  const group = useRef(null)
  const { scene, animations } = useGLTF(modelUrl)
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { nodes, materials } = useGraph(clone)
  const plantMaterials = useMemo(() => clonePlantMaterials(materials), [materials])
  const { actions } = useAnimations(animations, group)
  const progress = Math.min(1, Math.max(0, Number(growthProgress) || 0))
  const leafState = String(visualOverrides?.leafState ?? 'upright').toLowerCase()
  const isStressed = !['upright', 'normal', 'healthy'].includes(leafState)
  const stressMarkOpacity = isStressed ? 0.78 : 0
  const targetLeafColor = useMemo(() => new Color(visualOverrides?.leafColor ?? '#9bcf82'), [visualOverrides?.leafColor])
  const targetStemColor = useMemo(() => new Color(visualOverrides?.stemColor ?? '#7a5a2f'), [visualOverrides?.stemColor])
  const stressPalette = getStressPalette(leafState)

  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-Math.min(delta, 0.1) * 4.2)

    LEAF_MATERIALS.forEach((name) => {
      const leafMaterial = plantMaterials.leaves[name]
      const stemMaterial = plantMaterials.stems[name]

      if (leafMaterial) {
        leafMaterial.color.lerp(targetLeafColor, blend)
        leafMaterial.emissive?.lerp?.(targetLeafColor, blend * 0.75)
        leafMaterial.emissiveIntensity += ((isStressed ? 0.025 : 0) - leafMaterial.emissiveIntensity) * blend
      }

      if (stemMaterial) {
        stemMaterial.color.lerp(targetStemColor, blend)
        stemMaterial.emissive?.lerp?.(targetStemColor, blend * 0.5)
        stemMaterial.emissiveIntensity += ((isStressed ? 0.012 : 0) - stemMaterial.emissiveIntensity) * blend
      }
    })
  })

  useEffect(() => () => {
    Object.values(plantMaterials.leaves).forEach((material) => material.dispose())
    Object.values(plantMaterials.stems).forEach((material) => material.dispose())
  }, [plantMaterials])

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
                    <skinnedMesh name="Object_11" geometry={nodes.Object_11.geometry} material={plantMaterials.stems['1st_Leaf_Mat']} skeleton={nodes.Object_11.skeleton} />
                    <skinnedMesh name="Object_13" geometry={nodes.Object_13.geometry} material={plantMaterials.leaves['1st_Leaf_Mat']} skeleton={nodes.Object_13.skeleton} />
                  </group>
                </group>
                <group name="2nd_Leaf_673">
                  <group name="GLTF_created_1">
                    <primitive object={nodes.GLTF_created_1_rootJoint} />
                    <group name="2nd_Leaf001_672" />
                    <group name="2nd_Stem_671" />
                    <skinnedMesh name="Object_351" geometry={nodes.Object_351.geometry} material={plantMaterials.stems['2nd_Leaf_Mat']} skeleton={nodes.Object_351.skeleton} />
                    <skinnedMesh name="Object_353" geometry={nodes.Object_353.geometry} material={plantMaterials.leaves['2nd_Leaf_Mat']} skeleton={nodes.Object_353.skeleton} />
                  </group>
                </group>
                <group name="3rd_Leaf_1009">
                  <group name="GLTF_created_2">
                    <primitive object={nodes.GLTF_created_2_rootJoint} />
                    <group name="3rd_Leaf001_1008" />
                    <group name="3rd_Stem_1007" />
                    <skinnedMesh name="Object_691" geometry={nodes.Object_691.geometry} material={plantMaterials.stems['3rd_Leaf_Mat']} skeleton={nodes.Object_691.skeleton} />
                    <skinnedMesh name="Object_693" geometry={nodes.Object_693.geometry} material={plantMaterials.leaves['3rd_Leaf_Mat']} skeleton={nodes.Object_693.skeleton} />
                  </group>
                </group>
                <group name="4th_Leaf_1345">
                  <group name="GLTF_created_3">
                    <primitive object={nodes.GLTF_created_3_rootJoint} />
                    <group name="4th_Leaf001_1344" />
                    <group name="4th_Stem_1343" />
                    <skinnedMesh name="Object_1031" geometry={nodes.Object_1031.geometry} material={plantMaterials.stems['4th_Leaf_Mat']} skeleton={nodes.Object_1031.skeleton} />
                    <skinnedMesh name="Object_1033" geometry={nodes.Object_1033.geometry} material={plantMaterials.leaves['4th_Leaf_Mat']} skeleton={nodes.Object_1033.skeleton} />
                  </group>
                </group>
                <group name="5th_Leaf_1681">
                  <group name="GLTF_created_4">
                    <primitive object={nodes.GLTF_created_4_rootJoint} />
                    <group name="5th_Leaf001_1680" />
                    <group name="5th_Stem_1679" />
                    <skinnedMesh name="Object_1371" geometry={nodes.Object_1371.geometry} material={plantMaterials.stems['5th_Leaf_Mat']} skeleton={nodes.Object_1371.skeleton} />
                    <skinnedMesh name="Object_1373" geometry={nodes.Object_1373.geometry} material={plantMaterials.leaves['5th_Leaf_Mat']} skeleton={nodes.Object_1373.skeleton} />
                  </group>
                </group>
              {isStressed && (
                <group name="Stress_marks" position={[-0.03, 0.018, 0.02]}>
                  <mesh position={[0.035, 2.19, 0.035]} rotation={[-Math.PI / 2, 0.12, 0.25]}>
                    <circleGeometry args={[0.038, 14]} />
                    <meshStandardMaterial color={stressPalette[0]} roughness={1} transparent opacity={stressMarkOpacity} side={DoubleSide} polygonOffset polygonOffsetFactor={-1} />
                  </mesh>
                  <mesh position={[-0.08, 2.60, -0.04]} rotation={[-Math.PI / 2, -0.18, -0.18]} scale={[1.3, 0.72, 1]}>
                    <circleGeometry args={[0.03, 12]} />
                    <meshStandardMaterial color={stressPalette[1]} roughness={1} transparent opacity={stressMarkOpacity * 0.92} side={DoubleSide} polygonOffset polygonOffsetFactor={-1} />
                  </mesh>
                  <mesh position={[-0.16, 2.97, -0.1]} rotation={[-Math.PI / 2, 0.1, 0.1]} scale={[0.78, 1.15, 1]}>
                    <circleGeometry args={[0.026, 12]} />
                    <meshStandardMaterial color={stressPalette[2]} roughness={1} transparent opacity={stressMarkOpacity * 0.86} side={DoubleSide} polygonOffset polygonOffsetFactor={-1} />
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


