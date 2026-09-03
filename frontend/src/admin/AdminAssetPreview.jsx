import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, OrbitControls, useGLTF } from '@react-three/drei'
import { Component, Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ActionAnimation } from '../game/scene/ActionAnimation'
import { PlantModel, SnailSurfaceModel } from '../game/scene/PlantModel'
import { AppIcon } from '../game/icons/FontAwesomeIcon'
import { resolveAssetUrl, storageAsset } from '../lib/api'

class PreviewErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) return <PreviewUnavailable imageUrl={this.props.fallbackImage} label={this.props.fallbackLabel} title={this.props.fallbackTitle} />
    return this.props.children
  }
}

function PreviewUnavailable({ imageUrl, label, title }) {
  return (
    <div className={`admin-asset-preview__empty ${imageUrl ? 'has-image-fallback' : ''}`}>
      {imageUrl ? <img alt={title || ''} src={imageUrl} /> : <AppIcon name="warning" />}
      <strong>{imageUrl ? (label || 'Showing the available image') : (label || 'Preview is unavailable')}</strong>
      <span>{imageUrl ? 'This record does not have a usable 3D model, so its image is shown instead.' : 'Check that the uploaded file is a valid GLB or GLTF package.'}</span>
    </div>
  )
}

function resolvePreviewAssetUrl(value) {
  const path = String(value ?? '').trim()
  if (!path) return null
  if (/^(?:blob:|data:|https?:\/\/|\/)/i.test(path)) return resolveAssetUrl(path)

  // Admin resources intentionally return storage-relative references so they
  // remain portable between environments. Three.js needs the public media
  // endpoint, otherwise Vite treats `models/foo.gltf` as a frontend route and
  // responds with index.html instead of glTF JSON.
  return storageAsset(path)
}

function builtInPestImage(record) {
  const name = `${record.name_en ?? ''} ${record.name_th ?? ''}`.toLowerCase()
  if (/aphid|เพลี้ย/.test(name)) return '/game-icons/aphid.png'
  if (/snail|หอย/.test(name)) return '/game-icons/snail.png'
  if (/fung|mold|mildew|เชื้อรา/.test(name)) return '/game-icons/fungus.png'
  return null
}

function pestModelUrl(record) {
  const modelUrl = String(record.model_url ?? '')
  const name = `${record.name_en ?? ''} ${record.name_th ?? ''}`.toLowerCase()

  if (/aphid|เพลี้ย/.test(name) && modelUrl.endsWith('/models/aphid.gltf')) {
    return '/aphid-static.glb'
  }

  return record.model_url
}

function NormalizedModel({ url }) {
  const { scene } = useGLTF(url)
  const prepared = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((object) => {
      if (!object.isMesh) return
      object.castShadow = true
      object.receiveShadow = true
    })
    const bounds = new THREE.Box3().setFromObject(clone)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const largest = Math.max(size.x, size.y, size.z, 0.001)
    clone.position.set(-center.x, -bounds.min.y, -center.z)
    return { clone, scale: 1.8 / largest }
  }, [scene])

  return <primitive object={prepared.clone} scale={prepared.scale} position={[0, -0.85, 0]} />
}

function LoopingPlantPreview({ children }) {
  const group = useRef(null)

  useFrame(({ clock }) => {
    if (!group.current) return
    const time = clock.elapsedTime
    group.current.position.y = Math.sin(time * 1.25) * 0.008
    group.current.rotation.y = Math.sin(time * 0.42) * 0.065
  })

  return <group ref={group} position={[0.75, 0, 0]}><group position={[-0.75, 0, 0]}>{children}</group></group>
}

