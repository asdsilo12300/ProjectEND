import { useEffect, useMemo, useState } from 'react'
import { deletePlantHistory, getPlantHistories, getToken, resolveAssetUrl } from '../../lib/api'
import { AppIcon } from '../icons/IconifyIcon'

const fallbackSaves = [
  { id: 'demo-1', plant: { name_en: 'Elephant Ear' }, final_stage: { stage_name: 'Young Plant' }, created_at: '2026-07-02T14:32:00.000Z', total_score: 88, final_health: 96, duration_days: 3, analysis_result: 'Environment is stable and the plant is growing well.', direction: 'Keep the current care pattern.' },
  { id: 'demo-2', plant: { name_en: 'Elephant Ear' }, final_stage: { stage_name: 'Sprout' }, created_at: '2026-07-01T09:15:00.000Z', total_score: 64, final_health: 74, duration_days: 2, analysis_result: 'High soil moisture slowed growth.', direction: 'Control moisture before the next cycle.' },
  { id: 'demo-3', plant: { name_en: 'Elephant Ear' }, final_stage: { stage_name: 'Seedling' }, created_at: '2026-06-30T21:08:00.000Z', total_score: 52, final_health: 61, duration_days: 1, analysis_result: 'Low water caused plant stress.', direction: 'Add a small amount of water.' },
]

function formatDate(value) {
  if (!value) return 'Not saved yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function saveTitle(save) {
  return save.plant?.name_th || save.plant?.name_en || save.title || 'Plant Simulation'
}

function saveStage(save) {
  return save.final_stage?.stage_name || save.current_stage?.stage_name || 'Seedling'
}

function saveSubtitle(save) {
  if (save.subtitle) return save.subtitle
  const days = Number(save.duration_days || 1)
  return `${saveStage(save)} - ${days} day${days > 1 ? 's' : ''}`
}

function PreviewScene({ imageUrl, score = 0, stage }) {
  if (imageUrl) {
    return (
      <div className="relative h-32 overflow-hidden rounded-t-xl border-b border-[#24335d] bg-[#080b09]">
        <img className="h-full w-full object-cover" src={resolveAssetUrl(imageUrl)} alt="Saved plant snapshot" />
        <span className="absolute right-3 top-3 rounded-md bg-[#172344]/80 px-2 py-1 text-[10px] font-bold text-slate-200">{stage}</span>
      </div>
    )
  }

  const progress = Math.min(100, Math.max(0, Number(score) || 0))
  const stemHeight = 16 + progress * 0.42
  const leafScale = 0.6 + progress / 135

  return (
    <div className="relative h-32 overflow-hidden rounded-t-xl border-b border-[#24335d] bg-[#cdeefd]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 144" preserveAspectRatio="none" aria-hidden="true">
        <rect width="360" height="144" fill="#cdeefd" />
        <circle cx="72" cy="24" r="6" fill="white" opacity="0.9" />
        <circle cx="84" cy="22" r="9" fill="white" opacity="0.92" />
        <circle cx="98" cy="25" r="6" fill="white" opacity="0.85" />
        <circle cx="188" cy="22" r="13" fill="white" opacity="0.96" />
        <circle cx="206" cy="27" r="8" fill="white" opacity="0.88" />
        <circle cx="320" cy="27" r="6" fill="white" opacity="0.78" />
        <path d="M0 96 C35 88 55 65 83 76 C110 87 120 104 158 91 C194 79 222 107 256 88 C294 67 318 83 360 78 L360 144 L0 144 Z" fill="#88a900" />
        <path d="M0 106 C40 109 57 87 100 95 C136 102 151 114 187 104 C228 93 241 117 282 103 C316 91 334 104 360 97 L360 144 L0 144 Z" fill="#c1df77" opacity="0.82" />
      </svg>
      <div className="absolute left-1/2 top-[58px] -translate-x-1/2" style={{ transform: `translateX(-50%) scale(${leafScale})` }}>
        <div className="mx-auto w-1.5 rounded-full bg-[#557d34]" style={{ height: `${stemHeight}px` }} />
        <div className="absolute left-1/2 top-2 h-7 w-11 -translate-x-1/2 -rotate-12 rounded-[70%_20%_70%_20%] bg-[#5ea43f] shadow-[inset_0_0_0_2px_rgba(216,243,201,.24)]" />
        <div className="absolute left-1/2 top-7 h-6 w-10 -translate-x-[80%] rotate-12 rounded-[70%_20%_70%_20%] bg-[#78bd58] shadow-[inset_0_0_0_2px_rgba(216,243,201,.22)]" />
      </div>
      <span className="absolute right-3 top-3 rounded-md bg-[#172344]/70 px-2 py-1 text-[10px] font-bold text-slate-200">{stage}</span>
    </div>
  )
}

