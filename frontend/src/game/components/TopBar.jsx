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

const MAX_COIN_BALANCE = 2_000_000_000

function topBarCopy(language, english, thai) {
  return language === 'th' ? thai : english
}

function useTopBarLanguage() {
  const [language, setLanguage] = useState(() => getAppLanguage() === 'th' ? 'th' : 'en')

  useEffect(() => {
    const updateLanguage = (event) => {
      setLanguage(event?.detail?.language === 'th' || getAppLanguage() === 'th' ? 'th' : 'en')
    }

    window.addEventListener('plant-settings-change', updateLanguage)
    return () => window.removeEventListener('plant-settings-change', updateLanguage)
  }, [])

  return language
}

function notificationAction(type, language) {
  if (type === 'like') return topBarCopy(language, 'liked your post', 'ถูกใจโพสต์ของคุณ')
  if (type === 'comment_like') return topBarCopy(language, 'liked your comment', 'ถูกใจความคิดเห็นของคุณ')
  if (type === 'reply') return topBarCopy(language, 'replied to your comment', 'ตอบกลับความคิดเห็นของคุณ')
  if (type === 'garden_prank') return topBarCopy(language, 'sent a prank to your garden', 'ส่งของแกล้งมายังสวนของคุณ')
  return topBarCopy(language, 'commented on your post', 'แสดงความคิดเห็นในโพสต์ของคุณ')
}

function notificationExcerpt(notification, language) {
  const excerpt = String(notification?.excerpt ?? '')
  if (language !== 'th' || notification?.type !== 'garden_prank') return excerpt
  if (/aphid/i.test(excerpt)) return 'พบเพลี้ยบนพืชที่กำลังปลูกของคุณ'
  if (/snail/i.test(excerpt)) return 'พบหอยทากบนพืชที่กำลังปลูกของคุณ'
  return excerpt
}

function isCommunityNotification(notification) {
  if (notification?.category) return notification.category === 'community'
  return ['like', 'comment', 'reply', 'comment_like'].includes(notification?.type)
}

function notificationTime(value, language) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return ''
  const elapsed = Math.max(0, Date.now() - timestamp)
  if (elapsed < 60_000) return topBarCopy(language, 'now', 'ตอนนี้')
  if (elapsed < 3_600_000) return topBarCopy(language, `${Math.floor(elapsed / 60_000)}m`, `${Math.floor(elapsed / 60_000)} นาที`)
  if (elapsed < 86_400_000) return topBarCopy(language, `${Math.floor(elapsed / 3_600_000)}h`, `${Math.floor(elapsed / 3_600_000)} ชม.`)
  return topBarCopy(language, `${Math.floor(elapsed / 86_400_000)}d`, `${Math.floor(elapsed / 86_400_000)} วัน`)
}

function notificationExactTime(value, language) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-GB', {
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(date)
}

