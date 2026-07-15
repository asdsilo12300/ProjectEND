import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import './App.css'
import { defaultClimate, imageAssets } from './game/data/gameData'
import { GrowingModePicker } from './game/components/GrowingModePicker'
import { LibrarySidebar } from './game/components/LibrarySidebar'
import { TopBar } from './game/components/TopBar'
import { CommentsPanel } from './game/panels/CommentsPanel'
import { EnvironmentPanel } from './game/panels/EnvironmentPanel'
import { FriendsPanel } from './game/panels/FriendsPanel'
import { PlantMonitorPanel } from './game/panels/PlantMonitorPanel'
import { SimulationStage } from './game/scene/SimulationStage'
import { CommunityPage } from './game/community/CommunityPage'
import { HistoryPage } from './game/history/HistoryPage'
import { ShopPage } from './game/shop/ShopPage'
import { SettingsPage } from './game/settings/SettingsPage'
import { AdminPage } from './admin/AdminPage'
import { PasswordResetPage } from './game/settings/PasswordResetPage'
import { LoginPage } from './auth/LoginPage'
import { LandingPage } from './landing/LandingPage'
import { clearToken, claimMaturityReward, getFriendLatestSimulator, getLatestSimulator, getMe, getModelAssets, getPlants, getToken, getInventory, getShopItems, getSpectatorSimulator, login as loginUser, loginWithGoogle, register as registerUser, shareSimulator, startSimulator, syncSimulatorSnapshot, tickSimulator, applySimulatorItem, savePlantHistory, resolveAssetUrl, uprootSimulator } from './lib/api'
import { buildSimulationFactors, defaultSimulationVisual } from './game/utils/localSimulation'
import { climateFromForecast, fetchLocationAddress, fetchOutdoorForecast, getFixedOutdoorLocation } from './game/utils/outdoorWeather'
import { defaultWindows } from './game/utils/windows'

const initialOutdoorWeather = {
  status: 'idle',
  message: '',
  location: null,
  forecast: null,
  addressLabel: '',
}

const initialGrowthTrack = {
  progress: 0,
  history: [0, 0, 0, 0, 0, 0, 0],
}

const growthAnimationDurationMs = 1600
const autosaveIntervalMs = 10000
const simulationTickIntervalMs = 30000
const initialSimulationTickDelayMs = simulationTickIntervalMs
const simulationTickMarkerPrefix = 'plant_game_last_tick:'
const resetMarkerKey = 'plant_game_reset_marker'

const itemNameToKey = {
  'Hand Pick': 'hand-pick',
  'Insect Spray': 'insecticide-spray',
  'Snail Spray': 'snail-spray',
  'Fungus Spray': 'antifungal-spray',
}

const itemImageByKey = {
  'hand-pick': imageAssets.hand,
  'insecticide-spray': imageAssets.insecticide,
  'snail-spray': imageAssets.snailSpray,
  'antifungal-spray': imageAssets.antifungal,
}

const itemTargetsByKey = {
  'hand-pick': [{ label: 'Aphid', imageUrl: imageAssets.aphid }, { label: 'Snail', imageUrl: imageAssets.snail }],
  'insecticide-spray': [{ label: 'Aphid', imageUrl: imageAssets.aphid }],
  'snail-spray': [{ label: 'Snail', imageUrl: imageAssets.snail }],
  'antifungal-spray': [{ label: 'Fungus', imageUrl: imageAssets.fungus }],
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
    imageUrl: resolveAssetUrl(plant.base_image_url) ?? imageAssets.plant,
    modelUrl: plant.base_model_url,
    planted,
  }
}

