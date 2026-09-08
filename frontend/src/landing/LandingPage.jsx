import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import learnAboutPlantsBanner from '../assets/learn-about-plants-banner.jpg'
import plantGrowthLogo from '../assets/Logo for Plant Growth Academy Simulation Game-Photoroom.png'
import { AppIcon } from '../game/icons/FontAwesomeIcon'
import { ParticleNetworkBackground } from '../game/components/ParticleNetworkBackground'
import { loadSettings, saveSettings } from '../game/settings/settingsPreferences'
import { getLearningContent, getLearningContents, resolveAssetUrl } from '../lib/api'
import './LandingPage.css'
import './LandingPageRefinements.css'

const LANDING_THEME_KEY = 'plant-growth-landing-theme'
const LandingPlantPreview3D = lazy(() => import('./LandingPlantPreview3D'))

const pixelIconIndexes = {
  home: ['nav', 0],
  learn: ['nav', 1],
  lab: ['nav', 2],
  shop: ['nav', 3],
  history: ['nav', 4],
  community: ['nav', 5],
  light: ['factor', 0],
  water: ['factor', 1],
  air: ['factor', 2],
  soil: ['factor', 3],
  nutrients: ['factor', 4],
  temperature: ['factor', 5],
}

function PixelIcon({ className = '', name }) {
  const [sheet, index] = pixelIconIndexes[name] ?? pixelIconIndexes.learn
  return <span aria-hidden="true" className={`landing-pixel-icon landing-pixel-icon--${sheet} ${className}`} style={{ '--pixel-index': index }} />
}

function GameButton({ children, className = '', variant = 'primary', ...props }) {
  return <button className={`landing-game-button landing-game-button--${variant} ${className}`} type="button" {...props}>{children}</button>
}

function GamePanel({ as: Component = 'div', children, className = '', ...props }) {
  return <Component className={`landing-game-panel ${className}`} {...props}>{children}</Component>
}

const factors = [
  { icon: 'bolt', title: 'Light', value: '85%', description: 'Light supplies the energy plants need to create food through photosynthesis.' },
  { icon: 'drop', title: 'Water', value: '72%', description: 'Water carries nutrients, regulates temperature, and keeps plant cells firm.' },
  { icon: 'soil', title: 'Soil', value: '62%', description: 'Healthy soil supports roots while storing moisture and essential minerals.' },
  { icon: 'temp', title: 'Temperature', value: '26°C', description: 'A suitable temperature keeps growth and plant metabolism working efficiently.' },
  { icon: 'eco', title: 'Nutrients', value: 'N · P · K', description: 'Balanced nutrients strengthen roots, leaves, stems, and long-term plant health.' },
  { icon: 'air', title: 'Air', value: '400 ppm', description: 'Plants use carbon dioxide from the air as a key ingredient in photosynthesis.' },
]

const features = [
  { icon: 'controller', title: 'Interactive plant simulation', description: 'Adjust environmental conditions and immediately see how your plant responds.' },
  { icon: 'history', title: 'Learn from every experiment', description: 'Save each growing session and compare results to improve the next attempt.' },
  { icon: 'groups', title: 'A connected learning community', description: 'Visit friends, exchange observations, and learn from other growers.' },
  { icon: 'shield', title: 'Progress tied to your account', description: 'Your plants, inventory, achievements, and history stay with your account.' },
]

const tourSteps = [
  {
    shortTitle: 'Plant & workspace',
    title: 'Know your plant and workspace',
    description: 'The left panel identifies the active plant and mode. Switch between Plants, Tools, and Monitor, or collapse the panel when you need more room.',
    focus: 'workspace',
    captionSide: 'right',
    spotlight: { x: '1.1%', y: '8%', width: '23.4%', height: '83%' },
  },
  {
    shortTitle: 'Growth monitor',
    title: 'Read the growth forecast and pest risks',
    description: 'Monitor growth progress, the real-world day estimate, and warning cards for pests before choosing the next care action.',
    focus: 'monitor',
    captionSide: 'right-top',
    spotlight: { x: '1.1%', y: '34%', width: '23.4%', height: '57%' },
  },
  {
    shortTitle: 'Time controls',
    title: 'Control simulation time and growth pace',
    description: 'The top HUD shows the biological day and its real-time equivalent. Use x1, x2, x4, or Skip to move through the experiment deliberately.',
    focus: 'clock',
    captionSide: 'left-bottom',
    spotlight: { x: '26.1%', y: '8.5%', width: '20.6%', height: '19%' },
  },
  {
    shortTitle: '3D plant',
    title: 'Observe the live 3D plant stage',
    description: 'The center stage visualizes growth and stress. Compare visible changes with the data panels instead of judging the plant from appearance alone.',
    focus: 'stage',
    captionSide: 'left-bottom',
    spotlight: { x: '25.6%', y: '31%', width: '48.2%', height: '50%' },
  },
  {
    shortTitle: 'Plant actions',
    title: 'Use the plant action bar',
    description: 'The bottom commands collect the important actions in one place: manage the plant, harvest when ready, and share the live simulation.',
    focus: 'actions',
    captionSide: 'left-top',
    spotlight: { x: '31.2%', y: '81.5%', width: '35.5%', height: '15.5%' },
  },
  {
    shortTitle: 'Plant status',
    title: 'Check health, growth, and care resources',
    description: 'The right summary shows health, growth, speed, water, and nutrients together so you can diagnose the plant before changing a control.',
    focus: 'status',
    captionSide: 'left-bottom',
    spotlight: { x: '75.1%', y: '8%', width: '23.7%', height: '47%' },
  },
  {
    shortTitle: 'Environment',
    title: 'Adjust the environment and record evidence',
    description: 'Use Overview for notes and environmental controls, then open Comments or Friends to discuss and compare the experiment with the community.',
    focus: 'environment',
    captionSide: 'left-top',
    spotlight: { x: '75.1%', y: '48%', width: '23.7%', height: '49%' },
  },
]

const journeySteps = [
  {
    icon: 'person',
    title: 'Connect your learner profile',
    eyebrow: 'Your learning identity',
    description: 'Continue with Google to create or reopen your learner profile—no registration form or academy password.',
    detail: 'Google securely verifies your identity while your academy profile keeps progress consistent across the Plant Lab, Shop, History, and Community. Every experiment becomes part of one continuous learning record that you can return to at any time.',
    image: '/media/register-tour-current-v1.png',
    imageAlt: 'Plant Growth Academy Google sign-in screen',
    highlights: ['Sign in or create your profile with Google', 'Carry coins and purchased items forward', 'Build a personal record of every experiment'],
  },
  {
    icon: 'sprout',
    title: 'Select your first plant',
    eyebrow: 'Know before you grow',
    description: 'Choose a plant, review its needs, and decide whether to grow in the controlled lab or outdoors.',
    detail: 'Each species reacts differently to water, light, soil, temperature, and pests. Read the plant guide, compare healthy ranges, and choose the growing mode that matches the experiment you want to run.',
    image: '/media/plant-selection-current-v1.png',
    imageAlt: 'Complete Plant Lab plant selection screen',
    highlights: ['Review scientific and common plant information', 'Compare controlled and outdoor growing modes', 'Begin with recommended healthy values'],
  },
  {
    icon: 'controller',
    title: 'Run the experiment',
    eyebrow: 'Observe cause and effect',
    description: 'Adjust environmental factors and observe cause and effect through the live 3D simulation.',
    detail: 'Change one factor at a time and watch the live model respond. Plant Monitor explains health, growth pace, pests, and the next recommended action while visual changes make stress and recovery easier to understand.',
    image: '/media/plant-lab-preview-current-v1.png',
    imageAlt: 'Complete live 3D Plant Lab experiment screen',
    highlights: ['Balance six connected environmental factors', 'Observe growth and plant health in real time', 'Choose the correct item when a problem appears'],
  },
  {
    icon: 'history',
    title: 'Review and grow smarter',
    eyebrow: 'Turn results into insight',
    description: 'Harvest when ready, save the result, and compare your history before starting the next plant.',
    detail: 'Harvesting records the final condition, score, elapsed time, and real-life growth equivalent. Use the saved evidence to identify what worked and make a stronger plan for your next growing cycle.',
    image: '/media/history-preview.png',
    imageAlt: 'Complete saved experiment history screen',
    highlights: ['Harvest when biological maturity is reached', 'Save health, score, duration, and conditions', 'Compare results before starting the next plant'],
  },
]

