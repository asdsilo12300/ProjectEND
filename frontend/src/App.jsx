import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { defaultClimate, labLibrary } from './game/data/gameData'
import { GrowingModePicker } from './game/components/GrowingModePicker'
import { LibrarySidebar } from './game/components/LibrarySidebar'
import { TopBar } from './game/components/TopBar'
import { CommentsPanel } from './game/panels/CommentsPanel'
import { EnvironmentPanel } from './game/panels/EnvironmentPanel'
import { FriendsPanel } from './game/panels/FriendsPanel'
import { PlantMonitorPanel } from './game/panels/PlantMonitorPanel'
import { SimulationStage } from './game/scene/SimulationStage'
import { ShopPage } from './game/shop/ShopPage'
import { LoginPage } from './auth/LoginPage'
import { clearToken, getLatestSimulator, getMe, getModelAssets, getPlants, getToken, login as loginUser, register as registerUser, startSimulator, syncSimulatorSnapshot } from './lib/api'
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

function ModeLoadingOverlay({ mode }) {
  const label = mode === 'outdoor' ? 'outdoor field' : 'greenhouse lab'

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

function App() {
  const [windows, setWindows] = useState(defaultWindows)
  const [climate, setClimate] = useState(defaultClimate)
  const [openSections, setOpenSections] = useState({ Plants: true, Items: true })
  const [appliedAsset, setAppliedAsset] = useState(labLibrary.Items[0])
  const [profileOpen, setProfileOpen] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [activePage, setActivePage] = useState('lab')
  const [growingMode, setGrowingMode] = useState(null)
  const [modeLoading, setModeLoading] = useState(false)
  const [selectedPlant, setSelectedPlant] = useState(null)
  const [plantCatalog, setPlantCatalog] = useState([])
  const [modelAssets, setModelAssets] = useState({})
  const [outdoorWeather, setOutdoorWeather] = useState(initialOutdoorWeather)
  const [simulationVisual, setSimulationVisual] = useState(defaultSimulationVisual)
  const [growthTrack, setGrowthTrack] = useState(initialGrowthTrack)
  const lastGrowthAtRef = useRef(0)
  const latestSaveLoadedRef = useRef(false)
  const autosaveStateRef = useRef({})
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' })
  const [authStatus, setAuthStatus] = useState('idle')
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (!getToken()) return undefined

    let isCancelled = false

    async function syncUser() {
      try {
        const payload = await getMe()
        if (!isCancelled) setUser(payload.data ?? payload.user ?? payload)
      } catch {
        clearToken()
        if (!isCancelled) setUser(null)
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
  const applySimulatorSnapshot = useCallback((simulator, options = {}) => {
    if (!simulator) return

    const restoredProgress = clampSimulationProgress(simulator.growth_point ?? 0)
    const restoredMode = simulator.mode ?? 'greenhouse'
    const restoredPlant = labLibrary.Plants.find((plant) => plant.id === 'sprout') ?? labLibrary.Plants[0]

    window.localStorage.setItem('plant_game_simulator_id', String(simulator.id))
    setGrowingMode(restoredMode)
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

    if (!simulatorId || !getToken() || !state.selectedPlant || !state.growingMode) {
      return null
    }

    const payload = await syncSimulatorSnapshot(simulatorId, buildSaveSnapshot(), { keepalive: options.keepalive })
    const simulator = payload.data ?? payload

    if (!options.silent && simulator) {
      setSimulationVisual({
        ...defaultSimulationVisual,
        ...simulator,
        current_model_url: simulator.current_model_url ?? autosaveStateRef.current.previewSimulationVisual?.current_model_url ?? defaultSimulationVisual.current_model_url,
      })
    }

    return simulator
  }, [buildSaveSnapshot])

  useEffect(() => {
    if (!user || latestSaveLoadedRef.current) return undefined

    let isCancelled = false
    latestSaveLoadedRef.current = true

    async function restoreLatestSave() {
      try {
        const payload = await getLatestSimulator()
        const simulator = payload.data ?? null

        if (!isCancelled && simulator) {
          applySimulatorSnapshot(simulator)
          setActionMessage('Latest simulation restored')
        }
      } catch {
        latestSaveLoadedRef.current = false
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

  async function applyLabAsset(asset) {
    setAppliedAsset(asset)

    if (asset.type === 'plant') {
      const apiPlant = plantCatalog.find((plant) => plant.name_en === 'Simulation Sprout') ?? plantCatalog[0] ?? null
      const fallbackModelUrl = apiPlant?.base_model_url ?? modelAssets['plant.original']?.url ?? defaultSimulationVisual.current_model_url

      setSelectedPlant(asset)
      setGrowthTrack(initialGrowthTrack)
      setSimulationVisual({
        ...defaultSimulationVisual,
        current_model_url: fallbackModelUrl,
      })
      setActionMessage('Creating simulation save...')

      if (getToken() && apiPlant && growingMode) {
        try {
          const simulatorPayload = await startSimulator(apiPlant.id, growingMode, {
            location_name: outdoorWeather.addressLabel || undefined,
            latitude: outdoorWeather.location?.latitude,
            longitude: outdoorWeather.location?.longitude,
          })
          const simulator = simulatorPayload.data ?? simulatorPayload
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
    setGrowingMode(mode)
    setSelectedPlant(null)
    setGrowthTrack(initialGrowthTrack)

    if (mode === 'outdoor') {
      setWindows((value) => ({
        ...value,
        climate: {
          ...value.climate,
          y: Math.min(value.climate.y, Math.max(76, window.innerHeight - 332)),
          visible: true,
          collapsed: false,
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
    try {
      const simulator = await persistCurrentSimulation({ silent: false })
      const nextVisual = simulator ?? previewSimulationVisual

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
      window.localStorage.removeItem('plant_game_simulator_id')
      setSimulationVisual(defaultSimulationVisual)
      setGrowthTrack(initialGrowthTrack)
      setSelectedPlant(null)
      setActionMessage('Scenario saved. Select a plant to continue.')
    } catch {
      window.localStorage.removeItem('plant_game_simulator_id')
      setSimulationVisual(defaultSimulationVisual)
      setGrowthTrack(initialGrowthTrack)
      setSelectedPlant(null)
      setActionMessage('Saved locally. Select a plant to continue.')
    }
  }

  function resetSimulation() {
    window.localStorage.removeItem('plant_game_simulator_id')
    setClimate(
      growingMode === 'outdoor' && outdoorWeather.forecast
        ? climateFromForecast({ ...defaultClimate }, outdoorWeather.forecast)
        : { ...defaultClimate },
    )
    setAppliedAsset(labLibrary.Items[0])
    setSimulationVisual(defaultSimulationVisual)
    setGrowthTrack(initialGrowthTrack)
    setSelectedPlant(null)
    setActionMessage('Simulation reset. Select a plant to begin.')
  }

  function dropLabAsset(event) {
    event.preventDefault()

    const payload = event.dataTransfer.getData('application/x-lab-asset')
    if (!payload) return

    try {
      applyLabAsset(JSON.parse(payload))
    } catch {
      return
    }
  }

  function openAuth(mode = 'login') {
    setAuthMode(mode)
    setAuthError('')
    setAuthStatus('idle')
    setProfileOpen(false)
    setActivePage('auth')
  }

  async function submitAuth(event) {
    event.preventDefault()
    setAuthStatus('loading')
    setAuthError('')

    try {
      const payload = authMode === 'register'
        ? await registerUser(authForm.username.trim(), authForm.email.trim(), authForm.password)
        : await loginUser(authForm.email.trim(), authForm.password)

      setUser(payload.user ?? payload.data ?? null)
      setAuthStatus('idle')
      setAuthForm({ username: '', email: '', password: '' })
      setActivePage('lab')
    } catch (error) {
      setAuthStatus('idle')
      setAuthError(error.message || 'Unable to sign in right now')
    }
  }

  function logoutUser() {
    latestSaveLoadedRef.current = false
    clearToken()
    window.localStorage.removeItem('plant_game_simulator_id')
    setUser(null)
    setProfileOpen(false)
    setActivePage('lab')
  }

  const labReady = Boolean(growingMode && !modeLoading)

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b0f0c] text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(127,176,105,.16),transparent_25%),linear-gradient(135deg,#070a08_0%,#101511_54%,#080b09_100%)]" />
      <div className="soft-grid absolute inset-0 opacity-55" />

      <TopBar activePage={activePage} onNavigate={setActivePage} openWindow={openWindow} profileOpen={profileOpen} setProfileOpen={setProfileOpen} user={user} onAuthRequired={openAuth} onLogout={logoutUser} />

      {activePage === 'auth' ? (
        <LoginPage
          mode={authMode}
          setMode={setAuthMode}
          form={authForm}
          setForm={setAuthForm}
          status={authStatus}
          error={authError}
          onSubmit={submitAuth}
          onBack={() => setActivePage('lab')}
        />
      ) : activePage === 'shop' ? (
        <ShopPage />
      ) : (
        <>
          {labReady && (
            <>
              <LibrarySidebar sections={labLibrary} openSections={openSections} onToggle={toggleLibrarySection} onApply={applyLabAsset} />
              <SimulationStage
                actionMessage={actionMessage}
                dropLabAsset={dropLabAsset}
                mode={growingMode}
                plantSelected={Boolean(selectedPlant)}
                resetSimulation={resetSimulation}
                saveSimulation={saveSimulation}
                sceneAssets={modelAssets}
                simulationVisual={previewSimulationVisual}
              />

              <PlantMonitorPanel windows={windows} setWindows={setWindows} simulationVisual={previewSimulationVisual} />
              <EnvironmentPanel
                climate={climate}
                setClimate={setClimate}
                windows={windows}
                setWindows={setWindows}
                mode={growingMode}
                outdoorWeather={outdoorWeather}
              />
              <FriendsPanel windows={windows} setWindows={setWindows} user={user} onAuthRequired={openAuth} />
              <CommentsPanel windows={windows} setWindows={setWindows} />
            </>
          )}

          {!growingMode && <GrowingModePicker onSelect={chooseGrowingMode} />}
          {modeLoading && <ModeLoadingOverlay mode={growingMode} />}
        </>
      )}
    </main>
  )
}

export default App
