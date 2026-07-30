import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { climateIcons } from '../data/gameData'
import { getPlantKnowledge } from '../data/plantKnowledge'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { MetricIcon } from '../icons/MetricIcon'
import { getAppLanguage } from '../../i18n/appI18n'

const factorDefinitions = [
  { key: 'water', label: 'Water', labelTh: 'น้ำ', unit: 'ml', iconKey: 'water', convert: (value) => Number(value) * 10 },
  { key: 'light', label: 'Light', labelTh: 'แสง', unit: 'lx', iconKey: 'light' },
  { key: 'fertilizer', label: 'Fertilizer', labelTh: 'ปุ๋ย', unit: 'g', iconKey: 'fertilizer' },
  { key: 'soil_humidity', label: 'Soil moisture', labelTh: 'ความชื้นในดิน', unit: '%', iconKey: 'soil' },
  { key: 'air_humidity', label: 'Air humidity', labelTh: 'ความชื้นในอากาศ', unit: '%RH', iconKey: 'air' },
  { key: 'soil_temp', label: 'Soil temperature', labelTh: 'อุณหภูมิดิน', unit: '°C', iconKey: 'soilTemp' },
  { key: 'air_temp', label: 'Air temperature', labelTh: 'อุณหภูมิอากาศ', unit: '°C', iconKey: 'temp' },
]

function formatRange(range, definition) {
  if (range?.min == null || range?.max == null) return 'Not configured'
  const convert = definition.convert ?? ((value) => Number(value))
  const minimum = convert(range.min)
  const maximum = convert(range.max)
  return `${minimum.toLocaleString()}–${maximum.toLocaleString()} ${definition.unit}`
}

function FactorCard({ definition, language, range }) {
  const icon = climateIcons[definition.iconKey] ?? climateIcons.temp
  const label = language === 'th' ? definition.labelTh : definition.label

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-lime-100/10 bg-black/20 px-2.5 py-2">
      <MetricIcon
        color={icon.color}
        imageUrl={icon.imageUrl}
        label={`${label} icon`}
        size="sm"
        type={icon.icon}
      />
      <span className="min-w-0">
        <span className="block truncate text-xs text-slate-400">{label}</span>
        <strong className="block truncate text-xs text-lime-50">{formatRange(range, definition)}</strong>
      </span>
    </div>
  )
}

