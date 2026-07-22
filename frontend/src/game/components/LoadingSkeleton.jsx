function SkeletonBlock({ className = '' }) {
  return <span className={`block rounded-md bg-white/[0.065] ${className}`} aria-hidden="true" />
}

function ListSkeleton({ count }) {
  return (
    <div className="divide-y divide-lime-100/10">
      {Array.from({ length: count }, (_, index) => (
        <div className="flex items-center gap-3 px-5 py-4" key={index}>
          <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
          <span className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock className="h-3 w-2/5" />
            <SkeletonBlock className="h-2.5 w-3/4 bg-white/[0.04]" />
          </span>
          <SkeletonBlock className="h-8 w-16 shrink-0" />
        </div>
      ))}
    </div>
  )
}

function PanelSkeleton({ count }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <div className="rounded-lg border border-lime-100/10 bg-[#121715] p-4" key={index}>
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
            <span className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-3 w-1/2" />
              <SkeletonBlock className="h-2.5 w-3/4 bg-white/[0.04]" />
            </span>
          </div>
          <SkeletonBlock className="mt-4 h-9 w-full bg-white/[0.045]" />
        </div>
      ))}
    </div>
  )
}

function FeedSkeleton({ count }) {
  return (
    <div className="divide-y divide-lime-100/10">
      {Array.from({ length: count }, (_, index) => (
        <article className="px-5 py-5" key={index}>
          <div className="flex gap-3">
            <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <SkeletonBlock className="h-3.5 w-28" />
                <SkeletonBlock className="h-3 w-16 bg-white/[0.04]" />
              </div>
              <SkeletonBlock className="mt-4 h-3 w-11/12" />
              <SkeletonBlock className="mt-2 h-3 w-3/5 bg-white/[0.045]" />
              <SkeletonBlock className="mt-4 h-44 w-full rounded-lg bg-white/[0.05]" />
              <div className="mt-4 grid grid-cols-3 gap-3">
                <SkeletonBlock className="h-8" />
                <SkeletonBlock className="h-8" />
                <SkeletonBlock className="h-8" />
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function CardsSkeleton({ count }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div className="overflow-hidden rounded-2xl border border-lime-100/10 bg-[#121715]" key={index}>
          <SkeletonBlock className="h-36 rounded-none bg-white/[0.05]" />
          <div className="space-y-3 p-4">
            <SkeletonBlock className="h-4 w-2/3" />
            <SkeletonBlock className="h-3 w-1/2 bg-white/[0.04]" />
            <SkeletonBlock className="h-10 w-full bg-white/[0.045]" />
            <SkeletonBlock className="h-11 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function LoadingSkeleton({ className = '', count, label = 'Loading content', variant = 'list' }) {
  const resolvedCount = count ?? (variant === 'feed' ? 3 : variant === 'cards' ? 6 : 4)

  return (
    <div
      className={`animate-pulse motion-reduce:animate-none ${className}`}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {variant === 'feed' ? <FeedSkeleton count={resolvedCount} /> : null}
      {variant === 'cards' ? <CardsSkeleton count={resolvedCount} /> : null}
      {variant === 'panel' ? <PanelSkeleton count={resolvedCount} /> : null}
      {variant === 'list' ? <ListSkeleton count={resolvedCount} /> : null}
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function CircularLoader({ className = '', description = '', label = 'Loading' }) {
  return (
    <div className={`grid place-items-center text-center ${className}`} role="status" aria-busy="true" aria-label={label}>
      <div>
        <span className="relative mx-auto block h-16 w-16" aria-hidden="true">
          <span className="absolute inset-0 rounded-full border-2 border-lime-100/10" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-[#79ad66] border-t-[#b9e5a4] shadow-[0_0_18px_rgba(155,207,130,.15)] motion-reduce:animate-pulse" />
          <span className="absolute inset-[9px] animate-[spin_1.4s_linear_infinite_reverse] rounded-full border border-transparent border-b-[#5f8f51] border-l-lime-100/30 motion-reduce:animate-none" />
          <span className="absolute inset-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-[#b9e5a4] shadow-[0_0_12px_rgba(185,229,164,.75)] motion-reduce:animate-none" />
        </span>
        <strong className="mt-5 block text-sm font-black text-lime-50">{label}</strong>
        {description ? <span className="mt-1.5 block text-xs text-slate-400">{description}</span> : null}
      </div>
    </div>
  )
}
