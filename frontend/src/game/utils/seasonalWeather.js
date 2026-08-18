function clamp(value, min = 0, max = 100) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.min(max, Math.max(min, numeric))
}

export const seasonalLabels = {
  hot: { en: 'Hot season', th: 'ฤดูร้อน' },
  rainy: { en: 'Rainy season', th: 'ฤดูฝน' },
  cool_dry: { en: 'Winter / dry season', th: 'ฤดูหนาว / แล้ง' },
  spring: { en: 'Spring', th: 'ฤดูใบไม้ผลิ' },
  summer: { en: 'Summer', th: 'ฤดูร้อน' },
  autumn: { en: 'Autumn', th: 'ฤดูใบไม้ร่วง' },
  winter: { en: 'Winter', th: 'ฤดูหนาว' },
  thaw: { en: 'Thaw season', th: 'ฤดูละลายตัว' },
  short_summer: { en: 'Short summer', th: 'ฤดูร้อนช่วงสั้น' },
  deep_winter: { en: 'Deep winter', th: 'ฤดูหนาวจัด' },
  hot_dry: { en: 'Hot and dry', th: 'ฤดูร้อนและแห้ง' },
  short_rain: { en: 'Short rainy season', th: 'ช่วงฝนสั้น' },
}

const seasonalIcons = {
  hot: 'lightMode',
  rainy: 'drop',
  cool_dry: 'wind',
  spring: 'plant',
  summer: 'lightMode',
  autumn: 'leaf',
  winter: 'frost',
  thaw: 'drop',
  short_summer: 'lightMode',
  deep_winter: 'frost',
  hot_dry: 'lightMode',
  short_rain: 'drop',
}

export const climateZoneLabels = {
  tropical: { en: 'Tropical', th: 'เขตร้อน' },
  temperate: { en: 'Temperate', th: 'เขตอบอุ่น' },
  cold: { en: 'Cold climate', th: 'เขตหนาว' },
  arid: { en: 'Arid', th: 'เขตแห้งแล้ง' },
}

export function localSeasonLabel(key, language = 'en') {
  return seasonalLabels[key]?.[language] ?? String(key ?? 'Season')
}

export function localSeasonIcon(key) {
  return seasonalIcons[key] ?? 'leaf'
}

export function localClimateZoneLabel(key, language = 'en') {
  return climateZoneLabels[key]?.[language] ?? String(key ?? 'Climate')
}

export function seasonalWeatherStateFromSimulator(simulator) {
  const context = simulator?.seasonal_context
  const day = context?.current
  if (simulator?.mode !== 'seasonal' || !day) {
    return { status: 'idle', message: '', location: null, forecast: null, addressLabel: '' }
  }

  const observedAt = `${day.date}T12:00`
  const soilMoisture = day.soil_moisture == null
    ? clamp(38 + Number(day.precipitation ?? 0) * 3 - Number(day.evapotranspiration ?? 0) * 2)
    : clamp(Number(day.soil_moisture) * 100)
  const forecast = {
    timezone: simulator.location_timezone ?? 'auto',
    timezone_abbreviation: '',
    current: {
      time: observedAt,
      is_day: 1,
      precipitation: Number(day.precipitation ?? 0),
      rain: Number(day.rain ?? 0),
      showers: 0,
      snowfall: Number(day.snowfall ?? 0),
      wind_speed_10m: Number(day.wind_speed ?? 0),
      wind_direction_10m: Number(day.wind_direction ?? 0),
      wind_gusts_10m: Number(day.wind_gust ?? 0),
      cloud_cover: Number(day.cloud_cover ?? 0),
    },
    hourly: {
      time: [observedAt],
      temperature_2m: [Number(day.temperature_mean ?? simulator.air_temp ?? 25)],
      relative_humidity_2m: [Number(day.humidity ?? simulator.air_humidity ?? 60)],
      soil_temperature_6cm: [Number(day.soil_temperature ?? simulator.soil_temp ?? 24)],
      soil_moisture_1_to_3cm: [soilMoisture / 100],
    },
    daily: {
      precipitation_sum: [Number(day.precipitation ?? 0)],
      rain_sum: [Number(day.rain ?? 0)],
      showers_sum: [0],
      precipitation_probability_max: [day.precipitation > 0 ? 100 : 10],
    },
  }

  return {
    status: 'ready',
    message: context.source_label_en ?? 'Seasonal weather timeline loaded',
    location: {
      latitude: Number(simulator.latitude),
      longitude: Number(simulator.longitude),
      source: 'simulation',
    },
    forecast,
    addressLabel: simulator.location_name ?? 'Seasonal growing location',
  }
}

export function seasonalSceneState(context) {
  const current = context?.current ?? {}
  return {
    seasonKey: context?.season_key ?? current.season_key ?? 'summer',
    snow: Math.max(0, Number(current.snowfall ?? 0)),
    cloudCover: clamp(current.cloud_cover ?? 0),
    temperature: Number(current.temperature_mean ?? 25),
    humidity: clamp(current.humidity ?? 60),
    windSpeed: Math.max(0, Number(current.wind_speed ?? 0)),
    windDirection: Number(current.wind_direction ?? 0),
    rain: Math.max(0, Number(current.rain ?? 0)),
  }
}
