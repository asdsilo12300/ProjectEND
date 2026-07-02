import { Component, Suspense, useImperativeHandle, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import { imageAssets } from '../data/gameData'
import { AppIcon } from '../icons/IconifyIcon'
import { Loading, PestModel, PlantModel } from './PlantModel'
import { SceneEnvironment } from './SceneEnvironment'

class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 grid place-items-center bg-[#080b09]">
          <div className="max-w-[280px] rounded-lg border border-red-200/20 bg-[#151110]/92 px-4 py-3 text-center shadow-[0_10px_24px_rgba(0,0,0,.35)]">
            <strong className="block text-sm text-red-100">Model could not load</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-400">Check the model file path and its linked texture or bin files.</span>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export function SimulationStage({ actionMessage, coinBurst = null, expBurst = null, dropLabAsset, mode = 'greenhouse', plantSelected = false, readOnly = false, resetSimulation, saveSimulation, sceneAssets = {}, simulationVisual, snapshotRef = null }) {
  const canvasRef = useRef(null)
  const pests = simulationVisual?.active_pests ?? []
  const currentStageNo = Number(simulationVisual?.current_stage?.stage_no ?? 1)
  const growthPoint = Number(simulationVisual?.growth_point ?? 0)
  const growthRate = Number(simulationVisual?.growth_rate ?? 0)
  const isMature = currentStageNo >= 3 || growthPoint >= 100
  const isPaused = growthRate <= 0 && !isMature
  const growthProgress = Math.min(1, Math.max(0, growthPoint / 100))

  useImperativeHandle(snapshotRef, () => ({
    capture() {
      const canvas = canvasRef.current
      if (!canvas || !plantSelected) return null

      try {
        return canvas.toDataURL('image/png', 0.92)
      } catch {
        return null
      }
    },
  }), [plantSelected])

  return (
      <section
        className="three-stage absolute inset-0 z-10"
        onDragOver={(event) => {
          if (!readOnly) event.preventDefault()
        }}
        onDrop={readOnly ? undefined : dropLabAsset}
        aria-label="Plant simulation stage"
      >
        <SceneErrorBoundary key={`${mode}-${simulationVisual?.current_model_url ?? 'empty'}-${sceneAssets['ground.dirt']?.url ?? 'ground'}`}>
        <Canvas camera={{ position: [0.75, 0.85, 4.2], fov: 32 }} gl={{ preserveDrawingBuffer: true, antialias: true }} onCreated={({ gl }) => { canvasRef.current = gl.domElement }}>
          <color attach="background" args={[mode === 'outdoor' ? '#07110b' : '#080b09']} />
          <ambientLight intensity={0.85} />
          <directionalLight position={[3, 5, 4]} intensity={2.9} color="#d7fff0" />
          <pointLight position={[-3, 2, 3]} intensity={1.15} color="#9bcf82" />
          <pointLight position={[4, 1, -3]} intensity={0.75} color="#7fb069" />
          <Suspense fallback={<Loading />}>
            <SceneEnvironment dirtModelUrl={sceneAssets['ground.dirt']?.url} mode={mode} />
            {plantSelected && (
              <>
                <PlantModel modelUrl={simulationVisual?.current_model_url} visualOverrides={simulationVisual?.visual_overrides} isMature={isMature} isPaused={isPaused} growthProgress={growthProgress} />
                {pests.map((pest, index) => <PestModel key={`${pest.pest?.name_en ?? 'pest'}-${pest.id ?? index}`} pest={pest} index={index} />)}
              </>
            )}
            <Environment preset="city" />
          </Suspense>
          <OrbitControls enablePan={false} enableZoom enableRotate target={[0.75, -0.32, 0]} minDistance={2.8} maxDistance={9} minPolarAngle={0.35} maxPolarAngle={1.32} />
        </Canvas>
        </SceneErrorBoundary>
        {coinBurst && (
          <div
            className="coin-burst pointer-events-none absolute left-1/2 top-[42%] z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-amber-100/25 bg-[#14170f]/90 px-3 py-2 text-sm font-black text-amber-100 shadow-[0_14px_32px_rgba(0,0,0,.35)]"
            style={{ marginLeft: coinBurst.offsetX, marginTop: coinBurst.offsetY }}
          >
            <img className="h-7 w-7 object-contain" src={imageAssets.coin} alt="" />
            +{coinBurst.amount} coin
          </div>
        )}
        {expBurst && (
          <div
            className="coin-burst pointer-events-none absolute left-1/2 top-[42%] z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-cyan-100/25 bg-[#071b1a]/90 px-3 py-2 text-sm font-black text-cyan-100 shadow-[0_14px_32px_rgba(0,0,0,.35),0_0_22px_rgba(16,216,210,.22)]"
            style={{ marginLeft: expBurst.offsetX, marginTop: expBurst.offsetY }}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#05b7ff] via-[#12d8e6] to-[#16f4be] text-[10px] font-black text-[#07110b] shadow-[0_0_16px_rgba(18,216,230,.45)]">
              XP
            </span>
            <span>+{expBurst.amount} EXP</span>
            {expBurst.leveledUp && <span className="rounded-full bg-lime-200 px-2 py-0.5 text-[10px] text-[#101511]">LEVEL UP</span>}
          </div>
        )}
        {!plantSelected && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-lime-100/15 bg-[#101511]/90 px-4 py-3 text-center shadow-[0_10px_24px_rgba(0,0,0,.35)]">
            <strong className="block text-sm text-lime-50">Select a plant to begin</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-400">Choose Sprout from Lab assets to load the plant model.</span>
          </div>
        )}
        {actionMessage && (
          <div className="pointer-events-none absolute bottom-32 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-lime-100/15 bg-[#101511]/90 px-3 py-2 text-xs font-semibold text-lime-50 shadow-[0_8px_18px_rgba(0,0,0,.32)]">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-[#9bcf82] text-[#101511]">
              <AppIcon className="h-4 w-4" name="check" />
            </span>
            {actionMessage}
          </div>
        )}
        {!readOnly && <div className="absolute bottom-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-lime-100/15 bg-[#101511]/88 p-1.5 shadow-[0_8px_18px_rgba(0,0,0,.32)]" aria-label="Simulation actions">
          <button
            className="inline-flex h-8 items-center gap-2 rounded-md border border-lime-100/15 bg-white/[0.035] px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.075] hover:text-lime-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            type="button"
            onClick={resetSimulation}
          >
            <AppIcon className="h-4 w-4 text-slate-400" name="restartAlt" />
            Reset
          </button>
          <button
            className="inline-flex h-8 items-center gap-2 rounded-md bg-[#9bcf82] px-3 text-xs font-bold text-[#101511] transition hover:bg-[#addf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            type="button"
            onClick={saveSimulation}
          >
            <AppIcon className="h-4 w-4" name="save" />
            Save
          </button>
        </div>}
      </section>
  )
}
