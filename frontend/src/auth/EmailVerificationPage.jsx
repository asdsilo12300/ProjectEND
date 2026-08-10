import { useEffect, useRef, useState } from 'react'
import heroImage from '../assets/hero.png'
import plantGrowthLogo from '../assets/Logo for Plant Growth Academy Simulation Game-Photoroom.png'
import { AppIcon } from '../game/icons/FontAwesomeIcon'
import { resendVerificationEmail, verifyEmailCode, verifyEmailLink } from '../lib/api'

function formatCountdown(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

function friendlyError(error, fallback) {
  if (Number(error?.status) >= 500 || /SQLSTATE|Undefined table|Connection:/i.test(String(error?.message ?? ''))) {
    return fallback
  }
  return error?.message || fallback
}

function VerificationCodeInput({ value, onChange, disabled }) {
  const inputsRef = useRef([])
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? '')

  function commit(nextDigits, focusIndex) {
    onChange(nextDigits.join('').replace(/\D/g, '').slice(0, 6))
    if (Number.isInteger(focusIndex)) {
      window.requestAnimationFrame(() => inputsRef.current[focusIndex]?.focus())
    }
  }

  function updateDigit(index, rawValue) {
    const nextValue = rawValue.replace(/\D/g, '')
    if (nextValue.length > 1) {
      const pasted = nextValue.slice(0, 6).split('')
      commit([...pasted, ...Array(6 - pasted.length).fill('')], Math.min(5, pasted.length))
      return
    }

    const nextDigits = [...digits]
    nextDigits[index] = nextValue
    commit(nextDigits, nextValue && index < 5 ? index + 1 : undefined)
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      const nextDigits = [...digits]
      nextDigits[index - 1] = ''
      commit(nextDigits, index - 1)
    }
    if (event.key === 'ArrowLeft' && index > 0) inputsRef.current[index - 1]?.focus()
    if (event.key === 'ArrowRight' && index < 5) inputsRef.current[index + 1]?.focus()
  }

  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-3" data-i18n-skip="true">
      {digits.map((digit, index) => (
        <input
          aria-label={`Verification code digit ${index + 1}`}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          className="h-13 min-w-0 rounded-xl border border-[#b9ccb4] bg-[#f8fbf6] text-center text-xl font-black text-[#17301d] outline-none transition focus:border-[#5d9f4f] focus:bg-white focus:ring-4 focus:ring-[#8fce75]/20 disabled:opacity-60 sm:h-15 sm:text-2xl"
          disabled={disabled}
          inputMode="numeric"
          key={index}
          maxLength={1}
          onChange={(event) => updateDigit(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
            if (!pasted) return
            event.preventDefault()
            const nextDigits = [...pasted.split(''), ...Array(6 - pasted.length).fill('')]
            commit(nextDigits, Math.min(5, pasted.length))
          }}
          ref={(element) => { inputsRef.current[index] = element }}
          type="text"
          value={digit}
        />
      ))}
    </div>
  )
}

