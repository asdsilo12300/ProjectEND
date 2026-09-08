import { useEffect, useState } from 'react'
import { getAppLanguage } from '../../i18n/appI18n'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { getSimulationModeRewards } from '../../lib/api'

const fallbackRewards = {
  greenhouse: { experience_reward: 20, coin_reward: 20, is_active: true },
  outdoor: { experience_reward: 150, coin_reward: 200, is_active: true },
  seasonal: { experience_reward: 300, coin_reward: 500, is_active: true },
}

const modeOptions = [
  {
    id: 'greenhouse',
    title: { en: 'Environment Control', th: 'โหมดควบคุมสภาพแวดล้อม' },
    subtitle: { en: 'Full laboratory controls', th: 'ควบคุมปัจจัยในห้องทดลอง' },
    detail: { en: 'Use water and fertilizer items, then control light, soil, air, and temperature.', th: 'ใช้น้ำและปุ๋ยจากคลัง พร้อมควบคุมแสง ดิน อากาศ และอุณหภูมิ' },
    asset: '/media/game-ui/mode-controlled-pixel-v1.png',
    tone: 'lime',
    recommended: true,
  },
  {
    id: 'outdoor',
    title: { en: 'Outdoor', th: 'โหมดกลางแจ้ง' },
    subtitle: { en: 'Live weather at a saved location', th: 'อากาศจริงจากสถานที่ที่บันทึก' },
    detail: { en: 'Grow with current local weather and respond with care or protection items.', th: 'ปลูกตามอากาศปัจจุบัน และรับมือด้วยอุปกรณ์ดูแลหรือป้องกันพืช' },
    asset: '/media/game-ui/mode-outdoor-pixel-v1.png',
    tone: 'sky',
  },
  {
    id: 'seasonal',
    title: { en: 'Seasonal Journey', th: 'โหมดปลูกตามฤดูกาล' },
    subtitle: { en: 'Accelerated real-climate seasons', th: 'ฤดูกาลจริงแบบเร่งเวลา' },
    detail: { en: 'Choose a place and starting month. Calendar weather continues while you manage water, nutrients, and limited emergency protection.', th: 'เลือกสถานที่และเดือนเริ่มต้น ปฏิทินอากาศเดินต่อเนื่อง โดยดูแลน้ำ ปุ๋ย และใช้อุปกรณ์ฉุกเฉินแบบจำกัด' },
    asset: '/media/game-ui/mode-seasonal-pixel-v1.png',
    tone: 'amber',
    badge: { en: 'New', th: 'ใหม่' },
  },
]

function useLanguage() {
  const [language, setLanguage] = useState(() => getAppLanguage() === 'th' ? 'th' : 'en')
  useEffect(() => {
    const update = () => setLanguage(getAppLanguage() === 'th' ? 'th' : 'en')
    window.addEventListener('plant-settings-change', update)
    return () => window.removeEventListener('plant-settings-change', update)
  }, [])
  return language
}

