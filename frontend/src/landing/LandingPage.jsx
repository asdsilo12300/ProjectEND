import { useEffect, useMemo, useState } from 'react'
import heroImage from '../assets/hero.png'
import plantGrowthLogo from '../assets/Logo for Plant Growth Academy Simulation Game-Photoroom.png'
import { AppIcon } from '../game/icons/IconifyIcon'
import { loadSettings, saveSettings } from '../game/settings/settingsPreferences'
import { getLearningContent, getLearningContents } from '../lib/api'
import './LandingPage.css'

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
    title: 'Choose a plant and prepare the lab',
    description: 'Select a plant from your collection, inspect its profile, and start with a clear growing goal.',
    focus: 'assets',
  },
  {
    title: 'Tune the growing environment',
    description: 'Balance water, light, fertilizer, soil, air, and temperature with responsive laboratory controls.',
    focus: 'environment',
  },
  {
    title: 'Observe, diagnose, and improve',
    description: 'Watch the 3D plant respond, monitor health and growth, then use evidence to improve the next cycle.',
    focus: 'plant',
  },
]

const journeySteps = [
  { icon: 'person', title: 'Create your learner profile', description: 'Sign in to keep every plant, item, achievement, and experiment connected to your account.' },
  { icon: 'sprout', title: 'Select your first plant', description: 'Choose a plant, review its needs, and decide whether to grow in the controlled lab or outdoors.' },
  { icon: 'controller', title: 'Run the experiment', description: 'Adjust environmental factors and observe cause and effect through the live 3D simulation.' },
  { icon: 'history', title: 'Review and grow smarter', description: 'Harvest when ready, save the result, and compare your history before starting the next plant.' },
]

const gameSpaces = [
  { page: 'lab', icon: 'controller', title: 'Plant Lab', eyebrow: 'Core experience', description: 'Grow a living 3D plant and control the conditions around it in real time.', preview: 'lab' },
  { page: 'shop', icon: 'shop', title: 'Shop', eyebrow: 'Tools & supplies', description: 'Use earned coins to unlock practical tools for pests and plant care.', preview: 'shop' },
  { page: 'history', icon: 'history', title: 'History', eyebrow: 'Experiment records', description: 'Revisit completed sessions, scores, conditions, and saved evidence.', preview: 'history' },
  { page: 'community', icon: 'groups', title: 'Community', eyebrow: 'Learn together', description: 'Share observations, view live gardens, and learn from other growers.', preview: 'community' },
  { page: 'learn', icon: 'bookmark', title: 'Knowledge Library', eyebrow: 'Research-backed lessons', description: 'Read focused lessons about plants, environmental factors, and photosynthesis.', preview: 'learn' },
  { page: 'settings', icon: 'settings', title: 'Settings', eyebrow: 'Made for you', description: 'Choose your language and adjust display, accessibility, and account preferences.', preview: 'settings' },
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

function LandingHeader({ language, onLanguageChange, page, user, onHome, onLearn, onStart, onSignIn }) {
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
          <button className={page === 'home' ? 'is-active' : ''} type="button" onClick={() => run(onHome)}>Home</button>
          <button className={page === 'learn' ? 'is-active' : ''} type="button" onClick={() => run(onLearn)}>Learn about</button>
          <div className="landing-language-toggle" role="group" aria-label="Interface language">
            <button className={language === 'en' ? 'is-active' : ''} type="button" aria-pressed={language === 'en'} onClick={() => onLanguageChange('en')}>EN</button>
            <button className={language === 'th' ? 'is-active' : ''} type="button" aria-pressed={language === 'th'} onClick={() => onLanguageChange('th')}>ไทย</button>
          </div>
          {!user && <button type="button" onClick={() => run(onSignIn)}>Log in</button>}
          <button className="landing-nav__cta" type="button" onClick={() => run(onStart)}>
            <AppIcon name="sprout" />
            Start growing
          </button>
        </nav>
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
    </header>
  )
}

function SectionEyebrow({ icon = 'eco', children }) {
  return (
    <div className="landing-eyebrow">
      <AppIcon name={icon} />
      <span>{children}</span>
    </div>
  )
}

