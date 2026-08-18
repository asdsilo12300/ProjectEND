const DEMO_TOKEN = 'plant-growth-academy-demo-session'

const nowIso = () => new Date().toISOString()
const agoIso = (minutes) => new Date(Date.now() - (minutes * 60_000)).toISOString()
const clone = (value) => value == null ? value : structuredClone(value)

const fallbackPlants = [
  {
    id: 1,
    name_th: 'ต้นหูช้าง',
    name_en: 'Elephant Ear',
    description: 'Starter elephant ear plant for learning how environmental factors affect growth.',
    base_image_url: '/images/plant-guides/xanthosoma-sagittifolium.jpg',
    base_model_url: '/plant.gltf',
    real_maturity_days: 119,
    growth_reference_url: 'https://plant-directory.ifas.ufl.edu/plant-directory/xanthosoma-sagittifolium/',
    environment: { water: { min: 40, max: 75 }, light: { min: 45, max: 85 }, fertilizer: { min: 25, max: 65 }, soil_humidity: { min: 35, max: 75 }, air_humidity: { min: 40, max: 80 }, soil_temp: { min: 18, max: 32 }, air_temp: { min: 18, max: 34 } },
    stages: [
      { id: 1, stage_no: 1, stage_name: 'Seedling', required_growth_point: 0, model_url: '/plant.gltf', description: 'Early stage' },
      { id: 2, stage_no: 2, stage_name: 'Sprout', required_growth_point: 40, model_url: '/plant.gltf', description: 'Visible sprout' },
      { id: 3, stage_no: 3, stage_name: 'Young Plant', required_growth_point: 100, model_url: '/plant.gltf', description: 'Stable young plant' },
    ],
  },
  {
    id: 2,
    name_th: 'ทิวลิป',
    name_en: 'Tulip',
    description: 'A flowering bulb plant used to explore cool-temperature growth.',
    base_image_url: '/images/plant-guides/tulipa-gesneriana.jpg',
    base_model_url: '/demo-models/tulip/model.gltf',
    real_maturity_days: 112,
    growth_reference_url: 'https://www.rhs.org.uk/plants/tulips/growing-guide',
    environment: { water: { min: 42, max: 68 }, light: { min: 45, max: 82 }, fertilizer: { min: 25, max: 55 }, soil_humidity: { min: 42, max: 67 }, air_humidity: { min: 40, max: 70 }, soil_temp: { min: 8, max: 18 }, air_temp: { min: 10, max: 22 } },
    stages: [
      { id: 11, stage_no: 1, stage_name: 'Bulb establishment', required_growth_point: 0, model_url: '/demo-models/tulip/model.gltf' },
      { id: 12, stage_no: 2, stage_name: 'Leaf emergence', required_growth_point: 38, model_url: '/demo-models/tulip/model.gltf' },
      { id: 13, stage_no: 3, stage_name: 'Flowering', required_growth_point: 100, model_url: '/demo-models/tulip/model.gltf' },
    ],
  },
]

const fallbackItems = [
  { id: 2, name: 'Insect Spray', type: 'pesticide', description: 'Clears aphids with 100% success.', image_url: '/game-icons/insect-spray.png', effect_type: 'pest_control:aphid' },
  { id: 3, name: 'Snail Spray', type: 'pesticide', description: 'Clears snails with 100% success.', image_url: '/game-icons/snail-spray.png', effect_type: 'pest_control:snail' },
  { id: 4, name: 'Fungus Spray', type: 'pesticide', description: 'Clears fungus with 100% success.', image_url: '/game-icons/antifungal-spray.png', effect_type: 'pest_control:fungus' },
  { id: 5, name: 'Hand Pick', type: 'tool', description: 'Manual removal for aphids and snails.', image_url: '/game-icons/hand-pick.png', effect_type: 'pest_control:manual' },
  { id: 6, name: 'Aphid Prank', type: 'friend_prank', description: 'Send aphids to a friend garden.', image_url: '/game-icons/aphid.png', effect_type: 'friend_pest:aphid' },
  { id: 7, name: 'Snail Prank', type: 'friend_prank', description: 'Send a snail to a friend garden.', image_url: '/game-icons/snail.png', effect_type: 'friend_pest:snail' },
  { id: 8, name: 'Watering Dose', type: 'water', description: 'Restores 22% of the active plant water reserve.', effect_type: 'environment:water', effect_value: 22, action_key: 'water', animation_key: 'watering-can', mode_scope: 'both' },
  { id: 9, name: 'Fertilizer Dose', type: 'fertilizer', description: 'Restores 18% of the active plant nutrient reserve.', effect_type: 'environment:fertilizer', effect_value: 18, action_key: 'fertilizer', animation_key: 'fertilizer-pour', mode_scope: 'both' },
  { id: 10, name: 'Drainage Mix', type: 'booster', description: 'Reduce excessive outdoor soil moisture.', effect_type: 'environment:drainage', action_key: 'drainage', animation_key: 'soil-mix', mode_scope: 'outdoor' },
  { id: 11, name: 'Shade Cloth', type: 'booster', description: 'Protect an outdoor plant from intense heat and light.', effect_type: 'environment:shade', action_key: 'shade', animation_key: 'shade-cover', mode_scope: 'outdoor' },
  { id: 12, name: 'Windbreak', type: 'booster', description: 'Protect an outdoor plant from strong wind.', effect_type: 'environment:windbreak', action_key: 'windbreak', animation_key: 'windbreak', mode_scope: 'outdoor' },
  { id: 13, name: 'Frost Cover', type: 'booster', description: 'Protect an outdoor plant from sudden cold.', effect_type: 'environment:frost-cover', action_key: 'frost-cover', animation_key: 'frost-cover', mode_scope: 'outdoor' },
]

const demoUserTemplate = {
  id: 999_001,
  username: 'Demo Learner',
  email: 'demo@plantgrowth.academy',
  role: 'user',
  avatar_url: null,
  cover_url: null,
  bio: 'Exploring Plant Growth Academy in a safe preview session.',
  coin: 1425,
  gem: 0,
  level: 7,
  experience: 240,
  level_progress: { level: 7, experience: 240, next_level_experience: 300, percent: 80 },
  friends_count: 2,
  plant_histories_count: 3,
  plants_count: 3,
  onboarding_progress: {},
}

let session = null

function captureLocalStorage() {
  const snapshot = {}
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key !== null) snapshot[key] = window.localStorage.getItem(key)
  }
  return snapshot
}

function restoreLocalStorage(snapshot = {}) {
  window.localStorage.clear()
  Object.entries(snapshot).forEach(([key, value]) => window.localStorage.setItem(key, value))
}

