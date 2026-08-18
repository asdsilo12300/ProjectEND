import { Component, Suspense, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Html, OrbitControls } from '@react-three/drei'
import { imageAssets } from '../data/gameData'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { formatRealDays, getRealGrowthEstimate, SIMULATION_CYCLE_SECONDS } from '../utils/realGrowth'
import { getAppLanguage } from '../../i18n/appI18n'
import { Loading, PestModel, PlantModel } from './PlantModel'
import { PlantAttachmentProvider } from './plantAttachments'
import { SceneEnvironment } from './SceneEnvironment'
import { TimeOfDayEnvironment } from './TimeOfDayEnvironment'
import { useTimeOfDayLighting } from './useTimeOfDayLighting'
import { ActionAnimation, ActiveCareEffects } from './ActionAnimation'
import { preloadActionModels } from './actionModelAssets'
import { PlantRecommendationBanner } from '../panels/PlantMonitorPanel'
import { SeasonalEffects } from './SeasonalEffects'
import { localSeasonIcon, localSeasonLabel } from '../utils/seasonalWeather'

function useCurrentAppLanguage() {
  const [language, setLanguage] = useState(() => getAppLanguage() === 'th' ? 'th' : 'en')

  useEffect(() => {
    const updateLanguage = (event) => {
      setLanguage(event?.detail?.language === 'th' || getAppLanguage() === 'th' ? 'th' : 'en')
    }
    window.addEventListener('plant-settings-change', updateLanguage)
    return () => window.removeEventListener('plant-settings-change', updateLanguage)
  }, [])

  return language
}

class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    this.props.onError?.(error)
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

function SceneReadySignal({ loadKey, onReady, simulatorId }) {
  useEffect(() => {
    if (loadKey == null || !onReady) return undefined

    let secondFrame = null
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        onReady({ loadKey, simulatorId: simulatorId ?? null })
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame)
    }
  }, [loadKey, onReady, simulatorId])

  return null
}

function getHudPace(growthRate, growthPoint, health) {
  if (growthPoint >= 100) return 0
  if (growthRate <= 0 || health < 50) return 0
  if (health < 75) return 38
  return 78
}

