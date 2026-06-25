import { AppIcon } from '../../icons/IconifyIcon'

const productIconMap = {
  switch: 'switch',
  headset: 'headset',
  axe: 'axe',
  controller: 'controller',
  crown: 'crown',
  mouse: 'mouse',
  helmet: 'hardware',
  gun: 'gun',
  robot: 'robot',
}

function ProductVisual({ type, accent }) {
  return (
    <div className="grid h-28 place-items-center rounded-sm bg-[#101920] text-slate-300">
      <AppIcon
        className="h-20 w-20 drop-shadow-[0_10px_14px_rgba(0,0,0,.42)]"
        name={productIconMap[type] ?? 'shoppingCart'}
        style={{ color: accent }}
      />
    </div>
  )
}

export function ProductCard({ isFavorite, item, onToggleFavorite }) {
  return (
    <article className="group rounded-sm bg-[#131e25] p-3 ring-1 ring-slate-700/50 transition hover:-translate-y-0.5 hover:ring-[#34d981]/60">
      <div className="relative">
        <ProductVisual type={item.visual} accent={item.accent} />
        <button className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#0b1215]/90 transition ${isFavorite ? 'text-[#34d981] ring-1 ring-[#34d981]/35' : 'text-slate-500 hover:text-[#34d981]'}`} type="button" aria-label={`${isFavorite ? 'Remove' : 'Save'} ${item.name}`} aria-pressed={isFavorite} onClick={() => onToggleFavorite(item.id)}>
          <AppIcon className="h-3.5 w-3.5" name="heart" />
        </button>
        <strong className="absolute bottom-2 right-2 translate-y-3 rounded-sm bg-[#0b1215]/90 px-2 py-1 text-xs font-black text-[#34d981] opacity-0 ring-1 ring-[#34d981]/30 transition duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:transition-none">
          ${item.price}
        </strong>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-xs font-black uppercase text-slate-100">{item.name}</h3>
          <p className="mt-1 text-[10px] font-semibold uppercase text-slate-500">{item.category}</p>
        </div>
        <div className="relative h-8 w-16 shrink-0 overflow-hidden text-right">
          <strong className="absolute right-0 top-3 text-xs font-black text-[#34d981] transition duration-200 ease-out group-hover:-translate-y-3 group-hover:opacity-0 group-focus-within:-translate-y-3 group-focus-within:opacity-0 motion-reduce:transition-none">
            ${item.price}
          </strong>
          <button
            className="absolute bottom-0 right-0 translate-y-10 rounded-sm bg-[#34d981] px-3 py-1.5 text-[11px] font-black uppercase text-[#07120d] transition duration-200 ease-out hover:bg-[#5ee49c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf3bd] group-hover:translate-y-0 group-focus-within:translate-y-0 motion-reduce:transition-none"
            type="button"
          >
            Buy
          </button>
        </div>
      </div>
    </article>
  )
}



