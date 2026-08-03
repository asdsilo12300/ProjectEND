import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import './App.css'
import { defaultClimate, imageAssets } from './game/data/gameData'
import { GrowingModePicker } from './game/components/GrowingModePicker'
import { LibrarySidebar } from './game/components/LibrarySidebar'
import { CircularLoader } from './game/components/LoadingSkeleton'
import { PlantKnowledgeModal } from './game/components/PlantKnowledgeModal'
import { ToastStack } from './game/components/ToastStack'
import { TopBar } from './game/components/TopBar'
import { CommentsPanel } from './game/panels/CommentsPanel'
import { EnvironmentPanel } from './game/panels/EnvironmentPanel'
import { FriendsPanel } from './game/panels/FriendsPanel'
import { PlantMonitorPanel } from './game/panels/PlantMonitorPanel'
import { OnboardingExperience } from './game/onboarding/OnboardingExperience'
import { LoginPage } from './auth/LoginPage'
import { DemoSafetyBar } from './demo/DemoSafetyBar'
import { isDemoApiSessionActive, seedDemoSimulator, startDemoApiSession, stopDemoApiSession } from './demo/demoApiSession'
import { LandingPage } from './landing/LandingPage'
import { clearToken, claimMaturityReward, getFriendLatestSimulator, getMe, getModelAssets, getNotifications, getPlants, getSimulators, getToken, getInventory, getShopItems, getSpectatorSimulator, login as loginUser, loginWithGoogle, markNotificationRead, prankFriendSimulator, register as registerUser, shareSimulator, startSimulator, syncSimulatorSnapshot, tickSimulator, applySimulatorItem, savePlantHistory, resolveAssetUrl, uprootSimulator } from './lib/api'
import { buildSimulationFactors, defaultSimulationVisual } from './game/utils/localSimulation'
import { climateFromForecast, fetchLocationAddress, fetchOutdoorForecast, getFixedOutdoorLocation, getOutdoorReadings } from './game/utils/outdoorWeather'
import { getRealGrowthEstimate, SIMULATION_CYCLE_SECONDS } from './game/utils/realGrowth'
import { defaultWindows, panelExpandedPosition, reflowWindowsForViewport } from './game/utils/windows'
import { applySettings, loadSettings } from './game/settings/settingsPreferences'

