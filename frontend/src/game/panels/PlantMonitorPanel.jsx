import { useEffect, useState } from 'react'
import { pestChances } from '../data/gameData'
import { Panel } from '../components/Panel'
import { PestChance } from '../components/PestChance'
import { PestKnowledgeModal } from '../components/PestKnowledgeModal'
import { resolveAssetUrl } from '../../lib/api'
import { getAppLanguage } from '../../i18n/appI18n'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { formatRealDays, getGrowthStageStops, getRealGrowthEstimate, SIMULATION_CYCLE_SECONDS } from '../utils/realGrowth'

const stageLabelsTh = {
  Seedling: 'ระยะต้นกล้า',
  Sprout: 'ระยะแตกหน่อ',
  'Young Plant': 'ระยะต้นอ่อน',
  Mature: 'ระยะโตเต็มที่',
  'Bulb establishment': 'ระยะหัวตั้งตัว',
  'Leaf emergence': 'ระยะใบเริ่มงอก',
  Flowering: 'ระยะออกดอก',
}

const recommendationTones = {
  success: {
    badge: 'Stable',
    badgeTh: 'ปลอดภัย',
    border: 'border-emerald-300/25',
    background: 'bg-emerald-400/[0.08]',
    icon: 'check',
    iconBackground: 'bg-emerald-300/15',
    iconColor: 'text-emerald-200',
    label: 'text-emerald-200',
  },
  info: {
    badge: 'Preparing',
    badgeTh: 'กำลังเตรียม',
    border: 'border-sky-300/25',
    background: 'bg-sky-400/[0.08]',
    icon: 'clock',
    iconBackground: 'bg-sky-300/15',
    iconColor: 'text-sky-200',
    label: 'text-sky-200',
  },
  warning: {
    badge: 'Warning',
    badgeTh: 'เฝ้าระวัง',
    border: 'border-amber-300/35',
    background: 'bg-amber-400/[0.10]',
    icon: 'warning',
    iconBackground: 'bg-amber-300/15',
    iconColor: 'text-amber-200',
    label: 'text-amber-200',
  },
  danger: {
    badge: 'Danger',
    badgeTh: 'อันตราย',
    border: 'border-orange-400/40',
    background: 'bg-orange-500/[0.12]',
    icon: 'warning',
    iconBackground: 'bg-orange-400/20',
    iconColor: 'text-orange-200',
    label: 'text-orange-200',
  },
  critical: {
    badge: 'Critical',
    badgeTh: 'วิกฤต',
    border: 'border-rose-400/50',
    background: 'bg-rose-500/[0.14]',
    icon: 'warning',
    iconBackground: 'bg-rose-400/20',
    iconColor: 'text-rose-200',
    label: 'text-rose-200',
  },
}

const factorDefinitions = [
  {
    key: 'light',
    label: 'Light',
    labelTh: 'แสง',
    states: ['low_light', 'stunted'],
    unit: 'lx',
  },
  {
    key: 'soil_humidity',
    label: 'Soil moisture',
    labelTh: 'ความชื้นในดิน',
    states: ['underwatered', 'overwatered', 'botrytis'],
    unit: '%',
  },
  {
    key: 'air_humidity',
    label: 'Air humidity',
    labelTh: 'ความชื้นอากาศ',
    states: ['dry_air', 'botrytis'],
    unit: '%RH',
  },
  {
    key: 'soil_temp',
    label: 'Soil temperature',
    labelTh: 'อุณหภูมิดิน',
    states: ['heat_stress', 'cold_stress', 'burnt'],
    unit: '°C',
  },
  {
    key: 'air_temp',
    label: 'Air temperature',
    labelTh: 'อุณหภูมิอากาศ',
    states: ['heat_stress', 'cold_stress'],
    unit: '°C',
  },
]