const PLANT_CONFIGURATION_PREVIEWS = new Set(['plant-stage', 'plant-rule', 'plant-variant'])
const DEFAULT_VISUAL_OVERRIDES = {
  healthy: { leafColor: '#9bcf82', stemColor: '#7a5a2f', leafState: 'upright', stemState: 'upright', scale: 1 },
  underwatered: { leafColor: '#9a6a3a', stemColor: '#6f4a2a', leafState: 'wilted', stemState: 'leaning', scale: 0.92 },
  overwatered: { leafColor: '#7f9964', stemColor: '#6b5b35', leafState: 'drooping', stemState: 'soft', scale: 0.95 },
  dry_soil: { leafColor: '#9d8240', stemColor: '#735e35', leafState: 'wilted', stemState: 'leaning', scale: 0.91 },
  waterlogged: { leafColor: '#78905a', stemColor: '#5c7354', leafState: 'yellowing', stemState: 'soft', scale: 0.91 },
  low_light: { leafColor: '#a2ae68', stemColor: '#82905d', leafState: 'pale', stemState: 'thin', scale: 0.9 },
  nutrient_deficient: { leafColor: '#d6c66b', stemColor: '#8a743e', leafState: 'yellowing', stemState: 'thin', scale: 0.9 },
  fertilizer_burn: { leafColor: '#98633e', stemColor: '#704b35', leafState: 'burnt_edges', stemState: 'dry', scale: 0.88 },
  burnt: { leafColor: '#b87536', stemColor: '#704326', leafState: 'root_burn', stemState: 'dry', scale: 0.88 },
  heat_stress: { leafColor: '#c6773e', stemColor: '#7a4b2f', leafState: 'burnt_edges', stemState: 'dry', scale: 0.92 },
  cold_stress: { leafColor: '#65816f', stemColor: '#5f6f5b', leafState: 'darkened', stemState: 'slow', scale: 0.9 },
  dry_air: { leafColor: '#9c8252', stemColor: '#756143', leafState: 'wilted', stemState: 'dry', scale: 0.92 },
  fungal_risk: { leafColor: '#6f795b', stemColor: '#606b51', leafState: 'spotted', stemState: 'soft', scale: 0.9 },
  botrytis: { leafColor: '#756f5f', stemColor: '#6d6657', leafState: 'spotted', stemState: 'soft', scale: 0.88 },
  wind_stress: { leafColor: '#789466', stemColor: '#695635', leafState: 'drooping', stemState: 'leaning', scale: 0.94 },
  stunted: { leafColor: '#7b6f3f', stemColor: '#5c4a28', leafState: 'small', stemState: 'short', scale: 0.68 },
}

function recordById(records, id) {
  return (records ?? []).find((item) => String(item.id) === String(id))
}

function plantConfigurationPreview(previewType, record, lookups) {
  const plant = recordById(lookups.plants, record.plant_id) ?? record.plant ?? null
  const plantStages = (lookups.stages ?? [])
    .filter((stage) => String(stage.plant_id) === String(record.plant_id))
    .sort((left, right) => Number(left.required_growth_point ?? 0) - Number(right.required_growth_point ?? 0))
  const requestedStage = previewType === 'plant-stage'
    ? record
    : recordById(lookups.stages, record.stage_id)
  const previewStage = requestedStage ?? plantStages.at(-1) ?? null
  const stateKey = previewType === 'plant-rule'
    ? record.visual_state || 'healthy'
    : previewType === 'plant-variant' ? record.state_key || 'healthy' : 'healthy'
  const candidates = (lookups.plantVariants ?? [])
    .filter((variant) => String(variant.plant_id) === String(record.plant_id) && variant.state_key === stateKey)
    .sort((left, right) => {
      const leftStageMatch = previewStage && String(left.stage_id) === String(previewStage.id) ? 1 : 0
      const rightStageMatch = previewStage && String(right.stage_id) === String(previewStage.id) ? 1 : 0
      if (leftStageMatch !== rightStageMatch) return rightStageMatch - leftStageMatch
      const leftGlobal = left.stage_id == null ? 1 : 0
      const rightGlobal = right.stage_id == null ? 1 : 0
      if (leftGlobal !== rightGlobal) return rightGlobal - leftGlobal
      return Number(right.priority ?? 0) - Number(left.priority ?? 0)
    })
  const variant = previewType === 'plant-variant' ? record : candidates[0] ?? null
  const defaults = DEFAULT_VISUAL_OVERRIDES[stateKey] ?? DEFAULT_VISUAL_OVERRIDES.healthy
  const visualOverrides = {
    leafColor: variant?.leaf_color || defaults.leafColor,
    stemColor: variant?.stem_color || defaults.stemColor,
    leafState: variant?.leaf_state || defaults.leafState,
    stemState: variant?.stem_state || defaults.stemState,
    scale: Number(variant?.scale ?? defaults.scale) || defaults.scale,
  }
  const maximumGrowthPoint = Math.max(1, ...plantStages.map((stage) => Number(stage.required_growth_point ?? 0)))
  const growthProgress = previewType === 'plant-stage' || requestedStage
    ? Math.min(1, Math.max(0.05, Number(previewStage?.required_growth_point ?? 0) / maximumGrowthPoint))
    : 1
  const plantName = plant?.name_th || plant?.name_en || record.plant?.name_th || record.plant?.name_en || 'Plant'
  const title = previewType === 'plant-stage'
    ? `${plantName} · ${record.stage_name || 'Growth stage'}`
    : previewType === 'plant-rule'
      ? `${plantName} · ${record.factor || 'Condition rule'}`
      : `${plantName} · ${record.label || stateKey}`

  return {
    growthProgress,
    health: previewType === 'plant-rule' ? Math.min(100, Math.max(1, 100 + Number(record.health_delta ?? 0))) : 100,
    image: previewStage?.image_url || plant?.base_image_url,
    model: variant?.model_url || previewStage?.model_url || plant?.base_model_url,
    plant,
    plantName,
    previewStage,
    stateKey,
    title,
    variant,
    visualOverrides,
  }
}

