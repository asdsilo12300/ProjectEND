export function getPlantDurationSeconds(history) {
  const exactSeconds = Number(history?.duration_seconds)
  if (Number.isFinite(exactSeconds) && exactSeconds >= 0) return Math.floor(exactSeconds)

  const legacyDays = Number(history?.duration_days)
  if (Number.isFinite(legacyDays) && legacyDays >= 0) return Math.floor(legacyDays * 86400)

  return 0
}

export function formatPlantDuration(history, language = 'en', { compact = false } = {}) {
  const totalSeconds = getPlantDurationSeconds(history)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (compact) {
    const units = language === 'th'
      ? { hour: 'ชม.', minute: 'น.', second: 'วิ.' }
      : { hour: 'h', minute: 'm', second: 's' }

    return [
      hours > 0 ? `${hours}${units.hour}` : '',
      hours > 0 || minutes > 0 ? `${minutes}${units.minute}` : '',
      `${seconds}${units.second}`,
    ].filter(Boolean).join(' ')
  }

  const units = language === 'th'
    ? { hour: 'ชม.', minute: 'นาที', second: 'วินาที' }
    : { hour: 'hr', minute: 'min', second: 'sec' }

  return [
    hours > 0 ? `${hours} ${units.hour}` : '',
    hours > 0 || minutes > 0 ? `${minutes} ${units.minute}` : '',
    `${seconds} ${units.second}`,
  ].filter(Boolean).join(' ')
}