function useAppLanguage() {
  const [language, setLanguage] = useState(() => getAppLanguage() === 'th' ? 'th' : 'en')

  useEffect(() => {
    function updateLanguage(event) {
      setLanguage(event?.detail?.language === 'th' || getAppLanguage() === 'th' ? 'th' : 'en')
    }

    window.addEventListener('plant-settings-change', updateLanguage)
    return () => window.removeEventListener('plant-settings-change', updateLanguage)
  }, [])

  return language
}

function formatFactorValue(definition, value) {
  const displayed = definition.display ? definition.display(value) : Number(value)
  const rounded = Math.abs(displayed - Math.round(displayed)) < 0.05
    ? Math.round(displayed)
    : Number(displayed.toFixed(1))
  return `${rounded}${definition.unit}`
}

function getEnvironmentIssues(simulationVisual) {
  const environment = simulationVisual?.plant?.environment ?? {}

  return factorDefinitions.flatMap((definition) => {
    const value = Number(simulationVisual?.[definition.key])
    const minimum = Number(environment?.[definition.key]?.min)
    const maximum = Number(environment?.[definition.key]?.max)
    if (![value, minimum, maximum].every(Number.isFinite) || minimum > maximum) return []
    if (value >= minimum && value <= maximum) return []

    const direction = value < minimum ? 'low' : 'high'
    const distance = direction === 'low' ? minimum - value : value - maximum
    const span = Math.max(1, maximum - minimum)

    return [{
      ...definition,
      direction,
      distanceRatio: distance / span,
      maximum,
      minimum,
      value,
    }]
  })
}

function getRecommendationLevel({ health, issue, growthRate, hasActivePests, pestRisk = 0 }) {
  if (health <= 25 || (hasActivePests && pestRisk >= 70)) return 'critical'
  if (health <= 50 || growthRate <= 0 || issue?.distanceRatio >= 0.45 || hasActivePests) return 'danger'
  return 'warning'
}

function getActivePestRecommendation(simulationVisual, language) {
  const activePests = simulationVisual?.active_pests ?? []
  if (activePests.length === 0) return null

  const entries = activePests.map((entry) => entry?.pest ?? entry)
  const pestNames = entries
    .map((pest) => language === 'th' ? pest?.name_th ?? pest?.name_en : pest?.name_en ?? pest?.name_th)
    .filter(Boolean)
  const normalizedNames = entries.map((pest) => String(pest?.name_en ?? pest?.type ?? '').toLowerCase())
  const treatments = []
  if (normalizedNames.some((name) => name.includes('snail'))) treatments.push(language === 'th' ? 'สเปรย์กำจัดหอยทาก' : 'Snail Spray')
  if (normalizedNames.some((name) => name.includes('aphid'))) treatments.push(language === 'th' ? 'สเปรย์กำจัดเพลี้ย' : 'Insect Spray')
  if (normalizedNames.some((name) => name.includes('fung'))) treatments.push(language === 'th' ? 'สเปรย์กำจัดเชื้อรา' : 'Fungus Spray')

  const risk = Math.max(0, ...activePests.map((entry) => Number(entry?.risk_chance ?? 0)))
  const names = pestNames.join(', ') || (language === 'th' ? 'ศัตรูพืช' : 'pest')
  const treatment = treatments.join(', ') || (language === 'th' ? 'ไอเทมรักษาที่ตรงกับศัตรูพืช' : 'the matching treatment item')

  return {
    risk,
    text: language === 'th'
      ? `พบ${names}บนพืช - ใช้${treatment}ทันทีเพื่อลดความเสียหาย`
      : `${names} detected - use ${treatment} now to limit plant damage.`,
  }
}

