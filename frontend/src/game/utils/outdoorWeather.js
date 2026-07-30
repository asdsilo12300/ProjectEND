const LOCATION_STORAGE_KEY = 'plantsim-fixed-outdoor-location'
const ADDRESS_STORAGE_KEY = 'plantsim-fixed-outdoor-address'
const FALLBACK_LOCATION = { latitude: 13.7563, longitude: 100.5018, source: 'fallback' }
const FALLBACK_ADDRESS = 'Bangkok, Thailand'

function roundCoordinate(value) {
  return Math.round(value * 10000) / 10000
}

function clamp(value, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function locationKey(location) {
  return `${location.latitude},${location.longitude}`
}

function readSavedLocation() {
  try {
    const saved = window.localStorage.getItem(LOCATION_STORAGE_KEY)
    if (!saved) return null

    const location = JSON.parse(saved)
    if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return null

    return { latitude: location.latitude, longitude: location.longitude, source: 'saved' }
  } catch {
    return null
  }
}

function saveLocation(location) {
  try {
    window.localStorage.setItem(
      LOCATION_STORAGE_KEY,
      JSON.stringify({ latitude: location.latitude, longitude: location.longitude }),
    )
  } catch {
    // The simulator can still run with the current location even if storage is disabled.
  }
}

function readSavedAddress(location) {
  try {
    const saved = window.localStorage.getItem(ADDRESS_STORAGE_KEY)
    if (!saved) return null

    const address = JSON.parse(saved)
    if (address.key !== locationKey(location) || !address.label) return null

    return address.label
  } catch {
    return null
  }
}

function saveAddress(location, label) {
  try {
    window.localStorage.setItem(ADDRESS_STORAGE_KEY, JSON.stringify({ key: locationKey(location), label }))
  } catch {
    // Address caching is helpful, not required.
  }
}

function requestBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation unavailable'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
          source: 'browser',
        })
      },
      () => reject(new Error('Location permission denied')),
      { enableHighAccuracy: false, maximumAge: 1000 * 60 * 60, timeout: 9000 },
    )
  })
}

export async function getFixedOutdoorLocation() {
  const saved = readSavedLocation()
  if (saved) return saved

  try {
    const location = await requestBrowserLocation()
    saveLocation(location)
    return location
  } catch {
    return FALLBACK_LOCATION
  }
}

function compactAddressName(result) {
  const address = result?.address ?? {}
  const locality = address.city || address.town || address.village || address.municipality || address.suburb || address.city_district
  const region = address.state || address.province || address.county || address.district
  const country = address.country
  const parts = [locality, region, country].filter(Boolean)
  const uniqueParts = [...new Set(parts)]

  if (uniqueParts.length > 0) return uniqueParts.slice(0, 3).join(', ')
  if (result?.display_name) return result.display_name.split(',').slice(0, 3).join(',').trim()

  return null
}

export async function fetchLocationAddress(location) {
  if (location.source === 'fallback') return FALLBACK_ADDRESS

  const savedAddress = readSavedAddress(location)
  if (savedAddress) return savedAddress

  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(location.latitude),
      lon: String(location.longitude),
      'accept-language': 'th,en',
    })
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`)
    if (!response.ok) throw new Error('Map address request failed')

    const result = await response.json()
    const label = compactAddressName(result) || 'Saved map location'
    saveAddress(location, label)
    return label
  } catch {
    return 'Saved map location'
  }
}

function firstHourlyValue(forecast, key) {
  const values = forecast?.hourly?.[key]
  if (!Array.isArray(values) || values.length === 0) return null
  return values[0]
}

function soilMoisturePercent(value) {
  if (!Number.isFinite(value)) return null
  return Math.round(value > 1 ? value : value * 100)
}

export async function fetchOutdoorForecast(location, { signal } = {}) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    hourly: 'temperature_2m,relative_humidity_2m,soil_temperature_6cm,soil_moisture_1_to_3cm',
    current: 'precipitation,rain,showers,snowfall,is_day,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
  })

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal })
  if (!response.ok) throw new Error('Weather request failed')

  return response.json()
}

export function climateFromForecast(currentClimate, forecast) {
  const temperature = firstHourlyValue(forecast, 'temperature_2m')
  const humidity = firstHourlyValue(forecast, 'relative_humidity_2m')
  const soilMoisture = soilMoisturePercent(firstHourlyValue(forecast, 'soil_moisture_1_to_3cm'))

  return {
    ...currentClimate,
    air: clamp(Math.round(humidity ?? currentClimate.air)),
    soil: clamp(soilMoisture ?? currentClimate.soil),
    temp: clamp(Math.round(temperature ?? currentClimate.temp), 0, 45),
  }
}

export function getOutdoorReadings(forecast) {
  if (!forecast) return null

  const current = forecast.current ?? {}
  const rain = Number(current.rain)
  const showers = Number(current.showers)
  const precipitation = Number(current.precipitation)
  const snowfall = Number(current.snowfall)
  const liquidRain = (Number.isFinite(rain) ? rain : 0)
    + (Number.isFinite(showers) ? showers : 0)
  const resolvedRain = liquidRain > 0
    ? liquidRain
    : Number.isFinite(precipitation) && !(Number.isFinite(snowfall) && snowfall > 0)
      ? precipitation
      : 0
  const temperature = firstHourlyValue(forecast, 'temperature_2m')
  const humidity = firstHourlyValue(forecast, 'relative_humidity_2m')
  const soilTemp = firstHourlyValue(forecast, 'soil_temperature_6cm')
  const soilMoisture = soilMoisturePercent(firstHourlyValue(forecast, 'soil_moisture_1_to_3cm'))
  const windSpeed = Number(current.wind_speed_10m)
  const windDirection = Number(current.wind_direction_10m)
  const windGust = Number(current.wind_gusts_10m)

  return {
    rain: Math.max(0, resolvedRain),
    temperature: Number.isFinite(temperature) ? Math.round(temperature) : null,
    humidity: Number.isFinite(humidity) ? Math.round(humidity) : null,
    soilTemp: Number.isFinite(soilTemp) ? Math.round(soilTemp) : null,
    soilMoisture,
    windSpeed: Number.isFinite(windSpeed) ? windSpeed : 0,
    windDirection: Number.isFinite(windDirection) ? windDirection : 0,
    windGust: Number.isFinite(windGust) ? windGust : 0,
    isDay: Boolean(current.is_day),
  }
}