export function GrowingModePicker({ plantName = '', onCancel, onSelect }) {
  const language = useLanguage()
  const isThai = language === 'th'
  const choosingForPlant = Boolean(plantName)
  const [rewards, setRewards] = useState(fallbackRewards)
  const [availabilityLoading, setAvailabilityLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getSimulationModeRewards().then((payload) => {
      if (cancelled) return
      const rows = Array.isArray(payload?.data) ? payload.data : []
      setRewards((current) => ({
        ...current,
        ...Object.fromEntries(rows.map((row) => [row.mode, row])),
      }))
    }).catch(() => {}).finally(() => {
      if (!cancelled) setAvailabilityLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!onCancel) return undefined
    const handleKeyDown = (event) => event.key === 'Escape' && onCancel()
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div className="growing-mode-backdrop" onClick={(event) => event.target === event.currentTarget && onCancel?.()}>
      <section className="growing-mode-dialog" data-tour="lab-mode-picker">
        {onCancel && <button aria-label={isThai ? 'ยกเลิก' : 'Cancel'} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/5 text-slate-300 hover:bg-rose-300/10 hover:text-rose-100" type="button" onClick={onCancel}><AppIcon className="h-4 w-4" name="close" /></button>}
        <header className="mb-5 pr-10 text-center">
          {!choosingForPlant && <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9bcf82]">{isThai ? 'ขั้นตอน 1 จาก 3 · เลือกโหมดปลูก' : 'Step 1 of 3 · Growing mode'}</p>}
          <h2 className="mt-1 text-2xl font-black text-white">{choosingForPlant ? (isThai ? `เลือกโหมดปลูกสำหรับ ${plantName}` : `Choose a mode for ${plantName}`) : (isThai ? 'เลือกโหมดการปลูก' : 'Choose a growing mode')}</h2>
          {!choosingForPlant && <p className="mx-auto mt-2 max-w-[62ch] text-sm leading-6 text-slate-300">{isThai ? 'แต่ละโหมดมีปัจจัยที่ควบคุมได้แตกต่างกัน เลือกให้ตรงกับการทดลองที่ต้องการ' : 'Each mode exposes different controls. Choose the experiment you want to run.'}</p>}
        </header>

        <div className="growing-mode-grid">
          {modeOptions.map((option) => {
            const isDisabled = rewards[option.id]?.is_active === false
            const isUnavailable = availabilityLoading || isDisabled

            return (
            <button
              key={option.id}
              type="button"
              className={`growing-mode-card growing-mode-card--${option.tone}${isDisabled ? ' growing-mode-card--disabled' : ''}${availabilityLoading ? ' growing-mode-card--checking' : ''}`}
              data-mode={option.id}
              data-tour="lab-mode-option"
              disabled={isUnavailable}
              aria-label={isDisabled ? `${option.title[language]} · ${isThai ? 'ปิดใช้งาน' : 'Disabled'}` : undefined}
              onClick={() => !isUnavailable && onSelect(option.id)}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="growing-mode-card__asset"><img src={option.asset} alt="" /></span>
                {isDisabled
                  ? <span className="growing-mode-card__disabled-badge"><AppIcon name="lock" /> {isThai ? 'ปิดใช้งาน' : 'Disabled'}</span>
                  : option.badge && <span className="rounded-full bg-current/10 px-2.5 py-1 text-sm font-black uppercase tracking-[0.12em]">{option.badge[language]}</span>}
              </span>
              <strong className="growing-mode-card__title">{option.title[language]}</strong>
              <span className="growing-mode-card__detail">{option.detail[language]}</span>
              <span className="growing-mode-card__rewards" aria-label={isThai ? 'รางวัลเมื่อปลูกสำเร็จ' : 'Completion rewards'}>
                <span><b>EXP</b> +{rewards[option.id]?.experience_reward ?? 0}</span>
                <span><AppIcon name="coin" /> +{rewards[option.id]?.coin_reward ?? 0}</span>
              </span>
              <span className="growing-mode-card__action">
                {availabilityLoading
                  ? (isThai ? 'กำลังตรวจสอบสถานะ…' : 'Checking availability…')
                  : isDisabled
                    ? (isThai ? 'ปิดใช้งานโดยผู้ดูแลระบบ' : 'Disabled by administrator')
                    : (isThai ? 'เลือกโหมดนี้' : 'Choose this mode')}
                {!isUnavailable && <AppIcon className="h-3 w-3" name="arrowRight" />}
              </span>
              {option.recommended && !isDisabled && <span className="mt-3 rounded-lg bg-lime-300/10 px-2.5 py-2 text-sm font-bold leading-4 text-lime-100">{isThai ? 'แนะนำสำหรับผู้เริ่มต้น' : 'Recommended for beginners'}</span>}
            </button>
            )
          })}
        </div>
        {onCancel && <div className="mt-4 text-center"><button className="rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10" type="button" onClick={onCancel}>{isThai ? 'ดูแลต้นปัจจุบันต่อ' : 'Keep current plant'}</button></div>}
      </section>
    </div>
  )
}
