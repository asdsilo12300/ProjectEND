import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppIcon } from '../game/icons/FontAwesomeIcon'
import { createIssueReport, getIssueAttachment, getIssueReport, getIssueReports } from '../lib/api'
import { getAppLanguage } from '../i18n/appI18n'
import './IssueReportsPage.css'

const copy = {
  th: {
    title: 'ศูนย์ช่วยเหลือและแจ้งปัญหา', subtitle: 'ส่งรายละเอียดให้ผู้ดูแลระบบและติดตามความคืบหน้าได้จากที่เดียว',
    report: 'แจ้งปัญหา', mine: 'รายการของฉัน', category: 'หมวดหมู่', subject: 'หัวข้อปัญหา', detail: 'รายละเอียด', photos: 'รูปประกอบ',
    submit: 'ตรวจสอบก่อนส่ง', cancel: 'ยกเลิก', confirm: 'ยืนยันส่งรายงาน', immutable: 'เมื่อส่งแล้วจะไม่สามารถแก้ไขหรือลบรายงานและหลักฐานได้',
    success: 'ส่งรายงานเรียบร้อย', reference: 'รหัสอ้างอิง', empty: 'ยังไม่มีรายงานปัญหา', latest: 'ความคืบหน้าล่าสุด', timeline: 'ลำดับการดำเนินการ', close: 'ปิด', loading: 'กำลังโหลดรายงาน…',
  },
  en: {
    title: 'Support & problem reports', subtitle: 'Send evidence to the administrators and track progress in one place.',
    report: 'Report a problem', mine: 'My reports', category: 'Category', subject: 'Subject', detail: 'Description', photos: 'Screenshots',
    submit: 'Review before sending', cancel: 'Cancel', confirm: 'Send report', immutable: 'Once submitted, the report and evidence cannot be edited or deleted.',
    success: 'Report submitted', reference: 'Reference code', empty: 'You have not submitted any reports.', latest: 'Latest update', timeline: 'Progress timeline', close: 'Close', loading: 'Loading reports…',
  },
}

const categories = {
  simulation: ['ระบบจำลอง', 'Simulation'], interface: ['UI / การแสดงผล', 'Interface'], performance: ['ประสิทธิภาพ', 'Performance'],
  account: ['บัญชี', 'Account'], content: ['เนื้อหา', 'Content'], other: ['อื่น ๆ', 'Other'],
}
const statuses = {
  new: ['ใหม่', 'New'], under_review: ['กำลังพิจารณา', 'Under review'], in_progress: ['กำลังแก้ไข', 'In progress'], resolved: ['แก้ไขแล้ว', 'Resolved'], closed: ['ปิดเรื่อง', 'Closed'],
}

function label(source, key, language) { return source[key]?.[language === 'th' ? 0 : 1] ?? key }
function date(value, language) { return value ? new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—' }

function ProtectedImage({ reportId, attachment, className = '' }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let active = true; let objectUrl = ''
    getIssueAttachment(reportId, attachment.id).then((blob) => { objectUrl = URL.createObjectURL(blob); if (active) setSrc(objectUrl) }).catch(() => {})
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [attachment.id, reportId])
  return src ? <img className={className} src={src} alt={attachment.original_name} /> : <span className={`${className} issue-evidence-placeholder`}><AppIcon name="camera" /></span>
}

