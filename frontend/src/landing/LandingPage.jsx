import { useEffect, useState } from 'react'
import heroImage from '../assets/hero.png'
import plantGrowthLogo from '../assets/Logo for Plant Growth Academy Simulation Game-Photoroom.png'
import { AppIcon } from '../game/icons/IconifyIcon'
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

function LandingHeader({ page, user, onHome, onLearn, onStart, onSignIn }) {
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
          <button className={page === 'learn' ? 'is-active' : ''} type="button" onClick={() => run(onLearn)}>Learn about plants</button>
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

function StatusChip({ icon, label, value }) {
  return (
    <div className="landing-status-chip">
      <AppIcon name={icon} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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

function HomePage({ user, onStart, onLearn }) {
  return (
    <>
      <section className="landing-hero">
        <img className="landing-hero__image" src={heroImage} alt="A young plant growing in healthy soil" />
        <div className="landing-hero__shade" />
        <HeroParticles />
        <div className="landing-hero__orb landing-hero__orb--one" />
        <div className="landing-hero__orb landing-hero__orb--two" />
        <div className="landing-container landing-hero__content">
          <div className="landing-hero__copy">
            <SectionEyebrow>Interactive plant learning simulation</SectionEyebrow>
            <h1>Every seed has a story waiting to grow.</h1>
            <p>
              Explore plant science through a hands-on digital laboratory. Adjust the environment,
              observe each response, and turn every experiment into practical knowledge.
            </p>
            <div className="landing-status-row" aria-label="Sample growing environment">
              <StatusChip icon="bolt" label="Light" value="85%" />
              <StatusChip icon="drop" label="Moisture" value="72%" />
              <StatusChip icon="temp" label="Temperature" value="26°C" />
            </div>
            <div className="landing-actions">
              <button className="landing-button landing-button--primary" type="button" onClick={onStart}>
                <AppIcon name="sprout" />
                {user ? 'Enter the plant lab' : 'Start growing'}
                <AppIcon name="arrowForward" />
              </button>
              <button className="landing-button landing-button--secondary" type="button" onClick={onLearn}>
                <AppIcon name="history" />
                Learn more
              </button>
            </div>
            <dl className="landing-stats">
              <div><dt>6</dt><dd>environment factors</dd></div>
              <div><dt>3D</dt><dd>interactive plant lab</dd></div>
              <div><dt>100%</dt><dd>learning by doing</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--intro" id="about">
        <div className="landing-container landing-split">
          <div data-reveal="left">
            <SectionEyebrow icon="controller">About the academy</SectionEyebrow>
            <h2>Learn plant science through a living simulation.</h2>
            <p className="landing-lead">
              Plant Growth Academy connects environmental science with an interactive growing experience.
              Change water, light, soil, air, temperature, and nutrients—then watch the plant react in real time.
            </p>
            <button className="landing-text-link" type="button" onClick={onLearn}>
              Explore the science
              <AppIcon name="arrowForward" />
            </button>
          </div>
          <div className="landing-lab-card" data-reveal="right">
            <div className="landing-lab-card__header">
              <span><AppIcon name="live" /> Live environment</span>
              <strong>Healthy</strong>
            </div>
            <div className="landing-lab-card__plant"><AppIcon name="sprout" /></div>
            <div className="landing-lab-card__metrics">
              <span><AppIcon name="heart" /> Health <strong>100</strong></span>
              <span><AppIcon name="eco" /> Growth <strong>78</strong></span>
              <span><AppIcon name="drop" /> Water <strong>72</strong></span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--features">
        <div className="landing-container">
          <div className="landing-section-heading" data-reveal="up">
            <SectionEyebrow icon="plant">Designed for active learning</SectionEyebrow>
            <h2>A plant laboratory that rewards curiosity.</h2>
            <p>Experiment safely, understand cause and effect, and keep evidence from every growing session.</p>
          </div>
          <div className="landing-feature-grid">
            {features.map((feature, index) => (
              <article className="landing-feature-card" data-reveal="up" key={feature.title} style={{ '--reveal-delay': `${index * 85}ms` }}>
                <span className="landing-card-number">{String(index + 1).padStart(2, '0')}</span>
                <div className="landing-icon-box"><AppIcon name={feature.icon} /></div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--factors" id="factors">
        <div className="landing-container">
          <div className="landing-section-heading landing-section-heading--center" data-reveal="up">
            <SectionEyebrow icon="eco">Six connected factors</SectionEyebrow>
            <h2>Build the right environment for growth.</h2>
            <p>Each factor influences the others. Small adjustments can change the health and pace of your plant.</p>
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
          <div className="landing-final-cta__icon"><AppIcon name="sprout" /></div>
          <SectionEyebrow icon="bolt">Your experiment starts here</SectionEyebrow>
          <h2>Ready to grow your first digital plant?</h2>
          <p>Sign in to save your progress, build a plant collection, and learn with the community.</p>
          <button className="landing-button landing-button--primary" type="button" onClick={onStart}>
            <AppIcon name="controller" />
            {user ? 'Continue to the plant lab' : 'Log in and start growing'}
            <AppIcon name="arrowForward" />
          </button>
        </div>
      </section>
    </>
  )
}

function LearnPage({ user, onHome, onStart }) {
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
          <button type="button" onClick={onLearn}>Learn about plants</button>
        </nav>
        <small>© 2026 Plant Growth Academy</small>
      </div>
    </footer>
  )
}

export function LandingPage({ page = 'home', user, onHome, onLearn, onStart, onSignIn }) {
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
  }, [page])

  return (
    <main className="landing-shell">
      <LandingHeader page={page} user={user} onHome={onHome} onLearn={onLearn} onStart={onStart} onSignIn={onSignIn} />
      {page === 'learn'
        ? <LearnPage user={user} onHome={onHome} onStart={onStart} />
        : <HomePage user={user} onStart={onStart} onLearn={onLearn} />}
      <LandingFooter onHome={onHome} onLearn={onLearn} />
    </main>
  )
}
