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
    <strong className="environment-value">
      <span>{displayValue}</span>
      <small>{climateUnits[climateKey]}</small>
    </strong>
  )
}

function ClimateControl({ climateKey, value, onChange, compact = false, disabled = false, language = 'en', tile = false }) {
  const icon = climateIcons[climateKey] ?? climateIcons.temp
  const label = climateLabels[climateKey]?.[language] ?? climateLabels[climateKey]?.en ?? climateKey
  const layout = compact ? 'grid-cols-[26px_34px_minmax(72px,1fr)_56px] sm:grid-cols-[28px_38px_minmax(78px,1fr)_60px]' : 'grid-cols-[26px_72px_minmax(52px,1fr)_50px]'
  const isTemperature = climateKey === 'temp' || climateKey === 'soilTemp'
  const rangeProgress = isTemperature ? (Number(value) / 45) * 100 : Number(value)
  const range = (
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
  )

  if (tile) {
    return (
      <label className={`environment-control-card ${disabled ? 'is-disabled' : ''}`}>
        <span className="environment-control-card__heading">
          <MetricIcon className={climateKey === 'soilTemp' ? 'h-6 w-6 rounded-[4px]' : ''} type={icon.icon} color={icon.color} imageUrl={icon.imageUrl} label={`${label} icon`} size="sm" />
          <span>{label}</span>
          <ClimateValue climateKey={climateKey} value={value} />
        </span>
        {range}
      </label>
    )
  }

  return (
    <label className={`grid ${layout} items-center gap-1.5 text-xs text-slate-300 ${disabled ? 'opacity-55' : ''}`}>
      <MetricIcon className={climateKey === 'soilTemp' ? 'h-6 w-6 rounded-[4px]' : ''} type={icon.icon} color={icon.color} imageUrl={icon.imageUrl} label={`${label} icon`} size="sm" />
      <span className="whitespace-nowrap text-xs">{label}</span>
      {range}
      <ClimateValue climateKey={climateKey} value={value} />
    </label>
  )
}