function PreviewScene({ modelUrl, preset, previewType, record, values }) {
  const isAnimation = previewType === 'animation' || (previewType === 'item' && preset)
  const pestName = `${record?.name_en ?? ''} ${record?.name_th ?? ''}`.toLowerCase()
  const isPlant = previewType === 'plant'
  const isSimulationPlant = previewType === 'simulation-plant'
  const isPlantConfiguration = PLANT_CONFIGURATION_PREVIEWS.has(previewType)
  const isSurfacePest = previewType === 'pest' && (record?.placement_mode === 'plant_surface' || /fung|mold|mildew|เชื้อรา/.test(pestName))
  const isSnail = previewType === 'pest' && /snail|หอย/.test(pestName)
  const usesPlantStage = isPlant || isSimulationPlant || isPlantConfiguration || isSurfacePest
  const floorY = usesPlantStage ? -0.13 : -0.88
  const stageCenterX = usesPlantStage ? 0.75 : 0
  const simulationGrowth = Math.min(1, Math.max(0.05, Number(record?.growth_point ?? 0) / 100))
  const simulationHealth = Math.min(100, Math.max(0, Number(record?.health ?? 100)))
  const simulationStage = Number(record?.current_stage?.stage_no ?? 1)
  const simulationState = String(record?.visual_state ?? '').toLowerCase()
  const simulationFungusRisk = /fung|mold|mildew|เชื้อรา/.test(simulationState) ? 100 : 0
  const actionState = useMemo(() => ({
    phase: 'animating',
    asset: {
      id: `admin-preview-${preset?.id ?? 'draft'}`,
      animationKey: preset?.motion_type || 'place-down',
      animationPreset: preset,
      modelUrl,
    },
  }), [modelUrl, preset])

  return (
    <Canvas camera={{ position: [3.3, 2.3, 4.3], fov: 38 }} dpr={[1, 1.6]} shadows>
      <color attach="background" args={['#101711']} />
      <fog attach="fog" args={['#101711', 7, 13]} />
      <ambientLight intensity={1.1} />
      <directionalLight castShadow intensity={2.2} position={[3, 5, 4]} />
      <pointLight color="#82e9a7" intensity={1.4} position={[-2, 1.8, 2]} />
      <Suspense fallback={null}>
        {isAnimation ? (
          <ActionAnimation actionState={actionState} plantingSurface={{ position: [0, -0.7, 0], radius: 0.95 }} plantScale={1} />
        ) : isPlant ? (
          <LoopingPlantPreview><PlantModel growthProgress={1} health={100} isMature modelUrl={modelUrl || '/plant.gltf'} plantName={record?.name_en || record?.name_th || ''} previewLoop /></LoopingPlantPreview>
        ) : isSimulationPlant ? (
          <LoopingPlantPreview>
            <PlantModel
              fungusRisk={simulationFungusRisk}
              growthProgress={simulationGrowth}
              health={simulationHealth}
              isMature={simulationStage >= 3 || simulationGrowth >= 1}
              modelUrl={modelUrl || '/plant.gltf'}
              plantName={record?.plant?.name_en || record?.plant?.name_th || ''}
              visualOverrides={record?.visual_overrides ?? {}}
            />
          </LoopingPlantPreview>
        ) : isPlantConfiguration ? (
          <LoopingPlantPreview>
            <PlantModel
              fungusRisk={['fungal_risk', 'botrytis'].includes(values.stateKey) ? 100 : 0}
              growthProgress={values.growthProgress}
              health={values.health}
              isMature={values.growthProgress >= 0.98}
              modelUrl={modelUrl || '/plant.gltf'}
              plantName={values.plantName}
              visualOverrides={values.visualOverrides}
            />
          </LoopingPlantPreview>
        ) : isSurfacePest ? (
          <LoopingPlantPreview><PlantModel fungusRisk={100} growthProgress={1} health={82} isMature modelUrl="/plant.gltf" plantName="Elephant Ear" previewLoop /></LoopingPlantPreview>
        ) : isSnail ? (
          <SnailSurfaceModel anchor={{ position: [0, -0.84, 0], rotation: [0, -0.35, 0], size: 0.72 }} />
        ) : modelUrl ? <NormalizedModel url={modelUrl} /> : null}
        <Environment preset="warehouse" />
      </Suspense>
      <mesh receiveShadow position={[stageCenterX, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.25, 64]} />
        <meshStandardMaterial color="#1c2b1f" roughness={0.94} />
      </mesh>
      <OrbitControls enablePan={false} maxDistance={7} minDistance={2.2} target={usesPlantStage ? [0.75, 0.72, 0] : [0, 0.15, 0]} />
    </Canvas>
  )
}