function createGrowthCalculation(plant, growthPoint = 64, status = 'growing') {
  const maturityDays = Number(plant?.real_maturity_days ?? 90)
  const progress = Math.min(100, Math.max(0, Number(growthPoint) || 0))
  const equivalentDays = (progress / 100) * maturityDays
  return {
    version: 1,
    captured_at: nowIso(),
    status: progress >= 100 ? 'complete' : status,
    cycle_seconds: 30,
    growth_point: progress,
    maximum_growth_point: 100,
    progress_percent: progress,
    maturity_days: maturityDays,
    equivalent_days: Number(equivalentDays.toFixed(1)),
    real_days_remaining: Number(Math.max(0, maturityDays - equivalentDays).toFixed(1)),
    real_days_per_point: maturityDays / 100,
    observed_growth_points_per_cycle: 8,
    pace_percent: status === 'growing' ? 72 : 0,
    seconds_per_real_day: status === 'growing' ? 2.4 : null,
    normal_seconds_per_real_day: 1.8,
    recent_growth_percentages: [28, 34, 41, 48, 55, 60, progress],
    reference_url: plant?.growth_reference_url,
  }
}

function stageForPlant(plant, growthPoint) {
  const stages = [...(plant?.stages ?? [])].sort((left, right) => Number(left.required_growth_point) - Number(right.required_growth_point))
  return stages.filter((stage) => Number(stage.required_growth_point) <= Number(growthPoint)).at(-1) ?? stages[0] ?? null
}

const previewSeasonByMonth = (month, latitude = 13.7563) => {
  const adjusted = latitude < 0 ? ((Number(month) + 5) % 12) + 1 : Number(month)
  if ([6, 7, 8, 9, 10].includes(adjusted)) return 'rainy'
  if ([3, 4, 5].includes(adjusted)) return 'hot'
  return 'cool_dry'
}

function createDemoSeasonalContext({ calendarDay = 0, biologicalDays = 0, latitude = 13.7563, startMonth = new Date().getMonth() + 1 } = {}) {
  const started = new Date(new Date().getFullYear(), Number(startMonth) - 1, 1, 12, 0, 0)
  const makeDay = (offset) => {
    const date = new Date(started.getTime() + ((Number(calendarDay) + offset) * 86_400_000))
    const dayIndex = Number(calendarDay) + offset
    const seasonKey = previewSeasonByMonth(date.getMonth() + 1, Number(latitude))
    const weatherNoise = ((dayIndex * 37 + Number(startMonth) * 11) % 17) - 8
    const rain = seasonKey === 'rainy' ? Math.max(0, 8 + weatherNoise * 1.7) : Math.max(0, weatherNoise - 5)
    const temperature = seasonKey === 'hot' ? 34 + weatherNoise * 0.2 : seasonKey === 'cool_dry' ? 24 + weatherNoise * 0.16 : 28 + weatherNoise * 0.15
    const gust = 16 + Math.abs(weatherNoise) * 2.2
    const risk = rain >= 25 ? 'heavy_rain' : temperature >= 36 ? 'heat_wave' : gust >= 45 ? 'strong_wind' : null
    return {
      day_index: dayIndex,
      date: date.toISOString().slice(0, 10),
      season_key: seasonKey,
      weather_code: rain > 12 ? 63 : rain > 0 ? 61 : 1,
      temperature_mean: Number(temperature.toFixed(1)),
      temperature_min: Number((temperature - 4).toFixed(1)),
      temperature_max: Number((temperature + 5).toFixed(1)),
      soil_temperature: Number((temperature + 0.8).toFixed(1)),
      humidity: Math.round(Math.min(94, 54 + rain * 1.8)),
      precipitation: Number(rain.toFixed(1)),
      rain: Number(rain.toFixed(1)),
      snowfall: 0,
      wind_speed: Number((gust * 0.55).toFixed(1)),
      wind_gust: Number(gust.toFixed(1)),
      wind_direction: (dayIndex * 47) % 360,
      cloud_cover: Math.round(Math.min(96, 24 + rain * 3)),
      shortwave_radiation: Number(Math.max(3, 18 - rain * 0.22).toFixed(1)),
      evapotranspiration: Number(Math.max(1, 2.8 + (temperature - 25) * 0.15).toFixed(1)),
      soil_moisture: Number(Math.min(0.55, 0.2 + rain * 0.009).toFixed(2)),
      daylight_hours: 12,
      source: 'historical_reanalysis',
      is_forecast: false,
      risk,
      recommended_action: risk === 'heavy_rain' ? 'drainage' : risk === 'heat_wave' ? 'shade' : risk === 'strong_wind' ? 'windbreak' : null,
    }
  }
  const days = Array.from({ length: 6 }, (_, index) => makeDay(index))
  return {
    climate_zone: 'tropical',
    season_key: days[0].season_key,
    start_month: Number(startMonth),
    calendar_day: Number(calendarDay),
    biological_days: Number(biologicalDays),
    simulated_datetime: `${days[0].date}T12:00:00+07:00`,
    seconds_per_day: 18,
    weather_seed: 24681357,
    weather_profile_version: 'demo-open-meteo-v1',
    location_timezone: 'Asia/Bangkok',
    weather_source: 'historical_reanalysis',
    source_label_en: 'Simulated from real historical weather',
    source_label_th: 'จำลองจากข้อมูลอากาศจริง',
    current: days[0],
    forecast: days.slice(1),
    next_season: { season_key: days[0].season_key === 'rainy' ? 'cool_dry' : 'rainy', starts_in_days: 74, date: new Date(started.getTime() + ((Number(calendarDay) + 74) * 86_400_000)).toISOString().slice(0, 10) },
  }
}

