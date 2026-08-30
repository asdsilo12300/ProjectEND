import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { getPestKnowledge } from '../data/pestKnowledge'
import { AppIcon } from '../icons/FontAwesomeIcon'

function KnowledgeList({ icon, items, title, tone = 'emerald' }) {
  const toneClasses = tone === 'amber'
    ? 'border-amber-200/12 bg-amber-300/[0.045] text-amber-200'
    : 'border-emerald-200/12 bg-emerald-300/[0.045] text-emerald-200'

  return (
    <section className={`rounded-xl border p-3 ${toneClasses}`}>
      <strong className="flex items-center gap-2 text-xs text-lime-50">
        <AppIcon className="h-3.5 w-3.5" name={icon} />
        {title}
      </strong>
      <ul className="mt-2 grid gap-1.5 text-[11px] leading-4 text-slate-300">
        {items.map((item) => (
          <li className="flex gap-2" key={item}>
            <span aria-hidden="true" className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function PestKnowledgeModal({ language = 'en', onClose, pest }) {
  const copy = (english, thai) => language === 'th' ? thai : english
  const knowledge = useMemo(() => getPestKnowledge(pest, language), [language, pest])

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  if (!pest) return null

  const risk = Math.max(0, Math.min(100, Number(pest.value) || 0))

  return createPortal(
    <div
      className="fixed inset-0 z-[185] grid place-items-center bg-black/70 px-3 py-4 backdrop-blur-[4px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="presentation"
    >
      <section
        aria-labelledby="pest-knowledge-title"
        aria-modal="true"
        className="flex max-h-[84vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-lime-100/20 bg-[#101511] text-slate-100 shadow-[0_28px_90px_rgba(0,0,0,.68)]"
        data-i18n-skip="true"
        role="dialog"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-lime-100/10 px-4 py-3">
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">{copy('Pest knowledge', 'ข้อมูลศัตรูพืช')}</span>
            <strong className="mt-0.5 block truncate text-base text-lime-50" id="pest-knowledge-title">{knowledge.name}</strong>
          </span>
          <button
            aria-label={copy('Close pest guide', 'ปิดข้อมูลศัตรูพืช')}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-lime-100/15 bg-white/[0.045] text-slate-300 transition hover:bg-white/[0.09] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            onClick={onClose}
            type="button"
          >
            <AppIcon className="h-4 w-4" name="close" />
          </button>
        </header>

        <div className="game-themed-scrollbar min-h-0 overflow-y-auto p-4">
          <div className="grid gap-4 sm:grid-cols-[142px_minmax(0,1fr)]">
            <figure className="overflow-hidden rounded-xl border border-lime-100/15 bg-[#182019]">
              <div className="aspect-[4/3] overflow-hidden sm:aspect-square">
                {knowledge.imageUrl ? (
                  <img className="h-full w-full object-cover" src={knowledge.imageUrl} alt={knowledge.photo?.alt || knowledge.shortName} draggable="false" />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-[#182019] text-[#9bcf82]" aria-label={knowledge.shortName}>
                    <AppIcon className="h-12 w-12" name="pest" />
                  </span>
                )}
              </div>
              {knowledge.photo?.sourceUrl && (
                <figcaption className="border-t border-lime-100/10 bg-black/25 px-2 py-1.5 text-[8px] leading-3 text-slate-400">
                  <span>{copy('Photo', 'ภาพ')}: </span>
                  <a className="text-sky-300 hover:text-sky-200" href={knowledge.photo.sourceUrl} rel="noreferrer" target="_blank">{knowledge.photo.credit || copy('View reference', 'ดูแหล่งอ้างอิง')}</a>
                  {knowledge.photo.license && <span> · </span>}
                  {knowledge.photo.license && knowledge.photo.licenseUrl ? (
                    <a className="text-sky-300 hover:text-sky-200" href={knowledge.photo.licenseUrl} rel="noreferrer" target="_blank">{knowledge.photo.license}</a>
                  ) : knowledge.photo.license ? <span>{knowledge.photo.license}</span> : null}
                </figcaption>
              )}
            </figure>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-amber-200/15 bg-amber-300/10 px-2.5 py-1 text-xs font-bold text-amber-100">{knowledge.category}</span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${pest.active ? 'border-red-300/25 bg-red-400/12 text-red-200' : 'border-sky-300/15 bg-sky-300/10 text-sky-200'}`}>
                  {pest.active ? copy('Active now', 'กำลังระบาด') : copy(`Current risk ${risk}%`, `ความเสี่ยงปัจจุบัน ${risk}%`)}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-[106px_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs leading-5">
                <dt className="text-slate-500">{copy('Group / family', 'กลุ่ม / วงศ์')}</dt>
                <dd className="truncate italic text-lime-50" title={knowledge.scientificName}>{knowledge.scientificName}</dd>
                <dt className="text-slate-500">{copy('Simulation status', 'สถานะในระบบจำลอง')}</dt>
                <dd className="text-slate-200">{pest.active ? copy('Treatment recommended now', 'แนะนำให้กำจัดในตอนนี้') : copy('Monitor at the next update', 'ติดตามในการอัปเดตครั้งถัดไป')}</dd>
              </dl>
              <p className="mt-3 text-xs leading-5 text-slate-300">{knowledge.summary}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <KnowledgeList icon="eye" items={knowledge.signs} title={copy('What to look for', 'อาการที่ควรสังเกต')} />
            <KnowledgeList icon="warning" items={knowledge.favorableConditions} title={copy('Conditions that increase risk', 'สภาพที่เพิ่มความเสี่ยง')} tone="amber" />
          </div>

          <section className="mt-4 rounded-xl border border-sky-200/12 bg-sky-300/[0.045] p-3.5">
            <strong className="flex items-center gap-2 text-sm text-lime-50">
              <AppIcon className="h-4 w-4 text-sky-200" name="shield" />
              {copy('Prevention and routine care', 'การป้องกันและดูแลประจำ')}
            </strong>
            <ol className="mt-2 grid gap-2">
              {knowledge.prevention.map((instruction, index) => (
                <li className="flex gap-2.5 text-xs leading-5 text-slate-300" key={instruction}>
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-300/12 text-[10px] font-black text-sky-200">{index + 1}</span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-4 rounded-xl border border-lime-100/12 bg-[#151c16] p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span>
                <strong className="block text-sm text-lime-50">{copy('Items that can remove this pest', 'ไอเทมที่ใช้กำจัดได้')}</strong>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-400">{copy('Select the item in Lab assets, then click the matching pest on the plant.', 'เลือกไอเทมจากคลัง แล้วกดศัตรูพืชชนิดที่ตรงกันบนต้น')}</span>
              </span>
              <span className="rounded-md bg-violet-300/10 px-2 py-1 text-[10px] font-bold text-violet-200">{copy('Simulation values', 'ค่าภายในระบบจำลอง')}</span>
            </div>
            <div className={`mt-3 grid gap-2 ${knowledge.treatments.length > 1 ? 'sm:grid-cols-2' : ''}`}>
              {knowledge.treatments.length === 0 ? (
                <p className="rounded-lg border border-dashed border-lime-100/15 px-3 py-4 text-center text-xs text-slate-400">
                  {copy('No treatment item has been configured by the administrator.', 'ผู้ดูแลระบบยังไม่ได้กำหนดไอเทมสำหรับกำจัดศัตรูพืชชนิดนี้')}
                </p>
              ) : knowledge.treatments.map((treatment) => (
                <article className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-lime-100/10 bg-black/20 p-2" key={treatment.id}>
                  {treatment.imageUrl ? <img className="h-[52px] w-[52px] rounded-md bg-[#9bcf82] object-contain" src={treatment.imageUrl} alt="" draggable="false" /> : <span className="grid h-[52px] w-[52px] place-items-center rounded-md bg-[#9bcf82]/15 text-[#9bcf82]"><AppIcon className="h-6 w-6" name="tool" /></span>}
                  <span className="min-w-0">
                    <strong className="block truncate text-xs text-lime-50">{treatment.name}</strong>
                    <span className="mt-0.5 block text-[10px] leading-4 text-slate-400">{treatment.detail}</span>
                  </span>
                  <span className="rounded-md border border-emerald-200/15 bg-emerald-300/10 px-2 py-1 text-center">
                    <strong className="block text-xs text-emerald-200">{treatment.success}%</strong>
                    <small className="block text-[9px] text-slate-400">{copy('success', 'สำเร็จ')}</small>
                  </span>
                </article>
              ))}
            </div>
            <p className="mt-2.5 flex gap-2 rounded-lg border border-amber-200/10 bg-amber-300/[0.045] px-2.5 py-2 text-[10px] leading-4 text-amber-50/80">
              <AppIcon className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" name="help" />
              {copy('Success percentages describe this simulation only; they are not real-world pesticide efficacy claims.', 'เปอร์เซ็นต์ความสำเร็จเป็นค่าของระบบจำลองเท่านั้น ไม่ใช่การรับรองประสิทธิภาพของสารกำจัดศัตรูพืชในชีวิตจริง')}
            </p>
          </section>

          {knowledge.sources.length > 0 && <section className="mt-4 border-t border-lime-100/10 pt-3">
            <strong className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{copy('Sources and further reading', 'แหล่งอ้างอิงและอ่านเพิ่มเติม')}</strong>
            <div className="mt-2 grid gap-1.5">
              {knowledge.sources.map((source) => (
                <a
                  className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-xs text-sky-300 transition hover:bg-white/[0.05] hover:text-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
                  href={source.url}
                  key={source.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="min-w-0 truncate">{source.label}</span>
                  <AppIcon className="h-3.5 w-3.5 shrink-0" name="arrowForward" />
                </a>
              ))}
            </div>
          </section>}
        </div>
      </section>
    </div>,
    document.body,
  )
}