function previewValues(previewType, record, lookups = {}) {
  if (previewType === 'plant') return { image: record.base_image_url, model: record.base_model_url, title: record.name_th || record.name_en || 'Plant' }
  if (previewType === 'simulation-plant') return {
    image: record.live_snapshot_url || record.snapshot_image_url || record.plant?.base_image_url,
    model: record.current_model_url || record.visual_variant?.model_url || record.current_stage?.model_url || record.plant?.base_model_url,
    title: record.plant?.name_th || record.plant?.name_en || 'Simulation plant',
  }
  if (previewType === 'pest') return { image: record.image_url || builtInPestImage(record), model: pestModelUrl(record), title: record.name_th || record.name_en || 'Pest' }
  if (previewType === 'item') {
    const preset = record.animation_preset || (record.animation_key ? {
      key: record.animation_key,
      motion_type: record.animation_key,
      effect_type: 'none',
      target_type: 'plant',
      duration_ms: 1200,
      speed: 1,
      amplitude: 1,
      particle_count: 24,
      scale: 1,
    } : null)
    return { image: record.image_url, model: record.model_url, preset, title: record.name || 'Item' }
  }
  if (PLANT_CONFIGURATION_PREVIEWS.has(previewType)) return plantConfigurationPreview(previewType, record, lookups)
  return { preset: record, title: record.name_th || record.name_en || 'Animation preset' }
}