export function IssueReportsPage({ onBack }) {
  const language = getAppLanguage() === 'th' ? 'th' : 'en'; const t = copy[language]
  const [tab, setTab] = useState('report'); const [reports, setReports] = useState([]); const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null); const [confirming, setConfirming] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState(null)
  const [form, setForm] = useState({ category: 'simulation', subject: '', description: '' }); const [files, setFiles] = useState([])
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files])
  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews])

  const loadReports = useCallback(async () => { setLoading(true); setError(''); try { const payload = await getIssueReports(); setReports(payload.data ?? []) } catch (e) { setError(e.message) } finally { setLoading(false) } }, [])
  useEffect(() => {
    if (tab !== 'mine') return undefined
    const timer = window.setTimeout(loadReports, 0)
    return () => window.clearTimeout(timer)
  }, [loadReports, tab])
  function chooseFiles(event) {
    const incoming = [...event.target.files].filter((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 8 * 1024 * 1024)
    setFiles((current) => [...current, ...incoming].slice(0, 5)); event.target.value = ''
  }
  async function submit() {
    setBusy(true); setError('')
    try {
      const data = new FormData(); Object.entries(form).forEach(([key, value]) => data.append(key, value)); files.forEach((file) => data.append('attachments[]', file))
      const payload = await createIssueReport(data); setSuccess(payload.data); setConfirming(false); setFiles([]); setForm({ category: 'simulation', subject: '', description: '' })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function openReport(report) { setLoading(true); try { const payload = await getIssueReport(report.id); setSelected(payload.data) } catch (e) { setError(e.message) } finally { setLoading(false) } }

  return <section className="issue-page">
    <div className="issue-page__ambient" />
    <header className="issue-page__hero"><button type="button" onClick={onBack}><AppIcon name="arrowBack" />{language === 'th' ? 'กลับ' : 'Back'}</button><div><span>SUPPORT CENTER</span><h1>{t.title}</h1><p>{t.subtitle}</p></div></header>
    <div className="issue-page__tabs" role="tablist"><button className={tab === 'report' ? 'is-active' : ''} onClick={() => setTab('report')} type="button"><AppIcon name="warning" />{t.report}</button><button className={tab === 'mine' ? 'is-active' : ''} onClick={() => setTab('mine')} type="button"><AppIcon name="history" />{t.mine}</button></div>
    {error && <div className="issue-page__error" role="alert"><AppIcon name="warning" />{error}</div>}
    {tab === 'report' ? <div className="issue-report-layout">
      <form className="issue-form" onSubmit={(event) => { event.preventDefault(); setConfirming(true) }}>
        <div className="issue-form__intro"><span><AppIcon name="shield" /></span><div><h2>{t.report}</h2><p>{t.immutable}</p></div></div>
        <label>{t.category}<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{Object.keys(categories).map((key) => <option value={key} key={key}>{label(categories, key, language)}</option>)}</select></label>
        <label>{t.subject}<input required maxLength="160" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
        <label>{t.detail}<textarea required maxLength="10000" rows="7" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <div className="issue-upload"><div><strong>{t.photos}</strong><small>JPEG, PNG, WebP · 5 max · 8 MB</small></div><label className="issue-upload__button"><AppIcon name="camera" />{language === 'th' ? 'เลือกรูป' : 'Choose images'}<input hidden multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFiles} /></label></div>
        {previews.length > 0 && <div className="issue-preview-grid">{previews.map(({ file, url }, index) => <figure key={`${file.name}-${index}`}><img src={url} alt="" /><button type="button" aria-label="Remove" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}><AppIcon name="close" /></button></figure>)}</div>}
        <button className="issue-primary" type="submit" disabled={!form.subject.trim() || !form.description.trim()}><AppIcon name="send" />{t.submit}</button>
      </form>
      <aside className="issue-evidence-note"><AppIcon name="lock" /><h3>{language === 'th' ? 'หลักฐานถูกเก็บเป็นส่วนตัว' : 'Your evidence stays private'}</h3><p>{language === 'th' ? 'เฉพาะคุณและผู้ดูแลระบบเท่านั้นที่เปิดดูรูปได้' : 'Only you and administrators can access the attached images.'}</p></aside>
    </div> : <div className="issue-list">{loading ? <div className="issue-empty">{t.loading}</div> : reports.length === 0 ? <div className="issue-empty"><AppIcon name="check" /><h2>{t.empty}</h2></div> : reports.map((report) => <button type="button" className="issue-card" key={report.id} onClick={() => openReport(report)}><span className={`issue-status is-${report.status}`}>{label(statuses, report.status, language)}</span><div><small>{report.reference_code} · {date(report.created_at, language)}</small><h2>{report.subject}</h2><p>{label(categories, report.category, language)}{report.latest_update?.public_message ? ` · ${report.latest_update.public_message}` : ''}</p></div><AppIcon name="arrowForward" /></button>)}</div>}

    {confirming && <div className="issue-modal-backdrop"><div className="issue-confirm" role="dialog" aria-modal="true"><span><AppIcon name="send" /></span><h2>{t.confirm}</h2><p>{t.immutable}</p><dl><div><dt>{t.category}</dt><dd>{label(categories, form.category, language)}</dd></div><div><dt>{t.subject}</dt><dd>{form.subject}</dd></div><div><dt>{t.photos}</dt><dd>{files.length}</dd></div></dl><footer><button type="button" onClick={() => setConfirming(false)}>{t.cancel}</button><button className="issue-primary" disabled={busy} onClick={submit} type="button">{busy ? '…' : t.confirm}</button></footer></div></div>}
    {success && <div className="issue-modal-backdrop"><div className="issue-confirm is-success" role="dialog" aria-modal="true"><span><AppIcon name="check" /></span><h2>{t.success}</h2><p>{t.reference}: <strong>{success.reference_code}</strong></p><button className="issue-primary" type="button" onClick={() => { setSuccess(null); setTab('mine') }}>{t.mine}</button></div></div>}
    {selected && <div className="issue-modal-backdrop"><article className="issue-detail" role="dialog" aria-modal="true"><header><div><span className={`issue-status is-${selected.status}`}>{label(statuses, selected.status, language)}</span><h2>{selected.subject}</h2><p>{selected.reference_code} · {date(selected.created_at, language)}</p></div><button type="button" onClick={() => setSelected(null)} aria-label={t.close}><AppIcon name="close" /></button></header><div className="issue-detail__body"><section><h3>{t.detail}</h3><p>{selected.description}</p>{selected.attachments?.length > 0 && <div className="issue-detail__gallery">{selected.attachments.map((attachment) => <ProtectedImage key={attachment.id} reportId={selected.id} attachment={attachment} />)}</div>}</section><aside><h3>{t.timeline}</h3><ol><li><i /><div><strong>{label(statuses, 'new', language)}</strong><time>{date(selected.created_at, language)}</time></div></li>{selected.updates?.map((update) => <li key={update.id}><i /><div><strong>{label(statuses, update.to_status, language)}</strong>{update.public_message && <p>{update.public_message}</p>}<time>{date(update.created_at, language)}</time></div></li>)}</ol></aside></div></article></div>}
  </section>
}
