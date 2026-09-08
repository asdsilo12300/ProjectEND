import { useCallback, useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import { deletePlantHistory, getPlantHistories, getToken, resolveAssetUrl, updatePlantHistoryVisibility } from '../../lib/api'
import { getAppLanguage } from '../../i18n/appI18n'
import { ParticleNetworkBackground } from '../components/ParticleNetworkBackground'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { formatPlantDuration } from '../../utils/plantDuration'

const historyMessages = {
  en: {
    pageLabel: 'Save history',
    eyebrow: 'Growth records',
    title: 'Save history',
    subtitle: 'Review completed simulations, compare results, and reopen saved evidence.',
    recordCount: (count) => `${count} saved record${count === 1 ? '' : 's'}`,
    searchLabel: 'Search saved simulations',
    searchPlaceholder: 'Search plants, stages, or results',
    notSaved: 'Not saved yet',
    defaultPlant: 'Plant simulation',
    defaultStage: 'Seedling',
    day: (count) => `${count} day${count === 1 ? '' : 's'}`,
    scoreShort: 'Score',
    healthShort: 'Health',
    noAnalysis: 'No analysis was recorded for this simulation.',
    noDirection: 'Continue observing the plant during the next cycle.',
    shared: 'Shared',
    private: 'Private',
    sharedTitle: 'Shared with Community',
    privateTitle: 'Only you can see this save',
    deleteLabel: 'Delete saved history',
    closeLabel: 'Close history details',
    deleteTitle: 'Delete this save?',
    deleteDescription: (name) => `${name} will be permanently removed from your history.`,
    cancel: 'Cancel',
    delete: 'Delete',
    deleting: 'Deleting…',
    deleteError: 'The save could not be deleted. Please try again.',
    savedPlant: 'Saved plant',
    analysis: 'Analysis',
    direction: 'Next direction',
    viewGame: 'View simulation state',
    score: 'Score',
    health: 'Health',
    duration: 'Duration',
    biologicalGrowth: 'Real-life growth equivalent',
    growthSnapshot: 'Growth calculation at save time',
    timeScale: 'Simulation time scale',
    complete: 'Complete',
    paused: 'Paused',
    growing: 'Growing',
    realDays: (current, total) => `${current} / ~${total} days`,
    secondsPerDay: (seconds) => `1 real-life day ≈ ${seconds}s`,
    stoppedAtMaturity: 'Counter stopped at biological maturity',
    growthReference: 'Growth-time source',
    recentGrowth: 'Recent calculated growth',
    loadingLabel: 'Loading save history',
    loadingTitle: 'Loading your growth records…',
    errorTitle: 'Your history could not be loaded',
    errorDescription: 'Check your connection and try again. Your saved records are still safe.',
    retry: 'Try again',
    emptyTitle: 'No saved simulations yet',
    emptyDescription: 'Complete a growing session in Plant Lab, then save the result to build your history.',
    refresh: 'Go to Plant Lab',
    noMatchTitle: 'No records match your search',
    noMatchDescription: 'Try a plant name, growth stage, or result from another session.',
    clearSearch: 'Clear search',
    loginTitle: 'Sign in to view your history',
    loginDescription: 'Your saved simulations are connected to your account.',
    visibilityError: 'Sharing could not be updated. Your previous setting has been restored.',
    shareConfirmTitle: 'Share this saved result?',
    shareConfirmDescription: (name) => `${name} will appear in Community for other learners to view.`,
    stopShareConfirmTitle: 'Make this result private?',
    stopShareConfirmDescription: (name) => `${name} will be removed from Community and remain visible only to you.`,
    confirmShare: 'Share result',
    confirmPrivate: 'Make private',
    pageNumber: (page) => `History page ${page}`,
    previousPage: 'Previous history page',
    nextPage: 'Next history page',
    stages: { Seedling: 'Seedling', Sprout: 'Sprout', Young: 'Young', Mature: 'Mature', 'Fully grown': 'Fully grown' },
  },
  th: {
    pageLabel: 'ประวัติการบันทึก',
    eyebrow: 'บันทึกการเติบโต',
    title: 'ประวัติการบันทึก',
    subtitle: 'ตรวจสอบการทดลองที่ผ่านมา เปรียบเทียบผลลัพธ์ และเปิดดูสถานะการจำลองที่บันทึกไว้',
    recordCount: (count) => `บันทึกแล้ว ${count} รายการ`,
    searchLabel: 'ค้นหาผลจำลองที่บันทึก',
    searchPlaceholder: 'ค้นหาพืช ระยะการเติบโต หรือผลลัพธ์',
    notSaved: 'ยังไม่ได้บันทึก',
    defaultPlant: 'การจำลองการปลูกพืช',
    defaultStage: 'ต้นกล้า',
    day: (count) => `${count} วัน`,
    scoreShort: 'คะแนน',
    healthShort: 'สุขภาพ',
    noAnalysis: 'ไม่มีผลการวิเคราะห์สำหรับการจำลองนี้',
    noDirection: 'สังเกตพืชต่อในรอบการเติบโตถัดไป',
    shared: 'แชร์แล้ว',
    private: 'ส่วนตัว',
    sharedTitle: 'แชร์ไปยังชุมชนแล้ว',
    privateTitle: 'มีเพียงคุณที่เห็นบันทึกนี้',
    deleteLabel: 'ลบประวัติที่บันทึก',
    closeLabel: 'ปิดรายละเอียดประวัติ',
    deleteTitle: 'ลบบันทึกนี้หรือไม่?',
    deleteDescription: (name) => `${name} จะถูกลบออกจากประวัติของคุณอย่างถาวร`,
    cancel: 'ยกเลิก',
    delete: 'ลบ',
    deleting: 'กำลังลบ…',
    deleteError: 'ไม่สามารถลบบันทึกได้ กรุณาลองอีกครั้ง',
    savedPlant: 'พืชที่บันทึก',
    analysis: 'ผลการวิเคราะห์',
    direction: 'คำแนะนำถัดไป',
    viewGame: 'ดูสถานะการจำลอง',
    score: 'คะแนน',
    health: 'สุขภาพ',
    duration: 'ระยะเวลา',
    biologicalGrowth: '\u0e27\u0e31\u0e19\u0e40\u0e15\u0e34\u0e1a\u0e42\u0e15\u0e40\u0e17\u0e35\u0e22\u0e1a\u0e0a\u0e35\u0e27\u0e34\u0e15\u0e08\u0e23\u0e34\u0e07',
    growthSnapshot: '\u0e01\u0e32\u0e23\u0e04\u0e33\u0e19\u0e27\u0e13\u0e13 \u0e02\u0e13\u0e30\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01',
    timeScale: '\u0e2d\u0e31\u0e15\u0e23\u0e32\u0e40\u0e27\u0e25\u0e32\u0e08\u0e33\u0e25\u0e2d\u0e07',
    complete: '\u0e40\u0e15\u0e34\u0e1a\u0e42\u0e15\u0e40\u0e15\u0e47\u0e21\u0e17\u0e35\u0e48',
    paused: '\u0e2b\u0e22\u0e38\u0e14\u0e40\u0e15\u0e34\u0e1a\u0e42\u0e15',
    growing: '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e40\u0e15\u0e34\u0e1a\u0e42\u0e15',
    realDays: (current, total) => `${current} / ~${total} \u0e27\u0e31\u0e19`,
    secondsPerDay: (seconds) => `1 \u0e27\u0e31\u0e19\u0e08\u0e23\u0e34\u0e07 \u2248 ${seconds} \u0e27\u0e34\u0e19\u0e32\u0e17\u0e35`,
    stoppedAtMaturity: '\u0e2b\u0e22\u0e38\u0e14\u0e19\u0e31\u0e1a\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e16\u0e36\u0e07\u0e27\u0e31\u0e22\u0e40\u0e15\u0e47\u0e21\u0e17\u0e35\u0e48\u0e15\u0e32\u0e21\u0e0a\u0e35\u0e27\u0e27\u0e34\u0e17\u0e22\u0e32',
    growthReference: '\u0e41\u0e2b\u0e25\u0e48\u0e07\u0e2d\u0e49\u0e32\u0e07\u0e2d\u0e34\u0e07\u0e23\u0e30\u0e22\u0e30\u0e40\u0e27\u0e25\u0e32',
    recentGrowth: '\u0e01\u0e23\u0e32\u0e1f\u0e01\u0e32\u0e23\u0e40\u0e15\u0e34\u0e1a\u0e42\u0e15\u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14',
    loadingLabel: 'กำลังโหลดประวัติการบันทึก',
    loadingTitle: 'กำลังโหลดบันทึกการเติบโต…',
    errorTitle: 'ไม่สามารถโหลดประวัติได้',
    errorDescription: 'ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง บันทึกของคุณยังคงปลอดภัย',
    retry: 'ลองอีกครั้ง',
    emptyTitle: 'ยังไม่มีการจำลองที่บันทึกไว้',
    emptyDescription: 'ปลูกพืชให้จบใน Plant Lab แล้วบันทึกผลลัพธ์เพื่อสร้างประวัติของคุณ',
    refresh: 'ไปที่ห้องทดลองปลูกพืช',
    noMatchTitle: 'ไม่พบบันทึกที่ตรงกับการค้นหา',
    noMatchDescription: 'ลองค้นหาด้วยชื่อพืช ระยะการเติบโต หรือผลลัพธ์จากการทดลอง',
    clearSearch: 'ล้างการค้นหา',
    loginTitle: 'เข้าสู่ระบบเพื่อดูประวัติ',
    loginDescription: 'การจำลองที่บันทึกไว้จะเชื่อมต่อกับบัญชีของคุณ',
    visibilityError: 'ไม่สามารถอัปเดตการแชร์ได้ ระบบคืนค่าเดิมให้แล้ว',
    shareConfirmTitle: 'แชร์ผลการปลูกนี้หรือไม่?',
    shareConfirmDescription: (name) => `${name} จะแสดงในชุมชนให้ผู้เรียนคนอื่นเปิดดูได้`,
    stopShareConfirmTitle: 'เปลี่ยนผลการปลูกนี้เป็นส่วนตัวหรือไม่?',
    stopShareConfirmDescription: (name) => `${name} จะถูกนำออกจากชุมชนและมีเพียงคุณที่เปิดดูได้`,
    confirmShare: 'แชร์ผลการปลูก',
    confirmPrivate: 'ตั้งเป็นส่วนตัว',
    pageNumber: (page) => `หน้าประวัติที่ ${page}`,
    previousPage: 'หน้าประวัติก่อนหน้า',
    nextPage: 'หน้าประวัติถัดไป',
    stages: {
      Seedling: 'ต้นกล้า',
      Sprout: 'ต้นอ่อน',
      Young: 'ระยะเติบโต',
      'Young Plant': 'ต้นอ่อน',
      Mature: 'โตเต็มวัย',
      'Fully grown': 'โตเต็มที่',
      'Bulb establishment': 'ระยะตั้งตัวของหัว',
      'Leaf emergence': 'ระยะแตกใบ',
      Flowering: 'ระยะออกดอก',
    },
  },
}

function formatDate(value, language, copy) {
  if (!value) return copy.notSaved
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function saveTitle(save, language, copy) {
  return (language === 'th' ? save.plant?.name_th : save.plant?.name_en)
    || save.plant?.name_en
    || save.plant?.name_th
    || save.title
    || copy.defaultPlant
}

function saveStage(save, language, copy) {
  const stage = save.final_stage || save.current_stage || {}
  const name = (language === 'th' ? stage.stage_name_th : stage.stage_name) || stage.stage_name || stage.stage_name_th
  return copy.stages[name] || name || copy.defaultStage
}

function saveSubtitle(save, language, copy) {
  if (save.subtitle) return save.subtitle
  return `${saveStage(save, language, copy)} · ${formatPlantDuration(save, language)}`
}

function localizedField(save, field, language) {
  return (language === 'th' ? save[`${field}_th`] : save[field]) || save[field] || save[`${field}_th`] || ''
}

function savedGrowthCalculation(save) {
  return save?.growth_calculation ?? save?.game_state?.growth_calculation ?? null
}

function compactNumber(value, maximumFractionDigits = 1) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(number)
}

function SavedGrowthCalculation({ calculation, copy }) {
  if (!calculation) return null

  const maturityDays = Math.max(1, Number(calculation.maturity_days) || 1)
  const equivalentDays = Math.min(maturityDays, Math.max(0, Number(calculation.equivalent_days) || 0))
  const progress = Math.min(100, Math.max(0, Number(calculation.progress_percent) || 0))
  const statusCopy = calculation.status === 'complete'
    ? copy.complete
    : calculation.status === 'growing' ? copy.growing : copy.paused
  const secondsPerDay = calculation.status === 'complete'
    ? Number(calculation.normal_seconds_per_real_day)
    : Number(calculation.seconds_per_real_day ?? calculation.normal_seconds_per_real_day)
  const samples = Array.isArray(calculation.recent_growth_percentages)
    ? calculation.recent_growth_percentages.map((value) => Math.min(100, Math.max(0, Number(value) || 0)))
    : []
  const chartSamples = samples.length > 0 ? samples : [progress]
  const points = chartSamples.map((value, index) => {
    const x = chartSamples.length === 1 ? 260 : 12 + (index / (chartSamples.length - 1)) * 496
    const y = 112 - (value / 100) * 92
    return `${x},${y}`
  }).join(' ')

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-[#55dc91]/20 bg-[#0a130e] p-3.5" aria-label={copy.growthSnapshot}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#75dca0]">{copy.growthSnapshot}</p>
          <strong className="mt-1 block text-lg text-white">{copy.realDays(compactNumber(equivalentDays), compactNumber(maturityDays, 0))}</strong>
        </div>
        <span className="rounded-full border border-[#78eda8]/25 bg-[#55dc91]/10 px-2.5 py-1 text-xs font-bold text-[#b8f5ce]">{statusCopy}</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <span className="block h-full rounded-full bg-gradient-to-r from-cyan-400 via-[#55dc91] to-[#a4e789]" style={{ width: `${progress}%` }} />
      </div>

      {chartSamples.length > 1 ? (
        <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/15 px-2 pb-1.5 pt-1">
          <p className="px-1 pt-1 text-sm font-semibold text-slate-400">{copy.recentGrowth}</p>
          <svg className="mt-1 h-20 w-full" viewBox="0 0 520 130" role="img" aria-label={`${copy.recentGrowth}: ${compactNumber(progress)}%`}>
            <line x1="12" x2="508" y1="20" y2="20" stroke="rgba(148,163,184,.14)" strokeDasharray="4 5" />
            <line x1="12" x2="508" y1="66" y2="66" stroke="rgba(148,163,184,.12)" strokeDasharray="4 5" />
            <line x1="12" x2="508" y1="112" y2="112" stroke="rgba(148,163,184,.16)" />
            <polyline points={points} fill="none" stroke="#67e8a3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
            {chartSamples.map((value, index) => {
              const [x, y] = points.split(' ')[index].split(',')
              return <circle key={`${index}-${value}`} cx={x} cy={y} r="4" fill="#b8f5ce"><title>{`${compactNumber(value)}% · ${compactNumber((value / 100) * maturityDays)} days`}</title></circle>
            })}
          </svg>
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>{calculation.status === 'complete' ? `${copy.stoppedAtMaturity} · ${copy.secondsPerDay(compactNumber(secondsPerDay, 2))}` : copy.secondsPerDay(compactNumber(secondsPerDay, 2))}</span>
        {calculation.reference_url ? <a className="font-semibold text-cyan-300 hover:text-cyan-200" href={calculation.reference_url} target="_blank" rel="noreferrer">{copy.growthReference} ↗</a> : null}
      </div>
    </section>
  )
}

function PreviewScene({ copy, imageUrl, score = 0 }) {
  if (imageUrl) {
    return (
      <div className="relative h-36 overflow-hidden border-b border-[#32493b] bg-[#080b09]">
        <img className="h-full w-full object-cover" src={resolveAssetUrl(imageUrl)} alt={copy.savedPlant} />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08100c]/45 to-transparent" />
      </div>
    )
  }

  const progress = Math.min(100, Math.max(0, Number(score) || 0))
  const stemHeight = 16 + progress * 0.42
  const leafScale = 0.6 + progress / 135

  return (
    <div className="relative h-36 overflow-hidden border-b border-[#32493b] bg-[#cdeefd]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 144" preserveAspectRatio="none" aria-hidden="true">
        <rect width="360" height="144" fill="#d9efe5" />
        <circle cx="72" cy="24" r="6" fill="white" opacity="0.9" />
        <circle cx="84" cy="22" r="9" fill="white" opacity="0.92" />
        <circle cx="98" cy="25" r="6" fill="white" opacity="0.85" />
        <circle cx="188" cy="22" r="13" fill="white" opacity="0.96" />
        <circle cx="206" cy="27" r="8" fill="white" opacity="0.88" />
        <path d="M0 96 C35 88 55 65 83 76 C110 87 120 104 158 91 C194 79 222 107 256 88 C294 67 318 83 360 78 L360 144 L0 144 Z" fill="#719b51" />
        <path d="M0 106 C40 109 57 87 100 95 C136 102 151 114 187 104 C228 93 241 117 282 103 C316 91 334 104 360 97 L360 144 L0 144 Z" fill="#a8ce79" opacity="0.88" />
      </svg>
      <div className="absolute left-1/2 top-[58px] -translate-x-1/2" style={{ transform: `translateX(-50%) scale(${leafScale})` }}>
        <div className="mx-auto w-1.5 rounded-full bg-[#557d34]" style={{ height: `${stemHeight}px` }} />
        <div className="absolute left-1/2 top-2 h-7 w-11 -translate-x-1/2 -rotate-12 rounded-[70%_20%_70%_20%] bg-[#5ea43f] shadow-[inset_0_0_0_2px_rgba(216,243,201,.24)]" />
        <div className="absolute left-1/2 top-7 h-6 w-10 -translate-x-[80%] rotate-12 rounded-[70%_20%_70%_20%] bg-[#78bd58] shadow-[inset_0_0_0_2px_rgba(216,243,201,.22)]" />
      </div>
    </div>
  )
}

function ShareToggle({ checked, copy, disabled = false, onChange }) {
  return (
    <label
      className={`inline-flex min-h-11 items-center rounded-xl border px-2.5 text-xs font-bold transition ${checked ? 'border-[#55dc91]/40 bg-[#55dc91]/12 text-[#b8f5ce]' : 'border-white/10 bg-[#08100c]/82 text-slate-300'} ${disabled ? 'cursor-wait opacity-70' : 'cursor-pointer hover:bg-white/[0.07]'}`}
      onClick={(event) => event.stopPropagation()}
      title={checked ? copy.sharedTitle : copy.privateTitle}
    >
      <AppIcon className={`h-4 w-4 ${checked ? 'text-[#78eda8]' : 'text-slate-400'}`} name={checked ? 'groups' : 'shield'} />
      <input type="checkbox" className="sr-only peer" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="relative mx-2 h-5 w-9 rounded-full bg-slate-700/80 transition peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#78eda8]/45 peer-checked:bg-[#55dc91]">
        <span className={`absolute start-[2px] top-[2px] h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'translate-x-full' : ''}`} />
      </span>
      <span>{checked ? copy.shared : copy.private}</span>
    </label>
  )
}

function SaveCard({ copy, language, onDelete, onOpen, onToggleVisibility, save, visibilityBusy = false }) {
  const score = Math.min(100, Math.max(0, Number(save.total_score ?? save.growth_point) || 0))
  const health = Math.min(100, Math.max(0, Number(save.final_health ?? save.health) || 0))
  const isShared = save.visibility === 'public'
  const analysis = localizedField(save, 'analysis_result', language)
  const direction = localizedField(save, 'direction', language)
  const growthCalculation = savedGrowthCalculation(save)

  return (
    <article className="group relative flex min-h-full flex-col overflow-hidden rounded-2xl bg-[#121c17] text-left shadow-[0_18px_36px_rgba(0,0,0,.22)] ring-1 ring-[#32493b] transition hover:-translate-y-0.5 hover:ring-[#78eda8]/55 focus-within:ring-[#78eda8]/65 motion-reduce:transform-none" data-tour="history-card">
      <button className="block flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9cf3bd]" type="button" onClick={() => onOpen(save)}>
        <PreviewScene copy={copy} score={score} imageUrl={save.snapshot_image_url} />
        <div className="px-4 pb-20 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-black text-slate-50">{saveTitle(save, language, copy)}</h2>
              <p className="mt-1 truncate text-xs text-[#8eeab4]">{saveSubtitle(save, language, copy)}</p>
              <p className="mt-1.5 text-xs text-slate-500">{formatDate(save.created_at || save.updated_at || save.started_at, language, copy)}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-lg bg-[#08100c]/70 px-2.5 py-1.5 text-xs text-slate-400"><strong className="text-[#9cf3bd]">{score.toFixed(0)}</strong> {copy.scoreShort}</span>
            <span className="rounded-lg bg-[#08100c]/70 px-2.5 py-1.5 text-xs text-slate-400"><strong className="text-[#9cf3bd]">{health.toFixed(0)}%</strong> {copy.healthShort}</span>
            {growthCalculation ? <span className="rounded-lg bg-[#08100c]/70 px-2.5 py-1.5 text-xs text-slate-400"><strong className="text-cyan-300">{compactNumber(growthCalculation.equivalent_days)}</strong> / {compactNumber(growthCalculation.maturity_days, 0)}</span> : null}
          </div>
          <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-300">{analysis || copy.noAnalysis}</p>
          <p className="mt-2 line-clamp-1 text-xs font-semibold text-[#8eeab4]">{direction || copy.noDirection}</p>
        </div>
      </button>
      <button
        className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-xl border border-red-200/25 bg-[#190e10]/90 text-red-100 shadow-md transition hover:border-red-200/55 hover:bg-red-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-200"
        type="button"
        onClick={(event) => { event.stopPropagation(); onDelete(save) }}
        aria-label={copy.deleteLabel}
      >
        <AppIcon className="h-5 w-5" name="trash" />
      </button>
      <div className="absolute bottom-3 right-3 z-20" data-tour="history-share">
        <ShareToggle checked={isShared} copy={copy} disabled={visibilityBusy} onChange={(nextChecked) => onToggleVisibility(save, nextChecked ? 'public' : 'private')} />
      </div>
    </article>
  )
}

function DeleteConfirmModal({ copy, error, language, onCancel, onConfirm, save, status }) {
  if (!save) return null

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/65 px-4 py-8 backdrop-blur-sm" onMouseDown={onCancel} role="presentation">
      <div className="w-full max-w-[400px] rounded-2xl border border-red-200/20 bg-[#15110f] p-5 text-center text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,.55)]" onMouseDown={(event) => event.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="delete-history-title">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-500/18 text-red-100"><AppIcon className="h-6 w-6" name="trash" /></div>
        <h2 className="mt-4 text-lg font-black text-red-50" id="delete-history-title">{copy.deleteTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{copy.deleteDescription(saveTitle(save, language, copy))}</p>
        {error ? <p className="mt-3 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-sm text-red-100" role="alert">{error}</p> : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <button className="min-h-11 rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]" type="button" onClick={onCancel} disabled={status === 'deleting'}>{copy.cancel}</button>
          <button className="min-h-11 rounded-xl bg-red-500 px-5 text-sm font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={onConfirm} disabled={status === 'deleting'}>{status === 'deleting' ? copy.deleting : copy.delete}</button>
        </div>
      </div>
    </div>
  )
}

function HistoryDetailModal({ copy, language, onClose, onDelete, onOpenGameState, save }) {
  if (!save) return null

  const score = Number(save.total_score ?? 0)
  const health = Number(save.final_health ?? save.health ?? 0)
  const analysis = localizedField(save, 'analysis_result', language)
  const direction = localizedField(save, 'direction', language)
  const growthCalculation = savedGrowthCalculation(save)
  const historySecondsPerDay = Number(
    growthCalculation?.seconds_per_real_day
      ?? growthCalculation?.normal_seconds_per_real_day,
  )

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-[60] grid place-items-center overflow-y-auto bg-black/65 px-3 py-3 backdrop-blur-sm sm:px-5" onMouseDown={onClose} role="presentation">
      <div className="max-h-[calc(100dvh-5.5rem)] w-full max-w-[760px] overflow-y-auto rounded-2xl border border-[#78eda8]/20 bg-[#101813] text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,.6)]" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="history-detail-title">
        <div className="relative h-36 bg-[#080b09] sm:h-44 md:h-48">
          {save.snapshot_image_url ? <img className="h-full w-full object-cover" src={resolveAssetUrl(save.snapshot_image_url)} alt={copy.savedPlant} /> : <PreviewScene copy={copy} score={score} />}
          <div className="absolute right-3 top-3 flex gap-2 sm:right-4 sm:top-4">
            <button className="grid h-11 w-11 place-items-center rounded-xl border border-red-200/25 bg-black/60 text-red-100 hover:bg-red-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-100" type="button" onClick={() => onDelete(save)} aria-label={copy.deleteLabel}><AppIcon className="h-5 w-5" name="trash" /></button>
            <button className="grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-black/60 text-2xl leading-none text-slate-100 hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" type="button" onClick={onClose} aria-label={copy.closeLabel}><span aria-hidden="true">×</span></button>
          </div>
        </div>
        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_220px]">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#75dca0]">{copy.savedPlant}</p>
            <h2 className="mt-1 break-words text-2xl font-black text-white" id="history-detail-title">{saveTitle(save, language, copy)}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">{saveSubtitle(save, language, copy)} · {formatDate(save.created_at, language, copy)}</p>
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5"><strong className="text-sm text-lime-50">{copy.analysis}</strong><p className="mt-1.5 text-sm leading-6 text-slate-300">{analysis || copy.noAnalysis}</p></div>
            <div className="mt-2.5 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5"><strong className="text-sm text-lime-50">{copy.direction}</strong><p className="mt-1.5 text-sm leading-6 text-slate-300">{direction || copy.noDirection}</p></div>
            <SavedGrowthCalculation calculation={growthCalculation} copy={copy} />
          </div>
          <div className="grid content-start gap-3">
            {save.game_state?.simulator && onOpenGameState ? (
              <button className="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#55dc91] px-4 text-sm font-semibold text-[#07120d] shadow-[0_8px_18px_rgba(0,0,0,.22)] transition hover:bg-[#78eda8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf3bd]" type="button" onClick={() => onOpenGameState(save)}><AppIcon className="h-4 w-4" name="eye" />{copy.viewGame}</button>
            ) : null}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><span className="text-xs text-slate-400">{copy.score}</span><strong className="mt-1 block text-2xl text-[#b8f5ce]">{score}</strong></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><span className="text-xs text-slate-400">{copy.health}</span><strong className="mt-1 block text-2xl text-[#b8f5ce]">{health}%</strong></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><span className="text-xs text-slate-400">{copy.duration}</span><strong className="mt-1 block text-xl leading-snug text-[#b8f5ce]">{formatPlantDuration(save, language)}</strong></div>
            {growthCalculation ? (
              <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
                <span className="text-xs text-slate-400">{copy.biologicalGrowth}</span>
                <strong className="mt-1 block text-xl leading-snug text-cyan-200">{copy.realDays(compactNumber(growthCalculation.equivalent_days), compactNumber(growthCalculation.maturity_days, 0))}</strong>
                <span className="mt-1.5 block text-xs leading-5 text-slate-400">{copy.secondsPerDay(compactNumber(historySecondsPerDay, 2))}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function HistoryState({ actionLabel, description, icon, onAction, title }) {
  return (
    <div className="grid min-h-[340px] place-items-center rounded-2xl border border-dashed border-[#385242] bg-[#101914]/70 px-6 py-12 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#55dc91]/10 text-[#78eda8] ring-1 ring-[#55dc91]/20"><AppIcon className="h-7 w-7" name={icon} /></span>
        <h2 className="mt-5 text-lg font-black text-slate-50">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        {onAction ? <button className="mt-5 min-h-11 rounded-xl border border-[#55dc91]/30 bg-[#55dc91]/10 px-5 text-sm font-bold text-[#9cf3bd] transition hover:bg-[#55dc91]/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf3bd]" type="button" onClick={onAction}>{actionLabel}</button> : null}
      </div>
    </div>
  )
}

function HistorySkeleton({ copy }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label={copy.loadingLabel} aria-busy="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="animate-pulse overflow-hidden rounded-2xl bg-[#121c17] ring-1 ring-[#32493b]/70 motion-reduce:animate-none" key={index}>
          <div className="h-36 bg-white/[0.06]" />
          <div className="p-4"><div className="h-4 w-2/3 rounded bg-white/[0.08]" /><div className="mt-3 h-3 w-1/2 rounded bg-white/[0.05]" /><div className="mt-5 h-10 rounded bg-white/[0.05]" /><div className="mt-4 h-11 rounded-xl bg-white/[0.06]" /></div>
        </div>
      ))}
    </div>
  )
}

function pageWindow(currentPage, pageCount) {
  if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index + 1)
  const start = Math.max(2, Math.min(currentPage - 1, pageCount - 3))
  const pages = [1]
  if (start > 2) pages.push('start-gap')
  pages.push(start, start + 1, start + 2)
  if (start + 2 < pageCount - 1) pages.push('end-gap')
  pages.push(pageCount)
  return pages
}

function HistoryPagination({ copy, currentPage, onPageChange, pageCount }) {
  if (pageCount <= 1) return null
  return (
    <nav className="mt-8 flex flex-wrap justify-center gap-2" aria-label={copy.pageLabel}>
      <button className="grid h-11 w-11 place-items-center rounded-xl bg-[#111a16] text-slate-300 ring-1 ring-[#34483c] transition hover:bg-white/[0.06] disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#55dc91]" type="button" disabled={currentPage <= 1} aria-label={copy.previousPage} onClick={() => onPageChange(Math.max(1, currentPage - 1))}><AppIcon className="h-4 w-4" name="arrowBack" /></button>
      {pageWindow(currentPage, pageCount).map((item, index) => typeof item === 'string'
        ? <span className="grid h-11 min-w-11 place-items-center text-slate-500" key={`${item}-${index}`}>…</span>
        : <button className={`grid h-11 min-w-11 place-items-center rounded-xl px-2 text-sm font-bold ring-1 ring-[#34483c] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#55dc91] ${item === currentPage ? 'bg-[#55dc91] text-[#07120d]' : 'bg-[#111a16] text-slate-300 hover:bg-white/[0.06]'}`} key={item} type="button" aria-current={item === currentPage ? 'page' : undefined} aria-label={copy.pageNumber(item)} onClick={() => onPageChange(item)}>{item}</button>)}
      <button className="grid h-11 w-11 place-items-center rounded-xl bg-[#111a16] text-slate-300 ring-1 ring-[#34483c] transition hover:bg-white/[0.06] disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#55dc91]" type="button" disabled={currentPage >= pageCount} aria-label={copy.nextPage} onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}><AppIcon className="h-4 w-4" name="arrowForward" /></button>
    </nav>
  )
}

export function HistoryPage({ onOpenGameState, onStartGrowing }) {
  const language = getAppLanguage()
  const copy = historyMessages[language === 'th' ? 'th' : 'en']
  const [saves, setSaves] = useState([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState(() => (getToken() ? 'loading' : 'unauthenticated'))
  const [selectedSave, setSelectedSave] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteStatus, setDeleteStatus] = useState('idle')
  const [deleteError, setDeleteError] = useState('')
  const [visibilityBusyId, setVisibilityBusyId] = useState(null)
  const [feedback, setFeedback] = useState('')
  const pageSize = 6

  const loadSaves = useCallback(async () => {
    if (!getToken()) {
      setStatus('unauthenticated')
      return
    }

    setStatus('loading')
    setFeedback('')
    try {
      const payload = await getPlantHistories()
      setSaves(payload.data ?? [])
      setStatus('ready')
    } catch {
      setSaves([])
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (!getToken()) return undefined
    let cancelled = false

    getPlantHistories()
      .then((payload) => {
        if (cancelled) return
        setSaves(payload.data ?? [])
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setSaves([])
        setStatus('error')
      })

    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return saves
    return saves.filter((save) => `${saveTitle(save, language, copy)} ${saveSubtitle(save, language, copy)} ${localizedField(save, 'analysis_result', language)} ${localizedField(save, 'direction', language)}`.toLowerCase().includes(term))
  }, [copy, language, query, saves])

  const pageCount = Math.ceil(filtered.length / pageSize)
  const currentPage = Math.min(page, Math.max(1, pageCount))
  const visibleSaves = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function requestDelete(save) {
    setDeleteError('')
    setDeleteTarget(save)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteStatus('deleting')
    setDeleteError('')
    try {
      await deletePlantHistory(deleteTarget.id)
      setSaves((current) => current.filter((save) => save.id !== deleteTarget.id))
      setSelectedSave((current) => (current?.id === deleteTarget.id ? null : current))
      setDeleteTarget(null)
    } catch {
      setDeleteError(copy.deleteError)
    } finally {
      setDeleteStatus('idle')
    }
  }

  async function toggleVisibility(save, visibility) {
    const previousVisibility = save.visibility ?? 'private'
    if (previousVisibility === visibility) return

    const isSharing = visibility === 'public'
    const confirmation = await Swal.fire({
      title: isSharing ? copy.shareConfirmTitle : copy.stopShareConfirmTitle,
      text: isSharing
        ? copy.shareConfirmDescription(saveTitle(save, language, copy))
        : copy.stopShareConfirmDescription(saveTitle(save, language, copy)),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: isSharing ? copy.confirmShare : copy.confirmPrivate,
      cancelButtonText: copy.cancel,
      focusCancel: true,
      reverseButtons: true,
      background: '#101511',
      color: '#eaf7df',
      buttonsStyling: false,
      customClass: {
        popup: 'plantsim-shop-alert',
        title: 'plantsim-shop-alert__title',
        actions: 'plantsim-shop-alert__actions',
        confirmButton: 'plantsim-shop-alert__confirm',
        cancelButton: 'plantsim-shop-alert__cancel',
      },
    })
    if (!confirmation.isConfirmed) return

    setVisibilityBusyId(save.id)
    setFeedback('')
    setSaves((current) => current.map((item) => (item.id === save.id ? { ...item, visibility } : item)))
    setSelectedSave((current) => (current?.id === save.id ? { ...current, visibility } : current))

    try {
      const payload = await updatePlantHistoryVisibility(save.id, visibility)
      const updated = payload.data ?? payload
      setSaves((current) => current.map((item) => (item.id === save.id ? { ...item, ...updated } : item)))
      setSelectedSave((current) => (current?.id === save.id ? { ...current, ...updated } : current))
    } catch {
      setSaves((current) => current.map((item) => (item.id === save.id ? { ...item, visibility: previousVisibility } : item)))
      setSelectedSave((current) => (current?.id === save.id ? { ...current, visibility: previousVisibility } : current))
      setFeedback(copy.visibilityError)
    } finally {
      setVisibilityBusyId(null)
    }
  }

  return (
    <section className="user-page user-page--history particle-network-surface particle-network-surface--game absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto bg-[#0b1210] px-4 py-5 text-slate-100 sm:px-6 lg:px-8 lg:py-7" aria-label={copy.pageLabel}>
      <ParticleNetworkBackground variant="history" />
      <div className="relative z-[1] mx-auto max-w-[1220px]">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#30453a]/65 pb-6 sm:flex-row sm:items-end sm:justify-between" data-tour="history-header">
          <div className="flex items-start gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#6ca7ef]/12 text-[#91b9f4] ring-1 ring-[#6ca7ef]/25"><AppIcon className="h-6 w-6" name="history" /></span>
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#91b9f4]">{copy.eyebrow}</p><h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">{copy.title}</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{copy.subtitle}</p></div>
          </div>
          <span className="text-xs font-semibold text-slate-500">{copy.recordCount(saves.length)}</span>
        </header>

        <div className="mb-5 flex justify-end" data-tour="history-search">
          <label className="relative w-full sm:w-[340px]">
            <span className="sr-only">{copy.searchLabel}</span>
            <AppIcon className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" name="search" />
            <input className="min-h-11 w-full rounded-xl border border-[#34483c] bg-[#111a16] px-4 pr-10 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[#55dc91] focus:ring-2 focus:ring-[#55dc91]/10" placeholder={copy.searchPlaceholder} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
          </label>
        </div>

        <div data-tour="history-records">
          {feedback ? <div className="mb-4 rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100" role="alert">{feedback}</div> : null}

          {status === 'loading' ? <HistorySkeleton copy={copy} /> : null}
          {status === 'error' ? <HistoryState actionLabel={copy.retry} description={copy.errorDescription} icon="restartAlt" onAction={loadSaves} title={copy.errorTitle} /> : null}
          {status === 'unauthenticated' ? <HistoryState description={copy.loginDescription} icon="lock" title={copy.loginTitle} /> : null}
          {status === 'ready' && saves.length === 0 ? <HistoryState actionLabel={copy.refresh} description={copy.emptyDescription} icon="sprout" onAction={onStartGrowing ?? loadSaves} title={copy.emptyTitle} /> : null}
          {status === 'ready' && saves.length > 0 && filtered.length === 0 ? <HistoryState actionLabel={copy.clearSearch} description={copy.noMatchDescription} icon="search" onAction={() => setQuery('')} title={copy.noMatchTitle} /> : null}
          {status === 'ready' && visibleSaves.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleSaves.map((save) => <SaveCard copy={copy} key={save.id} language={language} save={save} visibilityBusy={visibilityBusyId === save.id} onDelete={requestDelete} onOpen={setSelectedSave} onToggleVisibility={toggleVisibility} />)}
            </div>
          ) : null}

          {status === 'ready' && filtered.length > 0 ? <HistoryPagination copy={copy} currentPage={currentPage} pageCount={pageCount} onPageChange={setPage} /> : null}
        </div>
      </div>
      <HistoryDetailModal copy={copy} language={language} save={selectedSave} onClose={() => setSelectedSave(null)} onDelete={requestDelete} onOpenGameState={onOpenGameState} />
      <DeleteConfirmModal copy={copy} error={deleteError} language={language} save={deleteTarget} status={deleteStatus} onCancel={() => { if (deleteStatus === 'idle') { setDeleteTarget(null); setDeleteError('') } }} onConfirm={confirmDelete} />
    </section>
  )
}
