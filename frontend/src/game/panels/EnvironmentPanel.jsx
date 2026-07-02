import { climateIcons } from '../data/gameData'
import { MetricIcon } from '../icons/MetricIcon'
import { Panel } from '../components/Panel'
import { getOutdoorReadings } from '../utils/outdoorWeather'

const climateLabels = {
  water: 'น้ำ',
  light: 'แสง',
  fertilizer: 'ปุ๋ย',
  soil: 'ดิน',
  air: 'อากาศ',
  temp: 'อุณฯ',
}

const climateUnits = {
  water: 'มล.',
  light: 'ลักซ์',
  fertilizer: 'กรัม',
  soil: '%',
  air: '%ชื้น',
  temp: 'องศา',
}

const outdoorControlKeys = ['water', 'fertilizer']

function ClimateValue({ climateKey, value }) {
  return (
    <strong className="flex min-w-0 items-baseline justify-end gap-0.5 text-right text-lime-100">
      <span className="text-[11px] leading-none">{value}</span>
      <span className="max-w-[44px] truncate text-[9px] leading-none text-lime-100/75">{climateUnits[climateKey]}</span>
    </strong>
  )
}

function ClimateControl({ climateKey, value, onChange }) {
  const icon = climateIcons[climateKey]

  return (
    <label className="grid grid-cols-[28px_42px_minmax(78px,1fr)_64px] items-center gap-2 text-xs text-slate-300">
      <MetricIcon type={icon.icon} color={icon.color} imageUrl={icon.imageUrl} label={`${climateLabels[climateKey]} icon`} size="sm" />
      <span className="truncate">{climateLabels[climateKey]}</span>
      <input
        className="sim-range sim-range-compact"
        style={{ '--range-progress': `${value}%` }}
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(climateKey, Number(event.target.value))}
      />
      <ClimateValue climateKey={climateKey} value={value} />
    </label>
  )
}

function WeatherReading({ icon, color, imageUrl, label, value }) {
  return (
    <div className="grid grid-cols-[24px_1fr_auto] items-center gap-2 rounded-md border border-lime-100/10 bg-black/20 px-2.5 py-2 text-xs text-slate-300">
      <MetricIcon type={icon} color={color} imageUrl={imageUrl} label={`${label} icon`} size="sm" />
      <span>{label}</span>
      <strong className="text-lime-100">{value}</strong>
    </div>
  )
}

function formatLocation(addressLabel, status) {
  if (status === 'loading') return 'กำลังค้นหาที่อยู่'
  if (status === 'error') return 'ไม่พบที่อยู่จากแผนที่'
  return addressLabel || 'ตำแหน่งที่บันทึกไว้'
}

function buildWeatherCards(readings) {
  return [
    {
      label: 'อุณฯ',
      value: readings?.temperature == null ? '--' : `${readings.temperature} องศา`,
      icon: climateIcons.temp.icon,
      color: climateIcons.temp.color,
      imageUrl: climateIcons.temp.imageUrl,
    },
    {
      label: 'ชื้นอากาศ',
      value: readings?.humidity == null ? '--' : `${readings.humidity}%ชื้น`,
      icon: climateIcons.air.icon,
      color: climateIcons.air.color,
      imageUrl: climateIcons.air.imageUrl,
    },
    {
      label: 'ชื้นดิน',
      value: readings?.soilMoisture == null ? '--' : `${readings.soilMoisture}%`,
      icon: climateIcons.soil.icon,
      color: climateIcons.soil.color,
      imageUrl: climateIcons.soil.imageUrl,
    },
    {
      label: 'อุณฯ ดิน',
      value: readings?.soilTemp == null ? '--' : `${readings.soilTemp} องศา`,
      icon: climateIcons.temp.icon,
      color: climateIcons.temp.color,
      imageUrl: climateIcons.temp.imageUrl,
    },
    {
      label: 'ฝน',
      value: readings?.rain == null ? '--' : `${readings.rain} มม.`,
      icon: climateIcons.water.icon,
      color: climateIcons.water.color,
      imageUrl: climateIcons.water.imageUrl,
    },
    {
      label: 'เวลา',
      value: readings ? (readings.isDay ? 'กลางวัน' : 'กลางคืน') : '--',
      icon: climateIcons.light.icon,
      color: climateIcons.light.color,
      imageUrl: climateIcons.light.imageUrl,
    },
  ]
}

export function EnvironmentPanel({ climate, setClimate, windows, setWindows, mode = 'greenhouse', outdoorWeather }) {
  const isOutdoor = mode === 'outdoor'
  const controlKeys = isOutdoor ? outdoorControlKeys : Object.keys(climate)
  const outdoorReadings = getOutdoorReadings(outdoorWeather?.forecast)
  const weatherCards = buildWeatherCards(outdoorReadings)

  function updateClimate(key, value) {
    setClimate((next) => ({ ...next, [key]: value }))
  }

  return (
    <Panel
      id="climate"
      title={isOutdoor ? 'สภาพแวดล้อมกลางแจ้ง' : 'สภาพแวดล้อม'}
      subtitle={isOutdoor ? 'ข้อมูลอากาศจาก Open-Meteo' : 'น้ำ แสง ปุ๋ย'}
      windows={windows}
      setWindows={setWindows}
      className="w-[540px]"
    >
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        {controlKeys.map((key) => (
          <ClimateControl key={key} climateKey={key} value={climate[key]} onChange={updateClimate} />
        ))}
      </div>

      {isOutdoor && (
        <div className="mt-4 rounded-md border border-lime-100/10 bg-[#0b0f0c]/70 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <strong className="block text-xs text-lime-50">ที่อยู่</strong>
              <span className="text-[11px] text-slate-400">{formatLocation(outdoorWeather?.addressLabel, outdoorWeather?.status)}</span>
            </div>
            {outdoorWeather?.location && (
              <span className="rounded-md bg-lime-100/10 px-2 py-1 text-[10px] font-semibold text-lime-100">
                {outdoorWeather.location.source === 'fallback' ? 'สำรอง' : 'คงที่'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {weatherCards.map((item) => (
              <WeatherReading key={item.label} icon={item.icon} color={item.color} imageUrl={item.imageUrl} label={item.label} value={item.value} />
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}