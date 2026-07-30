import { climateIcons } from '../data/gameData'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { MetricIcon } from '../icons/MetricIcon'
import { Panel } from '../components/Panel'
import { getOutdoorReadings } from '../utils/outdoorWeather'

const climateLabels = {
  water: 'Water',
  light: 'Light',
  fertilizer: 'Fertilizer',
  soil: 'Soil',
  air: 'Air',
  soilTemp: 'Soil temp',
  temp: 'Temp',
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

const outdoorControlKeys = ['water', 'fertilizer']

function ClimateValue({ climateKey, value }) {
  const displayValue = climateKey === 'water' ? Math.round(Number(value || 0) * 10) : value

  return (
    <strong className="flex min-w-[48px] items-baseline justify-end gap-0.5 text-right text-lime-100 sm:min-w-[50px]">
      <span className="text-xs leading-none">{displayValue}</span>
      <span className="max-w-[40px] truncate text-xs leading-none text-lime-100/75 sm:max-w-[44px]">{climateUnits[climateKey]}</span>
    </strong>
  )
}

function ClimateControl({ climateKey, value, onChange, compact = false, disabled = false }) {
  const icon = climateIcons[climateKey] ?? climateIcons.temp
  const layout = compact ? 'grid-cols-[26px_34px_minmax(72px,1fr)_56px] sm:grid-cols-[28px_38px_minmax(78px,1fr)_60px]' : 'grid-cols-[26px_72px_minmax(52px,1fr)_50px]'
  const isTemperature = climateKey === 'temp' || climateKey === 'soilTemp'
  const rangeProgress = isTemperature ? (Number(value) / 45) * 100 : Number(value)

  return (
    <label className={`grid ${layout} items-center gap-1.5 text-xs text-slate-300 ${disabled ? 'opacity-55' : ''}`}>
      <MetricIcon className={climateKey === 'soilTemp' ? 'h-6 w-6 rounded-[4px]' : ''} type={icon.icon} color={icon.color} imageUrl={icon.imageUrl} label={`${climateLabels[climateKey]} icon`} size="sm" />
      <span className="whitespace-nowrap text-xs">{climateLabels[climateKey]}</span>
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

function formatLocation(addressLabel, status) {
  if (status === 'loading') return 'Finding saved location'
  if (status === 'error') return 'Map location not found'
  return addressLabel || 'Saved map location'
}

function buildWeatherCards(readings) {
  return [
    {
      label: 'Temp',
      value: readings?.temperature == null ? '--' : `${readings.temperature} C`,
      icon: climateIcons.temp.icon,
      color: climateIcons.temp.color,
      imageUrl: climateIcons.temp.imageUrl,
    },
    {
      label: 'Humidity',
      value: readings?.humidity == null ? '--' : `${readings.humidity}%RH`,
      icon: climateIcons.air.icon,
      color: climateIcons.air.color,
      imageUrl: climateIcons.air.imageUrl,
    },
    {
      label: 'Soil moisture',
      value: readings?.soilMoisture == null ? '--' : `${readings.soilMoisture}%`,
      icon: climateIcons.soil.icon,
      color: climateIcons.soil.color,
      imageUrl: climateIcons.soil.imageUrl,
    },
    {
      label: 'Soil temp',
      value: readings?.soilTemp == null ? '--' : `${readings.soilTemp} C`,
      icon: climateIcons.soilTemp.icon,
      color: climateIcons.soilTemp.color,
      imageUrl: climateIcons.soilTemp.imageUrl,
    },
    {
      label: 'Rain',
      value: readings?.rain == null ? '--' : `${readings.rain} mm`,
      icon: climateIcons.water.icon,
      color: climateIcons.water.color,
      imageUrl: climateIcons.water.imageUrl,
    },
    {
      label: 'Wind',
      value: readings?.windSpeed == null
        ? '--'
        : `${Math.round(readings.windSpeed)} km/h`,
      icon: climateIcons.air.icon,
      color: climateIcons.air.color,
      imageUrl: climateIcons.air.imageUrl,
    },
    {
      label: 'Time',
      value: readings ? (readings.isDay ? 'Day' : 'Night') : '--',
      icon: climateIcons.light.icon,
      color: climateIcons.light.color,
      imageUrl: climateIcons.light.imageUrl,
    },
  ]
}

function locationSourceLabel(source) {
  if (source === 'browser') return 'current'
  if (source === 'saved') return 'saved'
  if (source === 'simulation') return 'locked'
  if (source === 'fallback') return 'fallback'
  return ''
}

export function EnvironmentPanel({ climate, setClimate, windows, setWindows, locationLocked = false, mode = 'greenhouse', onRefreshLocation, outdoorWeather, plantSelected = true }) {
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
      subtitle={isOutdoor ? 'weather data from Open-Meteo' : 'water light fertilizer'}
      windows={windows}
      setWindows={setWindows}
      className={isOutdoor ? 'w-[390px] max-w-[calc(100vw-32px)]' : 'w-[520px] max-w-[calc(100vw-32px)]'}
    >
      <div className={isOutdoor ? 'max-h-[186px] overflow-y-auto pr-1 sm:max-h-[330px]' : ''}>
        <div className={`mb-3 rounded-md border px-3 py-2 text-xs leading-4 ${plantSelected ? 'border-lime-100/10 bg-[#9bcf82]/[0.07] text-slate-300' : 'border-amber-200/15 bg-amber-300/[0.07] text-amber-100'}`}>
          {plantSelected
            ? 'Changes are saved automatically and applied at the next simulation update.'
            : 'Select a plant first. Environment controls unlock when the simulation starts.'}
        </div>
        <div className={`grid gap-x-3 gap-y-3 ${isOutdoor ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {controlKeys.map((key) => (
            <ClimateControl key={key} climateKey={key} value={climate[key]} onChange={updateClimate} compact={isOutdoor} disabled={!plantSelected} />
          ))}
        </div>

        {isOutdoor && (
          <div className="mt-3 rounded-md border border-lime-100/10 bg-[#0b0f0c]/70 p-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <strong className="block text-xs leading-4 text-lime-50">Address</strong>
                <span className="mt-0.5 block truncate text-xs leading-4 text-slate-400">{formatLocation(outdoorWeather?.addressLabel, outdoorWeather?.status)}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {outdoorWeather?.location && (
                  <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${outdoorWeather.location.source === 'fallback' ? 'bg-amber-300/10 text-amber-100' : 'bg-lime-100/10 text-lime-100'}`}>
                    {locationSourceLabel(outdoorWeather.location.source)}
                  </span>
                )}
                <button
                  className="grid h-7 w-7 place-items-center rounded-md border border-lime-100/15 bg-white/[0.035] text-slate-300 transition hover:border-lime-100/30 hover:bg-lime-100/10 hover:text-lime-100 disabled:cursor-wait disabled:opacity-50"
                  type="button"
                  onClick={onRefreshLocation}
                  disabled={outdoorWeather?.status === 'loading' || locationLocked}
                  aria-label={locationLocked ? 'Location locked while this plant is growing' : 'Use current location'}
                  title={locationLocked ? 'Location locked until this growing cycle ends' : 'Use current location'}
                >
                  <AppIcon className={`h-3.5 w-3.5 ${outdoorWeather?.status === 'loading' ? 'animate-spin' : ''}`} name="restartAlt" />
                </button>
              </div>
            </div>

            {locationLocked && (
              <p className="mb-2 rounded-md border border-sky-200/15 bg-sky-300/[0.06] px-2.5 py-2 text-[10px] leading-4 text-sky-100/85">
                This plant location is locked until it is harvested or uprooted. Weather updates continue from this saved location.
              </p>
            )}

            {outdoorWeather?.location?.source === 'fallback' && (
              <p className="mb-2 rounded-md border border-amber-200/15 bg-amber-300/[0.06] px-2.5 py-2 text-[10px] leading-4 text-amber-100/85">
                Location permission is unavailable. Allow location access in your browser, then press the refresh button.
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
