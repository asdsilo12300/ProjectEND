import { useState } from 'react'
import { AppIcon } from '../../icons/FontAwesomeIcon'
import { imageAssets } from '../../data/gameData'

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
  water: 'drop',
  fertilizer: 'fertilizer',
  soil: 'soil',
  shade: 'shade',
  wind: 'wind',
  frost: 'frost',
}

function ProductVisual({ imageUrl, type, accent }) {
  return (
    <div className="grid h-32 place-items-center rounded-xl bg-[#0d1713] text-slate-300 ring-1 ring-white/[0.05]">
      {imageUrl ? (
        <img className="max-h-[108px] max-w-[86%] object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,.42)]" src={imageUrl} alt="" draggable="false" />
      ) : (
        <AppIcon
          className="h-20 w-20 drop-shadow-[0_10px_14px_rgba(0,0,0,.42)]"
          name={productIconMap[type] ?? 'shoppingCart'}
          style={{ color: accent }}
        />
      )}
    </div>
  )
}

function CoinPrice({ className = '', price }) {
  return (
    <span className={`inline-flex items-center justify-end gap-1 ${className}`}>
      <img className="h-4 w-4 shrink-0 object-contain" src={imageAssets.coin} alt="" draggable="false" />
      <span>{price}</span>
    </span>
  )
}

export function ProductCard({ coinBalance = 0, copy, isBuying = false, isFavorite, item, onBuy, onToggleFavorite }) {
  const category = item.category === 'Lab Item' ? copy.labItem : item.category === 'Friend Prank' ? copy.friendPrank : item.category
  const hideSupplyDescription = ['water', 'fertilizer'].includes(item.visual)
  const affordableQuantity = item.price > 0 ? Math.min(99, Math.floor(Number(coinBalance) / item.price)) : 99
  const quantityLimit = Math.max(1, affordableQuantity)
  const [quantity, setQuantity] = useState(1)
  const safeQuantity = Math.min(quantityLimit, Math.max(1, quantity))

  function setSafeQuantity(value) {
    const parsed = Number.parseInt(value, 10)
    setQuantity(Math.min(quantityLimit, Math.max(1, Number.isFinite(parsed) ? parsed : 1)))
  }

  return (
    <article className="group flex min-h-full flex-col rounded-2xl bg-[#121c17] p-3.5 ring-1 ring-[#31463a]/70 transition hover:-translate-y-0.5 hover:ring-[#5ee49c]/55 focus-within:ring-[#5ee49c]/65 motion-reduce:transform-none">
      <div className="relative">
        <ProductVisual imageUrl={item.imageUrl} type={item.visual} accent={item.accent} />
        <button className={`absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-[#07110c]/90 shadow-md transition ${isFavorite ? 'text-[#5ee49c] ring-1 ring-[#5ee49c]/45' : 'text-slate-300 ring-1 ring-white/10 hover:text-[#5ee49c]'}`} type="button" aria-label={isFavorite ? copy.favoriteRemove(item.name) : copy.favoriteSave(item.name)} aria-pressed={isFavorite} onClick={() => onToggleFavorite(item.id)}>
          <AppIcon className="h-5 w-5" name="heart" />
        </button>
      </div>
      <div className="mt-3 min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#75dca0]">{category}</p>
        <h3 className="mt-1 truncate text-sm font-black text-slate-50">{item.name}</h3>
        {!hideSupplyDescription && item.description ? <p className="mt-1.5 line-clamp-2 min-h-9 text-xs leading-[1.15rem] text-slate-400">{item.description}</p> : null}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">{copy.price}</span>
          <strong className="mt-0.5 inline-flex text-sm font-black text-[#78eda8]"><CoinPrice price={item.price} /></strong>
        </span>
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="inline-flex h-11 items-stretch overflow-hidden rounded-xl border border-[#5ee49c]/25 bg-[#07110c] shadow-[inset_0_0_0_1px_rgba(255,255,255,.025)]" role="group" aria-label={`${copy.quantity}: ${item.name}`}>
            <button
              aria-label={copy.decreaseQuantity(item.name)}
              className="grid w-7 place-items-center text-[#8ecda8] transition hover:bg-[#55dc91]/12 hover:text-[#b9ffd3] disabled:cursor-not-allowed disabled:opacity-35"
              disabled={isBuying || safeQuantity <= 1}
              onClick={() => setQuantity(Math.max(1, safeQuantity - 1))}
              type="button"
            >
              <span aria-hidden="true">−</span>
            </button>
            <input
              aria-label={`${copy.quantity}: ${item.name}`}
              className="w-8 border-x border-[#5ee49c]/15 bg-transparent text-center text-sm font-black tabular-nums text-lime-50 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              disabled={isBuying}
              inputMode="numeric"
              max={quantityLimit}
              min="1"
              onChange={(event) => setSafeQuantity(event.target.value)}
              type="number"
              value={safeQuantity}
            />
            <button
              aria-label={copy.increaseQuantity(item.name)}
              className="grid w-7 place-items-center text-[#8ecda8] transition hover:bg-[#55dc91]/12 hover:text-[#b9ffd3] disabled:cursor-not-allowed disabled:opacity-35"
              disabled={isBuying || safeQuantity >= quantityLimit}
              onClick={() => setQuantity(Math.min(quantityLimit, safeQuantity + 1))}
              type="button"
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
          <button
            className="inline-flex min-h-11 min-w-[68px] items-center justify-center rounded-xl bg-[#55dc91] px-3 text-sm font-black text-[#07120d] shadow-[0_8px_20px_rgba(52,217,129,.14)] transition hover:bg-[#78eda8] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9cf3bd]"
            type="button"
            disabled={isBuying || affordableQuantity < 1}
            onClick={() => onBuy(item, safeQuantity)}
            title={affordableQuantity < 1 ? copy.notEnoughCurrency : undefined}
          >
            {isBuying ? copy.buying : copy.buy}
          </button>
        </div>
      </div>
    </article>
  )
}
