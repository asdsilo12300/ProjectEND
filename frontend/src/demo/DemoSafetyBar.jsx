import { AppIcon } from '../game/icons/FontAwesomeIcon'

export function DemoSafetyBar({ onExit, onSignIn }) {
  return (
    <aside
      aria-label="Interactive demo session"
      className="fixed bottom-4 left-1/2 z-[240] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2 rounded-xl border border-amber-200/25 bg-[#12160f]/95 p-2 pl-3 text-slate-100 shadow-[0_16px_46px_rgba(0,0,0,.5)] backdrop-blur-xl"
      data-demo-session
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-300/15 text-amber-200">
        <AppIcon name="shield" className="text-sm" />
      </span>
      <span className="min-w-0 pr-1">
        <strong className="block text-[11px] font-black uppercase tracking-[.14em] text-amber-100">Interactive demo</strong>
        <span className="block truncate text-[10px] text-slate-300">Changes are temporary and never reach real accounts.</span>
      </span>
      <button
        className="h-8 shrink-0 rounded-lg border border-white/10 bg-white/[.055] px-3 text-[11px] font-bold text-slate-100 transition hover:bg-white/[.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
        type="button"
        onClick={onExit}
      >
        Exit demo
      </button>
      <button
        className="h-8 shrink-0 rounded-lg bg-[#a5d98b] px-3 text-[11px] font-black text-[#101510] transition hover:bg-[#b7e6a0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-100"
        type="button"
        onClick={onSignIn}
      >
        Sign in
      </button>
    </aside>
  )
}