const AdminPage = lazy(() => import('./admin/AdminPage').then((module) => ({ default: module.AdminPage })))
const CommunityPage = lazy(() => import('./game/community/CommunityPage').then((module) => ({ default: module.CommunityPage })))
const HistoryPage = lazy(() => import('./game/history/HistoryPage').then((module) => ({ default: module.HistoryPage })))
const PasswordResetPage = lazy(() => import('./game/settings/PasswordResetPage').then((module) => ({ default: module.PasswordResetPage })))
const SettingsPage = lazy(() => import('./game/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const ShopPage = lazy(() => import('./game/shop/ShopPage').then((module) => ({ default: module.ShopPage })))
const SimulationStage = lazy(() => import('./game/scene/SimulationStage').then((module) => ({ default: module.SimulationStage })))

const plantKnowledgeAutoOpenPrefix = 'plant-growth-academy:plant-knowledge:auto-opened'

function plantKnowledgeIdentity(plantAsset) {
  return String(plantAsset?.backendId ?? plantAsset?.id ?? plantAsset?.name ?? 'plant')
}

function plantKnowledgeAutoOpenKey(userId, plantAsset) {
  const plantId = plantKnowledgeIdentity(plantAsset)
  return `${plantKnowledgeAutoOpenPrefix}:${userId ?? 'guest'}:${plantId}`
}

const initialOutdoorWeather = {
  status: 'idle',
  message: '',
  location: null,
  forecast: null,
  addressLabel: '',
}

function createDemoOutdoorWeather() {
  const now = new Date()
  const hour = now.getHours()
  const observedAt = now.toISOString().slice(0, 13) + ':00'
  const isDay = hour >= 6 && hour < 18
  const location = { latitude: 13.7563, longitude: 100.5018, source: 'preview' }
  const forecast = {
    timezone: 'Asia/Bangkok',
    timezone_abbreviation: 'ICT',
    current: {
      time: observedAt,
      is_day: isDay ? 1 : 0,
      precipitation: 0,
      rain: 0,
      showers: 0,
      snowfall: 0,
      wind_speed_10m: 6,
      wind_direction_10m: 120,
      wind_gusts_10m: 9,
    },
    hourly: {
      time: [observedAt],
      temperature_2m: [29],
      relative_humidity_2m: [62],
      soil_temperature_6cm: [25],
      soil_moisture_1_to_3cm: [0.58],
    },
    daily: {
      precipitation_sum: [0],
      rain_sum: [0],
      showers_sum: [0],
      precipitation_probability_max: [15],
    },
  }

  return {
    status: 'ready',
    message: 'Sample weather generated locally for this preview',
    location,
    forecast,
    addressLabel: 'Preview Garden · Bangkok',
  }
}

const initialFriendGardenLoading = {
  active: false,
  commentsReady: false,
  dataReady: false,
  error: '',
  loadKey: 0,
  ownerName: 'Friend',
  sceneReady: false,
  simulatorId: undefined,
}

function locationFromSimulator(simulator, source = 'simulation') {
  const latitude = Number(simulator?.latitude)
  const longitude = Number(simulator?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return {
    latitude,
    longitude,
    source,
  }
}

async function outdoorWeatherForSimulator(simulator) {
  if (simulator?.mode !== 'outdoor') return initialOutdoorWeather

  const location = locationFromSimulator(simulator, 'spectator')
  if (!location) {
    return {
      ...initialOutdoorWeather,
      status: 'error',
      message: 'This outdoor garden has no saved map location.',
      addressLabel: simulator?.location_name ?? 'Outdoor location unavailable',
    }
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10000)

  try {
    const forecast = await fetchOutdoorForecast(location, { signal: controller.signal })
    return {
      status: 'ready',
      message: 'Weather loaded from the garden owner location',
      location,
      forecast,
      addressLabel: simulator?.location_name ?? 'Friend outdoor location',
    }
  } catch {
    return {
      status: 'error',
      message: 'Weather is temporarily unavailable for this garden.',
      location,
      forecast: null,
      addressLabel: simulator?.location_name ?? 'Friend outdoor location',
    }
  } finally {
    window.clearTimeout(timeout)
  }
}

const initialGrowthTrack = {
  progress: 0,
  history: [0],
}

const baseGrowthAnimationDurationMs = 1600
const normalGrowthPointsPerCycle = 14
const maximumGrowthAnimationDurationMs = 6400
const autosaveIntervalMs = 30000
const simulationTickIntervalMs = SIMULATION_CYCLE_SECONDS * 1000
const initialSimulationTickDelayMs = simulationTickIntervalMs
const simulationTickMarkerPrefix = 'plant_game_last_tick:'
const resetMarkerKey = 'plant_game_reset_marker'
const communityNotificationTypes = new Set(['like', 'comment', 'reply', 'comment_like'])

const itemNameToKey = {
  'Hand Pick': 'hand-pick',
  'Insect Spray': 'insecticide-spray',
  'Snail Spray': 'snail-spray',
  'Fungus Spray': 'antifungal-spray',
  'Aphid Prank': 'aphid-prank',
  'Snail Prank': 'snail-prank',
}

function growthAnimationDurationForRate(growthRate) {
  const rate = Math.max(0, Number(growthRate) || 0)
  if (rate <= 0) return 0

  return Math.min(
    maximumGrowthAnimationDurationMs,
    Math.max(900, baseGrowthAnimationDurationMs * (normalGrowthPointsPerCycle / rate)),
  )
}

const itemImageByKey = {
  'hand-pick': imageAssets.hand,
  'insecticide-spray': imageAssets.insecticide,
  'snail-spray': imageAssets.snailSpray,
  'antifungal-spray': imageAssets.antifungal,
  'aphid-prank': imageAssets.aphid,
  'snail-prank': imageAssets.snail,
}

const itemTargetsByKey = {
  'hand-pick': [{ label: 'Aphid', imageUrl: imageAssets.aphid }, { label: 'Snail', imageUrl: imageAssets.snail }],
  'insecticide-spray': [{ label: 'Aphid', imageUrl: imageAssets.aphid }],
  'snail-spray': [{ label: 'Snail', imageUrl: imageAssets.snail }],
  'antifungal-spray': [{ label: 'Fungus', imageUrl: imageAssets.fungus }],
  'aphid-prank': [],
  'snail-prank': [],
}

const itemMetaByKey = {
  'hand-pick': {
    detail: 'aphid + snail',
    successText: 'Aphid 40% / Snail 80%',
    failText: 'Aphid fail 60% / Snail fail 20%',
    help: 'Manual removal: aphids succeed 40% and snails succeed 80%.',
  },
  'insecticide-spray': {
    detail: 'clears aphids',
    successText: 'Success 100%',
    failText: 'Fail 0%',
    help: 'Spray for aphids. Removes active aphids with 100% success.',
  },
  'snail-spray': {
    detail: 'clears snails',
    successText: 'Success 100%',
    failText: 'Fail 0%',
    help: 'Spray for snails. Removes active snails with 100% success.',
  },
  'antifungal-spray': {
    detail: 'clears fungus',
    successText: 'Success 100%',
    failText: 'Fail 0%',
    help: 'Spray for fungus. Removes active fungus with 100% success.',
  },
  'aphid-prank': {
    detail: 'send aphids to a friend',
    successText: 'Friend garden only',
    failText: 'Cannot stack on active aphids',
    help: 'Use this in a friend garden to add aphids to the selected plant.',
    icon: 'bug',
  },
  'snail-prank': {
    detail: 'send a snail to a friend',
    successText: 'Friend garden only',
    failText: 'Cannot stack on an active snail',
    help: 'Use this in a friend garden to add a snail to the selected plant.',
    icon: 'snail',
  },
}

function getActionToastType(message) {
  const value = String(message ?? '').toLowerCase()
  if (/unable|error|failed|missing|not available|out of stock|no active|ไม่สามารถ|ผิดพลาด|ไม่พบ|หมด/.test(value)) return 'error'
  if (/using|saving|preparing|loading|connecting|resetting|confirming|กำลัง/.test(value)) return 'progress'
  if (/applied|complete|saved|planted|restored|visible|stopped|switched|level up|reward|success|เรียบร้อย|สำเร็จ|บันทึกแล้ว/.test(value)) return 'success'
  if (/choose|select|log in|view-only|cancelled|pending|before|เลือก|เข้าสู่ระบบ|ยกเลิก/.test(value)) return 'warning'
  return 'info'
}

function isCommunityNotification(notification) {
  if (notification?.category) return notification.category === 'community'
  return communityNotificationTypes.has(notification?.type)
}

function inventoryItemKey(entry) {
  const item = entry?.item ?? entry
  return itemNameToKey[item?.name] ?? String(item?.name ?? '').toLowerCase().replace(/\s+/g, '-')
}

function readablePlantName(plant) {
  const name = String(plant?.name_en ?? plant?.name_th ?? '').trim()
  if (!name || name === 'Simulation Sprout' || name === 'Sprout') return 'Elephant Ear'
  return name
}

function plantAssetFromApi(plant, planted = false) {
  return {
    id: `plant-${plant.id}`,
    backendId: plant.id,
    name: readablePlantName(plant),
    detail: plant.description ? 'Database plant' : 'Plant',
    color: '#9bcf82',
    type: 'plant',
    icon: 'sprout',
    imageUrl: resolveAssetUrl(plant.base_image_url),
    modelUrl: plant.base_model_url,
    plantData: plant,
    planted,
  }
}

function uniqueActiveSimulatorsByPlant(simulators = []) {
  const sorted = [...simulators]
    .filter((simulator) => simulator?.status === 'active' && simulator?.plant_id)
    .sort((left, right) => {
      const dateDifference = new Date(right.updated_at ?? 0).getTime() - new Date(left.updated_at ?? 0).getTime()
      return dateDifference || Number(right.id ?? 0) - Number(left.id ?? 0)
    })
  const byPlant = new Map()

  sorted.forEach((simulator) => {
    const plantId = Number(simulator.plant_id)
    if (!byPlant.has(plantId)) byPlant.set(plantId, simulator)
  })

  return [...byPlant.values()]
}

function itemAssetFromApi(entry, quantity = null) {
  const item = entry?.item ?? entry
  const itemKey = inventoryItemKey(item)
  const meta = itemMetaByKey[itemKey] ?? {}
  const friendUsable = String(item?.effect_type ?? '').startsWith('friend_pest:')

  return {
    id: itemKey,
    itemKey,
    backendId: item?.id,
    name: item?.name ?? 'Lab item',
    detail: meta.detail ?? item?.description ?? 'lab item',
    color: '#9bcf82',
    type: 'item',
    icon: meta.icon ?? 'hand',
    imageUrl: resolveAssetUrl(item?.image_url) ?? itemImageByKey[itemKey],
    targetImages: itemTargetsByKey[itemKey] ?? [],
    quantity: Number.isFinite(Number(quantity)) ? Number(quantity) : 0,
    quantityLabel: Number.isFinite(Number(quantity)) ? `x${quantity}` : 'x0',
    successText: meta.successText,
    failText: meta.failText,
    help: meta.help ?? item?.description,
    friendUsable,
  }
}

function clampSimulationProgress(value) {
  return Math.min(100, Math.max(0, Number(value) || 0))
}

function mergeSimulatorState(currentState, simulator, options = {}) {
  const current = currentState ?? defaultSimulationVisual
  const currentGrowth = clampSimulationProgress(current.growth_point)
  const nextGrowth = clampSimulationProgress(simulator?.growth_point ?? currentGrowth)

  return {
    ...defaultSimulationVisual,
    ...current,
    ...simulator,
    growth_point: nextGrowth,
    growth_rate: options.fromTick ? Math.max(0, nextGrowth - currentGrowth) : Number(current.growth_rate ?? 0),
    active_pests: Array.isArray(simulator?.active_pests) ? simulator.active_pests : (current.active_pests ?? []),
    pest_risks: options.preservePestRisks
      ? (current.pest_risks ?? simulator?.pest_risks ?? defaultSimulationVisual.pest_risks)
      : (simulator?.pest_risks ?? current.pest_risks ?? defaultSimulationVisual.pest_risks),
    current_stage: simulator?.current_stage ?? current.current_stage ?? defaultSimulationVisual.current_stage,
    current_model_url: simulator?.current_model_url ?? current.current_model_url ?? defaultSimulationVisual.current_model_url,
  }
}

function applyPestDelta(currentPests = [], { addedPest = null, removedPestIds = [] } = {}) {
  const removedIds = new Set(removedPestIds.map((id) => String(id)))
  const next = currentPests.filter((entry) => !removedIds.has(String(entry?.id)))

  if (!addedPest?.id) return next

  return [
    ...next.filter((entry) => (
      String(entry?.id) !== String(addedPest.id)
      && Number(entry?.pest?.id) !== Number(addedPest?.pest?.id)
    )),
    addedPest,
  ]
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function outdoorClimateWindow(currentWindows = {}) {
  const isCompactOutdoor = window.innerWidth < 640
  const monitorY = Number(currentWindows.monitor?.expandedY ?? currentWindows.monitor?.y ?? 88)
  const monitorHeight = isCompactOutdoor ? 430 : 470
  const x = isCompactOutdoor ? 16 : 258
  const y = Math.max(76, monitorY + monitorHeight + 6)

  return {
    x,
    y,
    expandedX: x,
    expandedY: y,
    visible: true,
    collapsed: false,
  }
}
function ModeLoadingOverlay({ mode }) {
  const label = !mode ? 'saved simulation' : mode === 'outdoor' ? 'outdoor field' : 'lab'

  return (
    <div className="absolute inset-0 z-[90] grid place-items-center bg-black/55 px-4 backdrop-blur-md">
      <CircularLoader
        className="min-h-52 w-full max-w-sm rounded-2xl border border-lime-100/15 bg-[#101511]/95 px-6 py-8 shadow-[0_18px_44px_rgba(0,0,0,.42)]"
        description="Preparing the simulation environment..."
        label={`Loading ${label}`}
      />
    </div>
  )
}

function FriendGardenLoadingScreen({ loading, onCancel }) {
  const steps = [
    { label: 'Garden data', ready: loading.dataReady },
    { label: '3D scene and models', ready: loading.sceneReady },
    { label: 'Comments', ready: loading.commentsReady },
  ]

  return (
    <div
      className="fixed inset-0 z-[160] grid place-items-center overflow-hidden bg-[#08100b] px-5 text-slate-100"
      role="status"
      aria-live="polite"
      aria-label={`Loading ${loading.ownerName}'s garden`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(127,176,105,.18),transparent_27%),linear-gradient(135deg,#071009_0%,#101a12_52%,#071009_100%)]" />
      <div className="soft-grid absolute inset-0 opacity-45" />
      <div className="relative w-full max-w-md rounded-2xl border border-lime-100/15 bg-[#101511]/96 px-6 py-7 shadow-[0_28px_90px_rgba(0,0,0,.55)]">
        <CircularLoader
          className="min-h-32"
          description={loading.error || 'Loading the owner location, current weather, models, and discussion before showing the garden.'}
          label={`Preparing ${loading.ownerName}'s garden`}
        />
        <div className="mt-5 grid gap-2 border-t border-lime-100/10 pt-4">
          {steps.map((step) => (
            <div className="flex items-center justify-between gap-4 text-xs" key={step.label}>
              <span className={step.ready ? 'text-lime-100' : 'text-slate-400'}>{step.label}</span>
              <span className={`rounded-full px-2 py-0.5 font-bold ${step.ready ? 'bg-[#9bcf82]/15 text-lime-100' : 'bg-white/[0.055] text-slate-400'}`}>
                {step.ready ? 'Ready' : 'Loading'}
              </span>
            </div>
          ))}
        </div>
        <button
          className="mt-5 h-9 w-full rounded-lg border border-lime-100/15 bg-white/[0.045] text-xs font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-lime-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
          type="button"
          onClick={onCancel}
        >
          Cancel and go back
        </button>
      </div>
    </div>
  )
}

function SessionLoadingScreen() {
  return (
    <main className="relative grid h-screen w-screen place-items-center overflow-hidden bg-[#0b0f0c] px-5 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(127,176,105,.16),transparent_25%),linear-gradient(135deg,#070a08_0%,#101511_54%,#080b09_100%)]" />
      <div className="soft-grid absolute inset-0 opacity-55" />
      <CircularLoader className="relative min-h-48 w-full max-w-sm" description="Preparing your Plant Growth Academy account..." label="Checking your session" />
    </main>
  )
}

function GamePageLoading({ label = 'Loading academy workspace' }) {
  return (
    <div className="absolute inset-x-0 bottom-0 top-16 z-20 grid place-items-center bg-[#0b0f0c]/92 px-5 backdrop-blur-sm">
      <CircularLoader
        className="min-h-48 w-full max-w-sm"
        description="Preparing this section without reloading the whole academy."
        label={label}
      />
    </div>
  )
}

function App() {
  const [windows, setWindows] = useState(defaultWindows)
  const [activeMobileLabPanel, setActiveMobileLabPanel] = useState('monitor')
  const [climate, setClimate] = useState(defaultClimate)
  const [openSections, setOpenSections] = useState({ Plants: true, Items: true })
  const [appliedAsset, setAppliedAsset] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [actionToasts, setActionToasts] = useState([])
  const actionToastTimersRef = useRef(new Map())
  const [activePage, setActivePage] = useState('home')
  const [demoMode, setDemoMode] = useState(false)
  const [demoPage, setDemoPage] = useState(null)
  const [helpCenterOpen, setHelpCenterOpen] = useState(false)
  const [settingsReturnPage, setSettingsReturnPage] = useState('lab')
  const [pendingPageAfterAuth, setPendingPageAfterAuth] = useState(null)
  const [visitingFriend, setVisitingFriend] = useState(null)
  const [plantKnowledgeAsset, setPlantKnowledgeAsset] = useState(null)
  const [pendingPlantKnowledge, setPendingPlantKnowledge] = useState(null)
  const [viewedPlantKnowledgeId, setViewedPlantKnowledgeId] = useState(null)
  const [labSceneReady, setLabSceneReady] = useState(false)
  const [friendGardenLoading, setFriendGardenLoading] = useState(initialFriendGardenLoading)
  const [growingMode, setGrowingMode] = useState(null)
  const [modeLoading, setModeLoading] = useState(false)
  const [saveHydrated, setSaveHydrated] = useState(() => !getToken())
  const [resetPending, setResetPending] = useState(false)
  const [selectedPlant, setSelectedPlant] = useState(null)
  const [pendingPlant, setPendingPlant] = useState(null)
  const [plantingBusy, setPlantingBusy] = useState(false)
  const [activeSimulators, setActiveSimulators] = useState([])
  const [plantCatalog, setPlantCatalog] = useState([])
  const [modelAssets, setModelAssets] = useState({})
  const [outdoorWeather, setOutdoorWeather] = useState(initialOutdoorWeather)
  const [outdoorLocationRefreshKey, setOutdoorLocationRefreshKey] = useState(0)
  const [simulationVisual, setSimulationVisual] = useState(defaultSimulationVisual)
  const [growthTrack, setGrowthTrack] = useState(initialGrowthTrack)
  const [nextSimulationTickAt, setNextSimulationTickAt] = useState(null)
  const [cycleStatus, setCycleStatus] = useState('idle')
  const [awaitingFirstCycle, setAwaitingFirstCycle] = useState(false)
  const latestSaveLoadedRef = useRef(false)
  const autosaveStateRef = useRef({})
  const canonicalSimulationRef = useRef(defaultSimulationVisual)
  const recentlyRemovedPestIdsRef = useRef(new Map())
  const isResettingRef = useRef(false)
  const isEndingSimulationRef = useRef(false)
  const simulationMutationQueueRef = useRef(Promise.resolve())
  const simulationMutationPendingRef = useRef(0)
  const ownGardenSnapshotRef = useRef(null)
  const spectatorRequestRef = useRef(0)
  const accountSessionRef = useRef(0)
  const stageSnapshotRef = useRef(null)
  const [saveCompleteHistory, setSaveCompleteHistory] = useState(null)
  const [saveReadyForNewPlant, setSaveReadyForNewPlant] = useState(false)
  const [user, setUser] = useState(null)
  const updateUserOnboardingProgress = useCallback((progress) => {
    setUser((current) => current ? { ...current, onboarding_progress: progress } : current)
  }, [])
  const [sessionStatus, setSessionStatus] = useState(() => getToken() ? 'checking' : 'guest')
  const [coinDelta, setCoinDelta] = useState(null)
  const [coinBurst, setCoinBurst] = useState(null)
  const [expBurst, setExpBurst] = useState(null)
  const rewardClaimingRef = useRef(null)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '', passwordConfirmation: '' })
  const [authStatus, setAuthStatus] = useState('idle')
  const [authError, setAuthError] = useState('')
  const [inventoryItems, setInventoryItems] = useState([])
  const [shopCatalog, setShopCatalog] = useState([])
  const [inventoryStatus, setInventoryStatus] = useState('loading')
  const [plantCatalogStatus, setPlantCatalogStatus] = useState('loading')
  const [shareBusy, setShareBusy] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationStatus, setNotificationStatus] = useState('idle')
  const [notificationError, setNotificationError] = useState('')
  const notificationRequestRef = useRef(0)
  const itemUseBusyRef = useRef(false)
  const prankBusyRef = useRef(false)
  const communityNotifications = useMemo(
    () => notifications.filter(isCommunityNotification),
    [notifications],
  )
  const communityUnreadNotificationCount = useMemo(
    () => communityNotifications.filter((notification) => !notification.is_read).length,
    [communityNotifications],
  )
  const allUnreadNotificationCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  )
  const activeSimulatorLatitude = simulationVisual?.latitude
  const activeSimulatorLongitude = simulationVisual?.longitude
  const activeSimulatorStatus = simulationVisual?.status
  const lockedOutdoorLocation = useMemo(() => {
    if (
      growingMode !== 'outdoor'
      || visitingFriend
      || !selectedPlant
      || activeSimulatorStatus !== 'active'
    ) {
      return null
    }

    const latitude = Number(activeSimulatorLatitude)
    const longitude = Number(activeSimulatorLongitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

    return { latitude, longitude, source: 'simulation' }
  }, [
    activeSimulatorLatitude,
    activeSimulatorLongitude,
    activeSimulatorStatus,
    growingMode,
    selectedPlant,
    visitingFriend,
  ])
  const lockedOutdoorLocationName = lockedOutdoorLocation
    ? simulationVisual?.location_name ?? ''
    : ''

  useEffect(() => {
    if (demoMode && demoPage && activePage !== demoPage) setActivePage(demoPage)
  }, [activePage, demoMode, demoPage])

  useEffect(() => {
    let frame = 0

    function reflowLabWindows() {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        setWindows((current) => reflowWindowsForViewport(current))
      })
    }

    window.addEventListener('resize', reflowLabWindows)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', reflowLabWindows)
    }
  }, [])

  const dismissActionToast = useCallback((toastId) => {
    const timer = actionToastTimersRef.current.get(toastId)
    if (timer) window.clearTimeout(timer)
    actionToastTimersRef.current.delete(toastId)
    setActionToasts((current) => current.filter((toast) => toast.id !== toastId))
  }, [])

  const setActionMessage = useCallback((message) => {
    const text = String(message ?? '').trim()
    if (!text) {
      actionToastTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      actionToastTimersRef.current.clear()
      setActionToasts([])
      return
    }

    const toastId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const toast = { id: toastId, message: text, type: getActionToastType(text) }
    setActionToasts((current) => [toast, ...current.filter((item) => item.message !== text)].slice(0, 5))

    const timer = window.setTimeout(() => {
      actionToastTimersRef.current.delete(toastId)
      setActionToasts((current) => current.filter((item) => item.id !== toastId))
    }, 4200)
    actionToastTimersRef.current.set(toastId, timer)
  }, [])

  const refreshNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!getToken()) return

    const requestId = notificationRequestRef.current + 1
    notificationRequestRef.current = requestId
    if (!silent) setNotificationStatus((current) => current === 'ready' ? current : 'loading')

    try {
      const payload = await getNotifications()
      if (notificationRequestRef.current !== requestId || !getToken()) return
      setNotifications(payload.data ?? [])
      setNotificationError('')
      setNotificationStatus('ready')
    } catch (error) {
      if (notificationRequestRef.current !== requestId) return
      setNotificationError(error.message || 'Unable to load notifications.')
      setNotificationStatus((current) => current === 'ready' ? current : 'error')
    }
  }, [])

  const readNotification = useCallback(async (notification) => {
    if (!notification?.id || notification.is_read) return

    const readAt = new Date().toISOString()
    setNotifications((current) => current.map((item) => (
      String(item.id) === String(notification.id)
        ? { ...item, is_read: true, read_at: readAt }
        : item
    )))

    try {
      await markNotificationRead(notification.id)
    } catch {
      refreshNotifications({ silent: true })
    }
  }, [refreshNotifications])

  const enqueueSimulationMutation = useCallback((operation, options = {}) => {
    if (options.skipIfBusy && simulationMutationPendingRef.current > 0) {
      return Promise.resolve(null)
    }

    simulationMutationPendingRef.current += 1
    const queued = simulationMutationQueueRef.current
      .catch(() => null)
      .then(operation)

    simulationMutationQueueRef.current = queued.catch(() => null)

    return queued.finally(() => {
      simulationMutationPendingRef.current = Math.max(0, simulationMutationPendingRef.current - 1)
    })
  }, [])

  const rememberActiveSimulator = useCallback((simulator) => {
    if (!simulator?.id || !simulator?.plant_id) return

    setActiveSimulators((current) => {
      const remaining = current.filter((entry) => (
        String(entry.id) !== String(simulator.id)
        && Number(entry.plant_id) !== Number(simulator.plant_id)
      ))

      return simulator.status === 'active' ? [simulator, ...remaining] : remaining
    })
  }, [])

  const forgetActiveSimulator = useCallback((simulatorId) => {
    if (!simulatorId) return
    setActiveSimulators((current) => current.filter((entry) => String(entry.id) !== String(simulatorId)))
  }, [])

  const mergeCanonicalSimulator = useCallback((simulator, options = {}) => {
    if (!simulator) return null

    const now = Date.now()
    recentlyRemovedPestIdsRef.current.forEach((expiresAt, pestId) => {
      if (expiresAt <= now) recentlyRemovedPestIdsRef.current.delete(pestId)
    })
    const suppressedPestIds = recentlyRemovedPestIdsRef.current
    const next = mergeSimulatorState(canonicalSimulationRef.current, simulator, options)
    next.active_pests = (next.active_pests ?? [])
      .filter((entry) => !suppressedPestIds.has(String(entry?.id)))

    canonicalSimulationRef.current = next
    setSimulationVisual(next)
    rememberActiveSimulator(next)
    return next
  }, [rememberActiveSimulator])

  const stashOwnGardenSimulator = useCallback((simulator, options = {}) => {
    const snapshot = ownGardenSnapshotRef.current
    if (!simulator || !snapshot) return null

    const next = mergeSimulatorState(snapshot.simulationVisual, simulator, options)
    const progress = clampSimulationProgress(next.growth_point)
    ownGardenSnapshotRef.current = {
      ...snapshot,
      simulationVisual: next,
      growthTrack: {
        progress,
        history: [...(snapshot.growthTrack?.history ?? initialGrowthTrack.history), progress].slice(-7),
      },
    }
    return next
  }, [])

  useEffect(() => {
    if (!getToken()) return undefined

    let isCancelled = false

    async function syncUser() {
      try {
        const payload = await getMe()
        const syncedUser = payload.data ?? payload.user ?? payload
        if (!syncedUser?.id) throw new Error('The session did not return an account.')
        if (!isCancelled) {
          setUser(syncedUser)
          setSessionStatus('authenticated')
          if (syncedUser.role === 'admin') setActivePage('admin')
        }
      } catch {
        clearToken()
        if (!isCancelled) {
          setUser(null)
          setNotifications([])
          setNotificationStatus('idle')
          setNotificationError('')
          setSaveHydrated(true)
          setSessionStatus('guest')
          setActivePage('auth')
        }
      }
    }

    syncUser()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user || !getToken() || user.role === 'admin') return undefined

    const initialRefresh = window.setTimeout(() => refreshNotifications(), 0)

    const refreshWhenVisible = () => {
      if (!document.hidden) refreshNotifications({ silent: true })
    }
    const interval = window.setInterval(refreshWhenVisible, 30_000)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      window.clearTimeout(initialRefresh)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refreshNotifications, user])

  useEffect(() => () => {
    actionToastTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    actionToastTimersRef.current.clear()
  }, [])

  useEffect(() => {
    if (growingMode !== 'outdoor' || visitingFriend) return undefined

    if (demoMode) {
      const previewWeather = createDemoOutdoorWeather()
      setClimate((current) => climateFromForecast(current, previewWeather.forecast))
      setOutdoorWeather(previewWeather)
      return undefined
    }

    let isCancelled = false

    async function syncOutdoorWeather({ silent = false } = {}) {
      if (!silent) {
        setOutdoorWeather({
          ...initialOutdoorWeather,
          status: 'loading',
          message: lockedOutdoorLocation ? 'Loading weather for the planted location' : 'Finding current location',
          location: lockedOutdoorLocation,
          addressLabel: lockedOutdoorLocationName,
        })
      }

      try {
        const location = lockedOutdoorLocation ?? await getFixedOutdoorLocation()
        if (isCancelled) return

        const addressRequest = lockedOutdoorLocation && lockedOutdoorLocationName
          ? Promise.resolve(lockedOutdoorLocationName)
          : fetchLocationAddress(location)
        const [addressLabel, forecast] = await Promise.all([addressRequest, fetchOutdoorForecast(location)])
        if (isCancelled) return

        setClimate((current) => climateFromForecast(current, forecast))
        setOutdoorWeather({
          status: 'ready',
          message: lockedOutdoorLocation
            ? 'Weather synced to the planted location'
            : location.source === 'fallback'
              ? 'using fallback location'
              : 'synced from current location',
          location,
          addressLabel,
          forecast,
        })
      } catch {
        if (!isCancelled && !silent) {
          setOutdoorWeather({
            ...initialOutdoorWeather,
            status: 'error',
            message: 'weather unavailable',
          })
        }
      }
    }

    syncOutdoorWeather()
    const weatherRefreshTimer = window.setInterval(
      () => syncOutdoorWeather({ silent: true }),
      10 * 60 * 1000,
    )

    return () => {
      isCancelled = true
      window.clearInterval(weatherRefreshTimer)
    }
  }, [demoMode, growingMode, lockedOutdoorLocation, lockedOutdoorLocationName, outdoorLocationRefreshKey, visitingFriend])

  useEffect(() => {
    if (!growingMode) return undefined

    let isCancelled = false

    async function syncModelAssets() {
      try {
        const payload = await getModelAssets()
        const assets = payload.data ?? payload
        if (!isCancelled) {
          setModelAssets(Object.fromEntries(assets.map((asset) => [asset.asset_key, asset])))
        }
      } catch {
        if (!isCancelled) setModelAssets({})
      }
    }

    syncModelAssets()

    return () => {
      isCancelled = true
    }
  }, [growingMode])

  useEffect(() => {
    if (activePage === 'admin' || !growingMode || !selectedPlant || modeLoading) return undefined

    const targetProgress = clampSimulationProgress(simulationVisual.growth_point)
    const animationDurationMs = growthAnimationDurationForRate(simulationVisual.growth_rate)
    const animationStartedAt = performance.now()
    let startingProgress = null
    let interval = null

    function animateCanonicalGrowth() {
      const now = performance.now()
      const ratio = animationDurationMs <= 0
        ? 1
        : Math.min(1, Math.max(0, (now - animationStartedAt) / animationDurationMs))
      const easedRatio = 1 - ((1 - ratio) ** 3)

      setGrowthTrack((current) => {
        if (startingProgress === null) startingProgress = current.progress

        const nextProgress = clampSimulationProgress(startingProgress + ((targetProgress - startingProgress) * easedRatio))
        const roundedProgress = ratio >= 1 ? targetProgress : Number(nextProgress.toFixed(2))
        const shouldRecordHistory = ratio >= 1
        const nextHistory = shouldRecordHistory ? [...current.history, roundedProgress].slice(-7) : current.history

        if (roundedProgress === current.progress && nextHistory === current.history) return current
        return { progress: roundedProgress, history: nextHistory }
      })

      if (ratio >= 1 && interval !== null) {
        window.clearInterval(interval)
        interval = null
      }
    }

    animateCanonicalGrowth()
    interval = window.setInterval(animateCanonicalGrowth, 50)

    return () => {
      if (interval !== null) window.clearInterval(interval)
    }
  }, [activePage, growingMode, modeLoading, selectedPlant, simulationVisual.growth_point, simulationVisual.growth_rate])

  const previewSimulationVisual = useMemo(() => {
    if (!growingMode || !selectedPlant) {
      return {
        ...defaultSimulationVisual,
        growth_history: growthTrack.history,
        growth_rate: 0,
        current_stage: { stage_no: 0, stage_name: 'No plant', required_growth_point: 0 },
        active_pests: [],
      }
    }

    const progress = clampSimulationProgress(growthTrack.progress)

    return {
      ...simulationVisual,
      growth_point: progress,
      growth_history: growthTrack.history,
      growth_rate: Number(simulationVisual.growth_rate ?? 0),
      current_stage: simulationVisual.current_stage ?? defaultSimulationVisual.current_stage,
      visual_state: simulationVisual.visual_state ?? defaultSimulationVisual.visual_state,
      visual_overrides: simulationVisual.visual_overrides ?? defaultSimulationVisual.visual_overrides,
      pest_risks: simulationVisual.pest_risks ?? defaultSimulationVisual.pest_risks,
      active_pests: simulationVisual.active_pests ?? [],
      current_model_url: simulationVisual.current_model_url ?? defaultSimulationVisual.current_model_url,
    }
  }, [growingMode, growthTrack, selectedPlant, simulationVisual])
  useEffect(() => {
    canonicalSimulationRef.current = simulationVisual
    autosaveStateRef.current = {
      climate,
      growingMode,
      growthTrack,
      outdoorWeather,
      simulationVisual,
      selectedPlant,
      visitingFriend,
    }
  }, [climate, growingMode, growthTrack, outdoorWeather, selectedPlant, simulationVisual, visitingFriend])
  const inventoryMap = useMemo(() => {
    return inventoryItems.reduce((map, entry) => {
      const key = inventoryItemKey(entry)
      if (key) map[key] = Number(entry.quantity ?? 0)
      return map
    }, {})
  }, [inventoryItems])

  const labSections = useMemo(() => {
    const currentPlantId = Number(selectedPlant?.backendId ?? simulationVisual?.plant?.id ?? 0)
    const plantedSimulators = visitingFriend
      ? (visitingFriend.planted_simulators ?? [])
      : activeSimulators
    const plantedPlantIds = new Set(plantedSimulators.map((simulator) => Number(simulator.plant_id)))
    if (simulationVisual?.status === 'active' && currentPlantId) plantedPlantIds.add(currentPlantId)
    const plants = plantCatalog.map((plant) => ({
      ...plantAssetFromApi(plant, plantedPlantIds.has(Number(plant.id))),
      current: currentPlantId === Number(plant.id),
    }))
    const inventoryItemsByKey = new Map(inventoryItems.map((entry) => [inventoryItemKey(entry), entry]))
    const itemSource = [
      ...shopCatalog.map((shopItem) => shopItem.item).filter(Boolean),
      ...inventoryItems.map((entry) => entry.item).filter(Boolean),
    ]
    const uniqueItems = Array.from(new Map(itemSource.map((item) => [inventoryItemKey(item), item])).values())
    const items = uniqueItems
      .map((item) => {
        const key = inventoryItemKey(item)
        const inventoryEntry = inventoryItemsByKey.get(key)
        return itemAssetFromApi(item, inventoryEntry?.quantity ?? 0)
      })
      .filter((item) => !visitingFriend || item.friendUsable)

    return {
      Plants: plants,
      Items: items,
    }
  }, [activeSimulators, inventoryItems, plantCatalog, selectedPlant, shopCatalog, simulationVisual?.plant?.id, simulationVisual?.status, visitingFriend])

  function upsertInventoryItem(entry) {
    if (!entry?.item_id && !entry?.item?.id) return

    const itemId = entry.item_id ?? entry.item?.id
    setInventoryItems((current) => {
      const next = current.filter((item) => (item.item_id ?? item.item?.id) !== itemId)
      return [...next, entry]
    })
  }

  useEffect(() => {
    let cancelled = false

    if (user?.role === 'admin' || !user || !getToken()) {
      return undefined
    }

    getInventory()
      .then((payload) => {
        if (!cancelled) {
          setInventoryItems(payload.data ?? [])
          setInventoryStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInventoryItems([])
          setInventoryStatus('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    let cancelled = false

    getShopItems()
      .then((payload) => {
        if (!cancelled) setShopCatalog(payload.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setShopCatalog([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (activePage !== 'lab' || !user || !getToken()) {
      return undefined
    }

    let cancelled = false

    async function syncPlantCatalog() {
      try {
        const payload = await getPlants()
        if (!cancelled) {
          setPlantCatalog(payload.data ?? payload)
          setPlantCatalogStatus('ready')
        }
      } catch {
        // Keep the last usable catalog during a brief backend or network outage.
        if (!cancelled) setPlantCatalogStatus((current) => current === 'ready' ? current : 'error')
      }
    }

    syncPlantCatalog()
    const timer = window.setInterval(syncPlantCatalog, 15000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activePage, user])

  useEffect(() => {
    function handleExpiredSession() {
      const simulatorId = window.localStorage.getItem('plant_game_simulator_id')
      accountSessionRef.current += 1
      spectatorRequestRef.current += 1
      latestSaveLoadedRef.current = false
      autosaveStateRef.current = {}
      if (simulatorId) window.localStorage.removeItem(`${simulationTickMarkerPrefix}${simulatorId}`)
      window.localStorage.removeItem('plant_game_simulator_id')
      window.localStorage.removeItem(resetMarkerKey)
      setActiveSimulators([])
      setPendingPlant(null)
      setPlantingBusy(false)
      setUser(null)
      setNotifications([])
      setNotificationStatus('idle')
      setNotificationError('')
      setProfileOpen(false)
      setSessionStatus('guest')
      setActivePage('auth')
      setAuthMode('login')
      setAuthStatus('idle')
      setAuthError('Your session expired. Please sign in again.')
    }

    window.addEventListener('plant-game:session-expired', handleExpiredSession)
    return () => window.removeEventListener('plant-game:session-expired', handleExpiredSession)
  }, [])

  const selectedItemCursorUrl = appliedAsset?.type === 'item'
    && (!visitingFriend || appliedAsset.friendUsable)
    ? appliedAsset.imageUrl
    : null
  const applySimulatorSnapshot = useCallback((simulator, options = {}) => {
    if (!simulator) return

    const restoredProgress = clampSimulationProgress(simulator.growth_point ?? 0)
    const restoredMode = simulator.mode ?? 'greenhouse'
    const restoredPlant = simulator.plant ? plantAssetFromApi(simulator.plant, true) : null

    if (options.persistLocalId !== false) {
      window.localStorage.setItem('plant_game_simulator_id', String(simulator.id))
    }
    setResetPending(false)
    setAwaitingFirstCycle(false)
    setCycleStatus('idle')
    setNextSimulationTickAt(null)
    setGrowingMode(restoredMode)
    if (Object.prototype.hasOwnProperty.call(options, 'outdoorWeather')) {
      setOutdoorWeather(options.outdoorWeather ?? initialOutdoorWeather)
    } else if (restoredMode === 'outdoor') {
      const plantedLocation = locationFromSimulator(simulator)
      setOutdoorWeather(plantedLocation
        ? {
            ...initialOutdoorWeather,
            status: 'loading',
            message: 'Loading weather for the planted location',
            location: plantedLocation,
            addressLabel: simulator.location_name ?? 'Planted outdoor location',
          }
        : initialOutdoorWeather)
    } else {
      setOutdoorWeather(initialOutdoorWeather)
    }
    if (restoredMode === 'outdoor') {
      setWindows((value) => ({
        ...value,
        climate: {
          ...value.climate,
          ...outdoorClimateWindow(value),
        },
      }))
    }
    setModeLoading(false)
    if (!options.preserveAppliedAsset) setAppliedAsset(restoredPlant)
    if (simulator.plant) {
      setPlantCatalog((current) => current.some((plant) => plant.id === simulator.plant.id) ? current : [simulator.plant, ...current])
    }
    setSelectedPlant(options.selectPlant === false ? null : restoredPlant)
    setClimate({
      water: Number(simulator.water ?? defaultClimate.water),
      light: Number(simulator.light ?? defaultClimate.light),
      fertilizer: Number(simulator.fertilizer ?? defaultClimate.fertilizer),
      soil: Number(simulator.soil_humidity ?? defaultClimate.soil),
      air: Number(simulator.air_humidity ?? defaultClimate.air),
      soilTemp: Number(simulator.soil_temp ?? defaultClimate.soilTemp),
      temp: Number(simulator.air_temp ?? defaultClimate.temp),
    })
    setGrowthTrack({
      progress: restoredProgress,
      history: [restoredProgress],
    })
    const nextSimulation = {
      ...defaultSimulationVisual,
      ...simulator,
      growth_point: restoredProgress,
      growth_rate: Number(simulator.growth_rate ?? 0),
      active_pests: simulator.active_pests ?? [],
      current_model_url: simulator.current_model_url ?? defaultSimulationVisual.current_model_url,
    }
    canonicalSimulationRef.current = nextSimulation
    setSimulationVisual(nextSimulation)
  }, [])

  const handleFriendSceneReady = useCallback(({ error = false, loadKey, simulatorId }) => {
    setFriendGardenLoading((current) => {
      if (!current.active || current.loadKey !== loadKey || !current.dataReady) return current

      const expectedSimulatorId = current.simulatorId == null ? null : String(current.simulatorId)
      const readySimulatorId = simulatorId == null ? null : String(simulatorId)
      if (expectedSimulatorId !== readySimulatorId) return current

      return {
        ...current,
        error: current.error || (error ? 'The garden loaded, but one 3D asset could not be displayed.' : ''),
        sceneReady: true,
      }
    })
  }, [])

  const handleStageSceneReady = useCallback((payload = {}) => {
    if (String(payload.loadKey ?? '').startsWith('lab:')) {
      setLabSceneReady(true)
      return
    }

    handleFriendSceneReady(payload)
  }, [handleFriendSceneReady])

  const handleFriendCommentsLoadState = useCallback(({ ready, simulatorId }) => {
    setFriendGardenLoading((current) => {
      if (!current.active || !current.dataReady) return current

      const expectedSimulatorId = current.simulatorId == null ? null : String(current.simulatorId)
      const commentSimulatorId = simulatorId == null ? null : String(simulatorId)
      if (expectedSimulatorId !== commentSimulatorId) return current

      return {
        ...current,
        commentsReady: Boolean(ready),
      }
    })
  }, [])

  useEffect(() => {
    if (
      !friendGardenLoading.active
      || !friendGardenLoading.dataReady
      || !friendGardenLoading.sceneReady
      || !friendGardenLoading.commentsReady
      || inventoryStatus === 'loading'
      || plantCatalogStatus === 'loading'
    ) {
      return undefined
    }

    const revealTimer = window.setTimeout(() => {
      setFriendGardenLoading((current) => (
        current.loadKey === friendGardenLoading.loadKey
          ? { ...current, active: false }
          : current
      ))
    }, 220)

    return () => window.clearTimeout(revealTimer)
  }, [
    friendGardenLoading.active,
    friendGardenLoading.commentsReady,
    friendGardenLoading.dataReady,
    friendGardenLoading.loadKey,
    friendGardenLoading.sceneReady,
    inventoryStatus,
    plantCatalogStatus,
  ])

  const buildSaveSnapshot = useCallback(() => {
    const state = autosaveStateRef.current
    const factors = buildSimulationFactors(state.climate ?? defaultClimate, state.outdoorWeather ?? initialOutdoorWeather, state.growingMode)
    const visual = canonicalSimulationRef.current ?? state.simulationVisual ?? defaultSimulationVisual

    return {
      ...factors,
      growth_point: clampSimulationProgress(visual.growth_point),
      health: Math.round(Number(visual.health ?? 100)),
      visual_state: visual.visual_state ?? 'healthy',
      visual_overrides: visual.visual_overrides ?? {},
      analysis_result: visual.analysis_result ?? 'Current simulation state saved.',
      direction: visual.direction ?? 'Continue from the latest saved state.',
    }
  }, [])

  const persistCurrentSimulation = useCallback(async (options = {}) => {
    const simulatorId = window.localStorage.getItem('plant_game_simulator_id')
    const accountSession = accountSessionRef.current

    if (!simulatorId) {
      return null
    }

    return enqueueSimulationMutation(async () => {
      const state = autosaveStateRef.current
      const currentSimulatorId = window.localStorage.getItem('plant_game_simulator_id')

      if (
        accountSession !== accountSessionRef.current
        || currentSimulatorId !== String(simulatorId)
        || state.visitingFriend
        || isResettingRef.current
        || (isEndingSimulationRef.current && !options.allowEnding)
        || window.localStorage.getItem(resetMarkerKey)
        || !getToken()
        || !state.selectedPlant
        || !state.growingMode
      ) {
        return null
      }

      const payload = await syncSimulatorSnapshot(simulatorId, buildSaveSnapshot(), { keepalive: options.keepalive })
      const simulator = payload.data ?? payload
      if (
        accountSession !== accountSessionRef.current
        || window.localStorage.getItem('plant_game_simulator_id') !== String(simulatorId)
        || !getToken()
      ) {
        return null
      }

      if (autosaveStateRef.current.visitingFriend) {
        stashOwnGardenSimulator(simulator, { preservePestRisks: true })
        return simulator
      }

      if (simulator) mergeCanonicalSimulator(simulator, { preservePestRisks: true })

      return simulator
    }, { skipIfBusy: Boolean(options.background) })
  }, [buildSaveSnapshot, enqueueSimulationMutation, mergeCanonicalSimulator, stashOwnGardenSimulator])

  const runSimulationTick = useCallback(async () => {
    const simulatorId = window.localStorage.getItem('plant_game_simulator_id')
    const accountSession = accountSessionRef.current
    if (!simulatorId) return null

    return enqueueSimulationMutation(async () => {
      const state = autosaveStateRef.current
      const canonical = canonicalSimulationRef.current

      if (
        accountSession !== accountSessionRef.current
        || window.localStorage.getItem('plant_game_simulator_id') !== String(simulatorId)
        || state.visitingFriend
        || isResettingRef.current
        || isEndingSimulationRef.current
        || window.localStorage.getItem(resetMarkerKey)
        || !getToken()
        || !state.selectedPlant
        || !state.growingMode
        || (canonical?.status && canonical.status !== 'active')
      ) {
        return null
      }

      const factors = buildSimulationFactors(state.climate ?? defaultClimate, state.outdoorWeather ?? initialOutdoorWeather, state.growingMode)
      const payload = await tickSimulator(simulatorId, factors)
      const simulator = payload.data ?? payload

      if (
        accountSession !== accountSessionRef.current
        || window.localStorage.getItem('plant_game_simulator_id') !== String(simulatorId)
        || isResettingRef.current
        || isEndingSimulationRef.current
        || !getToken()
      ) {
        return null
      }

      if (simulator) {
        if (autosaveStateRef.current.visitingFriend) {
          stashOwnGardenSimulator(simulator, { fromTick: true })
        } else {
          mergeCanonicalSimulator(simulator, { fromTick: true })
        }
        window.localStorage.setItem(`${simulationTickMarkerPrefix}${simulatorId}`, String(Date.now()))
      }

      return simulator
    })
  }, [enqueueSimulationMutation, mergeCanonicalSimulator, stashOwnGardenSimulator])

  useEffect(() => {
    const simulatorId = previewSimulationVisual?.id ?? window.localStorage.getItem('plant_game_simulator_id')
    const isFullyGrown = selectedPlant && Number(previewSimulationVisual?.growth_point ?? 0) >= 100
    const rewardAlreadyClaimed = Boolean(previewSimulationVisual?.maturity_reward_claimed_at)

    if (!user || visitingFriend || !simulatorId || !isFullyGrown || rewardAlreadyClaimed || rewardClaimingRef.current === simulatorId) {
      return undefined
    }

    let isCancelled = false
    rewardClaimingRef.current = simulatorId

    async function claimReward() {
      try {
        const savedSimulator = await persistCurrentSimulation({ silent: true })
        const savedGrowth = Number(savedSimulator?.growth_point ?? previewSimulationVisual?.growth_point ?? 0)
        const savedAlreadyClaimed = Boolean(savedSimulator?.maturity_reward_claimed_at ?? previewSimulationVisual?.maturity_reward_claimed_at)

        if (isCancelled || savedGrowth < 100 || savedAlreadyClaimed) return

        const accountSession = accountSessionRef.current
        const payload = await enqueueSimulationMutation(() => {
          if (
            accountSession !== accountSessionRef.current
            || window.localStorage.getItem('plant_game_simulator_id') !== String(simulatorId)
            || autosaveStateRef.current.visitingFriend
            || isResettingRef.current
            || isEndingSimulationRef.current
            || !getToken()
          ) {
            return null
          }
          return claimMaturityReward(simulatorId)
        })
        if (!payload || accountSession !== accountSessionRef.current || isResettingRef.current || isEndingSimulationRef.current) return

        const reward = payload.data ?? payload
        const amount = Number(reward.amount ?? 0)

        if (autosaveStateRef.current.visitingFriend) {
          if (reward.simulator) stashOwnGardenSimulator(reward.simulator, { preservePestRisks: true })
          if (reward.user) {
            setUser((current) => current ? { ...current, ...reward.user } : reward.user)
          } else if (typeof reward.balance === 'number') {
            setUser((current) => current ? { ...current, coin: reward.balance } : current)
          }
          return
        }

        if (reward.simulator) {
          mergeCanonicalSimulator(reward.simulator, { preservePestRisks: true })
        }

        if (reward.user) {
          setUser((current) => current ? { ...current, ...reward.user } : reward.user)
        } else if (typeof reward.balance === 'number') {
          setUser((current) => current ? { ...current, coin: reward.balance } : current)
        }

        if (!isCancelled && reward.awarded && amount > 0) {
          const expAmount = Number(reward.experience_amount ?? 0)
          const leveledUp = Boolean(reward.experience_reward?.leveled_up)
          const burstId = Date.now()
          const offsetX = `${Math.round(Math.random() * 72 - 36)}px`
          const offsetY = `${Math.round(Math.random() * 36 - 18)}px`
          const expOffsetX = `${Math.round(Math.random() * 84 - 42)}px`
          const expOffsetY = `${Math.round(Math.random() * 36 + 18)}px`

          setCoinDelta(amount)
          setCoinBurst({ id: burstId, amount, offsetX, offsetY })
          if (expAmount > 0) {
            setExpBurst({ id: burstId, amount: expAmount, leveledUp, offsetX: expOffsetX, offsetY: expOffsetY })
          }
          setActionMessage(`Maturity reward +${amount} coin${expAmount > 0 ? `, +${expAmount} EXP` : ''}${leveledUp ? ' - Level up!' : ''}`)

          window.setTimeout(() => {
            setCoinBurst((current) => current?.id === burstId ? null : current)
            setExpBurst((current) => current?.id === burstId ? null : current)
          }, 2000)
          window.setTimeout(() => setCoinDelta(null), 1500)
        }
      } catch (error) {
        console.warn('Unable to claim maturity reward', error)
      } finally {
        if (rewardClaimingRef.current === simulatorId) {
          rewardClaimingRef.current = null
        }
      }
    }

    claimReward()

    return () => {
      isCancelled = true
    }
  }, [enqueueSimulationMutation, mergeCanonicalSimulator, persistCurrentSimulation, previewSimulationVisual?.growth_point, previewSimulationVisual?.id, previewSimulationVisual?.maturity_reward_claimed_at, selectedPlant, setActionMessage, stashOwnGardenSimulator, user, visitingFriend])
  useEffect(() => {
    if (!user || latestSaveLoadedRef.current) return undefined

    let isCancelled = false
    let retryTimeout = null
    latestSaveLoadedRef.current = true

    async function restoreLatestSave() {
      try {
        const payload = await getSimulators({ status: 'active' })
        const simulators = uniqueActiveSimulatorsByPlant(payload.data ?? [])
        const storedSimulatorId = window.localStorage.getItem('plant_game_simulator_id')
        const resetSimulatorId = window.localStorage.getItem(resetMarkerKey)
        const simulator = simulators.find((entry) => String(entry.id) === String(storedSimulatorId)) ?? simulators[0] ?? null
        const resetMarked = Boolean(resetSimulatorId)

        if (!isCancelled) setActiveSimulators(simulators)

        if (!isCancelled && resetMarked) {
          try {
            const resetTarget = simulators.find((entry) => String(entry.id) === String(resetSimulatorId))
            if (resetTarget?.id) {
              await uprootSimulator(resetTarget.id)
            }
            if (isCancelled) return

            const remainingSimulators = simulators.filter((entry) => String(entry.id) !== String(resetTarget?.id))
            if (resetTarget?.id) window.localStorage.removeItem(`${simulationTickMarkerPrefix}${resetTarget.id}`)
            window.localStorage.removeItem(resetMarkerKey)
            window.localStorage.removeItem('plant_game_simulator_id')
            setActiveSimulators(remainingSimulators)

            if (remainingSimulators[0]) {
              applySimulatorSnapshot(remainingSimulators[0])
              setActionMessage(`${remainingSimulators[0].plant?.name_en ?? remainingSimulators[0].plant?.name_th ?? 'Another plant'} restored`)
            } else {
              setGrowingMode(null)
              setSelectedPlant(null)
              canonicalSimulationRef.current = defaultSimulationVisual
              setSimulationVisual(defaultSimulationVisual)
              setGrowthTrack(initialGrowthTrack)
              setAwaitingFirstCycle(false)
              setCycleStatus('idle')
              setNextSimulationTickAt(null)
              setActionMessage('Reset complete. Choose a growing mode.')
            }
            setSaveHydrated(true)
          } catch (error) {
            if (isCancelled || !getToken()) return

            if (simulator) applySimulatorSnapshot(simulator)
            setActionMessage(error.message || 'Reset is still pending. Try Reset again.')
            setSaveHydrated(true)
          }
          return
        }

        if (!isCancelled && simulator) {
          applySimulatorSnapshot(simulator)
          setActionMessage(simulators.length > 1 ? `${simulators.length} planted species restored` : 'Latest simulation restored')
        }
        if (!isCancelled) setSaveHydrated(true)
      } catch {
        latestSaveLoadedRef.current = false
        if (!isCancelled && window.localStorage.getItem(resetMarkerKey) && getToken()) {
          setSaveHydrated(false)
          setActionMessage('Confirming the pending reset with the server...')
          retryTimeout = window.setTimeout(() => {
            if (isCancelled) return
            latestSaveLoadedRef.current = true
            restoreLatestSave()
          }, 3000)
        } else if (!isCancelled) {
          setSaveHydrated(true)
        }
      }
    }

    restoreLatestSave()

    return () => {
      isCancelled = true
      if (retryTimeout !== null) window.clearTimeout(retryTimeout)
    }
  }, [applySimulatorSnapshot, setActionMessage, user])

  useEffect(() => {
    const simulatorId = simulationVisual?.id ?? window.localStorage.getItem('plant_game_simulator_id')
    if (activePage === 'admin' || !simulatorId || !selectedPlant || !growingMode || visitingFriend || !getToken() || simulationVisual?.status !== 'active') {
      return undefined
    }

    const markerKey = `${simulationTickMarkerPrefix}${simulatorId}`
    const storedTickAt = Number(window.localStorage.getItem(markerKey))
    const hasStoredTick = Number.isFinite(storedTickAt) && storedTickAt > 0

    let cancelled = false
    let timer = null
    let statusTimer = null

    async function tickCycle() {
      if (cancelled) return

      if (document.hidden) {
        const nextTickAt = Date.now() + simulationTickIntervalMs
        setCycleStatus('waiting')
        setNextSimulationTickAt(nextTickAt)
        timer = window.setTimeout(tickCycle, simulationTickIntervalMs)
        return
      }

      setCycleStatus('updating')
      setNextSimulationTickAt(null)
      try {
        const simulator = await runSimulationTick()
        if (!cancelled && simulator) setAwaitingFirstCycle(false)
      } catch (error) {
        if (!cancelled && error?.status !== 401) {
          console.warn('Unable to advance the simulation cycle', error)
        }
      } finally {
        if (!cancelled) {
          const nextTickAt = Date.now() + simulationTickIntervalMs
          setCycleStatus('waiting')
          setNextSimulationTickAt(nextTickAt)
          timer = window.setTimeout(tickCycle, simulationTickIntervalMs)
        }
      }
    }

    const elapsed = hasStoredTick ? Math.max(0, Date.now() - storedTickAt) : 0
    const initialDelay = hasStoredTick
      ? Math.max(1000, simulationTickIntervalMs - elapsed)
      : initialSimulationTickDelayMs
    statusTimer = window.setTimeout(() => {
      if (!cancelled) {
        setCycleStatus('waiting')
        setNextSimulationTickAt(Date.now() + initialDelay)
      }
    }, 0)
    timer = window.setTimeout(tickCycle, initialDelay)

    return () => {
      cancelled = true
      if (statusTimer !== null) window.clearTimeout(statusTimer)
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [activePage, growingMode, runSimulationTick, selectedPlant, simulationVisual?.id, simulationVisual?.status, visitingFriend])

  useEffect(() => {
    if (activePage !== 'lab' || !selectedPlant || !growingMode || !getToken()) return undefined

    const interval = window.setInterval(() => {
      if (document.hidden) return
      persistCurrentSimulation({ silent: true, background: true }).catch(() => {})
    }, autosaveIntervalMs)

    return () => window.clearInterval(interval)
  }, [activePage, growingMode, persistCurrentSimulation, selectedPlant])

  useEffect(() => {
    function saveBeforeLeaving() {
      persistCurrentSimulation({ silent: true, background: true, keepalive: true }).catch(() => {})
    }

    window.addEventListener('pagehide', saveBeforeLeaving)
    window.addEventListener('beforeunload', saveBeforeLeaving)

    return () => {
      window.removeEventListener('pagehide', saveBeforeLeaving)
      window.removeEventListener('beforeunload', saveBeforeLeaving)
    }
  }, [persistCurrentSimulation])
  function openWindow(id) {
    const isCompactLab = window.matchMedia('(max-width: 767px)').matches
    if (isCompactLab) setActiveMobileLabPanel(id)

    setWindows((value) => {
      if (isCompactLab) {
        return Object.fromEntries(Object.entries(value).map(([panelId, panel]) => [
          panelId,
          {
            ...panel,
            visible: panelId === id ? true : panel.visible,
            collapsed: panelId !== id,
          },
        ]))
      }

      const fallback = panelExpandedPosition(id)
      const expandedX = Number(value[id].expandedX ?? fallback.x)
      const expandedY = Number(value[id].expandedY ?? fallback.y)

      return {
        ...value,
        [id]: {
          ...value[id],
          x: expandedX,
          y: expandedY,
          expandedX,
          expandedY,
          visible: true,
          collapsed: false,
          responsiveCollapsed: false,
        },
      }
    })
  }

  function toggleLibrarySection(section) {
    setOpenSections((value) => ({ ...value, [section]: !value[section] }))
  }

  async function prankFriendPlant(asset) {
    const simulatorId = visitingFriend?.simulatorId ?? simulationVisual?.id

    if (!asset?.friendUsable) {
      setActionMessage('Choose an aphid or snail prank item for a friend garden')
      return
    }
    if (!simulatorId || !selectedPlant) {
      setActionMessage(`${visitingFriend?.user?.username ?? 'This friend'} has not planted this plant yet`)
      return
    }
    if (prankBusyRef.current) return

    const targetName = visitingFriend?.user?.username ?? 'your friend'
    const plantName = selectedPlant?.name ?? 'plant'
    const confirmation = await Swal.fire({
      title: `Use ${asset.name}?`,
      text: `Send this prank to ${targetName}'s ${plantName}? One item will be used.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Send prank',
      cancelButtonText: 'Cancel',
      background: '#101511',
      color: '#eaf7df',
      buttonsStyling: false,
      reverseButtons: true,
      customClass: {
        popup: 'plantsim-shop-alert',
        title: 'plantsim-shop-alert__title',
        actions: 'plantsim-shop-alert__actions',
        confirmButton: 'plantsim-shop-alert__confirm',
        cancelButton: 'plantsim-shop-alert__cancel',
      },
    })
    if (!confirmation.isConfirmed) return

    prankBusyRef.current = true
    setActionMessage(`Sending ${asset.name} to ${targetName}...`)

    try {
      const payload = await prankFriendSimulator(simulatorId, asset.itemKey ?? asset.id)
      const result = payload.data ?? payload
      const simulator = result.simulator ?? null

      if (result.inventory) upsertInventoryItem(result.inventory)
      if (simulator) {
        const simulatorWithPests = {
          ...simulator,
          active_pests: applyPestDelta(canonicalSimulationRef.current?.active_pests ?? [], {
            addedPest: result.simulation_pest,
          }),
        }
        const nextSpectatorState = mergeSimulatorState(
          canonicalSimulationRef.current,
          simulatorWithPests,
          { preservePestRisks: true },
        )
        applySimulatorSnapshot(nextSpectatorState, { persistLocalId: false, preserveAppliedAsset: true })
        setVisitingFriend((current) => current ? { ...current, simulatorId: simulator.id } : current)
      }

      setAppliedAsset(null)
      setActionMessage(result.message ?? `${asset.name} sent successfully`)
    } catch (error) {
      setActionMessage(error.message || 'Unable to send this prank')
    } finally {
      prankBusyRef.current = false
    }
  }

  async function applySelectedItem() {
    const asset = appliedAsset?.type === 'item' ? appliedAsset : null
    if (!asset) return

    if (visitingFriend) {
      await prankFriendPlant(asset)
      return
    }

    if (!selectedPlant) {
      setActionMessage('Select a plant before using an item')
      return
    }

    if (!getToken()) {
      setActionMessage('Log in before using lab items')
      openAuth('login')
      return
    }

    const simulatorId = window.localStorage.getItem('plant_game_simulator_id')
    if (!simulatorId) {
      setActionMessage('Save or plant first, then use items')
      return
    }
    if (itemUseBusyRef.current) return

    itemUseBusyRef.current = true
    setActionMessage(`Using ${asset.name}...`)

    try {
      const accountSession = accountSessionRef.current
      if (
        autosaveStateRef.current.visitingFriend
        || isResettingRef.current
        || isEndingSimulationRef.current
      ) return

      // Item usage only mutates inventory and pest records. It can safely run
      // beside environment autosaves instead of waiting behind their network queue.
      const payload = await applySimulatorItem(
        simulatorId,
        asset.itemKey ?? asset.id,
        1,
        asset.backendId,
      )
      if (
        !payload
        || accountSession !== accountSessionRef.current
        || window.localStorage.getItem('plant_game_simulator_id') !== String(simulatorId)
        || isResettingRef.current
        || isEndingSimulationRef.current
      ) return

      const result = payload.data ?? payload
      const simulator = result.simulator ?? null

      if (result.inventory) {
        upsertInventoryItem(result.inventory)
      }

      if (autosaveStateRef.current.visitingFriend) {
        if (simulator) stashOwnGardenSimulator(simulator, { preservePestRisks: true })
        if (ownGardenSnapshotRef.current) ownGardenSnapshotRef.current.appliedAsset = null
        return
      }

      if (simulator) {
        const removedPestIds = result.removed_pest_ids ?? []
        removedPestIds.forEach((pestId) => {
          recentlyRemovedPestIdsRef.current.set(String(pestId), Date.now() + 60_000)
        })
        mergeCanonicalSimulator({
          ...simulator,
          active_pests: applyPestDelta(canonicalSimulationRef.current?.active_pests ?? [], {
            removedPestIds,
          }),
        }, { preservePestRisks: true })
      }

      setAppliedAsset(null)
      setActionMessage(result.message ?? `${asset.name} applied`)
    } catch (error) {
      setActionMessage(error.message || 'Unable to use this item')
    } finally {
      itemUseBusyRef.current = false
    }
  }

  function openPlantWindows() {
    setActiveMobileLabPanel('monitor')
    setWindows((value) => {
      const layout = defaultWindows()

      return Object.fromEntries(Object.entries(value).map(([id, panel]) => {
        const fallback = layout[id] ?? panel
        const shouldCollapse = Boolean(fallback.collapsed)
        const expandedX = Number(panel.expandedX ?? fallback.expandedX ?? fallback.x)
        const expandedY = Number(panel.expandedY ?? fallback.expandedY ?? fallback.y)

        return [id, {
          ...panel,
          x: shouldCollapse ? fallback.x : expandedX,
          y: shouldCollapse ? fallback.y : expandedY,
          expandedX,
          expandedY,
          visible: true,
          collapsed: shouldCollapse,
          responsiveCollapsed: Boolean(fallback.responsiveCollapsed),
        }]
      }))
    })
  }

  async function switchToPlantedSpecies(asset, simulator) {
    if (!simulator || plantingBusy) return

    const currentSimulatorId = simulationVisual?.id ?? window.localStorage.getItem('plant_game_simulator_id')
    if (String(currentSimulatorId) === String(simulator.id)) {
      setAppliedAsset(asset)
      setActionMessage(`${asset.name} is already open`)
      return
    }

    setPlantingBusy(true)
    setModeLoading(true)
    setActionMessage(`Saving ${selectedPlant?.name ?? 'current plant'}...`)

    try {
      await persistCurrentSimulation({ silent: true })
      if (!getToken()) throw new Error('Your session has expired. Please sign in again.')

      applySimulatorSnapshot(simulator)
      setPendingPlant(null)
      openPlantWindows()
      setActionMessage(`Switched to ${asset.name}`)
    } catch (error) {
      setActionMessage(error.message || `Unable to open ${asset.name}`)
    } finally {
      setModeLoading(false)
      setPlantingBusy(false)
    }
  }

  async function startPlantInMode(asset, mode) {
    if (plantingBusy) return

    const apiPlant = plantCatalog.find((plant) => Number(plant.id) === Number(asset.backendId)) ?? null
    const fallbackModelUrl = apiPlant?.base_model_url ?? modelAssets['plant.original']?.url ?? defaultSimulationVisual.current_model_url

    if (!apiPlant) {
      setActionMessage('Plant data is missing from the database. Please add its model and growth stages first.')
      return
    }
    if (!getToken()) {
      setActionMessage('Log in before planting')
      openAuth('login')
      return
    }

    setPlantingBusy(true)
    setModeLoading(true)
    setPendingPlant(null)
    setActionMessage(`Preparing ${asset.name}...`)

    try {
      if (selectedPlant) await persistCurrentSimulation({ silent: true })

      let location = null
      let locationName = ''
      if (mode === 'outdoor') {
        if (demoMode) {
          const previewWeather = createDemoOutdoorWeather()
          location = previewWeather.location
          locationName = previewWeather.addressLabel
          setOutdoorWeather(previewWeather)
        } else {
          try {
            location = await getFixedOutdoorLocation()
            locationName = await fetchLocationAddress(location)
          } catch {
            location = outdoorWeather.location
            locationName = outdoorWeather.addressLabel
          }
        }
      }

      const accountSession = accountSessionRef.current
      const simulatorPayload = await startSimulator(apiPlant.id, mode, {
        location_name: mode === 'outdoor' ? locationName || undefined : undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
      })
      if (accountSession !== accountSessionRef.current || !getToken()) return

      const simulator = simulatorPayload.data ?? simulatorPayload
      window.localStorage.removeItem(resetMarkerKey)
      rememberActiveSimulator(simulator)
      applySimulatorSnapshot({
        ...simulator,
        current_model_url: simulator.current_model_url ?? fallbackModelUrl,
      })
      setAwaitingFirstCycle(Number(simulator.growth_point ?? 0) <= 0)
      setResetPending(false)
      openPlantWindows()
      setActionMessage(`${asset.name} planted in ${mode === 'outdoor' ? 'Outdoor' : 'Environment Control'} mode`)

      const knowledgeKey = plantKnowledgeAutoOpenKey(user?.id, asset)
      let knowledgeAlreadyOpened = false
      try {
        knowledgeAlreadyOpened = window.localStorage.getItem(knowledgeKey) === 'shown'
      } catch {
        // The guide can still open when local storage is unavailable.
      }
      if (!knowledgeAlreadyOpened) {
        setPendingPlantKnowledge({ asset, key: knowledgeKey })
      } else {
        setViewedPlantKnowledgeId(plantKnowledgeIdentity(asset))
      }
    } catch (error) {
      setPendingPlant(asset)
      setActionMessage(error.message || `Unable to plant ${asset.name}`)
    } finally {
      setModeLoading(false)
      setPlantingBusy(false)
    }
  }

  async function switchFriendSpecies(asset) {
    if (!visitingFriend || plantingBusy) return

    const simulatorSummary = (visitingFriend.planted_simulators ?? [])
      .find((simulator) => Number(simulator.plant_id) === Number(asset.backendId))

    if (!simulatorSummary?.id) {
      setActionMessage(`${visitingFriend.user?.username ?? 'This friend'} has not planted ${asset.name} yet`)
      return
    }
    if (String(visitingFriend.simulatorId ?? '') === String(simulatorSummary.id)) {
      setActionMessage(`Already viewing ${asset.name}`)
      return
    }

    const requestId = spectatorRequestRef.current + 1
    spectatorRequestRef.current = requestId
    const ownerName = visitingFriend.user?.username ?? 'Friend'
    setFriendGardenLoading({
      ...initialFriendGardenLoading,
      active: true,
      loadKey: requestId,
      ownerName,
    })
    setPlantingBusy(true)
    setModeLoading(true)
    setAppliedAsset(null)
    setActionMessage(`Opening ${ownerName}'s ${asset.name}...`)

    try {
      const payload = await getSpectatorSimulator(simulatorSummary.id)
      const simulator = payload.data ?? payload
      const spectatorWeather = await outdoorWeatherForSimulator(simulator)
      if (spectatorRequestRef.current !== requestId) return

      setFriendGardenLoading((current) => current.loadKey === requestId
        ? {
            ...current,
            commentsReady: false,
            dataReady: true,
            sceneReady: false,
            simulatorId: simulator.id,
          }
        : current)
      applySimulatorSnapshot(simulator, {
        outdoorWeather: spectatorWeather,
        persistLocalId: false,
      })
      setVisitingFriend((current) => current ? { ...current, simulatorId: simulator.id } : current)
      setActionMessage(`Viewing ${ownerName}'s ${asset.name}`)
    } catch (error) {
      if (spectatorRequestRef.current === requestId) {
        setFriendGardenLoading((current) => current.loadKey === requestId
          ? { ...current, active: false, error: error.message || `Unable to open ${asset.name}` }
          : current)
        setActionMessage(error.message || `Unable to open ${asset.name}`)
      }
    } finally {
      setModeLoading(false)
      setPlantingBusy(false)
    }
  }

  async function applyLabAsset(asset) {
    if (asset.type === 'item') {
      if (Number(inventoryMap[asset.itemKey ?? asset.id] ?? asset.quantity ?? 0) <= 0) {
        setAppliedAsset(null)
        setActionMessage(`${asset.name} is out of stock. Visit Shop to get more.`)
        return
      }

      if (appliedAsset?.type === 'item' && appliedAsset.id === asset.id) {
        setAppliedAsset(null)
        setActionMessage(`${asset.name} cancelled`)
        return
      }

      setAppliedAsset(asset)

      if (visitingFriend) {
        if (!asset.friendUsable) {
          setAppliedAsset(null)
          setActionMessage('Only aphid and snail prank items can be used in a friend garden')
          return
        }
        if (!visitingFriend.simulatorId || !selectedPlant) {
          setAppliedAsset(null)
          setActionMessage(`${visitingFriend.user?.username ?? 'This friend'} has not planted a plant yet`)
          return
        }
        setActionMessage(`Selected ${asset.name}. Click the friend's plant to send it.`)
        return
      }

      setActionMessage(`Selected ${asset.name}. Click a pest to use it.`)
      return
    }

    if (asset.type === 'plant') {
      if (visitingFriend) {
        await switchFriendSpecies(asset)
        return
      }
      if (plantingBusy) return

      const currentPlantId = Number(selectedPlant?.backendId ?? simulationVisual?.plant?.id ?? 0)
      const plantedSimulator = activeSimulators.find((simulator) => Number(simulator.plant_id) === Number(asset.backendId))
        ?? (currentPlantId === Number(asset.backendId) && simulationVisual?.status === 'active' ? simulationVisual : null)

      if (plantedSimulator) {
        await switchToPlantedSpecies(asset, plantedSimulator)
        return
      }

      if (selectedPlant || !growingMode) {
        setPendingPlant(asset)
        setActionMessage(`Choose a growing mode for ${asset.name}`)
        return
      }

      await startPlantInMode(asset, growingMode)
    }
  }

  async function chooseGrowingMode(mode) {
    if (pendingPlant) {
      const plantToStart = pendingPlant
      await startPlantInMode(plantToStart, mode)
      return
    }

    const loadingStartedAt = Date.now()
    setModeLoading(true)
    setResetPending(false)
    setGrowingMode(mode)
    setSelectedPlant(null)
    setGrowthTrack(initialGrowthTrack)
    setAwaitingFirstCycle(false)
    setCycleStatus('idle')
    setNextSimulationTickAt(null)
    setActiveMobileLabPanel('monitor')

    const guidedWindows = defaultWindows()

    if (mode === 'outdoor') {
      guidedWindows.climate = {
        ...guidedWindows.climate,
        ...outdoorClimateWindow(guidedWindows),
        collapsed: false,
      }
    } else {
      setOutdoorWeather(initialOutdoorWeather)
    }
    setWindows(guidedWindows)

    try {
      const payload = await getPlants()
      const plants = payload.data ?? payload
      setPlantCatalog(plants)
      canonicalSimulationRef.current = defaultSimulationVisual
      setSimulationVisual(defaultSimulationVisual)
      window.localStorage.removeItem('plant_game_simulator_id')
    } catch {
      window.localStorage.removeItem('plant_game_simulator_id')
    }

    const remainingLoadingTime = 800 - (Date.now() - loadingStartedAt)
    if (remainingLoadingTime > 0) await wait(remainingLoadingTime)
    setModeLoading(false)
    setActionMessage('Step 2: Select a plant from Lab assets to begin')
  }

  async function saveSimulation() {
    const simulatorId = window.localStorage.getItem('plant_game_simulator_id')
    if (isEndingSimulationRef.current) return

    if (resetPending) {
      isEndingSimulationRef.current = true
      try {
        if (simulatorId && getToken()) {
          await enqueueSimulationMutation(() => uprootSimulator(simulatorId))
        }
      } finally {
        window.localStorage.removeItem('plant_game_simulator_id')
        if (simulatorId) window.localStorage.removeItem(`${simulationTickMarkerPrefix}${simulatorId}`)
        latestSaveLoadedRef.current = false
        setResetPending(false)
        setGrowingMode(null)
        setModeLoading(false)
        setSaveHydrated(true)
        setClimate({ ...defaultClimate })
        setOutdoorWeather(initialOutdoorWeather)
        setAppliedAsset(null)
        canonicalSimulationRef.current = defaultSimulationVisual
        setSimulationVisual(defaultSimulationVisual)
        setGrowthTrack(initialGrowthTrack)
        setSelectedPlant(null)
        setAwaitingFirstCycle(false)
        setCycleStatus('idle')
        setNextSimulationTickAt(null)
        isEndingSimulationRef.current = false
        setActionMessage('Reset saved. Choose a new growing mode.')
      }
      return
    }

    isEndingSimulationRef.current = true
    try {
      const snapshotImageData = stageSnapshotRef.current?.capture?.() ?? null
      const simulator = await persistCurrentSimulation({ silent: false, allowEnding: true })
      const nextVisual = simulator ?? previewSimulationVisual
      const historySimulatorId = simulator?.id ?? simulatorId

      window.localStorage.setItem(
        'plantsim-scenario',
        JSON.stringify({
          climate,
          growingMode,
          simulationVisual: nextVisual,
          appliedAssetId: appliedAsset?.id,
          savedAt: new Date().toISOString(),
        }),
      )

      if (historySimulatorId && getToken() && selectedPlant) {
        const historyVisibility = nextVisual?.share_visibility && nextVisual.share_visibility !== 'private'
          ? nextVisual.share_visibility
          : 'private'
        const growthEstimate = getRealGrowthEstimate(nextVisual)
        const payload = await savePlantHistory(historySimulatorId, {
          visibility: historyVisibility,
          snapshot_image_data: snapshotImageData,
          growth_calculation: {
            cycle_seconds: growthEstimate.cycleSeconds,
            observed_growth_points_per_cycle: Number(nextVisual?.growth_rate ?? previewSimulationVisual?.growth_rate ?? 0),
            recent_growth_percentages: [...growthTrack.history, growthEstimate.progressPercent].slice(-20),
          },
        })
        const history = payload.data ?? payload
        forgetActiveSimulator(historySimulatorId)
        window.localStorage.removeItem('plant_game_simulator_id')
        window.localStorage.removeItem(`${simulationTickMarkerPrefix}${historySimulatorId}`)
        window.localStorage.removeItem('plantsim-scenario')
        latestSaveLoadedRef.current = false
        setResetPending(false)
        setSaveReadyForNewPlant(true)
        setSaveCompleteHistory(history)
        setActionMessage('Saved to history')
      } else {
        isEndingSimulationRef.current = false
        setActionMessage('Saved locally')
      }

      setResetPending(false)
    } catch (error) {
      isEndingSimulationRef.current = false
      setActionMessage(error.message || 'Unable to save history')
    }
  }

  async function toggleLiveShare() {
    const simulatorId = previewSimulationVisual?.id ?? window.localStorage.getItem('plant_game_simulator_id')
    if (!simulatorId || !selectedPlant || visitingFriend || shareBusy) return

    const previousVisibility = previewSimulationVisual?.share_visibility ?? 'private'
    const visibility = previousVisibility === 'private' ? 'public' : 'private'
    setShareBusy(true)
    mergeCanonicalSimulator({ ...canonicalSimulationRef.current, share_visibility: visibility })

    try {
      const accountSession = accountSessionRef.current
      const snapshotImageData = visibility === 'private' ? null : stageSnapshotRef.current?.capture?.() ?? null
      const payload = await enqueueSimulationMutation(() => {
        if (
          accountSession !== accountSessionRef.current
          || window.localStorage.getItem('plant_game_simulator_id') !== String(simulatorId)
          || autosaveStateRef.current.visitingFriend
          || isResettingRef.current
          || isEndingSimulationRef.current
          || !getToken()
        ) {
          return null
        }
        return shareSimulator(simulatorId, visibility, '', snapshotImageData)
      })
      if (!payload || accountSession !== accountSessionRef.current || isResettingRef.current || isEndingSimulationRef.current) return

      const simulator = payload.data ?? payload
      if (autosaveStateRef.current.visitingFriend) {
        stashOwnGardenSimulator(simulator, { preservePestRisks: true })
        return
      }

      mergeCanonicalSimulator(simulator, { preservePestRisks: true })
      setActionMessage(visibility === 'private' ? 'Live sharing stopped' : 'Your live garden is now visible in Community')
    } catch (error) {
      if (autosaveStateRef.current.visitingFriend && ownGardenSnapshotRef.current) {
        ownGardenSnapshotRef.current.simulationVisual = {
          ...ownGardenSnapshotRef.current.simulationVisual,
          share_visibility: previousVisibility,
        }
      } else {
        mergeCanonicalSimulator({ ...canonicalSimulationRef.current, share_visibility: previousVisibility })
      }
      setActionMessage(error.message || 'Unable to change live sharing')
    } finally {
      setShareBusy(false)
    }
  }

  function closeSaveCompleteModal() {
    setSaveCompleteHistory(null)

    if (!saveReadyForNewPlant) return

    setSaveReadyForNewPlant(false)
    const nextPlantedSpecies = activeSimulators[0]
    if (nextPlantedSpecies) {
      isEndingSimulationRef.current = false
      applySimulatorSnapshot(nextPlantedSpecies)
      openPlantWindows()
      setActionMessage(`${nextPlantedSpecies.plant?.name_en ?? nextPlantedSpecies.plant?.name_th ?? 'Another plant'} is now open`)
      return
    }

    setGrowingMode(null)
    setModeLoading(false)
    setSaveHydrated(true)
    setClimate({ ...defaultClimate })
    setOutdoorWeather(initialOutdoorWeather)
    setAppliedAsset(null)
    canonicalSimulationRef.current = defaultSimulationVisual
    setSimulationVisual(defaultSimulationVisual)
    setGrowthTrack(initialGrowthTrack)
    setSelectedPlant(null)
    setAwaitingFirstCycle(false)
    setCycleStatus('idle')
    setNextSimulationTickAt(null)
    isEndingSimulationRef.current = false
    setActionMessage('Choose a new growing mode.')
  }

  async function resetSimulation() {
    if (isResettingRef.current || !selectedPlant) return

    const plantName = selectedPlant.name || 'this plant'
    const confirmation = await Swal.fire({
      title: `Uproot ${plantName}?`,
      text: 'This ends the active simulation and removes its current growing progress. This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, uproot plant',
      cancelButtonText: 'Keep growing',
      focusCancel: true,
      reverseButtons: true,
      background: '#101511',
      color: '#eaf7df',
      buttonsStyling: false,
      customClass: {
        popup: 'plantsim-lab-alert',
        title: 'plantsim-lab-alert__title',
        htmlContainer: 'plantsim-lab-alert__message',
        actions: 'plantsim-lab-alert__actions',
        confirmButton: 'plantsim-lab-alert__danger',
        cancelButton: 'plantsim-lab-alert__cancel',
      },
    })

    if (!confirmation.isConfirmed) return

    const simulatorId = window.localStorage.getItem('plant_game_simulator_id')
    const accountSession = accountSessionRef.current
    const sessionToken = getToken()

    isResettingRef.current = true
    window.localStorage.setItem(resetMarkerKey, String(simulatorId ?? ''))
    window.localStorage.removeItem('plant_game_simulator_id')
    setResetPending(false)
    setActionMessage('Resetting simulation...')

    try {
      if (simulatorId) {
        if (!sessionToken) throw new Error('Your session has expired. Please sign in again.')

        const payload = await enqueueSimulationMutation(() => {
          if (accountSession !== accountSessionRef.current || getToken() !== sessionToken) return null
          return uprootSimulator(simulatorId)
        })

        if (!payload || accountSession !== accountSessionRef.current || getToken() !== sessionToken) return
      }

      window.localStorage.removeItem(resetMarkerKey)
      latestSaveLoadedRef.current = true
      if (simulatorId) window.localStorage.removeItem(`${simulationTickMarkerPrefix}${simulatorId}`)
      const remainingActiveSimulators = activeSimulators.filter((simulator) => String(simulator.id) !== String(simulatorId))
      setActiveSimulators(remainingActiveSimulators)

      if (remainingActiveSimulators[0]) {
        setModeLoading(false)
        setSaveHydrated(true)
        applySimulatorSnapshot(remainingActiveSimulators[0])
        openPlantWindows()
        setActionMessage(`${plantName} uprooted. ${remainingActiveSimulators[0].plant?.name_en ?? remainingActiveSimulators[0].plant?.name_th ?? 'Another plant'} is now open.`)
        return
      }

      setClimate(
        growingMode === 'outdoor' && outdoorWeather.forecast
          ? climateFromForecast({ ...defaultClimate }, outdoorWeather.forecast)
          : { ...defaultClimate },
      )
      setGrowingMode(null)
      setModeLoading(false)
      setSaveHydrated(true)
      setOutdoorWeather(initialOutdoorWeather)
      setAppliedAsset(null)
      canonicalSimulationRef.current = defaultSimulationVisual
      setSimulationVisual(defaultSimulationVisual)
      setGrowthTrack(initialGrowthTrack)
      setSelectedPlant(null)
      setAwaitingFirstCycle(false)
      setCycleStatus('idle')
      setNextSimulationTickAt(null)
      setActionMessage('Reset complete. Choose a growing mode.')
    } catch (error) {
      if (accountSession === accountSessionRef.current && getToken() === sessionToken) {
        if (simulatorId) window.localStorage.setItem('plant_game_simulator_id', String(simulatorId))
        setActionMessage(error.message || 'Reset was not confirmed. Try Reset again.')
      }
    } finally {
      isResettingRef.current = false
    }
  }


  function openAuth(mode = 'login') {
    setAuthMode(mode)
    setAuthError('')
    setAuthStatus('idle')
    setProfileOpen(false)
    setActivePage('auth')
  }

  function clearClientSimulationSession({ hydrated = true } = {}) {
    const simulatorId = window.localStorage.getItem('plant_game_simulator_id')
    accountSessionRef.current += 1
    spectatorRequestRef.current += 1
    latestSaveLoadedRef.current = false
    autosaveStateRef.current = {}
    isResettingRef.current = false
    isEndingSimulationRef.current = false
    ownGardenSnapshotRef.current = null
    recentlyRemovedPestIdsRef.current.clear()
    rewardClaimingRef.current = null

    if (simulatorId) window.localStorage.removeItem(`${simulationTickMarkerPrefix}${simulatorId}`)
    window.localStorage.removeItem('plant_game_simulator_id')
    window.localStorage.removeItem(resetMarkerKey)

    setVisitingFriend(null)
    setWindows(defaultWindows())
    setClimate({ ...defaultClimate })
    setGrowingMode(null)
    setModeLoading(false)
    setSaveHydrated(hydrated)
    setResetPending(false)
    setOutdoorWeather(initialOutdoorWeather)
    setAppliedAsset(null)
    canonicalSimulationRef.current = defaultSimulationVisual
    setSimulationVisual(defaultSimulationVisual)
    setGrowthTrack(initialGrowthTrack)
    setSelectedPlant(null)
    setAwaitingFirstCycle(false)
    setCycleStatus('idle')
    setNextSimulationTickAt(null)
    setSaveCompleteHistory(null)
    setSaveReadyForNewPlant(false)
    setInventoryItems([])
    setCoinDelta(null)
    setCoinBurst(null)
    setExpBurst(null)
    setShareBusy(false)
    setActionMessage('')
  }

  async function submitAuth(event) {
    event.preventDefault()
    setAuthStatus('loading')
    setAuthError('')

    if (authMode === 'register' && authForm.password !== authForm.passwordConfirmation) {
      setAuthStatus('idle')
      setAuthError('Passwords do not match. Please enter the same password twice.')
      return
    }

    try {
      const payload = authMode === 'register'
        ? await registerUser(authForm.username.trim(), authForm.email.trim(), authForm.password, authForm.passwordConfirmation)
        : await loginUser(authForm.email.trim(), authForm.password)

      const signedInUser = payload.user ?? payload.data ?? null
      if (!signedInUser?.id) {
        clearToken()
        throw new Error('The server did not return your account details.')
      }
      clearClientSimulationSession({ hydrated: false })
      setUser(signedInUser)
      setSessionStatus('authenticated')
      setAuthStatus('idle')
      setAuthForm({ username: '', email: '', password: '', passwordConfirmation: '' })
      setActivePage(pendingPageAfterAuth ?? (signedInUser.role === 'admin' ? 'admin' : 'lab'))
      setPendingPageAfterAuth(null)
    } catch (error) {
      setAuthStatus('idle')
      setAuthError(error.message || 'Unable to sign in right now')
    }
  }

  async function submitGoogleAuth() {
    setAuthStatus('google-loading')
    setAuthError('')
    let receivedSession = false

    try {
      await loginWithGoogle()
      receivedSession = true
      const payload = await getMe()

      const signedInUser = payload.data ?? payload.user ?? null
      if (!signedInUser?.id) throw new Error('The server did not return your account details.')
      clearClientSimulationSession({ hydrated: false })
      setUser(signedInUser)
      setSessionStatus('authenticated')
      setAuthStatus('idle')
      setAuthForm({ username: '', email: '', password: '', passwordConfirmation: '' })
      setActivePage(pendingPageAfterAuth ?? (signedInUser.role === 'admin' ? 'admin' : 'lab'))
      setPendingPageAfterAuth(null)
    } catch (error) {
      if (receivedSession) clearToken()
      setAuthStatus('idle')
      setAuthError(error.message || 'Unable to sign in with Google right now')
    }
  }

  async function viewFriendGarden(friend) {
    const requestId = spectatorRequestRef.current + 1
    spectatorRequestRef.current = requestId
    const ownerName = friend?.user?.username ?? 'Friend'
    setFriendGardenLoading({
      ...initialFriendGardenLoading,
      active: true,
      loadKey: requestId,
      ownerName,
    })
    ownGardenSnapshotRef.current = {
      appliedAsset,
      awaitingFirstCycle,
      climate,
      cycleStatus,
      growingMode,
      growthTrack,
      nextSimulationTickAt,
      outdoorWeather,
      selectedPlant,
      simulationVisual,
      windows,
    }
    autosaveStateRef.current = { ...autosaveStateRef.current, visitingFriend: friend }
    setVisitingFriend({ ...friend, simulatorId: friend.latest_simulator?.id ?? null })
    setAppliedAsset(null)
    setActivePage('lab')
    setWindows((value) => ({
      ...value,
      comments: { ...value.comments, x: Math.max(24, window.innerWidth - 400), y: window.innerHeight >= 820 ? 88 : 144, visible: true, collapsed: false },
      monitor: { ...value.monitor, visible: true, collapsed: false },
      climate: { ...value.climate, visible: false },
      friends: { ...value.friends, visible: false },
    }))
    setActionMessage(`Loading ${ownerName}'s plant...`)

    try {
      const cachedSimulator = friend.latest_simulator ?? null
      const payload = cachedSimulator ? { data: cachedSimulator } : await getFriendLatestSimulator(friend.id)
      const candidate = payload.data ?? null
      const livePayload = candidate?.id ? await getSpectatorSimulator(candidate.id) : null
      const simulator = livePayload?.data ?? livePayload ?? null
      const spectatorWeather = simulator
        ? await outdoorWeatherForSimulator(simulator)
        : initialOutdoorWeather

      if (spectatorRequestRef.current !== requestId) return

      if (simulator) {
        setFriendGardenLoading((current) => current.loadKey === requestId
          ? {
              ...current,
              commentsReady: false,
              dataReady: true,
              sceneReady: false,
              simulatorId: simulator.id,
            }
          : current)
        setVisitingFriend((current) => {
          if (!current) return current
          const plantedSimulators = [
            simulator,
            ...(current.planted_simulators ?? [])
              .filter((entry) => String(entry.id) !== String(simulator.id)),
          ]
          return {
            ...current,
            latest_simulator: simulator,
            planted_simulators: plantedSimulators,
            simulatorId: simulator.id,
          }
        })
        applySimulatorSnapshot(simulator, {
          outdoorWeather: spectatorWeather,
          persistLocalId: false,
        })
        setActionMessage(`Viewing ${ownerName}'s plant`)
      } else {
        setFriendGardenLoading((current) => current.loadKey === requestId
          ? {
              ...current,
              commentsReady: false,
              dataReady: true,
              sceneReady: false,
              simulatorId: null,
            }
          : current)
        setVisitingFriend((current) => current ? { ...current, simulatorId: null } : current)
        setAppliedAsset(null)
        setGrowingMode('greenhouse')
        setModeLoading(false)
        setOutdoorWeather(initialOutdoorWeather)
        setClimate({ ...defaultClimate })
        setSelectedPlant(null)
        canonicalSimulationRef.current = defaultSimulationVisual
        setSimulationVisual(defaultSimulationVisual)
        setGrowthTrack(initialGrowthTrack)
        setActionMessage(`${ownerName} has no active plant yet`)
      }
    } catch (error) {
      if (spectatorRequestRef.current !== requestId) return
      setFriendGardenLoading((current) => current.loadKey === requestId
        ? {
            ...current,
            commentsReady: false,
            dataReady: true,
            error: error.message || 'Unable to load this friend plant.',
            sceneReady: false,
            simulatorId: null,
          }
        : current)
      setVisitingFriend((current) => current ? { ...current, simulatorId: null } : current)
      setAppliedAsset(null)
      setGrowingMode('greenhouse')
      setModeLoading(false)
      setOutdoorWeather(initialOutdoorWeather)
      setClimate({ ...defaultClimate })
      setSelectedPlant(null)
      canonicalSimulationRef.current = defaultSimulationVisual
      setSimulationVisual(defaultSimulationVisual)
      setGrowthTrack(initialGrowthTrack)
      setActionMessage(error.message || 'Unable to load this friend plant')
    }
  }

  async function viewCommunityGame(post, source = 'community') {
    if (demoMode) {
      setActionMessage('Game-state viewing is disabled in this page preview.')
      return
    }

    const liveSimulator = post?.live_simulator
    const savedSimulator = post?.plant_history?.game_state?.simulator
    const owner = post?.user ?? null

    if (!liveSimulator?.id && !savedSimulator) {
      setActionMessage('This game state is not available.')
      return
    }

    const requestId = spectatorRequestRef.current + 1
    spectatorRequestRef.current = requestId
    const ownerName = owner?.username ?? 'Learner'
    setFriendGardenLoading({
      ...initialFriendGardenLoading,
      active: true,
      loadKey: requestId,
      ownerName,
    })

    ownGardenSnapshotRef.current = {
      appliedAsset,
      awaitingFirstCycle,
      climate,
      cycleStatus,
      growingMode,
      growthTrack,
      nextSimulationTickAt,
      outdoorWeather,
      selectedPlant,
      simulationVisual,
      windows,
    }
    setActivePage('lab')
    setWindows((value) => ({
      ...value,
      comments: { ...value.comments, x: Math.max(24, window.innerWidth - 400), y: window.innerHeight >= 820 ? 88 : 144, visible: Boolean(liveSimulator), collapsed: false },
      monitor: { ...value.monitor, visible: true, collapsed: false },
      climate: { ...value.climate, visible: false },
      friends: { ...value.friends, visible: false },
    }))

    if (liveSimulator?.id) {
      autosaveStateRef.current = { ...autosaveStateRef.current, visitingFriend: { user: owner, simulatorId: liveSimulator.id, source } }
      setVisitingFriend({ user: owner, simulatorId: liveSimulator.id, source })
      setActionMessage('Connecting to the live garden...')
      try {
        const payload = await getSpectatorSimulator(liveSimulator.id)
        const simulator = payload.data ?? payload
        const spectatorWeather = await outdoorWeatherForSimulator(simulator)
        if (spectatorRequestRef.current !== requestId) return
        setFriendGardenLoading((current) => current.loadKey === requestId
          ? {
              ...current,
              commentsReady: false,
              dataReady: true,
              sceneReady: false,
              simulatorId: simulator.id ?? null,
            }
          : current)
        applySimulatorSnapshot(simulator, {
          outdoorWeather: spectatorWeather,
          persistLocalId: false,
        })
        setActionMessage(`Watching ${ownerName} live`)
      } catch (error) {
        if (spectatorRequestRef.current !== requestId) return
        leaveFriendGarden(source)
        setActionMessage(error.status === 410 ? 'This garden is no longer live.' : (error.message || 'Unable to open this live garden'))
      }
      return
    }

    if (savedSimulator) {
      const spectatorWeather = await outdoorWeatherForSimulator(savedSimulator)
      if (spectatorRequestRef.current !== requestId) return

      autosaveStateRef.current = { ...autosaveStateRef.current, visitingFriend: { user: owner ?? user, historyReplay: true, historyId: post?.plant_history?.id, source } }
      setVisitingFriend({ user: owner ?? user, historyReplay: true, historyId: post?.plant_history?.id, source })
      setFriendGardenLoading((current) => current.loadKey === requestId
        ? {
            ...current,
            commentsReady: false,
            dataReady: true,
            sceneReady: false,
            simulatorId: savedSimulator.id ?? null,
          }
        : current)
      applySimulatorSnapshot(savedSimulator, {
        outdoorWeather: spectatorWeather,
        persistLocalId: false,
      })
      setActionMessage('Viewing a saved game state')
      return
    }

  }

  function viewSavedGameState(save) {
    const simulator = save?.game_state?.simulator
    if (!simulator) {
      setActionMessage('This older save does not contain a game state.')
      return
    }

    viewCommunityGame({ plant_history: save, user }, 'history')
  }

  const leaveFriendGarden = useCallback((sourceOverride = null) => {
    const snapshot = ownGardenSnapshotRef.current
    const returnSource = typeof sourceOverride === 'string' ? sourceOverride : visitingFriend?.source
    const returnPage = returnSource === 'community'
      ? 'community'
      : returnSource === 'history'
        ? 'history'
        : null
    spectatorRequestRef.current += 1
    setFriendGardenLoading(initialFriendGardenLoading)
    autosaveStateRef.current = { ...autosaveStateRef.current, visitingFriend: null }
    setVisitingFriend(null)

    if (snapshot) {
      autosaveStateRef.current = {
        ...autosaveStateRef.current,
        climate: snapshot.climate,
        growingMode: snapshot.growingMode,
        growthTrack: snapshot.growthTrack,
        outdoorWeather: snapshot.outdoorWeather,
        selectedPlant: snapshot.selectedPlant,
        simulationVisual: snapshot.simulationVisual,
        visitingFriend: null,
      }
      setAppliedAsset(snapshot.appliedAsset)
      setAwaitingFirstCycle(Boolean(snapshot.awaitingFirstCycle))
      setClimate(snapshot.climate)
      setCycleStatus(snapshot.cycleStatus ?? 'idle')
      setGrowingMode(snapshot.growingMode)
      setGrowthTrack(snapshot.growthTrack)
      setNextSimulationTickAt(snapshot.nextSimulationTickAt ?? null)
      setSelectedPlant(snapshot.selectedPlant)
      canonicalSimulationRef.current = snapshot.simulationVisual
      setSimulationVisual(snapshot.simulationVisual)
      setWindows(snapshot.windows ?? defaultWindows())
    } else {
      setWindows((value) => ({
        ...value,
        monitor: { ...value.monitor, visible: true },
        climate: { ...value.climate, visible: true },
        friends: { ...value.friends, visible: true },
        comments: { ...value.comments, visible: true },
      }))
    }

    ownGardenSnapshotRef.current = null
    if (returnPage) setActivePage(returnPage)
    setActionMessage(returnPage === 'community' ? 'Back to Community' : returnPage === 'history' ? 'Back to History' : 'Back to your garden')
  }, [setActionMessage, visitingFriend?.source])

  useEffect(() => {
    const simulatorId = visitingFriend?.simulatorId
    if (activePage === 'admin' || friendGardenLoading.active || !simulatorId || visitingFriend?.historyReplay) return undefined

    let cancelled = false
    let requestRunning = false

    async function refreshSpectatorState() {
      if (requestRunning) return
      requestRunning = true
      try {
        const payload = await getSpectatorSimulator(simulatorId)
        if (!cancelled) applySimulatorSnapshot(payload.data ?? payload, { persistLocalId: false, preserveAppliedAsset: true })
      } catch (error) {
        if (!cancelled && (error.status === 410 || error.status === 403 || error.status === 404)) {
          const ownerName = visitingFriend?.user?.username ?? 'The owner'
          leaveFriendGarden()
          setActionMessage(`${ownerName}'s live garden has ended.`)
        }
      } finally {
        requestRunning = false
      }
    }

    const interval = window.setInterval(refreshSpectatorState, 1500)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [activePage, applySimulatorSnapshot, friendGardenLoading.active, leaveFriendGarden, setActionMessage, visitingFriend?.historyReplay, visitingFriend?.simulatorId, visitingFriend?.user?.username])

  function navigateToPage(page) {
    // Each public preview is intentionally isolated to the page selected on
    // the landing screen. Nested controls and tutorials cannot expose another
    // authenticated area while the temporary session is active.
    if (demoMode) {
      setProfileOpen(false)
      setActivePage(demoPage ?? 'lab')
      return
    }

    if (sessionStatus !== 'authenticated' || !user) {
      openAuth('login')
      return
    }

    if (visitingFriend) {
      leaveFriendGarden()
    }
    if (page === 'settings' && ['lab', 'shop', 'history', 'community'].includes(activePage)) {
      setSettingsReturnPage(activePage)
    }
    setActivePage(page)
  }

  function openLanding(page = 'home') {
    if (visitingFriend) leaveFriendGarden()
    setProfileOpen(false)
    setActivePage(page)
  }

  function enterGameFromLanding() {
    if (sessionStatus !== 'authenticated' || !user) {
      setPendingPageAfterAuth('lab')
      openAuth('login')
      return
    }

    setActivePage('lab')
  }

  function openGamePageFromLanding(page) {
    if (sessionStatus !== 'authenticated' || !user) {
      setPendingPageAfterAuth(page)
      openAuth('login')
      return
    }

    setActivePage(page)
  }

  async function enterDemoSession(requestedPage = 'lab') {
    const previewPages = ['lab', 'shop', 'history', 'community', 'settings']
    const destination = previewPages.includes(requestedPage) ? requestedPage : 'lab'
    const previewUser = startDemoApiSession()

    clearClientSimulationSession({ hydrated: false })
    latestSaveLoadedRef.current = true
    setDemoMode(true)
    setDemoPage(destination)
    setUser(previewUser)
    setSessionStatus('authenticated')
    setPlantCatalogStatus('loading')
    setInventoryStatus('loading')
    setNotificationStatus('loading')
    setAuthError('')
    setProfileOpen(false)
    setActivePage(destination)

    try {
      const payload = await getPlants()
      if (!isDemoApiSessionActive()) return
      const plants = payload.data ?? payload
      if (Array.isArray(plants)) {
        setPlantCatalog(plants)
        setPlantCatalogStatus('ready')
      }
      const simulator = seedDemoSimulator(Array.isArray(plants) ? plants[0] : null)
      if (simulator) {
        setActiveSimulators([simulator])
        applySimulatorSnapshot(simulator)
      }
    } catch {
      if (!isDemoApiSessionActive()) return
      const simulator = seedDemoSimulator()
      if (simulator) {
        setPlantCatalog([simulator.plant].filter(Boolean))
        setActiveSimulators([simulator])
        applySimulatorSnapshot(simulator)
      }
      setPlantCatalogStatus('ready')
    } finally {
      if (isDemoApiSessionActive()) setSaveHydrated(true)
    }
  }

  function exitDemoSession(destination = 'home') {
    clearClientSimulationSession()
    stopDemoApiSession()
    applySettings(loadSettings())
    setDemoMode(false)
    setDemoPage(null)
    setPlantCatalog([])
    setActiveSimulators([])
    setPendingPlant(null)
    setPlantingBusy(false)
    setUser(null)
    notificationRequestRef.current += 1
    setNotifications([])
    setNotificationStatus('idle')
    setNotificationError('')
    setProfileOpen(false)
    setHelpCenterOpen(false)
    setAuthMode('login')
    setAuthStatus('idle')
    setAuthError('')
    setAuthForm({ username: '', email: '', password: '', passwordConfirmation: '' })
    setPendingPageAfterAuth(null)
    setSessionStatus('guest')
    setActivePage(destination === 'auth' ? 'auth' : 'home')
  }

  function logoutUser() {
    clearToken()
    clearClientSimulationSession()
    setPlantCatalog([])
    setActiveSimulators([])
    setPendingPlant(null)
    setPlantingBusy(false)
    setUser(null)
    notificationRequestRef.current += 1
    setNotifications([])
    setNotificationStatus('idle')
    setNotificationError('')
    setSessionStatus('guest')
    setProfileOpen(false)
    setHelpCenterOpen(false)
    setAuthMode('login')
    setAuthStatus('idle')
    setAuthError('')
    setAuthForm({ username: '', email: '', password: '', passwordConfirmation: '' })
    setPendingPageAfterAuth(null)
    setActivePage('auth')
  }

  const ownSceneLoadKey = activePage === 'lab' && growingMode && !visitingFriend
    ? `lab:${growingMode}:${simulationVisual?.id ?? 'empty'}:${simulationVisual?.current_model_url ?? 'model'}`
    : null

  useEffect(() => {
    setLabSceneReady(false)
  }, [modeLoading, ownSceneLoadKey])

  useEffect(() => {
    if (
      !pendingPlantKnowledge
      || activePage !== 'lab'
      || visitingFriend
      || modeLoading
      || !labSceneReady
      || plantKnowledgeAsset
    ) {
      return undefined
    }

    const revealTimer = window.setTimeout(() => {
      setPlantKnowledgeAsset(pendingPlantKnowledge.asset)
      setPendingPlantKnowledge(null)
    }, 220)

    return () => window.clearTimeout(revealTimer)
  }, [activePage, labSceneReady, modeLoading, pendingPlantKnowledge, plantKnowledgeAsset, visitingFriend])

  useEffect(() => {
    setPendingPlantKnowledge(null)
    setPlantKnowledgeAsset(null)
    setViewedPlantKnowledgeId(null)
    setLabSceneReady(false)
  }, [user?.id])

  useEffect(() => {
    if (!selectedPlant) {
      setViewedPlantKnowledgeId(null)
      return
    }

    const plantId = plantKnowledgeIdentity(selectedPlant)
    try {
      setViewedPlantKnowledgeId(
        window.localStorage.getItem(plantKnowledgeAutoOpenKey(user?.id, selectedPlant)) === 'shown'
          ? plantId
          : null,
      )
    } catch {
      setViewedPlantKnowledgeId(null)
    }
  }, [selectedPlant, user?.id])

  function closePlantKnowledge() {
    if (plantKnowledgeAsset) {
      const plantId = plantKnowledgeIdentity(plantKnowledgeAsset)
      setViewedPlantKnowledgeId(plantId)
      try {
        window.localStorage.setItem(plantKnowledgeAutoOpenKey(user?.id, plantKnowledgeAsset), 'shown')
      } catch {
        // The tutorial can continue without browser storage.
      }
    }
    setPlantKnowledgeAsset(null)
  }

  const labReady = Boolean(saveHydrated && growingMode && !modeLoading)
  const labDataReady = Boolean(
    saveHydrated
    && !modeLoading
    && inventoryStatus !== 'loading'
    && plantCatalogStatus !== 'loading'
    && !friendGardenLoading.active
  )
  const onboardingPageReady = activePage !== 'lab' || Boolean(
    labDataReady
    && (!growingMode || labSceneReady)
    && !pendingPlantKnowledge
    && !plantKnowledgeAsset
  )
  const selectedPlantKnowledgeId = selectedPlant ? plantKnowledgeIdentity(selectedPlant) : null
  const onboardingGuideContext = useMemo(() => ({
    labKnowledgeViewed: Boolean(
      selectedPlantKnowledgeId
      && viewedPlantKnowledgeId === selectedPlantKnowledgeId
    ),
    labModeSelected: Boolean(growingMode && !pendingPlant),
    labPlantSelected: Boolean(selectedPlantKnowledgeId),
  }), [growingMode, pendingPlant, selectedPlantKnowledgeId, viewedPlantKnowledgeId])
  const visitorName = visitingFriend?.user?.username ?? visitingFriend?.user?.email?.split('@')[0] ?? 'Friend'
  const visitorReturnLabel = visitingFriend?.source === 'community'
    ? 'Back to Community'
    : visitingFriend?.source === 'history'
      ? 'Back to History'
      : 'Back to my garden'

  if (sessionStatus === 'checking') {
    return <SessionLoadingScreen />
  }

  if (activePage === 'home' || activePage === 'learn') {
    return (
      <>
        <LandingPage
          key={demoMode ? 'demo-landing' : 'public-landing'}
          page={activePage}
          user={user}
          onHome={() => openLanding('home')}
          onLearn={() => openLanding('learn')}
          onStart={enterGameFromLanding}
          onSignIn={() => openAuth('login')}
          onOpenPage={openGamePageFromLanding}
          onOpenDemo={enterDemoSession}
        />
        {demoMode && (
          <DemoSafetyBar
            onExit={() => exitDemoSession('home')}
            onSignIn={() => exitDemoSession('auth')}
          />
        )}
      </>
    )
  }

  if (sessionStatus !== 'authenticated' || !user) {
    return (
      <main className="relative h-screen w-screen overflow-hidden bg-[#f7faf5] text-slate-100">
        <LoginPage
          mode={authMode}
          setMode={setAuthMode}
          form={authForm}
          setForm={setAuthForm}
          status={authStatus}
          error={authError}
          onSubmit={submitAuth}
          onGoogleLogin={submitGoogleAuth}
          onBack={() => openLanding('home')}
          backLabel="Back to home"
        />
      </main>
    )
  }

  if (activePage === 'admin') {
    if (user.role !== 'admin') {
      return null
    }

    return (
      <Suspense fallback={<SessionLoadingScreen />}>
        <AdminPage user={user} onLogout={logoutUser} />
      </Suspense>
    )
  }

  return (
    <main className="game-themed-scrollbar relative h-screen w-screen overflow-hidden bg-[#0b0f0c] text-slate-100" data-mobile-lab-panel={activeMobileLabPanel}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(127,176,105,.16),transparent_25%),linear-gradient(135deg,#070a08_0%,#101511_54%,#080b09_100%)]" />
      <div className="soft-grid absolute inset-0 opacity-55" />

      <TopBar activePage={activePage} coinBalance={user?.coin ?? 0} coinDelta={coinDelta} communityUnreadNotificationCount={communityUnreadNotificationCount} demoMode={demoMode} notificationError={notificationError} notifications={notifications} notificationStatus={notificationStatus} onDemoExit={() => exitDemoSession('home')} onDemoSignIn={() => exitDemoSession('auth')} onHelpOpen={() => setHelpCenterOpen(true)} onNavigate={navigateToPage} onNotificationRead={readNotification} onNotificationsRefresh={refreshNotifications} openWindow={openWindow} profileOpen={profileOpen} setProfileOpen={setProfileOpen} unreadNotificationCount={allUnreadNotificationCount} user={user} onAuthRequired={openAuth} onLogout={demoMode ? () => exitDemoSession('home') : logoutUser} />
      <ToastStack onDismiss={dismissActionToast} toasts={actionToasts} />
      {friendGardenLoading.active && (
        <FriendGardenLoadingScreen
          loading={friendGardenLoading}
          onCancel={() => leaveFriendGarden()}
        />
      )}
      {plantKnowledgeAsset && (
        <PlantKnowledgeModal
          onClose={closePlantKnowledge}
          plantAsset={plantKnowledgeAsset}
        />
      )}
      <OnboardingExperience
        activePage={activePage}
        allowedPages={demoMode ? [demoPage ?? activePage] : undefined}
        guideContext={onboardingGuideContext}
        helpOpen={helpCenterOpen}
        onHelpClose={() => setHelpCenterOpen(false)}
        onNavigate={navigateToPage}
        onProgressChange={updateUserOnboardingProgress}
        pageReady={onboardingPageReady}
        user={user}
      />
      {saveCompleteHistory && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="animate-[saveModalIn_.24s_ease-out] w-full max-w-[420px] overflow-hidden rounded-xl border border-lime-100/20 bg-[#101511]/96 text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,.5)]">
            {saveCompleteHistory.snapshot_image_url && (
              <img className="h-48 w-full bg-[#080b09] object-cover" src={resolveAssetUrl(saveCompleteHistory.snapshot_image_url)} alt="Saved plant snapshot" />
            )}
            <div className="p-5 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#9bcf82] text-[#101511]">
                <span className="text-sm font-black">OK</span>
              </div>
              <h2 className="text-lg font-black text-lime-50">Harvest complete</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">Ready to grow a new plant.</p>
              <div className="mt-4 rounded-lg border border-lime-100/10 bg-white/[0.04] p-3 text-left text-xs text-slate-300">
                <div className="flex justify-between gap-3"><span>Score</span><strong className="text-lime-100">{saveCompleteHistory.total_score ?? 0}</strong></div>
                <div className="mt-1 flex justify-between gap-3"><span>Health</span><strong className="text-lime-100">{saveCompleteHistory.final_health ?? saveCompleteHistory.health ?? 0}%</strong></div>
              </div>
              <button
                className="mt-5 h-9 rounded-md bg-[#9bcf82] px-5 text-sm font-bold text-[#101511] transition hover:bg-[#addf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
                type="button"
                onClick={closeSaveCompleteModal}
              >
                Grow next plant
              </button>
            </div>
          </div>
        </div>
      )}

      <Suspense fallback={<GamePageLoading />}>
      {activePage === 'shop' ? (
        <ShopPage onInventoryItemChange={upsertInventoryItem} onUserUpdate={setUser} />
      ) : activePage === 'history' ? (
        <HistoryPage onOpenGameState={viewSavedGameState} onStartGrowing={() => navigateToPage('lab')} />
      ) : activePage === 'community' ? (
        <CommunityPage currentUser={user} notificationError={notificationError} notificationItems={communityNotifications} notificationStatus={notificationStatus} onNotificationRead={readNotification} onNotificationsRefresh={refreshNotifications} onOpenGame={viewCommunityGame} onUserChange={setUser} unreadCount={communityUnreadNotificationCount} />
      ) : activePage === 'settings' ? (
        <SettingsPage
          backLabel={`Back to ${settingsReturnPage === 'lab' ? 'Plant Lab' : settingsReturnPage[0].toUpperCase() + settingsReturnPage.slice(1)}`}
          user={user}
          onBack={() => navigateToPage(settingsReturnPage)}
          onResetPassword={() => demoMode
            ? setActionMessage('Password reset is disabled in preview mode.')
            : navigateToPage('password-reset')}
        />
      ) : activePage === 'password-reset' ? (
        <PasswordResetPage user={user} onBack={() => navigateToPage('settings')} onDone={() => navigateToPage('settings')} />
      ) : (
        <>
          {labReady && (
            <>
              <LibrarySidebar busy={plantingBusy || modeLoading} error={inventoryStatus === 'error' ? 'Some tools could not be loaded. The academy will retry automatically.' : plantCatalogStatus === 'error' ? 'Plant choices could not be refreshed. The academy will retry automatically.' : ''} friendHasPlant={Boolean(selectedPlant)} loading={inventoryStatus === 'loading' || plantCatalogStatus === 'loading'} readOnly={Boolean(visitingFriend)} selectedAsset={appliedAsset} inventoryMap={inventoryMap} sections={labSections} openSections={openSections} onToggle={toggleLibrarySection} onApply={applyLabAsset} onShowPlantInfo={setPlantKnowledgeAsset} />
              <SimulationStage
                coinBurst={coinBurst}
                emptyGardenOwnerName={visitingFriend ? visitorName : ''}
                expBurst={expBurst}
                location={outdoorWeather.location}
                mode={growingMode}
                outdoorReadings={getOutdoorReadings(outdoorWeather.forecast)}
                weatherStatus={outdoorWeather.status}
                plantSelected={Boolean(selectedPlant)}
                awaitingFirstCycle={awaitingFirstCycle}
                cycleStatus={cycleStatus}
                nextCycleAt={nextSimulationTickAt}
                onSceneReady={handleStageSceneReady}
                selectedItemCursorUrl={selectedItemCursorUrl}
                onUseSelectedItem={applySelectedItem}
                readOnly={Boolean(visitingFriend)}
                shareBusy={shareBusy}
                shareVisibility={previewSimulationVisual?.share_visibility ?? 'private'}
                toggleLiveShare={toggleLiveShare}
                resetSimulation={resetSimulation}
                saveSimulation={saveSimulation}
                sceneAssets={modelAssets}
                sceneLoadKey={friendGardenLoading.active ? friendGardenLoading.loadKey : ownSceneLoadKey}
                simulationVisual={previewSimulationVisual}
                snapshotRef={stageSnapshotRef}
              />

              {visitingFriend && (
                <div className={`absolute left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-lime-100/15 bg-[#101511]/90 px-3 py-2 text-xs text-slate-200 shadow-[0_10px_24px_rgba(0,0,0,.35)] ${growingMode === 'outdoor' ? 'top-[216px]' : 'top-20'}`} data-tour="friend-mode-banner">
                  <span className="rounded-md bg-[#9bcf82] px-2 py-1 font-black text-[#101511]">{visitorName.slice(0, 1).toUpperCase()}</span>
                  <span><strong className="text-lime-50">{visitingFriend.historyReplay ? 'Saved game state' : `${visitorName}'s garden`}</strong> - view only</span>
                  <button
                    className="rounded-md border border-lime-100/15 bg-white/[0.055] px-2 py-1 font-semibold text-lime-100 transition hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
                    type="button"
                    onClick={leaveFriendGarden}
                  >
                    {visitorReturnLabel}
                  </button>
                </div>
              )}

              <PlantMonitorPanel
                windows={windows}
                setWindows={setWindows}
                simulationVisual={previewSimulationVisual}
                hasPlant={Boolean(selectedPlant)}
                awaitingFirstCycle={awaitingFirstCycle}
                cycleStatus={cycleStatus}
                nextCycleAt={nextSimulationTickAt}
              />
              {!visitingFriend && (
                <EnvironmentPanel
                  climate={climate}
                  setClimate={setClimate}
                  windows={windows}
                  setWindows={setWindows}
                  mode={growingMode}
                  locationLocked={Boolean(lockedOutdoorLocation)}
                  onRefreshLocation={() => setOutdoorLocationRefreshKey((current) => current + 1)}
                  outdoorWeather={outdoorWeather}
                  plantSelected={Boolean(selectedPlant)}
                />
              )}
              {!visitingFriend && <FriendsPanel windows={windows} setWindows={setWindows} user={user} onAuthRequired={openAuth} onViewFriend={viewFriendGarden} />}
              <CommentsPanel currentUser={user} onAuthRequired={openAuth} onLoadStateChange={handleFriendCommentsLoadState} simulatorId={previewSimulationVisual?.id} windows={windows} setWindows={setWindows} title={visitingFriend ? 'Friend comments' : 'Comments'} />
              <nav className="lab-mobile-panel-dock" data-tour="mobile-panel-dock" aria-label="Lab panels">
                {[
                  ['monitor', 'Plant'],
                  ['climate', 'Environment'],
                  ['comments', 'Comments'],
                  ['friends', 'Friends'],
                ].filter(([id]) => !(visitingFriend && (id === 'climate' || id === 'friends'))).map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    data-panel-target={id}
                    aria-pressed={Boolean(activeMobileLabPanel === id && windows[id]?.visible && !windows[id]?.collapsed)}
                    onClick={() => openWindow(id)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </>
          )}

          {saveHydrated && !modeLoading && pendingPlant && (
            <GrowingModePicker
              plantName={pendingPlant.name}
              onCancel={() => {
                setPendingPlant(null)
                setActionMessage(`${selectedPlant?.name ?? 'Current plant'} remains open`)
              }}
              onSelect={chooseGrowingMode}
            />
          )}
          {saveHydrated && !modeLoading && !pendingPlant && !growingMode && <GrowingModePicker onSelect={chooseGrowingMode} />}
          {(!saveHydrated || modeLoading) && <ModeLoadingOverlay mode={growingMode} />}
        </>
      )}
      </Suspense>
    </main>
  )
}

export default App
