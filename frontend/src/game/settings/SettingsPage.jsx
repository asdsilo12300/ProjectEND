import { useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { defaultSettings, loadSettings, saveSettings } from './settingsPreferences'

function Toggle({ checked, label, onChange }) {
  return (
    <button
      className={`relative h-8 w-14 shrink-0 rounded-full border transition after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-200 ${
        checked ? 'border-[#9bcf82] bg-[#9bcf82]' : 'border-white/15 bg-[#202720]'
      }`}
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className={`absolute top-1 h-[22px] w-[22px] rounded-full bg-white shadow transition ${checked ? 'left-[29px]' : 'left-1'}`} />
    </button>
  )
}

function Section({ children, description, icon, title }) {
  return (
    <section className="overflow-hidden rounded-xl border border-lime-100/10 bg-[#121914]/90 shadow-[0_14px_34px_rgba(0,0,0,.18)]">
      <header className="flex items-start gap-3 border-b border-lime-100/10 px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#9bcf82]/10 text-[#bdeba7] ring-1 ring-[#9bcf82]/15">
          <AppIcon className="h-5 w-5" name={icon} />
        </span>
        <div>
          <h2 className="text-sm font-black text-lime-50">{title}</h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-400">{description}</p>
        </div>
      </header>
      <div className="divide-y divide-lime-100/[0.07] px-5">{children}</div>
    </section>
  )
}

function SettingRow({ children, description, title }) {
  return (
    <div className="flex min-h-[76px] flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 pr-3">
        <h3 className="text-sm font-bold text-slate-100">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
      </div>
      {children}
    </div>
  )
}

function ChoiceGroup({ label, options, value, onChange }) {
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-white/10 bg-black/20 p-1" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          className={`min-h-11 rounded-md px-3 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${
            value === option.value ? 'bg-[#9bcf82] text-[#101511]' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
          }`}
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function SettingsPage({ backLabel = 'Back', onBack, onResetPassword, user }) {
  const [settings, setSettings] = useState(loadSettings)
  const [savedPulse, setSavedPulse] = useState(false)
  const changedByUser = useRef(false)

  useEffect(() => {
    if (!changedByUser.current) return undefined
    changedByUser.current = false

    saveSettings(settings)
    setSavedPulse(true)
    const timer = window.setTimeout(() => setSavedPulse(false), 1200)
    return () => window.clearTimeout(timer)
  }, [settings])

  function updateSetting(key, value) {
    changedByUser.current = true
    setSettings((current) => ({ ...current, [key]: value }))
  }

  async function resetSettings() {
    const result = await Swal.fire({
      title: 'Restore default settings?',
      text: 'Text size, contrast, motion, and language will return to their original values.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Restore defaults',
      cancelButtonText: 'Keep my settings',
      background: '#111713',
      color: '#ecfccb',
      confirmButtonColor: '#4f7947',
      cancelButtonColor: '#343d36',
      reverseButtons: true,
      focusCancel: true,
    })

    if (result.isConfirmed) {
      changedByUser.current = true
      setSettings({ ...defaultSettings })
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto bg-[#0b0f0c]/96">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-slate-400 transition hover:text-lime-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
              type="button"
              onClick={onBack}
            >
              <AppIcon className="h-4 w-4" name="arrowBack" />
              {backLabel}
            </button>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#69c8b5] text-[#0d1714] shadow-[0_8px_24px_rgba(105,200,181,.18)]">
                <AppIcon className="h-6 w-6" name="settings" />
              </span>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-lime-50">Settings</h1>
                <p className="mt-1 text-sm text-slate-400">Manage your account, display, and Lab preferences.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${savedPulse ? 'text-[#bdeba7]' : 'text-slate-500'}`} aria-live="polite">
              <AppIcon className="h-4 w-4" name="check" />
              {savedPulse ? 'Saved just now' : 'Changes save automatically'}
            </span>
            <button
              className="rounded-md border border-lime-100/15 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
              type="button"
              onClick={resetSettings}
            >
              Reset defaults
            </button>
          </div>
        </div>

        <section className="mb-5 overflow-hidden rounded-xl border border-lime-100/10 bg-[#121914]/90 shadow-[0_14px_34px_rgba(0,0,0,.18)]">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#263022] text-base font-black text-lime-100 ring-1 ring-lime-100/10">
                {(user?.username ?? 'L').slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <strong className="truncate text-sm text-slate-100">{user?.username ?? 'Learner'}</strong>
                  <span className="rounded-full bg-[#9bcf82]/10 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-[#bdeba7]">Account</span>
                </div>
                <span className="block truncate text-xs text-slate-400">{user?.email ?? 'Sign in to manage your account'}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">Verify your email with OTP before changing your password.</span>
              </div>
            </div>
            <button
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#9bcf82]/30 bg-[#9bcf82]/10 px-4 text-xs font-black text-lime-100 transition hover:border-[#9bcf82]/50 hover:bg-[#9bcf82]/15 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
              type="button"
              disabled={!user}
              onClick={onResetPassword}
            >
              <AppIcon className="h-4 w-4" name="key" />
              Change password
            </button>
          </div>
        </section>

        <div className="grid gap-5">
          <Section icon="eye" title="Display & accessibility" description="Adjust readability and motion without changing simulation results.">
            <SettingRow title="Text size" description="Increase interface text across the academy.">
              <ChoiceGroup
                label="Text size"
                options={[{ label: 'Default', value: 'default' }, { label: 'Large', value: 'large' }]}
                value={settings.textSize}
                onChange={(value) => updateSetting('textSize', value)}
              />
            </SettingRow>
            <SettingRow title="Contrast" description="Strengthen separation between controls and backgrounds.">
              <ChoiceGroup
                label="Contrast"
                options={[{ label: 'Default', value: 'default' }, { label: 'High', value: 'high' }]}
                value={settings.contrast}
                onChange={(value) => updateSetting('contrast', value)}
              />
            </SettingRow>
            <SettingRow title="Reduce motion" description="Minimizes decorative movement and animated transitions.">
              <Toggle checked={settings.reduceMotion} label="Reduce motion" onChange={(value) => updateSetting('reduceMotion', value)} />
            </SettingRow>
          </Section>

          <Section icon="translate" title="Language" description="Choose the preferred language for learning content.">
            <SettingRow title="Preferred language" description="The academy will use this preference as translated content becomes available.">
              <ChoiceGroup
                label="Preferred language"
                options={[{ label: 'English', value: 'en' }, { label: 'ไทย', value: 'th' }]}
                value={settings.language}
                onChange={(value) => updateSetting('language', value)}
              />
            </SettingRow>
          </Section>
        </div>
      </div>
    </div>
  )
}