export function PlantKnowledgeModal({ onClose, plantAsset }) {
  const language = getAppLanguage() === 'th' ? 'th' : 'en'
  const copy = (english, thai) => language === 'th' ? thai : english
  const knowledge = useMemo(() => getPlantKnowledge(plantAsset, language), [language, plantAsset])

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  if (!plantAsset) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[180] grid place-items-center bg-black/65 px-3 py-4 backdrop-blur-[3px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        aria-labelledby="plant-knowledge-title"
        aria-modal="true"
        className="flex max-h-[82vh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-lime-100/20 bg-[#101511] text-slate-100 shadow-[0_28px_90px_rgba(0,0,0,.62)]"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-lime-100/10 px-4 py-3">
          <span className="min-w-0">
            <span className="block text-xs font-black uppercase tracking-[0.16em] text-emerald-300">{copy('Plant guide', 'ข้อมูลพืช')}</span>
            <strong className="mt-0.5 block truncate text-base text-lime-50" id="plant-knowledge-title">
              {knowledge.commonName}
            </strong>
          </span>
          <button
            aria-label="Close plant guide"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-lime-100/15 bg-white/[0.045] text-slate-300 transition hover:bg-white/[0.09] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            onClick={onClose}
            type="button"
          >
            <AppIcon className="h-4 w-4" name="close" />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto p-4 [scrollbar-color:#66835c_#111713] [scrollbar-width:thin]">
          <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <figure className="overflow-hidden rounded-xl border border-lime-100/15 bg-[#1a251b]">
              <div className="aspect-[4/3] overflow-hidden sm:aspect-square">
              {knowledge.photo?.url || plantAsset.imageUrl ? (
                <img
                  className="h-full w-full object-cover"
                  src={knowledge.photo?.url || plantAsset.imageUrl}
                  alt={knowledge.photo?.alt || knowledge.commonName}
                />
              ) : (
                <span className="grid h-full place-items-center text-emerald-300">
                  <AppIcon className="h-14 w-14" name="plant" />
                </span>
              )}
              </div>
              {knowledge.photo ? (
                <figcaption
                  className="flex flex-wrap items-center gap-x-1 px-2.5 py-2 text-[10px] leading-4 text-slate-400"
                  data-i18n-skip="true"
                >
                  <span>Photo:</span>
                  <a
                    className="text-sky-300 transition hover:text-sky-200"
                    href={knowledge.photo.sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {knowledge.photo.credit}
                  </a>
                  <span>·</span>
                  <a
                    className="text-sky-300 transition hover:text-sky-200"
                    href={knowledge.photo.licenseUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {knowledge.photo.license}
                  </a>
                </figcaption>
              ) : null}
            </figure>
            <div className="min-w-0">
              <span className="inline-flex rounded-full border border-emerald-200/15 bg-emerald-300/10 px-2.5 py-1 text-xs font-bold text-emerald-200">
                {knowledge.category}
              </span>
              <dl className="mt-3 grid grid-cols-[112px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs leading-5">
                <dt className="text-slate-500">{copy('Scientific name', 'ชื่อวิทยาศาสตร์')}</dt>
                <dd className="truncate italic text-lime-50" data-i18n-skip="true" title={knowledge.scientificName}>{knowledge.scientificName}</dd>
                <dt className="text-slate-500">{copy('Family', 'วงศ์')}</dt>
                <dd className="text-slate-200" data-i18n-skip="true">{knowledge.family}</dd>
                <dt className="text-slate-500">{copy('English name', 'ชื่อภาษาอังกฤษ')}</dt>
                <dd className="text-slate-200" data-i18n-skip="true">{knowledge.englishName}</dd>
                {knowledge.thaiName ? (
                  <>
                    <dt className="text-slate-500">{copy('Thai name', 'ชื่อภาษาไทย')}</dt>
                    <dd className="text-slate-200">{knowledge.thaiName}</dd>
                  </>
                ) : null}
                {knowledge.maturityDays > 0 ? (
                  <>
                    <dt className="text-slate-500">{copy('Real-life growth', 'ระยะเติบโตจริง')}</dt>
                    <dd className="text-slate-200">{copy(`about ${knowledge.maturityDays} days in this simulation profile`, `ประมาณ ${knowledge.maturityDays} วันตามโปรไฟล์ของระบบจำลอง`)}</dd>
                  </>
                ) : null}
              </dl>
              <p className="mt-3 text-xs leading-5 text-slate-300">{knowledge.summary}</p>
            </div>
          </div>

          <section className="mt-4 rounded-xl border border-lime-100/12 bg-[#151c16] p-3.5">
            <div className="flex items-start justify-between gap-3">
              <span>
                <strong className="block text-sm text-lime-50">{copy('Simulation target ranges', 'ช่วงค่าปัจจัยเป้าหมาย')}</strong>
                <span className="mt-0.5 block text-xs leading-4 text-slate-400">{copy('Keep these controls within range for healthy growth.', 'รักษาค่าควบคุมให้อยู่ในช่วงนี้เพื่อให้พืชเติบโตอย่างแข็งแรง')}</span>
              </span>
              <span className="shrink-0 rounded-md bg-sky-300/10 px-2 py-1 text-xs font-bold text-sky-200">{copy('Game values', 'ค่าภายในเกม')}</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {factorDefinitions.map((definition) => (
                <FactorCard
                  definition={definition}
                  key={definition.key}
                  language={language}
                  range={knowledge.environment[definition.key]}
                />
              ))}
            </div>
          </section>

          <section className="mt-4">
            <strong className="text-sm text-lime-50">{copy('Planting and care', 'วิธีปลูกและดูแล')}</strong>
            <ol className="mt-2 grid gap-2">
              {knowledge.care.map((instruction, index) => (
                <li className="flex gap-2.5 rounded-lg border border-lime-100/10 bg-white/[0.035] px-3 py-2.5 text-xs leading-5 text-slate-300" key={instruction}>
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-300/12 text-xs font-black text-emerald-200">{index + 1}</span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ol>
          </section>

          {knowledge.caution ? (
            <div className="mt-4 flex gap-2.5 rounded-xl border border-amber-200/15 bg-amber-300/[0.07] px-3 py-2.5 text-xs leading-5 text-amber-50">
              <AppIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" name="warning" />
              <span>{knowledge.caution}</span>
            </div>
          ) : null}

          {knowledge.sources.length ? (
            <section className="mt-4 border-t border-lime-100/10 pt-3">
              <strong className="text-xs uppercase tracking-[0.12em] text-slate-500">{copy('Sources and further reading', 'แหล่งอ้างอิงและอ่านเพิ่มเติม')}</strong>
              <div className="mt-2 grid gap-1.5">
                {knowledge.sources.map((source) => (
                  <a
                    className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-xs text-sky-300 transition hover:bg-white/[0.05] hover:text-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
                    href={source.url}
                    key={source.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="min-w-0 truncate">{source.label}</span>
                    <AppIcon className="h-3.5 w-3.5 shrink-0" name="arrowForward" />
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  )
}