export function AdminAssetPreview({ config, language = 'en', lookups = {}, onClose, record }) {
  const values = previewValues(config.previewType, record, lookups)
  const modelUrl = resolvePreviewAssetUrl(values.model)
  const imageUrl = resolvePreviewAssetUrl(values.image)
  const isThai = language === 'th'
  const pestName = `${record?.name_en ?? ''} ${record?.name_th ?? ''}`.toLowerCase()
  const hasProceduralPest = config.previewType === 'pest' && (record?.placement_mode === 'plant_surface' || /snail|หอย|fung|mold|mildew|เชื้อรา/.test(pestName))
  const hasScene = Boolean(modelUrl || values.preset || hasProceduralPest)
  const isSimulationPlant = config.previewType === 'simulation-plant'
  const isPlantConfiguration = PLANT_CONFIGURATION_PREVIEWS.has(config.previewType)

  return (
    <div className="admin-asset-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section aria-labelledby="admin-preview-title" aria-modal="true" className="admin-asset-preview" role="dialog">
        <header>
          <span><small>{isThai ? 'พื้นที่ตรวจสอบก่อนเผยแพร่' : 'PRE-PUBLISH INSPECTION'}</small><h2 id="admin-preview-title">{values.title}</h2></span>
          <button aria-label={isThai ? 'ปิดพรีวิว' : 'Close preview'} onClick={onClose} type="button">×</button>
        </header>
        <div className="admin-asset-preview__body">
          <div className="admin-asset-preview__stage">
            <span className="admin-asset-preview__live"><i />{isSimulationPlant ? (isThai ? 'สภาพพืชที่บันทึกไว้' : 'SAVED PLANT STATE') : config.previewType === 'plant' ? (isThai ? 'พรีวิวสด · วนลูป' : 'LIVE · LOOPING') : isPlantConfiguration ? (isThai ? 'พรีวิว 3 มิติตามค่าที่ตั้ง' : 'CONFIGURED 3D PREVIEW') : (isThai ? 'พรีวิวสด' : 'LIVE PREVIEW')}</span>
            <PreviewErrorBoundary fallbackImage={imageUrl} fallbackLabel={isThai ? 'โมเดล 3 มิติใช้ไม่ได้ — แสดงรูปแทน' : '3D model unavailable — showing image instead'} fallbackTitle={values.title}>
              {hasScene ? <PreviewScene modelUrl={modelUrl} preset={values.preset} previewType={config.previewType} record={record} values={values} /> : imageUrl ? <img alt={values.title} src={imageUrl} /> : <PreviewUnavailable label={isThai ? 'ยังไม่มีไฟล์สำหรับพรีวิว' : 'No preview asset yet'} />}
            </PreviewErrorBoundary>
          </div>
          <aside>
            {imageUrl && <img alt="" className="admin-asset-preview__thumb" src={imageUrl} />}
            <dl>
              <div><dt>{isThai ? 'ประเภท' : 'Type'}</dt><dd>{isSimulationPlant ? (isThai ? 'พืชของผู้ใช้' : 'User plant') : config.previewType}</dd></div>
              {isSimulationPlant && <>
                <div><dt>{isThai ? 'สุขภาพ' : 'Health'}</dt><dd>{record.health ?? 0}%</dd></div>
                <div><dt>{isThai ? 'การเติบโต' : 'Growth'}</dt><dd>{record.growth_point ?? 0} / 100</dd></div>
                <div><dt>{isThai ? 'ระยะปัจจุบัน' : 'Current stage'}</dt><dd>{record.current_stage?.stage_name || (isThai ? 'ไม่ระบุ' : 'Not recorded')}</dd></div>
                <div><dt>{isThai ? 'สถานะภาพลักษณ์' : 'Visual state'}</dt><dd>{record.visual_state || 'healthy'}</dd></div>
                <div><dt>{isThai ? 'สถานะรายการ' : 'Record status'}</dt><dd>{record.status || '—'}</dd></div>
              </>}
              {isPlantConfiguration && <>
                <div><dt>{isThai ? 'พืช' : 'Plant'}</dt><dd>{values.plantName}</dd></div>
                <div><dt>{isThai ? 'ระยะที่แสดง' : 'Preview stage'}</dt><dd>{values.previewStage?.stage_name || (isThai ? 'ระยะโตเต็มที่' : 'Mature stage')}</dd></div>
                <div><dt>{isThai ? 'สถานะภาพลักษณ์' : 'Visual state'}</dt><dd>{values.stateKey}</dd></div>
                {config.previewType === 'plant-rule' && <>
                  <div><dt>{isThai ? 'เงื่อนไข' : 'Condition'}</dt><dd>{record.factor} {record.operator} {record.min_value ?? '—'}{record.max_value != null ? ` – ${record.max_value}` : ''}</dd></div>
                  <div><dt>{isThai ? 'ผลต่อสุขภาพ / การเติบโต' : 'Health / growth effect'}</dt><dd>{Number(record.health_delta ?? 0) > 0 ? '+' : ''}{record.health_delta ?? 0} / {Number(record.growth_delta ?? 0) > 0 ? '+' : ''}{record.growth_delta ?? 0}</dd></div>
                </>}
                {config.previewType === 'plant-variant' && <>
                  <div><dt>{isThai ? 'สภาพใบ / ลำต้น' : 'Leaf / stem state'}</dt><dd>{values.visualOverrides.leafState} / {values.visualOverrides.stemState}</dd></div>
                  <div><dt>{isThai ? 'สเกลโมเดล' : 'Model scale'}</dt><dd>{values.visualOverrides.scale}×</dd></div>
                </>}
              </>}
              {values.preset && <><div><dt>{isThai ? 'การเคลื่อนไหว' : 'Movement'}</dt><dd>{values.preset.motion_type}</dd></div><div><dt>{isThai ? 'เอฟเฟกต์' : 'Effect'}</dt><dd>{values.preset.effect_type}</dd></div><div><dt>{isThai ? 'เป้าหมาย' : 'Target'}</dt><dd>{values.preset.target_type}</dd></div><div><dt>{isThai ? 'ระยะเวลา' : 'Duration'}</dt><dd>{values.preset.duration_ms} ms</dd></div></>}
            </dl>
            <p>{isSimulationPlant ? (isThai ? 'เป็นข้อมูลแบบอ่านอย่างเดียวจากสถานะล่าสุดที่ระบบบันทึกไว้ · ลากเพื่อหมุนและเลื่อนเมาส์เพื่อซูม' : 'Read-only view of the last saved state · Drag to rotate and scroll to zoom') : (isThai ? 'ลากเพื่อหมุน · เลื่อนเมาส์เพื่อซูม' : 'Drag to rotate · Scroll to zoom')}</p>
          </aside>
        </div>
        <footer><button className="is-primary" onClick={onClose} type="button">{isThai ? 'เสร็จสิ้น' : 'Done'}</button></footer>
      </section>
    </div>
  )
}
