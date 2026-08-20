import { useMemo, useState } from 'react'
import { climateIcons } from '../data/gameData'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { MetricIcon } from '../icons/MetricIcon'
import { Panel } from '../components/Panel'
import { getOutdoorReadings } from '../utils/outdoorWeather'
import { getAppLanguage } from '../../i18n/appI18n'

const climateLabels = {
  water: { en: 'Water', th: 'น้ำ' },
  light: { en: 'Light', th: 'แสง' },
  fertilizer: { en: 'Fertilizer', th: 'ปุ๋ย' },
  soil: { en: 'Soil', th: 'ความชื้นดิน' },
  air: { en: 'Air', th: 'ความชื้นอากาศ' },
  soilTemp: { en: 'Soil temp', th: 'อุณหภูมิดิน' },
  temp: { en: 'Temp', th: 'อุณหภูมิ' },
}

const climateUnits = {
  water: 'ml',
  light: 'lx',
  fertilizer: 'g',
  soil: '%',
  air: '%RH',
  soilTemp: 'C',
  temp: 'C',
}

const outdoorControlKeys = []

function ClimateValue({ climateKey, value }) {
  const displayValue = climateKey === 'water' ? Math.round(Number(value || 0) * 10) : value

  return (
    <strong className="flex min-w-[48px] items-baseline justify-end gap-0.5 text-right text-lime-100 sm:min-w-[50px]">
      <span className="text-xs leading-none">{displayValue}</span>
      <span className="max-w-[40px] truncate text-xs leading-none text-lime-100/75 sm:max-w-[44px]">{climateUnits[climateKey]}</span>
    </strong>
  )
}

function ClimateControl({ climateKey, value, onChange, compact = false, disabled = false, language = 'en' }) {
  const icon = climateIcons[climateKey] ?? climateIcons.temp
  const label = climateLabels[climateKey]?.[language] ?? climateLabels[climateKey]?.en ?? climateKey
  const layout = compact ? 'grid-cols-[26px_34px_minmax(72px,1fr)_56px] sm:grid-cols-[28px_38px_minmax(78px,1fr)_60px]' : 'grid-cols-[26px_72px_minmax(52px,1fr)_50px]'
  const isTemperature = climateKey === 'temp' || climateKey === 'soilTemp'
  const rangeProgress = isTemperature ? (Number(value) / 45) * 100 : Number(value)

  return (
    <label className={`grid ${layout} items-center gap-1.5 text-xs text-slate-300 ${disabled ? 'opacity-55' : ''}`}>
      <MetricIcon className={climateKey === 'soilTemp' ? 'h-6 w-6 rounded-[4px]' : ''} type={icon.icon} color={icon.color} imageUrl={icon.imageUrl} label={`${label} icon`} size="sm" />
      <span className="whitespace-nowrap text-xs">{label}</span>
      <input
        className="sim-range sim-range-compact"
        style={{ '--range-progress': `${rangeProgress}%` }}
        type="range"
        min="0"
        max={isTemperature ? '45' : '100'}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(climateKey, Number(event.target.value))}
      />
      <ClimateValue climateKey={climateKey} value={value} />
    </label>
  )
}

function WeatherReading({ icon, color, imageUrl, label, value }) {
  return (
    <div className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-lime-100/10 bg-black/20 px-2.5 py-2 text-xs text-slate-300">
      <MetricIcon className={label === 'Soil temp' ? 'h-6 w-6 rounded-[4px]' : ''} type={icon} color={color} imageUrl={imageUrl} label={`${label} icon`} size="sm" />
      <span className="truncate">{label}</span>
      <strong className="whitespace-nowrap text-lime-100">{value}</strong>
    </div>
  )
}

function formatLocation(addressLabel, status, isThai) {
  if (status === 'loading') return isThai ? 'กำลังค้นหาสถานที่ที่บันทึกไว้' : 'Finding saved location'
  if (status === 'error') return isThai ? 'ไม่พบตำแหน่งบนแผนที่' : 'Map location not found'
  return addressLabel || (isThai ? 'ตำแหน่งที่บันทึกไว้' : 'Saved map location')
}