export function EmailVerificationPage({ verification, onBack, onVerified }) {
  const [otp, setOtp] = useState('')
  const [status, setStatus] = useState(verification.linkToken ? 'verifying-link' : 'idle')
  const [message, setMessage] = useState(
    verification.deliveryStatus === 'failed'
      ? 'Your account was created, but the email could not be sent. Select resend to try again.'
      : '',
  )
  const [error, setError] = useState('')
  const [expiresIn, setExpiresIn] = useState(Number(verification.expiresIn) || 0)
  const [resendIn, setResendIn] = useState(Number(verification.resendAvailableIn) || 0)
  const linkAttemptedRef = useRef(false)
  const isBusy = status === 'verifying-code' || status === 'verifying-link' || status === 'resending'

  useEffect(() => {
    const timer = window.setInterval(() => {
      setExpiresIn((current) => Math.max(0, current - 1))
      setResendIn((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!verification.linkToken || linkAttemptedRef.current) return
    linkAttemptedRef.current = true

    async function verifyFromLink() {
      setStatus('verifying-link')
      setError('')
      try {
        const payload = await verifyEmailLink(verification.linkToken)
        setStatus('verified')
        setMessage('Email verified. Preparing your account...')
        await onVerified(payload)
      } catch (linkError) {
        setStatus('idle')
        setError(friendlyError(linkError, 'This verification link is invalid or has expired.'))
      }
    }

    verifyFromLink()
  }, [onVerified, verification.linkToken])

  async function submitCode(event) {
    event.preventDefault()
    if (otp.length !== 6) {
      setError('Enter all 6 digits from your email.')
      return
    }

    setStatus('verifying-code')
    setError('')
    setMessage('')
    try {
      const payload = await verifyEmailCode(verification.email, otp)
      setStatus('verified')
      setMessage('Email verified. Preparing your account...')
      await onVerified(payload)
    } catch (verificationError) {
      setStatus('idle')
      setError(friendlyError(verificationError, 'The verification code could not be confirmed.'))
    }
  }

  async function resend() {
    setStatus('resending')
    setError('')
    setMessage('')
    try {
      const payload = await resendVerificationEmail(verification.email)
      setStatus('idle')
      setOtp('')
      setExpiresIn(Number(payload.expires_in) || 0)
      setResendIn(Number(payload.resend_available_in) || 60)
      setMessage('A new 6-digit code has been sent to your email.')
    } catch (resendError) {
      setStatus('idle')
      const retryAfter = Number(resendError.payload?.retry_after ?? resendError.payload?.resend_available_in)
      if (retryAfter > 0) setResendIn(retryAfter)
      setError(friendlyError(resendError, 'The verification email could not be sent. Please try again.'))
    }
  }

  return (
    <section className="absolute inset-0 z-[90] grid overflow-y-auto bg-[#eef5eb] text-[#101511] lg:grid-cols-[minmax(390px,0.82fr)_minmax(520px,1.18fr)]" aria-label="Email verification">
      <div className="relative hidden min-h-screen overflow-hidden bg-[#183722] lg:block">
        <img className="absolute inset-0 h-full w-full object-cover" src={heroImage} alt="Plant learning illustration" />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(7,20,11,.5),rgba(7,20,11,.12))]" />
        <img className="absolute left-8 top-7 h-18 w-auto object-contain" src={plantGrowthLogo} alt="Plant Growth Academy" />
        <div className="absolute bottom-8 left-8 right-8 rounded-2xl border border-white/20 bg-[#0c1b11]/72 p-6 text-white shadow-2xl backdrop-blur-md">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#9bcf82] text-[#102012]"><AppIcon className="h-5 w-5" name="shield" /></span>
          <h2 className="mt-4 text-2xl font-black">Protecting every learner account</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-white/78">Email verification keeps plant histories, coins, friends, and learning progress connected to the correct owner.</p>
        </div>
      </div>

      <div className="relative flex min-h-screen justify-center overflow-hidden px-5 py-9 sm:px-9">
        <div className="pointer-events-none absolute -right-28 -top-24 h-72 w-72 rounded-full bg-[#9bcf82]/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-0 h-72 w-72 rounded-full bg-[#48c4c7]/18 blur-3xl" />

        <div className="relative my-auto w-full max-w-[540px] rounded-3xl border border-[#213325]/12 bg-white p-6 shadow-[0_28px_80px_rgba(25,55,31,.16)] sm:p-9">
          <button className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full border border-[#203027]/12 text-[#53645a] transition hover:bg-[#eef6e9] hover:text-[#203027] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5f9f48]" type="button" onClick={onBack} aria-label="Back to login">
            <AppIcon className="h-4 w-4" name="close" />
          </button>

          <div className="pr-12">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e3f2dc] text-[#376a36] shadow-inner">
              <AppIcon className="h-6 w-6" name={status === 'verified' ? 'check' : 'mail'} />
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-[#5f934f]">Account security · Step 2 of 2</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#101a12] sm:text-4xl">Verify your email</h1>
            <p className="mt-3 text-sm leading-6 text-[#657168]">We sent a 6-digit code and a verification link to <strong className="font-bold text-[#26402b]">{verification.emailHint || verification.email}</strong>.</p>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-2" aria-label="Verification progress">
            {['Account created', 'Check email', 'Enter code'].map((label, index) => (
              <div className="rounded-xl border border-[#d7e4d2] bg-[#f5f9f3] px-2 py-3 text-center" key={label}>
                <span className={`mx-auto grid h-6 w-6 place-items-center rounded-full text-[11px] font-black ${index === 0 ? 'bg-[#5c9d4d] text-white' : 'bg-[#dcebd6] text-[#3f6f3b]'}`}>{index === 0 ? <AppIcon className="h-3 w-3" name="check" /> : index + 1}</span>
                <span className="mt-1.5 block text-[11px] font-bold text-[#526057] sm:text-xs">{label}</span>
              </div>
            ))}
          </div>

          {status === 'verifying-link' && (
            <div className="mt-7 flex items-center gap-3 rounded-xl border border-[#bcd9b3] bg-[#f0f8ed] px-4 py-4 text-sm font-semibold text-[#35563a]" role="status">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#5d9f4f]/25 border-t-[#5d9f4f]" aria-hidden="true" />
              Verifying the secure link from your email...
            </div>
          )}

          <form className="mt-7" onSubmit={submitCode}>
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-extrabold text-[#253428]" htmlFor="verification-code-visual">Verification code</label>
              {expiresIn > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#708078]"><AppIcon className="h-3.5 w-3.5" name="clock" /> Expires in {formatCountdown(expiresIn)}</span>}
            </div>
            <div className="mt-3" id="verification-code-visual">
              <VerificationCodeInput disabled={isBusy || status === 'verified'} onChange={setOtp} value={otp} />
            </div>

            {message && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" role="status">{message}</p>}
            {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-5 text-red-700" role="alert">{error}</p>}

            <button className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#83c76c] px-4 text-sm font-black text-[#102012] shadow-[0_10px_24px_rgba(83,145,67,.2)] transition hover:-translate-y-0.5 hover:bg-[#92d37a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4d8a40] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" disabled={isBusy || status === 'verified' || otp.length !== 6} type="submit">
              {status === 'verifying-code' ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#102012]/20 border-t-[#102012]" aria-hidden="true" /> : <AppIcon className="h-4 w-4" name="shield" />}
              {status === 'verifying-code' ? 'Verifying code...' : 'Verify and continue'}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-[#203027]/10 pt-5 sm:flex-row">
            <p className="text-xs leading-5 text-[#6d7971]">Didn&apos;t receive it? Check spam or request a new code.</p>
            <button className="min-w-32 rounded-lg border border-[#b8cbb3] bg-white px-4 py-2.5 text-xs font-extrabold text-[#36543b] transition hover:border-[#72a965] hover:bg-[#f2f8ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5f9f48] disabled:cursor-not-allowed disabled:opacity-55" disabled={isBusy || resendIn > 0} onClick={resend} type="button">
              {status === 'resending' ? 'Sending...' : resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend email'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
