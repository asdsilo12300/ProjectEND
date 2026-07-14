import { AppIcon } from '../game/icons/IconifyIcon'
import heroImage from '../assets/hero.png'
import { useState } from 'react'
import plantGrowthLogo from '../assets/Logo for Plant Growth Academy Simulation Game-Photoroom.png'

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.42l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.87A6.02 6.02 0 0 1 6.08 12c0-.65.11-1.28.31-1.87V7.51H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.49l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 6c1.47 0 2.79.5 3.83 1.49l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.62C7.18 7.76 9.39 6 12 6Z" />
    </svg>
  )
}

export function LoginPage({ mode, setMode, form, setForm, status, error, onSubmit, onGoogleLogin, onBack, backLabel = 'Back to simulator' }) {
  const isRegister = mode === 'register'
  const title = isRegister ? 'Create account' : 'Login'
  const submitLabel = status === 'loading' ? 'Please wait...' : isRegister ? 'Create account' : 'Log in'
  const isBusy = status === 'loading' || status === 'google-loading'
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <section className="absolute inset-0 z-[80] grid bg-[#f7faf5] text-[#101511] lg:grid-cols-[minmax(420px,0.96fr)_minmax(420px,1fr)]" aria-label="Authentication">
      <div className="relative hidden min-h-screen overflow-hidden bg-[#24402f] lg:block">
        <img className="absolute inset-0 h-full w-full object-cover" src={heroImage} alt="Plant learning illustration" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,23,15,.18),rgba(12,23,15,.04))]" />
        <div className="absolute left-8 top-6 flex items-center gap-3 text-white">
          <img className="h-16 w-auto object-contain" src={plantGrowthLogo} alt="Plant Growth Academy" />
        </div>
        <div className="absolute bottom-8 left-8 max-w-sm rounded-xl border border-white/20 bg-white/16 p-5 text-white backdrop-blur-sm">
          <p className="text-sm font-semibold">Plant Growth Academy</p>
          <p className="mt-2 text-sm leading-6 text-white/82">Save simulations, continue lessons, and keep lab progress connected to your account.</p>
        </div>
      </div>

      <div className="relative flex min-h-screen justify-center overflow-x-hidden overflow-y-auto px-5 py-8 sm:px-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#9bcf82]/28 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-8 h-64 w-64 rounded-full bg-[#4cc8c7]/18 blur-3xl" />

        <div className="relative my-auto w-full max-w-[420px]">
          {onBack && (
            <button
              className="mb-8 inline-flex items-center gap-2 rounded-md border border-[#203027]/12 bg-white px-3 py-2 text-sm font-medium text-[#203027] shadow-sm transition hover:bg-[#eef6e9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5f9f48]"
              type="button"
              onClick={onBack}
            >
              <AppIcon className="h-4 w-4 rotate-180" name="arrowForward" />
              {backLabel}
            </button>
          )}

          <div className="rounded-2xl border border-[#203027]/10 bg-white p-6 shadow-[0_18px_46px_rgba(16,21,17,.12)] sm:p-8">
            <div className="mb-7 text-center">
              <img className="mx-auto mb-3 h-20 w-auto object-contain lg:hidden" src={plantGrowthLogo} alt="Plant Growth Academy" />
              <h1 className="text-4xl font-black tracking-normal text-[#0f1711]">{title}</h1>
              <p className="mt-2 text-sm text-[#5f6b62]">
                {isRegister ? 'Start saving your plant lab progress.' : 'Continue your plant growth lab session.'}
              </p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              {isRegister && (
                <label className="block text-sm font-semibold text-[#1d2a20]">
                  Username
                  <span className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-[#203027]/18 bg-white px-3 transition-within focus-within:border-[#69a954] focus-within:ring-2 focus-within:ring-[#9bcf82]/35">
                    <input
                      className="min-w-0 flex-1 bg-transparent text-sm text-[#101511] outline-none placeholder:text-[#7d8b82]"
                      autoComplete="username"
                      value={form.username}
                      onChange={(event) => updateField('username', event.target.value)}
                      placeholder="Username"
                      required={isRegister}
                    />
                    <AppIcon className="h-5 w-5 shrink-0 text-[#7d8b82]" name="profile" />
                  </span>
                </label>
              )}

              <label className="block text-sm font-semibold text-[#1d2a20]">
                Email
                <span className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-[#203027]/18 bg-white px-3 transition-within focus-within:border-[#69a954] focus-within:ring-2 focus-within:ring-[#9bcf82]/35">
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm text-[#101511] outline-none placeholder:text-[#7d8b82]"
                    autoComplete="email"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    placeholder="User@email.com"
                    required
                  />
                  <AppIcon className="h-5 w-5 shrink-0 text-[#7d8b82]" name="mail" />
                </span>
              </label>

              <label className="block text-sm font-semibold text-[#1d2a20]">
                Password
                <span className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-[#203027]/18 bg-white px-3 transition-within focus-within:border-[#69a954] focus-within:ring-2 focus-within:ring-[#9bcf82]/35">
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm text-[#101511] outline-none placeholder:text-[#7d8b82]"
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
                    required
                    minLength={isRegister ? 8 : undefined}
                  />
                  <button
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[#748078] transition hover:bg-[#eef5eb] hover:text-[#33543b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5f9f48]"
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    <AppIcon className="h-5 w-5" name={showPassword ? 'eyeOff' : 'eye'} />
                  </button>
                </span>
              </label>

              {isRegister && (
                <label className="block text-sm font-semibold text-[#1d2a20]">
                  Confirm password
                  <span className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-[#203027]/18 bg-white px-3 transition-within focus-within:border-[#69a954] focus-within:ring-2 focus-within:ring-[#9bcf82]/35">
                    <input
                      className="min-w-0 flex-1 bg-transparent text-sm text-[#101511] outline-none placeholder:text-[#7d8b82]"
                      autoComplete="new-password"
                      type={showPasswordConfirmation ? 'text' : 'password'}
                      value={form.passwordConfirmation}
                      onChange={(event) => updateField('passwordConfirmation', event.target.value)}
                      placeholder="Confirm your password"
                      required
                      minLength={8}
                    />
                    <button
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[#748078] transition hover:bg-[#eef5eb] hover:text-[#33543b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5f9f48]"
                      type="button"
                      aria-label={showPasswordConfirmation ? 'Hide password confirmation' : 'Show password confirmation'}
                      aria-pressed={showPasswordConfirmation}
                      onClick={() => setShowPasswordConfirmation((visible) => !visible)}
                    >
                      <AppIcon className="h-5 w-5" name={showPasswordConfirmation ? 'eyeOff' : 'eye'} />
                    </button>
                  </span>
                </label>
              )}

              {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}

              <button
                className="flex h-11 w-full items-center justify-center rounded-lg bg-[#39bec8] px-4 text-sm font-bold text-white transition hover:bg-[#2cadb7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#247f87] disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={isBusy}
              >
                {submitLabel}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs text-[#7d8b82]">
              <span className="h-px flex-1 bg-[#203027]/12" />
              <span>or</span>
              <span className="h-px flex-1 bg-[#203027]/12" />
            </div>

            <button
              className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#203027]/16 bg-white px-4 text-sm font-semibold text-[#1d2a20] shadow-sm transition hover:border-[#203027]/28 hover:bg-[#f8faf7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4285f4] disabled:cursor-not-allowed disabled:opacity-65"
              type="button"
              onClick={onGoogleLogin}
              disabled={isBusy}
            >
              {status === 'google-loading' ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#4285f4]/30 border-t-[#4285f4]" aria-hidden="true" />
              ) : (
                <GoogleIcon />
              )}
              <span>{status === 'google-loading' ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </button>

            <button
              className="mt-3 w-full rounded-lg border border-[#203027]/14 bg-white px-4 py-3 text-sm font-semibold text-[#1d2a20] transition hover:bg-[#f2f8ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5f9f48] disabled:cursor-not-allowed disabled:opacity-65"
              type="button"
              disabled={isBusy}
              onClick={() => {
                setMode(isRegister ? 'login' : 'register')
                setShowPassword(false)
                setShowPasswordConfirmation(false)
                setForm({ username: '', email: form.email, password: '', passwordConfirmation: '' })
              }}
            >
              {isRegister ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
