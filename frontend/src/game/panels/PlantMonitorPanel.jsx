import { useEffect, useState } from 'react'
import { imageAssets, pestChances } from '../data/gameData'
import { Panel } from '../components/Panel'
import { PestChance } from '../components/PestChance'
import { resolveAssetUrl } from '../../lib/api'

const stageStops = [
  { label: 'Seedling', value: 0 },
  { label: 'Sprout', value: 40 },
  { label: 'Young', value: 100 },
]

const visualStateLabels = {
  healthy: 'Healthy',
  underwatered: 'Dry stress',
  overwatered: 'Water stress',
  nutrient_deficient: 'Low nutrient',
  heat_stress: 'Heat stress',
  burnt: 'Root burn',
  cold_stress: 'Cold stress',
  stunted: 'Stunted',
}

function clampPercent(value) {
  return Number(Math.min(100, Math.max(0, Number(value) || 0)).toFixed(1))
}

function hasBrokenEncoding(value) {
  const text = String(value ?? '')
  return text.includes('\u00c3') || text.includes('\u00c2') || text.includes('\u00e0') || text.includes('\ufffd')
}

function readablePlantName(value) {
  const text = String(value ?? '').trim()
  if (!text || hasBrokenEncoding(text)) return 'Elephant Ear'
  const normalized = text.toLowerCase()
  if (normalized === 'simulation sprout' || normalized === 'sprout') return 'Elephant Ear'
  return text
}

function useSoftNumber(target, speed = 0.045) {
  const [value, setValue] = useState(() => Number(target) || 0)

  useEffect(() => {
    let frame = 0
    let active = true
    const nextTarget = Number(target) || 0

    function step() {
      setValue((current) => {
        const delta = nextTarget - current
        if (Math.abs(delta) < 0.08) return nextTarget
        return current + delta * speed
      })

      if (active) frame = window.requestAnimationFrame(step)
    }

    frame = window.requestAnimationFrame(step)

    return () => {
      active = false
      window.cancelAnimationFrame(frame)
    }
  }, [speed, target])

  return clampPercent(value)
}

function buildPestChances(simulationVisual) {
  const risks = simulationVisual?.pest_risks
  if (!risks) return pestChances

  const activeNames = new Set((simulationVisual?.active_pests ?? []).map((entry) => String(
    entry?.pest?.name_en ?? entry?.name_en ?? entry?.type ?? '',
  ).toLowerCase()))

  return pestChances.map((pest) => ({
    ...pest,
    value: Number(risks[pest.icon] ?? pest.value),
    active: activeNames.has(pest.icon),
  }))
}

function getGrowthProgress(simulationVisual) {
  return clampPercent(simulationVisual?.growth_point ?? 18)
}

function getHealth(simulationVisual) {
  const visualState = simulationVisual?.visual_state ?? 'healthy'
  const stateHealth = {
    healthy: 100,
    underwatered: 68,
    overwatered: 62,
    nutrient_deficient: 70,
    heat_stress: 58,
    burnt: 44,
    cold_stress: 66,
    stunted: 48,
  }

  return clampPercent(simulationVisual?.health ?? stateHealth[visualState] ?? 82)
}

function getGrowthPace(simulationVisual, health, growthProgress, growthRate) {
  const visualState = simulationVisual?.visual_state ?? 'healthy'
  if (growthProgress >= 100) return { label: 'Fully grown', value: 0, color: '#d8f3c9', detail: 'growth complete' }
  if (growthRate <= 0) return { label: 'Paused', value: 0, color: '#f29b72', detail: 'unsafe conditions stop growth' }
  if (visualState === 'stunted' || health < 50) return { label: 'Paused', value: 12, color: '#f29b72', detail: 'stress blocks growth' }
  if (visualState !== 'healthy' || health < 75) return { label: 'Slow', value: 38, color: '#f7d35c', detail: 'needs better conditions' }
  return { label: 'Good', value: 78, color: '#9bcf82', detail: 'steady growth' }
}

