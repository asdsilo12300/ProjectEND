import { comments } from '../data/gameData'
import { Panel } from '../components/Panel'
import { AppIcon } from '../icons/IconifyIcon'

export function CommentsPanel({ windows, setWindows }) {
  return (
      <Panel id="comments" title="Class comments" subtitle="student teacher discussion" windows={windows} setWindows={setWindows} className="w-[370px]">
        <div className="grid max-h-56 gap-2.5 overflow-y-auto pr-1">
          {comments.map((comment) => (
            <article className="rounded-md border border-lime-100/10 bg-white/[0.045] p-2.5" key={comment.author}>
              <div className="mb-2 flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#9bcf82] text-sm font-bold text-[#101511]">
                  {comment.author.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-lime-50">{comment.author}</h3>
                  <p className="text-[11px] text-slate-400">{comment.role} · {comment.posted}</p>
                </div>
              </div>
              <p className="text-xs leading-5 text-slate-200">{comment.body}</p>
              <div className="mt-2.5 flex items-center gap-2">
                <button className="inline-flex items-center gap-1 rounded-md border border-lime-100/10 bg-white/5 px-2 py-1 text-xs text-lime-100 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200" type="button">
                  <AppIcon className="h-4 w-4" name="thumbUp" />
                  {comment.likes}
                </button>
                <button className="rounded-md px-2 py-1 text-xs text-slate-300 transition hover:bg-white/5 hover:text-lime-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200" type="button">
                  Reply
                </button>
              </div>
            </article>
          ))}
        </div>

        <form className="mt-3 flex items-end gap-2.5 rounded-lg border border-lime-100/10 bg-white/[0.045] p-2.5">
          <span className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-lime-100/20 bg-[#9bcf82] text-sm font-bold text-[#101511]" aria-hidden="true">
            L
          </span>
          <label className="min-w-0 flex-1">
            <span className="sr-only">Comment</span>
            <textarea
              className="min-h-10 w-full resize-none rounded-lg border border-lime-100/10 bg-black/25 px-3 py-2 text-xs leading-5 text-slate-100 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
              placeholder="Write a public observation..."
            />
          </label>
          <button
            className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#9bcf82] text-[#101511] transition hover:bg-[#addf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            type="button"
            aria-label="Send comment"
          >
            <AppIcon className="h-4 w-4" name="send" />
          </button>
        </form>
      </Panel>
  )
}


