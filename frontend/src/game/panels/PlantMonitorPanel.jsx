import { useEffect, useState } from 'react'
import { pestChances } from '../data/gameData'
import { Panel } from '../components/Panel'
import { PestChance } from '../components/PestChance'
import { resolveAssetUrl } from '../../lib/api'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { formatRealDays, getGrowthStageStops, getRealGrowthEstimate } from '../utils/realGrowth'

const visualStateLabels = {
  healthy: 'Healthy',
  underwatered: 'Dry stress',
  overwatered: 'Water stress',
  nutrient_deficient: 'Low nutrient',
  heat_stress: 'Heat stress',
  burnt: 'Root burn',
  cold_stress: 'Cold stress',
  low_light: 'Low-light stress',
  dry_air: 'Dry-air stress',
  botrytis: 'Fungal risk',
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

function getGrowthPace(simulationVisual, health, growthProgress, growthRate, awaitingFirstCycle) {
  const visualState = simulationVisual?.visual_state ?? 'healthy'
  if (growthProgress >= 100) return { label: 'Fully grown', value: 0, color: '#d8f3c9', detail: 'growth complete' }
  if (awaitingFirstCycle) return { label: 'Starting', value: 0, color: '#9bcf82', detail: 'waiting for the first update' }
  if (growthRate <= 0 && visualState === 'healthy' && health >= 75) return { label: 'Ready', value: 0, color: '#9bcf82', detail: 'waiting for the next update' }
  if (growthRate <= 0) return { label: 'Paused', value: 0, color: '#f29b72', detail: 'unsafe conditions stop growth' }
  if (visualState === 'stunted' || health < 50) return { label: 'Paused', value: 12, color: '#f29b72', detail: 'stress blocks growth' }
  if (visualState !== 'healthy' || health < 75) return { label: 'Slow', value: 38, color: '#f7d35c', detail: 'needs better conditions' }
  return { label: 'Good', value: 78, color: '#9bcf82', detail: 'steady growth' }
}

function formatGameTime(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0))
  if (value < 60) return `${value}s`
  const minutes = Math.floor(value / 60)
  const remainingSeconds = value % 60
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}

function normalizeTimelineValues(history, progress) {
  const values = (Array.isArray(history) ? history : [])
    .map(clampPercent)
    .slice(-7)

  while (values.length > 2 && values[0] === 0 && values[1] === 0) values.shift()
  if (values.length === 0) values.push(0)
  if (Math.abs(values[values.length - 1] - progress) > 0.1) values.push(progress)
  return values.slice(-7)
}

function GrowthTimeline({ awaitingFirstCycle, cycleSeconds, cycleStatus, estimate, progress, history, pace, rate, referenceUrl, stages }) {
  const plot = { left: 34, right: 254, top: 12, bottom: 92 }
  const timelineValues = normalizeTimelineValues(history, progress)
  const pointData = timelineValues
    .map((value, index) => {
      const x = timelineValues.length === 1
        ? plot.right
        : plot.left + index * ((plot.right - plot.left) / (timelineValues.length - 1))
      const y = plot.bottom - (clampPercent(value) / 100) * (plot.bottom - plot.top)
      const biologicalDays = estimate.maturityDays * (clampPercent(value) / 100)
      const secondsAgo = (timelineValues.length - 1 - index) * estimate.cycleSeconds
      return { biologicalDays, secondsAgo, value, x, y }
    })
  const points = pointData.map(({ x, y }) => `${x},${y}`).join(' ')
  const areaPath = pointData.length > 1
    ? `M${pointData[0].x} ${plot.bottom} L${points} L${pointData[pointData.length - 1].x} ${plot.bottom} Z`
    : ''
  const elapsedWindow = (timelineValues.length - 1) * estimate.cycleSeconds
  const middleElapsed = Math.round(elapsedWindow / 2)

  return (
    <div className="rounded-md border border-lime-100/10 bg-black/20 px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <strong className="text-xs text-lime-50">Growth calculation</strong>
          <p className="text-xs text-slate-400">
            {progress >= 100
              ? 'Biological maturity reached'
              : cycleStatus === 'updating'
                ? 'Applying simulation update...'
                : cycleSeconds != null
                  ? `${awaitingFirstCycle ? 'First' : 'Next'} update in ${cycleSeconds}s`
                  : `${pace.detail}${rate > 0 ? ` · +${Math.round(rate)} pts/cycle` : ''}`}
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded bg-[#9bcf82]/12 px-2 py-1 text-xs font-bold leading-none text-lime-100">{pace.label}</span>
      </div>
      <svg className="h-28 w-full" viewBox="0 0 300 120" role="img" aria-label="Calculated game time compared with real-life plant growth">
        <defs>
          <linearGradient id="growthTimelineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#9bcf82" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#9bcf82" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 50, 100].map((percent) => {
          const y = plot.bottom - (percent / 100) * (plot.bottom - plot.top)
          const dayLabel = formatRealDays(estimate.maturityDays * (percent / 100))
          return (
            <g key={percent}>
              <line x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="rgba(216,243,201,.11)" strokeDasharray="3 4" />
              <text x={plot.left - 5} y={y + 3} textAnchor="end" className="fill-slate-500 text-[8px]">{dayLabel}d</text>
            </g>
          )
        })}
        {stages.map((stage) => {
          const y = plot.bottom - (stage.value / 100) * (plot.bottom - plot.top)
          return (
            <g key={stage.label}>
              <line x1={plot.right + 2} x2={plot.right + 6} y1={y} y2={y} stroke={progress >= stage.value ? '#9bcf82' : 'rgba(216,243,201,.25)'} />
              <text x={plot.right + 9} y={y + 3} className={progress >= stage.value ? 'fill-lime-100 text-[7px]' : 'fill-slate-500 text-[7px]'}>{stage.label}</text>
            </g>
          )
        })}
        {areaPath && <path d={areaPath} fill="url(#growthTimelineFill)" />}
        <polyline fill="none" points={points} stroke="#9bcf82" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {pointData.map((point, index) => (
          <circle key={`${point.secondsAgo}-${index}`} cx={point.x} cy={point.y} r={index === pointData.length - 1 ? 4 : 2.5} fill={index === pointData.length - 1 ? '#d8f3c9' : '#9bcf82'} stroke="#101511" strokeWidth="1.5">
            <title>{`${point.secondsAgo === 0 ? 'Now' : `${formatGameTime(point.secondsAgo)} ago`} · ${point.value.toFixed(1)}% growth · ${formatRealDays(point.biologicalDays)} real days`}</title>
          </circle>
        ))}
        {elapsedWindow > 0 && <text x={plot.left} y="108" textAnchor="start" className="fill-slate-500 text-[8px]">-{formatGameTime(elapsedWindow)}</text>}
        {middleElapsed > 0 && <text x={(plot.left + plot.right) / 2} y="108" textAnchor="middle" className="fill-slate-600 text-[8px]">-{formatGameTime(middleElapsed)}</text>}
        <text x={plot.right} y="108" textAnchor="end" className="fill-slate-400 text-[8px]">Now</text>
        <text x={plot.left} y="118" className="fill-slate-600 text-[7px]">game time →</text>
      </svg>
      <RealGrowthScale estimate={estimate} pace={pace} referenceUrl={referenceUrl} />
    </div>
  )
}