function WeatherReading({ icon, color, imageUrl, label, value }) {
  return (
    <div className="environment-reading-card">
      <MetricIcon className={label === 'Soil temp' ? 'h-6 w-6 rounded-[4px]' : ''} type={icon} color={color} imageUrl={imageUrl} label={`${label} icon`} size="sm" />
      <span className="environment-reading-card__label" title={label}>{label}</span>
      <strong className="environment-reading-card__value">{value}</strong>
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
      icon: 'wind',
      color: climateIcons.air.color,
      imageUrl: null,
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

export function EnvironmentPanel({ climate, windows, setWindows, mode = 'greenhouse', onApplyFactors, actionPhase = 'idle', onRefreshLocation, onTransferLocation, outdoorWeather, plantSelected = true, presentation = 'floating', hideHeader = false, contextual = false, readOnly = false }) {
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
  const [notesOpen, setNotesOpen] = useState(false)
  const draftClimate = useMemo(() => ({ ...climate, ...pendingClimate }), [climate, pendingClimate])
  const changes = useMemo(() => Object.fromEntries(controlKeys
    .filter((key) => Object.hasOwn(pendingClimate, key) && Number(pendingClimate[key]) !== Number(climate[key]))
    .map((key) => [key, Number(pendingClimate[key])])), [climate, controlKeys, pendingClimate])
  const hasChanges = Object.keys(changes).length > 0
  const actionBusy = ['animating', 'applying'].includes(actionPhase)
  const primaryNote = plantSelected
    ? (isWeatherMode
      ? (isSeasonal
        ? (isThai ? 'ฤดูกาลและวันจำลองเดินอัตโนมัติ ดูแลปกติด้วยน้ำและปุ๋ย ส่วนอุปกรณ์ฉุกเฉินจะเปิดเมื่อมีคำเตือนที่ตรงกัน' : 'The seasonal calendar advances automatically. Water and fertilize normally; emergency tools unlock only for matching warnings.')
        : (isThai ? 'ระบบใช้อากาศจริงอัตโนมัติ เลือกไอเทมจากคลังเพื่อดูแลหรือปกป้องพืช' : 'Real weather is applied automatically. Use inventory items to protect or care for the plant.'))
      : (isThai ? 'น้ำและธาตุอาหารจะแสดงเป็นหลอดความต้องการของพืช ใช้บัวรดน้ำหรือปุ๋ยจากคลัง ส่วนปัจจัยอื่นปรับค่าแล้วกดยืนยันการใช้งาน' : 'Water and nutrients are plant-need reserves. Use watering and fertilizer items; adjust the other factors, then confirm the changes.'))
    : (isThai ? 'เลือกพืชก่อน ระบบควบคุมสภาพแวดล้อมจะเปิดเมื่อเริ่มการจำลอง' : 'Select a plant first. Environment controls unlock when the simulation starts.')
  const careNote = isSeasonal
    ? (isThai ? 'ใช้น้ำและปุ๋ยได้ตามปกติ อุปกรณ์ระบายน้ำ บังแดด กันลม และกันหนาวจะใช้ได้เมื่อ Timeline แจ้งเหตุที่ตรงกันเท่านั้น' : 'Water and fertilizer remain available. Drainage, shade, windbreak and frost protection unlock only for matching timeline warnings.')
    : (isThai ? 'เลือกไอเทมดูแลจากคลัง โดยฝน ลม และแสงอาทิตย์จริงไม่สามารถเปลี่ยนด้วยตัวเลื่อนได้' : 'Choose care items from inventory. Real rain, wind, and sunlight cannot be changed with sliders.')

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
      presentation={presentation}
      hideHeader={hideHeader}
      className={presentation === 'docked' ? '' : (isWeatherMode ? 'w-[390px] max-w-[calc(100vw-32px)]' : 'w-[520px] max-w-[calc(100vw-32px)]')}
    >
      <div className={isWeatherMode && !contextual ? 'max-h-[186px] overflow-y-auto pr-1 sm:max-h-[330px]' : ''}>
        <div className="environment-note-disclosure">
          <button type="button" aria-expanded={notesOpen} onClick={() => setNotesOpen((current) => !current)}>
            <AppIcon name="bookmark" />
            <span>{notesOpen ? (isThai ? 'ซ่อนหมายเหตุ' : 'Hide notes') : (isThai ? 'อ่านหมายเหตุ' : 'Read notes')}</span>
            <AppIcon className={notesOpen ? 'is-open' : ''} name="arrowDown" />
          </button>
          {notesOpen && (
            <div className={`environment-note-disclosure__content ${plantSelected ? '' : 'is-warning'}`}>
              <p>{primaryNote}</p>
              {isWeatherMode && plantSelected && <p><strong>{isSeasonal ? (isThai ? 'การดูแลตามฤดูกาล' : 'Seasonal care') : (isThai ? 'การดูแลกลางแจ้ง' : 'Outdoor care')}</strong>{careNote}</p>}
            </div>
          )}
        </div>

        <div className={`environment-control-grid ${contextual ? 'is-contextual' : ''}`}>
          {controlKeys.map((key) => (
            <ClimateControl key={key} climateKey={key} value={draftClimate[key]} onChange={updateClimate} compact={isWeatherMode || contextual} disabled={!plantSelected || actionBusy || readOnly} language={language} tile={contextual} />
          ))}
        </div>

        {!isWeatherMode && plantSelected && !readOnly && (
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

        {isWeatherMode && (
          <div className={`environment-weather-block ${contextual ? 'is-contextual' : ''}`}>
            <div className="environment-weather-block__header">
              <div className="environment-weather-block__location">
                <strong>{isThai ? 'สถานที่ปลูก' : 'Address'}</strong>
                <span title={formatLocation(outdoorWeather?.addressLabel, outdoorWeather?.status, isThai)}>{formatLocation(outdoorWeather?.addressLabel, outdoorWeather?.status, isThai)}</span>
              </div>
              <div className="environment-weather-block__actions">
                {outdoorWeather?.location && (
                  <span className={`rounded-md px-2 py-1 text-sm font-bold uppercase tracking-wide ${outdoorWeather.location.source === 'fallback' ? 'bg-amber-300/10 text-amber-100' : 'bg-lime-100/10 text-lime-100'}`}>
                    {locationSourceLabel(outdoorWeather.location.source, isThai)}
                  </span>
                )}
                {!isSeasonal && !readOnly && <button
                  className="grid h-7 w-7 place-items-center rounded-md border border-lime-100/15 bg-white/[0.035] text-slate-300 transition hover:border-lime-100/30 hover:bg-lime-100/10 hover:text-lime-100 disabled:cursor-wait disabled:opacity-50"
                  type="button"
                  onClick={onRefreshLocation}
                  disabled={outdoorWeather?.status === 'loading'}
                  aria-label={isThai ? 'รีเฟรชอากาศจากสถานที่ที่บันทึก' : 'Refresh weather from saved location'}
                  title={isThai ? 'รีเฟรชสภาพอากาศ' : 'Refresh weather'}
                >
                  <AppIcon className={`h-3.5 w-3.5 ${outdoorWeather?.status === 'loading' ? 'animate-spin' : ''}`} name="restartAlt" />
                </button>}
                {!isSeasonal && plantSelected && !readOnly && (
                  <button
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-50 px-2 text-sm font-black text-emerald-900 transition hover:bg-emerald-100"
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
              <p className="mb-2 rounded-md border border-amber-200/15 bg-amber-300/[0.06] px-2.5 py-2 text-sm leading-4 text-amber-100/85">
                {isThai ? 'ไม่สามารถใช้สิทธิ์ตำแหน่งได้ โปรดอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์ แล้วกดปุ่มรีเฟรช' : 'Location permission is unavailable. Allow location access in your browser, then press the refresh button.'}
              </p>
            )}

            <div className={`environment-reading-grid ${contextual ? 'is-contextual' : ''}`}>
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