function getActiveEventRecommendation(simulationVisual, language) {
  const event = (simulationVisual?.events ?? [])
    .filter((entry) => ['announced', 'active'].includes(entry?.status))
    .sort((left, right) => {
      const severityRank = { critical: 4, high: 3, medium: 2, low: 1 }
      return (severityRank[right?.severity] ?? 0) - (severityRank[left?.severity] ?? 0)
    })[0]

  if (!event) return null

  const name = language === 'th'
    ? event.name_th || event.name_en
    : event.name_en || event.name_th
  const description = language === 'th'
    ? event.description_th || event.description_en
    : event.description_en || event.description_th
  const harmfulLevel = {
    critical: 'critical',
    high: 'danger',
    medium: 'warning',
    low: 'warning',
  }[event.severity] ?? 'warning'

  return {
    detail: description || (language === 'th'
      ? 'ตรวจสอบสภาพพืชและเลือกวิธีรับมือก่อนการอัปเดตครั้งถัดไป'
      : 'Review the plant and choose a response before the next update.'),
    level: event.is_harmful ? harmfulLevel : 'info',
    text: name || (language === 'th' ? 'มีเหตุการณ์ที่ควรตรวจสอบ' : 'An event needs your attention.'),
  }
}

function getPlantNeedRecommendation(simulationVisual, language) {
  const water = clampPercent(simulationVisual?.plant_needs?.water ?? simulationVisual?.water ?? 100)
  const nutrients = clampPercent(simulationVisual?.plant_needs?.fertilizer ?? simulationVisual?.fertilizer ?? 100)
  const needs = [
    {
      key: 'water',
      value: water,
      label: language === 'th' ? 'น้ำ' : 'Water',
      item: language === 'th' ? 'ไอเท็มรดน้ำ' : 'a watering item',
    },
    {
      key: 'fertilizer',
      value: nutrients,
      label: language === 'th' ? 'ธาตุอาหาร' : 'Nutrients',
      item: language === 'th' ? 'ไอเท็มปุ๋ย' : 'a fertilizer item',
    },
  ]
    .filter((need) => need.value <= 50)
    .sort((left, right) => left.value - right.value)

  if (needs.length === 0) return null

  const primary = needs[0]
  const secondary = needs[1]
  const level = primary.value <= 10 ? 'critical' : primary.value <= 25 ? 'danger' : 'warning'
  const secondaryText = secondary
    ? language === 'th'
      ? ` และ${secondary.label}เหลือ ${Math.round(secondary.value)}%`
      : `; ${secondary.label.toLowerCase()} are at ${Math.round(secondary.value)}%`
    : ''

  return {
    level,
    text: language === 'th'
      ? `${primary.label}สำรองเหลือ ${Math.round(primary.value)}%${secondaryText}`
      : `${primary.label} reserve is at ${Math.round(primary.value)}%${secondaryText}.`,
    detail: language === 'th'
      ? `ใช้${primary.item}จากคลังก่อนหลอดหมด ระบบจะหักไอเท็มเมื่อใช้งานสำเร็จเท่านั้น`
      : `Use ${primary.item} from Lab assets before the reserve runs out. The item is consumed only after a successful action.`,
  }
}