function GrowthTimeline({ progress, history, pace, rate }) {
  const currentX = 18 + progress * 2.64
  const timelineValues = history?.length ? history : [0, 0, 0, 0, 0, 0, progress]
  const points = timelineValues
    .map((value, index) => {
      const x = 18 + index * (264 / Math.max(1, timelineValues.length - 1))
      const y = 98 - clampPercent(value) * 0.68
      return `${x},${Math.max(24, y)}`
    })
    .join(' ')

  return (
    <div className="rounded-md border border-lime-100/10 bg-black/20 px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <strong className="text-xs text-lime-50">Growth timeline</strong>
          <p className="text-[10px] text-slate-400">
            {pace.detail} - +{Math.round(rate || 0)} pts/cycle
          </p>
        </div>
        <span className="rounded bg-[#9bcf82]/12 px-2 py-1 text-[10px] font-bold text-lime-100">{pace.label}</span>
      </div>
      <svg className="h-24 w-full" viewBox="0 0 300 116" role="img" aria-label="Plant growth timeline">
        <defs>
          <linearGradient id="growthTimelineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#9bcf82" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#9bcf82" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M18 98 L${points} L282 98 Z`} fill="url(#growthTimelineFill)" />
        <polyline fill="none" points={points} stroke="#9bcf82" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        <line x1="18" x2="282" y1="98" y2="98" stroke="rgba(216,243,201,.16)" />
        {stageStops.map((stage) => {
          const x = 18 + stage.value * 2.64
          const active = progress >= stage.value
          return (
            <g key={stage.label}>
              <circle cx={x} cy="98" r={active ? 4 : 3} fill={active ? '#d8f3c9' : 'rgba(216,243,201,.28)'} />
              <text x={x} y="113" textAnchor="middle" className="fill-slate-400 text-[9px]">
                {stage.label}
              </text>
            </g>
          )
        })}
        <circle cx={currentX} cy="98" r="6" fill="#9bcf82" stroke="#101511" strokeWidth="3" />
      </svg>
    </div>
  )
}

export function PlantMonitorPanel({ windows, setWindows, simulationVisual }) {
  const visiblePestChances = buildPestChances(simulationVisual)
  const targetGrowthProgress = getGrowthProgress(simulationVisual)
  const targetHealth = getHealth(simulationVisual)
  const growthRate = Number(simulationVisual?.growth_rate ?? 0)
  const targetPace = getGrowthPace(simulationVisual, targetHealth, targetGrowthProgress, growthRate)
  const growthProgress = useSoftNumber(targetGrowthProgress, 0.014)
  const paceValue = useSoftNumber(targetPace.value, 0.012)
  const pace = { ...targetPace, value: paceValue }
  const growthHistory = simulationVisual?.growth_history ?? [growthProgress]
  const stageName = simulationVisual?.current_stage?.stage_name ?? 'Seedling'
  const plantName = readablePlantName(simulationVisual?.plant?.name_en ?? simulationVisual?.plant?.name_th)
  const plantImageUrl = resolveAssetUrl(simulationVisual?.plant?.image_url ?? simulationVisual?.plant?.icon_url) ?? imageAssets.plant
  const visualState = simulationVisual?.visual_state ?? 'healthy'
  const statusLabel = visualStateLabels[visualState] ?? 'Monitoring'

  return (
    <Panel id="monitor" title="Plant monitor" subtitle="growth and status" windows={windows} setWindows={setWindows} className="w-[360px] max-w-[calc(100vw-32px)]">
      <div className="max-h-[348px] overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible sm:pr-0">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-lime-100/15 bg-[#9bcf82]/12 shadow-[inset_0_0_0_1px_rgba(155,207,130,.08)]">
              <img className="h-full w-full object-cover object-center" src={plantImageUrl} alt="" draggable="false" />
            </span>
            <div>
              <strong className="block text-[15px] font-black leading-5 text-lime-50">{plantName}</strong>
              <span className="text-xs leading-5 text-slate-300">
                {stageName} - {statusLabel} - {growthProgress.toFixed(1)}% grown
              </span>
            </div>
          </div>
          <div className="flex items-center rounded-md bg-[#9bcf82]/12 px-2 py-1 text-xs font-semibold text-lime-100">{pace.label}</div>
        </div>

        <GrowthTimeline progress={growthProgress} history={growthHistory} pace={pace} rate={growthRate} />

        <div className="mt-3 border-t border-lime-100/10 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <strong className="text-xs text-lime-50">Pest monitoring</strong>
            <span className="text-[10px] text-slate-400">risk · next server cycle</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {visiblePestChances.map((pest) => (
              <PestChance key={pest.label} {...pest} />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}


