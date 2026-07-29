const DEFAULT_LOCATION = {
  latitude: 13.7563,
  longitude: 100.5018,
}

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function smoothstep(min, max, value) {
  const progress = clamp((value - min) / (max - min), 0, 1)
  return progress * progress * (3 - (2 * progress))
}

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date - start) / 86400000)
}

function getValidCoordinate(value, fallback, min, max) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? clamp(numericValue, min, max) : fallback
}

/**
 * Approximate the apparent position of the sun from the viewer's local clock.
 * The equation-of-time and longitude correction keep sunrise, noon and sunset
 * aligned more closely with the selected outdoor location than a fixed 06–18 arc.
 */
export function getSolarLighting(date = new Date(), location = DEFAULT_LOCATION) {
  const currentDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  const latitude = getValidCoordinate(location?.latitude, DEFAULT_LOCATION.latitude, -89.8, 89.8)
  const longitude = getValidCoordinate(location?.longitude, DEFAULT_LOCATION.longitude, -180, 180)
  const dayOfYear = getDayOfYear(currentDate)
  const latitudeRadians = latitude * DEG_TO_RAD

  const seasonalAngle = (2 * Math.PI * (dayOfYear - 81)) / 364
  const equationOfTimeMinutes = (
    (9.87 * Math.sin(2 * seasonalAngle))
    - (7.53 * Math.cos(seasonalAngle))
    - (1.5 * Math.sin(seasonalAngle))
  )
  const utcOffsetHours = -currentDate.getTimezoneOffset() / 60
  const localStandardMeridian = utcOffsetHours * 15
  const longitudeCorrectionMinutes = 4 * (longitude - localStandardMeridian)
  const localClockMinutes = (
    (currentDate.getHours() * 60)
    + currentDate.getMinutes()
    + (currentDate.getSeconds() / 60)
  )
  const solarTimeHours = (
    localClockMinutes
    + equationOfTimeMinutes
    + longitudeCorrectionMinutes
  ) / 60

  const declinationRadians = (
    23.45
    * Math.sin(((360 * (284 + dayOfYear)) / 365) * DEG_TO_RAD)
    * DEG_TO_RAD
  )
  const hourAngleRadians = (15 * (solarTimeHours - 12)) * DEG_TO_RAD
  const sinElevation = (
    (Math.sin(latitudeRadians) * Math.sin(declinationRadians))
    + (Math.cos(latitudeRadians) * Math.cos(declinationRadians) * Math.cos(hourAngleRadians))
  )
  const elevationRadians = Math.asin(clamp(sinElevation, -1, 1))
  const elevationDegrees = elevationRadians * RAD_TO_DEG

  // Azimuth is measured clockwise from north.
  const azimuthRadians = (
    Math.atan2(
      Math.sin(hourAngleRadians),
      (Math.cos(hourAngleRadians) * Math.sin(latitudeRadians))
        - (Math.tan(declinationRadians) * Math.cos(latitudeRadians)),
    )
    + Math.PI
  )
  const horizontalRadius = Math.cos(elevationRadians)
  const sunRadius = 12
  const daylight = smoothstep(-2, 10, elevationDegrees)
  const directSun = elevationDegrees > -0.833
    ? 0.08 + (3.25 * Math.pow(Math.max(0, Math.sin(elevationRadians)), 0.45))
    : 0
  const warmLightMix = smoothstep(2, 24, elevationDegrees)
  const sunHue = 18 + (30 * warmLightMix)
  const sunLightness = 63 + (25 * warmLightMix)

  return {
    azimuthRadians,
    daylight,
    elevationDegrees,
    environmentIntensity: 0.12 + (0.88 * daylight),
    backgroundIntensity: 0.22 + (0.88 * daylight),
    hemisphereIntensity: 0.07 + (0.5 * daylight),
    isDay: elevationDegrees > -2,
    sunColor: `hsl(${sunHue} 100% ${sunLightness}%)`,
    sunIntensity: directSun ? directSun : 0,
    sunPosition: [
      0.75 + (sunRadius * horizontalRadius * Math.sin(azimuthRadians)),
      Math.max(0.15, sunRadius * Math.sin(elevationRadians)),
      sunRadius * horizontalRadius * Math.cos(azimuthRadians),
    ],
  }
}