function buildRecommendation(simulationVisual, {
  awaitingFirstCycle,
  cycleSeconds,
  growthProgress,
  growthRate,
  health,
  language,
}) {
  const eventRecommendation = getActiveEventRecommendation(simulationVisual, language)
  if (eventRecommendation) return eventRecommendation

  if (growthProgress >= 100 && health > 0) {
    return {
      detail: language === 'th'
        ? 'วงจรการเจริญเติบโตสมบูรณ์แล้ว สามารถกดเก็บเกี่ยวได้ทันที'
        : 'The growth cycle is complete. You can harvest the plant now.',
      level: 'success',
      text: language === 'th'
        ? 'ต้นไม้เติบโตเต็มที่สมบูรณ์แล้ว และพร้อมเก็บเกี่ยว'
        : 'The plant has reached full maturity and is ready to harvest.',
    }
  }

  const pestRecommendation = getActivePestRecommendation(simulationVisual, language)
  if (pestRecommendation) {
    return {
      detail: language === 'th' ? 'ควรรักษาก่อนการอัปเดตครั้งถัดไป' : 'Treat before the next simulation update.',
      level: getRecommendationLevel({
        health,
        growthRate,
        hasActivePests: true,
        pestRisk: pestRecommendation.risk,
      }),
      text: pestRecommendation.text,
    }
  }

  const plantNeedRecommendation = getPlantNeedRecommendation(simulationVisual, language)
  if (plantNeedRecommendation) return plantNeedRecommendation

  const visualState = simulationVisual?.visual_state ?? 'healthy'
  const issues = getEnvironmentIssues(simulationVisual)
    .sort((left, right) => {
      const leftMatchesState = left.states.includes(visualState) ? 1 : 0
      const rightMatchesState = right.states.includes(visualState) ? 1 : 0
      return rightMatchesState - leftMatchesState || right.distanceRatio - left.distanceRatio
    })
  const issue = issues[0]

  if (issue) {
    const label = language === 'th' ? issue.labelTh : issue.label
    const current = formatFactorValue(issue, issue.value)
    const target = `${formatFactorValue(issue, issue.minimum)}-${formatFactorValue(issue, issue.maximum)}`
    const direction = language === 'th'
      ? issue.direction === 'low' ? 'ต่ำเกินไป' : 'สูงเกินไป'
      : issue.direction === 'low' ? 'is too low' : 'is too high'
    const action = language === 'th'
      ? issue.direction === 'low' ? 'เพิ่ม' : 'ลด'
      : issue.direction === 'low' ? 'increase' : 'reduce'
    const additionalIssues = issues.slice(1, 3)
      .map((entry) => language === 'th' ? entry.labelTh : entry.label)
      .join(', ')
    const hiddenIssueCount = Math.max(0, issues.length - 3)
    const additionalDetail = additionalIssues
      ? language === 'th'
        ? ` - ค่าอื่นที่ควรแก้: ${additionalIssues}${hiddenIssueCount ? ` และอีก ${hiddenIssueCount} ค่า` : ''}`
        : ` Other values to adjust: ${additionalIssues}${hiddenIssueCount ? ` and ${hiddenIssueCount} more` : ''}.`
      : ''

    return {
      detail: language === 'th'
        ? `ควรแก้ก่อนการอัปเดตครั้งถัดไป${additionalDetail}`
        : `Adjust before the next update.${additionalDetail}`,
      level: getRecommendationLevel({ health, issue, growthRate, hasActivePests: false }),
      text: language === 'th'
        ? `${label}${direction} (${current}) - ${action}ให้อยู่ในช่วง ${target}`
        : `${label} ${direction} (${current}) - ${action} it into the ${target} target range.`,
    }
  }

  if (visualState !== 'healthy' || health < 75) {
    return {
      detail: language === 'th' ? 'ค่าปัจจัยอาจเพิ่งถูกแก้ไข โปรดรอผลรอบถัดไป' : 'The factors may have just changed; wait for the next update.',
      level: getRecommendationLevel({ health, growthRate, hasActivePests: false }),
      text: language === 'th'
        ? 'พืชยังอยู่ในภาวะเครียด - รักษาค่าทุกปัจจัยให้อยู่ในช่วงเป้าหมาย'
        : 'The plant is still stressed - keep every factor inside its target range.',
    }
  }

  if (awaitingFirstCycle) {
    return {
      detail: language === 'th' ? 'ระบบกำลังเตรียมการคำนวณรอบแรก' : 'The first simulation calculation is being prepared.',
      level: 'info',
      text: language === 'th' ? 'ตรวจสอบค่าปัจจัยระหว่างรอการอัปเดตครั้งแรก' : 'Review the Environment controls while the first update is prepared.',
    }
  }

  return {
    detail: language === 'th'
      ? cycleSeconds != null ? `อัปเดตครั้งถัดไปใน ${cycleSeconds} วินาที` : 'ติดตามผลในการอัปเดตครั้งถัดไป'
      : cycleSeconds != null ? `Next update in ${cycleSeconds} seconds.` : 'Keep monitoring the next update.',
    level: 'success',
    text: language === 'th' ? 'ค่าปัจจัยอยู่ในช่วงที่เหมาะสม พืชมีความเสถียร' : 'Conditions are in range and the plant is stable.',
  }
}

