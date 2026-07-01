import { useEffect, useMemo, useState } from 'react'
import { Panel } from '../components/Panel'
import { AppIcon } from '../icons/IconifyIcon'
import { createSimulatorComment, getSimulatorComments } from '../../lib/api'

function displayName(user) {
  return user?.username ?? user?.email?.split('@')[0] ?? 'Learner'
}

function avatarLabel(user) {
  return displayName(user).slice(0, 1).toUpperCase()
}

function postedLabel(value) {
  if (!value) return 'Just now'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Just now'

  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CommentsPanel({ currentUser, onAuthRequired, simulatorId, windows, setWindows, title = 'Class comments', subtitle = 'student teacher discussion' }) {
  const [comments, setComments] = useState([])
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const avatarUser = useMemo(() => currentUser ?? { username: 'Learner' }, [currentUser])
  const visibleComments = simulatorId ? comments : []

  useEffect(() => {
    if (!simulatorId) return undefined


    let cancelled = false

    async function loadComments() {
      setStatus('loading')
      setError('')

      try {
        const payload = await getSimulatorComments(simulatorId)
        if (!cancelled) {
          setComments(payload.data ?? [])
          setStatus('idle')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || 'Unable to load comments')
          setStatus('idle')
        }
      }
    }

    loadComments()

    return () => {
      cancelled = true
    }
  }, [simulatorId])

  async function submitComment(event) {
    event.preventDefault()
    const text = draft.trim()

    if (!currentUser) {
      onAuthRequired?.('login')
      return
    }

    if (!simulatorId || !text) return

    setStatus('posting')
    setError('')

    try {
      const payload = await createSimulatorComment(simulatorId, text)
      setComments((value) => [...value, payload.data])
      setDraft('')
      setStatus('idle')
    } catch (postError) {
      setError(postError.message || 'Unable to post comment')
      setStatus('idle')
    }
  }

  return (
      <Panel id="comments" title={title} subtitle={subtitle} windows={windows} setWindows={setWindows} className="w-[370px]">
        <div className="grid max-h-56 gap-2.5 overflow-y-auto pr-1">
          {!simulatorId && (
            <div className="rounded-md border border-lime-100/10 bg-white/[0.035] px-3 py-4 text-center text-xs text-slate-400">
              Select a planted simulation to open comments.
            </div>
          )}

          {simulatorId && status === 'loading' && (
            <div className="rounded-md border border-lime-100/10 bg-white/[0.035] px-3 py-4 text-center text-xs text-slate-400">
              Loading comments...
            </div>
          )}

          {simulatorId && status !== 'loading' && visibleComments.length === 0 && !error && (
            <div className="rounded-md border border-lime-100/10 bg-white/[0.035] px-3 py-4 text-center text-xs text-slate-400">
              No observations yet. Start the discussion.
            </div>
          )}

          {visibleComments.map((comment) => {
            const author = comment.user ?? {}

            return (
              <article className="rounded-md border border-lime-100/10 bg-white/[0.045] p-2.5" key={comment.id}>
                <div className="mb-2 flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#9bcf82] text-sm font-bold text-[#101511]">
                    {avatarLabel(author)}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-lime-50">{displayName(author)}</h3>
                    <p className="text-[11px] text-slate-400">{author.role ?? 'Learner'} · {postedLabel(comment.created_at)}</p>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-xs leading-5 text-slate-200">{comment.comment_text}</p>
              </article>
            )
          })}
        </div>

        {error && <p className="mt-2 rounded-md border border-red-300/20 bg-red-400/10 px-3 py-2 text-[11px] text-red-100">{error}</p>}

        <form className="mt-3 flex items-end gap-2.5 rounded-lg border border-lime-100/10 bg-white/[0.045] p-2.5" onSubmit={submitComment}>
          <span className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-lime-100/20 bg-[#9bcf82] text-sm font-bold text-[#101511]" aria-hidden="true">
            {avatarLabel(avatarUser)}
          </span>
          <label className="min-w-0 flex-1">
            <span className="sr-only">Comment</span>
            <textarea
              className="min-h-10 w-full resize-none rounded-lg border border-lime-100/10 bg-black/25 px-3 py-2 text-xs leading-5 text-slate-100 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 disabled:cursor-not-allowed disabled:opacity-55"
              disabled={!simulatorId || status === 'posting'}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={simulatorId ? 'Write a public observation...' : 'Select a planted simulation first'}
              value={draft}
            />
          </label>
          <button
            className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#9bcf82] text-[#101511] transition hover:bg-[#addf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={!simulatorId || !draft.trim() || status === 'posting'}
            aria-label="Send comment"
          >
            <AppIcon className="h-4 w-4" name={status === 'posting' ? 'restartAlt' : 'send'} />
          </button>
        </form>
      </Panel>
  )
}