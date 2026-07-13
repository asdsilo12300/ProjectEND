import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { PasswordResetPage } from './game/settings/PasswordResetPage'
import { LoginPage } from './auth/LoginPage'
import { clearToken, claimMaturityReward, finishSimulator, getFriendLatestSimulator, getLatestSimulator, getMe, getModelAssets, getPlants, getToken, getInventory, getShopItems, getSpectatorSimulator, login as loginUser, loginWithGoogle, register as registerUser, shareSimulator, startSimulator, syncSimulatorSnapshot, applySimulatorItem, savePlantHistory, resolveAssetUrl, uprootSimulator } from './lib/api'
import { buildSimulationFactors, defaultSimulationVisual, evaluateLocalSimulation } from './game/utils/localSimulation'
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

const growthAnimationScale = 100
const autosaveIntervalMs = 5000
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
    quantityLabel: Number.isFinite(Number(quantity)) ? `x${quantity}` : 'x0',
    successText: meta.successText,
    failText: meta.failText,
    help: meta.help ?? item?.description,
  }
}

function getStageForGrowth(progress) {
  if (progress >= 100) return { stage_no: 4, stage_name: 'Mature', required_growth_point: 100 }
  if (progress >= 60) return { stage_no: 3, stage_name: 'Young Plant', required_growth_point: 60 }
  if (progress >= 25) return { stage_no: 2, stage_name: 'Sprout', required_growth_point: 25 }
  return { stage_no: 1, stage_name: 'Seedling', required_growth_point: 0 }
}