function clampPercent(value) {
  return Number(Math.min(100, Math.max(0, Number(value) || 0)).toFixed(1))
}

function hasBrokenEncoding(value) {
  const text = String(value ?? '')
  return text.includes('\u00c3') || text.includes('\u00c2') || text.includes('\u00e0') || text.includes('\ufffd')
}

function readablePlantName(plant, language) {
  const preferredName = language === 'th' ? plant?.name_th : plant?.name_en
  const fallbackName = language === 'th' ? plant?.name_en : plant?.name_th
  const text = String(preferredName ?? fallbackName ?? '').trim()
  if (!text || hasBrokenEncoding(text)) return language === 'th' ? 'ต้นหูช้าง' : 'Elephant Ear'
  const normalized = text.toLowerCase()
  if (normalized === 'simulation sprout' || normalized === 'sprout') return language === 'th' ? 'ต้นหูช้าง' : 'Elephant Ear'
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

function getGrowthPace(simulationVisual, health, growthProgress, growthRate, awaitingFirstCycle, language = 'en') {
  const visualState = simulationVisual?.visual_state ?? 'healthy'
  const th = language === 'th'
  if (growthProgress >= 100) return { label: th ? 'โตเต็มที่' : 'Fully grown', value: 0, color: '#d8f3c9', detail: th ? 'การเติบโตสมบูรณ์แล้ว' : 'growth complete' }
  if (awaitingFirstCycle) return { label: th ? 'กำลังเริ่ม' : 'Starting', value: 0, color: '#9bcf82', detail: th ? 'รอการอัปเดตครั้งแรก' : 'waiting for the first update' }
  if (growthRate <= 0 && visualState === 'healthy' && health >= 75) return { label: th ? 'พร้อม' : 'Ready', value: 0, color: '#9bcf82', detail: th ? 'รอการอัปเดตครั้งถัดไป' : 'waiting for the next update' }
  if (growthRate <= 0) return { label: th ? 'หยุดชั่วคราว' : 'Paused', value: 0, color: '#f29b72', detail: th ? 'สภาพไม่ปลอดภัยทำให้หยุดเติบโต' : 'unsafe conditions stop growth' }
  if (visualState === 'stunted' || health < 50) return { label: th ? 'หยุดชั่วคราว' : 'Paused', value: 12, color: '#f29b72', detail: th ? 'ความเครียดขัดขวางการเติบโต' : 'stress blocks growth' }
  if (visualState !== 'healthy' || health < 75) return { label: th ? 'ช้า' : 'Slow', value: 38, color: '#f7d35c', detail: th ? 'ต้องปรับสภาพให้เหมาะสมขึ้น' : 'needs better conditions' }
  return { label: th ? 'ดี' : 'Good', value: 78, color: '#9bcf82', detail: th ? 'เติบโตสม่ำเสมอ' : 'steady growth' }
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

function GrowthTimeline({ awaitingFirstCycle, cycleSeconds, cycleStatus, estimate, progress, history, language, pace, rate, referenceUrl, stages }) {
  const isThai = language === 'th'
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
          <strong className="text-xs text-lime-50">{isThai ? 'การคำนวณการเติบโต' : 'Growth calculation'}</strong>
          <p className="text-xs text-slate-400">
            {progress >= 100
              ? isThai ? 'เติบโตถึงวัยสมบูรณ์แล้ว' : 'Biological maturity reached'
              : cycleStatus === 'updating'
                ? isThai ? 'กำลังประมวลผลการอัปเดต...' : 'Applying simulation update...'
                : cycleSeconds != null
                  ? isThai ? `อัปเดต${awaitingFirstCycle ? 'ครั้งแรก' : 'ครั้งถัดไป'}ใน ${cycleSeconds} วินาที` : `${awaitingFirstCycle ? 'First' : 'Next'} update in ${cycleSeconds}s`
                  : `${pace.detail}${rate > 0 ? ` · +${Math.round(rate)} pts/cycle` : ''}`}
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded bg-[#9bcf82]/12 px-2 py-1 text-xs font-bold leading-none text-lime-100">{pace.label}</span>
      </div>
      <svg className="h-28 w-full" viewBox="0 0 300 120" role="img" aria-label="Calculated simulation time compared with real-life plant growth">
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
        <text x={plot.left} y="118" className="fill-slate-600 text-[7px]">simulation time →</text>
      </svg>
      <RealGrowthScale estimate={estimate} language={language} pace={pace} referenceUrl={referenceUrl} />
    </div>
  )
}

function formatScaleSeconds(value) {
  if (!Number.isFinite(value)) return '—'
  return value < 10 ? value.toFixed(1) : Math.round(value).toLocaleString()
}

function RealGrowthScale({ estimate, language, pace, referenceUrl }) {
  const isThai = language === 'th'
  const currentDays = formatRealDays(estimate.equivalentDays)
  const maturityDays = formatRealDays(estimate.maturityDays)
  const isWaiting = !estimate.isMature && estimate.growthPointsPerCycle <= 0 && ['Starting', 'Ready', 'กำลังเริ่ม', 'พร้อม'].includes(pace.label)
  const isPaused = !estimate.isMature && !isWaiting && estimate.growthPointsPerCycle <= 0
  const scaleSeconds = estimate.currentSecondsPerRealDay ?? estimate.normalSecondsPerRealDay
  const scaleLabel = estimate.currentSecondsPerRealDay
    ? isThai ? `1 วัน ≈ ${formatScaleSeconds(scaleSeconds)} วินาทีในตอนนี้` : `1 day ≈ ${formatScaleSeconds(scaleSeconds)}s now`
    : isThai ? `1 วัน ≈ ${formatScaleSeconds(scaleSeconds)} วินาทีตามปกติ` : `1 day ≈ ${formatScaleSeconds(scaleSeconds)}s normal`
  const tooltip = estimate.currentSecondsPerRealDay
    ? `${estimate.cycleSeconds}s per update ÷ ${formatRealDays(estimate.equivalentDaysPerCycle)} biological days = ${formatScaleSeconds(scaleSeconds)} simulation seconds per real-life growth day.`
    : isPaused
      ? `Growth is paused under the current conditions. At normal pace, one real-life growth day equals about ${formatScaleSeconds(estimate.normalSecondsPerRealDay)} simulation seconds.`
      : `At normal pace, one real-life growth day equals about ${formatScaleSeconds(estimate.normalSecondsPerRealDay)} simulation seconds.`

  return (
    <div className="mt-1 flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 border-t border-lime-100/10 pt-2 text-[10px]" aria-label="Real-life growth scale" title={tooltip}>
      <span className="inline-flex items-center gap-1.5 font-bold text-sky-100">
        <AppIcon className="h-3 w-3 text-sky-300" name="history" />
        {currentDays} / ~{maturityDays} {isThai ? 'วัน' : 'days'}
      </span>
      <span aria-hidden="true" className="text-white/20">•</span>
      <span className={isPaused ? 'font-semibold text-orange-200' : 'font-semibold text-slate-300'}>
        {isPaused ? (isThai ? `หยุดชั่วคราว · ปกติ 1 วัน ≈ ${formatScaleSeconds(estimate.normalSecondsPerRealDay)} วินาที` : `Paused · normal 1 day ≈ ${formatScaleSeconds(estimate.normalSecondsPerRealDay)}s`) : scaleLabel}
      </span>
      {referenceUrl && (
        <a className="ml-auto shrink-0 text-sky-300/75 transition hover:text-white" href={referenceUrl} target="_blank" rel="noreferrer" aria-label="Open growth-time source" title="Growth-time source">
          {isThai ? 'แหล่งข้อมูล' : 'Source'} ↗
        </a>
      )}
    </div>
  )
}

export function PlantMonitorPanel({ awaitingFirstCycle = false, cycleStatus = 'idle', hasPlant = true, nextCycleAt = null, simulationSpeed = 1, windows, setWindows, simulationVisual, presentation = 'floating', hideHeader = false }) {
  const language = useAppLanguage()
  const visiblePestChances = buildPestChances(simulationVisual)
  const [selectedPestId, setSelectedPestId] = useState(null)
  const selectedPest = visiblePestChances.find((pest) => pest.icon === selectedPestId) ?? null
  const targetGrowthProgress = getGrowthProgress(simulationVisual)
  const targetHealth = getHealth(simulationVisual)
  const growthRate = Number(simulationVisual?.growth_rate ?? 0)
  const targetPace = getGrowthPace(simulationVisual, targetHealth, targetGrowthProgress, growthRate, awaitingFirstCycle, language)
  const growthProgress = useSoftNumber(targetGrowthProgress, 0.014)
  const paceValue = useSoftNumber(targetPace.value, 0.012)
  const pace = { ...targetPace, value: paceValue }
  const growthHistory = simulationVisual?.growth_history ?? [growthProgress]
  const growthStages = getGrowthStageStops(simulationVisual?.plant)
  const realGrowth = getRealGrowthEstimate(simulationVisual, SIMULATION_CYCLE_SECONDS / simulationSpeed)
  const rawStageName = simulationVisual?.current_stage?.stage_name ?? 'Seedling'
  const stageName = language === 'th' ? stageLabelsTh[rawStageName] ?? rawStageName : rawStageName
  const plantName = readablePlantName(simulationVisual?.plant, language)
  const plantImageUrl = resolveAssetUrl(simulationVisual?.plant?.base_image_url ?? simulationVisual?.plant?.image_url ?? simulationVisual?.plant?.icon_url)
  const cycleSeconds = useCountdownSeconds(nextCycleAt)

  return (
    <>
    <Panel id="monitor" title={language === 'th' ? 'ติดตามพืช' : 'Plant monitor'} subtitle={hasPlant ? (language === 'th' ? 'การเติบโตและสิ่งที่ควรทำต่อ' : 'growth and next action') : (language === 'th' ? 'ขั้นตอนที่ 2 · เลือกพืช' : 'Step 2 · choose a plant')} windows={windows} setWindows={setWindows} presentation={presentation} hideHeader={hideHeader} className={presentation === 'docked' ? '' : 'w-[360px] max-w-[calc(100vw-32px)]'}>
      <div className="max-h-[348px] overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible sm:pr-0">
        {!hasPlant ? (
          <div className="rounded-lg border border-lime-100/15 bg-[#0b0f0c]/65 p-4 text-center">
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#9bcf82]/14 text-[#9bcf82]">
              <span className="text-sm font-black">2</span>
            </span>
            <strong className="mt-3 block text-sm text-lime-50">{language === 'th' ? 'เลือกพืชจากคลังห้องทดลอง' : 'Choose a plant from Lab assets'}</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-400">{language === 'th' ? 'สุขภาพ การเติบโต และความเสี่ยงศัตรูพืชจะแสดงหลังเริ่มการจำลอง' : 'Plant health, growth and pest risk will appear here after the simulation starts.'}</span>
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
              <strong className="block text-[15px] font-black leading-5 text-lime-50" data-i18n-skip="true">{plantName}</strong>
              <span className="text-xs leading-5 text-slate-300">
                {stageName} · {growthProgress.toFixed(1)}% {language === 'th' ? 'เติบโต' : 'grown'}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center whitespace-nowrap rounded-md bg-[#9bcf82]/12 px-2 py-1 text-xs font-semibold leading-none text-lime-100">{pace.label}</div>
        </div>

        <GrowthTimeline awaitingFirstCycle={awaitingFirstCycle} cycleSeconds={cycleSeconds} cycleStatus={cycleStatus} estimate={realGrowth} progress={growthProgress} history={growthHistory} language={language} pace={pace} rate={growthRate} referenceUrl={simulationVisual?.plant?.growth_reference_url} stages={growthStages} />

        <div className="mt-3 border-t border-lime-100/10 pt-3">
          <div className="lab-pest-monitor-heading mb-2 flex items-center justify-between">
            <strong className="text-xs text-lime-50">{language === 'th' ? 'ติดตามศัตรูพืช' : 'Pest monitoring'}</strong>
            <span className="text-xs text-slate-400">{language === 'th' ? 'ความเสี่ยง' : 'risk'} · {cycleSeconds != null ? (language === 'th' ? `อัปเดตใน ${cycleSeconds} วินาที` : `updates in ${cycleSeconds}s`) : (language === 'th' ? 'รอบถัดไป' : 'next update')}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {visiblePestChances.map((pest) => (
              <PestChance key={pest.label} {...pest} onOpen={() => setSelectedPestId(pest.icon)} />
            ))}
          </div>
        </div>
          </>
        )}
      </div>
    </Panel>
    <PestKnowledgeModal language={language} onClose={() => setSelectedPestId(null)} pest={selectedPest} />
    </>
  )
}

export function PlantRecommendationBanner({ awaitingFirstCycle = false, nextCycleAt = null, simulationVisual }) {
  const language = useAppLanguage()
  const [collapsed, setCollapsed] = useState(true)
  const cycleSeconds = useCountdownSeconds(nextCycleAt)
  const growthProgress = getGrowthProgress(simulationVisual)
  const health = getHealth(simulationVisual)
  const recommendation = buildRecommendation(simulationVisual, {
    awaitingFirstCycle,
    cycleSeconds,
    growthProgress,
    growthRate: Number(simulationVisual?.growth_rate ?? 0),
    health,
    language,
  })
  const tone = recommendationTones[recommendation.level] ?? recommendationTones.info
  const isUrgent = ['critical', 'danger'].includes(recommendation.level)
  const statusLabel = language === 'th' ? tone.badgeTh : tone.badge
  const expandLabel = language === 'th'
    ? `เปิดคำแนะนำ: ${statusLabel}`
    : `Open recommendation: ${statusLabel}`

  if (collapsed) {
    return (
      <button
        className={`plant-recommendation-indicator plant-recommendation-indicator--${recommendation.level}`}
        data-tour="plant-recommendation"
        type="button"
        aria-label={expandLabel}
        title={expandLabel}
        onClick={() => setCollapsed(false)}
      >
        <AppIcon name={tone.icon} />
        <span className="plant-recommendation-indicator__dot" aria-hidden="true" />
      </button>
    )
  }

  return (
    <aside
      className={`plant-recommendation-rail plant-recommendation-rail--${recommendation.level}`}
      data-tour="plant-recommendation"
      data-i18n-skip="true"
      role={isUrgent ? 'alert' : 'status'}
      aria-live={isUrgent ? 'assertive' : 'polite'}
    >
      <span className={`plant-recommendation-rail__icon ${tone.iconBackground}`} aria-hidden="true">
        <AppIcon className={`${tone.iconColor}`} name={tone.icon} />
      </span>
      <span className="plant-recommendation-rail__copy">
        <span className={`plant-recommendation-rail__eyebrow ${tone.label}`}>
          {language === 'th' ? 'สิ่งที่แนะนำให้ทำต่อ' : 'Recommended next action'}
        </span>
        <strong>{recommendation.text}</strong>
        <span className="plant-recommendation-rail__detail">{recommendation.detail}</span>
      </span>
      <span className={`plant-recommendation-rail__badge ${tone.label}`}>
        {statusLabel}
      </span>
      <button
        className="plant-recommendation-rail__collapse"
        type="button"
        aria-label={language === 'th' ? 'ย่อคำแนะนำ' : 'Minimize recommendation'}
        title={language === 'th' ? 'ย่อเป็นไอคอน' : 'Minimize to icon'}
        onClick={() => setCollapsed(true)}
      >
        <AppIcon name="arrowForward" />
      </button>
    </aside>
  )
}


