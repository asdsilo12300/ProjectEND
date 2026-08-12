import { useMemo, useState } from 'react'
import { getLocationWeatherPreview, reverseLocation, searchLocations } from '../../lib/api'
import { getAppLanguage } from '../../i18n/appI18n'
import { AppIcon } from '../icons/FontAwesomeIcon'

function mapUrl(location) {
  if (!location) return ''
  const lat = Number(location.latitude)
  const lon = Number(location.longitude)
  const pad = 0.018
  const bbox = [lon - pad, lat - pad, lon + pad, lat + pad].join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lon}`)}`
}

export function LocationTransferModal({ initialLocation, onClose, onConfirm }) {
  const isThai = getAppLanguage() === 'th'
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(initialLocation ?? null)
  const [weather, setWeather] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const embedUrl = useMemo(() => mapUrl(selected), [selected])

  async function selectLocation(location) {
    setSelected(location)
    setStatus('previewing')
    setError('')
    try {
      const payload = await getLocationWeatherPreview(location.latitude, location.longitude)
      setWeather(payload.data ?? payload)
    } catch {
      setError(isThai ? 'โหลดตัวอย่างสภาพอากาศไม่สำเร็จ กรุณาลองอีกครั้ง' : 'Weather preview could not be loaded. Please try again.')
    } finally {
      setStatus('idle')
    }
  }

  async function search() {
    if (query.trim().length < 2) return
    setStatus('searching')
    setError('')
    try {
      const payload = await searchLocations(query.trim())
      setResults(payload.data ?? payload ?? [])
    } catch {
      setError(isThai ? 'ค้นหาสถานที่ไม่สำเร็จ กรุณาลองอีกครั้ง' : 'Location search failed. Please try again.')
    } finally {
      setStatus('idle')
    }
  }

  function useGps() {
    if (!navigator.geolocation) {
      setError(isThai ? 'เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง' : 'Geolocation is not supported by this browser.')
      return
    }
    setStatus('locating')
    setError('')
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const payload = await reverseLocation(coords.latitude, coords.longitude)
        await selectLocation(payload.data ?? payload)
      } catch {
        setError(isThai ? 'อ่านตำแหน่งปัจจุบันไม่สำเร็จ กรุณาตรวจสิทธิ์ตำแหน่ง' : 'Current location could not be read. Check location permission.')
      } finally {
        setStatus('idle')
      }
    }, () => {
      setError(isThai ? 'ไม่ได้รับสิทธิ์ตำแหน่ง กรุณาอนุญาต GPS หรือค้นหาสถานที่แทน' : 'Location permission was not granted. Allow GPS or search for a place instead.')
      setStatus('idle')
    }, { enableHighAccuracy: true, timeout: 12000 })
  }

  const current = weather?.current ?? {}

  return (
    <div className="location-transfer" role="dialog" aria-modal="true" aria-labelledby="location-transfer-title">
      <div className="location-transfer__dialog">
        <header>
          <div>
            <span>{isThai ? 'โหมดกลางแจ้ง' : 'Outdoor growing'}</span>
            <h2 id="location-transfer-title">{isThai ? 'ย้ายสถานที่ปลูก' : 'Transfer growing location'}</h2>
            <p>{isThai ? 'ความคืบหน้าของพืชจะคงเดิม และเริ่มใช้สภาพอากาศของสถานที่ใหม่ในรอบถัดไป' : 'Plant progress stays unchanged. New weather applies from the next cycle.'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={isThai ? 'ปิดหน้าต่าง' : 'Close dialog'}><AppIcon name="close" /></button>
        </header>

        <div className="location-transfer__content">
          <div className="location-transfer__picker">
            <div className="location-transfer__search">
              <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && search()} placeholder={isThai ? 'ค้นหาเมือง อำเภอ หรือสถานที่' : 'Search city, district, or place'} />
              <button type="button" onClick={search} aria-label={isThai ? 'ค้นหาสถานที่' : 'Search location'}><AppIcon name="search" /></button>
              <button type="button" onClick={useGps} title={isThai ? 'ใช้ GPS ปัจจุบัน' : 'Use current GPS'} aria-label={isThai ? 'ใช้ตำแหน่ง GPS ปัจจุบัน' : 'Use current GPS location'}><AppIcon name="location" /></button>
            </div>
            <div className="location-transfer__results">
              {results.map((result) => (
                <button type="button" key={`${result.latitude}-${result.longitude}`} onClick={() => selectLocation(result)}>
                  <AppIcon name="location" /><span>{result.name}</span>
                </button>
              ))}
              {!results.length && <p>{isThai ? 'ค้นหาสถานที่หรือใช้ตำแหน่ง GPS ปัจจุบัน' : 'Search a place or use your current GPS location.'}</p>}
              {error && <p className="location-transfer__error" role="alert">{error}</p>}
            </div>
          </div>

          <div className="location-transfer__map">
            {embedUrl ? <iframe title={isThai ? 'ตัวอย่างตำแหน่งบน OpenStreetMap' : 'OpenStreetMap location preview'} src={embedUrl} loading="lazy" /> : <div><AppIcon name="location" /><span>{isThai ? 'เลือกสถานที่เพื่อปักหมุด' : 'Choose a location to place the pin'}</span></div>}
          </div>
        </div>

        {selected && (
          <section className="location-transfer__preview">
            <div><span>{isThai ? 'สถานที่' : 'Location'}</span><strong>{selected.name ?? selected.location_name}</strong></div>
            <div><span>{isThai ? 'อุณหภูมิ' : 'Temperature'}</span><strong>{current.temperature_2m ?? '--'}°C</strong></div>
            <div><span>{isThai ? 'ฝน' : 'Rain'}</span><strong>{current.rain ?? current.precipitation ?? '--'} mm</strong></div>
            <div><span>{isThai ? 'ลม' : 'Wind'}</span><strong>{current.wind_speed_10m ?? '--'} km/h</strong></div>
          </section>
        )}

        <footer>
          <span>{status !== 'idle' ? (isThai ? 'กำลังโหลดข้อมูล...' : 'Loading preview...') : ''}</span>
          <button type="button" onClick={onClose}>{isThai ? 'ยกเลิก' : 'Cancel'}</button>
          <button type="button" disabled={!selected || status !== 'idle'} onClick={() => onConfirm({
            location_name: selected.name ?? selected.location_name,
            latitude: Number(selected.latitude),
            longitude: Number(selected.longitude),
            timezone: weather?.timezone ?? null,
          })}>{isThai ? 'ยืนยันการย้าย' : 'Confirm transfer'}</button>
        </footer>
      </div>
    </div>
  )
}