export function TopBar({ activePage = 'lab', coinBalance = 0, coinDelta = null, communityUnreadNotificationCount = 0, demoMode = false, notificationError = '', notifications = [], notificationStatus = 'idle', onDemoExit, onDemoSignIn, onHelpOpen, onNavigate, onNotificationRead, onNotificationsRefresh, openWindow, profileOpen, setProfileOpen, unreadNotificationCount = 0, user, onAuthRequired, onLogout }) {
  const language = useTopBarLanguage()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [coinDetailsOpen, setCoinDetailsOpen] = useState(false)
  const [demoMenuOpen, setDemoMenuOpen] = useState(false)
  const accountMenuRef = useRef(null)
  const notificationMenuRef = useRef(null)
  const coinMenuRef = useRef(null)
  const demoMenuRef = useRef(null)
  const demoPageName = ({
    lab: 'Plant Lab',
    shop: 'Shop',
    history: 'History',
    community: 'Community',
    settings: 'Settings',
  })[activePage] ?? 'Academy'
  const displayName = user?.username ?? 'Learner'
  const learnerLevel = user?.level ?? 1
  const learnerExperience = Number(user?.experience ?? user?.level_progress?.experience ?? 0)
  const learnerNextExperience = Number(user?.level_progress?.next_level_experience ?? nextLevelExperience(learnerLevel))
  const learnerExpPercent = Math.max(0, Math.min(100, Number(user?.level_progress?.percent ?? ((learnerExperience / learnerNextExperience) * 100)) || 0))
  const initial = displayName.slice(0, 1).toUpperCase()
  const coinAmount = Number(user?.coin ?? coinBalance ?? 0)
  const shownCoins = (Number.isFinite(coinAmount) ? Math.max(0, Math.trunc(coinAmount)) : 0).toLocaleString()
  const shownMaxCoins = MAX_COIN_BALANCE.toLocaleString()
  const notificationBadge = unreadNotificationCount > 99 ? '99+' : String(unreadNotificationCount)
  const communityNotificationBadge = communityUnreadNotificationCount > 99 ? '99+' : String(communityUnreadNotificationCount)

  useEffect(() => {
    function handlePointerDown(event) {
      if (profileOpen && !accountMenuRef.current?.contains(event.target)) setProfileOpen(false)
      if (notificationsOpen && !notificationMenuRef.current?.contains(event.target)) setNotificationsOpen(false)
      if (coinDetailsOpen && !coinMenuRef.current?.contains(event.target)) setCoinDetailsOpen(false)
      if (demoMenuOpen && !demoMenuRef.current?.contains(event.target)) setDemoMenuOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      setProfileOpen(false)
      setMobileNavOpen(false)
      setNotificationsOpen(false)
      setCoinDetailsOpen(false)
      setDemoMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [coinDetailsOpen, demoMenuOpen, notificationsOpen, profileOpen, setProfileOpen])

  function handleProfileClick() {
    if (!user) {
      onAuthRequired?.('login')
      return
    }

    setCoinDetailsOpen(false)
    setProfileOpen((value) => !value)
  }

  function navigate(item) {
    const page = navPages[item] ?? 'lab'
    setMobileNavOpen(false)
    setProfileOpen(false)
    setNotificationsOpen(false)
    setCoinDetailsOpen(false)
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
    <header className="absolute left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-lime-100/15 bg-[#101511]/95 px-3 sm:px-5" data-tour="global-topbar">
      <div className="flex min-w-0 items-center gap-2 xl:gap-3">
        {demoMode ? (
          <div className="group flex h-16 shrink-0 items-center overflow-hidden pr-3 sm:pr-5" aria-label={`${demoPageName} preview`}>
            <img
              className="h-20 w-auto max-w-[128px] object-contain sm:h-24 sm:max-w-[160px]"
              src={plantGrowthLogo}
              alt="Plant Growth Academy"
            />
          </div>
        ) : (
          <button
            className="group flex h-16 shrink-0 items-center overflow-hidden border-r border-lime-100/10 pr-3 transition hover:bg-white/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-lime-200 sm:pr-5"
            type="button"
            aria-label="Go to home"
            onClick={() => navigate('Home')}
          >
            <img
              className="h-20 w-auto max-w-[128px] object-contain transition-transform duration-300 ease-out group-hover:scale-[1.04] sm:h-24 sm:max-w-[160px]"
              src={plantGrowthLogo}
              alt="Plant Growth Academy"
            />
          </button>
        )}
        {demoMode ? (
          <div className="hidden min-w-0 sm:block">
            <strong className="block truncate text-sm text-lime-50">{demoPageName} Preview</strong>
            <span className="block truncate text-[11px] text-slate-400">Browser-only sandbox - no data is saved</span>
          </div>
        ) : (
          <nav className="hidden h-16 min-w-0 items-end overflow-x-auto xl:flex" data-tour="global-navigation" aria-label="Primary">
            <ul className="flex min-w-max text-center text-sm font-medium text-slate-300">{renderNavItems()}</ul>
          </nav>
        )}
      </div>

      <div ref={accountMenuRef} className="relative flex items-center gap-2 text-sm">
        {demoMode && (
          <div className="relative" ref={demoMenuRef}>
            <button
              aria-expanded={demoMenuOpen}
              aria-haspopup="dialog"
              aria-label="Interactive demo options"
              className={`flex h-11 items-center justify-center gap-2 rounded-md border px-3 text-amber-100 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 sm:h-12 ${demoMenuOpen ? 'border-amber-200/40 bg-amber-300/15' : 'border-amber-200/20 bg-amber-300/[.08] hover:bg-amber-300/[.14]'}`}
              data-demo-session
              title="Interactive demo — changes are temporary"
              type="button"
              onClick={() => {
                setProfileOpen(false)
                setNotificationsOpen(false)
                setCoinDetailsOpen(false)
                setDemoMenuOpen((value) => !value)
              }}
            >
              <AppIcon className="h-4 w-4" name="shield" />
              <span className="hidden text-[10px] font-black tracking-[.12em] 2xl:inline">DEMO</span>
            </button>
            {demoMenuOpen && (
              <section className="absolute right-0 top-14 z-[90] w-[min(310px,calc(100vw-24px))] overflow-hidden rounded-xl border border-amber-200/20 bg-[#12160f]/98 shadow-[0_22px_55px_rgba(0,0,0,.52)] backdrop-blur-xl" aria-label="Interactive demo session" role="dialog">
                <div className="flex items-start gap-3 px-4 py-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-300/15 text-amber-200"><AppIcon name="shield" /></span>
                  <span>
                    <strong className="block text-sm text-amber-100">{demoPageName} preview</strong>
                    <small className="mt-1 block leading-5 text-slate-400">Explore this interface safely. Every change stays in temporary browser memory and never reaches the database.</small>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-white/[.08] p-3">
                  <button className="h-9 rounded-lg border border-white/10 bg-white/[.05] text-xs font-bold text-slate-200 transition hover:bg-white/[.09]" type="button" onClick={onDemoExit}>Exit demo</button>
                  <button className="h-9 rounded-lg bg-[#a5d98b] text-xs font-black text-[#101510] transition hover:bg-[#b7e6a0]" type="button" onClick={onDemoSignIn}>Sign in</button>
                </div>
              </section>
            )}
          </div>
        )}
        {user && (
          <button
            className="hidden h-11 w-11 place-items-center rounded-md border border-lime-100/10 bg-white/[0.04] text-slate-200 transition hover:border-[#9bcf82]/35 hover:bg-[#9bcf82]/10 hover:text-lime-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 sm:grid sm:h-12 sm:w-12"
            data-tour="help-button"
            type="button"
            aria-label="Open help and tutorials"
            title="Help and tutorials"
            onClick={() => {
              setProfileOpen(false)
              setMobileNavOpen(false)
              setNotificationsOpen(false)
              setCoinDetailsOpen(false)
              onHelpOpen?.()
            }}
          >
            <AppIcon className="h-5 w-5" name="help" />
          </button>
        )}

        {!demoMode && user && (
          <div className="relative" data-tour="global-notifications" ref={notificationMenuRef}>
            <button
              className={`relative grid h-11 w-11 place-items-center rounded-md border text-slate-200 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 sm:h-12 sm:w-12 ${notificationsOpen ? 'border-[#9bcf82]/45 bg-[#9bcf82]/12 text-lime-100' : 'border-lime-100/10 bg-white/[0.04] hover:bg-white/[0.075]'}`}
              type="button"
              aria-label={topBarCopy(language, `Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`, `การแจ้งเตือน${unreadNotificationCount ? ` มี ${unreadNotificationCount} รายการที่ยังไม่ได้อ่าน` : ''}`)}
              aria-haspopup="dialog"
              aria-expanded={notificationsOpen}
              onClick={() => {
                setProfileOpen(false)
                setMobileNavOpen(false)
                setCoinDetailsOpen(false)
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
              <section className="absolute right-0 top-14 z-[80] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-lime-100/15 bg-[#101511]/98 shadow-[0_22px_55px_rgba(0,0,0,.52)] backdrop-blur-xl" aria-label={topBarCopy(language, 'Notifications', 'การแจ้งเตือน')} role="dialog">
                <header className="flex items-center justify-between border-b border-lime-100/10 px-4 py-3">
                  <span>
                    <strong className="block text-sm text-lime-50">{topBarCopy(language, 'Notifications', 'การแจ้งเตือน')}</strong>
                    <small className="mt-0.5 block text-xs text-slate-400">{topBarCopy(language, 'Community, garden, and game updates', 'อัปเดตจากชุมชน สวน และเกม')}</small>
                  </span>
                  {unreadNotificationCount > 0 ? <span className="rounded-full bg-red-500/15 px-2 py-1 text-xs font-black text-red-300">{notificationBadge} {topBarCopy(language, 'new', 'ใหม่')}</span> : null}
                </header>

                <div className="game-themed-scrollbar max-h-[min(430px,calc(100vh-150px))] overflow-y-auto">
                  {notificationStatus === 'loading' ? <LoadingSkeleton count={4} label={topBarCopy(language, 'Loading notifications', 'กำลังโหลดการแจ้งเตือน')} variant="list" /> : null}
                  {notificationStatus !== 'loading' && notificationError && !notifications.length ? (
                    <div className="px-5 py-8 text-center">
                      <AppIcon className="mx-auto h-6 w-6 text-red-300" name="notifications" />
                      <p className="mt-2 text-xs text-slate-400">{topBarCopy(language, notificationError, 'ไม่สามารถโหลดการแจ้งเตือนได้')}</p>
                      <button className="mt-3 rounded-md border border-lime-100/15 px-3 py-2 text-xs font-bold text-lime-100 hover:bg-white/[0.05]" type="button" onClick={() => onNotificationsRefresh?.()}>{topBarCopy(language, 'Try again', 'ลองอีกครั้ง')}</button>
                    </div>
                  ) : null}
                  {notificationStatus !== 'loading' && !notificationError && !notifications.length ? (
                    <div className="px-6 py-10 text-center">
                      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white/[0.04] text-slate-400"><AppIcon className="h-5 w-5" name="notifications" /></span>
                      <strong className="mt-3 block text-sm text-lime-50">{topBarCopy(language, "You're all caught up", 'อ่านการแจ้งเตือนครบแล้ว')}</strong>
                      <span className="mt-1 block text-xs text-slate-400">{topBarCopy(language, 'New activity will appear here.', 'กิจกรรมใหม่จะแสดงที่นี่')}</span>
                    </div>
                  ) : null}
                  {notifications.map((notification) => {
                    const actorName = notification.actor?.username ?? topBarCopy(language, 'Learner', 'ผู้เรียน')
                    const isPlantDanger = notification.type === 'garden_prank'
                    const excerpt = notificationExcerpt(notification, language)
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
                            aria-label={topBarCopy(language, 'Plant at risk from pests', 'พืชอยู่ในอันตรายจากศัตรูพืช')}
                            title={topBarCopy(language, 'Plant at risk from pests', 'พืชอยู่ในอันตรายจากศัตรูพืช')}
                          >
                            <AppIcon className="h-4 w-4" name="warning" />
                            {!notification.is_read ? <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_3px_#101511]" aria-label={topBarCopy(language, 'Unread', 'ยังไม่ได้อ่าน')} /> : null}
                          </span>
                        ) : !notification.is_read ? (
                          <span className="absolute right-3 top-4 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,.12)]" aria-label={topBarCopy(language, 'Unread', 'ยังไม่ได้อ่าน')} />
                        ) : null}
                        <ProfileAvatar initial={actorName.slice(0, 1).toUpperCase()} user={notification.actor} />
                        <span className={`min-w-0 flex-1 ${isPlantDanger ? 'pr-10' : 'pr-5'}`}>
                          <span className="block text-xs leading-5">
                            <strong className="text-lime-50">{actorName}</strong>{' '}
                            <span className={notification.is_read ? 'text-slate-400' : 'text-slate-200'}>{notificationAction(notification.type, language)}</span>
                          </span>
                          {excerpt ? <span className="mt-0.5 block truncate text-xs text-slate-400">“{excerpt}”</span> : null}
                          {isPlantDanger ? (
                            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-red-400/20 bg-red-500/10 px-2 py-1 text-xs font-black text-red-300">
                              <AppIcon className="h-3 w-3" name="warning" />
                              {topBarCopy(language, 'Plant at risk', 'พืชอยู่ในอันตราย')}
                            </span>
                          ) : null}
                          <time
                            className={`mt-1 block cursor-help text-xs decoration-dotted underline-offset-4 hover:text-slate-200 hover:underline ${notification.is_read ? 'text-slate-500' : 'font-bold text-red-300'}`}
                            dateTime={notification.created_at || undefined}
                            title={notificationExactTime(notification.created_at, language)}
                          >
                            {notificationTime(notification.created_at, language)}
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

        {!demoMode && user && (
          <div className="group relative" data-tour="global-coins" ref={coinMenuRef}>
            <button
              className="relative flex h-11 items-center gap-1.5 rounded-md border border-lime-100/10 bg-white/[0.04] px-2 shadow-[0_8px_18px_rgba(0,0,0,.18)] transition hover:border-amber-200/30 hover:bg-amber-200/[0.07] focus-visible:border-amber-200/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 sm:h-12 sm:gap-2 sm:px-3"
              type="button"
              aria-label={`Coin balance: ${shownCoins}. ${coinDetailsOpen ? 'Close' : 'Open'} balance details.`}
              aria-describedby="coin-balance-tooltip"
              aria-expanded={coinDetailsOpen}
              onClick={() => {
                setProfileOpen(false)
                setMobileNavOpen(false)
                setNotificationsOpen(false)
                setCoinDetailsOpen((value) => !value)
              }}
            >
              <img className="h-6 w-6 shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(251,191,36,.25)] sm:h-7 sm:w-7" src={imageAssets.coin} alt="" />
              <span className="min-w-6 text-right text-xs font-black tabular-nums text-lime-50 sm:min-w-10 sm:text-sm">{shownCoins}</span>
            </button>
            {coinDelta ? (
              <span className="coin-pop pointer-events-none absolute -top-3 right-2 rounded-full border border-amber-100/25 bg-[#1b1a10] px-2 py-0.5 text-xs font-black text-amber-200 shadow-[0_8px_18px_rgba(0,0,0,.28)]" aria-live="polite" title="Simulation reward">
                +{coinDelta}
              </span>
            ) : null}

            <section
              className={`pointer-events-none absolute right-0 top-[calc(100%+10px)] z-[90] w-[min(304px,calc(100vw-24px))] overflow-hidden rounded-xl border border-amber-100/20 bg-[#111712]/[0.98] shadow-[0_24px_60px_rgba(0,0,0,.58),0_0_28px_rgba(245,158,11,.08)] backdrop-blur-xl transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 ${
                coinDetailsOpen ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0'
              }`}
              id="coin-balance-tooltip"
              role="tooltip"
            >
              <span className="absolute right-5 top-0 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-l border-t border-amber-100/20 bg-[#111712]" aria-hidden="true" />

              <header className="flex items-center gap-3 border-b border-amber-100/10 px-4 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-200/20 bg-amber-300/10 shadow-[inset_0_0_14px_rgba(251,191,36,.08)]">
                  <img className="h-7 w-7 object-contain" src={imageAssets.coin} alt="" />
                </span>
                <span className="min-w-0">
                  <strong className="block text-sm font-black text-amber-100">Coins</strong>
                  <small className="mt-0.5 block text-xs text-slate-400">Academy currency</small>
                </span>
                <strong className="ml-auto text-right text-base font-black tabular-nums text-amber-200">{shownCoins}</strong>
              </header>

              <div className="px-4 py-3.5">
                <strong className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-lime-200">
                  <AppIcon className="h-3.5 w-3.5" name="plant" />
                  How to earn coins
                </strong>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  Grow a plant to full maturity and claim its reward before harvesting.
                </p>
                <p className="mt-1.5 text-xs leading-5 text-slate-400">
                  Use coins for care tools and friend pranks in the Shop.
                </p>

                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-lime-100/10 bg-white/[0.035] px-3 py-2.5">
                    <dt className="text-[11px] font-bold text-slate-400">Current balance</dt>
                    <dd className="mt-1 truncate text-sm font-black tabular-nums text-lime-100">{shownCoins}</dd>
                  </div>
                  <div className="rounded-lg border border-lime-100/10 bg-white/[0.035] px-3 py-2.5">
                    <dt className="text-[11px] font-bold text-slate-400">Maximum balance</dt>
                    <dd className="mt-1 truncate text-sm font-black tabular-nums text-slate-200" title={shownMaxCoins}>{shownMaxCoins}</dd>
                  </div>
                </dl>
              </div>
            </section>
          </div>
        )}

        {!demoMode && <button
          className="grid h-11 w-11 place-items-center rounded-md border border-lime-100/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.075] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 xl:hidden"
          type="button"
          aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileNavOpen}
          onClick={() => {
            setProfileOpen(false)
            setCoinDetailsOpen(false)
            setMobileNavOpen((value) => !value)
          }}
        >
          <AppIcon className="h-5 w-5" name={mobileNavOpen ? 'panelClose' : 'sort'} />
        </button>}

        {!demoMode && <button
          className="flex items-center gap-3 rounded-md bg-white/[0.045] px-3 py-2 text-left transition hover:bg-white/[0.075] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
          data-tour="global-profile"
          type="button"
          aria-haspopup={user ? 'menu' : undefined}
          aria-expanded={user ? profileOpen : undefined}
          onClick={handleProfileClick}
        >
          <ProfileAvatar user={user} initial={initial} />
          <span className="hidden leading-none md:block">
            <strong className="block text-xs text-lime-50">{user ? `${displayName} Lv.${learnerLevel}` : 'Sign in'}</strong>
            <small className="mt-1 block text-xs text-slate-400">{user ? 'profile' : 'Continue with Google'}</small>
          </span>
          <AppIcon className={`h-4 w-4 text-slate-300 transition ${profileOpen && user ? 'rotate-180' : ''}`} name="arrowDown" />
        </button>}

        {!demoMode && profileOpen && user && (
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
              data-tour="help-button"
              type="button"
              role="menuitem"
              onClick={() => {
                setProfileOpen(false)
                onHelpOpen?.()
              }}
            >
              <AppIcon className="h-4 w-4 text-slate-400" name="help" />
              Help & tutorials
            </button>
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

      {!demoMode && mobileNavOpen && (
        <nav className="absolute left-3 right-3 top-[68px] z-[65] rounded-xl border border-lime-100/15 bg-[#101511]/98 p-3 shadow-[0_22px_50px_rgba(0,0,0,.48)] backdrop-blur-xl xl:hidden" aria-label="Mobile navigation">
          <ul className="grid grid-cols-2 gap-2">{renderNavItems(true)}</ul>
        </nav>
      )}
    </header>
  )
}
