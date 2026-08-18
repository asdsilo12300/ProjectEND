import { useEffect, useMemo, useState } from 'react'
import { getSeasonalLocationPreview, reverseLocation, searchLocations } from '../../lib/api'
import { getAppLanguage } from '../../i18n/appI18n'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { getFixedOutdoorLocation } from '../utils/outdoorWeather'
import { localClimateZoneLabel, localSeasonLabel } from '../utils/seasonalWeather'

const monthNames = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  th: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
}

function suitabilityCopy(value, language) {
  const copies = {
    excellent: { en: ['Excellent match', 'Weather is well suited to this plant.'], th: ['เหมาะมาก', 'สภาพอากาศเหมาะกับพืชชนิดนี้'] },
    manageable: { en: ['Growable with care', 'Watch water and seasonal warnings closely.'], th: ['ปลูกได้แต่ต้องดูแล', 'ควรติดตามน้ำและคำเตือนตามฤดูกาล'] },
    high_risk: { en: ['High risk', 'Growth may pause, but the simulation warns before severe weather.'], th: ['เสี่ยงสูง', 'พืชอาจหยุดโต แต่ระบบจะเตือนก่อนอากาศรุนแรง'] },
  }
  return copies[value]?.[language] ?? copies.manageable[language]
}

export function SeasonalSetupModal({ busy = false, onCancel, onConfirm, plant }) {
  const language = getAppLanguage() === 'th' ? 'th' : 'en'
  const isThai = language === 'th'
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [location, setLocation] = useState(null)
  const [locationName, setLocationName] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onCancel?.()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onCancel])

  useEffect(() => {
    if (!location) return undefined
    let cancelled = false
    const loadTimer = window.setTimeout(() => {
      setStatus('loading')
      setError('')
      getSeasonalLocationPreview(location.latitude, location.longitude, month, plant?.backendId ?? plant?.id)
        .then((payload) => {
          if (!cancelled) {
            setPreview(payload.data ?? payload)
            setStatus('ready')
          }
        })
        .catch((requestError) => {
          if (!cancelled) {
            setStatus('error')
            setError(requestError.message || (isThai ? 'โหลดตัวอย่างฤดูกาลไม่สำเร็จ' : 'Unable to preview this season'))
          }
        })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(loadTimer)
    }
  }, [isThai, location, month, plant?.backendId, plant?.id])

  const suitability = useMemo(() => suitabilityCopy(preview?.suitability, language), [language, preview?.suitability])

  async function useGps() {
    setStatus('locating')
    setError('')
    setPreview(null)
    try {
      const next = await getFixedOutdoorLocation({ preferCurrent: true })
      const payload = await reverseLocation(next.latitude, next.longitude)
      const resolved = payload.data ?? payload
      setLocation({ latitude: Number(resolved.latitude), longitude: Number(resolved.longitude) })
      setLocationName(resolved.name || (isThai ? 'ตำแหน่งปัจจุบัน' : 'Current location'))
    } catch {
      setStatus('error')
      setError(isThai ? 'ไม่สามารถอ่านตำแหน่งปัจจุบันได้ กรุณาตรวจสอบสิทธิ์ GPS หรือลองค้นหาสถานที่แทน' : 'Current location is unavailable. Check GPS permission or search for a place instead.')
    }
  }

  async function submitSearch(event) {
    event.preventDefault()
    if (query.trim().length < 2) return
    setStatus('searching')
    setError('')
    try {
      const payload = await searchLocations(query.trim())
      setResults(payload.data ?? payload ?? [])
      setStatus('idle')
    } catch {
      setStatus('error')
      setError(isThai ? 'ค้นหาสถานที่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : 'Location search failed. Please try again.')
    }
  }

  function selectLocation(result) {
    setPreview(null)
    setLocation({ latitude: Number(result.latitude), longitude: Number(result.longitude) })
    setLocationName(result.name)
    setResults([])
    setQuery(result.name)
  }

  return (
    <div className="absolute inset-0 z-[85] grid place-items-center overflow-y-auto bg-black/65 px-4 py-8 backdrop-blur-sm" onClick={(event) => event.target === event.currentTarget && !busy && onCancel?.()}>
      <section className="relative w-full max-w-[880px] overflow-hidden rounded-2xl border border-emerald-200/20 bg-[#0e1711] text-slate-100 shadow-[0_28px_80px_rgba(0,0,0,.55)]" role="dialog" aria-modal="true" aria-labelledby="seasonal-setup-title">
        <header className="border-b border-white/10 bg-gradient-to-r from-emerald-950/80 to-lime-950/45 px-6 py-5 pr-16">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">Seasonal Journey · {isThai ? 'ขั้นตอน 3 จาก 3' : 'Step 3 of 3'}</p>
          <h2 className="mt-1 text-2xl font-black text-white" id="seasonal-setup-title">{isThai ? `ตั้งค่าฤดูกาลสำหรับ ${plant?.name ?? 'พืช'}` : `Set the season for ${plant?.name ?? 'your plant'}`}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-300">{isThai ? 'เลือกสถานที่และเดือนเริ่มต้น ระบบจะสร้างอากาศแบบเร่งเวลาที่เปิดซ้ำแล้วได้ Timeline เดิม' : 'Choose a location and starting month. The persisted accelerated weather timeline stays the same after reopening.'}</p>
          <button type="button" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10" aria-label={isThai ? 'ปิด' : 'Close'} disabled={busy} onClick={onCancel}>
            <AppIcon className="h-4 w-4" name="close" />
          </button>
        </header>

        <div className="grid gap-5 p-6 md:grid-cols-[1fr_1.05fr]">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-lime-50">{isThai ? 'เดือนเริ่มปลูก' : 'Starting month'}</label>
              <select className="w-full rounded-lg border border-emerald-200/20 bg-[#111d15] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
                {monthNames[language].map((name, index) => <option value={index + 1} key={name}>{name}</option>)}
              </select>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-sm font-bold text-lime-50">{isThai ? 'สถานที่ปลูก' : 'Growing location'}</label>
                <button type="button" className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold text-cyan-100 hover:bg-cyan-300/20" onClick={useGps} disabled={busy || status === 'locating'}>
                  <AppIcon className="h-3.5 w-3.5" name="location" />{status === 'locating' ? '…' : isThai ? 'ใช้ GPS' : 'Use GPS'}
                </button>
              </div>
              <form className="flex gap-2" onSubmit={submitSearch}>
                <input className="min-w-0 flex-1 rounded-lg border border-emerald-200/20 bg-[#111d15] px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-300" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isThai ? 'ค้นหาเมือง จังหวัด หรือประเทศ' : 'Search city, region, or country'} />
                <button type="submit" className="grid w-12 place-items-center rounded-lg bg-emerald-300 text-emerald-950 disabled:opacity-50" disabled={query.trim().length < 2 || status === 'searching'} aria-label={isThai ? 'ค้นหา' : 'Search'}><AppIcon className="h-4 w-4" name="search" /></button>
              </form>
              {results.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-[#111d15] p-1">
                  {results.map((result) => <button type="button" key={`${result.latitude}:${result.longitude}`} className="block w-full rounded-md px-3 py-2 text-left text-xs leading-5 text-slate-200 hover:bg-emerald-300/10" onClick={() => selectLocation(result)}>{result.name}</button>)}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-emerald-200/15 bg-[#09110c]">
              {location ? (
                <>
                  <iframe className="h-44 w-full border-0 opacity-90" title={isThai ? 'แผนที่สถานที่ปลูก' : 'Growing location map'} loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude - 0.04}%2C${location.latitude - 0.025}%2C${location.longitude + 0.04}%2C${location.latitude + 0.025}&layer=mapnik&marker=${location.latitude}%2C${location.longitude}`} />
                  <div className="px-3 py-2 text-xs text-slate-300"><strong className="block truncate text-lime-50">{locationName}</strong>{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</div>
                </>
              ) : <div className="grid h-52 place-items-center px-6 text-center text-sm text-slate-400">{isThai ? 'เลือก GPS หรือค้นหาสถานที่เพื่อดูแผนที่และความเหมาะสม' : 'Use GPS or search for a place to preview the map and suitability.'}</div>}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200/15 bg-gradient-to-br from-emerald-950/55 to-[#111912] p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">{isThai ? 'ตัวอย่างฤดูกาล' : 'Season preview'}</p>
            {status === 'loading' ? (
              <div className="grid min-h-[300px] place-items-center"><span className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200/20 border-t-emerald-300" /></div>
            ) : preview ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-white/10 bg-black/15 p-4">
                  <span className="text-xs text-slate-400">{isThai ? 'ฤดูกาลและเขตภูมิอากาศ' : 'Season and climate zone'}</span>
                  <strong className="mt-1 block text-2xl text-white">{localSeasonLabel(preview.season_key, language)}</strong>
                  <span className="text-sm text-emerald-200">{localClimateZoneLabel(preview.climate_zone, language)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-orange-200/15 bg-orange-300/[0.06] p-3"><span className="block text-xs text-orange-100/70">{isThai ? 'อุณหภูมิเฉลี่ย' : 'Average temperature'}</span><strong className="mt-1 block text-xl text-orange-100">{preview.temperature_mean}°C</strong></div>
                  <div className="rounded-lg border border-cyan-200/15 bg-cyan-300/[0.06] p-3"><span className="block text-xs text-cyan-100/70">{isThai ? 'ฝนเฉลี่ยต่อวัน' : 'Average daily rain'}</span><strong className="mt-1 block text-xl text-cyan-100">{preview.precipitation_daily_mean} mm</strong></div>
                </div>
                <div className={`rounded-xl border p-4 ${preview.suitability === 'excellent' ? 'border-emerald-300/30 bg-emerald-300/10' : preview.suitability === 'manageable' ? 'border-amber-300/30 bg-amber-300/10' : 'border-rose-300/35 bg-rose-300/10'}`}>
                  <div className="flex items-center justify-between gap-4"><strong className="text-lg text-white">{suitability[0]}</strong><span className="rounded-full bg-black/20 px-3 py-1 text-sm font-black">{preview.suitability_score}/100</span></div>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{suitability[1]}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/15 p-3 text-xs leading-5 text-slate-300">
                  <strong className="block text-lime-50">{isThai ? 'แหล่งข้อมูล' : 'Weather source'}</strong>
                  {isThai ? preview.source_label_th : preview.source_label_en}
                </div>
                <p className="text-xs leading-5 text-slate-400">{isThai ? 'ระบบไม่ห้ามปลูกผิดฤดู วันตามปฏิทินยังเดินต่อแม้พืชหยุดโต และเหตุรุนแรงจะแจ้งล่วงหน้า' : 'Out-of-season planting is allowed. Calendar days continue when growth pauses, and severe weather is announced in advance.'}</p>
              </div>
            ) : <div className="grid min-h-[300px] place-items-center text-center text-sm leading-6 text-slate-400">{isThai ? 'ข้อมูลฤดูกาลจะแสดงหลังเลือกสถานที่' : 'Season data appears after choosing a location.'}</div>}
          </div>
        </div>
        {error && <div className="mx-6 mb-4 rounded-lg border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
        <footer className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button type="button" className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-white/5" disabled={busy} onClick={onCancel}>{isThai ? 'ยกเลิก' : 'Cancel'}</button>
          <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-5 py-2.5 text-sm font-black text-emerald-950 shadow-[0_10px_24px_rgba(110,231,183,.18)] disabled:cursor-not-allowed disabled:opacity-45" disabled={busy || !location || !preview || status === 'loading'} onClick={() => onConfirm?.({ location_name: locationName, location_timezone: preview.location_timezone, latitude: location.latitude, longitude: location.longitude, start_month: month })}>
            <AppIcon className="h-4 w-4" name="plant" />{busy ? (isThai ? 'กำลังสร้าง Timeline…' : 'Building timeline…') : (isThai ? 'เริ่มปลูกตามฤดูกาล' : 'Start Seasonal Journey')}
          </button>
        </footer>
      </section>
    </div>
  )
}
