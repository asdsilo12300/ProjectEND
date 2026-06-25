import { climateIcons } from '../data/gameData'
import { MetricIcon } from '../icons/MetricIcon'
import { Panel } from '../components/Panel'
import { getOutdoorReadings } from '../utils/outdoorWeather'

const climateLabels = {
  water: 'Water',
  fertilizer: 'Fertilizer',
}

const outdoorControlKeys = ['water', 'fertilizer']

function ClimateControl({ climateKey, value, onChange }) {
  const icon = climateIcons[climateKey]

  return (
    <label className="grid grid-cols-[28px_64px_1fr_28px] items-center gap-2 text-xs text-slate-300">
      <MetricIcon type={icon.icon} color={icon.color} label={`${climateLabels[climateKey]} icon`} size="sm" />
      <span>{climateLabels[climateKey]}</span>
      <input
        className="sim-range sim-range-compact"
        style={{ '--range-progress': `${value}%` }}
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(climateKey, Number(event.target.value))}
      />
      <strong className="text-right text-lime-100">{value}</strong>
    </label>
  )
}

function WeatherReading({ icon, color, label, value }) {
  return (
    <div className="grid grid-cols-[24px_1fr_auto] items-center gap-2 rounded-md border border-lime-100/10 bg-black/20 px-2.5 py-2 text-xs text-slate-300">
      <MetricIcon type={icon} color={color} label={`${label} icon`} size="sm" />
      <span>{label}</span>
      <strong className="text-lime-100">{value}</strong>
    </div>
  )
}

function formatLocation(addressLabel, status) {
  if (status === 'loading') return 'finding map address'
  if (status === 'error') return 'map address unavailable'
  return addressLabel || 'Saved map location'
}

function buildWeatherCards(readings) {
  return [
    {
      label: 'Temperature',
      value: readings?.temperature == null ? '--' : `${readings.temperature}°C`,
      icon: climateIcons.temp.icon,
      color: climateIcons.temp.color,
    },
    {
      label: 'Humidity',
      value: readings?.humidity == null ? '--' : `${readings.humidity}%`,
      icon: climateIcons.air.icon,
      color: climateIcons.air.color,
    },
    {
      label: 'Soil moisture',
      value: readings?.soilMoisture == null ? '--' : `${readings.soilMoisture}%`,
      icon: climateIcons.soil.icon,
      color: climateIcons.soil.color,
    },
    {
      label: 'Soil temp',
      value: readings?.soilTemp == null ? '--' : `${readings.soilTemp}°C`,
      icon: climateIcons.temp.icon,
      color: climateIcons.temp.color,
    },
    {
      label: 'Rain',
      value: readings?.rain == null ? '--' : `${readings.rain} mm`,
      icon: climateIcons.water.icon,
      color: climateIcons.water.color,
    },
    {
      label: 'Day state',
      value: readings ? (readings.isDay ? 'Day' : 'Night') : '--',
      icon: climateIcons.light.icon,
      color: climateIcons.light.color,
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
      title={isOutdoor ? 'Outdoor environment' : 'Environment'}
      subtitle={isOutdoor ? 'Open-Meteo readings' : 'water light fertilizer'}
      windows={windows}
      setWindows={setWindows}
      className="w-[430px]"
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {controlKeys.map((key) => (
          <ClimateControl key={key} climateKey={key} value={climate[key]} onChange={updateClimate} />
        ))}
      </div>

      {isOutdoor && (
        <div className="mt-4 rounded-md border border-lime-100/10 bg-[#0b0f0c]/70 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <strong className="block text-xs text-lime-50">Address</strong>
              <span className="text-[11px] text-slate-400">{formatLocation(outdoorWeather?.addressLabel, outdoorWeather?.status)}</span>
            </div>
            {outdoorWeather?.location && (
              <span className="rounded-md bg-lime-100/10 px-2 py-1 text-[10px] font-semibold text-lime-100">
                {outdoorWeather.location.source === 'fallback' ? 'fallback' : 'fixed'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {weatherCards.map((item) => (
              <WeatherReading key={item.label} icon={item.icon} color={item.color} label={item.label} value={item.value} />
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}


