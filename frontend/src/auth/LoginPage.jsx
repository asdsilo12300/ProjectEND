import { AppIcon } from '../game/icons/FontAwesomeIcon'
import heroImage from '../assets/hero.png'
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

const accountBenefits = [
  ['history', 'Keep every growing experiment in one account'],
  ['shop', 'Carry coins, tools, friends, and achievements with you'],
  ['shield', 'Google protects sign-in and verifies your email securely'],
]

export function LoginPage({ status, error, onGoogleLogin, onBack, backLabel = 'Back to home' }) {
  const isBusy = status === 'google-loading'

  return (
    <section className="absolute inset-0 z-[80] grid overflow-y-auto bg-[#f3f7f0] text-[#122016] lg:grid-cols-[minmax(440px,1.04fr)_minmax(460px,.96fr)]" aria-label="Sign in with Google">
      <div className="relative hidden min-h-screen overflow-hidden bg-[#173321] lg:block">
        <img className="absolute inset-0 h-full w-full scale-[1.02] object-cover" src={heroImage} alt="A young plant growing in soil" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,31,17,.35),rgba(9,31,17,.08)),linear-gradient(0deg,rgba(8,25,14,.78),transparent_62%)]" />
        <div className="absolute left-9 top-7 flex items-center gap-3 text-white">
          <img className="h-20 w-auto object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,.25)]" src={plantGrowthLogo} alt="Plant Growth Academy" />
        </div>
        <div className="absolute inset-x-9 bottom-9 max-w-xl text-white">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-[#153622]/70 px-3 py-1.5 text-xs font-black uppercase tracking-[.18em] backdrop-blur-md">
            <AppIcon className="h-4 w-4 text-[#b9eb9f]" name="sprout" />
            One account, every growing cycle
          </span>
          <h2 className="mt-5 max-w-lg text-4xl font-black leading-[1.08] tracking-[-.035em]">Return to your garden without another password to remember.</h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-white/78">Your plants, learning progress, community profile, and inventory stay connected through your Google account.</p>
        </div>
      </div>

      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 sm:px-9">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#a7dd8a]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[#54b99e]/14 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[.055] [background-image:linear-gradient(#183822_1px,transparent_1px),linear-gradient(90deg,#183822_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="relative w-full max-w-[480px]">
          {onBack && (
            <button
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#244a2e]/14 bg-white/75 px-3.5 py-2 text-sm font-bold text-[#294830] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[#5f9f48]/35 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5f9f48]"
              type="button"
              onClick={onBack}
            >
              <AppIcon className="h-4 w-4 rotate-180" name="arrowForward" />
              {backLabel}
            </button>
          )}

          <div className="overflow-hidden rounded-[28px] border border-[#244a2e]/12 bg-white/94 shadow-[0_30px_80px_rgba(25,54,32,.14)] backdrop-blur-xl">
            <div className="h-1.5 bg-[linear-gradient(90deg,#4e9a52,#91d477_58%,#f2c660)]" />
            <div className="p-7 sm:p-10">
              <img className="mx-auto mb-4 h-24 w-auto object-contain lg:hidden" src={plantGrowthLogo} alt="Plant Growth Academy" />
              <div className="text-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#eaf5e5] px-3 py-1.5 text-xs font-black uppercase tracking-[.14em] text-[#39703f]">
                  <AppIcon className="h-4 w-4" name="shield" />
                  Google-only account
                </span>
                <h1 className="mt-5 text-4xl font-black leading-tight tracking-[-.035em] text-[#102015]">Sign in to the academy</h1>
                <p className="mx-auto mt-3 max-w-sm text-[15px] leading-6 text-[#5b6c60]">Use Google to sign in or create your learner account automatically. There is no separate registration form or password.</p>
              </div>

              <div className="my-7 space-y-3 rounded-2xl border border-[#315c38]/10 bg-[#f4f8f1] p-4">
                {accountBenefits.map(([icon, label]) => (
                  <div className="flex items-center gap-3 text-sm leading-5 text-[#405347]" key={label}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#4b8b49] shadow-sm ring-1 ring-[#315c38]/10">
                      <AppIcon className="h-4 w-4" name={icon} />
                    </span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              {error && (
                <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700" role="alert">{error}</p>
              )}

              <button
                className="group flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-[#1e3d27]/18 bg-white px-5 text-[15px] font-black text-[#1b2d20] shadow-[0_12px_28px_rgba(24,58,31,.1)] transition hover:-translate-y-0.5 hover:border-[#5d9f51]/40 hover:bg-[#f9fcf7] hover:shadow-[0_16px_34px_rgba(24,58,31,.15)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#4285f4] disabled:cursor-wait disabled:opacity-65 disabled:hover:translate-y-0"
                type="button"
                onClick={onGoogleLogin}
                disabled={isBusy}
              >
                {isBusy ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#4285f4]/25 border-t-[#4285f4]" aria-hidden="true" />
                ) : (
                  <GoogleIcon />
                )}
                <span>{isBusy ? 'Connecting to Google...' : 'Continue with Google'}</span>
                {!isBusy && <AppIcon className="ml-auto h-4 w-4 text-[#6d7d71] transition group-hover:translate-x-1" name="arrowForward" />}
              </button>

              <p className="mt-5 text-center text-xs leading-5 text-[#758278]">By continuing, you allow Plant Growth Academy to use your Google name, email, and profile picture for your academy account.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
