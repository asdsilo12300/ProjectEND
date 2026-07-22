import { useEffect, useMemo, useState } from 'react'
import { Panel } from '../components/Panel'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { AppIcon } from '../icons/IconifyIcon'
import { createSimulatorComment, getSimulatorComments, resolveAssetUrl } from '../../lib/api'

function displayName(user) {
  return user?.username ?? user?.email?.split('@')[0] ?? 'Learner'
}

function avatarLabel(user) {
  return displayName(user).slice(0, 1).toUpperCase()
}

function CommentAvatar({ className = '', user }) {
  const avatarUrl = user?.avatar_url ? resolveAssetUrl(user.avatar_url) : null

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-sky-100/25 bg-[#8fc7d9] text-sm font-bold text-[#071013] ${className}`}
      aria-hidden="true"
    >
      {avatarLabel(user)}
      {avatarUrl && (
        <img
          className="absolute inset-0 h-full w-full object-cover object-center"
          src={avatarUrl}
          alt=""
          onError={(event) => { event.currentTarget.hidden = true }}
        />
      )}
    </span>
  )
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

export function CommentsPanel({ currentUser, onAuthRequired, simulatorId, windows, setWindows, title = 'Comments' }) {
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
      <Panel id="comments" title={title} windows={windows} setWindows={setWindows} className="comments-panel w-[370px]">
        <div className="grid max-h-56 gap-2.5 overflow-y-auto pr-1">
          {!simulatorId && (
            <div className="rounded-md border border-sky-200/15 bg-[#132026]/78 px-3 py-4 text-center text-xs text-slate-300">
              Select a planted simulation to open comments.
            </div>
          )}

          {simulatorId && status === 'loading' && (
            <LoadingSkeleton count={3} label="Loading comments" variant="list" />
          )}

          {simulatorId && status !== 'loading' && visibleComments.length === 0 && !error && (
            <div className="rounded-md border border-sky-200/15 bg-[#132026]/78 px-3 py-4 text-center text-xs text-slate-300">
              No observations yet. Start the discussion.
            </div>
          )}

          {visibleComments.map((comment) => {
            const author = comment.user ?? {}

            return (
              <article className="rounded-md border border-sky-200/15 bg-[#132026]/82 p-2.5" key={comment.id}>
                <div className="mb-2 flex items-center gap-3">
                  <CommentAvatar className="h-8 w-8" user={author} />
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

        <form className="mt-3 flex items-end gap-2.5 rounded-lg border border-sky-200/15 bg-[#122026]/86 p-2.5" onSubmit={submitComment}>
          <CommentAvatar className="mb-1 h-8 w-8" user={avatarUser} />
          <label className="min-w-0 flex-1">
            <span className="sr-only">Comment</span>
            <textarea
              className="min-h-10 w-full resize-none rounded-lg border border-sky-200/15 bg-[#071013]/75 px-3 py-2 text-xs leading-5 text-slate-100 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-200 disabled:cursor-not-allowed disabled:opacity-55"
              disabled={!simulatorId || status === 'posting'}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={simulatorId ? 'Write a public observation...' : 'Select a planted simulation first'}
              value={draft}
            />
          </label>
          <button
            className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#8fc7d9] text-[#071013] transition hover:bg-[#a8d5e3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
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
