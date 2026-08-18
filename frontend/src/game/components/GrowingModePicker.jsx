import { useEffect, useState } from 'react'
import { getAppLanguage } from '../../i18n/appI18n'
import { AppIcon } from '../icons/FontAwesomeIcon'

const modeOptions = [
  {
    id: 'greenhouse',
    title: { en: 'Environment Control', th: 'โหมดควบคุมสภาพแวดล้อม' },
    subtitle: { en: 'Full laboratory controls', th: 'ควบคุมปัจจัยในห้องทดลอง' },
    detail: { en: 'Use water and fertilizer items, then control light, soil, air, and temperature.', th: 'ใช้น้ำและปุ๋ยจากคลัง พร้อมควบคุมแสง ดิน อากาศ และอุณหภูมิ' },
    icon: 'plant',
    tone: 'lime',
    recommended: true,
  },
  {
    id: 'outdoor',
    title: { en: 'Outdoor', th: 'โหมดกลางแจ้ง' },
    subtitle: { en: 'Live weather at a saved location', th: 'อากาศจริงจากสถานที่ที่บันทึก' },
    detail: { en: 'Grow with current local weather and respond with care or protection items.', th: 'ปลูกตามอากาศปัจจุบัน และรับมือด้วยอุปกรณ์ดูแลหรือป้องกันพืช' },
    icon: 'wind',
    tone: 'sky',
  },
  {
    id: 'seasonal',
    title: { en: 'Seasonal Journey', th: 'โหมดปลูกตามฤดูกาล' },
    subtitle: { en: 'Accelerated real-climate seasons', th: 'ฤดูกาลจริงแบบเร่งเวลา' },
    detail: { en: 'Choose a place and starting month. Calendar weather continues while you manage water, nutrients, and limited emergency protection.', th: 'เลือกสถานที่และเดือนเริ่มต้น ปฏิทินอากาศเดินต่อเนื่อง โดยดูแลน้ำ ปุ๋ย และใช้อุปกรณ์ฉุกเฉินแบบจำกัด' },
    icon: 'history',
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

const toneClasses = {
  lime: 'border-lime-200/15 bg-lime-300/[0.04] text-lime-200 group-hover:border-lime-200/45',
  sky: 'border-sky-200/15 bg-sky-300/[0.04] text-sky-200 group-hover:border-sky-200/45',
  amber: 'border-amber-200/20 bg-amber-300/[0.05] text-amber-200 group-hover:border-amber-200/55',
}

export function GrowingModePicker({ plantName = '', onCancel, onSelect }) {
  const language = useLanguage()
  const isThai = language === 'th'
  const choosingForPlant = Boolean(plantName)

  useEffect(() => {
    if (!onCancel) return undefined
    const handleKeyDown = (event) => event.key === 'Escape' && onCancel()
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div className="absolute inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/65 px-4 py-8 backdrop-blur-[3px]" onClick={(event) => event.target === event.currentTarget && onCancel?.()}>
      <section className="relative w-full max-w-[780px] rounded-2xl border border-lime-100/15 bg-[#0e1510] p-5 text-slate-100 shadow-[0_24px_64px_rgba(0,0,0,.52)]" data-tour="lab-mode-picker">
        {onCancel && <button aria-label={isThai ? 'ยกเลิก' : 'Cancel'} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/5 text-slate-300 hover:bg-rose-300/10 hover:text-rose-100" type="button" onClick={onCancel}><AppIcon className="h-4 w-4" name="close" /></button>}
        <header className="mb-5 pr-10 text-center">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9bcf82]">{choosingForPlant ? (isThai ? 'เพิ่มพืชชนิดใหม่ · เลือกโหมดปลูก' : 'New species · Choose mode') : (isThai ? 'ขั้นตอน 1 จาก 3 · เลือกโหมดปลูก' : 'Step 1 of 3 · Growing mode')}</p>
          <h2 className="mt-1 text-2xl font-black text-white">{choosingForPlant ? (isThai ? `เลือกโหมดปลูกสำหรับ ${plantName}` : `Choose a mode for ${plantName}`) : (isThai ? 'เลือกโหมดการปลูก' : 'Choose a growing mode')}</h2>
          <p className="mx-auto mt-2 max-w-[62ch] text-sm leading-6 text-slate-300">{choosingForPlant ? (isThai ? 'ต้นปัจจุบันยังถูกบันทึกไว้ แต่ละพืชมีโหมด สถานที่ และความคืบหน้าของตนเอง' : 'Your current plant remains saved. Each species keeps its own mode, location, and progress.') : (isThai ? 'แต่ละโหมดมีปัจจัยที่ควบคุมได้แตกต่างกัน เลือกให้ตรงกับการทดลองที่ต้องการ' : 'Each mode exposes different controls. Choose the experiment you want to run.')}</p>
        </header>

        <div className="grid gap-3 md:grid-cols-3">
          {modeOptions.map((option) => (
            <button key={option.id} type="button" className={`group flex min-h-[270px] flex-col rounded-xl border p-4 text-left transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(0,0,0,.3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${toneClasses[option.tone]}`} data-mode={option.id} data-tour="lab-mode-option" onClick={() => onSelect(option.id)}>
              <span className="flex items-start justify-between gap-3">
                <span className="grid h-14 w-14 place-items-center rounded-xl border border-current/20 bg-black/20"><AppIcon name={option.icon} className="h-7 w-7" /></span>
                {option.badge && <span className="rounded-full bg-current/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]">{option.badge[language]}</span>}
              </span>
              <strong className="mt-5 block text-lg font-black text-white">{option.title[language]}</strong>
              <span className="mt-1 block text-sm font-semibold text-current">{option.subtitle[language]}</span>
              <span className="mt-3 block flex-1 text-xs leading-5 text-slate-300">{option.detail[language]}</span>
              <span className="mt-4 inline-flex items-center gap-2 text-xs font-black text-current">{isThai ? 'เลือกโหมดนี้' : 'Choose this mode'} <AppIcon className="h-3 w-3" name="arrowRight" /></span>
              {option.recommended && <span className="mt-3 rounded-lg bg-lime-300/10 px-2.5 py-2 text-[10px] font-bold leading-4 text-lime-100">{isThai ? 'แนะนำสำหรับผู้เริ่มต้น' : 'Recommended for beginners'}</span>}
            </button>
          ))}
        </div>
        {onCancel && <div className="mt-4 text-center"><button className="rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10" type="button" onClick={onCancel}>{isThai ? 'ดูแลต้นปัจจุบันต่อ' : 'Keep current plant'}</button></div>}
      </section>
    </div>
  )
}
