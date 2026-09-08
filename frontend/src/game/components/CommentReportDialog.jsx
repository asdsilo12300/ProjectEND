import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../icons/FontAwesomeIcon'

export function CommentReportMenu({ disabled = false, language = 'en', onReport }) {
  const detailsRef = useRef(null)
  const isThai = language === 'th'

  return (
    <details className="comment-report-menu relative ml-auto shrink-0" ref={detailsRef}>
      <summary
        aria-label={isThai ? 'เปิดเมนูความคิดเห็น' : 'Open comment menu'}
        className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300 [&::-webkit-details-marker]:hidden"
      >
        <AppIcon className="h-4 w-4" name="more" />
      </summary>
      <div className="comment-report-menu__popover absolute right-0 top-8 z-30 min-w-32 rounded-lg border border-rose-200/20 bg-[#151918] p-1 shadow-[0_12px_34px_rgba(0,0,0,.55)]">
        <button
          className="comment-report-menu__action flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-bold text-white transition hover:bg-rose-400/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300 disabled:opacity-65"
          disabled={disabled}
          type="button"
          onClick={() => {
            detailsRef.current?.removeAttribute('open')
            onReport?.()
          }}
        >
          <AppIcon className="h-3.5 w-3.5" name="warning" />
          {disabled ? (isThai ? 'รายงานแล้ว' : 'Reported') : (isThai ? 'รายงาน' : 'Report')}
        </button>
      </div>
    </details>
  )
}

export function CommentReportDialog({ busy = false, error = '', language = 'en', onClose, onSubmit }) {
  const [reason, setReason] = useState('inappropriate')
  const [details, setDetails] = useState('')
  const firstOptionRef = useRef(null)
  const isThai = language === 'th'

  useEffect(() => {
    firstOptionRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  return createPortal(
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/75 px-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose?.() }}>
      <form
        aria-labelledby="comment-report-title"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-200/20 bg-[#111614] text-white shadow-[0_28px_80px_rgba(0,0,0,.65)]"
        role="dialog"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit?.({ reason, details: details.trim() })
        }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <span className="text-xs font-black uppercase tracking-[.12em] text-rose-300">{isThai ? 'ความปลอดภัย' : 'Safety'}</span>
            <h2 className="mt-1 text-xl font-black" id="comment-report-title">{isThai ? 'รายงานความคิดเห็น' : 'Report comment'}</h2>
            <p className="mt-1 text-sm leading-6 text-white/75">{isThai ? 'เลือกเหตุผลที่ตรงกับปัญหามากที่สุด' : 'Choose the reason that best matches the problem.'}</p>
          </div>
          <button aria-label={isThai ? 'ปิดหน้าต่างรายงาน' : 'Close report dialog'} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 hover:bg-white/10" disabled={busy} onClick={onClose} type="button"><AppIcon className="h-4 w-4" name="close" /></button>
        </header>
        <fieldset className="grid gap-2 px-5 py-4">
          <legend className="sr-only">{isThai ? 'หัวข้อการรายงาน' : 'Report reason'}</legend>
          <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 ${reason === 'inappropriate' ? 'border-rose-300/50 bg-rose-300/10' : 'border-white/10 bg-white/[.03]'}`}>
            <input checked={reason === 'inappropriate'} name="comment-report-reason" onChange={() => setReason('inappropriate')} ref={firstOptionRef} type="radio" value="inappropriate" />
            <span className="font-bold">{isThai ? 'ข้อความไม่เหมาะสม' : 'Inappropriate message'}</span>
          </label>
          <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 ${reason === 'other' ? 'border-rose-300/50 bg-rose-300/10' : 'border-white/10 bg-white/[.03]'}`}>
            <input checked={reason === 'other'} name="comment-report-reason" onChange={() => setReason('other')} type="radio" value="other" />
            <span className="font-bold">{isThai ? 'อื่นๆ' : 'Other'}</span>
          </label>
          {reason === 'other' && <label className="mt-2 grid gap-2 text-sm font-bold"><span>{isThai ? 'ระบุรายละเอียด' : 'Describe the issue'}</span><textarea autoFocus className="min-h-28 resize-y rounded-xl border border-white/15 bg-black/25 px-3 py-2 font-normal text-white outline-none placeholder:text-white/45 focus:border-rose-300" maxLength={500} placeholder={isThai ? 'เขียนรายละเอียดที่ต้องการแจ้ง' : 'Describe what should be reviewed'} required value={details} onChange={(event) => setDetails(event.target.value)} /></label>}
          {error && <p className="rounded-lg border border-red-300/25 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">{error}</p>}
        </fieldset>
        <footer className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button className="min-h-11 rounded-lg border border-white/15 px-4 font-bold hover:bg-white/10" disabled={busy} onClick={onClose} type="button">{isThai ? 'ยกเลิก' : 'Cancel'}</button>
          <button className="min-h-11 rounded-lg bg-rose-400 px-5 font-black text-[#250b0b] hover:bg-rose-300 disabled:opacity-50" disabled={busy || (reason === 'other' && !details.trim())} type="submit">{busy ? (isThai ? 'กำลังส่ง…' : 'Sending…') : (isThai ? 'ส่งรายงาน' : 'Submit report')}</button>
        </footer>
      </form>
    </div>,
    document.body,
  )
}