function formatScaleSeconds(value) {
  if (!Number.isFinite(value)) return '—'
  return value < 10 ? value.toFixed(1) : Math.round(value).toLocaleString()
}

function RealGrowthScale({ estimate, pace, referenceUrl }) {
  const currentDays = formatRealDays(estimate.equivalentDays)
  const maturityDays = formatRealDays(estimate.maturityDays)
  const isWaiting = !estimate.isMature && estimate.growthPointsPerCycle <= 0 && ['Starting', 'Ready'].includes(pace.label)
  const isPaused = !estimate.isMature && !isWaiting && estimate.growthPointsPerCycle <= 0
  const scaleSeconds = estimate.currentSecondsPerRealDay ?? estimate.normalSecondsPerRealDay
  const scaleLabel = estimate.currentSecondsPerRealDay
    ? `1 day ≈ ${formatScaleSeconds(scaleSeconds)}s now`
    : `1 day ≈ ${formatScaleSeconds(scaleSeconds)}s normal`
  const tooltip = estimate.currentSecondsPerRealDay
    ? `${estimate.cycleSeconds}s per update ÷ ${formatRealDays(estimate.equivalentDaysPerCycle)} biological days = ${formatScaleSeconds(scaleSeconds)} game seconds per real-life growth day.`
    : isPaused
      ? `Growth is paused under the current conditions. At normal pace, one real-life growth day equals about ${formatScaleSeconds(estimate.normalSecondsPerRealDay)} game seconds.`
      : `At normal pace, one real-life growth day equals about ${formatScaleSeconds(estimate.normalSecondsPerRealDay)} game seconds.`

  return (
    <div className="mt-1 flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 border-t border-lime-100/10 pt-2 text-[10px]" aria-label="Real-life growth scale" title={tooltip}>
      <span className="inline-flex items-center gap-1.5 font-bold text-sky-100">
        <AppIcon className="h-3 w-3 text-sky-300" name="history" />
        {currentDays} / ~{maturityDays} days
      </span>
      <span aria-hidden="true" className="text-white/20">•</span>
      <span className={isPaused ? 'font-semibold text-orange-200' : 'font-semibold text-slate-300'}>
        {isPaused ? `Paused · normal 1 day ≈ ${formatScaleSeconds(estimate.normalSecondsPerRealDay)}s` : scaleLabel}
      </span>
      {referenceUrl && (
        <a className="ml-auto shrink-0 text-sky-300/75 transition hover:text-white" href={referenceUrl} target="_blank" rel="noreferrer" aria-label="Open growth-time source" title="Growth-time source">
          Source ↗
        </a>
      )}
    </div>
  )
}