function PlantStatusHud({ awaitingFirstCycle = false, cycleSeconds = null, cycleStatus = 'idle', fertilizer = 100, growthPoint = 0, growthRate = 0, health = 100, plantNeeds = null, water = 100 }) {
  const healthValue = clampPercent(health)
  const growthValue = clampPercent(growthPoint)
  const paceValue = clampPercent(getHudPace(growthRate, growthPoint, healthValue))
  const isThai = getAppLanguage() === 'th'
  const isHarvestReady = growthValue >= 100 && healthValue > 0
  const waterValue = clampPercent(plantNeeds?.water ?? water)
  const fertilizerValue = clampPercent(plantNeeds?.fertilizer ?? fertilizer)
  const waterRate = Number(plantNeeds?.rates?.water_per_cycle ?? 3)
  const fertilizerRate = Number(plantNeeds?.rates?.fertilizer_per_cycle ?? 0.25)
  const statusLabel = isHarvestReady
    ? isThai ? 'พร้อมเก็บเกี่ยว' : 'HARVEST READY'
    : cycleStatus === 'updating'
      ? isThai ? 'กำลังอัปเดต' : 'UPDATING'
      : awaitingFirstCycle && cycleSeconds != null
        ? isThai ? `รอบแรก ${cycleSeconds} วิ` : `FIRST ${cycleSeconds}s`
        : isThai ? 'กำลังเติบโต' : 'GROWING'
  const stats = [
    { label: isThai ? 'สุขภาพ' : 'Health', value: healthValue, color: '#ef6f61', icon: 'heart', key: 'health' },
    { label: isThai ? 'การเติบโต' : 'Growth', value: growthValue, color: '#9bcf82', icon: 'sprout', key: 'growth' },
    { label: isThai ? 'ความเร็ว' : 'Pace', value: paceValue, color: paceValue === 0 ? '#7b8778' : '#d8f3c9', icon: 'speed', key: 'pace' },
  ]
  const needRows = [
    { key: 'water', label: isThai ? 'น้ำ' : 'Water', value: waterValue, rate: waterRate, color: '#55c9e8', icon: 'drop' },
    { key: 'fertilizer', label: isThai ? 'ธาตุอาหาร' : 'Nutrients', value: fertilizerValue, rate: fertilizerRate, color: '#f0c85b', icon: 'plus' },
  ]

  function needTone(value, preferredColor) {
    if (value <= 25) return '#ef6f61'
    if (value <= 50) return '#f0c85b'
    return preferredColor
  }

  function needLabel(value) {
    if (value <= 25) return isThai ? 'ต่ำ' : 'LOW'
    if (value <= 50) return isThai ? 'ใกล้หมด' : 'SOON'
    return isThai ? 'เพียงพอ' : 'SUPPLIED'
  }

  return (
    <Html position={[1.78, 0.68, 0.08]} center zIndexRange={[18, 0]}>
      <div className="pointer-events-none flex w-[230px] flex-col gap-2">
      <div className="rounded-lg border border-lime-100/25 bg-[#101511]/96 px-3 py-2 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,.45),0_0_0_1px_rgba(0,0,0,.35)]">
        <div className="mb-2 flex items-center justify-between border-b border-lime-100/10 pb-1.5">
          <strong className="text-xs text-lime-50">{isThai ? 'สถานะพืช' : 'Plant status'}</strong>
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-black ${isHarvestReady ? 'bg-emerald-300/20 text-emerald-100' : 'bg-[#9bcf82]/12 text-lime-100'}`}
            data-i18n-skip="true"
          >
            {statusLabel}
          </span>
        </div>
        <div className="grid gap-2">
          {stats.map((stat) => (
            <div className="grid grid-cols-[22px_52px_1fr_30px] items-center gap-2" key={stat.key}>
              <span className="grid h-5 w-5 place-items-center rounded bg-white/[0.08]" style={{ color: stat.color }}>
                <AppIcon className="h-3.5 w-3.5" name={stat.icon} />
              </span>
              <span className="text-xs font-semibold text-slate-300">{stat.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.12]">
                <span className="block h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${stat.value}%`, backgroundColor: stat.color }} />
              </span>
              <strong className="text-right text-xs text-lime-50">{awaitingFirstCycle && stat.key === 'pace' ? '—' : Math.round(stat.value)}</strong>
            </div>
          ))}
        </div>
      </div>
      <section className="rounded-lg border border-cyan-100/20 bg-[#0d1715]/96 px-3 py-2 text-slate-100 shadow-[0_12px_28px_rgba(0,0,0,.4)]" aria-label={isThai ? 'ความต้องการของพืช' : 'Plant needs'}>
        <div className="mb-2 flex items-center justify-between border-b border-cyan-100/10 pb-1.5">
          <strong className="text-xs text-cyan-50">{isThai ? 'ความต้องการของพืช' : 'Plant needs'}</strong>
          <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{isThai ? 'ลดตามเวลา' : 'USES OVER TIME'}</span>
        </div>
        <div className="grid gap-2.5">
          {needRows.map((need) => {
            const color = needTone(need.value, need.color)
            return (
              <div key={need.key}>
                <div className="mb-1 grid grid-cols-[20px_1fr_auto] items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded bg-white/[0.07]" style={{ color }}>
                    <AppIcon className="h-3.5 w-3.5" name={need.icon} />
                  </span>
                  <span className="text-xs font-semibold text-slate-200">{need.label}</span>
                  <span className="flex items-center gap-1 text-[9px] font-black" style={{ color }}>
                    {needLabel(need.value)} <strong className="text-xs text-lime-50">{Math.round(need.value)}%</strong>
                  </span>
                </div>
                <span className="block h-2 overflow-hidden rounded-full bg-white/[0.1]">
                  <span className="block h-full rounded-full transition-[width,background-color] duration-500" style={{ width: `${need.value}%`, backgroundColor: color }} />
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-2 border-t border-white/[0.06] pt-1.5 text-[9px] leading-4 text-slate-400">
          {isThai
            ? `น้ำลดประมาณ ${Math.max(1, Math.round(waterRate))}% ต่อรอบ · ปุ๋ยลดช้ากว่าน้ำ`
            : `Water uses about ${Math.max(1, Math.round(waterRate))}% per cycle · nutrients drain more slowly`}
        </p>
      </section>
      </div>
    </Html>
  )
}

function getOutdoorClock(currentTime, timezone, language) {
  const locale = language === 'th' ? 'th-TH' : 'en-GB'
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const normalizedTimezone = String(timezone ?? '').trim().toUpperCase()
  const displayTimezone = (!timezone || normalizedTimezone === 'GMT' || normalizedTimezone === 'UTC')
    ? browserTimezone || timezone
    : timezone
  const options = {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    ...(displayTimezone ? { timeZone: displayTimezone } : {}),
  }

  try {
    const formatter = new Intl.DateTimeFormat(locale, options)
    const parts = formatter.formatToParts(currentTime)
    const hour = Number(parts.find((part) => part.type === 'hour')?.value)

    return {
      hour: Number.isFinite(hour) ? hour : currentTime.getHours(),
      label: formatter.format(currentTime),
      timezone: displayTimezone,
    }
  } catch {
    return {
      hour: currentTime.getHours(),
      label: new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        hourCycle: 'h23',
        minute: '2-digit',
      }).format(currentTime),
      timezone: browserTimezone,
    }
  }
}

function formatScaleSeconds(value) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  return seconds < 10 ? seconds.toFixed(1).replace(/\.0$/, '') : Math.round(seconds).toLocaleString()
}