function itemAssetFromApi(entry, quantity = null) {
  const item = entry?.item ?? entry
  const itemKey = inventoryItemKey(item)
  const meta = itemMetaByKey[itemKey] ?? {}

  return {
    id: itemKey,
    itemKey,
    backendId: item?.id,
    name: item?.name ?? 'Lab item',
    detail: meta.detail ?? item?.description ?? 'lab item',
    color: '#9bcf82',
    type: 'item',
    icon: 'hand',
    imageUrl: resolveAssetUrl(item?.image_url) ?? itemImageByKey[itemKey],
    targetImages: itemTargetsByKey[itemKey] ?? [],
    quantity: Number.isFinite(Number(quantity)) ? Number(quantity) : 0,
    quantityLabel: Number.isFinite(Number(quantity)) ? `x${quantity}` : 'x0',
    successText: meta.successText,
    failText: meta.failText,
    help: meta.help ?? item?.description,
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

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function outdoorClimateWindow(currentWindows = {}) {
  const isCompactOutdoor = window.innerWidth < 640
  const monitorY = Number(currentWindows.monitor?.y ?? defaultWindows.monitor.y)
  const monitorHeight = isCompactOutdoor ? 430 : 470

  return {
    x: isCompactOutdoor ? 16 : 258,
    y: Math.max(76, monitorY + monitorHeight + 6),
    visible: true,
    collapsed: false,
  }
}
function ModeLoadingOverlay({ mode }) {
  const label = !mode ? 'saved simulation' : mode === 'outdoor' ? 'outdoor field' : 'greenhouse lab'

  return (
    <div className="absolute inset-0 z-[90] grid place-items-center bg-black/55 px-4 backdrop-blur-md">
      <div className="rounded-lg border border-lime-100/15 bg-[#101511]/95 px-6 py-5 text-center shadow-[0_18px_44px_rgba(0,0,0,.42)]">
        <div className="mx-auto mb-3 h-1.5 w-32 overflow-hidden rounded-full bg-lime-100/10">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-[#9bcf82]" />
        </div>
        <strong className="block text-sm text-lime-50">Loading {label}</strong>
        <span className="mt-1 block text-xs text-slate-400">Preparing the simulation environment...</span>
      </div>
    </div>
  )
}

function SessionLoadingScreen() {
  return (
    <main className="relative grid h-screen w-screen place-items-center overflow-hidden bg-[#0b0f0c] px-5 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(127,176,105,.16),transparent_25%),linear-gradient(135deg,#070a08_0%,#101511_54%,#080b09_100%)]" />
      <div className="soft-grid absolute inset-0 opacity-55" />
      <div className="relative w-full max-w-sm rounded-2xl border border-lime-100/15 bg-[#101511]/95 px-7 py-8 text-center shadow-[0_24px_70px_rgba(0,0,0,.45)]">
        <div className="mx-auto mb-4 h-1.5 w-36 overflow-hidden rounded-full bg-lime-100/10">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-[#9bcf82]" />
        </div>
        <strong className="block text-sm text-lime-50">Checking your session</strong>
        <span className="mt-1 block text-xs text-slate-400">Preparing your Plant Growth Academy account...</span>
      </div>
    </main>
  )
}

function App() {
  const [windows, setWindows] = useState(defaultWindows)
  const [activeMobileLabPanel, setActiveMobileLabPanel] = useState('monitor')
  const [climate, setClimate] = useState(defaultClimate)
  const [openSections, setOpenSections] = useState({ Plants: true, Items: true })
  const [appliedAsset, setAppliedAsset] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [activePage, setActivePage] = useState('home')
  const [settingsReturnPage, setSettingsReturnPage] = useState('lab')
  const [pendingPageAfterAuth, setPendingPageAfterAuth] = useState(null)
  const [visitingFriend, setVisitingFriend] = useState(null)
  const [growingMode, setGrowingMode] = useState(null)
  const [modeLoading, setModeLoading] = useState(false)
  const [saveHydrated, setSaveHydrated] = useState(() => !getToken())
  const [resetPending, setResetPending] = useState(false)
  const [selectedPlant, setSelectedPlant] = useState(null)
  const [plantCatalog, setPlantCatalog] = useState([])
  const [modelAssets, setModelAssets] = useState({})
  const [outdoorWeather, setOutdoorWeather] = useState(initialOutdoorWeather)
  const [simulationVisual, setSimulationVisual] = useState(defaultSimulationVisual)
  const [growthTrack, setGrowthTrack] = useState(initialGrowthTrack)
  const [nextSimulationTickAt, setNextSimulationTickAt] = useState(null)
  const [cycleStatus, setCycleStatus] = useState('idle')
  const [awaitingFirstCycle, setAwaitingFirstCycle] = useState(false)
  const latestSaveLoadedRef = useRef(false)
  const autosaveStateRef = useRef({})
  const canonicalSimulationRef = useRef(defaultSimulationVisual)
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
  const [shareBusy, setShareBusy] = useState(false)

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

  const mergeCanonicalSimulator = useCallback((simulator, options = {}) => {
    if (!simulator) return null

    const next = mergeSimulatorState(canonicalSimulationRef.current, simulator, options)

    canonicalSimulationRef.current = next
    setSimulationVisual(next)
    return next
  }, [])

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
        history: [...(snapshot.growthTrack?.history ?? initialGrowthTrack.history).slice(1), progress],
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
    if (!actionMessage) return undefined

    const timeout = window.setTimeout(() => setActionMessage(''), 1800)
    return () => window.clearTimeout(timeout)
  }, [actionMessage])

  useEffect(() => {
    if (growingMode !== 'outdoor') return undefined

    let isCancelled = false

    async function syncOutdoorWeather() {
      setOutdoorWeather({ ...initialOutdoorWeather, status: 'loading', message: 'Finding fixed location' })

      try {
        const location = await getFixedOutdoorLocation()
        if (isCancelled) return

        const [addressLabel, forecast] = await Promise.all([fetchLocationAddress(location), fetchOutdoorForecast(location)])
        if (isCancelled) return

        setClimate((current) => climateFromForecast(current, forecast))
        setOutdoorWeather({
          status: 'ready',
          message: location.source === 'fallback' ? 'using fallback location' : 'synced from saved location',
          location,
          addressLabel,
          forecast,
        })
      } catch {
        if (!isCancelled) {
          setOutdoorWeather({
            ...initialOutdoorWeather,
            status: 'error',
            message: 'weather unavailable',
          })
        }
      }
    }

    syncOutdoorWeather()

    return () => {
      isCancelled = true
    }
  }, [growingMode])

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
    if (!growingMode || !selectedPlant || modeLoading) return undefined

    const targetProgress = clampSimulationProgress(simulationVisual.growth_point)
    const animationStartedAt = performance.now()
    let startingProgress = null
    let lastHistoryAt = animationStartedAt
    let interval = null

    function animateCanonicalGrowth() {
      const now = performance.now()
      const ratio = Math.min(1, Math.max(0, (now - animationStartedAt) / growthAnimationDurationMs))
      const easedRatio = 1 - ((1 - ratio) ** 3)

      setGrowthTrack((current) => {
        if (startingProgress === null) startingProgress = current.progress

        const nextProgress = clampSimulationProgress(startingProgress + ((targetProgress - startingProgress) * easedRatio))
        const roundedProgress = ratio >= 1 ? targetProgress : Number(nextProgress.toFixed(2))
        const shouldRecordHistory = ratio >= 1 || now - lastHistoryAt >= 240
        const nextHistory = shouldRecordHistory ? [...current.history.slice(1), roundedProgress] : current.history
        if (shouldRecordHistory) lastHistoryAt = now

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
  }, [growingMode, modeLoading, selectedPlant, simulationVisual.growth_point])

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
    const plantedPlantId = selectedPlant?.backendId ?? simulationVisual?.plant?.id ?? null
    const plants = plantCatalog.map((plant) => plantAssetFromApi(plant, plantedPlantId === plant.id))
    const inventoryItemsByKey = new Map(inventoryItems.map((entry) => [inventoryItemKey(entry), entry]))
    const itemSource = [
      ...shopCatalog.map((shopItem) => shopItem.item).filter(Boolean),
      ...inventoryItems.map((entry) => entry.item).filter(Boolean),
    ]
    const uniqueItems = Array.from(new Map(itemSource.map((item) => [inventoryItemKey(item), item])).values())
    const items = uniqueItems.map((item) => {
      const key = inventoryItemKey(item)
      const inventoryEntry = inventoryItemsByKey.get(key)
      return itemAssetFromApi(item, inventoryEntry?.quantity ?? 0)
    })

    return {
      Plants: plants,
      Items: items,
    }
  }, [inventoryItems, plantCatalog, selectedPlant, shopCatalog, simulationVisual?.plant?.id])

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

    if (!user || !getToken()) {
      return undefined
    }

    getInventory()
      .then((payload) => {
        if (!cancelled) setInventoryItems(payload.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setInventoryItems([])
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
    function handleExpiredSession() {
      const simulatorId = window.localStorage.getItem('plant_game_simulator_id')
      accountSessionRef.current += 1
      spectatorRequestRef.current += 1
      latestSaveLoadedRef.current = false
      autosaveStateRef.current = {}
      if (simulatorId) window.localStorage.removeItem(`${simulationTickMarkerPrefix}${simulatorId}`)
      window.localStorage.removeItem('plant_game_simulator_id')
      window.localStorage.removeItem(resetMarkerKey)
      setUser(null)
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

  const selectedItemCursorUrl = appliedAsset?.type === 'item' && !visitingFriend ? appliedAsset.imageUrl : null
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
    setAppliedAsset(restoredPlant)
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
      temp: Number(simulator.air_temp ?? defaultClimate.temp),
    })
    setGrowthTrack({
      progress: restoredProgress,
      history: [0, 0, 0, 0, 0, 0, restoredProgress],
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

  const buildSaveSnapshot = useCallback(() => {
    const state = autosaveStateRef.current
    const factors = buildSimulationFactors(state.climate ?? defaultClimate, state.outdoorWeather ?? initialOutdoorWeather)
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

      const factors = buildSimulationFactors(state.climate ?? defaultClimate, state.outdoorWeather ?? initialOutdoorWeather)
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
  }, [enqueueSimulationMutation, mergeCanonicalSimulator, persistCurrentSimulation, previewSimulationVisual?.growth_point, previewSimulationVisual?.id, previewSimulationVisual?.maturity_reward_claimed_at, selectedPlant, stashOwnGardenSimulator, user, visitingFriend])
  useEffect(() => {
    if (!user || latestSaveLoadedRef.current) return undefined

    let isCancelled = false
    let retryTimeout = null
    latestSaveLoadedRef.current = true

    async function restoreLatestSave() {
      try {
        const payload = await getLatestSimulator()
        const simulator = payload.data ?? null
        const resetMarked = Boolean(window.localStorage.getItem(resetMarkerKey))

        if (!isCancelled && resetMarked) {
          try {
            if (simulator?.id) {
              await uprootSimulator(simulator.id)
            }
            if (isCancelled) return

            if (simulator?.id) window.localStorage.removeItem(`${simulationTickMarkerPrefix}${simulator.id}`)
            window.localStorage.removeItem(resetMarkerKey)
            window.localStorage.removeItem('plant_game_simulator_id')
            setGrowingMode(null)
            setSelectedPlant(null)
            canonicalSimulationRef.current = defaultSimulationVisual
            setSimulationVisual(defaultSimulationVisual)
            setGrowthTrack(initialGrowthTrack)
            setAwaitingFirstCycle(false)
            setCycleStatus('idle')
            setNextSimulationTickAt(null)
            setActionMessage('Reset complete. Choose a growing mode.')
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
          setActionMessage('Latest simulation restored')
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
  }, [applySimulatorSnapshot, user])

  useEffect(() => {
    const simulatorId = simulationVisual?.id ?? window.localStorage.getItem('plant_game_simulator_id')
    if (!simulatorId || !selectedPlant || !growingMode || visitingFriend || !getToken() || simulationVisual?.status !== 'active') {
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
  }, [growingMode, runSimulationTick, selectedPlant, simulationVisual?.id, simulationVisual?.status, visitingFriend])

  useEffect(() => {
    if (!selectedPlant || !growingMode || !getToken()) return undefined

    const interval = window.setInterval(() => {
      persistCurrentSimulation({ silent: true, background: true }).catch(() => {})
    }, autosaveIntervalMs)

    return () => window.clearInterval(interval)
  }, [growingMode, persistCurrentSimulation, selectedPlant])

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

      if (id === 'friends') {
        return {
          ...value,
          [id]: {
            ...value[id],
            x: Math.max(24, window.innerWidth - 350),
            y: Math.max(76, window.innerHeight - 380),
            visible: true,
            collapsed: false,
          },
        }
      }

      if (id === 'comments') {
        return {
          ...value,
          [id]: {
            ...value[id],
            x: Math.max(24, window.innerWidth - 400),
            y: window.innerHeight >= 820 ? 88 : 144,
            visible: true,
            collapsed: false,
          },
        }
      }

      return { ...value, [id]: { ...value[id], visible: true, collapsed: false } }
    })
  }

  function toggleLibrarySection(section) {
    setOpenSections((value) => ({ ...value, [section]: !value[section] }))
  }

  async function applySelectedItem() {
    const asset = appliedAsset?.type === 'item' ? appliedAsset : null
    if (!asset) return

    if (visitingFriend) {
      setActionMessage('Friend tools are view-only for now')
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

    setActionMessage(`Using ${asset.name}...`)

    try {
      const accountSession = accountSessionRef.current
      const payload = await enqueueSimulationMutation(async () => {
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

        return applySimulatorItem(simulatorId, asset.itemKey ?? asset.id)
      })
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

      if (simulator) mergeCanonicalSimulator(simulator, { preservePestRisks: true })

      setAppliedAsset(null)
      setActionMessage(result.message ?? `${asset.name} applied`)
    } catch (error) {
      setActionMessage(error.message || 'Unable to use this item')
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
        setActionMessage('Friend tools are view-only for now')
        return
      }

      setActionMessage(`Selected ${asset.name}. Click a pest to use it.`)
      return
    }

    setAppliedAsset(asset)

    if (asset.type === 'plant') {
      if (selectedPlant) {
        setActionMessage('A plant is already growing. Reset before planting again.')
        return
      }

      const apiPlant = plantCatalog.find((plant) => plant.id === asset.backendId) ?? null
      const fallbackModelUrl = apiPlant?.base_model_url ?? modelAssets['plant.original']?.url ?? defaultSimulationVisual.current_model_url

      if (!apiPlant) {
        setActionMessage('Plant data is missing from the database. Please seed plants first.')
        return
      }

      setResetPending(false)
      setAwaitingFirstCycle(true)
      setCycleStatus('idle')
      setNextSimulationTickAt(null)
      setSelectedPlant(asset)
      setGrowthTrack(initialGrowthTrack)
      setActiveMobileLabPanel('monitor')
      setWindows((value) => ({
        ...value,
        monitor: { ...value.monitor, visible: true, collapsed: false },
        climate: { ...value.climate, visible: true, collapsed: true },
        friends: { ...value.friends, visible: true, collapsed: true },
        comments: { ...value.comments, visible: true, collapsed: true },
      }))
      const pendingSimulation = {
        ...defaultSimulationVisual,
        current_model_url: fallbackModelUrl,
      }
      canonicalSimulationRef.current = pendingSimulation
      setSimulationVisual(pendingSimulation)
      setActionMessage('Creating simulation save...')

      if (getToken() && growingMode) {
        try {
          const accountSession = accountSessionRef.current
          const simulatorPayload = await startSimulator(apiPlant.id, growingMode, {
            location_name: outdoorWeather.addressLabel || undefined,
            latitude: outdoorWeather.location?.latitude,
            longitude: outdoorWeather.location?.longitude,
          })
          if (accountSession !== accountSessionRef.current || !getToken()) return

          const simulator = simulatorPayload.data ?? simulatorPayload
          window.localStorage.removeItem(resetMarkerKey)
          window.localStorage.setItem('plant_game_simulator_id', String(simulator.id))
          mergeCanonicalSimulator({ ...simulator, current_model_url: simulator.current_model_url ?? fallbackModelUrl })
          setGrowthTrack({ progress: clampSimulationProgress(simulator.growth_point ?? 0), history: [0, 0, 0, 0, 0, 0, clampSimulationProgress(simulator.growth_point ?? 0)] })
          setActionMessage(`${asset.name} saved to your account`)
        } catch (error) {
          window.localStorage.removeItem('plant_game_simulator_id')
          canonicalSimulationRef.current = defaultSimulationVisual
          setAppliedAsset(null)
          setSelectedPlant(null)
          setSimulationVisual(defaultSimulationVisual)
          setGrowthTrack(initialGrowthTrack)
          setAwaitingFirstCycle(false)
          setCycleStatus('idle')
          setNextSimulationTickAt(null)
          setActionMessage(error.message || `Unable to plant ${asset.name}`)
        }
      } else {
        window.localStorage.removeItem('plant_game_simulator_id')
        canonicalSimulationRef.current = defaultSimulationVisual
        setAppliedAsset(null)
        setSelectedPlant(null)
        setSimulationVisual(defaultSimulationVisual)
        setGrowthTrack(initialGrowthTrack)
        setAwaitingFirstCycle(false)
        setCycleStatus('idle')
        setNextSimulationTickAt(null)
        setActionMessage('Log in before planting')
        openAuth('login')
      }
    }
  }

  async function chooseGrowingMode(mode) {
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
    guidedWindows.climate = { ...guidedWindows.climate, collapsed: true }
    guidedWindows.comments = { ...guidedWindows.comments, collapsed: true }
    guidedWindows.friends = { ...guidedWindows.friends, collapsed: true }

    if (mode === 'outdoor') {
      guidedWindows.climate = {
        ...guidedWindows.climate,
        ...outdoorClimateWindow(guidedWindows),
        collapsed: true,
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
        const payload = await savePlantHistory(historySimulatorId, { visibility: historyVisibility, snapshot_image_data: snapshotImageData })
        const history = payload.data ?? payload
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
    window.localStorage.setItem(resetMarkerKey, String(Date.now()))
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
    setActivePage('lab')
    setWindows((value) => ({
      ...value,
      comments: { ...value.comments, x: Math.max(24, window.innerWidth - 400), y: window.innerHeight >= 820 ? 88 : 144, visible: true, collapsed: false },
      monitor: { ...value.monitor, visible: true, collapsed: false },
      climate: { ...value.climate, visible: false },
      friends: { ...value.friends, visible: false },
    }))
    setActionMessage(`Loading ${friend?.user?.username ?? 'friend'}'s plant...`)

    try {
      const cachedSimulator = friend.latest_simulator ?? null
      const payload = cachedSimulator ? { data: cachedSimulator } : await getFriendLatestSimulator(friend.id)
      const candidate = payload.data ?? null
      const livePayload = candidate?.id ? await getSpectatorSimulator(candidate.id) : null
      const simulator = livePayload?.data ?? livePayload ?? null

      if (spectatorRequestRef.current !== requestId) return

      if (simulator) {
        setVisitingFriend((current) => ({ ...current, simulatorId: simulator.id }))
        applySimulatorSnapshot(simulator, { persistLocalId: false })
        setActionMessage(`Viewing ${friend?.user?.username ?? 'friend'}'s plant`)
      } else {
        setSelectedPlant(null)
        canonicalSimulationRef.current = defaultSimulationVisual
        setSimulationVisual(defaultSimulationVisual)
        setGrowthTrack(initialGrowthTrack)
        setActionMessage(`${friend?.user?.username ?? 'Friend'} has no active plant yet`)
      }
    } catch (error) {
      if (spectatorRequestRef.current !== requestId) return
      setSelectedPlant(null)
      canonicalSimulationRef.current = defaultSimulationVisual
      setSimulationVisual(defaultSimulationVisual)
      setGrowthTrack(initialGrowthTrack)
      setActionMessage(error.message || 'Unable to load this friend plant')
    }
  }

  async function viewCommunityGame(post) {
    const liveSimulator = post?.live_simulator
    const savedSimulator = post?.plant_history?.game_state?.simulator
    const owner = post?.user ?? null

    if (!liveSimulator?.id && !savedSimulator) {
      setActionMessage('This game state is not available.')
      return
    }

    const requestId = spectatorRequestRef.current + 1
    spectatorRequestRef.current = requestId

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
      autosaveStateRef.current = { ...autosaveStateRef.current, visitingFriend: { user: owner, simulatorId: liveSimulator.id, source: 'community' } }
      setVisitingFriend({ user: owner, simulatorId: liveSimulator.id, source: 'community' })
      setActionMessage('Connecting to the live garden...')
      try {
        const payload = await getSpectatorSimulator(liveSimulator.id)
        if (spectatorRequestRef.current !== requestId) return
        applySimulatorSnapshot(payload.data ?? payload, { persistLocalId: false })
        setActionMessage(`Watching ${owner?.username ?? 'this learner'} live`)
      } catch (error) {
        if (spectatorRequestRef.current !== requestId) return
        leaveFriendGarden()
        setActionMessage(error.status === 410 ? 'This garden is no longer live.' : (error.message || 'Unable to open this live garden'))
      }
      return
    }

    if (savedSimulator) {
      autosaveStateRef.current = { ...autosaveStateRef.current, visitingFriend: { user: owner ?? user, historyReplay: true, historyId: post?.plant_history?.id } }
      setVisitingFriend({ user: owner ?? user, historyReplay: true, historyId: post?.plant_history?.id })
      applySimulatorSnapshot(savedSimulator, { persistLocalId: false })
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

    viewCommunityGame({ plant_history: save, user })
  }

  const leaveFriendGarden = useCallback(() => {
    const snapshot = ownGardenSnapshotRef.current
    spectatorRequestRef.current += 1
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
    setActionMessage('Back to your garden')
  }, [])

  useEffect(() => {
    const simulatorId = visitingFriend?.simulatorId
    if (!simulatorId || visitingFriend?.historyReplay) return undefined

    let cancelled = false
    let requestRunning = false

    async function refreshSpectatorState() {
      if (requestRunning) return
      requestRunning = true
      try {
        const payload = await getSpectatorSimulator(simulatorId)
        if (!cancelled) applySimulatorSnapshot(payload.data ?? payload, { persistLocalId: false })
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
  }, [applySimulatorSnapshot, leaveFriendGarden, visitingFriend?.historyReplay, visitingFriend?.simulatorId, visitingFriend?.user?.username])

  function navigateToPage(page) {
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

  function logoutUser() {
    clearToken()
    clearClientSimulationSession()
    setUser(null)
    setSessionStatus('guest')
    setProfileOpen(false)
    setAuthMode('login')
    setAuthStatus('idle')
    setAuthError('')
    setAuthForm({ username: '', email: '', password: '', passwordConfirmation: '' })
    setPendingPageAfterAuth(null)
    setActivePage('auth')
  }

  const labReady = Boolean(saveHydrated && growingMode && !modeLoading)
  const availablePlantName = labSections.Plants?.[0]?.name ?? 'a plant'
  const visitorName = visitingFriend?.user?.username ?? visitingFriend?.user?.email?.split('@')[0] ?? 'Friend'

  if (sessionStatus === 'checking') {
    return <SessionLoadingScreen />
  }

  if (activePage === 'home' || activePage === 'learn') {
    return (
      <LandingPage
        page={activePage}
        user={user}
        onHome={() => openLanding('home')}
        onLearn={() => openLanding('learn')}
        onStart={enterGameFromLanding}
        onSignIn={() => openAuth('login')}
        onOpenPage={openGamePageFromLanding}
      />
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

    return <AdminPage user={user} onLogout={logoutUser} />
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b0f0c] text-slate-100" data-mobile-lab-panel={activeMobileLabPanel}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(127,176,105,.16),transparent_25%),linear-gradient(135deg,#070a08_0%,#101511_54%,#080b09_100%)]" />
      <div className="soft-grid absolute inset-0 opacity-55" />

      <TopBar activePage={activePage} coinBalance={user?.coin ?? 0} coinDelta={coinDelta} onNavigate={navigateToPage} openWindow={openWindow} profileOpen={profileOpen} setProfileOpen={setProfileOpen} user={user} onAuthRequired={openAuth} onLogout={logoutUser} />
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
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {activePage === 'shop' ? (
        <ShopPage onInventoryItemChange={upsertInventoryItem} onUserUpdate={setUser} />
      ) : activePage === 'history' ? (
        <HistoryPage onOpenGameState={viewSavedGameState} onStartGrowing={() => navigateToPage('lab')} />
      ) : activePage === 'community' ? (
        <CommunityPage currentUser={user} onOpenGame={viewCommunityGame} onUserChange={setUser} />
      ) : activePage === 'settings' ? (
        <SettingsPage
          backLabel={`Back to ${settingsReturnPage === 'lab' ? 'Plant Lab' : settingsReturnPage[0].toUpperCase() + settingsReturnPage.slice(1)}`}
          user={user}
          onBack={() => navigateToPage(settingsReturnPage)}
          onResetPassword={() => navigateToPage('password-reset')}
        />
      ) : activePage === 'password-reset' ? (
        <PasswordResetPage user={user} onBack={() => navigateToPage('settings')} onDone={() => navigateToPage('settings')} />
      ) : (
        <>
          {labReady && (
            <>
              <LibrarySidebar plantLocked={Boolean(selectedPlant) || Boolean(visitingFriend)} readOnly={Boolean(visitingFriend)} mockItems={Boolean(visitingFriend)} selectedAsset={appliedAsset} inventoryMap={inventoryMap} sections={labSections} openSections={openSections} onToggle={toggleLibrarySection} onApply={applyLabAsset} />
              <SimulationStage
                actionMessage={actionMessage}
                coinBurst={coinBurst}
                expBurst={expBurst}
                mode={growingMode}
                plantSelected={Boolean(selectedPlant)}
                availablePlantName={availablePlantName}
                awaitingFirstCycle={awaitingFirstCycle}
                cycleStatus={cycleStatus}
                nextCycleAt={nextSimulationTickAt}
                selectedItemCursorUrl={selectedItemCursorUrl}
                onUseSelectedItem={applySelectedItem}
                readOnly={Boolean(visitingFriend)}
                shareBusy={shareBusy}
                shareVisibility={previewSimulationVisual?.share_visibility ?? 'private'}
                toggleLiveShare={toggleLiveShare}
                resetSimulation={resetSimulation}
                saveSimulation={saveSimulation}
                sceneAssets={modelAssets}
                simulationVisual={previewSimulationVisual}
                snapshotRef={stageSnapshotRef}
              />

              {visitingFriend && (
                <div className="absolute left-1/2 top-20 z-30 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-lime-100/15 bg-[#101511]/90 px-3 py-2 text-xs text-slate-200 shadow-[0_10px_24px_rgba(0,0,0,.35)]">
                  <span className="rounded-md bg-[#9bcf82] px-2 py-1 font-black text-[#101511]">{visitorName.slice(0, 1).toUpperCase()}</span>
                  <span><strong className="text-lime-50">{visitingFriend.historyReplay ? 'Saved game state' : `${visitorName}'s plant`}</strong> - view only</span>
                  <button
                    className="rounded-md border border-lime-100/15 bg-white/[0.055] px-2 py-1 font-semibold text-lime-100 transition hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
                    type="button"
                    onClick={leaveFriendGarden}
                  >
                    Back to my garden
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
                  outdoorWeather={outdoorWeather}
                  plantSelected={Boolean(selectedPlant)}
                />
              )}
              {!visitingFriend && <FriendsPanel windows={windows} setWindows={setWindows} user={user} onAuthRequired={openAuth} onViewFriend={viewFriendGarden} />}
              <CommentsPanel currentUser={user} onAuthRequired={openAuth} simulatorId={previewSimulationVisual?.id} windows={windows} setWindows={setWindows} title={visitingFriend ? 'Friend comments' : 'Comments'} />
              <nav className="lab-mobile-panel-dock" aria-label="Lab panels">
                {[
                  ['monitor', 'Plant'],
                  ['climate', 'Environment'],
                  ['comments', 'Comments'],
                  ['friends', 'Friends'],
                ].filter(([id]) => !(visitingFriend && (id === 'climate' || id === 'friends'))).map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    aria-pressed={Boolean(activeMobileLabPanel === id && windows[id]?.visible && !windows[id]?.collapsed)}
                    onClick={() => openWindow(id)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </>
          )}

          {saveHydrated && !growingMode && <GrowingModePicker onSelect={chooseGrowingMode} />}
          {(!saveHydrated || modeLoading) && <ModeLoadingOverlay mode={growingMode} />}
        </>
      )}
    </main>
  )
}

export default App






