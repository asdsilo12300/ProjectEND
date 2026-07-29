import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { updateOnboardingProgress } from '../../lib/api'
import { getAppLanguage } from '../../i18n/appI18n'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { autoGuideByPage, TUTORIAL_VERSION, tutorialCatalog, tutorialPageOrder, tutorialText } from './tutorialCatalog'
import './OnboardingExperience.css'

const storagePrefix = 'plant-growth-academy:onboarding'
const pendingTourKey = 'plant-growth-academy:pending-tour'

function storageKey(userId) {
  return `${storagePrefix}:${userId ?? 'guest'}`
}

function loadLocalProgress(userId) {
  try {
    const progress = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? '{}')
    return progress && typeof progress === 'object' ? progress : {}
  } catch {
    return {}
  }
}

function storeLocalProgress(userId, progress) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(progress))
  } catch {
    // The server still stores progress when browser storage is unavailable.
  }
}

function hasFinishedCurrentGuide(progress, page) {
  const entry = progress?.[page]
  return Number(entry?.version) >= TUTORIAL_VERSION && ['completed', 'dismissed'].includes(entry?.state)
}

function hasCompletedCurrentGuide(progress, page) {
  const entry = progress?.[page]
  return Number(entry?.version) >= TUTORIAL_VERSION && entry?.state === 'completed'
}

function visibleTarget(selectors = []) {
  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (!element) continue
    const rect = element.getBoundingClientRect()
    const intersectsViewport = rect.right > 0
      && rect.left < window.innerWidth
      && rect.bottom > 0
      && rect.top < window.innerHeight
    if (rect.width > 0 && rect.height > 0 && intersectsViewport) return element
  }
  return null
}

function paddedRect(rect, padding = 8) {
  const left = Math.max(8, rect.left - padding)
  const top = Math.max(8, rect.top - padding)
  const right = Math.min(window.innerWidth - 8, rect.right + padding)
  const bottom = Math.min(window.innerHeight - 8, rect.bottom + padding)

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  }
}

function GuidePreview({ icon, steps }) {
  return (
    <div className="onboarding-preview" aria-hidden="true">
      <div className="onboarding-preview__topbar">
        <span />
        <span />
        <span />
      </div>
      <div className="onboarding-preview__body">
        <div className="onboarding-preview__sidebar">
          {steps.slice(0, 4).map((step, index) => <span className={index === 0 ? 'is-active' : ''} key={step.title.en} />)}
        </div>
        <div className="onboarding-preview__canvas">
          <span className="onboarding-preview__plant"><AppIcon name={icon} /></span>
          <span className="onboarding-preview__panel onboarding-preview__panel--left" />
          <span className="onboarding-preview__panel onboarding-preview__panel--right" />
          <span className="onboarding-preview__focus" />
        </div>
      </div>
    </div>
  )
}

function FirstVisitPrompt({ language, onDismiss, onStart, page }) {
  const guide = tutorialCatalog[page]
  if (!guide) return null

  return (
    <div className="onboarding-overlay onboarding-overlay--prompt" role="presentation">
      <section className="onboarding-prompt" role="dialog" aria-modal="true" aria-labelledby="onboarding-prompt-title">
        <div className="onboarding-prompt__visual">
          <GuidePreview icon={guide.icon} steps={guide.steps} />
          <span className="onboarding-prompt__badge"><AppIcon name="sprout" /> {language === 'th' ? 'คู่มือสำหรับผู้ใช้ใหม่' : 'New user guide'}</span>
        </div>
        <div className="onboarding-prompt__content">
          <span className="onboarding-eyebrow">{tutorialText(guide.eyebrow, language)}</span>
          <h2 id="onboarding-prompt-title">
            {language === 'th'
              ? `เริ่มคู่มือ: ${tutorialText(guide.label, language)}`
              : `Quick guide: ${tutorialText(guide.label, language)}`}
          </h2>
          <p>{tutorialText(guide.summary, language)}</p>
          <div className="onboarding-prompt__meta">
            <span><AppIcon name="clock" /> {language === 'th' ? `ประมาณ ${Math.max(1, Math.ceil(guide.steps.length / 3))} นาที` : `About ${Math.max(1, Math.ceil(guide.steps.length / 3))} min`}</span>
            <span><AppIcon name="check" /> {language === 'th' ? `${guide.steps.length} ขั้นตอน` : `${guide.steps.length} steps`}</span>
          </div>
          <div className="onboarding-prompt__actions">
            <button className="onboarding-button onboarding-button--primary" type="button" onClick={onStart}>
              {language === 'th' ? 'เริ่มคำแนะนำ' : 'Start guided tour'}
              <AppIcon name="arrowForward" />
            </button>
            <button className="onboarding-button onboarding-button--quiet" type="button" onClick={onDismiss}>
              {language === 'th' ? 'ไว้ดูภายหลัง' : 'Maybe later'}
            </button>
          </div>
          <small>{language === 'th' ? 'เปิดดูอีกครั้งได้จากปุ่ม ? หรือเมนูโปรไฟล์' : 'You can replay this anytime from the ? button or profile menu.'}</small>
        </div>
      </section>
    </div>
  )
}

