import { useEffect, useMemo, useRef, useState } from 'react'
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
import { clearToken, getMe, getPlants, getToken, login as loginUser, register as registerUser, startSimulator, tickSimulator } from './lib/api'
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
  const [outdoorWeather, setOutdoorWeather] = useState(initialOutdoorWeather)
  const [simulationVisual, setSimulationVisual] = useState(defaultSimulationVisual)
  const [growthTrack, setGrowthTrack] = useState(initialGrowthTrack)
  const lastGrowthAtRef = useRef(0)
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

  function applyLabAsset(asset) {
    setAppliedAsset(asset)

    if (asset.type === 'plant') {
      setSelectedPlant(asset)
      setSimulationVisual(defaultSimulationVisual)
      setGrowthTrack(initialGrowthTrack)
      setActionMessage(`${asset.name} selected`)
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

    if (getToken()) {
      try {
        const payload = await getPlants()
        const plants = payload.data ?? payload
        const simulationPlant = plants.find((plant) => plant.name_en === 'Simulation Sprout' || plant.name_th === 'à¸•à¹‰à¸™à¸­à¹ˆà¸­à¸™à¸ˆà¸³à¸¥à¸­à¸‡')
        if (simulationPlant) {
          const simulatorPayload = await startSimulator(simulationPlant.id, mode)
          const simulator = simulatorPayload.data ?? simulatorPayload
          window.localStorage.setItem('plant_game_simulator_id', String(simulator.id))
          setSimulationVisual({ ...defaultSimulationVisual, current_model_url: simulator.current_model_url ?? defaultSimulationVisual.current_model_url })
        } else {
          window.localStorage.removeItem('plant_game_simulator_id')
          setSimulationVisual(defaultSimulationVisual)
        }
      } catch {
        window.localStorage.removeItem('plant_game_simulator_id')
      }
    }

    const remainingLoadingTime = 800 - (Date.now() - loadingStartedAt)
    if (remainingLoadingTime > 0) await wait(remainingLoadingTime)
    setModeLoading(false)
    setActionMessage('Select a plant to load the model')
  }

  async function saveSimulation() {
    const factors = buildSimulationFactors(climate, outdoorWeather)
    const simulatorId = window.localStorage.getItem('plant_game_simulator_id')
    let nextVisual = evaluateLocalSimulation(factors)

    try {
      if (simulatorId && getToken()) {
        const payload = await tickSimulator(simulatorId, factors)
        nextVisual = payload.data ?? payload
      }

      setSimulationVisual(nextVisual)
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
      setSimulationVisual(defaultSimulationVisual)
      setGrowthTrack(initialGrowthTrack)
      setSelectedPlant(null)
      setActionMessage('Scenario saved. Select a plant to continue.')
    } catch {
      setSimulationVisual(defaultSimulationVisual)
      setGrowthTrack(initialGrowthTrack)
      setSelectedPlant(null)
      setActionMessage('Saved locally. Select a plant to continue.')
    }
  }

  function resetSimulation() {
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