export function PlantMonitorPanel({ awaitingFirstCycle = false, cycleStatus = 'idle', hasPlant = true, nextCycleAt = null, windows, setWindows, simulationVisual }) {
  const visiblePestChances = buildPestChances(simulationVisual)
  const targetGrowthProgress = getGrowthProgress(simulationVisual)
  const targetHealth = getHealth(simulationVisual)
  const growthRate = Number(simulationVisual?.growth_rate ?? 0)
  const targetPace = getGrowthPace(simulationVisual, targetHealth, targetGrowthProgress, growthRate, awaitingFirstCycle)
  const growthProgress = useSoftNumber(targetGrowthProgress, 0.014)
  const paceValue = useSoftNumber(targetPace.value, 0.012)
  const pace = { ...targetPace, value: paceValue }
  const growthHistory = simulationVisual?.growth_history ?? [growthProgress]
  const growthStages = getGrowthStageStops(simulationVisual?.plant)
  const realGrowth = getRealGrowthEstimate(simulationVisual)
  const stageName = simulationVisual?.current_stage?.stage_name ?? 'Seedling'
  const plantName = readablePlantName(simulationVisual?.plant?.name_en ?? simulationVisual?.plant?.name_th)
  const plantImageUrl = resolveAssetUrl(simulationVisual?.plant?.base_image_url ?? simulationVisual?.plant?.image_url ?? simulationVisual?.plant?.icon_url)
  const visualState = simulationVisual?.visual_state ?? 'healthy'
  const statusLabel = visualStateLabels[visualState] ?? 'Monitoring'
  const cycleSeconds = useCountdownSeconds(nextCycleAt)
  const hasActivePests = (simulationVisual?.active_pests ?? []).length > 0
  const nextAction = targetGrowthProgress >= 100
    ? 'Plant is mature — Harvest is now available.'
    : hasActivePests
      ? 'Pest detected — select a matching treatment from Lab assets.'
      : visualState !== 'healthy' || targetHealth < 75
        ? 'Plant is stressed — review the Environment controls before the next update.'
        : awaitingFirstCycle
          ? 'Review the Environment controls while the first update is prepared.'
          : cycleSeconds != null
            ? `Conditions look stable. Next update in ${cycleSeconds} seconds.`
            : 'Conditions look stable. Keep monitoring the next update.'

  return (
    <Panel id="monitor" title="Plant monitor" subtitle={hasPlant ? 'growth and next action' : 'Step 2 · choose a plant'} windows={windows} setWindows={setWindows} className="w-[360px] max-w-[calc(100vw-32px)]">
      <div className="max-h-[348px] overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible sm:pr-0">
        {!hasPlant ? (
          <div className="rounded-lg border border-lime-100/15 bg-[#0b0f0c]/65 p-4 text-center">
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#9bcf82]/14 text-[#9bcf82]">
              <span className="text-sm font-black">2</span>
            </span>
            <strong className="mt-3 block text-sm text-lime-50">Choose a plant from Lab assets</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-400">Plant health, growth and pest risk will appear here after the simulation starts.</span>
          </div>
        ) : (
          <>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-lime-100/15 bg-[#9bcf82]/12 shadow-[inset_0_0_0_1px_rgba(155,207,130,.08)]">
              {plantImageUrl ? (
                <img className="h-full w-full object-cover object-center" src={plantImageUrl} alt="" draggable="false" />
              ) : (
                <AppIcon className="h-7 w-7 text-[#9bcf82]" name="plant" />
              )}
            </span>
            <div className="min-w-0">
              <strong className="block text-[15px] font-black leading-5 text-lime-50">{plantName}</strong>
              <span className="text-xs leading-5 text-slate-300">
                {stageName} - {statusLabel} - {growthProgress.toFixed(1)}% grown
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center whitespace-nowrap rounded-md bg-[#9bcf82]/12 px-2 py-1 text-xs font-semibold leading-none text-lime-100">{pace.label}</div>
        </div>

        <div className="mb-3 rounded-md border border-lime-100/10 bg-[#9bcf82]/[0.07] px-3 py-2.5">
          <span className="block text-xs font-black uppercase tracking-[0.1em] text-[#9bcf82]">Recommended next action</span>
          <span className="mt-1 block text-xs leading-5 text-slate-200">{nextAction}</span>
        </div>

        <GrowthTimeline awaitingFirstCycle={awaitingFirstCycle} cycleSeconds={cycleSeconds} cycleStatus={cycleStatus} estimate={realGrowth} progress={growthProgress} history={growthHistory} pace={pace} rate={growthRate} referenceUrl={simulationVisual?.plant?.growth_reference_url} stages={growthStages} />

        <div className="mt-3 border-t border-lime-100/10 pt-3">
          <div className="lab-pest-monitor-heading mb-2 flex items-center justify-between">
            <strong className="text-xs text-lime-50">Pest monitoring</strong>
            <span className="text-xs text-slate-400">risk · {cycleSeconds != null ? `updates in ${cycleSeconds}s` : 'next update'}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {visiblePestChances.map((pest) => (
              <PestChance key={pest.label} {...pest} />
            ))}
          </div>
        </div>
          </>
        )}
      </div>
    </Panel>
  )
}


