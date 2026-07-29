import { Component, Suspense, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Html, OrbitControls } from '@react-three/drei'
import { imageAssets } from '../data/gameData'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { getAppLanguage } from '../../i18n/appI18n'
import { Loading, PestModel, PlantModel } from './PlantModel'
import { PlantAttachmentProvider } from './plantAttachments'
import { SceneEnvironment } from './SceneEnvironment'
import { TimeOfDayEnvironment } from './TimeOfDayEnvironment'
import { useTimeOfDayLighting } from './useTimeOfDayLighting'

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
class PestErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[Plant Growth Academy] Failed to render pest model: ${this.props.label ?? 'unknown pest'}`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) return null

    return this.props.children
  }
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, Number(value) || 0))
}

function useCountdownSeconds(targetTime) {
  const [seconds, setSeconds] = useState(null)

  useEffect(() => {
    if (!targetTime) return undefined

    function update() {
      setSeconds(Math.max(0, Math.ceil((Number(targetTime) - Date.now()) / 1000)))
    }

    const firstUpdate = window.setTimeout(update, 0)
    const timer = window.setInterval(update, 1000)
    return () => {
      window.clearTimeout(firstUpdate)
      window.clearInterval(timer)
    }
  }, [targetTime])

  return targetTime ? seconds : null
}

function getHudPace(growthRate, growthPoint, health) {
  if (growthPoint >= 100) return 0
  if (growthRate <= 0 || health < 50) return 0
  if (health < 75) return 38
  return 78
}

function PlantStatusHud({ awaitingFirstCycle = false, cycleSeconds = null, cycleStatus = 'idle', growthPoint = 0, growthRate = 0, health = 100 }) {
  const healthValue = clampPercent(health)
  const growthValue = clampPercent(growthPoint)
  const paceValue = clampPercent(getHudPace(growthRate, growthPoint, healthValue))
  const stats = [
    { label: 'Health', value: healthValue, color: '#ef6f61', icon: 'heart' },
    { label: 'Growth', value: growthValue, color: '#9bcf82', icon: 'sprout' },
    { label: 'Pace', value: paceValue, color: paceValue === 0 ? '#7b8778' : '#d8f3c9', icon: 'speed' },
  ]

  return (
    <Html position={[1.78, 0.68, 0.08]} center zIndexRange={[18, 0]}>
      <div className="pointer-events-none w-[230px] rounded-lg border border-lime-100/25 bg-[#101511]/96 px-3 py-2 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,.45),0_0_0_1px_rgba(0,0,0,.35)]">
        <div className="mb-2 flex items-center justify-between border-b border-lime-100/10 pb-1.5">
          <strong className="text-xs text-lime-50">Plant status</strong>
          <span className="rounded bg-[#9bcf82]/12 px-1.5 py-0.5 text-xs font-black text-lime-100">
            {cycleStatus === 'updating' ? 'UPDATING' : awaitingFirstCycle && cycleSeconds != null ? `FIRST ${cycleSeconds}s` : 'LIVE'}
          </span>
        </div>
        <div className="grid gap-2">
          {stats.map((stat) => (
            <div className="grid grid-cols-[22px_48px_1fr_30px] items-center gap-2" key={stat.label}>
              <span className="grid h-5 w-5 place-items-center rounded bg-white/[0.08]" style={{ color: stat.color }}>
                <AppIcon className="h-3.5 w-3.5" name={stat.icon} />
              </span>
              <span className="text-xs font-semibold text-slate-300">{stat.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.12]">
                <span className="block h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${stat.value}%`, backgroundColor: stat.color }} />
              </span>
              <strong className="text-right text-xs text-lime-50">{awaitingFirstCycle && stat.label === 'Pace' ? '—' : Math.round(stat.value)}</strong>
            </div>
          ))}
        </div>
      </div>
    </Html>
  )
}

