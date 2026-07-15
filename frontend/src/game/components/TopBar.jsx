import { imageAssets, navItems, navTargets } from '../data/gameData'
import { useEffect, useRef, useState } from 'react'
import { AppIcon } from '../icons/IconifyIcon'
import { NavIcon } from '../icons/NavIcon'
import plantGrowthLogo from '../../assets/Logo for Plant Growth Academy Simulation Game-Photoroom.png'
import { resolveAssetUrl } from '../../lib/api'

function ProfileAvatar({ user, initial, size = 'sm' }) {
  const sizeClass = size === 'md' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-sm'

  return (
    <span className={`${sizeClass} relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#9bcf82] font-black text-[#101511]`}>
      {user ? initial : (
        <AppIcon className="h-4 w-4" name="profile" />
      )}
      {user?.avatar_url && (
        <img
          className="absolute inset-0 h-full w-full object-cover object-center"
          src={resolveAssetUrl(user.avatar_url)}
          alt=""
          onError={(event) => { event.currentTarget.hidden = true }}
        />
      )}
    </span>
  )
}

function nextLevelExperience(level) {
  const currentLevel = Math.max(1, Number(level) || 1)

  return 100 + ((currentLevel - 1) * 50)
}

const navPages = {
  Home: 'home',
  Learn: 'learn',
  'Plant Lab': 'lab',
  Shop: 'shop',
  History: 'history',
  Community: 'community',
}

