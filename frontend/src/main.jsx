import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/noto-sans-thai'
import './index.css'
import App from './App.jsx'
import { applySettings, loadSettings } from './game/settings/settingsPreferences'

applySettings(loadSettings())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
