import { useEffect, useMemo, useState } from 'react'
import { getSolarLighting } from '../utils/solarLighting'

export function useTimeOfDayLighting(location = null) {
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const latitude = Number(location?.latitude)
  const longitude = Number(location?.longitude)
  const solar = useMemo(
    () => getSolarLighting(currentTime, { latitude, longitude }),
    [currentTime, latitude, longitude],
  )

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  return { ...solar, currentTime }
}