function SaveCard({ onDelete, onOpen, save }) {
  const score = Math.min(100, Math.max(0, Number(save.total_score ?? save.growth_point) || 0))
  const health = Math.min(100, Math.max(0, Number(save.final_health ?? save.health) || 0))

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-[#172344] text-left shadow-[0_18px_36px_rgba(0,0,0,.24)] ring-1 ring-[#304066] transition hover:-translate-y-0.5 hover:ring-[#8fbf78]/60">
      <button className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200" type="button" onClick={() => onOpen(save)}>
        <PreviewScene score={score} stage={saveStage(save)} imageUrl={save.snapshot_image_url} />
        <div className="px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black text-slate-100">{saveTitle(save)}</h2>
              <p className="mt-0.5 truncate text-xs text-slate-400">{saveSubtitle(save)}</p>
              <p className="mt-1 text-[11px] text-slate-500">{formatDate(save.created_at || save.updated_at || save.started_at)}</p>
            </div>
            <div className="shrink-0 pt-7 text-right text-[11px] font-bold text-rose-400">
              <span>Sc.{score.toFixed(0)}</span>
              <span className="mx-1 text-slate-500">|</span>
              <span>Hp.{health.toFixed(0)}</span>
            </div>
          </div>
          <p className="mt-3 line-clamp-2 min-h-[32px] text-xs leading-4 text-slate-300">{save.analysis_result || 'No analysis recorded yet.'}</p>
          <p className="mt-1 truncate pr-10 text-[11px] font-semibold text-[#bdeaa5]">{save.direction || 'Continue observing the next cycle.'}</p>
        </div>
      </button>
      <button
        className="absolute bottom-3 right-3 z-20 grid h-8 w-8 place-items-center rounded-md border border-red-200/20 bg-black/35 text-red-100 opacity-75 transition hover:bg-red-500/20 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-200 group-hover:opacity-100"
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onDelete(save)
        }}
        aria-label="Delete save history"
      >
        <AppIcon className="h-4 w-4" name="trash" />
      </button>
    </article>
  )
}

function DeleteConfirmModal({ onCancel, onConfirm, save, status }) {
  if (!save) return null

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 px-4 backdrop-blur-sm" onMouseDown={onCancel}>
      <div className="animate-[saveModalIn_.2s_ease-out] w-full max-w-[380px] rounded-xl border border-red-200/20 bg-[#151110] p-5 text-center text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,.55)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-red-500/18 text-red-100">
          <AppIcon className="h-5 w-5" name="trash" />
        </div>
        <h2 className="mt-3 text-lg font-black text-red-50">Delete this save?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{saveTitle(save)} will be removed from your history.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button className="h-9 rounded-md border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]" type="button" onClick={onCancel} disabled={status === 'deleting'}>Cancel</button>
          <button className="h-9 rounded-md bg-red-500 px-4 text-sm font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={onConfirm} disabled={status === 'deleting'}>{status === 'deleting' ? 'Deleting...' : 'Delete'}</button>
        </div>
      </div>
    </div>
  )
}

