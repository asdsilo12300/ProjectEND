import { useEffect, useMemo, useState } from 'react'
import { getSolarLighting } from '../utils/solarLighting'

export function useTimeOfDayLighting(location = null, simulatedTime = null) {
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const latitude = Number(location?.latitude)
  const longitude = Number(location?.longitude)
  const lightingTime = simulatedTime instanceof Date && !Number.isNaN(simulatedTime.getTime())
    ? simulatedTime
    : currentTime
  const solar = useMemo(
    () => getSolarLighting(lightingTime, { latitude, longitude }),
    [lightingTime, latitude, longitude],
  )

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  return { ...solar, currentTime: lightingTime }
}
