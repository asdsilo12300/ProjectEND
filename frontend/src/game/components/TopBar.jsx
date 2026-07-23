import { imageAssets, navItems, navTargets } from '../data/gameData'
import { useEffect, useRef, useState } from 'react'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { NavIcon } from '../icons/NavIcon'
import { LoadingSkeleton } from './LoadingSkeleton'
import plantGrowthLogo from '../../assets/Logo for Plant Growth Academy Simulation Game-Photoroom.png'
import { resolveAssetUrl } from '../../lib/api'
import { getAppLanguage } from '../../i18n/appI18n'

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

function notificationAction(type) {
  if (type === 'like') return 'liked your post'
  if (type === 'comment_like') return 'liked your comment'
  if (type === 'reply') return 'replied to your comment'
  if (type === 'garden_prank') return 'sent a prank to your garden'
  return 'commented on your post'
}

function isCommunityNotification(notification) {
  if (notification?.category) return notification.category === 'community'
  return ['like', 'comment', 'reply', 'comment_like'].includes(notification?.type)
}

function notificationTime(value) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ''
  const elapsed = Math.max(0, Date.now() - timestamp)
  if (elapsed < 60_000) return 'now'
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m`
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h`
  return `${Math.floor(elapsed / 86_400_000)}d`
}

function notificationExactTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(getAppLanguage() === 'th' ? 'th-TH' : 'en-GB', {
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(date)
}

export function TopBar({ activePage = 'lab', coinBalance = 0, coinDelta = null, communityUnreadNotificationCount = 0, notificationError = '', notifications = [], notificationStatus = 'idle', onNavigate, onNotificationRead, onNotificationsRefresh, openWindow, profileOpen, setProfileOpen, unreadNotificationCount = 0, user, onAuthRequired, onLogout }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const accountMenuRef = useRef(null)
  const notificationMenuRef = useRef(null)
  const displayName = user?.username ?? 'Learner'
  const learnerLevel = user?.level ?? 1
  const learnerExperience = Number(user?.experience ?? user?.level_progress?.experience ?? 0)
  const learnerNextExperience = Number(user?.level_progress?.next_level_experience ?? nextLevelExperience(learnerLevel))
  const learnerExpPercent = Math.max(0, Math.min(100, Number(user?.level_progress?.percent ?? ((learnerExperience / learnerNextExperience) * 100)) || 0))
  const initial = displayName.slice(0, 1).toUpperCase()
  const shownCoins = Number(user?.coin ?? coinBalance ?? 0).toLocaleString()
  const notificationBadge = unreadNotificationCount > 99 ? '99+' : String(unreadNotificationCount)
  const communityNotificationBadge = communityUnreadNotificationCount > 99 ? '99+' : String(communityUnreadNotificationCount)

  useEffect(() => {
    function handlePointerDown(event) {
      if (profileOpen && !accountMenuRef.current?.contains(event.target)) setProfileOpen(false)
      if (notificationsOpen && !notificationMenuRef.current?.contains(event.target)) setNotificationsOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      setProfileOpen(false)
      setMobileNavOpen(false)
      setNotificationsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [notificationsOpen, profileOpen, setProfileOpen])

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
    setNotificationsOpen(false)
    onNavigate?.(page)
    if (page === 'lab' && navTargets[item]) openWindow?.(navTargets[item])
  }

  function openCommunityNotifications() {
    try {
      window.sessionStorage.setItem('plant_game_community_return_state', JSON.stringify({ activeView: 'notifications' }))
    } catch {
      // Community navigation still works when session storage is unavailable.
    }

    onNavigate?.('community')
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('plant-community-open-notifications')), 0)
  }

  function openNotification(notification) {
    onNotificationRead?.(notification)
    setNotificationsOpen(false)
    if (isCommunityNotification(notification)) {
      openCommunityNotifications()
    } else {
      onNavigate?.('lab')
    }
  }

  function renderNavItems(mobile = false) {
    return navItems.map((item) => {
      const page = navPages[item] ?? 'lab'
      const active = activePage === page

      return (
        <li className={mobile ? '' : 'me-1'} key={item}>
          <button
            className={mobile
              ? `relative flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${active ? 'border-[#9bcf82]/45 bg-[#9bcf82]/12 text-lime-100' : 'border-white/[0.07] bg-white/[0.035] text-slate-300 hover:bg-white/[0.07] hover:text-lime-50'}`
              : `group relative inline-flex min-h-12 items-center justify-center border-b px-2.5 py-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lime-200 ${active ? 'border-[#9bcf82] text-lime-100' : 'border-transparent text-slate-300 hover:border-[#9bcf82]/80 hover:text-lime-100'}`}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(item)}
          >
            <NavIcon className={`${mobile ? 'h-5 w-5' : 'me-2 h-4 w-4'} ${active ? 'text-[#9bcf82]' : 'text-slate-400 group-hover:text-[#9bcf82]'}`} type={item} />
            {item}
            {item === 'Community' && communityUnreadNotificationCount > 0 ? (
              <span className={`${mobile ? 'ms-auto' : 'ms-2'} inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-black leading-none text-white shadow-[0_0_0_2px_#101511]`} aria-label={`${communityUnreadNotificationCount} unread Community notifications`}>
                {communityNotificationBadge}
              </span>
            ) : null}
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
            className="h-14 w-auto max-w-[112px] object-contain sm:h-16 sm:max-w-[150px]"
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
          <div className="relative" ref={notificationMenuRef}>
            <button
              className={`relative grid h-11 w-11 place-items-center rounded-md border text-slate-200 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 sm:h-12 sm:w-12 ${notificationsOpen ? 'border-[#9bcf82]/45 bg-[#9bcf82]/12 text-lime-100' : 'border-lime-100/10 bg-white/[0.04] hover:bg-white/[0.075]'}`}
              type="button"
              aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`}
              aria-haspopup="dialog"
              aria-expanded={notificationsOpen}
              onClick={() => {
                setProfileOpen(false)
                setMobileNavOpen(false)
                setNotificationsOpen((value) => !value)
                if (!notificationsOpen && notificationStatus !== 'loading') onNotificationsRefresh?.({ silent: true })
              }}
            >
              <AppIcon className="h-5 w-5" name="notifications" />
              {unreadNotificationCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#101511] bg-red-500 px-1 text-xs font-black leading-none text-white shadow-[0_5px_12px_rgba(0,0,0,.35)]">
                  {notificationBadge}
                </span>
              ) : null}
            </button>

            {notificationsOpen && (
              <section className="absolute right-0 top-14 z-[80] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-lime-100/15 bg-[#101511]/98 shadow-[0_22px_55px_rgba(0,0,0,.52)] backdrop-blur-xl" aria-label="Notifications" role="dialog">
                <header className="flex items-center justify-between border-b border-lime-100/10 px-4 py-3">
                  <span>
                    <strong className="block text-sm text-lime-50">Notifications</strong>
                    <small className="mt-0.5 block text-xs text-slate-400">Community, garden, and game updates</small>
                  </span>
                  {unreadNotificationCount > 0 ? <span className="rounded-full bg-red-500/15 px-2 py-1 text-xs font-black text-red-300">{notificationBadge} new</span> : null}
                </header>

                <div className="game-themed-scrollbar max-h-[min(430px,calc(100vh-150px))] overflow-y-auto">
                  {notificationStatus === 'loading' ? <LoadingSkeleton count={4} label="Loading notifications" variant="list" /> : null}
                  {notificationStatus !== 'loading' && notificationError && !notifications.length ? (
                    <div className="px-5 py-8 text-center">
                      <AppIcon className="mx-auto h-6 w-6 text-red-300" name="notifications" />
                      <p className="mt-2 text-xs text-slate-400">{notificationError}</p>
                      <button className="mt-3 rounded-md border border-lime-100/15 px-3 py-2 text-xs font-bold text-lime-100 hover:bg-white/[0.05]" type="button" onClick={() => onNotificationsRefresh?.()}>Try again</button>
                    </div>
                  ) : null}
                  {notificationStatus !== 'loading' && !notificationError && !notifications.length ? (
                    <div className="px-6 py-10 text-center">
                      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white/[0.04] text-slate-400"><AppIcon className="h-5 w-5" name="notifications" /></span>
                      <strong className="mt-3 block text-sm text-lime-50">You're all caught up</strong>
                      <span className="mt-1 block text-xs text-slate-400">New activity will appear here.</span>
                    </div>
                  ) : null}
                  {notifications.map((notification) => {
                    const actorName = notification.actor?.username ?? 'Learner'
                    const isPlantDanger = notification.type === 'garden_prank'
                    return (
                      <button
                        className={`relative flex w-full items-start gap-3 border-b border-lime-100/[0.08] px-4 py-3.5 text-left transition hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-lime-200 ${
                          isPlantDanger
                            ? notification.is_read ? 'bg-red-950/[0.08]' : 'bg-red-500/[0.055]'
                            : notification.is_read ? 'bg-transparent' : 'bg-red-500/[0.035]'
                        }`}
                        key={notification.id}
                        type="button"
                        onClick={() => openNotification(notification)}
                      >
                        {isPlantDanger ? (
                          <span
                            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-red-400/25 bg-red-500/10 text-red-300"
                            aria-label="Plant at risk from pests"
                            title="Plant at risk from pests"
                          >
                            <AppIcon className="h-4 w-4" name="warning" />
                            {!notification.is_read ? <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_3px_#101511]" aria-label="Unread" /> : null}
                          </span>
                        ) : !notification.is_read ? (
                          <span className="absolute right-3 top-4 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,.12)]" aria-label="Unread" />
                        ) : null}
                        <ProfileAvatar initial={actorName.slice(0, 1).toUpperCase()} user={notification.actor} />
                        <span className={`min-w-0 flex-1 ${isPlantDanger ? 'pr-10' : 'pr-5'}`}>
                          <span className="block text-xs leading-5">
                            <strong className="text-lime-50">{actorName}</strong>{' '}
                            <span className={notification.is_read ? 'text-slate-400' : 'text-slate-200'}>{notificationAction(notification.type)}</span>
                          </span>
                          {notification.excerpt ? <span className="mt-0.5 block truncate text-xs text-slate-400">“{notification.excerpt}”</span> : null}
                          {isPlantDanger ? (
                            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-red-400/20 bg-red-500/10 px-2 py-1 text-xs font-black text-red-300">
                              <AppIcon className="h-3 w-3" name="warning" />
                              {getAppLanguage() === 'th' ? 'พืชอยู่ในอันตราย' : 'Plant at risk'}
                            </span>
                          ) : null}
                          <time
                            className={`mt-1 block cursor-help text-xs decoration-dotted underline-offset-4 hover:text-slate-200 hover:underline ${notification.is_read ? 'text-slate-500' : 'font-bold text-red-300'}`}
                            dateTime={notification.created_at || undefined}
                            title={notificationExactTime(notification.created_at)}
                          >
                            {notificationTime(notification.created_at)}
                          </time>
                        </span>
                      </button>
                    )
                  })}
                </div>

              </section>
            )}
          </div>
        )}

        {user && (
          <div className="relative flex h-11 items-center gap-1.5 rounded-md border border-lime-100/10 bg-white/[0.04] px-2 shadow-[0_8px_18px_rgba(0,0,0,.18)] sm:h-12 sm:gap-2 sm:px-3" aria-label="Coin balance">
            <img className="h-6 w-6 shrink-0 object-contain sm:h-7 sm:w-7" src={imageAssets.coin} alt="Coin" />
            <span className="min-w-6 text-right text-xs font-black tabular-nums text-lime-50 sm:min-w-10 sm:text-sm">{shownCoins}</span>
            {coinDelta ? (
              <span className="coin-pop pointer-events-none absolute -top-3 right-2 rounded-full border border-amber-100/25 bg-[#1b1a10] px-2 py-0.5 text-xs font-black text-amber-200 shadow-[0_8px_18px_rgba(0,0,0,.28)]" aria-live="polite" title="Simulation reward">
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
            <small className="mt-1 block text-xs text-slate-400">{user ? 'profile' : 'Login or create account'}</small>
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
                  <span className="truncate text-xs text-slate-400">{user.email}</span>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-cyan-200/10 bg-[#0b1020]/65 px-2.5 py-2 shadow-[inset_0_0_18px_rgba(0,214,255,.08)]">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="font-mono text-[13px] font-black tabular-nums text-cyan-300">{learnerExpPercent.toFixed(0)}%</span>
                  <span className="text-xs font-semibold text-slate-400">
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
                <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
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