function buildWeatherCards(readings, isThai) {
  return [
    {
      label: isThai ? 'อุณหภูมิ' : 'Temp',
      value: readings?.temperature == null ? '--' : `${readings.temperature} C`,
      icon: climateIcons.temp.icon,
      color: climateIcons.temp.color,
      imageUrl: climateIcons.temp.imageUrl,
    },
    {
      label: isThai ? 'ความชื้นอากาศ' : 'Humidity',
      value: readings?.humidity == null ? '--' : `${readings.humidity}%RH`,
      icon: climateIcons.air.icon,
      color: climateIcons.air.color,
      imageUrl: climateIcons.air.imageUrl,
    },
    {
      label: isThai ? 'ความชื้นดิน' : 'Soil moisture',
      value: readings?.soilMoisture == null ? '--' : `${readings.soilMoisture}%`,
      icon: climateIcons.soil.icon,
      color: climateIcons.soil.color,
      imageUrl: climateIcons.soil.imageUrl,
    },
    {
      label: isThai ? 'อุณหภูมิดิน' : 'Soil temp',
      value: readings?.soilTemp == null ? '--' : `${readings.soilTemp} C`,
      icon: climateIcons.soilTemp.icon,
      color: climateIcons.soilTemp.color,
      imageUrl: climateIcons.soilTemp.imageUrl,
    },
    {
      label: isThai ? 'ปริมาณฝน' : 'Rain',
      value: readings?.rain == null ? '--' : `${readings.rain} mm`,
      icon: climateIcons.water.icon,
      color: climateIcons.water.color,
      imageUrl: climateIcons.water.imageUrl,
    },
    {
      label: isThai ? 'ความเร็วลม' : 'Wind',
      value: readings?.windSpeed == null
        ? '--'
        : `${Math.round(readings.windSpeed)} km/h`,
      icon: climateIcons.air.icon,
      color: climateIcons.air.color,
      imageUrl: climateIcons.air.imageUrl,
    },
    {
      label: isThai ? 'ช่วงเวลา' : 'Time',
      value: readings ? (readings.isDay ? (isThai ? 'กลางวัน' : 'Day') : (isThai ? 'กลางคืน' : 'Night')) : '--',
      icon: climateIcons.light.icon,
      color: climateIcons.light.color,
      imageUrl: climateIcons.light.imageUrl,
    },
  ]
}

function locationSourceLabel(source, isThai) {
  if (source === 'browser') return isThai ? 'ปัจจุบัน' : 'current'
  if (source === 'saved') return isThai ? 'บันทึกแล้ว' : 'saved'
  if (source === 'simulation') return isThai ? 'บันทึกแล้ว' : 'saved'
  if (source === 'fallback') return isThai ? 'สำรอง' : 'fallback'
  return ''
}