function ProductTour() {
  const [activeStep, setActiveStep] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const interval = window.setInterval(() => {
      setActiveStep((step) => (step + 1) % tourSteps.length)
    }, 4600)
    return () => window.clearInterval(interval)
  }, [playing])

  function selectStep(index) {
    setActiveStep(index)
    setPlaying(false)
  }

  return (
    <section className="landing-section landing-product-tour" aria-labelledby="product-tour-title">
      <div className="landing-container">
        <div className="landing-section-heading landing-product-tour__heading" data-reveal="up">
          <div>
            <SectionEyebrow icon="live">A guided game preview</SectionEyebrow>
            <h2 id="product-tour-title">See one growing cycle in under a minute.</h2>
          </div>
          <p>A short visual tour shows how each decision becomes an observable result inside the plant lab.</p>
        </div>

        <div className="product-tour-player" data-reveal="up">
          <div className="product-tour-player__screen">
            {tourSteps.map((step, index) => (
              <div className={`product-tour-frame product-tour-frame--${step.focus} ${activeStep === index ? 'is-active' : ''}`} key={step.title} aria-hidden={activeStep !== index}>
                <img src="/media/plant-lab-tour.png" alt="Plant Growth Academy game interface" />
                <div className="product-tour-frame__shade" />
              </div>
            ))}
            <div className="product-tour-player__chrome">
              <span><i /> Plant Growth Academy</span>
              <strong>GAME PREVIEW</strong>
            </div>
            <div className="product-tour-player__caption">
              <span>0{activeStep + 1}</span>
              <div>
                <strong>{tourSteps[activeStep].title}</strong>
                <p>{tourSteps[activeStep].description}</p>
              </div>
            </div>
            <button className="product-tour-player__control" type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause game preview' : 'Play game preview'}>
              <span className={playing ? 'is-pause' : 'is-play'} aria-hidden="true" />
            </button>
          </div>

          <div className="product-tour-timeline" role="tablist" aria-label="Game preview steps">
            {tourSteps.map((step, index) => (
              <button className={activeStep === index ? 'is-active' : ''} type="button" role="tab" aria-selected={activeStep === index} onClick={() => selectStep(index)} key={step.title}>
                <span className="product-tour-timeline__number">0{index + 1}</span>
                <span><strong>{step.title}</strong><small>{step.description}</small></span>
                <i><b /></i>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function HomePage({ user, onStart, onLearn, onOpenPage }) {
  return (
    <>
      <section className="landing-hero">
        <img className="landing-hero__image" src={heroImage} alt="A young plant growing in healthy soil" />
        <div className="landing-hero__shade" />
        <HeroParticles />
        <div className="landing-hero__orb landing-hero__orb--one" />
        <div className="landing-hero__orb landing-hero__orb--two" />
        <div className="landing-container landing-hero__content landing-hero__content--product">
          <div className="landing-hero__copy">
            <SectionEyebrow>Plant science, made interactive</SectionEyebrow>
            <h1>Grow a plant.<br />Understand the science.</h1>
            <p>
              Plant Growth Academy is a learning simulation where you shape a 3D plant's environment,
              observe its response, and build real understanding through every growing cycle.
            </p>
            <div className="landing-actions">
              <button className="landing-button landing-button--primary" type="button" onClick={onStart}>
                <AppIcon name="controller" />
                {user ? 'Continue your experiment' : 'Play the simulation'}
                <AppIcon name="arrowForward" />
              </button>
              <button className="landing-button landing-button--secondary" type="button" onClick={() => document.querySelector('.landing-product-tour')?.scrollIntoView({ behavior: 'smooth' })}>
                <AppIcon name="live" />
                Watch game preview
              </button>
            </div>
            <div className="landing-hero__proof">
              <span><AppIcon name="check" /> Account-based progress</span>
              <span><AppIcon name="check" /> Thai & English</span>
              <span><AppIcon name="check" /> Research-backed learning</span>
            </div>
          </div>

          <div className="landing-hero-product" aria-label="Plant Lab game preview">
            <div className="landing-hero-product__topbar">
              <span><i /><i /><i /></span>
              <strong>PLANT LAB / LIVE SIMULATION</strong>
              <AppIcon name="live" />
            </div>
            <div className="landing-hero-product__viewport">
              <img src="/media/plant-lab-tour.png" alt="Plant Lab showing a 3D plant and environmental controls" />
              <span className="landing-hero-product__hotspot landing-hero-product__hotspot--plant"><i />Live plant response</span>
              <span className="landing-hero-product__hotspot landing-hero-product__hotspot--controls"><i />6 connected factors</span>
            </div>
            <div className="landing-hero-product__footer">
              <span><AppIcon name="sprout" /> Interactive 3D laboratory</span>
              <span>01:12</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-game-summary" aria-label="Game highlights">
        <div className="landing-container landing-game-summary__grid">
          <div><strong>3D</strong><span>living plant simulation</span></div>
          <div><strong>6</strong><span>connected growth factors</span></div>
          <div><strong>2</strong><span>growing modes to explore</span></div>
          <div><strong>∞</strong><span>experiments to compare</span></div>
        </div>
      </section>

      <section className="landing-section landing-game-intro" id="about">
        <div className="landing-container">
          <div className="landing-game-intro__copy" data-reveal="up">
            <SectionEyebrow icon="eco">What kind of game is it?</SectionEyebrow>
            <h2>A science learning game built around meaningful choices.</h2>
            <p>Instead of memorizing plant facts, you investigate them. Every adjustment changes the simulation, giving you clear feedback to observe, question, and understand.</p>
          </div>
          <div className="landing-game-intro__pillars">
            {features.slice(0, 3).map((feature, index) => (
              <article data-reveal="up" key={feature.title} style={{ '--reveal-delay': `${index * 90}ms` }}>
                <span>0{index + 1}</span>
                <div className="landing-icon-box"><AppIcon name={feature.icon} /></div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ProductTour />

      <section className="landing-section landing-journey" aria-labelledby="journey-title">
        <div className="landing-container">
          <div className="landing-section-heading landing-section-heading--center" data-reveal="up">
            <SectionEyebrow icon="sprout">Your first growing cycle</SectionEyebrow>
            <h2 id="journey-title">From first login to your first harvest.</h2>
            <p>Four clear steps help new players begin quickly while leaving room for deeper experimentation.</p>
          </div>
          <div className="landing-journey__grid">
            {journeySteps.map((step, index) => (
              <article data-reveal="up" key={step.title} style={{ '--reveal-delay': `${index * 80}ms` }}>
                <div className={`landing-journey__visual landing-journey__visual--${index + 1}`}>
                  {index === 0
                    ? <div className="landing-journey__profile"><AppIcon name="person" /><span /><span /><b>START</b></div>
                    : <img src="/media/plant-lab-tour.png" alt="" />}
                  <strong>0{index + 1}</strong>
                </div>
                <div className="landing-journey__content">
                  <span><AppIcon name={step.icon} /></span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-spaces" aria-labelledby="spaces-title">
        <div className="landing-container">
          <div className="landing-section-heading landing-spaces__heading" data-reveal="up">
            <div>
              <SectionEyebrow icon="home">Explore the academy</SectionEyebrow>
              <h2 id="spaces-title">Every page supports the next experiment.</h2>
            </div>
            <p>The lab, learning content, tools, records, and community work together as one connected experience.</p>
          </div>
          <div className="landing-spaces__grid">
            {gameSpaces.map((space, index) => (
              <article className={`landing-space-card landing-space-card--${space.preview}`} data-reveal="up" key={space.page} style={{ '--reveal-delay': `${(index % 3) * 80}ms` }}>
                <div className="landing-space-card__preview">
                  {space.preview === 'lab' && <img src="/media/plant-lab-tour.png" alt="Plant Lab interface" />}
                  {space.preview === 'settings' && <img src="/media/settings-language.png" alt="Language settings interface" />}
                  {space.preview !== 'lab' && space.preview !== 'settings' && (
                    <div className="landing-space-card__mock">
                      <span><AppIcon name={space.icon} /></span>
                      <i /><i /><i />
                    </div>
                  )}
                  <span className="landing-space-card__icon"><AppIcon name={space.icon} /></span>
                </div>
                <div className="landing-space-card__body">
                  <small>{space.eyebrow}</small>
                  <h3>{space.title}</h3>
                  <p>{space.description}</p>
                  <button type="button" onClick={() => space.page === 'learn' ? onLearn() : onOpenPage(space.page)}>
                    Explore {space.title}<AppIcon name="arrowForward" />
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
            <SectionEyebrow icon="bookmark">Learn before you adjust</SectionEyebrow>
            <h2>Every control connects to real plant science.</h2>
            <p>Use the Knowledge Library to understand plant structures, environmental factors, and photosynthesis—then test those ideas in the simulation.</p>
            <button className="landing-text-link" type="button" onClick={onLearn}>Open the Knowledge Library<AppIcon name="arrowForward" /></button>
          </div>
        </div>
      </section>

      <section className="landing-section landing-final-cta">
        <div className="landing-container landing-final-cta__inner" data-reveal="up">
          <div className="landing-final-cta__icon"><AppIcon name="sprout" /></div>
          <SectionEyebrow icon="bolt">Ready when you are</SectionEyebrow>
          <h2>Start with one plant. Leave with a better question.</h2>
          <p>Sign in to begin your first growing cycle and keep every result connected to your learner profile.</p>
          <button className="landing-button landing-button--primary" type="button" onClick={onStart}>
            <AppIcon name="controller" />
            {user ? 'Continue your experiment' : 'Create an account and play'}
            <AppIcon name="arrowForward" />
          </button>
        </div>
      </section>
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
        if (articleAllowedStyles.has(property) && !/(url\s*\(|expression|javascript:)/i.test(value)) {
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
    if (element.tagName === 'IMG' && element.hasAttribute('src')) element.setAttribute('loading', 'lazy')
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
    <article className="learning-content-card" style={{ '--reveal-delay': `${index * 90}ms` }}>
      <button type="button" onClick={() => onOpen(article.slug)} aria-label={`${language === 'th' ? 'เปิดบทความ' : 'Open article'}: ${title}`}>
        <div className="learning-content-card__image">
          {article.cover_image_url
            ? <img src={article.cover_image_url} alt={imageAlt} />
            : <div className="learning-content-card__placeholder"><AppIcon name={article.icon || 'eco'} /></div>}
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
    </article>
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
    <section className="landing-section learning-library" aria-labelledby="learning-library-title">
      <div className="landing-container">
        <div className="learning-library__heading" data-reveal="up">
          <div>
            <SectionEyebrow icon="history">Knowledge library</SectionEyebrow>
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
            <SectionEyebrow icon={article.icon || 'eco'}>{localizedContent(article, 'eyebrow', language)}</SectionEyebrow>
            <h1>{title}</h1>
            <p>{summary}</p>
            <div className="learning-article-hero__meta">
              <span><AppIcon name="history" />{article.reading_minutes} {language === 'th' ? 'นาที' : 'minute read'}</span>
              <span><AppIcon name="check" />Reviewed educational sources</span>
            </div>
          </div>
          <figure className="learning-article-hero__figure">
            <img src={article.cover_image_url} alt={imageAlt} />
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
          <div className="learning-article-aside__card">
            <span className="learning-article-aside__icon"><AppIcon name="bookmark" /></span>
            <h2>Source notes</h2>
            <p>This lesson is paraphrased and organized for learning. Use the original sources for further study.</p>
          </div>
          <div className="learning-article-aside__card">
            <h2>References</h2>
            <ol>
              {(article.references ?? []).map((reference) => (
                <li key={reference.url}>
                  <a href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a>
                  <span>{reference.organization}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>

      <section className="landing-section learning-article-cta">
        <div className="landing-container learning-article-cta__inner">
          <div><SectionEyebrow icon="controller">Apply what you learned</SectionEyebrow><h2>Test the idea in the plant lab.</h2></div>
          <button className="landing-button landing-button--primary" type="button" onClick={onStart}>
            <AppIcon name="sprout" />{user ? 'Enter the plant lab' : 'Log in to start'}<AppIcon name="arrowForward" />
          </button>
        </div>
      </section>
    </article>
  )
}

function LearnPage({ user, onHome, onStart, onOpenArticle }) {
  return (
    <>
      <section className="landing-learn-hero">
        <div className="landing-container">
          <button className="landing-text-link landing-text-link--back" type="button" onClick={onHome}>
            <AppIcon name="arrowBack" /> Back to home
          </button>
          <SectionEyebrow icon="history">Learn about plant growth</SectionEyebrow>
          <h1>The science behind every new leaf.</h1>
          <p>Understand the six environmental factors that shape plant health before applying them in the simulation.</p>
        </div>
      </section>

      <LearningLibrary onOpenArticle={onOpenArticle} />

      <section className="landing-section landing-section--intro">
        <div className="landing-container landing-split">
          <div data-reveal="left">
            <SectionEyebrow icon="bolt">The essential process</SectionEyebrow>
            <h2>Photosynthesis powers plant life.</h2>
            <p className="landing-lead">
              Plants combine light energy, water, and carbon dioxide to produce glucose for growth and release oxygen.
              Healthy leaves and balanced conditions help this process work efficiently.
            </p>
            <div className="landing-equation">6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂</div>
          </div>
          <div className="landing-process-card" data-reveal="right">
            <div><AppIcon name="bolt" /><span>Light energy</span></div>
            <AppIcon className="landing-process-card__arrow" name="arrowDown" />
            <div><AppIcon name="eco" /><span>Leaves create food</span></div>
            <AppIcon className="landing-process-card__arrow" name="arrowDown" />
            <div><AppIcon name="air" /><span>Oxygen is released</span></div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--factors">
        <div className="landing-container">
          <div className="landing-section-heading landing-section-heading--center" data-reveal="up">
            <SectionEyebrow icon="eco">Plant growth essentials</SectionEyebrow>
            <h2>Six factors, one connected system.</h2>
            <p>Use these principles to diagnose problems and make better decisions inside the plant lab.</p>
          </div>
          <div className="landing-factor-grid">
            {factors.map((factor, index) => (
              <article className="landing-factor-card" data-reveal="up" key={factor.title} style={{ '--reveal-delay': `${index * 65}ms` }}>
                <div className="landing-icon-box"><AppIcon name={factor.icon} /></div>
                <div className="landing-factor-card__title"><h3>{factor.title}</h3><strong>{factor.value}</strong></div>
                <p>{factor.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-final-cta">
        <div className="landing-container landing-final-cta__inner" data-reveal="up">
          <div className="landing-final-cta__icon"><AppIcon name="controller" /></div>
          <h2>Put the science into practice.</h2>
          <p>Enter the simulation, tune the environment, and observe how every decision changes your plant.</p>
          <button className="landing-button landing-button--primary" type="button" onClick={onStart}>
            <AppIcon name="sprout" />
            {user ? 'Enter the plant lab' : 'Log in to start'}
            <AppIcon name="arrowForward" />
          </button>
        </div>
      </section>
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

export function LandingPage({ page = 'home', user, onHome, onLearn, onStart, onSignIn, onOpenPage }) {
  const [articleSlug, setArticleSlug] = useState(null)
  const [language, setLanguage] = useState(() => loadSettings().language === 'th' ? 'th' : 'en')

  function changeLanguage(nextLanguage) {
    const normalizedLanguage = nextLanguage === 'th' ? 'th' : 'en'
    setLanguage(normalizedLanguage)
    saveSettings({ ...loadSettings(), language: normalizedLanguage })
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
    <main className="landing-shell">
      <LandingHeader language={language} onLanguageChange={changeLanguage} page={page} user={user} onHome={openHome} onLearn={openLearningLibrary} onStart={onStart} onSignIn={onSignIn} />
      {page === 'learn'
        ? articleSlug
          ? <LearningArticlePage key={articleSlug} slug={articleSlug} user={user} onBack={openLearningLibrary} onStart={onStart} />
          : <LearnPage user={user} onHome={openHome} onOpenArticle={openArticle} onStart={onStart} />
        : <HomePage user={user} onStart={onStart} onLearn={openLearningLibrary} onOpenPage={onOpenPage} />}
      <LandingFooter onHome={openHome} onLearn={openLearningLibrary} />
    </main>
  )
}