export function TopBar({ activePage = 'lab', coinBalance = 0, coinDelta = null, onNavigate, openWindow, profileOpen, setProfileOpen, user, onAuthRequired, onLogout }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const accountMenuRef = useRef(null)
  const displayName = user?.username ?? 'Learner'
  const learnerLevel = user?.level ?? 1
  const learnerExperience = Number(user?.experience ?? user?.level_progress?.experience ?? 0)
  const learnerNextExperience = Number(user?.level_progress?.next_level_experience ?? nextLevelExperience(learnerLevel))
  const learnerExpPercent = Math.max(0, Math.min(100, Number(user?.level_progress?.percent ?? ((learnerExperience / learnerNextExperience) * 100)) || 0))
  const initial = displayName.slice(0, 1).toUpperCase()
  const shownCoins = Number(user?.coin ?? coinBalance ?? 0).toLocaleString()

  useEffect(() => {
    function handlePointerDown(event) {
      if (profileOpen && !accountMenuRef.current?.contains(event.target)) setProfileOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      setProfileOpen(false)
      setMobileNavOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [profileOpen, setProfileOpen])

  function handleProfileClick() {
    if (!user) {
      onAuthRequired?.('login')
      return
    }

    setProfileOpen((value) => !value)
  }

  function navigate(item) {
    const page = navPages[item] ?? 'lab'
    setMobileNavOpen(false)
    setProfileOpen(false)
    onNavigate?.(page)
    if (page === 'lab' && navTargets[item]) openWindow?.(navTargets[item])
  }

  function renderNavItems(mobile = false) {
    return navItems.map((item) => {
      const page = navPages[item] ?? 'lab'
      const active = activePage === page

      return (
        <li className={mobile ? '' : 'me-1'} key={item}>
          <button
            className={mobile
              ? `flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${active ? 'border-[#9bcf82]/45 bg-[#9bcf82]/12 text-lime-100' : 'border-white/[0.07] bg-white/[0.035] text-slate-300 hover:bg-white/[0.07] hover:text-lime-50'}`
              : `group inline-flex min-h-12 items-center justify-center border-b px-2.5 py-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime-200 ${active ? 'border-[#9bcf82] text-lime-100' : 'border-transparent text-slate-300 hover:border-[#9bcf82]/80 hover:text-lime-100'}`}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(item)}
          >
            <NavIcon className={`${mobile ? 'h-5 w-5' : 'me-2 h-4 w-4'} ${active ? 'text-[#9bcf82]' : 'text-slate-400 group-hover:text-[#9bcf82]'}`} type={item} />
            {item}
          </button>
        </li>
      )
    })
  }

  return (
    <header className="absolute left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-lime-100/15 bg-[#101511]/95 px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 xl:gap-3">
        <button
          className="flex h-16 shrink-0 items-center border-r border-lime-100/10 pr-3 transition hover:bg-white/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-lime-200 sm:pr-5"
          type="button"
          aria-label="Go to home"
          onClick={() => navigate('Home')}
        >
          <img
            className="h-20 w-auto max-w-[120px] object-contain sm:h-24 sm:max-w-[180px]"
            src={plantGrowthLogo}
            alt="Plant Growth Academy"
          />
        </button>
        <nav className="hidden h-16 min-w-0 items-end overflow-x-auto xl:flex" aria-label="Primary">
          <ul className="flex min-w-max text-center text-sm font-medium text-slate-300">{renderNavItems()}</ul>
        </nav>
      </div>

      <div ref={accountMenuRef} className="relative flex items-center gap-2 text-sm">
        {user && (
          <div className="relative flex h-11 items-center gap-1.5 rounded-md border border-lime-100/10 bg-white/[0.04] px-2 shadow-[0_8px_18px_rgba(0,0,0,.18)] sm:h-12 sm:gap-2 sm:px-3" aria-label="Coin balance">
            <img className="h-6 w-6 shrink-0 object-contain sm:h-7 sm:w-7" src={imageAssets.coin} alt="Coin" />
            <span className="min-w-6 text-right text-xs font-black tabular-nums text-lime-50 sm:min-w-10 sm:text-sm">{shownCoins}</span>
            {coinDelta ? (
              <span className="coin-pop pointer-events-none absolute -top-3 right-2 rounded-full border border-amber-100/25 bg-[#1b1a10] px-2 py-0.5 text-[11px] font-black text-amber-200 shadow-[0_8px_18px_rgba(0,0,0,.28)]" aria-live="polite" title="Simulation reward">
                +{coinDelta}
              </span>
            ) : null}
          </div>
        )}

        <button
          className="grid h-11 w-11 place-items-center rounded-md border border-lime-100/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.075] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 xl:hidden"
          type="button"
          aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileNavOpen}
          onClick={() => {
            setProfileOpen(false)
            setMobileNavOpen((value) => !value)
          }}
        >
          <AppIcon className="h-5 w-5" name={mobileNavOpen ? 'panelClose' : 'sort'} />
        </button>

        <button
          className="flex items-center gap-3 rounded-md bg-white/[0.045] px-3 py-2 text-left transition hover:bg-white/[0.075] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
          type="button"
          aria-haspopup={user ? 'menu' : undefined}
          aria-expanded={user ? profileOpen : undefined}
          onClick={handleProfileClick}
        >
          <ProfileAvatar user={user} initial={initial} />
          <span className="hidden leading-none md:block">
            <strong className="block text-xs text-lime-50">{user ? `${displayName} Lv.${learnerLevel}` : 'Sign in'}</strong>
            <small className="mt-1 block text-[10px] text-slate-400">{user ? 'profile' : 'Login or create account'}</small>
          </span>
          <AppIcon className={`h-4 w-4 text-slate-300 transition ${profileOpen && user ? 'rotate-180' : ''}`} name="arrowDown" />
        </button>

        {profileOpen && user && (
          <div className="absolute right-0 top-12 z-[70] w-64 overflow-hidden rounded-lg border border-lime-100/15 bg-[#101511] shadow-[0_12px_28px_rgba(0,0,0,.38)]" role="menu">
            <div className="border-b border-lime-100/10 px-3 py-3">
              <div className="mb-3 flex items-center gap-3">
                <ProfileAvatar user={user} initial={initial} size="md" />
                <div className="min-w-0">
                  <strong className="block truncate text-sm text-lime-50">{displayName} Lv.{learnerLevel}</strong>
                  <span className="truncate text-[11px] text-slate-400">{user.email}</span>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-cyan-200/10 bg-[#0b1020]/65 px-2.5 py-2 shadow-[inset_0_0_18px_rgba(0,214,255,.08)]">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="font-mono text-[13px] font-black tabular-nums text-cyan-300">{learnerExpPercent.toFixed(0)}%</span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    EXP {learnerExperience}/{learnerNextExperience}
                  </span>
                </div>
                <div className="relative h-5 overflow-hidden rounded-full border border-cyan-200/10 bg-[#050712]">
                  <div
                    className="relative h-full min-w-5 overflow-hidden rounded-full bg-gradient-to-r from-[#05b7ff] via-[#12d8e6] to-[#16f4be] shadow-[0_0_18px_rgba(12,216,230,.55)] transition-[width] duration-700 ease-out"
                    style={{ width: `${learnerExpPercent}%` }}
                    aria-hidden="true"
                  >
                    <span className="absolute inset-y-1 left-3 right-7 rounded-full bg-white/15" />
                    <span className="absolute left-8 top-1.5 h-1.5 w-1.5 rounded-full bg-white/25" />
                    <span className="absolute left-16 top-3 h-1 w-1 rounded-full bg-white/20" />
                    <span className="absolute right-4 top-1 h-1.5 w-1.5 rounded-full bg-white/20" />
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Lv.{learnerLevel}</span>
                  <span>Lv.{Number(learnerLevel) + 1}</span>
                </div>
              </div>
            </div>
            {user.role === 'admin' && (
              <button
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-emerald-200 transition hover:bg-emerald-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-200"
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false)
                  onNavigate?.('admin')
                }}
              >
                <AppIcon className="h-4 w-4 text-emerald-300" name="shield" />
                Admin console
              </button>
            )}
            <button
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-lime-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-lime-200"
              type="button"
              role="menuitem"
              onClick={() => {
                setProfileOpen(false)
                onNavigate?.('settings')
              }}
            >
              <AppIcon className="h-4 w-4 text-slate-400" name="settings" />
              Settings
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-200 transition hover:bg-red-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-red-200"
              type="button"
              role="menuitem"
              onClick={onLogout}
            >
              <AppIcon className="h-4 w-4 text-red-300" name="logout" />
              Logout
            </button>
          </div>
        )}
      </div>

      {mobileNavOpen && (
        <nav className="absolute left-3 right-3 top-[68px] z-[65] rounded-xl border border-lime-100/15 bg-[#101511]/98 p-3 shadow-[0_22px_50px_rgba(0,0,0,.48)] backdrop-blur-xl xl:hidden" aria-label="Mobile navigation">
          <ul className="grid grid-cols-2 gap-2">{renderNavItems(true)}</ul>
        </nav>
      )}
    </header>
  )
}