const gameSpaces = [
  { page: 'lab', icon: 'controller', title: 'Plant Lab', eyebrow: 'Core experience', description: 'Grow a living 3D plant and control the conditions around it in real time.', preview: 'lab', image: '/media/plant-lab-preview-current-v1.png', imageAlt: 'Current Plant Lab preview interface' },
  { page: 'shop', icon: 'shop', title: 'Shop', eyebrow: 'Tools & supplies', description: 'Use earned coins to unlock practical tools for pests and plant care.', preview: 'shop', image: '/media/shop-preview.png', imageAlt: 'Shop preview interface' },
  { page: 'history', icon: 'history', title: 'History', eyebrow: 'Experiment records', description: 'Revisit completed sessions, scores, conditions, and saved evidence.', preview: 'history', image: '/media/history-preview.png', imageAlt: 'Saved experiment history preview interface' },
  { page: 'community', icon: 'groups', title: 'Community', eyebrow: 'Learn together', description: 'Share observations, view live gardens, and learn from other growers.', preview: 'community', image: '/media/community-preview.png', imageAlt: 'Community preview interface' },
  { page: 'settings', icon: 'settings', title: 'Settings', eyebrow: 'Made for you', description: 'Choose your language and adjust display, accessibility, and account preferences.', preview: 'settings', image: '/media/settings-preview.png', imageAlt: 'Settings preview interface' },
]

const growingModes = [
  {
    key: 'controlled',
    icon: 'settings',
    asset: '/media/game-ui/mode-controlled-pixel-v1.png',
    assetAlt: 'Pixel art controlled plant laboratory',
    eyebrow: 'CONTROLLED LAB',
    title: 'Control the variables',
    description: 'Tune water, light, soil, air, nutrients, and temperature to see one clear cause-and-effect relationship at a time.',
    meta: 'Best for learning the fundamentals',
    tone: 'mint',
  },
  {
    key: 'outdoor',
    icon: 'weatherCloudSun',
    asset: '/media/game-ui/mode-outdoor-pixel-v1.png',
    assetAlt: 'Pixel art outdoor plant growing through changing weather',
    eyebrow: 'OUTDOOR FIELD',
    title: 'Respond to the real world',
    description: 'Let daylight, weather, rain, and location shape the cycle while you protect your plant with the right care action.',
    meta: 'Best for observation and decisions',
    tone: 'sun',
  },
  {
    key: 'seasonal',
    icon: 'history',
    asset: '/media/game-ui/mode-seasonal-pixel-v1.png',
    assetAlt: 'Pixel art plant surrounded by the four seasons',
    eyebrow: 'SEASONAL JOURNEY',
    title: 'Grow through a season',
    description: 'Follow a seeded weather timeline, track biological days, and prepare for seasonal changes without losing your progress.',
    meta: 'Best for long-term experiments',
    tone: 'violet',
  },
]

function HeroParticles() {
  return (
    <div className="landing-particles" aria-hidden="true">
      {Array.from({ length: 14 }, (_, index) => (
        <span
          key={index}
          style={{
            '--particle-left': `${4 + ((index * 17) % 93)}%`,
            '--particle-delay': `${(index % 7) * -0.9}s`,
            '--particle-duration': `${7 + (index % 5) * 1.1}s`,
            '--particle-size': `${3 + (index % 4)}px`,
            '--particle-drift': `${index % 2 === 0 ? 32 : -28}px`,
          }}
        />
      ))}
    </div>
  )
}

function BrandButton({ onClick, compact = false }) {
  return (
    <button className={`landing-brand ${compact ? 'landing-brand--compact' : ''}`} type="button" onClick={onClick} aria-label="Plant Growth Academy home">
      <img src={plantGrowthLogo} alt="Plant Growth Academy" />
      <span>
        <strong>Plant Growth</strong>
        <small>Academy</small>
      </span>
    </button>
  )
}

function LandingThemeToggle({ language, theme, onThemeChange }) {
  const themeLabel = language === 'th'
    ? theme === 'dark' ? 'เปลี่ยนเป็นธีมสว่าง' : 'เปลี่ยนเป็นธีมมืด'
    : theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <button
      className="landing-theme-toggle"
      type="button"
      aria-label={themeLabel}
      aria-pressed={theme === 'light'}
      title={themeLabel}
      onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
    >
      <AppIcon name={theme === 'dark' ? 'lightMode' : 'darkMode'} />
    </button>
  )
}

function LandingLanguageToggle({ language, onLanguageChange }) {
  const isThai = language === 'th'
  const languageLabel = isThai ? 'เปลี่ยนเป็นภาษาอังกฤษ' : 'Switch to Thai'

  return (
    <button
      className="landing-language-circle"
      type="button"
      aria-label={languageLabel}
      title={languageLabel}
      onClick={() => onLanguageChange(isThai ? 'en' : 'th')}
    >
      <span lang={isThai ? 'th' : 'en'}>{isThai ? 'TH' : 'EN'}</span>
    </button>
  )
}

function LandingHeader({ page, user, onHome, onLearn, onOpenPage, onStart, onSignIn }) {
  const [menuOpen, setMenuOpen] = useState(false)

  function run(action) {
    setMenuOpen(false)
    action()
  }

  return (
    <header className="landing-header">
      <div className="landing-container landing-header__inner">
        <BrandButton onClick={onHome} />
        <nav className={`landing-nav ${menuOpen ? 'landing-nav--open' : ''}`} aria-label="Main navigation">
          <button className={page === 'home' ? 'is-active' : ''} type="button" onClick={() => run(onHome)}><PixelIcon name="home" /><span>Home</span></button>
          <button className={page === 'learn' ? 'is-active' : ''} type="button" onClick={() => run(onLearn)}><PixelIcon name="learn" /><span>Learn about</span></button>
          {user ? (
            <>
              <button type="button" onClick={() => run(() => onOpenPage?.('shop'))}><PixelIcon name="shop" /><span>Shop</span></button>
              <button type="button" onClick={() => run(() => onOpenPage?.('history'))}><PixelIcon name="history" /><span>History</span></button>
              <button type="button" onClick={() => run(() => onOpenPage?.('community'))}><PixelIcon name="community" /><span>Community</span></button>
            </>
          ) : null}
          {!user && <button type="button" onClick={() => run(onSignIn)}><AppIcon name="key" /><span>Log in</span></button>}
          <button className="landing-nav__cta" type="button" onClick={() => run(onStart)}>
            <PixelIcon name="lab" />
            <span>{user ? 'Open Plant Lab' : 'Start growing'}</span>
          </button>
        </nav>
        <div className="landing-header__actions">
          <button
            className="landing-menu"
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  )
}