function HistoryDetailModal({ onClose, onDelete, save }) {
  if (!save) return null

  const score = Number(save.total_score ?? 0)
  const health = Number(save.final_health ?? save.health ?? 0)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="animate-[saveModalIn_.22s_ease-out] w-full max-w-[720px] overflow-hidden rounded-2xl border border-lime-100/15 bg-[#111823] text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,.55)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="relative h-[300px] bg-[#080b09]">
          {save.snapshot_image_url ? (
            <img className="h-full w-full object-cover" src={resolveAssetUrl(save.snapshot_image_url)} alt="Saved plant snapshot" />
          ) : (
            <PreviewScene score={score} stage={saveStage(save)} />
          )}
          <button className="absolute right-14 top-4 grid h-8 w-8 place-items-center rounded-md border border-red-200/20 bg-black/45 text-red-100 hover:bg-red-500/20" type="button" onClick={() => onDelete(save)} aria-label="Delete save history">
            <AppIcon className="h-4 w-4" name="trash" />
          </button>
          <button className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-black/45 text-slate-100 hover:bg-black/65" type="button" onClick={onClose} aria-label="Close history details">
            <AppIcon className="h-4 w-4" name="close" />
          </button>
        </div>
        <div className="grid gap-5 p-5 md:grid-cols-[1fr_220px]">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#9bcf82]">Saved plant</p>
            <h2 className="mt-1 text-2xl font-black text-white">{saveTitle(save)}</h2>
            <p className="mt-1 text-sm text-slate-400">{saveSubtitle(save)} - {formatDate(save.created_at)}</p>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-4">
              <strong className="text-sm text-lime-50">Analysis</strong>
              <p className="mt-2 text-sm leading-6 text-slate-300">{save.analysis_result || 'No analysis recorded yet.'}</p>
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-4">
              <strong className="text-sm text-lime-50">Direction</strong>
              <p className="mt-2 text-sm leading-6 text-slate-300">{save.direction || 'Continue observing the next cycle.'}</p>
            </div>
          </div>
          <div className="grid content-start gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><span className="text-xs text-slate-400">Score</span><strong className="mt-1 block text-2xl text-lime-100">{score}</strong></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><span className="text-xs text-slate-400">Health</span><strong className="mt-1 block text-2xl text-lime-100">{health}%</strong></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><span className="text-xs text-slate-400">Duration</span><strong className="mt-1 block text-2xl text-lime-100">{save.duration_days ?? 1}d</strong></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function HistoryPage() {
  const [saves, setSaves] = useState(() => (getToken() ? [] : fallbackSaves))
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('idle')
  const [selectedSave, setSelectedSave] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteStatus, setDeleteStatus] = useState('idle')
  const pageSize = 6

  useEffect(() => {
    if (!getToken()) return undefined

    let cancelled = false

    async function loadSaves() {
      setStatus('loading')
      try {
        const payload = await getPlantHistories()
        if (cancelled) return
        setSaves(payload.data ?? [])
      } catch {
        if (!cancelled) setSaves(fallbackSaves)
      } finally {
        if (!cancelled) setStatus('idle')
      }
    }

    loadSaves()

    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return saves
    return saves.filter((save) => `${saveTitle(save)} ${saveSubtitle(save)} ${save.analysis_result ?? ''} ${save.direction ?? ''}`.toLowerCase().includes(term))
  }, [query, saves])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleSaves = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  async function confirmDelete() {
    if (!deleteTarget) return

    setDeleteStatus('deleting')
    try {
      if (getToken() && !String(deleteTarget.id).startsWith('demo-')) {
        await deletePlantHistory(deleteTarget.id)
      }
      setSaves((current) => current.filter((save) => save.id !== deleteTarget.id))
      setSelectedSave((current) => (current?.id === deleteTarget.id ? null : current))
      setDeleteTarget(null)
    } finally {
      setDeleteStatus('idle')
    }
  }

  return (
    <section className="absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto bg-[#1b1a2b] px-8 py-7 text-slate-100">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-6 flex items-center justify-between gap-5">
          <h1 className="text-3xl font-medium tracking-wide text-white">SAVE HISTORY</h1>
          <label className="relative w-[240px] max-w-full">
            <span className="sr-only">Search saved games</span>
            <AppIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200/60" name="search" />
            <input
              className="h-9 w-full rounded-sm border border-blue-400/10 bg-[#124273] px-4 pr-9 text-sm text-blue-50 outline-none placeholder:text-blue-100/55 focus:border-[#8fbf78]"
              placeholder="Search saved games..."
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
            />
          </label>
        </div>

        {status === 'loading' ? (
          <div className="grid min-h-[420px] place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-slate-300">Loading save history...</div>
        ) : visibleSaves.length ? (
          <div className="grid grid-cols-3 gap-x-6 gap-y-8 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {visibleSaves.map((save) => (
              <SaveCard key={save.id} save={save} onDelete={setDeleteTarget} onOpen={setSelectedSave} />
            ))}
          </div>
        ) : (
          <div className="grid min-h-[420px] place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-slate-300">No saved simulations found.</div>
        )}

        <div className="mt-10 flex justify-center gap-2">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => (
            <button
              key={item}
              type="button"
              className={`grid h-7 w-7 place-items-center rounded-sm text-sm font-bold transition ${
                item === currentPage ? 'bg-rose-500 text-white' : 'bg-[#124273] text-blue-100 hover:bg-[#1b5b98]'
              }`}
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <HistoryDetailModal save={selectedSave} onClose={() => setSelectedSave(null)} onDelete={setDeleteTarget} />
      <DeleteConfirmModal save={deleteTarget} status={deleteStatus} onCancel={() => deleteStatus === 'idle' && setDeleteTarget(null)} onConfirm={confirmDelete} />
    </section>
  )
}
