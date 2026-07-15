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

function clampChance(value) {
  return Math.min(100, Math.max(0, Math.round(value)))
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
  const hardStops = []

  function addStress(state) {
    if (!stressStates.includes(state)) stressStates.push(state)
  }

  function addHardStop(state) {
    addStress(state)
    if (!hardStops.includes(state)) hardStops.push(state)
  }

  if (factors.water <= 10) addHardStop('underwatered')
  else if (factors.water < 35) addStress('underwatered')

  if (factors.water >= 95 || factors.soil_humidity >= 95) addHardStop('overwatered')
  else if (factors.water > 82 || factors.soil_humidity > 82) addStress('overwatered')

  if (factors.fertilizer < 25) addStress('nutrient_deficient')
  if (factors.fertilizer >= 90) addHardStop('burnt')
  else if (factors.fertilizer > 75) addStress('burnt')

  if (factors.light <= 8) addHardStop('stunted')
  else if (factors.light < 22) addStress('stunted')

  if (factors.air_temp >= 42) addHardStop('heat_stress')
  else if (factors.air_temp > 34) addStress('heat_stress')

  if (factors.air_temp <= 8) addHardStop('cold_stress')
  else if (factors.air_temp < 16) addStress('cold_stress')

  const visualState = stressStates.length >= 3 ? 'stunted' : hardStops[0] ?? stressStates[0] ?? 'healthy'
  const growthPoint = visualState === 'healthy'
    ? 14
    : hardStops.length > 0 || visualState === 'stunted'
      ? 0
      : Math.max(1, 8 - stressStates.length * 3)
  const pestRisks = {
    aphid: clampChance((factors.air_humidity < 35 ? 35 : 0) + (factors.air_temp > 32 ? 30 : 0)),
    snail: clampChance((factors.soil_humidity > 72 ? 65 : 0) + (factors.soil_humidity > 90 ? 30 : 0) + (factors.rain > 0.5 ? 35 : 0)),
    fungus: clampChance((factors.air_humidity > 78 ? 42 : 0) + (factors.soil_humidity > 78 ? 46 : 0)),
  }
  return {
    growth_point: growthPoint,
    current_stage: growthPoint >= 100 ? { stage_no: 3, stage_name: 'Young Plant', required_growth_point: 100 } : { stage_no: 1, stage_name: 'Seedling', required_growth_point: 0 },
    visual_state: visualState,
    current_model_url: '/plant.gltf',
    visual_overrides: visualPresets[visualState],
    pest_risks: pestRisks,
    // Active pests are authoritative server state. A local risk preview must
    // never create a pest that the treatment API cannot see or remove.
    active_pests: [],
  }
}