function useSeasonalSimulatedClock(context, nextCycleAt) {
  const [clockNow, setClockNow] = useState(() => Date.now())

  useEffect(() => {
    if (!context) return undefined
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [context])

  if (!context) return null
  const baseDate = new Date(`${context?.current?.date ?? context.simulated_datetime?.slice?.(0, 10)}T00:00:00`)
  if (Number.isNaN(baseDate.getTime())) return null
  const secondsPerDay = Math.max(1, Number(context.seconds_per_day ?? 18))
  const remainingSeconds = nextCycleAt == null
    ? secondsPerDay
    : Math.max(0, (Number(nextCycleAt) - clockNow) / 1000)
  const dayProgress = Math.min(1, Math.max(0, 1 - remainingSeconds / secondsPerDay))
  baseDate.setSeconds(dayProgress * 86400)
  return baseDate
}

function weatherSummary(day, isThai) {
  const rain = Number(day?.rain ?? 0)
  const snow = Number(day?.snowfall ?? 0)
  if (snow > 0) return isThai ? `หิมะ ${snow.toFixed(1)} ซม.` : `Snow ${snow.toFixed(1)} cm`
  if (rain > 0) return isThai ? `ฝน ${rain.toFixed(1)} มม.` : `Rain ${rain.toFixed(1)} mm`
  if (Number(day?.cloud_cover ?? 0) >= 70) return isThai ? 'เมฆมาก' : 'Cloudy'
  return isThai ? 'ท้องฟ้าโปร่ง' : 'Clear'
}

function seasonalRiskLabel(day, isThai) {
  return {
    heavy_rain: isThai ? 'เตือนฝนหนัก · เตรียมวัสดุระบายน้ำ' : 'Heavy rain warning · prepare drainage',
    heat_wave: isThai ? 'เตือนคลื่นความร้อน · เตรียมผ้าบังแดด' : 'Heat wave warning · prepare shade cloth',
    strong_wind: isThai ? 'เตือนลมแรง · เตรียมแนวกันลม' : 'Strong wind warning · prepare a windbreak',
    cold_snap: isThai ? 'เตือนอากาศหนาว · เตรียมผ้าคลุมกันหนาว' : 'Cold snap warning · prepare frost cover',
  }[day?.risk] ?? ''
}

function seasonalActionLabel(action, isThai) {
  return {
    drainage: isThai ? 'ระบายน้ำ' : 'Drainage',
    shade: isThai ? 'บังแดด' : 'Shade',
    windbreak: isThai ? 'กันลม' : 'Windbreak',
    'frost-cover': isThai ? 'กันหนาว' : 'Frost cover',
  }[action] ?? action ?? ''
}

function seasonalWeatherIcon(day) {
  const code = Number(day?.weather_code ?? 0)
  const rain = Number(day?.rain ?? day?.precipitation ?? 0)
  const snow = Number(day?.snowfall ?? 0)
  const cloud = Number(day?.cloud_cover ?? 0)

  if (day?.risk === 'strong_wind') return 'wind'
  if (day?.risk === 'cold_snap' || snow > 0 || (code >= 71 && code <= 86)) return 'weatherSnow'
  if (day?.risk === 'heavy_rain' || rain >= 15 || [65, 67, 82].includes(code)) return 'weatherHeavyRain'
  if (code >= 95 || day?.risk === 'heat_wave') return day?.risk === 'heat_wave' ? 'lightMode' : 'weatherStorm'
  if (rain > 0 || (code >= 51 && code <= 63) || (code >= 80 && code <= 81)) return 'weatherRain'
  if ([45, 48].includes(code)) return 'weatherFog'
  if (cloud >= 75 || code === 3) return 'weatherCloud'
  if (cloud >= 25 || code === 2) return 'weatherCloudSun'
  return 'lightMode'
}

function seasonalWeatherIconClass(day) {
  const icon = seasonalWeatherIcon(day)
  if (icon === 'weatherStorm' || day?.risk === 'heat_wave') return 'text-amber-300'
  if (icon === 'weatherSnow') return 'text-sky-100'
  if (icon === 'weatherRain' || icon === 'weatherHeavyRain') return 'text-sky-300'
  if (icon === 'wind') return 'text-cyan-200'
  if (icon === 'lightMode') return 'text-amber-200'
  return 'text-slate-200'
}

function SeasonalStatusPanel({ context, plantSelected, simulatedTime, solarLighting }) {
  const language = useCurrentAppLanguage()
  const isThai = language === 'th'
  const day = context?.current ?? {}
  const forecast = Array.isArray(context?.forecast) ? context.forecast : []
  const seasonLabel = localSeasonLabel(context?.season_key ?? day.season_key, language)
  const seasonIcon = localSeasonIcon(context?.season_key ?? day.season_key)
  const dateLabel = day?.date
    ? new Intl.DateTimeFormat(isThai ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${day.date}T12:00:00`))
    : '—'
  const timeLabel = simulatedTime
    ? new Intl.DateTimeFormat(isThai ? 'th-TH' : 'en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(simulatedTime)
    : '—'
  const nextSeason = context?.next_season
  const nextSeasonLabel = nextSeason
    ? `${localSeasonLabel(nextSeason.season_key, language)} · ${nextSeason.starts_in_days} ${isThai ? 'วัน' : 'days'}`
    : isThai ? 'อยู่ในฤดูกาลสุดท้ายของ Timeline' : 'Final season in timeline'

  return (
    <section className="seasonal-status-panel pointer-events-none min-w-0 flex-[1_1_610px] overflow-hidden rounded-xl border border-emerald-100/20 bg-[#0b1510]/95 text-slate-100 shadow-[0_16px_40px_rgba(0,0,0,.4)] backdrop-blur-md" aria-label={isThai ? 'ข้อมูลการปลูกตามฤดูกาล' : 'Seasonal Journey status'}>
      <div className="grid grid-cols-[1.18fr_.72fr_1fr] divide-x divide-emerald-100/10">
        <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-emerald-200/15 bg-emerald-300/10 text-emerald-200" aria-hidden="true">
            <AppIcon className="h-4 w-4" name={seasonIcon} />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-black uppercase tracking-[0.12em] text-emerald-200/75">{isThai ? 'ฤดูกาลปัจจุบัน' : 'Current season'}</span>
            <strong className="mt-0.5 block whitespace-nowrap text-base leading-tight text-lime-50">{seasonLabel}</strong>
            <span className="block truncate text-[11px] text-slate-300">{dateLabel} · {weatherSummary(day, isThai)}</span>
          </span>
        </div>
        <div className="flex min-w-0 flex-col items-center justify-center px-3 py-2 text-center">
          <span className={`grid h-6 w-6 place-items-center rounded-full ${solarLighting.isDay ? 'bg-amber-200/10 text-amber-200' : 'bg-sky-200/10 text-sky-200'}`}>
            <AppIcon className="h-3.5 w-3.5" name={solarLighting.isDay ? 'lightMode' : 'darkMode'} />
          </span>
          <strong className="mt-1 text-lg leading-none text-white">{timeLabel}</strong>
          <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">{solarLighting.isDay ? (isThai ? 'กลางวัน' : 'Daytime') : (isThai ? 'กลางคืน' : 'Nighttime')}</span>
        </div>
        <div className="min-w-0 px-3 py-2.5 text-right">
          <span className="text-[11px] font-black uppercase tracking-[0.12em] text-cyan-200/75">{isThai ? 'ความคืบหน้า' : 'Journey progress'}</span>
          <strong className="mt-0.5 block truncate text-sm text-cyan-50">{plantSelected ? `${context?.calendar_day ?? 0} ${isThai ? 'วันปฏิทิน' : 'calendar days'}` : '—'}</strong>
          <span className="block truncate text-[11px] text-slate-300">{Number(context?.biological_days ?? 0).toFixed(1)} {isThai ? 'วันเติบโตสะสม' : 'biological days'}</span>
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-emerald-100/10 bg-black/20 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-100">
          <AppIcon className="h-3 w-3" name="clock" />
          <span>{context?.seconds_per_day ?? 18} {isThai ? 'วินาที = 1 วันจำลอง' : 'seconds = 1 simulated day'}</span>
        </div>
        <div className="flex min-w-0 justify-center gap-1.5 overflow-hidden" aria-label={isThai ? 'พยากรณ์ 5 วันจำลอง' : 'Five simulated day forecast'}>
          {forecast.slice(0, 5).map((forecastDay) => (
            <span key={forecastDay.date} className={`grid min-w-[42px] grid-cols-[auto_auto] items-center justify-center gap-x-1 rounded-md border px-1.5 py-1 text-center text-[10px] ${forecastDay.risk ? 'border-amber-300/45 bg-amber-300/10' : 'border-white/[0.06] bg-white/[0.035]'}`} title={`${forecastDay.date} · ${weatherSummary(forecastDay, isThai)}${forecastDay.risk ? ` · ${seasonalRiskLabel(forecastDay, isThai)} · ${seasonalActionLabel(forecastDay.recommended_action, isThai)}` : ''}`}>
              <AppIcon className={`h-4 w-4 ${seasonalWeatherIconClass(forecastDay)}`} name={seasonalWeatherIcon(forecastDay)} />
              <b className="text-lime-50">{Math.round(Number(forecastDay.temperature_mean ?? 0))}°</b>
            </span>
          ))}
        </div>
        <div className="min-w-0 text-right text-[11px] leading-4 text-slate-300" title={context?.[isThai ? 'source_label_th' : 'source_label_en']}>
          <span className="block max-w-[220px] truncate font-semibold text-emerald-100">{context?.[isThai ? 'source_label_th' : 'source_label_en'] ?? '—'}</span>
          <span className="block max-w-[220px] truncate">{isThai ? 'ฤดูถัดไป: ' : 'Next: '}{nextSeasonLabel}</span>
        </div>
      </div>
    </section>
  )
}

function OutdoorStatusPanel({ outdoorReadings, plantSelected, simulationVisual, solarLighting, weatherStatus = 'idle' }) {
  const language = getAppLanguage()
  const isThai = language === 'th'
  const estimate = getRealGrowthEstimate(simulationVisual)
  const isDay = outdoorReadings?.isDay ?? solarLighting.isDay
  const outdoorClock = getOutdoorClock(solarLighting.currentTime, outdoorReadings?.timezone, language)
  const dailyRain = Number(outdoorReadings?.dailyRain ?? outdoorReadings?.rain ?? 0)
  const rainNow = Number(outdoorReadings?.rain ?? 0)
  const rainProbability = outdoorReadings?.rainProbability
  const secondsPerDay = estimate.currentSecondsPerRealDay ?? estimate.normalSecondsPerRealDay
  const weatherReady = Boolean(outdoorReadings)
  const rainLabel = !weatherReady
    ? weatherStatus === 'error'
      ? isThai ? 'ไม่มีข้อมูลอากาศ' : 'Weather unavailable'
      : isThai ? 'กำลังโหลดอากาศ' : 'Loading weather'
    : rainNow > 0
      ? isThai ? 'ฝนกำลังตก' : 'Raining now'
      : dailyRain > 0
        ? isThai ? 'วันนี้มีฝน' : 'Rain today'
        : isThai ? 'วันนี้ไม่มีฝน' : 'No rain today'
  const dayPhase = !isDay
    ? isThai ? 'กลางคืน' : 'Nighttime'
    : outdoorClock.hour < 12
      ? isThai ? 'ช่วงเช้า' : 'Morning'
      : outdoorClock.hour < 17
        ? isThai ? 'ช่วงกลางวัน' : 'Daytime'
        : isThai ? 'ช่วงเย็น' : 'Evening'

  return (
    <section
      className="outdoor-status-panel pointer-events-none min-w-0 flex-[0_1_400px] overflow-hidden rounded-xl border border-lime-100/20 bg-[#0c130f]/94 text-slate-100 shadow-[0_16px_40px_rgba(0,0,0,.4)] backdrop-blur-md"
      aria-label={isThai ? 'สถานะโหมดกลางแจ้ง' : 'Outdoor mode status'}
      aria-live="polite"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
        <div className="flex min-w-0 flex-col justify-center px-4 py-3">
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-lime-100/55">{isThai ? 'วันเติบโต' : 'Growth day'}</span>
          <strong className="mt-0.5 truncate text-base leading-tight text-lime-50">
            {plantSelected ? `${formatRealDays(estimate.equivalentDays)} / ~${formatRealDays(estimate.maturityDays)}` : '—'}
          </strong>
          <span className="mt-0.5 truncate text-[10px] text-slate-400">{plantSelected ? (isThai ? 'วันเทียบชีวิตจริง' : 'real-life equivalent') : (isThai ? 'ยังไม่ได้เลือกพืช' : 'No plant selected')}</span>
        </div>

        <div className="flex min-w-[118px] flex-col items-center justify-center border-x border-lime-100/10 bg-white/[0.025] px-3 py-2.5 text-center">
          <span className={`grid h-7 w-7 place-items-center rounded-full ${isDay ? 'bg-amber-200/10 text-amber-200' : 'bg-sky-200/10 text-sky-200'}`}>
            <AppIcon className="h-4 w-4" name={isDay ? 'lightMode' : 'darkMode'} />
          </span>
          <time
            className="mt-1 text-xl font-black leading-none tracking-tight text-white"
            dateTime={solarLighting.currentTime.toISOString()}
            title={outdoorClock.timezone ?? undefined}
          >
            {outdoorClock.label}
          </time>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{dayPhase}</span>
        </div>

        <div className="flex min-w-0 flex-col justify-center px-4 py-3 text-right">
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-sky-100/55">{isThai ? 'ฝนวันนี้' : 'Today’s rain'}</span>
          <strong className={`mt-0.5 truncate text-sm leading-tight ${rainNow > 0 ? 'text-sky-200' : dailyRain > 0 ? 'text-cyan-100' : 'text-lime-50'}`}>{rainLabel}</strong>
          <span className="mt-0.5 truncate text-[10px] text-slate-400">
            {weatherReady
              ? `${dailyRain.toFixed(1)} mm${rainProbability == null ? '' : ` · ${Math.round(rainProbability)}%`}`
              : '—'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-lime-100/10 bg-black/20 px-3 py-1.5 text-[10px] text-slate-300">
        <AppIcon className="h-3 w-3 text-sky-300" name="clock" />
        <span>
          {plantSelected
            ? isThai
              ? `${formatScaleSeconds(secondsPerDay)} วินาทีในเกม = 1 วันเติบโตจริง`
              : `${formatScaleSeconds(secondsPerDay)} game seconds = 1 real-life growth day`
            : isThai ? 'อัตราเวลาจะแสดงหลังเลือกพืช' : 'Time scale appears after selecting a plant'}
        </span>
      </div>
    </section>
  )
}

function ControlledGrowthStatusPanel({
  busy = false,
  locked = false,
  lockedReason = '',
  onAdvanceCycle,
  onSpeedChange,
  plantSelected,
  simulationSpeed = 1,
  simulationVisual,
}) {
  const language = useCurrentAppLanguage()
  const isThai = language === 'th'
  const estimate = getRealGrowthEstimate(simulationVisual, SIMULATION_CYCLE_SECONDS / simulationSpeed)
  const secondsPerDay = estimate.currentSecondsPerRealDay ?? estimate.normalSecondsPerRealDay
  const progress = plantSelected ? Math.min(100, Math.max(0, estimate.progressPercent)) : 0
  const controlsAvailable = Boolean(plantSelected && onSpeedChange)
  const skipDisabled = !controlsAvailable || !onAdvanceCycle || busy || locked
  const timeScaleLabel = plantSelected
    ? isThai
      ? `${formatScaleSeconds(secondsPerDay)}วิ = 1วัน`
      : `${formatScaleSeconds(secondsPerDay)}s = 1d`
    : isThai ? 'เลือกพืชก่อน' : 'Select plant'

  return (
    <section
      className="controlled-growth-status-panel min-w-0 flex-[0_0_238px] overflow-hidden rounded-xl border border-emerald-100/20 bg-[#0c1710]/94 text-slate-100 shadow-[0_16px_40px_rgba(0,0,0,.36)] backdrop-blur-md"
      aria-label={isThai ? 'ข้อมูลวันเติบโตโหมดควบคุมปัจจัย' : 'Environment control growth status'}
      aria-live="polite"
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-emerald-100/10 bg-emerald-300/10 text-emerald-200">
          <AppIcon className="h-3.5 w-3.5" name="sprout" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-100/60">
              {isThai ? 'วันเติบโต' : 'Growth day'}
            </span>
            <span className="rounded-md bg-emerald-200/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-emerald-100">
              {isThai ? 'ควบคุมปัจจัย' : 'Controlled'}
            </span>
          </div>
          <strong className="block truncate text-sm leading-tight text-lime-50">
            {plantSelected ? `${formatRealDays(estimate.equivalentDays)} / ~${formatRealDays(estimate.maturityDays)}` : '—'}
          </strong>
        </div>
      </div>

      <div className="h-0.5 bg-black/25">
        <span
          className="block h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-lime-300 transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-1 border-t border-emerald-100/10 bg-black/20 px-1.5 py-1 text-[9px] leading-tight text-slate-300">
        <span className="mr-auto inline-flex min-w-0 items-center gap-1 whitespace-nowrap" title={lockedReason || (isThai ? 'อัตราเวลาเทียบการเติบโตจริง' : 'Real-life growth time scale')}>
          <AppIcon className="h-2.5 w-2.5 text-cyan-300" name="clock" />
          {timeScaleLabel}
        </span>
        {controlsAvailable && [1, 2, 4].map((speed) => (
          <button
            key={speed}
            type="button"
            aria-label={isThai ? `ใช้ความเร็ว x${speed}` : `Use x${speed} speed`}
            aria-pressed={simulationSpeed === speed}
            className={`pointer-events-auto h-6 min-w-7 rounded-md border px-1 font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${simulationSpeed === speed ? 'border-lime-200/50 bg-lime-300 text-[#0b120d]' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-lime-200/30 hover:text-lime-100'} disabled:cursor-not-allowed disabled:opacity-35`}
            disabled={busy || (locked && speed > 1)}
            title={locked && speed > 1 ? lockedReason : ''}
            onClick={() => onSpeedChange(speed)}
          >
            x{speed}
          </button>
        ))}
        {controlsAvailable && (
          <button
            type="button"
            className="pointer-events-auto inline-flex h-6 items-center gap-1 rounded-md border border-cyan-200/20 bg-cyan-300/10 px-1.5 font-bold text-cyan-100 transition hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:opacity-35"
            disabled={skipDisabled}
            title={locked ? lockedReason : (isThai ? 'คำนวณรอบถัดไปทันที' : 'Calculate the next cycle now')}
            onClick={onAdvanceCycle}
          >
            <AppIcon className="h-2.5 w-2.5" name="panelOpen" />
            {busy ? '…' : isThai ? 'ข้าม' : 'Skip'}
          </button>
        )}
      </div>
    </section>
  )
}

