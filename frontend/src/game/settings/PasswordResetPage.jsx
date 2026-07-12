import { useEffect, useMemo, useState } from 'react'
import { completePasswordReset, requestPasswordResetOtp, verifyPasswordResetOtp } from '../../lib/api'
import { AppIcon } from '../icons/IconifyIcon'

const steps = [
  { id: 'request', label: 'Email code' },
  { id: 'verify', label: 'Verify OTP' },
  { id: 'password', label: 'New password' },
]

function maskEmail(email = '') {
  const [name = '', domain = ''] = email.split('@')
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(3, name.length - 2))}@${domain}`
}

function StepProgress({ step }) {
  const activeIndex = Math.max(0, steps.findIndex((item) => item.id === step))

  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Password reset progress">
      {steps.map((item, index) => (
        <li key={item.id} className="min-w-0">
          <div className={`mb-2 h-1 rounded-full ${index <= activeIndex ? 'bg-[#9bcf82]' : 'bg-white/10'}`} />
          <span className={`block truncate text-[10px] font-bold sm:text-xs ${index <= activeIndex ? 'text-lime-100' : 'text-slate-500'}`}>
            {index + 1}. {item.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Field({ autoComplete, label, name, onChange, placeholder, type = 'text', value }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-slate-200">{label}</span>
      <input
        className="h-11 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-[#9bcf82]/70 focus:ring-2 focus:ring-[#9bcf82]/15"
        autoComplete={autoComplete}
        name={name}
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

export function PasswordResetPage({ onBack, onDone, user }) {
  const [step, setStep] = useState('request')
  const [emailHint, setEmailHint] = useState(() => maskEmail(user?.email))
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return undefined
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [resendIn])

  const passwordChecks = useMemo(() => ({
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
    match: Boolean(password) && password === passwordConfirmation,
  }), [password, passwordConfirmation])
  const passwordReady = Object.values(passwordChecks).every(Boolean)

  async function sendOtp() {
    setStatus('loading')
    setMessage('')
    try {
      const payload = await requestPasswordResetOtp()
      setEmailHint(payload.email_hint || maskEmail(user?.email))
      setOtp('')
      setResendIn(60)
      setStep('verify')
      setMessage('A 6-digit code has been sent to your email.')
    } catch (error) {
      setMessage(error.payload?.configuration_error || error.message || 'Could not send the verification code.')
    } finally {
      setStatus('idle')
    }
  }

  async function verifyOtp(event) {
    event.preventDefault()
    if (otp.length !== 6) return
    setStatus('loading')
    setMessage('')
    try {
      const payload = await verifyPasswordResetOtp(otp)
      setResetToken(payload.reset_token)
      setStep('password')
    } catch (error) {
      setMessage(error.message || 'The code could not be verified.')
    } finally {
      setStatus('idle')
    }
  }

  async function submitPassword(event) {
    event.preventDefault()
    if (!passwordReady) return
    setStatus('loading')
    setMessage('')
    try {
      await completePasswordReset(resetToken, password, passwordConfirmation)
      setStep('success')
    } catch (error) {
      setMessage(error.message || 'Could not update your password.')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto bg-[#0b0f0c]/98">
      <div className="mx-auto flex min-h-full w-full max-w-4xl items-center px-4 py-8 sm:px-6">
        <div className="grid w-full overflow-hidden rounded-2xl border border-lime-100/15 bg-[#111713] shadow-[0_28px_90px_rgba(0,0,0,.42)] md:grid-cols-[.82fr_1.18fr]">
          <aside className="relative overflow-hidden border-b border-lime-100/10 bg-[#0d130f] p-6 md:border-b-0 md:border-r md:p-8">
            <div className="absolute -left-20 -top-24 h-60 w-60 rounded-full bg-[#9bcf82]/10 blur-3xl" />
            <div className="relative">
              <button className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 transition hover:text-lime-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200" type="button" onClick={onBack}>
                <AppIcon className="h-4 w-4" name="arrowBack" />
                Back to settings
              </button>
              <span className="mt-12 grid h-14 w-14 place-items-center rounded-2xl bg-[#9bcf82] text-[#101511] shadow-[0_14px_32px_rgba(155,207,130,.18)]">
                <AppIcon className="h-7 w-7" name="lock" />
              </span>
              <h1 className="mt-5 text-2xl font-black tracking-tight text-lime-50">Secure your account</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">We verify your email before allowing a password change. Your OTP can only be used once.</p>
              <div className="mt-7 rounded-xl border border-lime-100/10 bg-white/[0.035] p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#263022] text-sm font-black text-lime-100">{(user?.username || 'L').slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm text-slate-100">{user?.username || 'Learner'}</strong>
                    <span className="block truncate text-xs text-slate-500">{emailHint}</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="p-6 sm:p-8">
            {step !== 'success' && <StepProgress step={step} />}

            {step === 'request' && (
              <div className="mt-10">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#9bcf82]/10 text-[#bdeba7] ring-1 ring-[#9bcf82]/15"><AppIcon className="h-5 w-5" name="mail" /></span>
                <h2 className="mt-5 text-xl font-black text-lime-50">Send verification code</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">A six-digit OTP will be sent to <strong className="text-slate-200">{emailHint}</strong>. The code expires in 10 minutes.</p>
                <button className="mt-7 h-11 w-full rounded-lg bg-[#9bcf82] px-4 text-sm font-black text-[#101511] transition hover:bg-[#addf96] disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-200" type="button" disabled={status === 'loading'} onClick={sendOtp}>
                  {status === 'loading' ? 'Sending securely...' : 'Send OTP to my email'}
                </button>
              </div>
            )}

            {step === 'verify' && (
              <form className="mt-10" onSubmit={verifyOtp}>
                <h2 className="text-xl font-black text-lime-50">Enter your OTP</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Check {emailHint} and enter the six-digit code below.</p>
                <label className="mt-6 block">
                  <span className="mb-2 block text-xs font-bold text-slate-200">Verification code</span>
                  <input
                    className="h-14 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-center font-mono text-2xl font-black tracking-[.45em] text-lime-50 outline-none transition placeholder:tracking-[.25em] placeholder:text-slate-700 focus:border-[#9bcf82]/70 focus:ring-2 focus:ring-[#9bcf82]/15"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength="6"
                    pattern="[0-9]{6}"
                    placeholder="000000"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </label>
                {message && <p className="mt-3 text-xs leading-5 text-amber-200" role="status">{message}</p>}
                <button className="mt-6 h-11 w-full rounded-lg bg-[#9bcf82] text-sm font-black text-[#101511] transition hover:bg-[#addf96] disabled:cursor-not-allowed disabled:opacity-45" type="submit" disabled={otp.length !== 6 || status === 'loading'}>
                  {status === 'loading' ? 'Verifying...' : 'Verify code'}
                </button>
                <button className="mt-3 h-10 w-full text-xs font-bold text-slate-400 transition hover:text-lime-100 disabled:cursor-not-allowed disabled:text-slate-600" type="button" disabled={resendIn > 0 || status === 'loading'} onClick={sendOtp}>
                  {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
                </button>
              </form>
            )}

            {step === 'password' && (
              <form className="mt-10" onSubmit={submitPassword}>
                <h2 className="text-xl font-black text-lime-50">Create a new password</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Use a password that is different from passwords you use elsewhere.</p>
                <div className="mt-6 grid gap-4">
                  <Field autoComplete="new-password" label="New password" name="password" onChange={setPassword} placeholder="At least 8 characters" type="password" value={password} />
                  <Field autoComplete="new-password" label="Confirm new password" name="password_confirmation" onChange={setPasswordConfirmation} placeholder="Enter it again" type="password" value={passwordConfirmation} />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/15 p-3 text-[11px]">
                  {[[passwordChecks.length, '8+ characters'], [passwordChecks.letter, 'Contains a letter'], [passwordChecks.number, 'Contains a number'], [passwordChecks.match, 'Passwords match']].map(([valid, label]) => (
                    <span className={`flex items-center gap-1.5 ${valid ? 'text-lime-200' : 'text-slate-500'}`} key={label}><AppIcon className="h-3.5 w-3.5" name="check" />{label}</span>
                  ))}
                </div>
                {message && <p className="mt-3 text-xs leading-5 text-amber-200" role="alert">{message}</p>}
                <button className="mt-6 h-11 w-full rounded-lg bg-[#9bcf82] text-sm font-black text-[#101511] transition hover:bg-[#addf96] disabled:cursor-not-allowed disabled:opacity-45" type="submit" disabled={!passwordReady || status === 'loading'}>
                  {status === 'loading' ? 'Updating password...' : 'Update password'}
                </button>
              </form>
            )}

            {step === 'success' && (
              <div className="flex min-h-[390px] flex-col items-center justify-center text-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-[#9bcf82] text-[#101511] shadow-[0_16px_40px_rgba(155,207,130,.2)]"><AppIcon className="h-8 w-8" name="check" /></span>
                <h2 className="mt-6 text-2xl font-black text-lime-50">Password updated</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">Your new password is ready. You can use it the next time you sign in.</p>
                <button className="mt-7 h-11 rounded-lg bg-[#9bcf82] px-6 text-sm font-black text-[#101511] transition hover:bg-[#addf96]" type="button" onClick={onDone}>Return to settings</button>
              </div>
            )}

            {message && step === 'request' && <p className="mt-4 text-xs leading-5 text-amber-200" role="alert">{message}</p>}
          </section>
        </div>
      </div>
    </div>
  )
}
