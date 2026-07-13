import { setAppLanguage } from '../../i18n/appI18n'

export const settingsStorageKey = 'plant-growth-academy-settings'

export const defaultSettings = {
  language: 'en',
  textSize: 'default',
  contrast: 'default',
  reduceMotion: false,
}

export function loadSettings() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(settingsStorageKey) ?? '{}')
    return Object.fromEntries(Object.keys(defaultSettings).map((key) => [key, saved[key] ?? defaultSettings[key]]))
  } catch {
    return { ...defaultSettings }
  }
}

export function applySettings(settings) {
  const root = document.documentElement
  setAppLanguage(settings.language || 'en')
  root.classList.toggle('settings-reduced-motion', Boolean(settings.reduceMotion))
  root.classList.toggle('settings-large-text', settings.textSize === 'large')
  root.classList.toggle('settings-high-contrast', settings.contrast === 'high')
}

export function saveSettings(settings) {
  window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings))
  applySettings(settings)
  window.dispatchEvent(new CustomEvent('plant-settings-change', { detail: settings }))
}