export function EnvironmentPanel({ climate, windows, setWindows, mode = 'greenhouse', onApplyFactors, actionPhase = 'idle', onRefreshLocation, onTransferLocation, outdoorWeather, plantSelected = true }) {
  const language = getAppLanguage()
  const isThai = language === 'th'
  const isOutdoor = mode === 'outdoor'
  const isSeasonal = mode === 'seasonal'
  const isWeatherMode = isOutdoor || isSeasonal
  // Water and fertilizer are consumable reserves managed through care items,
  // not arbitrary environment sliders.
  const controlKeys = isWeatherMode ? outdoorControlKeys : Object.keys(climate).filter((key) => !['water', 'fertilizer'].includes(key))
  const outdoorReadings = getOutdoorReadings(outdoorWeather?.forecast)
  const weatherCards = buildWeatherCards(outdoorReadings, isThai)
  const [pendingClimate, setPendingClimate] = useState({})
  const draftClimate = useMemo(() => ({ ...climate, ...pendingClimate }), [climate, pendingClimate])
  const changes = useMemo(() => Object.fromEntries(controlKeys
    .filter((key) => Object.hasOwn(pendingClimate, key) && Number(pendingClimate[key]) !== Number(climate[key]))
    .map((key) => [key, Number(pendingClimate[key])])), [climate, controlKeys, pendingClimate])
  const hasChanges = Object.keys(changes).length > 0
  const actionBusy = ['animating', 'applying'].includes(actionPhase)

  function updateClimate(key, value) {
    setPendingClimate((current) => {
      if (Number(value) === Number(climate[key])) {
        const next = { ...current }
        delete next[key]
        return next
      }
      return { ...current, [key]: value }
    })
  }

  return (
    <Panel
      id="climate"
      title={isSeasonal ? (isThai ? 'สภาพอากาศตามฤดูกาล' : 'Seasonal environment') : isOutdoor ? (isThai ? 'สภาพแวดล้อมกลางแจ้ง' : 'Outdoor environment') : (isThai ? 'สภาพแวดล้อม' : 'Environment')}
      subtitle={isSeasonal ? (isThai ? 'Timeline ที่บันทึกจากข้อมูลอากาศจริง' : 'saved timeline from real weather data') : isOutdoor ? (isThai ? 'ข้อมูลอากาศจริงจาก Open-Meteo' : 'weather data from Open-Meteo') : (isThai ? 'แสง ความชื้น และอุณหภูมิ' : 'light humidity and temperature')}
      windows={windows}
      setWindows={setWindows}
      className={isWeatherMode ? 'w-[390px] max-w-[calc(100vw-32px)]' : 'w-[520px] max-w-[calc(100vw-32px)]'}
    >
      <div className={isWeatherMode ? 'max-h-[186px] overflow-y-auto pr-1 sm:max-h-[330px]' : ''}>
        <div className={`mb-3 rounded-md border px-3 py-2 text-xs leading-4 ${plantSelected ? 'border-lime-100/10 bg-[#9bcf82]/[0.07] text-slate-300' : 'border-amber-200/15 bg-amber-300/[0.07] text-amber-100'}`}>
          {plantSelected
            ? (isWeatherMode
              ? (isSeasonal
                ? (isThai ? 'ฤดูกาลและวันจำลองเดินอัตโนมัติ ดูแลปกติด้วยน้ำและปุ๋ย ส่วนอุปกรณ์ฉุกเฉินจะเปิดเมื่อมีคำเตือนที่ตรงกัน' : 'The seasonal calendar advances automatically. Water and fertilize normally; emergency tools unlock only for matching warnings.')
                : (isThai ? 'ระบบใช้อากาศจริงอัตโนมัติ เลือกไอเทมจากคลังเพื่อดูแลหรือปกป้องพืช' : 'Real weather is applied automatically. Use inventory items to protect or care for the plant.'))
              : (isThai ? 'น้ำและธาตุอาหารจะแสดงเป็นหลอดความต้องการของพืช ใช้บัวรดน้ำหรือปุ๋ยจากคลัง ส่วนปัจจัยอื่นปรับค่าแล้วกดยืนยันการใช้งาน' : 'Water and nutrients are plant-need reserves. Use watering and fertilizer items; adjust the other factors, then confirm the changes.'))
            : (isThai ? 'เลือกพืชก่อน ระบบควบคุมสภาพแวดล้อมจะเปิดเมื่อเริ่มการจำลอง' : 'Select a plant first. Environment controls unlock when the simulation starts.')}
        </div>
        <div className={`grid gap-x-3 gap-y-3 ${isWeatherMode ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {controlKeys.map((key) => (
            <ClimateControl key={key} climateKey={key} value={draftClimate[key]} onChange={updateClimate} compact={isWeatherMode} disabled={!plantSelected || actionBusy} language={language} />
          ))}
        </div>

        {!isWeatherMode && plantSelected && (
          <div className={`environment-apply-bar ${hasChanges ? 'is-visible' : ''}`} aria-live="polite">
            <span>{hasChanges
              ? (isThai ? `รอยืนยัน ${Object.keys(changes).length} รายการ` : `${Object.keys(changes).length} pending ${Object.keys(changes).length === 1 ? 'change' : 'changes'}`)
              : (isThai ? 'ไม่มีค่าที่รอยืนยัน' : 'No pending changes')}</span>
            <button type="button" disabled={!hasChanges || actionBusy} onClick={async () => {
              const applied = await onApplyFactors?.(changes)
              if (applied !== false) {
                setPendingClimate({})
              }
            }}>
              <AppIcon name={actionBusy ? 'live' : 'save'} />
              {actionBusy ? (isThai ? 'กำลังใช้งาน…' : 'Applying…') : (isThai ? 'ยืนยันการใช้งาน' : 'Confirm changes')}
            </button>
          </div>
        )}

        {isWeatherMode && plantSelected && (
          <div className="mb-3 rounded-lg border border-emerald-600/20 bg-emerald-50/80 px-3 py-2.5 text-xs leading-5 text-emerald-950 shadow-sm">
            <strong className="block">{isSeasonal ? (isThai ? 'โหมดฤดูกาลใช้การดูแลตามสถานการณ์' : 'Seasonal care follows current conditions') : (isThai ? 'โหมดกลางแจ้งใช้ไอเทมจากคลัง' : 'Outdoor care uses inventory items')}</strong>
            <span>{isSeasonal ? (isThai ? 'ใช้น้ำและปุ๋ยได้ตามปกติ อุปกรณ์ระบายน้ำ บังแดด กันลม และกันหนาวจะใช้ได้เมื่อ Timeline แจ้งเหตุที่ตรงกันเท่านั้น' : 'Water and fertilizer remain available. Drainage, shade, windbreak and frost protection unlock only for matching timeline warnings.') : (isThai ? 'เลือกน้ำ ปุ๋ย วัสดุระบายน้ำ ผ้าบังแดด แนวกันลม วัสดุป้องกันความเย็น หรือไอเทมกำจัดศัตรูพืชจากคลัง โดยไม่สามารถเปลี่ยนฝน ลม และแสงอาทิตย์จริงด้วย Slider ได้' : 'Choose water, fertilizer, drainage, shade, windbreak, frost cover, or pest treatment from Lab assets. Real rain, wind, and sunlight cannot be changed with sliders.')}</span>
          </div>
        )}

        {isWeatherMode && (
          <div className="mt-3 rounded-md border border-lime-100/10 bg-[#0b0f0c]/70 p-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <strong className="block text-xs leading-4 text-lime-50">{isThai ? 'สถานที่ปลูก' : 'Address'}</strong>
                <span className="mt-0.5 block truncate text-xs leading-4 text-slate-400">{formatLocation(outdoorWeather?.addressLabel, outdoorWeather?.status, isThai)}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {outdoorWeather?.location && (
                  <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${outdoorWeather.location.source === 'fallback' ? 'bg-amber-300/10 text-amber-100' : 'bg-lime-100/10 text-lime-100'}`}>
                    {locationSourceLabel(outdoorWeather.location.source, isThai)}
                  </span>
                )}
                {!isSeasonal && <button
                  className="grid h-7 w-7 place-items-center rounded-md border border-lime-100/15 bg-white/[0.035] text-slate-300 transition hover:border-lime-100/30 hover:bg-lime-100/10 hover:text-lime-100 disabled:cursor-wait disabled:opacity-50"
                  type="button"
                  onClick={onRefreshLocation}
                  disabled={outdoorWeather?.status === 'loading'}
                  aria-label={isThai ? 'รีเฟรชอากาศจากสถานที่ที่บันทึก' : 'Refresh weather from saved location'}
                  title={isThai ? 'รีเฟรชสภาพอากาศ' : 'Refresh weather'}
                >
                  <AppIcon className={`h-3.5 w-3.5 ${outdoorWeather?.status === 'loading' ? 'animate-spin' : ''}`} name="restartAlt" />
                </button>}
                {!isSeasonal && plantSelected && (
                  <button
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-50 px-2 text-[10px] font-black text-emerald-900 transition hover:bg-emerald-100"
                    type="button"
                    onClick={onTransferLocation}
                  >
                    <AppIcon className="h-3 w-3" name="location" />
                    {isThai ? 'ย้ายสถานที่' : 'Transfer'}
                  </button>
                )}
              </div>
            </div>

            {!isSeasonal && outdoorWeather?.location?.source === 'fallback' && (
              <p className="mb-2 rounded-md border border-amber-200/15 bg-amber-300/[0.06] px-2.5 py-2 text-[10px] leading-4 text-amber-100/85">
                {isThai ? 'ไม่สามารถใช้สิทธิ์ตำแหน่งได้ โปรดอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์ แล้วกดปุ่มรีเฟรช' : 'Location permission is unavailable. Allow location access in your browser, then press the refresh button.'}
              </p>
            )}

            <div className="grid grid-cols-1 gap-2">
              {weatherCards.map((item) => (
                <WeatherReading key={item.label} icon={item.icon} color={item.color} imageUrl={item.imageUrl} label={item.label} value={item.value} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
