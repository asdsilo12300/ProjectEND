import { AppIcon } from '../icons/IconifyIcon'

const modeOptions = [
  {
    id: 'greenhouse',
    title: 'Environment Control Mode',
    subtitle: 'Full lab controls',
    detail: 'Tune water, light, fertilizer, soil, air, and temperature inside the controlled simulator.',
    icon: 'plant',
  },
  {
    id: 'outdoor',
    title: 'Outdoor',
    subtitle: 'Fixed local weather',
    detail: 'Use saved location weather from Open-Meteo. Only water and fertilizer stay adjustable.',
    icon: 'wind',
  },
]

export function GrowingModePicker({ onSelect }) {
  return (
    <div className="absolute inset-0 z-[80] grid place-items-center bg-black/60 px-4 backdrop-blur-[2px]">
      <section className="w-full max-w-[680px] rounded-lg border border-lime-100/15 bg-[#101511] p-5 text-slate-100 shadow-[0_20px_48px_rgba(0,0,0,.46)]">
        <div className="mb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9bcf82]">Plant setup</p>
          <h2 className="mt-1 text-xl font-bold text-lime-50">Choose growing mode</h2>
          <p className="mt-2 text-sm text-slate-300">Select how this plant will be grown before starting the lesson.</p>
        </div>

        <div className="space-y-3">
          {modeOptions.map((option, index) => (
            <div key={option.id}>
              {index === 1 && <div className="py-1 text-center text-sm text-slate-400">or</div>}
              <button
                type="button"
                className="group grid w-full grid-cols-[24px_112px_1fr] items-center gap-4 rounded-md border border-lime-100/12 bg-[#151b17] px-5 py-4 text-left transition hover:border-[#9bcf82]/60 hover:bg-[#192117] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-200"
                onClick={() => onSelect(option.id)}
              >
                <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-400/75 transition group-hover:border-[#9bcf82]">
                  <span className="h-2.5 w-2.5 rounded-full bg-transparent transition group-hover:bg-[#9bcf82]" />
                </span>
                <span className="grid h-20 place-items-center rounded-md border border-lime-100/10 bg-black/20 text-[#9bcf82]">
                  <AppIcon name={option.icon} className="h-12 w-12" />
                </span>
                <span className="min-w-0">
                  <strong className="block text-lg font-bold text-lime-50">{option.title}</strong>
                  <span className="mt-0.5 block text-sm text-slate-300">{option.subtitle}</span>
                  <span className="mt-2 block max-w-[48ch] text-xs leading-5 text-slate-400">{option.detail}</span>
                </span>
              </button>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">Outdoor mode saves your first approved location on this device and keeps using it for future weather.</p>
      </section>
    </div>
  )
}
