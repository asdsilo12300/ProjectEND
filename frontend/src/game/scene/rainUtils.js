export function clampRainValue(value, min = 0, max = 1) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return min
  return Math.min(max, Math.max(min, numericValue))
}

export function getRainVisualIntensity(rainfall) {
  const amount = Math.max(0, Number(rainfall) || 0)
  if (amount < 0.03) return 0

  // Rainfall is highly non-linear to the eye. This keeps drizzle visible while
  // leaving enough headroom for heavy rain to become substantially denser.
  return clampRainValue(Math.pow(amount / 12, 0.48))
}

export function getRainLabel(rainfall) {
  const amount = Math.max(0, Number(rainfall) || 0)
  if (amount < 0.03) return 'Dry'
  if (amount < 0.5) return 'Light rain'
  if (amount < 4) return 'Rain'
  if (amount < 10) return 'Heavy rain'
  return 'Very heavy rain'
}