function clampSimulationProgress(value) {
  return Math.min(100, Math.max(0, Number(value) || 0))
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
  const [climate, setClimate] = useState(defaultClimate)
  const [openSections, setOpenSections] = useState({ Plants: true, Items: true })
  const [appliedAsset, setAppliedAsset] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [activePage, setActivePage] = useState('lab')
  const [visitingFriend, setVisitingFriend] = useState(null)
  const [growingMode, setGrowingMode] = useState(null)
  const [modeLoading, setModeLoading] = useState(false)
  const [saveHydrated, setSaveHydrated] = useState(() => !getToken())
  const [resetPending, setResetPending] = useState(false)
  const [selectedPlant, setSelectedPlant] = useState(null)
  const [, setSuppressedPests] = useState([])
  const [plantCatalog, setPlantCatalog] = useState([])
  const [modelAssets, setModelAssets] = useState({})
  const [outdoorWeather, setOutdoorWeather] = useState(initialOutdoorWeather)
  const [simulationVisual, setSimulationVisual] = useState(defaultSimulationVisual)
  const [growthTrack, setGrowthTrack] = useState(initialGrowthTrack)
  const lastGrowthAtRef = useRef(0)
  const latestSaveLoadedRef = useRef(false)
  const autosaveStateRef = useRef({})
  const isResettingRef = useRef(false)
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

    let historyElapsed = 0
    lastGrowthAtRef.current = Date.now()

    function advanceGrowth() {
      const now = Date.now()
      const elapsed = Math.min(3600, Math.max(0, (now - lastGrowthAtRef.current) / 1000))
      lastGrowthAtRef.current = now
      historyElapsed += elapsed

      const factors = buildSimulationFactors(climate, outdoorWeather)
      const evaluation = evaluateLocalSimulation(factors)
      const cycleGrowth = Math.max(0, Number(evaluation.growth_point) || 0)
      const shouldRecordHistory = historyElapsed >= 0.6
      if (shouldRecordHistory) historyElapsed = 0

      setGrowthTrack((current) => {
        const nextProgress =
          current.progress >= 100 || cycleGrowth <= 0
            ? current.progress
            : Math.min(100, current.progress + (cycleGrowth / growthAnimationScale) * elapsed)
        const roundedProgress = Number(nextProgress.toFixed(2))
        const nextHistory = shouldRecordHistory ? [...current.history.slice(1), roundedProgress] : current.history

        if (roundedProgress === current.progress && nextHistory === current.history) return current

        return {
          progress: roundedProgress,
          history: nextHistory,
        }
      })
    }

    const interval = window.setInterval(advanceGrowth, 160)

    function catchUpGrowth() {
      advanceGrowth()
    }

    document.addEventListener('visibilitychange', catchUpGrowth)
    window.addEventListener('focus', catchUpGrowth)
    window.addEventListener('pageshow', catchUpGrowth)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', catchUpGrowth)
      window.removeEventListener('focus', catchUpGrowth)
      window.removeEventListener('pageshow', catchUpGrowth)
    }
  }, [climate, growingMode, modeLoading, outdoorWeather, selectedPlant])

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

    const factors = buildSimulationFactors(climate, outdoorWeather)
    const preview = evaluateLocalSimulation(factors)
    const progress = clampSimulationProgress(growthTrack.progress)

    return {
      ...simulationVisual,
      growth_point: progress,
      growth_history: growthTrack.history,
      growth_rate: preview.growth_point,
      current_stage: getStageForGrowth(progress),
      visual_state: preview.visual_state,
      visual_overrides: preview.visual_overrides,
      pest_risks: preview.pest_risks,
      active_pests: preview.active_pests,
      current_model_url: simulationVisual.current_model_url ?? preview.current_model_url,
    }
  }, [climate, growingMode, growthTrack, outdoorWeather, selectedPlant, simulationVisual])
  useEffect(() => {
    autosaveStateRef.current = {
      climate,
      growingMode,
      growthTrack,
      outdoorWeather,
      previewSimulationVisual,
      selectedPlant,
    }
  })
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
      accountSessionRef.current += 1
      spectatorRequestRef.current += 1
      latestSaveLoadedRef.current = false
      autosaveStateRef.current = {}
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
    setSuppressedPests([])
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
    setSimulationVisual({
      ...defaultSimulationVisual,
      ...simulator,
      growth_point: restoredProgress,
      current_model_url: simulator.current_model_url ?? defaultSimulationVisual.current_model_url,
    })
  }, [])

  const buildSaveSnapshot = useCallback(() => {
    const state = autosaveStateRef.current
    const factors = buildSimulationFactors(state.climate ?? defaultClimate, state.outdoorWeather ?? initialOutdoorWeather)
    const visual = state.previewSimulationVisual ?? defaultSimulationVisual
    const track = state.growthTrack ?? initialGrowthTrack

    return {
      ...factors,
      growth_point: clampSimulationProgress(visual.growth_point ?? track.progress),
      health: Math.round(Number(visual.health ?? 100)),
      visual_state: visual.visual_state ?? 'healthy',
      visual_overrides: visual.visual_overrides ?? {},
      analysis_result: visual.analysis_result ?? 'Current simulation state saved.',
      direction: visual.direction ?? 'Continue from the latest saved state.',
    }
  }, [])

  const persistCurrentSimulation = useCallback(async (options = {}) => {
    const simulatorId = window.localStorage.getItem('plant_game_simulator_id')
    const state = autosaveStateRef.current
    const accountSession = accountSessionRef.current

    if (visitingFriend || isResettingRef.current || window.localStorage.getItem(resetMarkerKey) || !simulatorId || !getToken() || !state.selectedPlant || !state.growingMode) {
      return null
    }

    const payload = await syncSimulatorSnapshot(simulatorId, buildSaveSnapshot(), { keepalive: options.keepalive })
    if (accountSession !== accountSessionRef.current || !getToken()) return null

    const simulator = payload.data ?? payload

    if (!options.silent && simulator) {
      setSimulationVisual({
        ...defaultSimulationVisual,
        ...simulator,
        current_model_url: simulator.current_model_url ?? autosaveStateRef.current.previewSimulationVisual?.current_model_url ?? defaultSimulationVisual.current_model_url,
      })
    }

    return simulator
  }, [buildSaveSnapshot, visitingFriend])

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

        const payload = await claimMaturityReward(simulatorId)
        const reward = payload.data ?? payload
        const amount = Number(reward.amount ?? 0)

        if (reward.simulator) {
          setSimulationVisual((current) => ({
            ...current,
            ...reward.simulator,
            current_model_url: reward.simulator.current_model_url ?? current.current_model_url ?? defaultSimulationVisual.current_model_url,
          }))
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
  }, [persistCurrentSimulation, previewSimulationVisual?.growth_point, previewSimulationVisual?.id, previewSimulationVisual?.maturity_reward_claimed_at, selectedPlant, user, visitingFriend])
  useEffect(() => {
    if (!user || latestSaveLoadedRef.current) return undefined

    let isCancelled = false
    latestSaveLoadedRef.current = true

    async function restoreLatestSave() {
      try {
        const payload = await getLatestSimulator()
        const simulator = payload.data ?? null
        const resetMarked = Boolean(window.localStorage.getItem(resetMarkerKey))

        if (!isCancelled && resetMarked) {
          if (simulator?.id) {
            finishSimulator(simulator.id).catch(() => {})
          }
          window.localStorage.removeItem('plant_game_simulator_id')
          setGrowingMode(null)
          setSelectedPlant(null)
          setSimulationVisual(defaultSimulationVisual)
          setGrowthTrack(initialGrowthTrack)
          setActionMessage('Reset complete. Choose a growing mode.')
          setSaveHydrated(true)
          return
        }

        if (!isCancelled && simulator) {
          applySimulatorSnapshot(simulator)
          setActionMessage('Latest simulation restored')
        }
        if (!isCancelled) setSaveHydrated(true)
      } catch {
        latestSaveLoadedRef.current = false
        if (!isCancelled) setSaveHydrated(true)
      }
    }

    restoreLatestSave()

    return () => {
      isCancelled = true
    }
  }, [applySimulatorSnapshot, user])

  useEffect(() => {
    if (!selectedPlant || !growingMode || !getToken()) return undefined

    const interval = window.setInterval(() => {
      persistCurrentSimulation({ silent: true }).catch(() => {})
    }, autosaveIntervalMs)

    return () => window.clearInterval(interval)
  }, [growingMode, persistCurrentSimulation, selectedPlant])

  useEffect(() => {
    function saveBeforeLeaving() {
      persistCurrentSimulation({ silent: true, keepalive: true }).catch(() => {})
    }

    window.addEventListener('pagehide', saveBeforeLeaving)
    window.addEventListener('beforeunload', saveBeforeLeaving)

    return () => {
      window.removeEventListener('pagehide', saveBeforeLeaving)
      window.removeEventListener('beforeunload', saveBeforeLeaving)
    }
  }, [persistCurrentSimulation])
  function openWindow(id) {
    setWindows((value) => {
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
      const payload = await applySimulatorItem(simulatorId, asset.itemKey ?? asset.id)
      const result = payload.data ?? payload
      const simulator = result.simulator ?? null
      const targets = result.removed_pests ?? []

      if (result.inventory) {
        upsertInventoryItem(result.inventory)
      }

      if (targets.length) {
        setSuppressedPests((current) => [...new Set([...current, ...targets])])
      }

      if (simulator) {
        setSimulationVisual({
          ...defaultSimulationVisual,
          ...simulator,
          current_model_url: simulator.current_model_url ?? simulationVisual.current_model_url ?? defaultSimulationVisual.current_model_url,
        })
      }

      setAppliedAsset(null)
      setActionMessage(result.message ?? `${asset.name} applied`)
    } catch (error) {
      setActionMessage(error.message || 'Unable to use this item')
    }
  }

  async function applyLabAsset(asset) {
    if (asset.type === 'item') {
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
      setSuppressedPests([])
      setSelectedPlant(asset)
      setGrowthTrack(initialGrowthTrack)
      setSimulationVisual({
        ...defaultSimulationVisual,
        current_model_url: fallbackModelUrl,
      })
      setActionMessage('Creating simulation save...')

      if (getToken() && growingMode) {
        try {
          const simulatorPayload = await startSimulator(apiPlant.id, growingMode, {
            location_name: outdoorWeather.addressLabel || undefined,
            latitude: outdoorWeather.location?.latitude,
            longitude: outdoorWeather.location?.longitude,
          })
          const simulator = simulatorPayload.data ?? simulatorPayload
          window.localStorage.removeItem(resetMarkerKey)
          window.localStorage.setItem('plant_game_simulator_id', String(simulator.id))
          setSimulationVisual({
            ...defaultSimulationVisual,
            ...simulator,
            current_model_url: simulator.current_model_url ?? fallbackModelUrl,
          })
          setGrowthTrack({ progress: clampSimulationProgress(simulator.growth_point ?? 0), history: [0, 0, 0, 0, 0, 0, clampSimulationProgress(simulator.growth_point ?? 0)] })
          setActionMessage(`${asset.name} saved to your account`)
        } catch {
          window.localStorage.removeItem('plant_game_simulator_id')
          setActionMessage(`${asset.name} selected locally`)
        }
      } else {
        window.localStorage.removeItem('plant_game_simulator_id')
        setActionMessage(`${asset.name} selected locally`)
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

    if (mode === 'outdoor') {
      setWindows((value) => ({
        ...value,
        climate: {
          ...value.climate,
          ...outdoorClimateWindow(value),
        },
      }))
    } else {
      setOutdoorWeather(initialOutdoorWeather)
    }

    try {
      const payload = await getPlants()
      const plants = payload.data ?? payload
      setPlantCatalog(plants)
      setSimulationVisual(defaultSimulationVisual)
      window.localStorage.removeItem('plant_game_simulator_id')
    } catch {
      window.localStorage.removeItem('plant_game_simulator_id')
    }

    const remainingLoadingTime = 800 - (Date.now() - loadingStartedAt)
    if (remainingLoadingTime > 0) await wait(remainingLoadingTime)
    setModeLoading(false)
    setActionMessage('Select a plant to load the model')
  }

  async function saveSimulation() {
    const simulatorId = window.localStorage.getItem('plant_game_simulator_id')

    if (resetPending) {
      try {
        if (simulatorId && getToken()) {
          await finishSimulator(simulatorId)
        }
      } finally {
        window.localStorage.removeItem('plant_game_simulator_id')
        latestSaveLoadedRef.current = false
        setResetPending(false)
        setGrowingMode(null)
        setModeLoading(false)
        setSaveHydrated(true)
        setClimate({ ...defaultClimate })
        setOutdoorWeather(initialOutdoorWeather)
        setAppliedAsset(null)
        setSuppressedPests([])
        setSimulationVisual(defaultSimulationVisual)
        setGrowthTrack(initialGrowthTrack)
        setSelectedPlant(null)
        setActionMessage('Reset saved. Choose a new growing mode.')
      }
      return
    }

    try {
      const snapshotImageData = stageSnapshotRef.current?.capture?.() ?? null
      const simulator = await persistCurrentSimulation({ silent: false })
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
        await finishSimulator(historySimulatorId)
        window.localStorage.removeItem('plant_game_simulator_id')
        window.localStorage.removeItem('plantsim-scenario')
        latestSaveLoadedRef.current = false
        setResetPending(false)
        setSaveReadyForNewPlant(true)
        setSaveCompleteHistory(history)
        setActionMessage('Saved to history')
      } else {
        setActionMessage('Saved locally')
      }

      setResetPending(false)
    } catch (error) {
      setActionMessage(error.message || 'Unable to save history')
    }
  }

  async function toggleLiveShare() {
    const simulatorId = previewSimulationVisual?.id ?? window.localStorage.getItem('plant_game_simulator_id')
    if (!simulatorId || !selectedPlant || visitingFriend || shareBusy) return

    const previousVisibility = previewSimulationVisual?.share_visibility ?? 'private'
    const visibility = previousVisibility === 'private' ? 'public' : 'private'
    setShareBusy(true)
    setSimulationVisual((current) => ({ ...current, share_visibility: visibility }))

    try {
      const snapshotImageData = visibility === 'private' ? null : stageSnapshotRef.current?.capture?.() ?? null
      const payload = await shareSimulator(simulatorId, visibility, '', snapshotImageData)
      const simulator = payload.data ?? payload
      setSimulationVisual((current) => ({ ...current, ...simulator, current_model_url: simulator.current_model_url ?? current.current_model_url }))
      setActionMessage(visibility === 'private' ? 'Live sharing stopped' : 'Your live garden is now visible in Community')
    } catch (error) {
      setSimulationVisual((current) => ({ ...current, share_visibility: previousVisibility }))
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
    setSuppressedPests([])
    setSimulationVisual(defaultSimulationVisual)
    setGrowthTrack(initialGrowthTrack)
    setSelectedPlant(null)
    setActionMessage('Choose a new growing mode.')
  }

  async function resetSimulation() {
    const simulatorId = window.localStorage.getItem('plant_game_simulator_id')

    isResettingRef.current = true
    window.localStorage.setItem(resetMarkerKey, String(Date.now()))
    window.localStorage.removeItem('plant_game_simulator_id')
    autosaveStateRef.current = {
      ...autosaveStateRef.current,
      selectedPlant: null,
    }
    setResetPending(false)
    setSelectedPlant(null)
    setActionMessage('Resetting simulation...')

    try {
      if (simulatorId && getToken()) {
        await uprootSimulator(simulatorId)
      }
    } catch {
      setActionMessage('Reset locally. The previous save will stay hidden until the server responds.')
    } finally {
      latestSaveLoadedRef.current = true
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
      setSuppressedPests([])
      setSimulationVisual(defaultSimulationVisual)
      setGrowthTrack(initialGrowthTrack)
      setSelectedPlant(null)
      setActionMessage('Reset complete. Choose a growing mode.')
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
    accountSessionRef.current += 1
    spectatorRequestRef.current += 1
    latestSaveLoadedRef.current = false
    autosaveStateRef.current = {}
    isResettingRef.current = false
    ownGardenSnapshotRef.current = null
    rewardClaimingRef.current = null
    lastGrowthAtRef.current = 0

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
    setSuppressedPests([])
    setSimulationVisual(defaultSimulationVisual)
    setGrowthTrack(initialGrowthTrack)
    setSelectedPlant(null)
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
      setActivePage('lab')
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
      setActivePage('lab')
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
      climate,
      growingMode,
      growthTrack,
      selectedPlant,
      simulationVisual,
      windows,
    }
    setVisitingFriend({ ...friend, simulatorId: friend.latest_simulator?.id ?? null })
    setActivePage('lab')
    setWindows((value) => ({
      ...value,
      comments: { ...value.comments, visible: true, collapsed: false },
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
        setSimulationVisual(defaultSimulationVisual)
        setGrowthTrack(initialGrowthTrack)
        setActionMessage(`${friend?.user?.username ?? 'Friend'} has no active plant yet`)
      }
    } catch (error) {
      if (spectatorRequestRef.current !== requestId) return
      setSelectedPlant(null)
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
      climate,
      growingMode,
      growthTrack,
      selectedPlant,
      simulationVisual,
      windows,
    }
    setActivePage('lab')
    setWindows((value) => ({
      ...value,
      comments: { ...value.comments, visible: Boolean(liveSimulator), collapsed: false },
      monitor: { ...value.monitor, visible: true, collapsed: false },
      climate: { ...value.climate, visible: false },
      friends: { ...value.friends, visible: false },
    }))

    if (liveSimulator?.id) {
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

  function leaveFriendGarden() {
    const snapshot = ownGardenSnapshotRef.current
    spectatorRequestRef.current += 1
    setVisitingFriend(null)

    if (snapshot) {
      setAppliedAsset(snapshot.appliedAsset)
      setClimate(snapshot.climate)
      setGrowingMode(snapshot.growingMode)
      setGrowthTrack(snapshot.growthTrack)
      setSelectedPlant(snapshot.selectedPlant)
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
  }

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
  }, [applySimulatorSnapshot, visitingFriend?.historyReplay, visitingFriend?.simulatorId, visitingFriend?.user?.username])

  function navigateToPage(page) {
    if (sessionStatus !== 'authenticated' || !user) {
      openAuth('login')
      return
    }

    if (visitingFriend) {
      leaveFriendGarden()
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
    setActivePage('auth')
  }

  const labReady = Boolean(saveHydrated && growingMode && !modeLoading)
  const visitorName = visitingFriend?.user?.username ?? visitingFriend?.user?.email?.split('@')[0] ?? 'Friend'

  if (sessionStatus === 'checking') {
    return <SessionLoadingScreen />
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
        />
      </main>
    )
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b0f0c] text-slate-100">
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
        <HistoryPage onOpenGameState={viewSavedGameState} />
      ) : activePage === 'community' ? (
        <CommunityPage currentUser={user} onOpenGame={viewCommunityGame} onUserChange={setUser} />
      ) : activePage === 'settings' ? (
        <SettingsPage user={user} onBack={() => navigateToPage('lab')} onResetPassword={() => navigateToPage('password-reset')} />
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

              <PlantMonitorPanel windows={windows} setWindows={setWindows} simulationVisual={previewSimulationVisual} />
              {!visitingFriend && (
                <EnvironmentPanel
                  climate={climate}
                  setClimate={setClimate}
                  windows={windows}
                  setWindows={setWindows}
                  mode={growingMode}
                  outdoorWeather={outdoorWeather}
                />
              )}
              {!visitingFriend && <FriendsPanel windows={windows} setWindows={setWindows} user={user} onAuthRequired={openAuth} onViewFriend={viewFriendGarden} />}
              <CommentsPanel currentUser={user} onAuthRequired={openAuth} simulatorId={previewSimulationVisual?.id} windows={windows} setWindows={setWindows} title={visitingFriend ? 'Friend comments' : 'Comments'} />
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






