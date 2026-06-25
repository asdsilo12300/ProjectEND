import { growthChartSeries, pestChances, plantStats } from '../data/gameData'
import { GrowthSparkline } from '../components/GrowthSparkline'
import { IconBar } from '../components/IconBar'
import { Panel } from '../components/Panel'
import { PestChance } from '../components/PestChance'

function buildPestChances(simulationVisual) {
  const risks = simulationVisual?.pest_risks
  if (!risks) return pestChances

  return pestChances.map((pest) => ({
    ...pest,
    value: Number(risks[pest.icon] ?? pest.value),
  }))
}

export function PlantMonitorPanel({ windows, setWindows, simulationVisual }) {
  const visiblePestChances = buildPestChances(simulationVisual)

  return (
      <Panel id="monitor" title="Plant monitor" subtitle="growth and status" windows={windows} setWindows={setWindows} className="w-[360px]">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#9bcf82] text-base font-black text-[#101511]">S</span>
            <div>
              <strong className="block text-sm text-white">Sprout</strong>
              <span className="text-xs text-slate-300">Early stage - 32.4k pts</span>
            </div>
          </div>
          <div className="flex items-center rounded-md bg-[#9bcf82]/12 px-2 py-1 text-xs font-semibold text-lime-100">+ 12%</div>
        </div>

        <div className="area-chart-shell -mx-1 h-24">
          <GrowthSparkline values={growthChartSeries[0].data} />
        </div>

        <div className="mt-3 grid gap-2.5 border-t border-lime-100/10 pt-3">
          {plantStats.map((stat) => (
            <IconBar key={stat.label} {...stat} compact />
          ))}
        </div>

        <div className="mt-3 border-t border-lime-100/10 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <strong className="text-xs text-lime-50">โอกาสเกิดศัตรูพืช</strong>
            <span className="text-[10px] text-slate-400">next cycle</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {visiblePestChances.map((pest) => (
              <PestChance key={pest.label} {...pest} />
            ))}
          </div>
        </div>
      </Panel>
  )
}

