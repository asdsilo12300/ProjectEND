import { AppIcon } from '../game/icons/IconifyIcon'
import heroImage from '../assets/hero.png'
import plantGrowthLogo from '../assets/Logo for Plant Growth Academy Simulation Game-Photoroom.png'

export function LoginPage({ mode, setMode, form, setForm, status, error, onSubmit, onBack }) {
  const isRegister = mode === 'register'
  const title = isRegister ? 'Create account' : 'Login'
  const submitLabel = status === 'loading' ? 'Please wait...' : isRegister ? 'Create account' : 'Log in'

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
          <p className="mt-2 text-sm leading-6 text-white/82">Save simulations, continue lessons, and keep classroom progress connected to your account.</p>
        </div>
      </div>

      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 sm:px-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#9bcf82]/28 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-8 h-64 w-64 rounded-full bg-[#4cc8c7]/18 blur-3xl" />

        <div className="relative w-full max-w-[420px]">
          <button
            className="mb-8 inline-flex items-center gap-2 rounded-md border border-[#203027]/12 bg-white px-3 py-2 text-sm font-medium text-[#203027] shadow-sm transition hover:bg-[#eef6e9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5f9f48]"
            type="button"
            onClick={onBack}
          >
            <AppIcon className="h-4 w-4 rotate-180" name="arrowForward" />
            Back to simulator
          </button>

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
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-[#203027]/18 bg-white px-3 text-sm text-[#101511] outline-none transition placeholder:text-[#7d8b82] focus:border-[#69a954] focus:ring-2 focus:ring-[#9bcf82]/35"
                    autoComplete="username"
                    value={form.username}
                    onChange={(event) => updateField('username', event.target.value)}
                    placeholder="Learner name"
                    required={isRegister}
                  />
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
                    placeholder="student@email.com"
                    required
                  />
                  <AppIcon className="h-5 w-5 text-[#7d8b82]" name="profile" />
                </span>
              </label>

              <label className="block text-sm font-semibold text-[#1d2a20]">
                Password
                <span className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-[#203027]/18 bg-white px-3 transition-within focus-within:border-[#69a954] focus-within:ring-2 focus-within:ring-[#9bcf82]/35">
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm text-[#101511] outline-none placeholder:text-[#7d8b82]"
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    type="password"
                    value={form.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
                    required
                    minLength={isRegister ? 8 : undefined}
                  />
                  <AppIcon className="h-5 w-5 text-[#7d8b82]" name="shield" />
                </span>
              </label>

              {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              <button
                className="flex h-11 w-full items-center justify-center rounded-lg bg-[#39bec8] px-4 text-sm font-bold text-white transition hover:bg-[#2cadb7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#247f87] disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={status === 'loading'}
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
              className="w-full rounded-lg border border-[#203027]/14 bg-white px-4 py-3 text-sm font-semibold text-[#1d2a20] transition hover:bg-[#f2f8ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5f9f48]"
              type="button"
              onClick={() => {
                setMode(isRegister ? 'login' : 'register')
                setForm({ username: '', email: form.email, password: '' })
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
