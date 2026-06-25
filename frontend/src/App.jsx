import { useEffect, useMemo, useState } from 'react'
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

function App() {
  const [windows, setWindows] = useState(defaultWindows)
  const [climate, setClimate] = useState(defaultClimate)
  const [openSections, setOpenSections] = useState({ Plants: true, Items: true })
  const [appliedAsset, setAppliedAsset] = useState(labLibrary.Items[0])
  const [profileOpen, setProfileOpen] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [activePage, setActivePage] = useState('lab')
  const [growingMode, setGrowingMode] = useState(null)
  const [outdoorWeather, setOutdoorWeather] = useState(initialOutdoorWeather)
  const [simulationVisual, setSimulationVisual] = useState(defaultSimulationVisual)
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

  const previewSimulationVisual = useMemo(() => {
    if (!growingMode) return simulationVisual

    const factors = buildSimulationFactors(climate, outdoorWeather)
    const preview = evaluateLocalSimulation(factors)

    return {
      ...simulationVisual,
      visual_state: preview.visual_state,
      visual_overrides: preview.visual_overrides,
      pest_risks: preview.pest_risks,
      active_pests: preview.active_pests,
      current_model_url: simulationVisual.current_model_url ?? preview.current_model_url,
    }
  }, [climate, growingMode, outdoorWeather, simulationVisual])
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
  }

  async function chooseGrowingMode(mode) {
    setGrowingMode(mode)

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
      setActionMessage(nextVisual.visual_state ? `Plant state: ${nextVisual.visual_state}` : 'Scenario saved')
    } catch {
      setSimulationVisual(nextVisual)
      setActionMessage('Saved locally')
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
    setActionMessage('Simulation reset')
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
          <LibrarySidebar sections={labLibrary} openSections={openSections} onToggle={toggleLibrarySection} onApply={applyLabAsset} />
          <SimulationStage actionMessage={actionMessage} dropLabAsset={dropLabAsset} mode={growingMode ?? 'greenhouse'} resetSimulation={resetSimulation} saveSimulation={saveSimulation} simulationVisual={previewSimulationVisual} />

          <PlantMonitorPanel windows={windows} setWindows={setWindows} simulationVisual={previewSimulationVisual} />
          <EnvironmentPanel
            climate={climate}
            setClimate={setClimate}
            windows={windows}
            setWindows={setWindows}
            mode={growingMode ?? 'greenhouse'}
            outdoorWeather={outdoorWeather}
          />
          <FriendsPanel windows={windows} setWindows={setWindows} user={user} onAuthRequired={openAuth} />
          <CommentsPanel windows={windows} setWindows={setWindows} />

          {!growingMode && <GrowingModePicker onSelect={chooseGrowingMode} />}
        </>
      )}
    </main>
  )
}

export default App