export function SimulationStage({ awaitingFirstCycle = false, coinBurst = null, cycleStatus = 'idle', emptyGardenOwnerName = '', expBurst = null, location = null, mode = 'greenhouse', nextCycleAt = null, outdoorReadings = null, plantSelected = false, selectedItemCursorUrl = null, onUseSelectedItem, readOnly = false, resetSimulation, saveSimulation, sceneAssets = {}, shareBusy = false, shareVisibility = 'private', simulationVisual, snapshotRef = null, toggleLiveShare }) {
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const [itemCursorPoint, setItemCursorPoint] = useState(null)
  const solarLighting = useTimeOfDayLighting(location)
  const pests = simulationVisual?.active_pests ?? []
  const fungusRisk = pests.reduce((highestRisk, pest) => {
    const pestName = String(
      pest?.pest?.name_en
        ?? pest?.name_en
        ?? pest?.pest?.type
        ?? pest?.type
        ?? pest?.pest_type
        ?? '',
    ).toLowerCase()

    return pestName.includes('fungus')
      ? Math.max(highestRisk, Number(pest?.risk_chance) || 0)
      : highestRisk
  }, 0)
  const currentStageNo = Number(simulationVisual?.current_stage?.stage_no ?? 1)
  const growthPoint = Number(simulationVisual?.growth_point ?? 0)
  const growthRate = Number(simulationVisual?.growth_rate ?? 0)
  const health = Number(simulationVisual?.health ?? 100)
  const cycleSeconds = useCountdownSeconds(nextCycleAt)
  const plantingAreaLabel = getAppLanguage() === 'th' ? 'พื้นที่ปลูก' : 'Planting area'
  const isMature = currentStageNo >= 3 || growthPoint >= 100
  // The source animation is empty at its exact first frame. Keep a small
  // visible seedling pose while the first authoritative server cycle starts.
  const growthProgress = Math.min(1, Math.max(plantSelected ? 0.05 : 0, growthPoint / 100))
  const hasSelectedItem = Boolean(selectedItemCursorUrl)
  const itemCursorStyle = hasSelectedItem ? { cursor: 'none' } : undefined

  function moveItemCursor(event) {
    if (!hasSelectedItem || !stageRef.current) return

    const bounds = stageRef.current.getBoundingClientRect()
    setItemCursorPoint({ x: event.clientX - bounds.left, y: event.clientY - bounds.top })
  }

  function useItemFromStage(event) {
    if (!hasSelectedItem) return
    const target = event.target
    if (target?.closest?.('button, a, input, textarea, select, [data-ignore-item-click="true"]')) return
    onUseSelectedItem?.()
  }

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
        ref={stageRef}
        className="three-stage absolute inset-0 z-10"
        data-tour="lab-stage"
        style={itemCursorStyle}
        aria-label="Plant simulation stage"
        onClick={useItemFromStage}
        onPointerMove={moveItemCursor}
        onPointerLeave={() => setItemCursorPoint(null)}
      >
        <SceneErrorBoundary key={`${mode}-${simulationVisual?.current_model_url ?? 'empty'}-${sceneAssets['ground.dirt']?.url ?? 'ground'}`}>
        <Canvas shadows camera={{ position: [0.75, 1.2, 4.8], fov: 34 }} gl={{ preserveDrawingBuffer: true, antialias: true }} onCreated={({ gl }) => { canvasRef.current = gl.domElement }}>
          <color attach="background" args={[mode === 'outdoor' ? '#07110b' : '#080b09']} />
          {mode !== 'outdoor' && (
            <>
              <ambientLight intensity={0.85} />
              <directionalLight position={[3, 5, 4]} intensity={2.9} color="#d7fff0" />
              <pointLight position={[-3, 2, 3]} intensity={1.15} color="#9bcf82" />
              <pointLight position={[4, 1, -3]} intensity={0.75} color="#7fb069" />
            </>
          )}
          <Suspense fallback={<Loading />}>
            {mode === 'outdoor'
              ? (
                <TimeOfDayEnvironment
                  plantSelected={plantSelected}
                  rainfall={outdoorReadings?.rain}
                  solar={solarLighting}
                />
              )
              : <Environment preset="city" />}
            <SceneEnvironment
              daylight={mode === 'outdoor' ? solarLighting.daylight : 1}
              dirtModelUrl={sceneAssets['ground.dirt']?.url}
              mode={mode}
              plantingAreaLabel={plantingAreaLabel}
              plantSelected={plantSelected}
              rainfall={outdoorReadings?.rain}
              windDirection={outdoorReadings?.windDirection}
              windSpeed={outdoorReadings?.windSpeed}
            />
            {plantSelected && (
              <PlantAttachmentProvider>
                <PlantModel
                  modelUrl={simulationVisual?.current_model_url}
                  plantName={simulationVisual?.plant?.name_en ?? simulationVisual?.plant?.name_th}
                  visualOverrides={simulationVisual?.visual_overrides}
                  fungusRisk={fungusRisk}
                  health={health}
                  isMature={isMature}
                  growthProgress={growthProgress}
                />
                <PlantStatusHud awaitingFirstCycle={awaitingFirstCycle} cycleSeconds={cycleSeconds} cycleStatus={cycleStatus} growthPoint={growthPoint} growthRate={growthRate} health={health} />
                {pests.map((pest, index) => {
                  const pestKey = `${pest.pest?.name_en ?? pest.name_en ?? pest.type ?? 'pest'}-${pest.id ?? index}`

                  return (
                    <PestErrorBoundary key={pestKey} label={pestKey}>
                      <PestModel pest={pest} index={index} visualOverrides={simulationVisual?.visual_overrides} growthProgress={growthProgress} />
                    </PestErrorBoundary>
                  )
                })}
              </PlantAttachmentProvider>
            )}
          </Suspense>
          <OrbitControls enablePan={false} enableZoom enableRotate target={[0.75, 0.38, 0]} minDistance={3.2} maxDistance={9} minPolarAngle={0.35} maxPolarAngle={1.32} />
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
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#05b7ff] via-[#12d8e6] to-[#16f4be] text-xs font-black text-[#07110b] shadow-[0_0_16px_rgba(18,216,230,.45)]">
              XP
            </span>
            <span>+{expBurst.amount} EXP</span>
            {expBurst.leveledUp && <span className="rounded-full bg-lime-200 px-2 py-0.5 text-xs text-[#101511]">LEVEL UP</span>}
          </div>
        )}
        {hasSelectedItem && itemCursorPoint && (
          <img
            className="pointer-events-none absolute z-40 h-14 w-14 -translate-x-3 -translate-y-3 select-none object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,.38)]"
            src={selectedItemCursorUrl}
            alt=""
            style={{ left: itemCursorPoint.x, top: itemCursorPoint.y }}
            aria-hidden="true"
          />
        )}
        {!plantSelected && readOnly && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-amber-100/20 bg-[#101511]/96 px-5 py-5 text-center shadow-[0_16px_38px_rgba(0,0,0,.42)]">
            <span className="mx-auto mb-2 inline-flex rounded-full bg-amber-200/10 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-amber-100">Garden status</span>
            <strong className="block text-base text-lime-50">{emptyGardenOwnerName || 'This friend'} has not planted yet</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-300">There is no active plant in this garden. Check again after your friend starts growing one.</span>
          </div>
        )}
        {!plantSelected && !readOnly && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[310px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-lime-100/20 bg-[#101511]/94 px-5 py-4 text-center shadow-[0_16px_38px_rgba(0,0,0,.42)]">
            <span className="mx-auto mb-2 inline-flex rounded-full bg-[#9bcf82]/14 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-lime-100">Step 2 of 3 · Choose plant</span>
            <strong className="block text-base text-lime-50">Choose a plant to begin</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-300">Open Lab assets and choose the plant card. Your simulation will be saved to this account.</span>
          </div>
        )}
        {!readOnly && plantSelected && (
          <button
            className={`absolute left-1/2 top-20 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border bg-[#101511]/94 px-4 py-2.5 text-sm font-semibold shadow-[0_8px_18px_rgba(0,0,0,.32)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-200 ${shareVisibility === 'private' ? 'border-lime-100/15 text-slate-200 hover:bg-[#17201a]' : 'border-red-300/35 text-lime-50 hover:bg-[#1b1e18]'}`}
            type="button"
            onClick={toggleLiveShare}
            disabled={shareBusy}
            aria-label={shareVisibility === 'private' ? 'Start live sharing' : 'Stop live sharing'}
            aria-pressed={shareVisibility !== 'private'}
          >
            <span className="relative grid h-5 w-5 place-items-center">
              <AppIcon className={`h-5 w-5 ${shareBusy ? 'animate-pulse' : ''}`} name="live" />
              <span className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ring-[#101511] ${shareVisibility === 'private' ? 'bg-slate-500' : 'bg-red-500'}`} aria-hidden="true" />
            </span>
            <span>{shareBusy ? 'Updating...' : 'Live'}</span>
          </button>
        )}
        {!readOnly && plantSelected && <div className="lab-simulation-actions absolute bottom-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-lime-100/15 bg-[#101511]/90 p-1.5 shadow-[0_8px_18px_rgba(0,0,0,.32)]" data-tour="lab-actions" aria-label="Simulation actions">
          <button
            className="box-border inline-flex min-h-12 items-center gap-2 rounded-full border border-lime-100/15 bg-white/[0.035] px-4 py-2 text-sm font-medium leading-5 text-slate-200 shadow-xs transition hover:bg-white/[0.075] hover:text-lime-50 focus:outline-none focus:ring-4 focus:ring-lime-100/10"
            type="button"
            onClick={resetSimulation}
          >
            <img className="h-8 w-8 shrink-0 rounded-full border border-lime-100/15 object-cover shadow-[0_2px_6px_rgba(0,0,0,.28)]" src={imageAssets.uproot} alt="" draggable="false" />
            Uproot
          </button>
          <button
            className="box-border inline-flex min-h-12 items-center gap-2 rounded-full border border-transparent bg-[#9bcf82] px-4 py-2 text-sm font-medium leading-5 text-[#101511] shadow-xs transition enabled:hover:bg-[#addf96] focus:outline-none focus:ring-4 focus:ring-[#9bcf82]/25 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-200 disabled:opacity-80"
            type="button"
            onClick={saveSimulation}
            disabled={!isMature}
            aria-describedby={!isMature ? 'harvest-requirement' : undefined}
            title={!isMature ? `Harvest unlocks at 100% growth (currently ${Math.round(growthPoint)}%).` : 'Harvest and save to history'}
          >
            <img className="h-8 w-8 shrink-0 rounded-full border border-[#101511]/15 object-cover shadow-[0_2px_6px_rgba(0,0,0,.22)]" src={imageAssets.harvest} alt="" draggable="false" />
            Harvest
          </button>
          {!isMature && <span className="sr-only" id="harvest-requirement">Harvest is available when plant growth reaches 100 percent.</span>}
        </div>}
      </section>
  )
}




