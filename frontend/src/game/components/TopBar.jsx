import { imageAssets, navItems, navTargets } from '../data/gameData'
import { AppIcon } from '../icons/IconifyIcon'
import { NavIcon } from '../icons/NavIcon'
import plantGrowthLogo from '../../assets/Logo for Plant Growth Academy Simulation Game-Photoroom.png'
import { resolveAssetUrl } from '../../lib/api'

function ProfileAvatar({ user, initial, size = 'sm' }) {
  const sizeClass = size === 'md' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-sm'

  return (
    <span className={`${sizeClass} grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#9bcf82] font-black text-[#101511]`}>
      {user?.avatar_url ? (
        <img className="h-full w-full object-cover object-center" src={resolveAssetUrl(user.avatar_url)} alt="" />
      ) : user ? initial : (
        <AppIcon className="h-4 w-4" name="profile" />
      )}
    </span>
  )
}

function nextLevelExperience(level) {
  const currentLevel = Math.max(1, Number(level) || 1)

  return 100 + ((currentLevel - 1) * 50)
}

export function TopBar({ activePage = 'lab', coinBalance = 0, coinDelta = null, onNavigate, openWindow, profileOpen, setProfileOpen, user, onAuthRequired, onLogout }) {
  const displayName = user?.username ?? 'Learner'
  const learnerLevel = user?.level ?? 1
  const learnerExperience = Number(user?.experience ?? user?.level_progress?.experience ?? 0)
  const learnerNextExperience = Number(user?.level_progress?.next_level_experience ?? nextLevelExperience(learnerLevel))
  const learnerExpPercent = Math.max(0, Math.min(100, Number(user?.level_progress?.percent ?? ((learnerExperience / learnerNextExperience) * 100)) || 0))
  const initial = displayName.slice(0, 1).toUpperCase()
  const shownCoins = Number(user?.coin ?? coinBalance ?? 0).toLocaleString()

  function handleProfileClick() {
    if (!user) {
      onAuthRequired?.('login')
      return
    }

    setProfileOpen((value) => !value)
  }

  return (
    <header className="absolute left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-lime-100/15 bg-[#101511]/95 px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-16 items-center border-r border-lime-100/10 pr-5">
          <img
            className="h-28 w-auto max-w-[290px] object-contain"
            src={plantGrowthLogo}
            alt="Plant Growth Academy"
          />
        </div>
        <nav className="flex h-16 min-w-0 items-end overflow-x-auto" aria-label="Primary">
          <ul className="flex min-w-max flex-wrap text-center text-sm font-medium text-slate-300">
            {navItems.map((item, index) => {
              const active = item === 'Shop' ? activePage === 'shop' : item === 'History' ? activePage === 'history' : item === 'Community' ? activePage === 'community' : activePage === 'lab' && index === 0

              return (
                <li className="me-2" key={item}>
                  <button
                    className={`group inline-flex items-center justify-center border-b px-3.5 py-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime-200 ${
                      active
                        ? 'border-[#9bcf82] text-lime-100'
                        : 'border-transparent text-slate-300 hover:border-[#9bcf82]/80 hover:text-lime-100'
                    }`}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => {
                      if (item === 'Shop') {
                        onNavigate?.('shop')
                        return
                      }
                      if (item === 'History') {
                        onNavigate?.('history')
                        return
                      }
                      if (item === 'Community') {
                        onNavigate?.('community')
                        return
                      }
                      onNavigate?.('lab')
                      if (navTargets[item]) openWindow(navTargets[item])
                    }}
                  >
                    <NavIcon className={`me-2 h-4 w-4 ${active ? 'text-[#9bcf82]' : 'text-slate-400 group-hover:text-[#9bcf82]'}`} type={item} />
                    {item}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      <div className="relative flex items-center gap-2 text-sm">
        {user && (
          <div className="relative flex h-12 items-center gap-2 rounded-md border border-lime-100/10 bg-white/[0.04] px-3 shadow-[0_8px_18px_rgba(0,0,0,.18)]" aria-label="Coin balance">
            <img className="h-7 w-7 shrink-0 object-contain" src={imageAssets.coin} alt="Coin" />
            <span className="min-w-10 text-right text-sm font-black tabular-nums text-lime-50">{shownCoins}</span>
            {coinDelta ? (
              <span className="coin-pop pointer-events-none absolute -top-3 right-2 rounded-full border border-amber-100/25 bg-[#1b1a10] px-2 py-0.5 text-[11px] font-black text-amber-200 shadow-[0_8px_18px_rgba(0,0,0,.28)]">
                +{coinDelta}
              </span>
            ) : null}
          </div>
        )}

        <button
          className="flex items-center gap-3 rounded-md bg-white/[0.045] px-3 py-2 text-left transition hover:bg-white/[0.075] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
          type="button"
          aria-haspopup={user ? 'menu' : undefined}
          aria-expanded={user ? profileOpen : undefined}
          onClick={handleProfileClick}
        >
          <ProfileAvatar user={user} initial={initial} />
          <span className="hidden leading-none sm:block">
            <strong className="block text-xs text-lime-50">{user ? `${displayName} Lv.${learnerLevel}` : 'Sign in'}</strong>
            <small className="mt-1 block text-[10px] text-slate-400">{user ? 'Student profile' : 'Login or create account'}</small>
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
            <button
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-lime-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-lime-200"
              type="button"
              role="menuitem"
            >
              <AppIcon className="h-4 w-4 text-slate-400" name="profile" />
              Manage profile
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/[0.06] hover:text-lime-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-lime-200"
              type="button"
              role="menuitem"
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
    </header>
  )
}