function HelpCenter({ activePage, language, onClose, onNavigate, onStartTour, progress }) {
  const initialPage = autoGuideByPage[activePage] ?? 'lab'
  const [selectedPage, setSelectedPage] = useState(initialPage)
  const guide = tutorialCatalog[selectedPage]

  return (
    <div className="onboarding-overlay onboarding-overlay--center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="help-center" role="dialog" aria-modal="true" aria-labelledby="help-center-title">
        <header className="help-center__header">
          <span className="help-center__brand"><AppIcon name="help" /></span>
          <span className="min-w-0">
            <small>{language === 'th' ? 'ศูนย์ช่วยเหลือ' : 'HELP CENTER'}</small>
            <h2 id="help-center-title">{language === 'th' ? 'คู่มือ Plant Growth Academy' : 'Plant Growth Academy guide'}</h2>
          </span>
          <button className="help-center__close" type="button" onClick={onClose} aria-label={language === 'th' ? 'ปิดคู่มือ' : 'Close guide'}>
            <AppIcon name="close" />
          </button>
        </header>

        <div className="help-center__layout">
          <aside className="help-center__navigation">
            <p>{language === 'th' ? 'คู่มือตามหัวข้อ' : 'GUIDED TOPICS'}</p>
            <nav aria-label={language === 'th' ? 'หัวข้อคู่มือ' : 'Guide topics'}>
              {tutorialPageOrder.map((page) => {
                const item = tutorialCatalog[page]
                const complete = hasCompletedCurrentGuide(progress, page)
                return (
                  <button className={selectedPage === page ? 'is-active' : ''} type="button" key={page} onClick={() => setSelectedPage(page)}>
                    <span><AppIcon name={item.icon} /></span>
                    <span className="min-w-0">
                      <strong>{tutorialText(item.label, language)}</strong>
                      <small>{item.steps.length} {language === 'th' ? 'ขั้นตอน' : 'steps'}</small>
                    </span>
                    {complete ? <AppIcon className="help-center__complete" name="check" label={language === 'th' ? 'ดูแล้ว' : 'Completed'} /> : null}
                  </button>
                )
              })}
            </nav>
          </aside>

          <main className="help-center__content">
            <div className="help-center__intro">
              <GuidePreview icon={guide.icon} steps={guide.steps} />
              <div>
                <span className="onboarding-eyebrow">{tutorialText(guide.eyebrow, language)}</span>
                <h3>{tutorialText(guide.label, language)}</h3>
                <p>{tutorialText(guide.summary, language)}</p>
                <div className="help-center__intro-actions">
                  <button className="onboarding-button onboarding-button--primary" type="button" onClick={() => onStartTour(selectedPage)}>
                    <AppIcon name="controller" />
                    {language === 'th' ? 'เริ่มเรียนรู้คู่มือ' : 'Start tutorial'}
                  </button>
                  {guide.page !== activePage ? (
                    <button className="onboarding-button onboarding-button--secondary" type="button" onClick={() => { onNavigate(guide.page); onClose() }}>
                      {language === 'th' ? 'เปิดหน้านี้' : 'Open this page'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <section className="help-center__steps" aria-label={language === 'th' ? 'หัวข้อในคู่มือ' : 'Guide steps'}>
              <header>
                <div>
                  <small>{language === 'th' ? 'สิ่งที่จะได้เรียนรู้' : 'WHAT YOU WILL LEARN'}</small>
                  <h4>{language === 'th' ? 'คำแนะนำแบบสั้นและเห็นตำแหน่งจริง' : 'Short explanations on the real interface'}</h4>
                </div>
                <span>{guide.steps.length} {language === 'th' ? 'หัวข้อ' : 'topics'}</span>
              </header>
              <ol>
                {guide.steps.map((step, index) => (
                  <li key={step.title.en}>
                    <span className="help-center__step-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="help-center__step-icon"><AppIcon name={step.icon} /></span>
                    <span>
                      <strong>{tutorialText(step.title, language)}</strong>
                      <small>{tutorialText(step.description, language)}</small>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </main>
        </div>
      </section>
    </div>
  )
}

function TourOverlay({ language, onBack, onClose, onNext, page, rect, stepIndex }) {
  const guide = tutorialCatalog[page]
  const step = guide?.steps[stepIndex]
  const [cardSize, setCardSize] = useState({ width: 370, height: 300 })
  const cardRef = useRef(null)
  const isLast = stepIndex === guide.steps.length - 1

  useEffect(() => {
    if (!cardRef.current) return
    const measured = cardRef.current.getBoundingClientRect()
    setCardSize({ width: measured.width, height: measured.height })
  }, [language, stepIndex])

  if (!guide || !step) return null

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const mobile = viewportWidth < 720
  const gap = 18
  let cardStyle = {}

  if (!mobile && rect) {
    const roomRight = viewportWidth - rect.right
    const roomLeft = rect.left
    const roomBelow = viewportHeight - rect.bottom
    if (roomRight >= cardSize.width + gap) {
      cardStyle = { left: rect.right + gap, top: Math.min(Math.max(76, rect.top), viewportHeight - cardSize.height - 16) }
    } else if (roomLeft >= cardSize.width + gap) {
      cardStyle = { left: rect.left - cardSize.width - gap, top: Math.min(Math.max(76, rect.top), viewportHeight - cardSize.height - 16) }
    } else if (roomBelow >= cardSize.height + gap) {
      cardStyle = { left: Math.min(Math.max(16, rect.left), viewportWidth - cardSize.width - 16), top: rect.bottom + gap }
    } else {
      cardStyle = { left: Math.min(Math.max(16, rect.left), viewportWidth - cardSize.width - 16), top: Math.max(76, rect.top - cardSize.height - gap) }
    }
  }

  return (
    <div className="guided-tour" role="presentation">
      {rect ? (
        <>
          <div className="guided-tour__shade" style={{ left: 0, right: 0, top: 0, height: rect.top }} />
          <div className="guided-tour__shade" style={{ left: 0, top: rect.top, width: rect.left, height: rect.height }} />
          <div className="guided-tour__shade" style={{ left: rect.right, right: 0, top: rect.top, height: rect.height }} />
          <div className="guided-tour__shade" style={{ left: 0, right: 0, top: rect.bottom, bottom: 0 }} />
          <div className="guided-tour__focus" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />
        </>
      ) : <div className="guided-tour__shade guided-tour__shade--full" />}

      <section
        className={`guided-tour__card ${mobile || !rect ? 'guided-tour__card--sheet' : ''}`}
        style={mobile || !rect ? undefined : cardStyle}
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
      >
        <header className="guided-tour__header">
          <span className="guided-tour__icon"><AppIcon name={step.icon} /></span>
          <span className="min-w-0">
            <small>{tutorialText(guide.label, language)} · {language === 'th' ? `ขั้นตอน ${stepIndex + 1} จาก ${guide.steps.length}` : `Step ${stepIndex + 1} of ${guide.steps.length}`}</small>
            <strong id="guided-tour-title">{tutorialText(step.title, language)}</strong>
          </span>
          <button type="button" onClick={onClose} aria-label={language === 'th' ? 'ออกจากคำแนะนำ' : 'Exit guide'}><AppIcon name="close" /></button>
        </header>
        <p>{tutorialText(step.description, language)}</p>
        <div className="guided-tour__progress" aria-hidden="true">
          {guide.steps.map((item, index) => <span className={index <= stepIndex ? 'is-active' : ''} key={item.title.en} />)}
        </div>
        <footer>
          <button className="onboarding-button onboarding-button--quiet" type="button" onClick={onClose}>
            {language === 'th' ? 'ข้าม' : 'Skip'}
          </button>
          <span>
            <button className="onboarding-button onboarding-button--secondary" type="button" onClick={onBack} disabled={stepIndex === 0}>
              <AppIcon name="arrowBack" /> {language === 'th' ? 'ย้อนกลับ' : 'Back'}
            </button>
            <button className="onboarding-button onboarding-button--primary" type="button" onClick={onNext}>
              {isLast ? (language === 'th' ? 'เสร็จสิ้น' : 'Finish') : (language === 'th' ? 'ถัดไป' : 'Next')}
              <AppIcon name={isLast ? 'check' : 'arrowForward'} />
            </button>
          </span>
        </footer>
      </section>
    </div>
  )
}

export function OnboardingExperience({
  activePage,
  helpOpen = false,
  onHelpClose,
  onNavigate,
  onProgressChange,
  user,
}) {
  const [language, setLanguage] = useState(() => getAppLanguage())
  const [localProgress, setLocalProgress] = useState(() => loadLocalProgress(user?.id))
  const [promptPage, setPromptPage] = useState(null)
  const [tourPage, setTourPage] = useState(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState(null)
  const autoPromptedRef = useRef(new Set())
  const userId = user?.id
  const progress = useMemo(() => ({ ...localProgress, ...(user?.onboarding_progress ?? {}) }), [localProgress, user?.onboarding_progress])

  useEffect(() => {
    const handleSettings = (event) => setLanguage(event.detail?.language === 'th' ? 'th' : 'en')
    window.addEventListener('plant-settings-change', handleSettings)
    return () => window.removeEventListener('plant-settings-change', handleSettings)
  }, [])

  useEffect(() => {
    let pendingGuide = null
    try {
      pendingGuide = window.sessionStorage.getItem(pendingTourKey)
      if (tutorialCatalog[pendingGuide]?.page !== activePage) return undefined
      window.sessionStorage.removeItem(pendingTourKey)
    } catch {
      // Cross-page tours still work within page groups when session storage is unavailable.
    }

    if (tutorialCatalog[pendingGuide]?.page !== activePage) return undefined
    const timer = window.setTimeout(() => {
      setPromptPage(null)
      setTourPage(pendingGuide)
      setStepIndex(0)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [activePage])

  useEffect(() => {
    if (!helpOpen) return undefined
    const timer = window.setTimeout(() => setPromptPage(null), 0)
    return () => window.clearTimeout(timer)
  }, [helpOpen])

  const recordProgress = useCallback((page, state) => {
    const entry = {
      version: TUTORIAL_VERSION,
      state,
      updated_at: new Date().toISOString(),
    }
    const nextProgress = { ...progress, [page]: entry }
    setLocalProgress(nextProgress)
    storeLocalProgress(userId, nextProgress)
    onProgressChange?.(nextProgress)

    if (userId) {
      updateOnboardingProgress(page, TUTORIAL_VERSION, state)
        .then((payload) => {
          const serverProgress = payload.data?.onboarding_progress
          if (!serverProgress) return
          setLocalProgress(serverProgress)
          storeLocalProgress(userId, serverProgress)
          onProgressChange?.(serverProgress)
        })
        .catch(() => {})
    }
  }, [onProgressChange, progress, userId])

  useEffect(() => {
    const guideId = autoGuideByPage[activePage]
    if (!userId || !guideId || helpOpen || promptPage || tourPage) return undefined
    if (hasFinishedCurrentGuide(progress, guideId) || autoPromptedRef.current.has(guideId)) return undefined

    autoPromptedRef.current.add(guideId)
    const timer = window.setTimeout(() => setPromptPage(guideId), activePage === 'lab' ? 1100 : 700)
    return () => window.clearTimeout(timer)
  }, [activePage, helpOpen, progress, promptPage, tourPage, userId])

  const startTour = useCallback((guideId) => {
    const guide = tutorialCatalog[guideId]
    if (!guide) return
    setPromptPage(null)
    onHelpClose?.()
    setTourPage(guideId)
    setStepIndex(0)
    if (guide.page !== activePage) {
      try {
        window.sessionStorage.setItem(pendingTourKey, guideId)
      } catch {
        // Navigation can continue without cross-page persistence.
      }
      onNavigate?.(guide.page)
    }
  }, [activePage, onHelpClose, onNavigate])

  const closeTour = useCallback(() => {
    if (tourPage) recordProgress(tourPage, 'dismissed')
    setTourPage(null)
    setTargetRect(null)
  }, [recordProgress, tourPage])

  const finishTour = useCallback(() => {
    if (tourPage) recordProgress(tourPage, 'completed')
    setTourPage(null)
    setTargetRect(null)
  }, [recordProgress, tourPage])

  useEffect(() => {
    const guide = tutorialCatalog[tourPage]
    if (!guide || activePage !== guide.page) return undefined
    const step = guide.steps[stepIndex]
    if (!step) return undefined

    let frame = 0
    let attempts = 0
    let observedTarget = null
    let observer = null

    function updateTarget({ scroll = false } = {}) {
      const target = visibleTarget(step.targets)
      if (!target) {
        setTargetRect(null)
        if (attempts < 80) {
          attempts += 1
          frame = window.requestAnimationFrame(() => updateTarget())
        }
        return
      }

      observedTarget = target
      if (scroll) {
        const rect = target.getBoundingClientRect()
        if (rect.top < 70 || rect.bottom > window.innerHeight - 24) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
        }
      }
      setTargetRect(paddedRect(target.getBoundingClientRect()))
    }

    const timer = window.setTimeout(() => updateTarget({ scroll: true }), 120)
    const handlePositionChange = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        if (observedTarget?.isConnected) setTargetRect(paddedRect(observedTarget.getBoundingClientRect()))
        else updateTarget()
      })
    }

    window.addEventListener('resize', handlePositionChange)
    window.addEventListener('scroll', handlePositionChange, true)
    observer = new MutationObserver(handlePositionChange)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.clearTimeout(timer)
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', handlePositionChange)
      window.removeEventListener('scroll', handlePositionChange, true)
      observer?.disconnect()
    }
  }, [activePage, stepIndex, tourPage])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (tourPage) closeTour()
        else if (helpOpen) onHelpClose?.()
        else if (promptPage) {
          recordProgress(promptPage, 'dismissed')
          setPromptPage(null)
        }
      }
      if (!tourPage) return
      if (event.key === 'ArrowLeft') setStepIndex((current) => Math.max(0, current - 1))
      if (event.key === 'ArrowRight') {
        const finalIndex = tutorialCatalog[tourPage].steps.length - 1
        if (stepIndex >= finalIndex) finishTour()
        else setStepIndex((current) => current + 1)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeTour, finishTour, helpOpen, onHelpClose, promptPage, recordProgress, stepIndex, tourPage])

  return (
    <>
      {promptPage ? (
        <FirstVisitPrompt
          language={language}
          page={promptPage}
          onStart={() => startTour(promptPage)}
          onDismiss={() => {
            recordProgress(promptPage, 'dismissed')
            setPromptPage(null)
          }}
        />
      ) : null}
      {helpOpen ? (
        <HelpCenter
          activePage={activePage}
          language={language}
          onClose={onHelpClose}
          onNavigate={onNavigate}
          onStartTour={startTour}
          progress={progress}
        />
      ) : null}
      {tourPage ? (
        <TourOverlay
          language={language}
          onBack={() => setStepIndex((current) => Math.max(0, current - 1))}
          onClose={closeTour}
          onNext={() => {
            const finalIndex = tutorialCatalog[tourPage].steps.length - 1
            if (stepIndex >= finalIndex) finishTour()
            else setStepIndex((current) => current + 1)
          }}
          page={tourPage}
          rect={targetRect}
          stepIndex={stepIndex}
        />
      ) : null}
    </>
  )
}