function ProductTour() {
  const [activeStep, setActiveStep] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const interval = window.setInterval(() => {
      setActiveStep((step) => (step + 1) % tourSteps.length)
    }, 6000)
    return () => window.clearInterval(interval)
  }, [playing])

  function selectStep(index) {
    setActiveStep(index)
    setPlaying(false)
  }

  return (
    <section className="landing-section landing-product-tour" data-tour="home-game-preview" aria-labelledby="product-tour-title">
      <div className="landing-container">
        <div className="landing-section-heading landing-product-tour__heading" data-reveal="up">
          <div>
            <h2 id="product-tour-title">See one growing cycle in under a minute.</h2>
          </div>
          <p>A short visual tour shows how each decision becomes an observable result inside the plant lab.</p>
        </div>

        <div className="product-tour-player" data-reveal="up">
          <div className="product-tour-player__screen">
            {tourSteps.map((step, index) => (
              <div className={`product-tour-frame product-tour-frame--${step.focus} ${activeStep === index ? 'is-active' : ''}`} key={step.title} aria-hidden={activeStep !== index}>
                <img src="/media/plant-lab-preview-current-v1.png" alt="Current Plant Growth Academy simulation interface" />
                <div className="product-tour-frame__shade" />
                <div
                  className="product-tour-frame__spotlight"
                  style={{
                    '--tour-focus-x': step.spotlight.x,
                    '--tour-focus-y': step.spotlight.y,
                    '--tour-focus-width': step.spotlight.width,
                    '--tour-focus-height': step.spotlight.height,
                  }}
                  aria-hidden="true"
                >
                  <span>{String(index + 1).padStart(2, '0')} · {step.shortTitle}</span>
                </div>
              </div>
            ))}
            <div className="product-tour-player__chrome">
              <span><i /> Plant Growth Academy</span>
              <strong>SIMULATION PREVIEW</strong>
            </div>
            <div className={`product-tour-player__caption product-tour-player__caption--${tourSteps[activeStep].captionSide}`}>
              <span>{String(activeStep + 1).padStart(2, '0')} / {String(tourSteps.length).padStart(2, '0')}</span>
              <div>
                <strong>{tourSteps[activeStep].title}</strong>
                <p>{tourSteps[activeStep].description}</p>
              </div>
            </div>
            <button className="product-tour-player__control" type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause simulation preview' : 'Play simulation preview'}>
              <span className={playing ? 'is-pause' : 'is-play'} aria-hidden="true" />
            </button>
          </div>

          <div className="product-tour-timeline" role="tablist" aria-label="Simulation preview steps">
            {tourSteps.map((step, index) => (
              <button className={activeStep === index ? 'is-active' : ''} type="button" role="tab" aria-selected={activeStep === index} onClick={() => selectStep(index)} key={step.title}>
                <span className="product-tour-timeline__number">{String(index + 1).padStart(2, '0')}</span>
                <span><strong>{step.shortTitle}</strong></span>
                <i><b /></i>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function JourneyDetailModal({ index, onClose, onStart, step }) {
  return (
    <div
      className="landing-journey-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className={`landing-journey-modal landing-journey-modal--${index + 1}${index === 1 ? ' landing-journey-modal--landscape' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="journey-modal-title"
      >
        <button autoFocus className="landing-journey-modal__close" type="button" onClick={onClose} aria-label="Close step details">
          <AppIcon name="close" />
        </button>

        <div className="landing-journey-modal__media">
          <img className="landing-journey-modal__media-backdrop" src={step.image} alt="" aria-hidden="true" />
          <img className="landing-journey-modal__media-image" src={step.image} alt={step.imageAlt} />
          <div className="landing-journey-modal__media-shade" />
          <span className="landing-journey-modal__step">STEP {String(index + 1).padStart(2, '0')}</span>
          <span className="landing-journey-modal__image-note"><AppIcon name="eye" /> Full interface preview</span>
        </div>

        <div className="landing-journey-modal__content">
          <span className="landing-journey-modal__eyebrow">{step.eyebrow}</span>
          <h2 id="journey-modal-title">{step.title}</h2>
          <p className="landing-journey-modal__lead">{step.description}</p>
          <p className="landing-journey-modal__detail">{step.detail}</p>

          <div className="landing-journey-modal__highlights" aria-label="What you will do">
            {step.highlights.map((highlight, highlightIndex) => (
              <div key={highlight}>
                <span>{String(highlightIndex + 1).padStart(2, '0')}</span>
                <p>{highlight}</p>
              </div>
            ))}
          </div>

          <div className="landing-journey-modal__actions">
            <button className="landing-button landing-button--primary" type="button" onClick={() => { onClose(); onStart() }}>
              <AppIcon name="controller" />
              Start growing
              <AppIcon name="arrowForward" />
            </button>
            <button className="landing-button landing-button--secondary" type="button" onClick={onClose}>Back to the steps</button>
          </div>
        </div>
      </section>
    </div>
  )
}

function ModeExplorer({ user, onStart, onOpenDemo }) {
  const [activeModeKey, setActiveModeKey] = useState(growingModes[0].key)
  const activeMode = growingModes.find((mode) => mode.key === activeModeKey) ?? growingModes[0]

  function beginMode() {
    if (user) {
      onStart()
      return
    }
    onOpenDemo?.('lab')
  }

  return (
    <section className="landing-section landing-mode-explorer" aria-labelledby="mode-explorer-title">
      <div className="landing-container">
        <div className="landing-section-heading landing-mode-explorer__heading" data-reveal="up">
          <div>
            <h2 id="mode-explorer-title">One plant. Three ways to understand it.</h2>
          </div>
          <p>Start with a guided lab, respond to outdoor conditions, or follow a full seasonal journey. Your choice changes what you observe—not the quality of the lesson.</p>
        </div>

        <div className="landing-mode-explorer__layout" data-reveal="up">
          <div className="landing-mode-explorer__tabs" role="tablist" aria-label="Growing modes">
            {growingModes.map((mode, index) => (
              <button
                className={`landing-mode-card landing-mode-card--${mode.tone} ${activeModeKey === mode.key ? 'is-active' : ''}`}
                key={mode.key}
                type="button"
                role="tab"
                aria-selected={activeModeKey === mode.key}
                aria-controls={`mode-panel-${mode.key}`}
                onClick={() => setActiveModeKey(mode.key)}
              >
                <span className="landing-mode-card__number">0{index + 1}</span>
                <span className="landing-mode-card__icon">
                  <img src={mode.asset} alt="" aria-hidden="true" />
                </span>
                <span className="landing-mode-card__copy">
                  <small>{mode.eyebrow}</small>
                  <strong>{mode.title}</strong>
                  <span>{mode.meta}</span>
                </span>
                <AppIcon name="arrowForward" />
              </button>
            ))}
          </div>

          <div className={`landing-mode-explorer__panel landing-mode-explorer__panel--${activeMode.tone}`} id={`mode-panel-${activeMode.key}`} role="tabpanel" tabIndex={0}>
            <div className="landing-mode-explorer__asset" aria-hidden="true">
              <span className="landing-mode-explorer__asset-shadow" />
              <img src={activeMode.asset} alt={activeMode.assetAlt} />
            </div>
            <span className="landing-mode-explorer__panel-eyebrow">{activeMode.eyebrow}</span>
            <h3>{activeMode.title}</h3>
            <p>{activeMode.description}</p>
            <div className="landing-mode-explorer__panel-footer">
              <span><AppIcon name="check" /> {activeMode.meta}</span>
              <button className="landing-text-link" type="button" onClick={beginMode}>
                {user ? 'Open Plant Lab' : 'Try the preview'} <AppIcon name="arrowForward" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function InteractiveLabPreview({ onStart }) {
  const [values, setValues] = useState({ water: 72, light: 84, temperature: 26 })
  const [sceneEnabled, setSceneEnabled] = useState(false)
  const viewportRef = useRef(null)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return undefined
    if (!('IntersectionObserver' in window)) {
      const frame = window.requestAnimationFrame(() => setSceneEnabled(true))
      return () => window.cancelAnimationFrame(frame)
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setSceneEnabled(true)
      observer.disconnect()
    }, { rootMargin: '320px 0px' })

    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const plantState = useMemo(() => {
    const waterFit = 1 - Math.min(1, Math.abs(values.water - 70) / 70)
    const lightFit = 1 - Math.min(1, Math.abs(values.light - 80) / 80)
    const temperatureFit = 1 - Math.min(1, Math.abs(values.temperature - 25) / 18)
    const balance = Math.round(((waterFit + lightFit + temperatureFit) / 3) * 100)
    let visualOverrides = { leafColor: '#86bd70', stemColor: '#765b34', leafState: 'upright', stemState: 'upright', scale: 0.9 }

    if (values.temperature >= 34) {
      visualOverrides = { ...visualOverrides, leafColor: '#8e653b', stemColor: '#65452f', leafState: 'burnt_edges', stemState: 'dry', scale: 0.88 }
    } else if (values.temperature <= 16) {
      visualOverrides = { ...visualOverrides, leafColor: '#526f67', stemColor: '#5b5947', leafState: 'drooping', stemState: 'slow', scale: 0.89 }
    } else if (values.water <= 35) {
      visualOverrides = { ...visualOverrides, leafColor: '#82704a', stemColor: '#68503a', leafState: 'wilted', stemState: 'soft', scale: 0.86 }
    } else if (values.water >= 92) {
      visualOverrides = { ...visualOverrides, leafColor: '#456d58', stemColor: '#554d39', leafState: 'darkened', stemState: 'soft', scale: 0.9 }
    } else if (values.light <= 34) {
      visualOverrides = { ...visualOverrides, leafColor: '#a9a85c', stemColor: '#807044', leafState: 'yellowing', stemState: 'thin', scale: 0.88 }
    } else if (values.light >= 95) {
      visualOverrides = { ...visualOverrides, leafColor: '#9a7345', stemColor: '#62442d', leafState: 'burnt_edges', stemState: 'dry', scale: 0.88 }
    }

    const shared = { balance, health: Math.max(18, balance), visualOverrides }
    if (balance >= 88) return { ...shared, label: 'Stable response', labelTh: 'พืชตอบสนองได้ดี', icon: 'check', tone: 'healthy' }
    if (balance >= 64) return { ...shared, label: 'Needs a small adjustment', labelTh: 'ควรปรับเล็กน้อย', icon: 'warning', tone: 'watch' }
    return { ...shared, label: 'Plant under stress', labelTh: 'พืชกำลังเครียด', icon: 'warning', tone: 'danger' }
  }, [values])

  function updateValue(key, value) {
    setValues((current) => ({ ...current, [key]: Number(value) }))
  }

  const controls = [
    { key: 'water', icon: 'drop', label: 'Water', value: `${values.water}%`, min: 0, max: 100, step: 1 },
    { key: 'light', icon: 'bolt', label: 'Light', value: `${values.light}%`, min: 0, max: 100, step: 1 },
    { key: 'temperature', icon: 'temp', label: 'Temperature', value: `${values.temperature}°C`, min: 10, max: 40, step: 1 },
  ]

  return (
    <section className="landing-section landing-live-preview" aria-labelledby="live-preview-title">
      <div className="landing-container">
        <div className="landing-live-preview__shell" data-reveal="up">
          <div className="landing-live-preview__copy">
            <h2 id="live-preview-title">Make one change. See the plant answer.</h2>
            <p>Drag a control to preview how the lab explains cause and effect. This is a safe browser-only sample—your account and real simulations are untouched.</p>
            <div className={`landing-live-preview__status landing-live-preview__status--${plantState.tone}`}>
              <span><AppIcon name={plantState.icon} /></span>
              <div><strong>{plantState.label}</strong><small>{plantState.labelTh}</small></div>
            </div>
            <button className="landing-button landing-button--primary" type="button" onClick={onStart}>
              <AppIcon name="sprout" /> Start a real growing cycle <AppIcon name="arrowForward" />
            </button>
          </div>

          <div className="landing-live-preview__stage">
            <div className="landing-live-preview__stage-header">
              <span><i /><i /><i /></span>
              <strong>PLANT LAB / LOCAL PREVIEW</strong>
              <span aria-hidden="true" />
            </div>
            <div className="landing-live-preview__viewport" ref={viewportRef}>
              {sceneEnabled && (
                <Suspense fallback={<div className="landing-live-preview__loading"><i /><span>Loading Elephant Ear model...</span></div>}>
                  <div className="landing-live-preview__canvas" aria-label="Interactive 3D Elephant Ear plant preview">
                    <LandingPlantPreview3D
                      health={plantState.health}
                      light={values.light}
                      visualOverrides={plantState.visualOverrides}
                      water={values.water}
                    />
                  </div>
                </Suspense>
              )}
              {!sceneEnabled && <div className="landing-live-preview__loading"><i /><span>3D preview loads when visible</span></div>}
              <span className="landing-live-preview__orbit-hint"><AppIcon name="move" /> Drag to rotate · Scroll to zoom</span>
              <div className="landing-live-preview__plant-readout">
                <span>Plant response</span>
                <strong>{plantState.label}</strong>
                <div className="landing-live-preview__mini-meter"><i style={{ '--meter': `${Math.max(8, plantState.balance)}%` }} /></div>
              </div>
            </div>
            <div className="landing-live-preview__controls" aria-label="Preview controls">
              {controls.map((control) => (
                <label className="landing-live-control" key={control.key}>
                  <span className="landing-live-control__label"><span><AppIcon name={control.icon} />{control.label}</span><strong>{control.value}</strong></span>
                  <input aria-label={`${control.label} preview`} type="range" min={control.min} max={control.max} step={control.step} value={values[control.key]} onChange={(event) => updateValue(control.key, event.target.value)} />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HomePage({ user, onStart, onLearn, onOpenPage, onOpenDemo, plantCount = 0 }) {
  const [selectedJourneyIndex, setSelectedJourneyIndex] = useState(null)
  const selectedJourney = selectedJourneyIndex === null ? null : journeySteps[selectedJourneyIndex]

  useEffect(() => {
    if (!selectedJourney) return undefined

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelectedJourneyIndex(null)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [selectedJourney])

  return (
    <>
      <section className="landing-hero landing-hero--quest-banner" data-tour="home-hero">
        <img
          className="landing-hero__image"
          src="/media/landing-game-ui/plant-academy-cavern-hero-v1.png"
          alt="Pixel art botanical field laboratory hidden inside a glowing underground cavern"
        />
        <div className="landing-hero__shade" />
        <HeroParticles />
        <div className="landing-container landing-hero__content landing-hero__content--banner">
          <div className="landing-hero__copy">
            <h1>
              <span>Growth a plant.</span>
              <span>Understand the science.</span>
            </h1>
            <p className="landing-hero__tagline">
              Plant Growth Academy is a learning simulation where you shape a 3D plant's environment,
              observe its response, and build real understanding through every growing cycle.
            </p>
            <div className="landing-actions landing-hero__actions">
              <GameButton className="landing-hero__start" data-tour="home-start" onClick={onStart}>
                <PixelIcon name="lab" />
                {user ? 'Continue your experiment' : 'Play the simulation'}
                <AppIcon name="arrowForward" />
              </GameButton>
            </div>
            <button
              className="landing-hero__secondary"
              type="button"
              onClick={() => document.querySelector('.landing-product-tour')?.scrollIntoView({ behavior: 'smooth' })}
            >
              See how the field lab works <AppIcon name="arrowForward" />
            </button>
          </div>

        </div>

        <button
          className="landing-scroll-cue"
          type="button"
          aria-label="Scroll to explore"
          onClick={() => document.querySelector('.landing-home-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          <span>Scroll to explore</span>
          <i aria-hidden="true" />
        </button>
      </section>

      <div className="landing-home-content particle-network-surface">
        <ParticleNetworkBackground variant="green" />

        <section className="landing-game-summary" aria-label="Simulation highlights">
          <div className="landing-container landing-game-summary__grid">
            <div><strong>3D</strong><span>living plant simulation</span></div>
            <div><strong>6</strong><span>connected growth factors</span></div>
            <div><strong>{plantCount || '—'}</strong><span>plant species to explore</span></div>
            <div><strong>∞</strong><span>experiments to compare</span></div>
          </div>
        </section>

        <ModeExplorer user={user} onStart={onStart} onOpenDemo={onOpenDemo} />

      <section className="landing-section landing-game-intro" id="about">
        <div className="landing-container">
          <div className="landing-game-intro__copy" data-reveal="up">
            <h2>A science learning simulation built around meaningful choices.</h2>
            <p>Instead of memorizing plant facts, you investigate them. Every adjustment changes the simulation, giving you clear feedback to observe, question, and understand.</p>
          </div>
          <div className="landing-game-intro__pillars">
            {features.slice(0, 3).map((feature, index) => (
              <GamePanel as="article" data-reveal="up" key={feature.title} style={{ '--reveal-delay': `${index * 90}ms` }}>
                <span>0{index + 1}</span>
                <div className="landing-icon-box"><PixelIcon name={index === 0 ? 'lab' : index === 1 ? 'history' : 'community'} /></div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </GamePanel>
            ))}
          </div>
        </div>
      </section>

      <ProductTour />

      <InteractiveLabPreview onStart={onStart} />

      <section className="landing-section landing-journey" aria-labelledby="journey-title">
        <div className="landing-container">
          <div className="landing-section-heading landing-section-heading--center" data-reveal="up">
            <h2 id="journey-title">From first login to your first harvest.</h2>
            <p>Four clear steps help new players begin quickly while leaving room for deeper experimentation.</p>
          </div>
          <div className="landing-journey__grid">
            {journeySteps.map((step, index) => (
              <GamePanel
                as="article"
                aria-haspopup="dialog"
                aria-label={`View details: ${step.title}`}
                data-reveal="up"
                key={step.title}
                onClick={() => setSelectedJourneyIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedJourneyIndex(index)
                  }
                }}
                role="button"
                style={{ '--reveal-delay': `${index * 80}ms` }}
                tabIndex={0}
              >
                <div className={`landing-journey__visual landing-journey__visual--${index + 1}`}>
                  <img src={step.image} alt={step.imageAlt} />
                  <strong>0{index + 1}</strong>
                </div>
                <div className="landing-journey__content">
                  <span className="landing-journey__icon"><AppIcon name={step.icon} /></span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <div className="landing-journey__open">View full step <AppIcon name="arrowForward" /></div>
                </div>
              </GamePanel>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-spaces" aria-labelledby="spaces-title">
        <div className="landing-container">
          <div className="landing-section-heading landing-spaces__heading" data-reveal="up">
            <div>
              <h2 id="spaces-title">Every page supports the next experiment.</h2>
            </div>
            <p>The lab, learning content, tools, records, and community work together as one connected experience.</p>
          </div>
          <div className="landing-spaces__grid">
            {gameSpaces.map((space, index) => (
              <article className={`landing-space-card landing-space-card--${space.preview}`} data-reveal="up" key={space.page} style={{ '--reveal-delay': `${(index % 3) * 80}ms` }}>
                <div className="landing-space-card__preview">
                  <img src={space.image} alt={space.imageAlt} loading="lazy" decoding="async" />
                  <span className="landing-space-card__icon"><PixelIcon name={space.page === 'settings' ? 'lab' : space.page} /></span>
                </div>
                <div className="landing-space-card__body">
                  <small>{space.eyebrow}</small>
                  <h3>{space.title}</h3>
                  <p>{space.description}</p>
                  <button
                    data-testid={`landing-demo-${space.page}`}
                    type="button"
                    onClick={() => {
                      if (space.page === 'learn') {
                        onLearn()
                        return
                      }
                      if (user) onOpenPage(space.page)
                      else onOpenDemo(space.page)
                    }}
                  >
                    {user
                      ? `Explore ${space.title}`
                      : space.page === 'learn'
                        ? 'Learn more'
                        : `Try ${space.title} preview`}
                    <AppIcon name="arrowForward" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-science-bridge">
        <div className="landing-container landing-science-bridge__inner" data-reveal="up">
          <div className="landing-science-bridge__visual">
            <span><AppIcon name="bolt" />Light</span>
            <i>+</i>
            <span><AppIcon name="drop" />Water</span>
            <i>+</i>
            <span><AppIcon name="air" />CO₂</span>
            <i>→</i>
            <span><AppIcon name="eco" />Growth</span>
          </div>
          <div>
            <h2>Every control connects to real plant science.</h2>
            <p>Use the Knowledge Library to understand plant structures, environmental factors, and photosynthesis—then test those ideas in the simulation.</p>
            <button className="landing-text-link" type="button" onClick={onLearn}>Open the Knowledge Library<AppIcon name="arrowForward" /></button>
          </div>
        </div>
      </section>

      <section className="landing-section landing-final-cta">
        <div className="landing-container landing-final-cta__inner" data-reveal="up">
          <div className="landing-final-cta__icon">
            <img src={plantGrowthLogo} alt="Plant Growth Academy" />
          </div>
          <h2>Start with one plant. Leave with a better question.</h2>
          <p>Sign in to begin your first growing cycle and keep every result connected to your learner profile.</p>
          <GameButton onClick={onStart}>
            <PixelIcon name="lab" />
            {user ? 'Continue your experiment' : 'Continue with Google and play'}
            <AppIcon name="arrowForward" />
          </GameButton>
        </div>
      </section>
      </div>
      {selectedJourney ? (
        <JourneyDetailModal
          index={selectedJourneyIndex}
          onClose={() => setSelectedJourneyIndex(null)}
          onStart={onStart}
          step={selectedJourney}
        />
      ) : null}
    </>
  )
}

function getContentLanguage() {
  return document.documentElement.lang === 'th' ? 'th' : 'en'
}

function localizedContent(content, field, language) {
  if (language === 'th' && content?.[`${field}_th`]) return content[`${field}_th`]
  return content?.[field] ?? ''
}

const articleAllowedStyles = new Set([
  'background-color', 'border', 'border-color', 'border-style', 'border-width',
  'color', 'float', 'font-family', 'font-size', 'height', 'list-style-type',
  'margin', 'margin-left', 'margin-right', 'max-width', 'min-width',
  'text-align', 'width',
])

function articleColorLuminance(value) {
  const color = String(value ?? '').trim().toLowerCase()
  if (!color || color === 'transparent') return null

  const namedColors = {
    black: 0,
    white: 1,
  }
  if (Object.hasOwn(namedColors, color)) return namedColors[color]

  const hexMatch = color.match(/^#([\da-f]{3,8})$/i)
  if (hexMatch) {
    let hex = hexMatch[1]
    if (hex.length === 3 || hex.length === 4) hex = hex.split('').map((part) => part + part).join('')
    if (hex.length === 6 || hex.length === 8) {
      const red = Number.parseInt(hex.slice(0, 2), 16)
      const green = Number.parseInt(hex.slice(2, 4), 16)
      const blue = Number.parseInt(hex.slice(4, 6), 16)
      return ((red * 0.2126) + (green * 0.7152) + (blue * 0.0722)) / 255
    }
  }

  const rgbMatch = color.match(/^rgba?\(\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?/i)
  if (rgbMatch) {
    const usesPercent = color.slice(0, color.indexOf(')')).includes('%')
    const scale = usesPercent ? 2.55 : 1
    const red = Math.min(255, Number(rgbMatch[1]) * scale)
    const green = Math.min(255, Number(rgbMatch[2]) * scale)
    const blue = Math.min(255, Number(rgbMatch[3]) * scale)
    return ((red * 0.2126) + (green * 0.7152) + (blue * 0.0722)) / 255
  }

  const hslMatch = color.match(/^hsla?\(\s*[-\d.]+(?:deg)?\s*[, ]\s*[\d.]+%\s*[, ]\s*([\d.]+)%/i)
  if (hslMatch) return Math.min(1, Number(hslMatch[1]) / 100)

  return null
}

function articleStyleConflictsWithDarkTheme(property, value) {
  const luminance = articleColorLuminance(value)
  if (luminance === null) return false
  if (property === 'background-color') return luminance >= 0.78
  if (property === 'color') return luminance <= 0.28
  return false
}

function articleMediaEmbedUrl(value) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    let mediaId = ''

    if (host === 'youtu.be') mediaId = url.pathname.split('/').filter(Boolean)[0] ?? ''
    if (host === 'youtube.com') {
      mediaId = url.searchParams.get('v') ?? ''
      if (!mediaId && /^\/(embed|shorts)\//.test(url.pathname)) mediaId = url.pathname.split('/')[2] ?? ''
    }
    if (/^[\w-]{6,20}$/.test(mediaId)) return `https://www.youtube-nocookie.com/embed/${mediaId}`

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      mediaId = url.pathname.split('/').filter(Boolean).find((part) => /^\d+$/.test(part)) ?? ''
      if (mediaId) return `https://player.vimeo.com/video/${mediaId}`
    }
  } catch {
    // Unsupported or malformed media URLs are removed by the sanitizer.
  }
  return ''
}

function isSafeWebUrl(value) {
  try {
    const url = new URL(value, window.location.origin)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isTrustedMediaEmbedSrc(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    if (url.hostname === 'www.youtube-nocookie.com') return /^\/embed\/[\w-]{6,20}$/.test(url.pathname)
    if (url.hostname === 'player.vimeo.com') return /^\/video\/\d+$/.test(url.pathname)
  } catch {
    // Invalid embed URLs are rejected.
  }
  return false
}

function sanitizeArticleHtml(html) {
  const documentFragment = new DOMParser().parseFromString(String(html ?? ''), 'text/html')
  const allowedTags = new Set([
    'A', 'BLOCKQUOTE', 'BR', 'CODE', 'DIV', 'EM', 'FIGCAPTION', 'FIGURE',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'IFRAME', 'IMG', 'LI', 'OL',
    'P', 'PRE', 'S', 'SECTION', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TABLE',
    'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'U', 'UL',
  ])
  const removeWithContents = new Set(['EMBED', 'FORM', 'INPUT', 'LINK', 'META', 'NOSCRIPT', 'OBJECT', 'SCRIPT', 'STYLE', 'TEMPLATE'])
  const allowedGlobalAttributes = new Set(['class', 'id', 'style', 'title'])

  documentFragment.body.querySelectorAll('oembed').forEach((element) => {
    const src = articleMediaEmbedUrl(element.getAttribute('url') ?? '')
    if (!src) {
      element.remove()
      return
    }
    const iframe = documentFragment.createElement('iframe')
    iframe.setAttribute('src', src)
    iframe.setAttribute('title', 'Embedded educational video')
    element.replaceWith(iframe)
  })

  documentFragment.body.querySelectorAll('*').forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      if (removeWithContents.has(element.tagName)) element.remove()
      else element.replaceWith(...element.childNodes)
      return
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      if (allowedGlobalAttributes.has(name)) return
      if (element.tagName === 'A' && name === 'href' && isSafeWebUrl(attribute.value)) return
      if (element.tagName === 'IMG' && ['src', 'alt', 'width', 'height', 'loading'].includes(name) && (name !== 'src' || isSafeWebUrl(attribute.value))) return
      if (element.tagName === 'IFRAME' && name === 'src' && isTrustedMediaEmbedSrc(attribute.value)) return
      if (['TD', 'TH'].includes(element.tagName) && ['colspan', 'rowspan'].includes(name)) return
      if (element.tagName === 'OL' && ['start', 'reversed'].includes(name)) return
      if (element.tagName === 'LI' && name === 'value') return
      element.removeAttribute(attribute.name)
    })

    if (element.hasAttribute('style')) {
      const safeDeclarations = []
      Array.from(element.style).forEach((property) => {
        const value = element.style.getPropertyValue(property).trim()
        if (
          articleAllowedStyles.has(property)
          && !/(url\s*\(|expression|javascript:)/i.test(value)
          && !articleStyleConflictsWithDarkTheme(property, value)
        ) {
          safeDeclarations.push(`${property}:${value}`)
        }
      })
      if (safeDeclarations.length) element.setAttribute('style', safeDeclarations.join(';'))
      else element.removeAttribute('style')
    }

    if (element.tagName === 'A' && element.hasAttribute('href')) {
      element.setAttribute('target', '_blank')
      element.setAttribute('rel', 'noreferrer noopener')
    }
    if (element.tagName === 'IMG' && element.hasAttribute('src')) {
      element.setAttribute('src', resolveAssetUrl(element.getAttribute('src')))
      element.setAttribute('loading', 'lazy')
    }
    if (element.tagName === 'IFRAME' && element.hasAttribute('src')) {
      element.setAttribute('loading', 'lazy')
      element.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share')
      element.setAttribute('allowfullscreen', '')
      element.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
      element.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation')
    }
  })

  return documentFragment.body.innerHTML
}

function LearningContentCard({ article, language, onOpen, index }) {
  const title = localizedContent(article, 'title', language)
  const summary = localizedContent(article, 'summary', language)
  const imageAlt = localizedContent(article, 'cover_image_alt', language)

  return (
    <GamePanel as="article" className="learning-content-card" style={{ '--reveal-delay': `${index * 90}ms` }}>
      <button type="button" onClick={() => onOpen(article.slug)} aria-label={`${language === 'th' ? 'เปิดบทความ' : 'Open article'}: ${title}`}>
        <div className="learning-content-card__image">
          {article.cover_image_url
            ? <img src={resolveAssetUrl(article.cover_image_url)} alt={imageAlt} />
            : <div className="learning-content-card__placeholder"><PixelIcon name="learn" /></div>}
          <span className="learning-content-card__number">0{index + 1}</span>
        </div>
        <div className="learning-content-card__body">
          <div className="learning-content-card__meta">
            <span><AppIcon name={article.icon || 'eco'} />{localizedContent(article, 'eyebrow', language)}</span>
            <span><AppIcon name="history" />{article.reading_minutes} {language === 'th' ? 'นาที' : 'min read'}</span>
          </div>
          <h2>{title}</h2>
          <p>{summary}</p>
          <span className="learning-content-card__link">
            {language === 'th' ? 'อ่านเนื้อหา' : 'Read article'}
            <AppIcon name="arrowForward" />
          </span>
        </div>
      </button>
    </GamePanel>
  )
}

function LearningLibrary({ onOpenArticle }) {
  const [articles, setArticles] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const language = getContentLanguage()

  useEffect(() => {
    let cancelled = false

    async function loadArticles() {
      setStatus('loading')
      setError('')
      try {
        const payload = await getLearningContents()
        if (!cancelled) {
          setArticles(payload.data ?? [])
          setStatus('ready')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || 'Unable to load learning content')
          setStatus('error')
        }
      }
    }

    loadArticles()
    return () => { cancelled = true }
  }, [reloadKey])

  return (
    <section className="landing-section learning-library" data-tour="learn-library" aria-labelledby="learning-library-title">
      <div className="landing-container">
        <div className="learning-library__heading" data-reveal="up">
          <div>
            <h2 id="learning-library-title">Choose a topic and explore it in depth.</h2>
          </div>
          <p>Three focused lessons connect plant biology to the decisions you make inside the simulation.</p>
        </div>

        {status === 'loading' && (
          <div className="learning-content-grid" aria-label="Loading learning content">
            {[0, 1, 2].map((item) => <div className="learning-content-skeleton" key={item} />)}
          </div>
        )}

        {status === 'error' && (
          <div className="learning-content-error" role="alert">
            <AppIcon name="eco" />
            <div><strong>Learning content is temporarily unavailable.</strong><span>{error}</span></div>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Try again</button>
          </div>
        )}

        {status === 'ready' && (
          <div className="learning-content-grid">
            {articles.map((article, index) => (
              <LearningContentCard article={article} index={index} key={article.slug} language={language} onOpen={onOpenArticle} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function LearningArticlePage({ slug, user, onBack, onStart }) {
  const [article, setArticle] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const language = getContentLanguage()

  useEffect(() => {
    let cancelled = false

    getLearningContent(slug)
      .then((payload) => {
        if (!cancelled) {
          setArticle(payload.data ?? payload)
          setStatus('ready')
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError.message || 'Unable to load this article')
          setStatus('error')
        }
      })

    return () => { cancelled = true }
  }, [slug])

  const safeHtml = useMemo(() => sanitizeArticleHtml(localizedContent(article, 'body_html', language)), [article, language])

  if (status === 'loading') {
    return (
      <section className="learning-article-state" aria-label="Loading article">
        <span className="learning-article-state__spinner" />
        <strong>Preparing the lesson...</strong>
      </section>
    )
  }

  if (status === 'error' || !article) {
    return (
      <section className="learning-article-state">
        <AppIcon name="eco" />
        <h1>We could not open this lesson.</h1>
        <p>{error}</p>
        <button className="landing-button landing-button--secondary" type="button" onClick={onBack}>Back to learning library</button>
      </section>
    )
  }

  const title = localizedContent(article, 'title', language)
  const summary = localizedContent(article, 'summary', language)
  const imageAlt = localizedContent(article, 'cover_image_alt', language)

  return (
    <article className="learning-article">
      <header className="learning-article-hero">
        <div className="landing-container learning-article-hero__grid">
          <div className="learning-article-hero__copy">
            <button className="landing-text-link landing-text-link--back" type="button" onClick={onBack}>
              <AppIcon name="arrowBack" /> Back to learning library
            </button>
            <h1>{title}</h1>
            <p>{summary}</p>
            <div className="learning-article-hero__meta">
              <span><AppIcon name="history" />{article.reading_minutes} {language === 'th' ? 'นาที' : 'minute read'}</span>
              <span><AppIcon name="check" />Reviewed educational sources</span>
            </div>
          </div>
          <figure className="learning-article-hero__figure">
            <img src={resolveAssetUrl(article.cover_image_url)} alt={imageAlt} />
            {article.image_credit && (
              <figcaption>
                Image: <a href={article.image_credit_url} target="_blank" rel="noreferrer">{article.image_credit}</a>
              </figcaption>
            )}
          </figure>
        </div>
      </header>

      <div className="landing-container learning-article-layout">
        <div className="learning-article-body" dangerouslySetInnerHTML={{ __html: safeHtml }} />
        <aside className="learning-article-aside">
          <GamePanel className="learning-article-aside__card">
            <span className="learning-article-aside__icon"><PixelIcon name="learn" /></span>
            <h2>Source notes</h2>
            <p>This lesson is paraphrased and organized for learning. Use the original sources for further study.</p>
          </GamePanel>
          <GamePanel className="learning-article-aside__card">
            <h2>References</h2>
            <ol>
              {(article.references ?? []).map((reference) => (
                <li key={reference.url}>
                  <a href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a>
                  <span>{reference.organization}</span>
                </li>
              ))}
            </ol>
          </GamePanel>
        </aside>
      </div>

      <section className="landing-section learning-article-cta">
        <div className="landing-container learning-article-cta__inner">
          <div><h2>Test the idea in the plant lab.</h2></div>
          <GameButton onClick={onStart}>
            <PixelIcon name="lab" />{user ? 'Enter the plant lab' : 'Log in to start'}<AppIcon name="arrowForward" />
          </GameButton>
        </div>
      </section>
    </article>
  )
}

function LearnPage({ user, onHome, onStart, onOpenArticle }) {
  return (
    <>
      <section className="landing-learn-hero" data-tour="learn-hero">
        <img className="landing-learn-hero__image" src={learnAboutPlantsBanner} alt="" aria-hidden="true" />
        <div className="landing-learn-hero__shade" aria-hidden="true" />
        <div className="landing-container">
          <button className="landing-text-link landing-text-link--back" type="button" onClick={onHome}>
            <AppIcon name="arrowBack" /> Back to home
          </button>
          <h1>The science behind every new leaf.</h1>
          <p>Understand the six environmental factors that shape plant health before applying them in the simulation.</p>
        </div>
      </section>

      <div className="landing-learn-content particle-network-surface">
        <ParticleNetworkBackground />

        <LearningLibrary onOpenArticle={onOpenArticle} />

        <section className="landing-section landing-section--intro">
          <div className="landing-container landing-split">
            <div data-reveal="left">
              <h2>Photosynthesis powers plant life.</h2>
              <p className="landing-lead">
                Plants combine light energy, water, and carbon dioxide to produce glucose for growth and release oxygen.
                Healthy leaves and balanced conditions help this process work efficiently.
              </p>
              <div className="landing-equation">6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂</div>
            </div>
            <div className="landing-process-card" data-reveal="right">
              <div><PixelIcon name="light" /><span>Light energy</span></div>
              <AppIcon className="landing-process-card__arrow" name="arrowDown" />
              <div><PixelIcon name="nutrients" /><span>Leaves create food</span></div>
              <AppIcon className="landing-process-card__arrow" name="arrowDown" />
              <div><PixelIcon name="air" /><span>Oxygen is released</span></div>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--factors" data-tour="learn-factors">
          <div className="landing-container">
            <div className="landing-section-heading landing-section-heading--center" data-reveal="up">
              <h2>Six factors, one connected system.</h2>
              <p>Use these principles to diagnose problems and make better decisions inside the plant lab.</p>
            </div>
            <div className="landing-factor-grid">
              {factors.map((factor, index) => (
                <GamePanel as="article" className="landing-factor-card" data-reveal="up" key={factor.title} style={{ '--reveal-delay': `${index * 65}ms` }}>
                  <div className="landing-icon-box"><PixelIcon name={factor.title.toLowerCase()} /></div>
                  <div className="landing-factor-card__title"><h3>{factor.title}</h3><strong>{factor.value}</strong></div>
                  <p>{factor.description}</p>
                </GamePanel>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-final-cta">
          <div className="landing-container landing-final-cta__inner" data-reveal="up">
            <div className="landing-final-cta__icon"><PixelIcon name="lab" /></div>
            <h2>Put the science into practice.</h2>
            <p>Enter the simulation, tune the environment, and observe how every decision changes your plant.</p>
            <GameButton onClick={onStart}>
              <PixelIcon name="lab" />
              {user ? 'Enter the plant lab' : 'Log in to start'}
              <AppIcon name="arrowForward" />
            </GameButton>
          </div>
        </section>
      </div>
    </>
  )
}

function LandingFooter({ onHome, onLearn }) {
  return (
    <footer className="landing-footer">
      <div className="landing-container landing-footer__inner">
        <BrandButton compact onClick={onHome} />
        <nav aria-label="Footer navigation">
          <button type="button" onClick={onHome}>Home</button>
          <button type="button" onClick={onLearn}>Learn about</button>
        </nav>
        <small>© 2026 Plant Growth Academy</small>
      </div>
    </footer>
  )
}

function ScrollGrowthHud({ language, pageKey }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let animationFrame = 0
    const scrollContainer = document.querySelector('.landing-shell')

    const updateProgress = () => {
      animationFrame = 0
      if (!scrollContainer) return
      const scrollableDistance = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)
      const nextProgress = scrollableDistance > 0
        ? Math.min(100, Math.max(0, Math.round((scrollContainer.scrollTop / scrollableDistance) * 100)))
        : 0
      setProgress((current) => current === nextProgress ? current : nextProgress)
    }

    const scheduleUpdate = () => {
      if (animationFrame) return
      animationFrame = window.requestAnimationFrame(updateProgress)
    }

    const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(scheduleUpdate) : null
    if (scrollContainer) resizeObserver?.observe(scrollContainer)
    scrollContainer?.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    scheduleUpdate()

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      scrollContainer?.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [pageKey])

  const stageIndex = progress < 20 ? 0 : progress < 40 ? 1 : progress < 70 ? 2 : progress < 100 ? 3 : 4
  const stageLabels = language === 'th'
    ? ['เมล็ด', 'เริ่มงอก', 'ต้นอ่อน', 'เริ่มออกดอก', 'โตเต็มที่']
    : ['Seed', 'Sprout', 'Young plant', 'Flower bud', 'Full bloom']

  return (
    <aside
      className={`landing-growth-hud landing-growth-hud--stage-${stageIndex}`}
      aria-label={language === 'th' ? `ความคืบหน้าการเลื่อน ${progress} เปอร์เซ็นต์ ระยะ${stageLabels[stageIndex]}` : `Scroll progress ${progress} percent, ${stageLabels[stageIndex]} stage`}
      style={{ '--growth-progress': `${progress}%`, '--growth-stage': stageIndex }}
    >
      <div className="landing-growth-hud__sprite" aria-hidden="true">
        <img src="/media/landing-game-ui/sunflower-scroll-growth-sprites-v1.png" alt="" />
      </div>
      <div className="landing-growth-hud__readout">
        <strong>{progress}%</strong>
        <span>{stageLabels[stageIndex]}</span>
      </div>
    </aside>
  )
}

export function LandingPage({ page = 'home', user, onHome, onLearn, onStart, onSignIn, onOpenPage, onOpenDemo, plantCount = 0 }) {
  const [articleSlug, setArticleSlug] = useState(null)
  const [language, setLanguage] = useState(() => loadSettings().language === 'th' ? 'th' : 'en')
  const [theme, setTheme] = useState(() => {
    try {
      const storedTheme = window.localStorage.getItem(LANDING_THEME_KEY)
      return storedTheme === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  function changeLanguage(nextLanguage) {
    const normalizedLanguage = nextLanguage === 'th' ? 'th' : 'en'
    setLanguage(normalizedLanguage)
    saveSettings({ ...loadSettings(), language: normalizedLanguage })
  }

  function changeTheme(nextTheme) {
    const normalizedTheme = nextTheme === 'light' ? 'light' : 'dark'
    setTheme(normalizedTheme)
    try {
      window.localStorage.setItem(LANDING_THEME_KEY, normalizedTheme)
    } catch {
      // Theme still works for this visit when storage is unavailable.
    }
  }

  function openHome() {
    setArticleSlug(null)
    onHome()
  }

  function openLearningLibrary() {
    setArticleSlug(null)
    onLearn()
  }

  function openArticle(slug) {
    setArticleSlug(slug)
  }

  useEffect(() => {
    const shell = document.querySelector('.landing-shell')
    if (shell) shell.scrollTop = 0
    const elements = shell?.querySelectorAll('[data-reveal]') ?? []

    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'))
      return undefined
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { root: shell, rootMargin: '0px 0px -10% 0px', threshold: 0.12 })

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [articleSlug, page])

  return (
    <main className="landing-shell" data-theme={theme}>
      <LandingHeader page={page} user={user} onHome={openHome} onLearn={openLearningLibrary} onOpenPage={onOpenPage} onStart={onStart} onSignIn={onSignIn} />
      <div className="landing-display-controls" aria-label={language === 'th' ? 'การตั้งค่าการแสดงผล' : 'Display preferences'}>
        <LandingLanguageToggle language={language} onLanguageChange={changeLanguage} />
        <LandingThemeToggle language={language} theme={theme} onThemeChange={changeTheme} />
      </div>
      {page === 'learn'
        ? articleSlug
          ? <LearningArticlePage key={articleSlug} slug={articleSlug} user={user} onBack={openLearningLibrary} onStart={onStart} />
          : <LearnPage user={user} onHome={openHome} onOpenArticle={openArticle} onStart={onStart} />
        : <HomePage user={user} onStart={onStart} onLearn={openLearningLibrary} onOpenPage={onOpenPage} onOpenDemo={onOpenDemo} plantCount={plantCount} />}
      <ScrollGrowthHud language={language} pageKey={`${page}:${articleSlug ?? 'library'}`} />
      <LandingFooter onHome={openHome} onLearn={openLearningLibrary} />
    </main>
  )
}
