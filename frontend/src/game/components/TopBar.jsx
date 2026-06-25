import { navItems, navTargets } from '../data/gameData'
import { AppIcon } from '../icons/IconifyIcon'
import { NavIcon } from '../icons/NavIcon'
import plantGrowthLogo from '../../assets/Logo for Plant Growth Academy Simulation Game-Photoroom.png'

export function TopBar({ activePage = 'lab', onNavigate, openWindow, profileOpen, setProfileOpen, user, onAuthRequired, onLogout }) {
  const displayName = user?.username ?? 'Learner'
  const learnerLevel = user?.level ?? 1
  const initial = displayName.slice(0, 1).toUpperCase()

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
              const active = item === 'Shop' ? activePage === 'shop' : activePage === 'lab' && index === 0

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

      <div className="relative flex items-center gap-3 text-sm">
        <button
          className="flex items-center gap-3 rounded-md bg-white/[0.045] px-3 py-2 text-left transition hover:bg-white/[0.075] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
          type="button"
          aria-haspopup={user ? 'menu' : undefined}
          aria-expanded={user ? profileOpen : undefined}
          onClick={handleProfileClick}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#9bcf82] text-sm font-black text-[#101511]">{user ? initial : <AppIcon className="h-4 w-4" name="profile" />}</span>
          <span className="hidden leading-none sm:block">
            <strong className="block text-xs text-lime-50">{user ? `${displayName} Lv.${learnerLevel}` : 'Sign in'}</strong>
            <small className="mt-1 block text-[10px] text-slate-400">{user ? 'Student profile' : 'Login or create account'}</small>
          </span>
          <AppIcon className={`h-4 w-4 text-slate-300 transition ${profileOpen && user ? 'rotate-180' : ''}`} name="arrowDown" />
        </button>

        {profileOpen && user && (
          <div className="absolute right-0 top-12 z-[70] w-56 overflow-hidden rounded-lg border border-lime-100/15 bg-[#101511] shadow-[0_12px_28px_rgba(0,0,0,.38)]" role="menu">
            <div className="border-b border-lime-100/10 px-3 py-3">
              <strong className="block truncate text-sm text-lime-50">{displayName} Lv.{learnerLevel}</strong>
              <span className="truncate text-[11px] text-slate-400">{user.email}</span>
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