export function SimulationStage({ actionState = null, awaitingFirstCycle = false, coinBurst = null, cycleStatus = 'idle', emptyGardenOwnerName = '', expBurst = null, location = null, mode = 'greenhouse', nextCycleAt = null, onAdvanceCycle, onSceneReady, onSimulationSpeedChange, outdoorReadings = null, plantSelected = false, sceneLoadKey = null, seasonalContext = null, selectedItemCursorUrl = null, onUseSelectedItem, readOnly = false, resetSimulation, saveSimulation, sceneAssets = {}, shareBusy = false, shareVisibility = 'private', simulationSpeed = 1, simulationVisual, snapshotRef = null, timeControlsLocked = false, timeControlsReason = '', toggleLiveShare, weatherStatus = 'idle' }) {
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const [itemCursorPoint, setItemCursorPoint] = useState(null)
  const language = useCurrentAppLanguage()
  const isThai = language === 'th'
  const seasonalTime = useSeasonalSimulatedClock(seasonalContext, nextCycleAt)
  const solarLighting = useTimeOfDayLighting(location, mode === 'seasonal' ? seasonalTime : null)
  const isWeatherDriven = mode === 'outdoor' || mode === 'seasonal'
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
  const plantName = String(simulationVisual?.plant?.name_en ?? simulationVisual?.plant?.name_th ?? '').toLowerCase()
  const speciesScale = plantName.includes('elephant') || plantName.includes('xanthosoma') || plantName.includes('หูช้าง') ? 1.18 : 0.92
  const protectionScale = speciesScale * (0.7 + growthProgress * 0.3)
  const [plantingSurface, setPlantingSurface] = useState({ position: [0.75, -0.38, 0], radius: 0.96 })
  const handlePlantingSurface = useCallback((nextSurface) => {
    setPlantingSurface((current) => {
      const currentPosition = current?.position ?? []
      const nextPosition = nextSurface?.position ?? []
      const unchanged = currentPosition.every((value, index) => Math.abs(value - nextPosition[index]) < 0.001)
        && Math.abs((current?.radius ?? 0) - (nextSurface?.radius ?? 0)) < 0.001
      return unchanged ? current : nextSurface
    })
  }, [])
  const hasSelectedItem = Boolean(selectedItemCursorUrl) && (readOnly || !actionState || actionState.phase === 'targeting')
  const itemCursorStyle = hasSelectedItem ? { cursor: 'none' } : undefined

  useEffect(() => {
    if (plantSelected) preloadActionModels()
  }, [plantSelected])

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
        <SceneErrorBoundary
          key={`${mode}-${simulationVisual?.current_model_url ?? 'empty'}-${sceneAssets['ground.dirt']?.url ?? 'ground'}`}
          onError={() => onSceneReady?.({
            error: true,
            loadKey: sceneLoadKey,
            simulatorId: simulationVisual?.id ?? null,
          })}
        >
        <Canvas shadows camera={{ position: [0.75, 1.2, 4.8], fov: 34 }} gl={{ preserveDrawingBuffer: true, antialias: true }} onCreated={({ gl }) => { canvasRef.current = gl.domElement }}>
          <color attach="background" args={[isWeatherDriven ? '#07110b' : '#173c26']} />
          {!isWeatherDriven && (
            <>
              <ambientLight intensity={0.85} />
              <directionalLight position={[3, 5, 4]} intensity={2.9} color="#d7fff0" />
              <pointLight position={[-3, 2, 3]} intensity={1.15} color="#9bcf82" />
              <pointLight position={[4, 1, -3]} intensity={0.75} color="#7fb069" />
            </>
          )}
          <Suspense fallback={<Loading />}>
            {isWeatherDriven
              ? (
                <TimeOfDayEnvironment
                  plantSelected={plantSelected}
                  rainfall={outdoorReadings?.rain}
                  solar={solarLighting}
                />
              )
              : <Environment preset="city" />}
            <SceneEnvironment
              daylight={isWeatherDriven ? solarLighting.daylight : 1}
              dirtModelUrl={sceneAssets['ground.dirt']?.url}
              mode={mode}
              plantingAreaLabel={plantingAreaLabel}
              plantSelected={plantSelected}
              onPlantingSurface={handlePlantingSurface}
              rainfall={outdoorReadings?.rain}
              seasonKey={seasonalContext?.season_key}
              windDirection={outdoorReadings?.windDirection}
              windSpeed={outdoorReadings?.windSpeed}
            />
            {mode === 'seasonal' && <SeasonalEffects context={seasonalContext} />}
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
                <Suspense fallback={null}>
                  <ActiveCareEffects modifiers={simulationVisual?.active_modifiers ?? []} plantingSurface={plantingSurface} plantScale={protectionScale} />
                  <ActionAnimation actionState={actionState} plantingSurface={plantingSurface} plantScale={protectionScale} />
                </Suspense>
                <PlantStatusHud
                  awaitingFirstCycle={awaitingFirstCycle}
                  cycleSeconds={cycleSeconds}
                  cycleStatus={cycleStatus}
                  fertilizer={simulationVisual?.fertilizer}
                  growthPoint={growthPoint}
                  growthRate={growthRate}
                  health={health}
                  plantNeeds={simulationVisual?.plant_needs}
                  water={simulationVisual?.water}
                />
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
            <SceneReadySignal
              key={`${sceneLoadKey ?? 'normal'}-${simulationVisual?.id ?? 'empty'}-${simulationVisual?.current_model_url ?? 'model'}-${mode}`}
              loadKey={sceneLoadKey}
              onReady={onSceneReady}
              simulatorId={simulationVisual?.id}
            />
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
            className="pointer-events-none absolute z-40 h-20 w-20 -translate-x-4 -translate-y-4 select-none object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,.42)] sm:h-24 sm:w-24"
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
        <div
          className={`simulation-guidance-cluster simulation-guidance-cluster--${isWeatherDriven ? 'outdoor' : 'controlled'} ${readOnly ? 'simulation-guidance-cluster--readonly' : ''}`}
          data-tour="simulation-guidance"
        >
          {mode === 'seasonal' ? (
            <SeasonalStatusPanel
              context={seasonalContext}
              plantSelected={plantSelected}
              simulatedTime={seasonalTime}
              solarLighting={solarLighting}
            />
          ) : mode === 'outdoor' ? (
            <OutdoorStatusPanel
              outdoorReadings={outdoorReadings}
              plantSelected={plantSelected}
              simulationVisual={simulationVisual}
              solarLighting={solarLighting}
              weatherStatus={weatherStatus}
            />
          ) : (
            <ControlledGrowthStatusPanel
              busy={cycleStatus === 'updating' || ['animating', 'applying'].includes(actionState?.phase)}
              locked={timeControlsLocked}
              lockedReason={timeControlsReason}
              onAdvanceCycle={readOnly ? null : onAdvanceCycle}
              onSpeedChange={readOnly ? null : onSimulationSpeedChange}
              plantSelected={plantSelected}
              simulationSpeed={simulationSpeed}
              simulationVisual={simulationVisual}
            />
          )}
          {plantSelected && !readOnly && (
            <PlantRecommendationBanner
              awaitingFirstCycle={awaitingFirstCycle}
              nextCycleAt={nextCycleAt}
              simulationVisual={simulationVisual}
            />
          )}
        </div>
        {!readOnly && plantSelected && <div className="lab-simulation-actions absolute bottom-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-lime-100/15 bg-[#101511]/90 p-1.5 shadow-[0_8px_18px_rgba(0,0,0,.32)]" data-tour="lab-actions" data-i18n-skip="true" aria-label={isThai ? 'คำสั่งการจำลอง' : 'Simulation actions'}>
          <button
            className="box-border inline-flex min-h-12 items-center gap-2 rounded-full border border-lime-100/15 bg-white/[0.035] px-4 py-2 text-sm font-medium leading-5 text-slate-200 shadow-xs transition hover:bg-white/[0.075] hover:text-lime-50 focus:outline-none focus:ring-4 focus:ring-lime-100/10"
            type="button"
            onClick={resetSimulation}
          >
            <img className="h-8 w-8 shrink-0 rounded-full border border-lime-100/15 object-cover shadow-[0_2px_6px_rgba(0,0,0,.28)]" src={imageAssets.uproot} alt="" draggable="false" />
            {isThai ? 'ถอนต้น' : 'Uproot'}
          </button>
          <button
            className="box-border inline-flex min-h-12 items-center gap-2 rounded-full border border-transparent bg-[#9bcf82] px-4 py-2 text-sm font-medium leading-5 text-[#101511] shadow-xs transition enabled:hover:bg-[#addf96] focus:outline-none focus:ring-4 focus:ring-[#9bcf82]/25 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-200 disabled:opacity-80"
            type="button"
            onClick={saveSimulation}
            disabled={!isMature}
            aria-describedby={!isMature ? 'harvest-requirement' : undefined}
            title={!isMature
              ? isThai
                ? `เก็บเกี่ยวได้เมื่อเติบโต 100% (ปัจจุบัน ${Math.round(growthPoint)}%)`
                : `Harvest unlocks at 100% growth (currently ${Math.round(growthPoint)}%).`
              : isThai ? 'เก็บเกี่ยวและบันทึกลงประวัติ' : 'Harvest and save to history'}
          >
            <img className="h-8 w-8 shrink-0 rounded-full border border-[#101511]/15 object-cover shadow-[0_2px_6px_rgba(0,0,0,.22)]" src={imageAssets.harvest} alt="" draggable="false" />
            {isThai ? 'เก็บเกี่ยว' : 'Harvest'}
          </button>
          <button
            className={`box-border inline-flex min-h-12 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold leading-5 shadow-xs transition focus:outline-none focus:ring-4 focus:ring-lime-100/10 ${shareVisibility === 'private' ? 'border-lime-100/15 bg-white/[0.035] text-slate-200 hover:bg-white/[0.075] hover:text-lime-50' : 'border-red-300/30 bg-red-300/10 text-red-100 hover:bg-red-300/15'}`}
            type="button"
            onClick={toggleLiveShare}
            disabled={shareBusy}
            aria-label={shareVisibility === 'private'
              ? isThai ? 'เริ่มแชร์แบบสด' : 'Start live sharing'
              : isThai ? 'หยุดแชร์แบบสด' : 'Stop live sharing'}
            aria-pressed={shareVisibility !== 'private'}
            title={shareVisibility === 'private'
              ? isThai ? 'แชร์สวนนี้แบบสดในชุมชน' : 'Share this garden live in Community'
              : isThai ? 'หยุดแชร์สวนแบบสดนี้' : 'Stop sharing this live garden'}
          >
            <span className="relative grid h-6 w-6 place-items-center">
              <AppIcon className={`h-4 w-4 ${shareBusy ? 'animate-pulse' : ''}`} name="live" />
              <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-[#101511] ${shareVisibility === 'private' ? 'bg-slate-500' : 'bg-red-500'}`} aria-hidden="true" />
            </span>
            <span>{shareBusy
              ? isThai ? 'กำลังอัปเดต…' : 'Updating…'
              : shareVisibility === 'private'
                ? isThai ? 'เริ่มแชร์สด' : 'Go live'
                : isThai ? 'กำลังแชร์สด' : 'Live'}</span>
          </button>
          {!isMature && <span className="sr-only" id="harvest-requirement">{isThai ? 'สามารถเก็บเกี่ยวได้เมื่อพืชเติบโตถึง 100 เปอร์เซ็นต์' : 'Harvest is available when plant growth reaches 100 percent.'}</span>}
        </div>}
      </section>
  )
}