function createSimulator(plant = fallbackPlants[0], overrides = {}) {
  const growthPoint = Number(overrides.growth_point ?? 64)
  const currentStage = stageForPlant(plant, growthPoint)
  const mode = overrides.mode ?? 'greenhouse'
  const seasonalContext = mode === 'seasonal'
    ? createDemoSeasonalContext({
        calendarDay: overrides.calendar_day ?? 0,
        biologicalDays: overrides.biological_days ?? 0,
        latitude: overrides.latitude ?? 13.7563,
        startMonth: overrides.start_month ?? new Date().getMonth() + 1,
      })
    : null
  return {
    id: overrides.id ?? 99001,
    plant_id: plant.id,
    mode,
    location_name: overrides.location_name ?? null,
    latitude: overrides.latitude ?? null,
    longitude: overrides.longitude ?? null,
    location_timezone: overrides.location_timezone ?? (mode === 'seasonal' ? 'Asia/Bangkok' : null),
    climate_zone: seasonalContext?.climate_zone ?? null,
    season_key: seasonalContext?.season_key ?? null,
    start_month: seasonalContext?.start_month ?? null,
    simulated_datetime: seasonalContext?.simulated_datetime ?? null,
    calendar_day: seasonalContext?.calendar_day ?? 0,
    biological_days: seasonalContext?.biological_days ?? 0,
    weather_seed: seasonalContext?.weather_seed ?? null,
    weather_source: seasonalContext?.weather_source ?? null,
    weather_profile_version: seasonalContext?.weather_profile_version ?? null,
    seasonal_context: seasonalContext,
    season: seasonalContext?.season_key ?? null,
    growth_point: growthPoint,
    growth_rate: Number(overrides.growth_rate ?? 8),
    health: Number(overrides.health ?? 92),
    visual_state: overrides.visual_state ?? 'healthy',
    visual_overrides: overrides.visual_overrides ?? { scale: 1, leafColor: '#86bd72', leafState: 'upright', stemColor: '#735531', stemState: 'upright' },
    water: Number(overrides.water ?? 100),
    light: Number(overrides.light ?? 72),
    fertilizer: Number(overrides.fertilizer ?? 100),
    plant_needs: overrides.plant_needs ?? {
      water: Number(overrides.water ?? 100),
      fertilizer: Number(overrides.fertilizer ?? 100),
      rates: { water_per_cycle: 3, fertilizer_per_cycle: 0.25, rain_recovery: 0 },
    },
    soil_humidity: Number(overrides.soil_humidity ?? 62),
    air_humidity: Number(overrides.air_humidity ?? 58),
    soil_temp: Number(overrides.soil_temp ?? 25),
    air_temp: Number(overrides.air_temp ?? 29),
    status: overrides.status ?? 'active',
    share_visibility: overrides.share_visibility ?? 'private',
    state_version: Number(overrides.state_version ?? 1),
    shared_at: overrides.shared_at ?? null,
    live_snapshot_url: null,
    updated_at: nowIso(),
    active_seconds: Number(overrides.active_seconds ?? 245),
    owner: overrides.owner ?? { id: demoUserTemplate.id, username: demoUserTemplate.username, avatar_url: null, level: demoUserTemplate.level },
    maturity_reward_claimed_at: null,
    maturity_reward_amount: 100,
    current_stage: currentStage,
    current_model_url: currentStage?.model_url ?? plant.base_model_url,
    pest_risks: overrides.pest_risks ?? { Snail: 4, Aphid: 6, Fungus: 2, snail: 4, aphid: 6, fungus: 2 },
    visual_variant: { id: 1, state_key: 'healthy', label: 'Healthy', model_url: null },
    active_pests: overrides.active_pests ?? [],
    plant,
    started_at: overrides.started_at ?? agoIso(22),
    ended_at: overrides.ended_at ?? null,
  }
}

function historyFromSimulator(simulator, id, overrides = {}) {
  const growthPoint = Number(overrides.growth_point ?? simulator.growth_point ?? 100)
  const growthCalculation = createGrowthCalculation(simulator.plant, growthPoint, growthPoint >= 100 ? 'complete' : 'paused')
  const finalStage = stageForPlant(simulator.plant, growthPoint)
  return {
    id,
    simulator_id: simulator.id,
    user_id: demoUserTemplate.id,
    plant_id: simulator.plant_id,
    plant: simulator.plant,
    final_stage_id: finalStage?.id,
    final_stage: finalStage,
    final_health: Number(overrides.health ?? simulator.health ?? 90),
    health: Number(overrides.health ?? simulator.health ?? 90),
    total_score: Number(overrides.score ?? 92),
    duration_days: 0,
    duration_seconds: Number(overrides.duration_seconds ?? 1384),
    visibility: overrides.visibility ?? 'private',
    snapshot_image_url: overrides.snapshot_image_url ?? '/media/plant-lab-tour.png',
    game_state: { simulator: clone(simulator), captured_at: nowIso(), schema_version: 2, growth_calculation: growthCalculation },
    growth_calculation: growthCalculation,
    analysis_result: overrides.analysis_result ?? 'The plant maintained stable growth under balanced environmental conditions.',
    direction: overrides.direction ?? 'Compare one factor at a time in the next growing cycle.',
    created_at: overrides.created_at ?? agoIso(id * 120),
  }
}

function seedHistories(plants) {
  const elephant = createSimulator(plants[0] ?? fallbackPlants[0], { id: 99101, growth_point: 100, growth_rate: 0, health: 96, status: 'completed' })
  const tulipPlant = plants[1] ?? fallbackPlants[1]
  const tulip = createSimulator(tulipPlant, { id: 99102, growth_point: 100, growth_rate: 0, health: 89, soil_temp: 15, air_temp: 18, status: 'completed' })
  return [
    historyFromSimulator(tulip, 9801, { score: 94, health: 89, visibility: 'public', created_at: agoIso(350) }),
    historyFromSimulator(elephant, 9802, { score: 91, health: 96, created_at: agoIso(1440) }),
    historyFromSimulator(createSimulator(plants[0] ?? fallbackPlants[0], { id: 99103, growth_point: 72, health: 76 }), 9803, { score: 78, health: 76, growth_point: 72, created_at: agoIso(2880) }),
  ]
}

function createFriendSimulator(plant) {
  return createSimulator(plant, {
    id: 99201,
    owner: { id: 999_101, username: 'Mali Garden', avatar_url: null, level: 12 },
    growth_point: 84,
    health: 88,
    share_visibility: 'public',
  })
}

function makeFriend(plants) {
  const simulator = createFriendSimulator(plants[1] ?? plants[0] ?? fallbackPlants[1])
  return {
    id: 9701,
    status: 'accepted',
    direction: 'outgoing',
    presence: 'online',
    user: { id: 999_101, username: 'Mali Garden', email: 'mali@example.test', avatar_url: null, cover_url: null, bio: 'Learning by growing one plant at a time.', role: 'user', level: 12, experience: 540, level_progress: { level: 12, experience: 540, next_level_experience: 650, percent: 83 }, friends_count: 4, plant_histories_count: 6, plants_count: 6, presence: 'online', friendship_status: 'connected' },
    latest_simulator: simulator,
    planted_simulators: [simulator],
  }
}

function initialInventory() {
  return fallbackItems.map((item, index) => ({ id: 9600 + index, user_id: demoUserTemplate.id, item_id: item.id, quantity: [3, 2, 2, 1, 1, 1, 4, 3, 2, 2, 2, 2][index] ?? 1, item }))
}

function initialShopItems() {
  const prices = { 2: 50, 3: 25, 4: 50, 5: 50, 6: 100, 7: 100, 8: 20, 9: 25, 10: 35, 11: 40, 12: 40, 13: 40 }

  return fallbackItems.map((item, index) => ({
    id: 9650 + index,
    item_id: item.id,
    price_coin: prices[item.id] ?? 50,
    stock: 999,
    is_active: true,
    item: clone(item),
  }))
}

