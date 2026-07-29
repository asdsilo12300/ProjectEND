export const SIMULATION_CYCLE_SECONDS = 30
export const HEALTHY_GROWTH_POINTS_PER_CYCLE = 14

const DEFAULT_MATURITY_DAYS = 90
const knownMaturityDays = [
  { matches: ['tulip', 'ทิวลิป'], days: 112 },
  { matches: ['elephant ear', 'xanthosoma'], days: 119 },
]

function finiteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function resolveMaturityDays(plant) {
  const configuredDays = finiteNumber(plant?.real_maturity_days)
  if (configuredDays > 0) return Math.round(configuredDays)

  const plantName = `${plant?.name_en ?? ''} ${plant?.name_th ?? ''}`.toLocaleLowerCase()
  const knownPlant = knownMaturityDays.find(({ matches }) => matches.some((name) => plantName.includes(name)))
  return knownPlant?.days ?? DEFAULT_MATURITY_DAYS
}

export function resolveMaximumGrowthPoint(plant) {
  const stageMaximum = Math.max(
    0,
    ...(plant?.stages ?? []).map((stage) => finiteNumber(stage?.required_growth_point)),
  )
  return stageMaximum > 0 ? stageMaximum : 100
}

export function getRealGrowthEstimate(simulationVisual, cycleSeconds = SIMULATION_CYCLE_SECONDS) {
  const plant = simulationVisual?.plant ?? {}
  const maximumGrowthPoint = resolveMaximumGrowthPoint(plant)
  const growthPoint = clamp(finiteNumber(simulationVisual?.growth_point), 0, maximumGrowthPoint)
  const maturityDays = resolveMaturityDays(plant)
  const isMature = growthPoint >= maximumGrowthPoint
  const reportedGrowthPointsPerCycle = Math.max(0, finiteNumber(simulationVisual?.growth_rate))
  const growthPointsPerCycle = isMature
    ? 0
    : clamp(reportedGrowthPointsPerCycle, 0, maximumGrowthPoint - growthPoint)
  const realDaysPerPoint = maturityDays / maximumGrowthPoint
  const equivalentDays = isMature ? maturityDays : growthPoint * realDaysPerPoint
  const equivalentDaysPerCycle = growthPointsPerCycle * realDaysPerPoint
  const normalEquivalentDaysPerCycle = HEALTHY_GROWTH_POINTS_PER_CYCLE * realDaysPerPoint
  const normalSecondsPerRealDay = cycleSeconds / normalEquivalentDaysPerCycle
  const currentSecondsPerRealDay = equivalentDaysPerCycle > 0
    ? cycleSeconds / equivalentDaysPerCycle
    : null

  return {
    cycleSeconds,
    currentSecondsPerRealDay,
    equivalentDays,
    equivalentDaysPerCycle,
    growthPoint,
    growthPointsPerCycle,
    isMature,
    maturityDays,
    maximumGrowthPoint,
    normalSecondsPerRealDay,
    pacePercent: isMature
      ? 0
      : clamp((reportedGrowthPointsPerCycle / HEALTHY_GROWTH_POINTS_PER_CYCLE) * 100, 0, 100),
    progressPercent: clamp((growthPoint / maximumGrowthPoint) * 100, 0, 100),
    realDaysRemaining: Math.max(0, maturityDays - equivalentDays),
    realDaysPerPoint,
  }
}

export function getGrowthStageStops(plant) {
  const maximumGrowthPoint = resolveMaximumGrowthPoint(plant)
  const stages = Array.isArray(plant?.stages) ? plant.stages : []

  if (stages.length === 0) {
    return [
      { label: 'Seedling', value: 0 },
      { label: 'Sprout', value: 40 },
      { label: 'Mature', value: 100 },
    ]
  }

  return [...stages]
    .sort((first, second) => finiteNumber(first?.required_growth_point) - finiteNumber(second?.required_growth_point))
    .map((stage, index) => {
      const stageName = String(stage?.stage_name || `Stage ${index + 1}`)
      return {
        label: stageName.length > 12 ? stageName.split(/\s+/)[0] : stageName,
        value: clamp((finiteNumber(stage?.required_growth_point) / maximumGrowthPoint) * 100, 0, 100),
      }
    })
}

export function formatRealDays(value) {
  const days = Math.max(0, finiteNumber(value))
  if (days === 0) return '0'
  if (days < 10) return days.toFixed(1).replace(/\.0$/, '')
  return Math.round(days).toLocaleString()
}
