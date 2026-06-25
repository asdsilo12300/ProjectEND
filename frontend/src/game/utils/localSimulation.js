export const defaultSimulationVisual = {
  growth_point: 0,
  current_stage: { stage_no: 1, stage_name: 'Seedling', required_growth_point: 0 },
  visual_state: 'healthy',
  current_model_url: '/plant.gltf',
  visual_overrides: {
    leafColor: '#9bcf82',
    stemColor: '#7a5a2f',
    scale: 1,
    leafState: 'upright',
    stemState: 'upright',
  },
  pest_risks: { aphid: 0, snail: 0, fungus: 0 },
  active_pests: [],
}

const visualPresets = {
  healthy: { leafColor: '#9bcf82', stemColor: '#7a5a2f', scale: 1, leafState: 'upright', stemState: 'upright' },
  underwatered: { leafColor: '#9a6a3a', stemColor: '#6f4a2a', scale: 0.92, leafState: 'wilted', stemState: 'leaning' },
  overwatered: { leafColor: '#7f9964', stemColor: '#6b5b35', scale: 0.95, leafState: 'drooping', stemState: 'soft' },
  nutrient_deficient: { leafColor: '#d6c66b', stemColor: '#8a743e', scale: 0.9, leafState: 'yellowing', stemState: 'thin' },
  heat_stress: { leafColor: '#c6773e', stemColor: '#7a4b2f', scale: 0.92, leafState: 'burnt_edges', stemState: 'dry' },
  burnt: { leafColor: '#b87536', stemColor: '#704326', scale: 0.88, leafState: 'root_burn', stemState: 'dry' },
  cold_stress: { leafColor: '#65816f', stemColor: '#5f6f5b', scale: 0.9, leafState: 'darkened', stemState: 'slow' },
  stunted: { leafColor: '#7b6f3f', stemColor: '#5c4a28', scale: 0.68, leafState: 'small', stemState: 'short' },
}

function pest(id, nameEn, nameTh, modelUrl, chance) {
  return {
    id,
    status: 'active',
    risk_chance: chance,
    pest: {
      id,
      name_en: nameEn,
      name_th: nameTh,
      model_url: modelUrl,
    },
  }
}

function clampChance(value) {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function roll(chance) {
  return chance >= 100 || Math.random() * 100 <= chance
}

export function buildSimulationFactors(climate, outdoorWeather) {
  const current = outdoorWeather?.forecast?.current
  const hourly = outdoorWeather?.forecast?.hourly
  const first = (key) => (Array.isArray(hourly?.[key]) ? hourly[key][0] : null)

  return {
    water: climate.water,
    light: climate.light ?? (current?.is_day ? 72 : 16),
    fertilizer: climate.fertilizer,
    soil_humidity: climate.soil,
    air_humidity: climate.air,
    soil_temp: first('soil_temperature_6cm') ?? climate.temp,
    air_temp: first('temperature_2m') ?? climate.temp,
    rain: current?.rain ?? 0,
  }
}

export function evaluateLocalSimulation(factors) {
  const stressStates = []

  if (factors.water < 35) stressStates.push('underwatered')
  if (factors.water > 82 || factors.soil_humidity > 82) stressStates.push('overwatered')
  if (factors.fertilizer < 25) stressStates.push('nutrient_deficient')
  if (factors.fertilizer > 75) stressStates.push('burnt')
  if (factors.air_temp > 34) stressStates.push('heat_stress')
  if (factors.air_temp < 16) stressStates.push('cold_stress')

  const visualState = stressStates.length >= 3 ? 'stunted' : stressStates[0] ?? 'healthy'
  const stressPenalty = stressStates.length * 4
  const severePenalty = stressStates.length >= 3 ? 10 : 0
  const growthPoint = Math.max(0, visualState === 'healthy' ? 14 : 8 - stressPenalty - severePenalty)
  const pestRisks = {
    aphid: clampChance((factors.air_humidity < 35 ? 35 : 0) + (factors.air_temp > 32 ? 30 : 0)),
    snail: clampChance((factors.soil_humidity > 72 ? 65 : 0) + (factors.soil_humidity > 90 ? 30 : 0) + (factors.rain > 0.5 ? 35 : 0)),
    fungus: clampChance((factors.air_humidity > 78 ? 42 : 0) + (factors.soil_humidity > 78 ? 46 : 0)),
  }
  const activePests = []

  if (roll(pestRisks.aphid)) activePests.push(pest(1, 'aphid', 'Aphid', '/aphid.gltf', pestRisks.aphid))
  if (roll(pestRisks.snail)) activePests.push(pest(2, 'snail', 'Snail', '/snails.gltf', pestRisks.snail))
  if (roll(pestRisks.fungus)) activePests.push(pest(3, 'fungus', 'Fungus', null, pestRisks.fungus))

  return {
    growth_point: growthPoint,
    current_stage: growthPoint >= 100 ? { stage_no: 3, stage_name: 'Young Plant', required_growth_point: 100 } : { stage_no: 1, stage_name: 'Seedling', required_growth_point: 0 },
    visual_state: visualState,
    current_model_url: '/plant.gltf',
    visual_overrides: visualPresets[visualState],
    pest_risks: pestRisks,
    active_pests: activePests,
  }
}