function seedPublicPosts(histories) {
  const sharedHistory = histories.find((history) => history.visibility === 'public') ?? histories[0]
  const secondHistory = histories[1] ?? sharedHistory
  const friend = {
    id: 999_101,
    username: 'Mali Garden',
    avatar_url: null,
    cover_url: null,
    bio: 'Learning by growing one plant at a time.',
    level: 12,
  }

  return [
    {
      id: 9751,
      user_id: friend.id,
      user: friend,
      caption: 'A balanced light and watering routine helped this tulip finish strongly.',
      plant_history_id: sharedHistory?.id,
      plant_history: clone(sharedHistory),
      likes_count: 18,
      comments_count: 3,
      liked_by_me: false,
      created_at: agoIso(36),
    },
    {
      id: 9752,
      user_id: demoUserTemplate.id,
      user: clone(demoUserTemplate),
      caption: 'Comparing a completed Elephant Ear cycle before starting the next experiment.',
      plant_history_id: secondHistory?.id,
      plant_history: clone(secondHistory),
      likes_count: 11,
      comments_count: 2,
      liked_by_me: true,
      created_at: agoIso(190),
    },
  ]
}

function initialNotifications() {
  return [
    { id: 9501, type: 'comment', category: 'community', title: 'Mali commented on your post', message: '“Great comparison of light levels.”', is_read: false, created_at: agoIso(8), actor: { id: 999_101, username: 'Mali Garden', avatar_url: null } },
    { id: 9502, type: 'growth', category: 'game', title: 'Your plant is ready for the next update', message: 'Open Plant Lab to review its condition.', is_read: false, created_at: agoIso(24), actor: null },
  ]
}

function createSession() {
  const plants = clone(fallbackPlants)
  const simulator = createSimulator(plants[0])
  const histories = seedHistories(plants)
  return {
    storageSnapshot: captureLocalStorage(),
    user: clone(demoUserTemplate),
    plants,
    shopItems: initialShopItems(),
    inventory: initialInventory(),
    simulators: [simulator],
    histories,
    friends: [makeFriend(plants)],
    notifications: initialNotifications(),
    publicPosts: seedPublicPosts(histories),
    postComments: new Map(),
    simulatorComments: new Map(),
    actionResults: new Map(),
    objectUrls: [],
    nextId: 100_000,
  }
}

function parseBody(options = {}) {
  if (!options.body) return {}
  try { return JSON.parse(options.body) } catch { return {} }
}

function simulatorById(id) {
  return session?.simulators.find((item) => String(item.id) === String(id))
    ?? session?.friends.flatMap((friend) => friend.planted_simulators ?? []).find((item) => String(item.id) === String(id))
    ?? null
}

function updateSimulator(id, updater) {
  const current = simulatorById(id)
  if (!current) return null
  const next = updater(clone(current))
  session.simulators = session.simulators.map((item) => String(item.id) === String(id) ? next : item)
  session.friends = session.friends.map((friend) => ({ ...friend, latest_simulator: String(friend.latest_simulator?.id) === String(id) ? next : friend.latest_simulator, planted_simulators: (friend.planted_simulators ?? []).map((item) => String(item.id) === String(id) ? next : item) }))
  return next
}

function demoComment(text, id = null) {
  return { id: id ?? session.nextId++, comment_text: text, user: clone(session.user), likes_count: 0, liked_by_me: false, replies: [], created_at: nowIso() }
}

function insightSeries(days, values) {
  return Array.from({ length: days }, (_, index) => ({ date: new Date(Date.now() - ((days - index - 1) * 86_400_000)).toISOString().slice(0, 10), ...Object.fromEntries(Object.entries(values).map(([key, pattern]) => [key, pattern[index % pattern.length]])) }))
}

export function startDemoApiSession() {
  if (!session) session = createSession()
  return clone(session.user)
}

export function stopDemoApiSession() {
  session?.objectUrls?.forEach((url) => URL.revokeObjectURL(url))
  if (session?.storageSnapshot) restoreLocalStorage(session.storageSnapshot)
  session = null
}

export function isDemoApiSessionActive() {
  return Boolean(session)
}

export function getDemoApiToken() {
  return session ? DEMO_TOKEN : null
}

export function getDemoSessionUser() {
  return clone(session?.user ?? demoUserTemplate)
}

export function seedDemoSimulator(plant = null) {
  if (!session) return null
  const selectedPlant = plant ?? session.plants[0] ?? fallbackPlants[0]
  const existing = session.simulators.find((item) => Number(item.plant_id) === Number(selectedPlant.id))
  if (existing) return clone(existing)
  const simulator = createSimulator(selectedPlant, { id: session.nextId++ })
  session.simulators.unshift(simulator)
  return clone(simulator)
}

export function recordDemoPublicResponse(path, payload) {
  if (!session) return
  if (path === '/plants' && Array.isArray(payload?.data ?? payload)) {
    session.plants = clone(payload.data ?? payload)
    session.histories = seedHistories(session.plants)
    const current = session.simulators[0]
    if (current) session.simulators[0] = createSimulator(session.plants.find((plant) => Number(plant.id) === Number(current.plant_id)) ?? session.plants[0], current)
    session.friends = [makeFriend(session.plants)]
  }
  if (path === '/shop/items' && Array.isArray(payload?.data)) session.shopItems = clone(payload.data)
  if (path === '/posts' && Array.isArray(payload?.data ?? payload)) session.publicPosts = clone(payload.data ?? payload)
}

export function updateDemoProfile(profile = {}) {
  if (!session) return { data: null }
  const avatarUrl = profile.avatar instanceof File ? URL.createObjectURL(profile.avatar) : session.user.avatar_url
  const coverUrl = profile.cover instanceof File ? URL.createObjectURL(profile.cover) : session.user.cover_url
  if (avatarUrl?.startsWith('blob:') && avatarUrl !== session.user.avatar_url) session.objectUrls.push(avatarUrl)
  if (coverUrl?.startsWith('blob:') && coverUrl !== session.user.cover_url) session.objectUrls.push(coverUrl)
  session.user = {
    ...session.user,
    username: profile.username || session.user.username,
    bio: profile.bio ?? session.user.bio,
    avatar_url: avatarUrl,
    cover_url: coverUrl,
  }
  return { data: clone(session.user) }
}

