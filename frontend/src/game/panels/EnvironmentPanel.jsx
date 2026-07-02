import { climateIcons } from '../data/gameData'
import { MetricIcon } from '../icons/MetricIcon'
import { Panel } from '../components/Panel'
import { getOutdoorReadings } from '../utils/outdoorWeather'

const climateLabels = {
  water: '\u0e19\u0e49\u0e33',
  light: '\u0e41\u0e2a\u0e07',
  fertilizer: '\u0e1b\u0e38\u0e4b\u0e22',
  soil: '\u0e14\u0e34\u0e19',
  air: '\u0e2d\u0e32\u0e01\u0e32\u0e28',
  temp: '\u0e2d\u0e38\u0e13\u0e2f',
}

const climateUnits = {
  water: '\u0e21\u0e25.',
  light: '\u0e25\u0e31\u0e01\u0e0b\u0e4c',
  fertilizer: '\u0e01\u0e23\u0e31\u0e21',
  soil: '%',
  air: '%\u0e0a\u0e37\u0e49\u0e19',
  temp: '\u0e2d\u0e07\u0e28\u0e32',
}

const outdoorControlKeys = ['water', 'fertilizer']

function ClimateValue({ climateKey, value }) {
  return (
    <strong className="flex min-w-[52px] items-baseline justify-end gap-0.5 text-right text-lime-100 sm:min-w-[58px]">
      <span className="text-[11px] leading-none">{value}</span>
      <span className="max-w-[40px] truncate text-[9px] leading-none text-lime-100/75 sm:max-w-[44px]">{climateUnits[climateKey]}</span>
    </strong>
  )
}

function ClimateControl({ climateKey, value, onChange, compact = false }) {
  const icon = climateIcons[climateKey]
  const layout = compact ? 'grid-cols-[26px_34px_minmax(72px,1fr)_56px] sm:grid-cols-[28px_38px_minmax(78px,1fr)_60px]' : 'grid-cols-[28px_42px_minmax(88px,1fr)_64px]'

  return (
    <label className={`grid ${layout} items-center gap-2 text-xs text-slate-300`}>
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
    <div className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-lime-100/10 bg-black/20 px-2.5 py-2 text-xs text-slate-300">
      <MetricIcon type={icon} color={color} imageUrl={imageUrl} label={`${label} icon`} size="sm" />
      <span className="truncate">{label}</span>
      <strong className="whitespace-nowrap text-lime-100">{value}</strong>
    </div>
  )
}

function formatLocation(addressLabel, status) {
  if (status === 'loading') return '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48'
  if (status === 'error') return '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48\u0e08\u0e32\u0e01\u0e41\u0e1c\u0e19\u0e17\u0e35\u0e48'
  return addressLabel || '\u0e15\u0e33\u0e41\u0e2b\u0e19\u0e48\u0e07\u0e17\u0e35\u0e48\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e44\u0e27\u0e49'
}

function buildWeatherCards(readings) {
  return [
    {
      label: '\u0e2d\u0e38\u0e13\u0e2f',
      value: readings?.temperature == null ? '--' : `${readings.temperature} \u0e2d\u0e07\u0e28\u0e32`,
      icon: climateIcons.temp.icon,
      color: climateIcons.temp.color,
      imageUrl: climateIcons.temp.imageUrl,
    },
    {
      label: '\u0e0a\u0e37\u0e49\u0e19\u0e2d\u0e32\u0e01\u0e32\u0e28',
      value: readings?.humidity == null ? '--' : `${readings.humidity}%\u0e0a\u0e37\u0e49\u0e19`,
      icon: climateIcons.air.icon,
      color: climateIcons.air.color,
      imageUrl: climateIcons.air.imageUrl,
    },
    {
      label: '\u0e0a\u0e37\u0e49\u0e19\u0e14\u0e34\u0e19',
      value: readings?.soilMoisture == null ? '--' : `${readings.soilMoisture}%`,
      icon: climateIcons.soil.icon,
      color: climateIcons.soil.color,
      imageUrl: climateIcons.soil.imageUrl,
    },
    {
      label: '\u0e2d\u0e38\u0e13\u0e2f \u0e14\u0e34\u0e19',
      value: readings?.soilTemp == null ? '--' : `${readings.soilTemp} \u0e2d\u0e07\u0e28\u0e32`,
      icon: climateIcons.temp.icon,
      color: climateIcons.temp.color,
      imageUrl: climateIcons.temp.imageUrl,
    },
    {
      label: '\u0e1d\u0e19',
      value: readings?.rain == null ? '--' : `${readings.rain} \u0e21\u0e21.`,
      icon: climateIcons.water.icon,
      color: climateIcons.water.color,
      imageUrl: climateIcons.water.imageUrl,
    },
    {
      label: '\u0e40\u0e27\u0e25\u0e32',
      value: readings ? (readings.isDay ? '\u0e01\u0e25\u0e32\u0e07\u0e27\u0e31\u0e19' : '\u0e01\u0e25\u0e32\u0e07\u0e04\u0e37\u0e19') : '--',
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
      title={isOutdoor ? '\u0e2a\u0e20\u0e32\u0e1e\u0e41\u0e27\u0e14\u0e25\u0e49\u0e2d\u0e21\u0e01\u0e25\u0e32\u0e07\u0e41\u0e08\u0e49\u0e07' : '\u0e2a\u0e20\u0e32\u0e1e\u0e41\u0e27\u0e14\u0e25\u0e49\u0e2d\u0e21'}
      subtitle={isOutdoor ? '\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2d\u0e32\u0e01\u0e32\u0e28\u0e08\u0e32\u0e01 Open-Meteo' : '\u0e19\u0e49\u0e33 \u0e41\u0e2a\u0e07 \u0e1b\u0e38\u0e4b\u0e22'}
      windows={windows}
      setWindows={setWindows}
      className={isOutdoor ? 'w-[390px] max-w-[calc(100vw-32px)]' : 'w-[540px] max-w-[calc(100vw-32px)]'}
    >
      <div className={isOutdoor ? 'max-h-[186px] overflow-y-auto pr-1 sm:max-h-[330px]' : ''}>
        <div className={`grid gap-x-3 gap-y-3 ${isOutdoor ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {controlKeys.map((key) => (
            <ClimateControl key={key} climateKey={key} value={climate[key]} onChange={updateClimate} compact={isOutdoor} />
          ))}
        </div>

        {isOutdoor && (
          <div className="mt-3 rounded-md border border-lime-100/10 bg-[#0b0f0c]/70 p-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <strong className="block text-xs leading-4 text-lime-50">{'\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48'}</strong>
                <span className="mt-0.5 block truncate text-[11px] leading-4 text-slate-400">{formatLocation(outdoorWeather?.addressLabel, outdoorWeather?.status)}</span>
              </div>
              {outdoorWeather?.location && (
                <span className="shrink-0 rounded-md bg-lime-100/10 px-2 py-1 text-[10px] font-semibold text-lime-100">
                  {outdoorWeather.location.source === 'fallback' ? '\u0e2a\u0e33\u0e23\u0e2d\u0e07' : '\u0e04\u0e07\u0e17\u0e35\u0e48'}
                </span>
              )}
            </div>

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