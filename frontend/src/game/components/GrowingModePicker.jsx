import { AppIcon } from '../icons/FontAwesomeIcon'

const modeOptions = [
  {
    id: 'greenhouse',
    title: 'Environment Control Mode',
    subtitle: 'Full lab controls',
    detail: 'Tune water, light, fertilizer, soil, air, and temperature inside the controlled simulator.',
    icon: 'plant',
    recommended: true,
  },
  {
    id: 'outdoor',
    title: 'Outdoor',
    subtitle: 'Fixed local weather',
    detail: 'Use saved location weather from Open-Meteo. Only water and fertilizer stay adjustable.',
    icon: 'wind',
  },
]

export function GrowingModePicker({ plantName = '', onCancel, onSelect }) {
  const choosingForPlant = Boolean(plantName)

  return (
    <div className="absolute inset-0 z-[80] grid place-items-center bg-black/60 px-4 backdrop-blur-[2px]">
      <section className="w-full max-w-[680px] rounded-lg border border-lime-100/15 bg-[#101511] p-5 text-slate-100 shadow-[0_20px_48px_rgba(0,0,0,.46)]">
        <div className="mb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9bcf82]">{choosingForPlant ? 'New planted species · Growing mode' : 'Step 1 of 3 · Growing mode'}</p>
          <h2 className="mt-1 text-xl font-bold text-lime-50">{choosingForPlant ? `Choose a mode for ${plantName}` : 'Choose growing mode'}</h2>
          <p className="mt-2 text-sm text-slate-300">{choosingForPlant ? `Your current plant stays saved. Choose how you want to grow ${plantName}.` : 'Choose the kind of environment you want to manage. You will select a plant next.'}</p>
          <div className="mx-auto mt-4 grid max-w-[360px] grid-cols-3 items-center gap-2 text-xs font-semibold text-slate-400" aria-label="Plant setup progress">
            <span className={`rounded-full px-2 py-1 ${choosingForPlant ? 'border border-lime-100/10 bg-white/[0.04] text-lime-100' : 'bg-[#9bcf82] text-[#101511]'}`}>{choosingForPlant ? `1 ${plantName}` : '1 Mode'}</span>
            <span className={`rounded-full px-2 py-1 ${choosingForPlant ? 'bg-[#9bcf82] text-[#101511]' : 'border border-lime-100/10 bg-white/[0.04]'}`}>{choosingForPlant ? '2 Mode' : '2 Plant'}</span>
            <span className="rounded-full border border-lime-100/10 bg-white/[0.04] px-2 py-1">3 Start</span>
          </div>
        </div>

        <div className="space-y-3">
          {modeOptions.map((option, index) => (
            <div key={option.id}>
              {index === 1 && <div className="py-1 text-center text-sm text-slate-400">or</div>}
              <button
                type="button"
                className="group grid w-full grid-cols-[24px_72px_1fr] items-center gap-3 rounded-md border border-lime-100/12 bg-[#151b17] px-4 py-4 text-left transition hover:border-[#9bcf82]/60 hover:bg-[#192117] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-200 sm:grid-cols-[24px_112px_1fr] sm:gap-4 sm:px-5"
                onClick={() => onSelect(option.id)}
              >
                <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-400/75 transition group-hover:border-[#9bcf82]">
                  <span className="h-2.5 w-2.5 rounded-full bg-transparent transition group-hover:bg-[#9bcf82]" />
                </span>
                <span className="grid h-20 place-items-center rounded-md border border-lime-100/10 bg-black/20 text-[#9bcf82]">
                  <AppIcon name={option.icon} className="h-12 w-12" />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="block text-base font-bold text-lime-50 sm:text-lg">{option.title}</strong>
                    {option.recommended && <span className="rounded-full bg-[#9bcf82]/15 px-2 py-0.5 text-xs font-black uppercase tracking-wide text-lime-100">Recommended for beginners</span>}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-300">{option.subtitle}</span>
                  <span className="mt-2 block max-w-[48ch] text-xs leading-5 text-slate-400">{option.detail}</span>
                </span>
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-center text-xs leading-5 text-slate-400">
          {onCancel && (
            <button className="rounded-md border border-lime-100/15 bg-white/[0.04] px-3 py-2 font-semibold text-slate-200 transition hover:bg-white/[0.08] hover:text-lime-50" type="button" onClick={onCancel}>
              Keep current plant
            </button>
          )}
          <p>{choosingForPlant ? 'Each planted species keeps its own mode and progress.' : 'Outdoor mode reuses the location you approve on this device.'}</p>
        </div>
      </section>
    </div>
  )
}