export async function handleDemoApiRequest(path, options = {}) {
  if (!session) return { handled: false }
  const method = String(options.method ?? 'GET').toUpperCase()
  const cleanPath = String(path).split('?')[0]
  const body = parseBody(options)

  await new Promise((resolve) => window.setTimeout(resolve, method === 'GET' ? 80 : 140))

  // Public catalog calls are also resolved locally while preview mode is
  // active. This prevents the sandbox from silently falling through to the
  // production API even for endpoints that normally allow guest access.
  if (cleanPath === '/plants' && method === 'GET') return { handled: true, payload: { data: clone(session.plants) } }
  if (/^\/plants\/[^/]+$/.test(cleanPath) && method === 'GET') {
    const plantId = cleanPath.split('/')[2]
    return { handled: true, payload: { data: clone(session.plants.find((plant) => String(plant.id) === String(plantId)) ?? null) } }
  }
  if (cleanPath === '/shop/items' && method === 'GET') return { handled: true, payload: { data: clone(session.shopItems) } }
  if (cleanPath === '/model-assets' && method === 'GET') {
    return {
      handled: true,
      payload: {
        data: [
          { id: 1, asset_key: 'plant.original', label: 'Preview plant model', type: 'plant', url: '/plant.gltf', metadata: { source: 'frontend-preview' } },
          { id: 2, asset_key: 'ground.dirt', label: 'Preview ground model', type: 'scene', url: '/dirt.gltf', metadata: { source: 'frontend-preview' } },
          { id: 3, asset_key: 'pest.aphid', label: 'Preview aphid model', type: 'pest', url: '/aphid.gltf', metadata: { source: 'frontend-preview' } },
          { id: 4, asset_key: 'pest.snail', label: 'Preview snail model', type: 'pest', url: '/snails.gltf', metadata: { source: 'frontend-preview' } },
        ],
      },
    }
  }
  if ((cleanPath === '/contents' || cleanPath.startsWith('/contents/')) && method === 'GET') {
    return { handled: true, payload: { data: [] } }
  }
  if (cleanPath === '/posts' && method === 'GET') return { handled: true, payload: { data: clone(session.publicPosts) } }

  if (cleanPath === '/me') return { handled: true, payload: { data: clone(session.user) } }
  if (cleanPath === '/me/onboarding') {
    session.user.onboarding_progress = { ...(session.user.onboarding_progress ?? {}), [body.page]: { version: body.version, state: body.state } }
    return { handled: true, payload: { data: clone(session.user) } }
  }
  if (cleanPath === '/auth/password-reset/request') {
    return { handled: true, payload: { message: 'A preview verification code was created. Use 123456 in this demo.' } }
  }
  if (cleanPath === '/auth/password-reset/verify') {
    if (String(body.otp ?? '') !== '123456') {
      const error = new Error('For this preview, enter the code 123456.')
      error.status = 422
      throw error
    }
    return { handled: true, payload: { reset_token: 'demo-reset-token' } }
  }
  if (cleanPath === '/auth/password-reset/complete') {
    return { handled: true, payload: { message: 'Password updated for this preview session only.' } }
  }
  if (cleanPath === '/inventory') return { handled: true, payload: { data: clone(session.inventory) } }
  if (cleanPath === '/notifications') return { handled: true, payload: { data: clone(session.notifications) } }
  if (/^\/notifications\/[^/]+\/read$/.test(cleanPath)) {
    const id = cleanPath.split('/')[2]
    session.notifications = session.notifications.map((item) => String(item.id) === String(id) ? { ...item, is_read: true, read_at: nowIso() } : item)
    return { handled: true, payload: { data: clone(session.notifications.find((item) => String(item.id) === String(id))) } }
  }

  if (cleanPath === '/simulators' && method === 'GET') return { handled: true, payload: { data: clone(session.simulators.filter((item) => !path.includes('status=') || path.includes(`status=${item.status}`))) } }
  if (cleanPath === '/simulators/latest' && method === 'GET') return { handled: true, payload: { data: clone(session.simulators[0] ?? null) } }
  if (cleanPath === '/simulators' && method === 'POST') {
    const plant = session.plants.find((item) => Number(item.id) === Number(body.plant_id)) ?? session.plants[0]
    const simulator = createSimulator(plant, {
      id: session.nextId++, mode: body.mode, location_name: body.location_name,
      latitude: body.latitude, longitude: body.longitude, location_timezone: body.location_timezone,
      start_month: body.start_month, growth_point: 0, growth_rate: 0, active_seconds: 0,
    })
    session.simulators = [simulator, ...session.simulators.filter((item) => Number(item.plant_id) !== Number(plant.id))]
    return { handled: true, payload: { data: clone(simulator) } }
  }

  const actionMatch = cleanPath.match(/^\/simulators\/([^/]+)\/actions$/)
  if (actionMatch && method === 'POST') {
    const simulatorId = actionMatch[1]
    const idempotencyKey = String(body.client_action_id ?? '')
    if (idempotencyKey && session.actionResults.has(idempotencyKey)) {
      return { handled: true, payload: clone(session.actionResults.get(idempotencyKey)) }
    }
    const itemId = Number(body.item_id)
    const itemEntry = session.inventory.find((entry) => Number(entry.item_id) === itemId)
    if (itemId && (!itemEntry || Number(itemEntry.quantity) < 1)) {
      const error = new Error('This preview item is out of stock.')
      error.status = 422
      throw error
    }
    const item = itemEntry?.item ?? fallbackItems.find((entry) => Number(entry.id) === itemId)
    const actionKey = String(body.action_key || item?.action_key || item?.effect_type || '')
    const activeSimulator = session.simulators.find((entry) => String(entry.id) === String(simulatorId))
    if (itemId && ['water', 'fertilizer'].includes(actionKey) && Number(activeSimulator?.[actionKey] ?? 0) >= 100) {
      const error = new Error(actionKey === 'water'
        ? 'The plant water reserve is already full.'
        : 'The plant nutrient reserve is already full.')
      error.status = 422
      throw error
    }
    if (itemId) {
      session.inventory = session.inventory.map((entry) => Number(entry.item_id) === itemId
        ? { ...entry, quantity: Math.max(0, Number(entry.quantity) - 1) }
        : entry)
    }
    const next = updateSimulator(simulatorId, (current) => {
      const updated = { ...current, updated_at: nowIso(), state_version: Number(current.state_version ?? 0) + 1 }
      if (actionKey.includes('water')) updated.water = Math.min(100, Number(current.water) + Number(item?.effect_value ?? 22))
      if (actionKey.includes('fertilizer')) updated.fertilizer = Math.min(100, Number(current.fertilizer) + Number(item?.effect_value ?? 18))
      if (actionKey.includes('soil') && !actionKey.includes('drainage')) updated.soil_humidity = Math.min(100, Number(body.target_value ?? Number(current.soil_humidity) + 8))
      if (actionKey.includes('drainage')) updated.soil_humidity = Math.max(0, Number(current.soil_humidity) - 15)
      if (actionKey.includes('shade')) updated.light = Math.max(0, Number(current.light) - 10)
      if (actionKey.includes('windbreak')) updated.air_humidity = Math.min(100, Number(current.air_humidity) + 8)
      if (actionKey.includes('frost-cover')) updated.air_temp = Math.min(80, Number(current.air_temp) + 6)
      if (actionKey.includes('pest_control')) updated.active_pests = []
      if (['shade', 'windbreak', 'frost-cover'].includes(actionKey)) {
        const currentTick = Number(current.event_tick_count ?? 0)
        const activeModifiers = Array.isArray(current.active_modifiers) ? current.active_modifiers : []
        updated.active_modifiers = [
          ...activeModifiers.filter((modifier) => String(modifier.action_key ?? '') !== actionKey),
          {
            id: `preview-${actionKey}-${currentTick}`,
            action_key: actionKey,
            animation_key: actionKey,
            factor_key: actionKey === 'shade' ? 'light' : actionKey === 'windbreak' ? 'air_humidity' : 'air_temp',
            starts_tick: currentTick,
            ends_tick: currentTick + 3,
          },
        ]
      }
      updated.plant_needs = {
        ...(current.plant_needs ?? {}),
        water: Number(updated.water ?? current.water),
        fertilizer: Number(updated.fertilizer ?? current.fertilizer),
        rates: current.plant_needs?.rates ?? { water_per_cycle: 3, fertilizer_per_cycle: 0.25, rain_recovery: 0 },
      }
      return updated
    })
    const inventory = clone(session.inventory.find((entry) => Number(entry.item_id) === itemId) ?? null)
    const payload = { data: {
      id: session.nextId++, client_action_id: idempotencyKey, action_key: actionKey,
      status: 'success', result_payload: { preview: true }, applied_at: nowIso(),
      simulator: clone(next), inventory,
      inventory_quantity: inventory?.quantity ?? null,
      message_code: 'game.action.applied', message_params: { action: actionKey }, replayed: false,
    } }
    if (idempotencyKey) session.actionResults.set(idempotencyKey, clone(payload))
    return { handled: true, payload }
  }

  const locationMatch = cleanPath.match(/^\/simulators\/([^/]+)\/location$/)
  if (locationMatch && method === 'POST') {
    const next = updateSimulator(locationMatch[1], (current) => ({
      ...current,
      latitude: Number(body.latitude), longitude: Number(body.longitude),
      location_name: body.location_name || current.location_name,
      location_timezone: body.timezone || current.location_timezone || 'Asia/Bangkok',
      location_changed_at: nowIso(), updated_at: nowIso(),
    }))
    return { handled: true, payload: { data: clone(next), weather_preview: { temperature: 27, precipitation: 0, wind_speed: 8, timezone: next.location_timezone } } }
  }

  const eventMatch = cleanPath.match(/^\/simulators\/([^/]+)\/events$/)
  if (eventMatch && method === 'GET') return { handled: true, payload: { data: [] } }

  if (cleanPath === '/locations/search' && method === 'GET') {
    return { handled: true, payload: { data: [{ name: 'Bangkok, Thailand (preview)', latitude: 13.7563, longitude: 100.5018 }] } }
  }
  if (cleanPath === '/locations/reverse' && method === 'GET') {
    return { handled: true, payload: { data: { display_name: 'Current preview location', latitude: 13.7563, longitude: 100.5018 } } }
  }
  if (cleanPath === '/locations/weather-preview' && method === 'GET') {
    return { handled: true, payload: { data: { current: { temperature_2m: 27, precipitation: 0, rain: 0, wind_speed_10m: 8, weather_code: 1 }, timezone: 'Asia/Bangkok' } } }
  }
  if (cleanPath === '/locations/seasonal-preview' && method === 'GET') {
    const query = new URLSearchParams(String(path).split('?')[1] ?? '')
    const latitude = Number(query.get('latitude') ?? 13.7563)
    const month = Math.max(1, Math.min(12, Number(query.get('month') ?? new Date().getMonth() + 1)))
    const plant = session.plants.find((entry) => String(entry.id) === String(query.get('plant_id'))) ?? null
    const seasonKey = previewSeasonByMonth(month, latitude)
    const mean = seasonKey === 'hot' ? 34 : seasonKey === 'rainy' ? 28 : 24
    const minimum = Number(plant?.environment?.air_temp?.min ?? 18)
    const maximum = Number(plant?.environment?.air_temp?.max ?? 34)
    const distance = mean < minimum ? minimum - mean : mean > maximum ? mean - maximum : 0
    const score = Math.max(0, Math.min(100, Math.round(100 - distance * 9)))
    return { handled: true, payload: { data: {
      climate_zone: 'tropical', season_key: seasonKey, month,
      temperature_mean: mean, precipitation_daily_mean: seasonKey === 'rainy' ? 11.8 : 1.2,
      suitability_score: score, suitability: score >= 80 ? 'excellent' : score >= 50 ? 'manageable' : 'high_risk',
      source: 'historical_reanalysis', source_label_en: 'Historical weather profile',
      source_label_th: 'ข้อมูลอากาศย้อนหลัง', location_timezone: 'Asia/Bangkok',
    } } }
  }

  const seasonalContextMatch = cleanPath.match(/^\/simulators\/([^/]+)\/seasonal-context$/)
  if (seasonalContextMatch && method === 'GET') {
    return { handled: true, payload: { data: clone(simulatorById(seasonalContextMatch[1])?.seasonal_context ?? null) } }
  }

  const simulatorMatch = cleanPath.match(/^\/simulators\/([^/]+)(?:\/(tick|sync|finish|uproot|share|claim-maturity-reward|use-item|prank|histories|comments))?$/)
  if (simulatorMatch) {
    const [, simulatorId, action] = simulatorMatch
    if (!action && method === 'GET') return { handled: true, payload: { data: clone(simulatorById(simulatorId)) } }
    if (action === 'tick') {
      const next = updateSimulator(simulatorId, (current) => {
        const factors = body.factors ?? body
        const weatherDriven = ['outdoor', 'seasonal'].includes(current.mode)
        const seasonalDay = current.mode === 'seasonal' ? current.seasonal_context?.current : null
        const appliedFactors = seasonalDay ? {
          ...factors,
          light: Math.max(0, Math.min(100, Math.round(Number(seasonalDay.shortwave_radiation ?? 15) * 4.2))),
          soil_humidity: Math.max(0, Math.min(100, Math.round(Number(seasonalDay.soil_moisture ?? .2) * 200))),
          air_humidity: Number(seasonalDay.humidity ?? factors.air_humidity),
          soil_temp: Number(seasonalDay.soil_temperature ?? factors.soil_temp),
          air_temp: Number(seasonalDay.temperature_mean ?? factors.air_temp),
          rain: Number(seasonalDay.rain ?? 0),
          wind_speed: Number(seasonalDay.wind_speed ?? 0),
          wind_gust: Number(seasonalDay.wind_gust ?? 0),
        } : factors
        const rainRecovery = weatherDriven ? Math.min(12, Math.round(Number(appliedFactors.rain ?? 0) * 4)) : 0
        const waterConsumed = Math.max(2, Math.min(8, Math.round(3 + Math.max(0, Number(appliedFactors.air_temp ?? current.air_temp) - 32) * .18)))
        const water = Math.max(0, Math.min(100, Number(current.water) - waterConsumed + rainRecovery))
        const fertilizerConsumed = (Number(current.event_tick_count ?? 0) + 1) % 4 === 0 ? 1 : 0
        const fertilizer = Math.max(0, Number(current.fertilizer) - fertilizerConsumed)
        const light = Number(appliedFactors.light ?? current.light)
        const airTemp = Number(appliedFactors.air_temp ?? current.air_temp)
        const optimal = current.plant?.environment ?? {}
        const center = (range, fallback) => range ? (Number(range.min) + Number(range.max)) / 2 : fallback
        const resourceStress = water <= 8 ? 55 : water <= 25 ? 25 : 0
        const nutrientStress = fertilizer <= 10 ? 30 : fertilizer <= 22 ? 12 : 0
        const stress = resourceStress + nutrientStress + Math.abs(light - center(optimal.light, 72)) * .35 + Math.abs(airTemp - center(optimal.air_temp, 26)) * 2.2
        const health = Math.max(0, Math.min(100, Math.round(100 - stress)))
        const growthRate = health >= 80 ? 8 : health >= 55 ? 3 : 0
        const biologicalIncrement = health <= 0 ? 0 : Math.max(0, Math.min(1, growthRate / 8))
        const biologicalDays = Number(current.biological_days ?? 0) + biologicalIncrement
        const growthPoint = current.mode === 'seasonal'
          ? Math.min(100, Math.round((biologicalDays / Number(current.plant?.real_maturity_days ?? 100)) * 100))
          : Math.min(100, Number(current.growth_point) + growthRate)
        const eventTick = Number(current.event_tick_count ?? 0) + 1
        const calendarDay = Number(current.calendar_day ?? 0) + (current.mode === 'seasonal' ? 1 : 0)
        const seasonalContext = current.mode === 'seasonal'
          ? createDemoSeasonalContext({ calendarDay, biologicalDays, latitude: current.latitude, startMonth: current.start_month })
          : current.seasonal_context
        return { ...current, ...appliedFactors, water, fertilizer, biological_days: biologicalDays, calendar_day: calendarDay, simulated_datetime: seasonalContext?.simulated_datetime ?? current.simulated_datetime, seasonal_context: seasonalContext, season_key: seasonalContext?.season_key ?? current.season_key, weather_source: seasonalContext?.weather_source ?? current.weather_source, plant_needs: { water, fertilizer, rates: { water_per_cycle: waterConsumed, fertilizer_per_cycle: fertilizerConsumed, rain_recovery: rainRecovery } }, air_temp: airTemp, health, growth_rate: growthRate, growth_point: growthPoint, current_stage: stageForPlant(current.plant, growthPoint), current_model_url: stageForPlant(current.plant, growthPoint)?.model_url ?? current.plant?.base_model_url, state_version: Number(current.state_version ?? 0) + 1, event_tick_count: eventTick, active_seconds: Number(current.active_seconds ?? 0) + 30, visual_state: water <= 25 ? 'underwatered' : fertilizer <= 22 ? 'nutrient_deficient' : health < 45 ? 'stunted' : 'healthy', updated_at: nowIso() }
      })
      return { handled: true, payload: { data: clone(next) } }
    }
    if (action === 'sync') {
      const syncBody = Object.fromEntries(Object.entries(body)
        .filter(([key]) => !['water', 'fertilizer', 'plant_needs'].includes(key)))
      const next = updateSimulator(simulatorId, (current) => ({ ...current, ...syncBody, plant: current.plant, current_stage: stageForPlant(current.plant, syncBody.growth_point ?? current.growth_point), updated_at: nowIso() }))
      return { handled: true, payload: { data: clone(next) } }
    }
    if (action === 'finish' || action === 'uproot') {
      const next = updateSimulator(simulatorId, (current) => ({ ...current, status: action === 'finish' ? 'completed' : 'cancelled', ended_at: nowIso(), growth_rate: 0 }))
      if (action === 'uproot') session.simulators = session.simulators.filter((item) => String(item.id) !== String(simulatorId))
      return { handled: true, payload: { data: action === 'finish' ? clone(next) : { id: simulatorId, status: 'cancelled' } } }
    }
    if (action === 'share') {
      const next = updateSimulator(simulatorId, (current) => ({ ...current, share_visibility: body.visibility ?? 'public', shared_at: nowIso() }))
      return { handled: true, payload: { data: clone(next), message: 'Preview sharing updated.' } }
    }
    if (action === 'claim-maturity-reward') {
      session.user.coin += 100
      const next = updateSimulator(simulatorId, (current) => ({ ...current, maturity_reward_claimed_at: nowIso() }))
      return { handled: true, payload: { data: clone(next), user: clone(session.user), balance: session.user.coin, reward: 100 } }
    }
    if (action === 'use-item' || action === 'prank') {
      const itemId = Number(body.item_id)
      if (itemId) session.inventory = session.inventory.map((entry) => Number(entry.item_id) === itemId ? { ...entry, quantity: Math.max(0, Number(entry.quantity) - Number(body.quantity ?? 1)) } : entry)
      const next = updateSimulator(simulatorId, (current) => ({ ...current, active_pests: [], health: Math.min(100, Number(current.health) + 4) }))
      return { handled: true, payload: { data: clone(next), simulator: clone(next), inventory: clone(session.inventory.find((entry) => Number(entry.item_id) === itemId) ?? null), user: clone(session.user) } }
    }
    if (action === 'histories') {
      const simulator = simulatorById(simulatorId)
      const history = historyFromSimulator(simulator, session.nextId++, { score: body.total_score, health: simulator.health, visibility: body.visibility, snapshot_image_url: body.snapshot_image_data || '/media/plant-lab-tour.png' })
      session.histories = [history, ...session.histories]
      return { handled: true, payload: { data: clone(history) } }
    }
    if (action === 'comments' && method === 'GET') return { handled: true, payload: { data: clone(session.simulatorComments.get(String(simulatorId)) ?? []) } }
    if (action === 'comments' && method === 'POST') {
      const comment = demoComment(body.comment_text)
      session.simulatorComments.set(String(simulatorId), [...(session.simulatorComments.get(String(simulatorId)) ?? []), comment])
      return { handled: true, payload: { data: clone(comment) } }
    }
  }

  const spectatorMatch = cleanPath.match(/^\/spectator\/simulators\/([^/]+)$/)
  if (spectatorMatch) return { handled: true, payload: { data: clone(simulatorById(spectatorMatch[1])) } }

  const shopBuyMatch = cleanPath.match(/^\/shop\/items\/([^/]+)\/buy$/)
  if (shopBuyMatch) {
    const shopItem = session.shopItems.find((item) => String(item.id) === String(shopBuyMatch[1]))
    const item = shopItem?.item ?? fallbackItems[0]
    const quantity = Number(body.quantity ?? 1)
    const fallbackPrices = { 2: 50, 3: 25, 4: 50, 5: 50, 6: 100, 7: 100, 8: 20, 9: 25, 10: 35, 11: 40, 12: 40, 13: 40 }
    const price = Number(shopItem?.price_coin ?? fallbackPrices[item.id] ?? 0) * quantity
    session.user.coin = Math.max(0, Number(session.user.coin) - price)
    const existing = session.inventory.find((entry) => Number(entry.item_id) === Number(item.id))
    let inventory
    if (existing) {
      inventory = { ...existing, quantity: Number(existing.quantity) + quantity, item: clone(item) }
      session.inventory = session.inventory.map((entry) => Number(entry.item_id) === Number(item.id) ? inventory : entry)
    } else {
      inventory = { id: session.nextId++, user_id: session.user.id, item_id: item.id, quantity, item: clone(item) }
      session.inventory.push(inventory)
    }
    return { handled: true, payload: { data: clone(inventory), user: clone(session.user) } }
  }

  if (cleanPath === '/plant-histories' && method === 'GET') return { handled: true, payload: { data: clone(session.histories) } }
  const historyMatch = cleanPath.match(/^\/plant-histories\/([^/]+)(?:\/(visibility))?$/)
  if (historyMatch) {
    const [, id, action] = historyMatch
    if (method === 'DELETE') {
      session.histories = session.histories.filter((history) => String(history.id) !== String(id))
      return { handled: true, payload: { data: { id, deleted: true } } }
    }
    if (action === 'visibility') {
      session.histories = session.histories.map((history) => String(history.id) === String(id) ? { ...history, visibility: body.visibility } : history)
      return { handled: true, payload: { data: clone(session.histories.find((history) => String(history.id) === String(id))) } }
    }
  }

  if (cleanPath === '/friends') return { handled: true, payload: { data: clone(session.friends), meta: { total: session.friends.length, active_now: session.friends.filter((friend) => friend.presence === 'online').length } } }
  if (cleanPath === '/users/search') return { handled: true, payload: { data: clone(session.friends.map((friend) => friend.user)) } }
  if (cleanPath === '/friends/invite') return { handled: true, payload: { data: { id: session.nextId++, status: 'pending', direction: 'outgoing' } } }
  const friendSimulatorMatch = cleanPath.match(/^\/friends\/([^/]+)\/simulator\/latest$/)
  if (friendSimulatorMatch) return { handled: true, payload: { data: clone(session.friends.find((friend) => String(friend.id) === String(friendSimulatorMatch[1]))?.latest_simulator ?? null) } }
  if (/^\/friends\/[^/]+(?:\/accept)?$/.test(cleanPath)) return { handled: true, payload: { data: clone(session.friends[0] ?? null), message: 'Preview friendship updated.' } }
  if (cleanPath === '/posts/friends') return { handled: true, payload: { data: clone(session.publicPosts.slice(0, 4)) } }

  if (cleanPath === '/community/leaderboard') {
    const friendUsers = session.friends.map((friend) => friend.user)
    const users = [session.user, ...friendUsers]
    return { handled: true, payload: { data: { levels: users.map((user) => ({ ...user, score_label: `Lv.${user.level}` })), growers: users.map((user, index) => ({ ...user, score_label: `${6 - index} saves` })) } } }
  }
  if (cleanPath === '/community/insights') {
    const days = Math.max(7, Math.min(90, Number(new URLSearchParams(String(path).split('?')[1] ?? '').get('days')) || 30))
    return { handled: true, payload: { data: { days, from: new Date(Date.now() - ((days - 1) * 86_400_000)).toISOString().slice(0, 10), to: nowIso().slice(0, 10), content: insightSeries(days, { posts: [0, 0, 1, 0, 0], likes: [1, 0, 2, 0, 1], comments: [0, 1, 0, 0, 1], replies: [0, 0, 1, 0, 0] }), activity: insightSeries(days, { posts: [0, 0, 1, 0, 0], likes: [0, 1, 1, 0, 2], comments: [1, 0, 0, 1, 0], replies: [0, 1, 0, 0, 0] }) } } }
  }

  const postCommentsMatch = cleanPath.match(/^\/posts\/([^/]+)\/comments(?:\/([^/]+)(?:\/(replies|likes))?)?$/)
  if (postCommentsMatch) {
    const [, postId, commentId, action] = postCommentsMatch
    const comments = session.postComments.get(String(postId)) ?? [demoComment('This comparison makes the result easy to understand.', 9401)]
    if (method === 'GET') return { handled: true, payload: { data: clone(comments) } }
    if (!commentId && method === 'POST') {
      const comment = demoComment(body.comment_text)
      session.postComments.set(String(postId), [...comments, comment])
      return { handled: true, payload: { data: clone(comment), comments_count: comments.length + 1 } }
    }
    if (action === 'replies') {
      const reply = demoComment(body.comment_text)
      session.postComments.set(String(postId), comments.map((comment) => String(comment.id) === String(commentId) ? { ...comment, replies: [...(comment.replies ?? []), reply] } : comment))
      return { handled: true, payload: { data: clone(reply), comments_count: comments.length + 1 } }
    }
    if (action === 'likes') return { handled: true, payload: { liked_by_me: method !== 'DELETE', likes_count: method === 'DELETE' ? 0 : 1 } }
  }

  const postLikeMatch = cleanPath.match(/^\/posts\/([^/]+)\/likes$/)
  if (postLikeMatch) return { handled: true, payload: { liked_by_me: method !== 'DELETE', likes_count: method === 'DELETE' ? 12 : 13 } }

  // Any remaining private action stays inside the sandbox and returns a benign response.
  return { handled: true, payload: { data: {}, message: 'Preview action completed. No real data was changed.' } }
}
