import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { createPostComment, createPostCommentReply, getCommunityInsights, getCommunityLeaderboard, getFriendPosts, getFriends, getPostComments, getPosts, getToken, inviteFriend, likePost, likePostComment, resolveAssetUrl, searchUsers, unlikePost, unlikePostComment, updateMe } from '../../lib/api'
import { getAppLanguage } from '../../i18n/appI18n'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ParticleNetworkBackground } from '../components/ParticleNetworkBackground'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { formatPlantDuration } from '../../utils/plantDuration'

const CommunityLanguageContext = createContext('en')
const communityReturnStateKey = 'plant_game_community_return_state'
const hiddenCommunityPostsStoragePrefix = 'plant_game_hidden_community_posts'

function hiddenCommunityPostsStorageKey(userId) {
  return `${hiddenCommunityPostsStoragePrefix}:${userId ?? 'guest'}`
}

function loadHiddenCommunityPostIds(userId) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(hiddenCommunityPostsStorageKey(userId)) ?? '[]')
    return Array.isArray(saved) ? [...new Set(saved.map(String).filter(Boolean))] : []
  } catch {
    return []
  }
}

function saveHiddenCommunityPostIds(userId, ids) {
  try {
    window.localStorage.setItem(hiddenCommunityPostsStorageKey(userId), JSON.stringify(ids.slice(-500)))
  } catch {
    // Hiding still works for the current session when storage is unavailable.
  }
}

function consumeCommunityReturnState() {
  try {
    const raw = window.sessionStorage.getItem(communityReturnStateKey)
    window.sessionStorage.removeItem(communityReturnStateKey)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function useCommunityLanguage() {
  return useContext(CommunityLanguageContext)
}

function copy(language, english, thai) {
  return language === 'th' ? thai : english
}

function displayName(user) {
  return user?.username ?? user?.email?.split('@')[0] ?? 'Learner'
}

function avatarLabel(value) {
  return String(value ?? 'L').slice(0, 1).toUpperCase()
}

function UserAvatar({ user, fallback, className = '', imageClassName = '', showRing = true }) {
  const label = fallback ?? avatarLabel(displayName(user))

  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#263022] font-black text-lime-100 ${showRing ? 'ring-1 ring-lime-100/10' : ''} ${className}`}>
      {label}
      {user?.avatar_url && <img className={`absolute inset-0 h-full w-full object-cover object-center ${imageClassName}`} src={resolveAssetUrl(user.avatar_url)} alt="" onError={(event) => { event.currentTarget.hidden = true }} />}
    </span>
  )
}

function CoverImage({ user, preview = '' }) {
  const src = preview || (user?.cover_url ? resolveAssetUrl(user.cover_url) : '')

  if (!src) return null

  return <img className="absolute inset-0 z-0 h-full w-full object-cover object-center" src={src} alt="" onError={(event) => { event.currentTarget.hidden = true }} />
}

function formatTime(value, language = getAppLanguage()) {
  if (!value) return copy(language, 'just now', 'เมื่อสักครู่')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return copy(language, 'recently', 'เมื่อไม่นานมานี้')

  return date.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', { day: '2-digit', month: 'short' })
}

function formatExactDateTime(value, language = getAppLanguage()) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-GB', {
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(date)
}

function formatNotificationTime(value, language = getAppLanguage()) {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return copy(language, 'just now', 'เมื่อสักครู่')
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000))
  if (seconds < 60) return copy(language, 'just now', 'เมื่อสักครู่')
  if (seconds < 3600) return language === 'th' ? `${Math.floor(seconds / 60)} นาที` : `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return language === 'th' ? `${Math.floor(seconds / 3600)} ชม.` : `${Math.floor(seconds / 3600)}h`
  if (seconds < 604800) return language === 'th' ? `${Math.floor(seconds / 86400)} วัน` : `${Math.floor(seconds / 86400)}d`
  return new Date(value).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', { day: '2-digit', month: 'short' })
}

function formatJoinedDate(value, language = getAppLanguage()) {
  if (!value) return copy(language, 'Joined recently', 'เพิ่งเข้าร่วม')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return copy(language, 'Joined recently', 'เพิ่งเข้าร่วม')
  const monthYear = date.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', { month: 'long', year: 'numeric' })
  return copy(language, `Joined ${monthYear}`, `เข้าร่วมเมื่อ ${monthYear}`)
}

function formatGrowthNumber(value, maximumFractionDigits = 1) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'

  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(number)
}

function looksLikeBrokenThai(value) {
  return /(?:Ã|Â|à[¸¹]|â(?:€|„|¢|¹|¸))/u.test(String(value ?? ''))
}

function getLevelInfo(user) {
  const rawLevel = Number(user?.level ?? user?.level_progress?.level ?? 1)
  const level = Number.isFinite(rawLevel) && rawLevel > 0 ? Math.floor(rawLevel) : 1
  const rawExp = Number(user?.experience ?? user?.level_progress?.experience ?? 0)
  const exp = Number.isFinite(rawExp) && rawExp > 0 ? Math.floor(rawExp) : 0
  const required = Number(user?.level_progress?.next_level_experience ?? 100 + (level - 1) * 50)
  const nextExp = Number.isFinite(required) && required > 0 ? required : 100
  const rawPercent = Number(user?.level_progress?.percent ?? (exp / nextExp) * 100)
  const percent = Math.max(0, Math.min(100, Number.isFinite(rawPercent) ? rawPercent : 0))

  return { level, exp, nextExp, percent }
}

function normalizeUser(user) {
  const name = displayName(user)

  return {
    ...user,
    name,
    handle: `@${user?.username ?? name.replace(/\s+/g, '').toLowerCase()}`,
    avatar: avatarLabel(name),
    levelInfo: getLevelInfo(user),
  }
}

function mapPost(post) {
  const user = post.user ?? {}
  const history = post.plant_history ?? null
  const liveSimulator = post.live_simulator ?? null
  const name = post.author ?? displayName(user)

  return {
    ...post,
    author: name,
    handle: post.handle ?? `@${user.username ?? name.replace(/\s+/g, '').toLowerCase()}`,
    avatar: post.avatar ?? avatarLabel(name),
    body: post.caption || history?.analysis_result || post.body || 'Shared a plant growth history from the lab.',
    replies: post.comments_count ?? post.replies ?? 0,
    reposts: post.reposts ?? 0,
    likes: post.likes_count ?? post.likes ?? 0,
    likedByMe: Boolean(post.liked_by_me ?? post.likedByMe),
    level: user.level ?? post.level ?? null,
    history,
    liveSimulator,
  }
}

function LeftNavItem({ active = false, badge = 0, icon, label, onClick }) {
  return (
    <button
      type="button"
      className={`flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${
        active
          ? 'border-[#9bcf82]/20 bg-[#22301f] font-bold text-lime-50 shadow-[inset_3px_0_0_#9bcf82,0_6px_18px_rgba(0,0,0,.16)]'
          : 'border-transparent text-slate-400 hover:border-lime-100/10 hover:bg-white/[0.035] hover:text-lime-50'
      }`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      <span className="relative shrink-0">
        <AppIcon className={`h-4 w-4 ${active ? 'text-lime-100' : 'text-slate-400'}`} name={icon} />
        {badge > 0 ? (
          <span className="absolute -right-2 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-xs font-black leading-none text-white ring-2 ring-[#151817]">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      {label}
    </button>
  )
}

function MobileNavItem({ active = false, badge = 0, icon, label, onClick }) {
  return (
    <button
      type="button"
      className={`relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-lime-200 ${
        active ? 'bg-[#9bcf82]/10 text-lime-100' : 'text-slate-400 hover:bg-white/[0.04] hover:text-lime-50'
      }`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      <span className="relative">
        <AppIcon className="h-5 w-5" name={icon} />
        {badge > 0 ? (
          <span className="absolute -right-3 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-xs font-black leading-none text-white ring-2 ring-[#101412]">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      <span className="max-w-full truncate">{label}</span>
      {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#9bcf82]" /> : null}
    </button>
  )
}

function CommunityState({ actionLabel, description, loading = false, loadingVariant = 'list', onAction, title }) {
  if (loading) {
    return <LoadingSkeleton className="min-h-[420px]" count={loadingVariant === 'feed' ? 3 : 5} label={title} variant={loadingVariant} />
  }

  return (
    <div className="grid min-h-[420px] place-items-center px-6 py-12 text-center" aria-live="polite">
      <div className="max-w-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-lime-100/10 bg-white/[0.035] text-lime-100">
          <AppIcon className="h-5 w-5" name="plant" />
        </span>
        <h2 className="mt-4 text-base font-black text-lime-50">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        {onAction ? (
          <button
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#9bcf82]/30 bg-[#9bcf82]/10 px-5 text-sm font-black text-lime-100 transition hover:bg-[#9bcf82]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            onClick={onAction}
            type="button"
          >
            <AppIcon className="h-4 w-4" name="restartAlt" />
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function HeartBurst({ burstKey, small = false }) {
  if (!burstKey) return null

  return (
    <span
      key={burstKey}
      className={`pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-rose-400 ${small ? 'text-sm' : 'text-base'}`}
      style={{ animation: 'pg-heart-pop 700ms cubic-bezier(.16,1,.3,1) forwards' }}
      aria-hidden="true"
    >
      <AppIcon className={small ? 'h-3.5 w-3.5' : 'h-4 w-4'} name="heart" />
    </span>
  )
}

function ActionButton({ active = false, burstKey, icon, label, onClick, value }) {
  return (
    <button
      type="button"
      className={`relative inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${
        active ? 'text-rose-400' : 'text-slate-400 hover:text-lime-100'
      }`}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
      aria-label={label}
    >
      <HeartBurst burstKey={burstKey} />
      <AppIcon className="h-4 w-4" name={icon} />
      <span>{value}</span>
    </button>
  )
}

function CommunityMotionStyles() {
  return (
    <style>{`
      @keyframes pg-heart-pop {
        0% { opacity: 0; transform: translate(-50%, 8px) scale(.55); filter: blur(1px); }
        18% { opacity: 1; transform: translate(-50%, -2px) scale(1.12); filter: blur(0); }
        100% { opacity: 0; transform: translate(-50%, -22px) scale(.88); filter: blur(0); }
      }
      @keyframes pg-eye-focus {
        0% { opacity: 0; transform: scale(.72); }
        65% { opacity: 1; transform: scale(1.08); }
        100% { opacity: 1; transform: scale(1); }
      }
      .game-preview:hover .game-preview-eye,
      .game-preview:focus-visible .game-preview-eye { animation: pg-eye-focus 260ms cubic-bezier(.16,1,.3,1) both; }
      @media (prefers-reduced-motion: reduce) {
        [style*='pg-heart-pop'] { animation-duration: 1ms !important; }
        .game-preview:hover .game-preview-eye,
        .game-preview:focus-visible .game-preview-eye { animation-duration: 1ms !important; }
      }
      .community-shared-scroll {
        scrollbar-color: rgba(155,207,130,.62) rgba(8,13,10,.72);
        scrollbar-gutter: stable;
        scrollbar-width: thin;
      }
      .community-shared-scroll::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }
      .community-shared-scroll::-webkit-scrollbar-track {
        border-radius: 999px;
        background: rgba(8,13,10,.72);
      }
      .community-shared-scroll::-webkit-scrollbar-thumb {
        border: 2px solid transparent;
        border-radius: 999px;
        background: rgba(155,207,130,.62);
        background-clip: padding-box;
      }
      .community-shared-scroll::-webkit-scrollbar-thumb:hover {
        background: rgba(175,224,154,.84);
        background-clip: padding-box;
      }
      .community-shared-scroll::-webkit-scrollbar-button {
        display: none;
        width: 0;
        height: 0;
      }
      .community-shared-scroll::-webkit-scrollbar-corner {
        background: transparent;
      }
    `}</style>
  )
}

function updateCommentTree(comments, commentId, updater) {
  return comments.map((comment) => {
    if (String(comment.id) === String(commentId)) return updater(comment)

    return {
      ...comment,
      replies: updateCommentTree(comment.replies ?? [], commentId, updater),
    }
  })
}

function addReplyToTree(comments, parentId, reply) {
  return comments.map((comment) => {
    if (String(comment.id) === String(parentId)) {
      return { ...comment, replies: [...(comment.replies ?? []), reply] }
    }

    return {
      ...comment,
      replies: addReplyToTree(comment.replies ?? [], parentId, reply),
    }
  })
}

function HistoryPreview({ history, liveSimulator, onOpenGame, post }) {
  const language = useCommunityLanguage()
  if (!history && !liveSimulator) return null
  const isLive = Boolean(liveSimulator && liveSimulator.status === 'active' && liveSimulator.share_visibility !== 'private')
  const score = Number(history?.total_score ?? liveSimulator?.growth_point ?? 0)
  const health = Number(history?.final_health ?? history?.health ?? liveSimulator?.health ?? 0)
  const growthCalculation = history?.growth_calculation ?? history?.game_state?.growth_calculation ?? null
  const secondsPerRealDay = Number(
    growthCalculation?.seconds_per_real_day
      ?? growthCalculation?.normal_seconds_per_real_day,
  )
  const snapshotUrl = history?.snapshot_image_url || liveSimulator?.snapshot_image_url
  const imageUrl = snapshotUrl || liveSimulator?.plant?.image_url
  return (
    <button
      className="game-preview group relative mt-3 block w-full overflow-hidden rounded-lg border border-lime-100/10 bg-[#172344] text-left transition hover:border-[#9bcf82]/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onOpenGame?.(post)
      }}
      aria-label={isLive ? copy(language, 'Enter spectator mode', 'เข้าสู่โหมดผู้ชม') : copy(language, 'Open saved game state', 'เปิดสถานะเกมที่บันทึก')}
    >
      <div className="relative h-48 bg-[#080b09]">
        {imageUrl ? (
          <img className={`h-full w-full transition duration-300 group-hover:scale-[1.015] ${snapshotUrl ? 'object-cover' : 'object-contain p-6'}`} src={resolveAssetUrl(imageUrl)} alt={isLive ? copy(language, 'Live plant garden', 'สวนพืชแบบสด') : copy(language, 'Saved plant game state', 'สถานะเกมพืชที่บันทึกไว้')} />
        ) : (
          <div className="grid h-full place-items-center text-sm text-slate-400">{isLive ? copy(language, 'Live plant garden', 'สวนพืชแบบสด') : copy(language, 'Saved game state', 'สถานะเกมที่บันทึกไว้')}</div>
        )}
        <span className={`absolute left-3 top-3 inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-black ${isLive ? 'bg-[#9bcf82] text-[#101511]' : 'bg-[#101511]/90 text-lime-100'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-[#101511]' : 'bg-slate-400'}`} />
          {isLive ? copy(language, 'LIVE GARDEN', 'สวนแบบสด') : copy(language, 'SAVED GAME STATE', 'สถานะเกมที่บันทึก')}
        </span>
        <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 transition duration-200 group-hover:bg-black/35 group-focus-visible:bg-black/35">
          <span className="game-preview-eye grid h-12 w-12 scale-75 place-items-center rounded-full border border-lime-100/25 bg-[#101511]/90 text-lime-100 opacity-0 shadow-[0_8px_18px_rgba(0,0,0,.3)] group-hover:opacity-100 group-focus-visible:opacity-100">
            <AppIcon className="h-6 w-6" name="eye" />
          </span>
        </span>
      </div>
      <div className={`grid grid-cols-2 gap-2 p-3 text-xs ${growthCalculation && !isLive ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <span className="rounded-md bg-white/[0.04] px-2 py-2 text-slate-300">{copy(language, 'Score', 'คะแนน')} <strong className="text-lime-100">{score}</strong></span>
        <span className="rounded-md bg-white/[0.04] px-2 py-2 text-slate-300">{copy(language, 'Health', 'สุขภาพ')} <strong className="text-lime-100">{health}%</strong></span>
        <span className="rounded-md bg-white/[0.04] px-2 py-2 text-slate-300">{isLive ? copy(language, 'Growth', 'การเติบโต') : copy(language, 'Grow time', 'เวลาปลูก')} <strong className="text-lime-100">{isLive ? `${Math.round(score)}%` : formatPlantDuration(history, language, { compact: true })}</strong></span>
        {growthCalculation && !isLive ? (
          <span
            className="rounded-md border border-cyan-300/10 bg-cyan-300/[0.045] px-2 py-2 text-slate-300"
            title={copy(language, `1 real-life growth day ≈ ${formatGrowthNumber(secondsPerRealDay, 2)} game seconds`, `1 วันเติบโตจริง ≈ ${formatGrowthNumber(secondsPerRealDay, 2)} วินาทีในเกม`)}
          >
            {copy(language, 'Real-life growth', 'วันเติบโตจริง')}{' '}
            <strong className="block truncate text-cyan-200">
              {formatGrowthNumber(growthCalculation.equivalent_days)} / ~{formatGrowthNumber(growthCalculation.maturity_days, 0)} {copy(language, 'days', 'วัน')}
            </strong>
          </span>
        ) : null}
      </div>
      <span className="flex w-full items-center justify-center gap-2 border-t border-lime-100/10 bg-[#9bcf82]/10 px-3 py-3 text-xs font-black text-lime-100 transition group-hover:bg-[#9bcf82]/18">
        <AppIcon className="h-4 w-4" name="eye" />
        {isLive ? copy(language, 'Enter spectator mode', 'เข้าสู่โหมดผู้ชม') : copy(language, 'Open saved game state', 'เปิดสถานะเกมที่บันทึก')}
      </span>
    </button>
  )
}

function ProfileHoverCard({ align = 'left', onSelectUser, user }) {
  const language = useCommunityLanguage()
  const normalized = normalizeUser(user)
  const bio = user?.bio || copy(language, 'Plant Growth Academy learner sharing saved simulations and classroom observations.', 'ผู้เรียน Plant Growth Academy ที่แบ่งปันการจำลองและข้อสังเกตจากห้องเรียน')
  const plantCount = Number(user?.plants_count ?? user?.plant_histories_count ?? 0)
  const friendCount = Number(user?.friends_count ?? 0)

  return (
    <div className={`pointer-events-none absolute top-full z-50 mt-3 w-[min(18rem,calc(100vw-2rem))] translate-y-1 overflow-hidden rounded-xl border border-lime-100/10 bg-[#101312] text-left opacity-0 shadow-[0_18px_42px_rgba(0,0,0,0.44)] transition duration-200 group-hover/profile:pointer-events-auto group-hover/profile:translate-y-0 group-hover/profile:opacity-100 group-focus-within/profile:pointer-events-auto group-focus-within/profile:translate-y-0 group-focus-within/profile:opacity-100 ${align === 'right' ? 'right-0' : 'left-0'}`}>
      <div className="relative h-20 overflow-hidden bg-gradient-to-br from-[#34482d] via-[#253322] to-[#151b16]">
        <CoverImage user={user} />
        <span className="absolute inset-0 z-10 bg-gradient-to-t from-[#101312]/90 via-transparent to-black/10" />
      </div>
      <div className="relative z-20 px-4 pb-4">
        <button className="-mt-7 flex w-full items-end gap-3 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200" onClick={() => onSelectUser?.(user)} type="button">
          <UserAvatar className="h-14 w-14 bg-[#263022] text-base" fallback={normalized.avatar} imageClassName="scale-[1.12]" showRing={false} user={user} />
          <span className="min-w-0 flex-1 pb-1">
            <span className="flex items-center gap-2">
              <strong className="truncate text-sm text-lime-50">{normalized.name}</strong>
              <span className="shrink-0 rounded-md border border-lime-100/10 bg-[#1b241a] px-1.5 py-0.5 text-xs font-bold text-lime-100">Lv.{normalized.levelInfo.level}</span>
            </span>
            <span className="block truncate text-xs text-slate-400">{normalized.handle}</span>
          </span>
        </button>
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">{bio}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-400">
        <span className="rounded-md bg-white/[0.04] px-2 py-2"><strong className="text-lime-100">{friendCount}</strong> {copy(language, 'friends', 'เพื่อน')}</span>
        <span className="rounded-md bg-white/[0.04] px-2 py-2"><strong className="text-lime-100">{plantCount}</strong> {copy(language, 'plants', 'พืช')}</span>
      </div>
      </div>
    </div>
  )
}

function FeedPost({ hidden = false, onHide, onOpenGame, onOpenPost, onRestore, onSelectUser, onToggleLike, post, reactionBurstKey }) {
  const language = useCommunityLanguage()
  const postUser = post.user ?? { username: post.author, level: post.level }

  if (hidden) {
    return (
      <article className="border-b border-lime-100/10 px-8 py-5">
        <div className="flex min-h-24 items-center gap-4 rounded-xl border border-dashed border-lime-100/15 bg-white/[0.025] px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-lime-100/10 bg-[#101511] text-slate-400">
            <AppIcon className="h-4 w-4" name="eyeOff" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm text-lime-50">{copy(language, 'You hid this post', 'คุณได้ปิดการมองเห็นโพสต์นี้แล้ว')}</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-400">{copy(language, 'This only affects your Community feed.', 'การตั้งค่านี้มีผลเฉพาะหน้าชุมชนของคุณ')}</span>
          </span>
          <button
            className="min-h-10 shrink-0 rounded-lg border border-[#9bcf82]/30 bg-[#9bcf82]/10 px-4 text-xs font-black text-lime-100 transition hover:bg-[#9bcf82]/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            onClick={() => onRestore?.(post)}
            type="button"
          >
            {copy(language, 'Undo', 'ยกเลิก')}
          </button>
        </div>
      </article>
    )
  }

  return (
    <article
      className="cursor-pointer border-b border-lime-100/10 px-8 py-7 transition hover:bg-white/[0.018] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
      onClick={() => onOpenPost(post)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpenPost(post)
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex gap-4">
        <div className="group/profile relative h-fit shrink-0" data-tour="community-profile-preview" onClick={(event) => event.stopPropagation()}>
          <button
            className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#263022] text-sm font-black text-lime-100 ring-1 ring-lime-100/10 transition hover:ring-[#8fbf78]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            onClick={() => onSelectUser?.(postUser)}
            type="button"
            aria-label={'Open ' + post.author + ' profile'}
          >
            <UserAvatar className="h-full w-full text-sm ring-0" fallback={post.avatar} user={postUser} />
          </button>
          <ProfileHoverCard onSelectUser={onSelectUser} user={postUser} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center" onClick={(event) => event.stopPropagation()}>
              <div className="group/profile relative min-w-0">
                <button className="min-w-0 text-left" onClick={() => onSelectUser?.(postUser)} type="button">
                  <strong className="mr-1 text-sm text-lime-50">{post.author}</strong>
                  <span className="text-xs text-slate-400">{post.handle}</span>
                  {post.level ? <span className="ml-2 rounded-md border border-lime-100/10 bg-white/[0.03] px-1.5 py-0.5 text-xs font-bold text-slate-500">Lv.{post.level}</span> : null}
                </button>
                <ProfileHoverCard onSelectUser={onSelectUser} user={postUser} />
              </div>
              <time
                className="ml-2 cursor-help text-xs text-slate-500 decoration-dotted underline-offset-4 hover:text-slate-300 hover:underline"
                dateTime={post.created_at || undefined}
                title={formatExactDateTime(post.created_at, language)}
              >
                {formatTime(post.created_at, language)}
              </time>
            </div>
            <button
              type="button"
              className="grid min-h-11 min-w-11 place-items-center rounded-md text-slate-400 transition hover:bg-white/[0.06] hover:text-lime-50"
              onClick={(event) => {
                event.stopPropagation()
                onHide?.(post)
              }}
              aria-label={copy(language, 'Hide this post', 'ปิดการมองเห็นโพสต์นี้')}
              title={copy(language, 'Hide this post', 'ปิดการมองเห็นโพสต์นี้')}
            >
              <AppIcon className="h-4 w-4" name="more" />
            </button>
          </div>
          <div className="block w-full text-left">
            <p className="whitespace-pre-line text-sm leading-6 text-slate-100">{post.body}</p>
            {post.history || post.liveSimulator ? <HistoryPreview history={post.history} liveSimulator={post.liveSimulator} onOpenGame={onOpenGame} post={post} /> : null}
          </div>
          <div className="mt-5 grid max-w-[180px] grid-cols-2 text-slate-400" data-tour="community-post-actions">
            <ActionButton active={post.likedByMe} burstKey={reactionBurstKey} icon="heart" label="Like post" onClick={() => onToggleLike(post)} value={post.likes} />
            <ActionButton icon="chat" label="Comment on post" onClick={() => onOpenPost(post)} value={post.replies} />
          </div>
        </div>
      </div>
    </article>
  )
}

function CommentItem({ burstKeys, comment, depth = 0, onReplyDraftChange, onSelectUser, onStartReply, onSubmitReply, onToggleCommentLike, replyingToId, replyDrafts, submittingReply }) {
  const language = useCommunityLanguage()
  const author = displayName(comment.user)
  const replies = comment.replies ?? []
  const isReplying = String(replyingToId) === String(comment.id)
  const draft = replyDrafts[comment.id] ?? ''

  return (
    <div className={`relative ${depth ? 'ml-7 border-l border-lime-100/10 pl-4' : ''}`}>
      <div className="flex gap-3">
        <div className="group/profile relative h-fit shrink-0">
          <button
            className="rounded-full transition hover:ring-[#8fbf78]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            onClick={() => onSelectUser?.(comment.user)}
            type="button"
            aria-label={'Open ' + author + ' profile'}
          >
            <UserAvatar className="h-9 w-9 text-xs" fallback={avatarLabel(author)} user={comment.user} />
          </button>
          <ProfileHoverCard onSelectUser={onSelectUser} user={comment.user} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="inline-block max-w-full rounded-2xl rounded-tl-md bg-white/[0.075] px-3 py-2">
            <div className="group/profile relative w-fit">
              <button className="block text-left text-xs font-black text-lime-50 transition hover:text-[#9bcf82] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200" onClick={() => onSelectUser?.(comment.user)} type="button">{author}</button>
              <ProfileHoverCard onSelectUser={onSelectUser} user={comment.user} />
            </div>
            <p className="whitespace-pre-line text-sm leading-5 text-slate-100">{comment.comment_text}</p>
          </div>
          <div className="mt-1 flex items-center gap-3 px-2 text-xs font-semibold text-slate-500">
            <time
              className="cursor-help decoration-dotted underline-offset-4 hover:text-slate-300 hover:underline"
              dateTime={comment.created_at || undefined}
              title={formatExactDateTime(comment.created_at, language)}
            >
              {formatTime(comment.created_at, language)}
            </time>
            <button
              className={`relative transition ${comment.liked_by_me ? 'text-rose-400' : 'hover:text-lime-100'}`}
              onClick={() => onToggleCommentLike(comment)}
              type="button"
            >
              <HeartBurst burstKey={burstKeys[comment.id]} small />
              Like
            </button>
            <button className="transition hover:text-lime-100" onClick={() => onStartReply(comment.id)} type="button">Reply</button>
            {Number(comment.likes_count ?? 0) > 0 ? (
              <span className="inline-flex items-center gap-1 text-rose-400">
                <AppIcon className="h-3 w-3" name="heart" />
                {comment.likes_count}
              </span>
            ) : null}
          </div>

          {isReplying ? (
            <form className="mt-3 flex items-end gap-2" onSubmit={(event) => onSubmitReply(event, comment.id)}>
              <label className="min-w-0 flex-1">
                <span className="sr-only">Write a reply</span>
                <textarea
                  className="max-h-24 min-h-10 w-full resize-none rounded-2xl border border-lime-100/10 bg-[#101312] px-3 py-2 text-sm leading-5 text-lime-50 outline-none transition placeholder:text-slate-500 focus:border-[#8fbf78]"
                  onChange={(event) => onReplyDraftChange(comment.id, event.target.value)}
                  placeholder={`Reply to ${author}...`}
                  rows={1}
                  value={draft}
                />
              </label>
              <button
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#8fbf78] text-[#101511] transition hover:bg-[#a6d892] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={submittingReply || !draft.trim()}
                type="submit"
                aria-label="Send reply"
              >
                <AppIcon className="h-4 w-4" name="send" />
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {replies.length ? (
        <div className="mt-3 space-y-3">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              burstKeys={burstKeys}
              comment={reply}
              depth={depth + 1}
              onReplyDraftChange={onReplyDraftChange}
              onSelectUser={onSelectUser}
              onStartReply={onStartReply}
              onSubmitReply={onSubmitReply}
              onToggleCommentLike={onToggleCommentLike}
              replyingToId={replyingToId}
              replyDrafts={replyDrafts}
              submittingReply={submittingReply}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
function PostModal({ actionError = '', commentBurstKeys, commentDraft, comments, commentsLoading = false, currentUser, onClose, onCommentDraftChange, onOpenGame, onReplyDraftChange, onSelectUser, onStartReply, onSubmitComment, onSubmitReply, onToggleCommentLike, onToggleLike, post, postBurstKey, replyingToId, replyDrafts, submittingComment, submittingReply }) {
  const language = useCommunityLanguage()
  if (!post) return null

  const postUser = post.user ?? { username: post.author, level: post.level }
  const selectProfile = (selectedUser) => {
    onClose()
    onSelectUser?.(selectedUser)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pb-6 pt-20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[calc(100vh-6.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-lime-100/10 bg-[#171b1a] shadow-[0_12px_40px_rgba(0,0,0,0.36)]">
        <div className="flex items-center justify-between border-b border-lime-100/10 px-5 py-3">
          <div>
            <h2 className="text-sm font-black text-lime-50">{post.author}&apos;s post</h2>
            <p className="text-xs text-slate-500">
              {post.handle} <span aria-hidden="true">·</span>{' '}
              <time
                className="cursor-help decoration-dotted underline-offset-4 hover:text-slate-300 hover:underline"
                dateTime={post.created_at || undefined}
                title={formatExactDateTime(post.created_at, language)}
              >
                {formatTime(post.created_at, language)}
              </time>
            </p>
          </div>
          <button
            className="grid h-11 w-11 place-items-center rounded-md border border-lime-100/10 text-slate-400 transition hover:bg-white/[0.05] hover:text-lime-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            onClick={onClose}
            type="button"
            aria-label="Close post"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="flex gap-3">
            <div className="group/profile relative h-fit shrink-0">
              <button
                className="rounded-full transition hover:ring-[#8fbf78]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
                onClick={() => selectProfile(postUser)}
                type="button"
                aria-label={'Open ' + post.author + ' profile'}
              >
                <UserAvatar className="h-10 w-10 text-sm" fallback={post.avatar} user={postUser} />
              </button>
              <ProfileHoverCard onSelectUser={selectProfile} user={postUser} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="group/profile relative mb-1 inline-block">
                <button className="text-left" onClick={() => selectProfile(postUser)} type="button">
                  <strong className="mr-1 text-sm text-lime-50 transition hover:text-[#9bcf82]">{post.author}</strong>
                  <span className="text-xs text-slate-400">{post.handle}</span>
                </button>
                <ProfileHoverCard onSelectUser={selectProfile} user={postUser} />
              </div>
              <p className="whitespace-pre-line text-sm leading-6 text-slate-100">{post.body}</p>
              {post.history || post.liveSimulator ? <HistoryPreview history={post.history} liveSimulator={post.liveSimulator} onOpenGame={onOpenGame} post={post} /> : null}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-5 border-y border-lime-100/10 py-3 text-sm">
            <ActionButton active={post.likedByMe} burstKey={postBurstKey} icon="heart" label="Like post" onClick={() => onToggleLike(post)} value={post.likes} />
            <ActionButton icon="chat" label="Comment count" value={post.replies} />
          </div>

          <div className="mt-4 space-y-5">
            {commentsLoading ? <LoadingSkeleton count={3} label="Loading post comments" variant="list" /> : comments.length ? comments.map((comment) => (
              <CommentItem
                key={comment.id}
                burstKeys={commentBurstKeys}
                comment={comment}
                onReplyDraftChange={onReplyDraftChange}
                onSelectUser={selectProfile}
                onStartReply={onStartReply}
                onSubmitReply={onSubmitReply}
                onToggleCommentLike={onToggleCommentLike}
                replyingToId={replyingToId}
                replyDrafts={replyDrafts}
                submittingReply={submittingReply}
              />
            )) : (
              <div className="rounded-lg border border-dashed border-lime-100/10 px-4 py-6 text-center text-sm text-slate-500">
                No comments yet.
              </div>
            )}
          </div>
        </div>

        <form className="border-t border-lime-100/10 bg-[#151817] px-4 py-3" onSubmit={onSubmitComment}>
          {actionError ? (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs leading-5 text-red-100" role="alert">
              <AppIcon className="mt-0.5 h-4 w-4 shrink-0" name="warning" />
              <span>{actionError}</span>
            </div>
          ) : null}
          <div className="flex items-end gap-3">
            <UserAvatar className="h-9 w-9 bg-[#8fbf78] text-xs text-[#101511]" fallback={avatarLabel(displayName(currentUser))} user={currentUser} />
            <label className="min-w-0 flex-1">
              <span className="sr-only">Write a comment</span>
              <textarea
                className="max-h-28 min-h-12 w-full resize-none rounded-2xl border border-lime-100/10 bg-[#101312] px-4 py-3 text-sm leading-5 text-lime-50 outline-none transition placeholder:text-slate-500 focus:border-[#8fbf78]"
                onChange={(event) => onCommentDraftChange(event.target.value)}
                placeholder="Write a public comment..."
                rows={1}
                value={commentDraft}
              />
            </label>
            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#8fbf78] text-[#101511] transition hover:bg-[#a6d892] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={submittingComment || !commentDraft.trim()}
              type="submit"
              aria-label="Send comment"
            >
              <AppIcon className="h-5 w-5" name="send" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const insightMetrics = [
  { key: 'posts', icon: 'chat', color: '#6ee7a2' },
  { key: 'likes', icon: 'heart', color: '#fb7185' },
  { key: 'comments', icon: 'chat', color: '#67e8f9' },
  { key: 'replies', icon: 'reply', color: '#c4a7ff' },
]

function insightMetricLabel(metric, mode, language) {
  const labels = {
    posts: { en: 'Posts', th: 'โพสต์' },
    likes: mode === 'content' ? { en: 'Likes received', th: 'ไลก์ที่ได้รับ' } : { en: 'Likes given', th: 'ไลก์ที่กด' },
    comments: mode === 'content' ? { en: 'Comments received', th: 'คอมเมนต์ที่ได้รับ' } : { en: 'Comments written', th: 'คอมเมนต์ที่เขียน' },
    replies: mode === 'content' ? { en: 'Replies received', th: 'ตอบกลับที่ได้รับ' } : { en: 'Replies written', th: 'ตอบกลับที่เขียน' },
  }

  return labels[metric]?.[language] ?? labels[metric]?.en ?? metric
}

function InsightLineChart({ language, mode, series }) {
  const [hoverIndex, setHoverIndex] = useState(null)
  const width = 760
  const height = 190
  const padding = { left: 36, right: 12, top: 12, bottom: 28 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const values = series.flatMap((row) => insightMetrics.map((metric) => Number(row?.[metric.key] ?? 0)))
  const maxValue = Math.max(1, ...values)
  const selectedIndex = hoverIndex == null ? Math.max(0, series.length - 1) : hoverIndex
  const selectedRow = series[selectedIndex] ?? null
  const xAt = (index) => padding.left + (series.length <= 1 ? plotWidth / 2 : (index / (series.length - 1)) * plotWidth)
  const yAt = (value) => padding.top + plotHeight - (Number(value ?? 0) / maxValue) * plotHeight
  const dateFormatter = new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' })

  function linePath(key) {
    return series.map((row, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index).toFixed(2)} ${yAt(row[key]).toFixed(2)}`).join(' ')
  }

  function updateHover(event) {
    if (!series.length) return
    const rect = event.currentTarget.getBoundingClientRect()
    const pointerX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * width
    const ratio = Math.min(1, Math.max(0, (pointerX - padding.left) / plotWidth))
    setHoverIndex(Math.round(ratio * Math.max(0, series.length - 1)))
  }

  return (
    <div className="min-w-0">
      <div className="mb-2 flex min-h-8 flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-slate-300">
          {selectedRow ? dateFormatter.format(new Date(`${selectedRow.date}T00:00:00`)) : copy(language, 'No activity yet', 'ยังไม่มีกิจกรรม')}
        </span>
        <span className="flex flex-wrap justify-end gap-x-3 gap-y-1">
          {insightMetrics.map((metric) => (
            <span className="inline-flex items-center gap-1.5 text-slate-400" key={metric.key}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: metric.color }} />
              {selectedRow?.[metric.key] ?? 0} {insightMetricLabel(metric.key, mode, language)}
            </span>
          ))}
        </span>
      </div>

      <svg
        className="block h-[170px] w-full cursor-crosshair overflow-visible rounded-lg bg-black/10"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={copy(language, 'Community activity trend', 'แนวโน้มกิจกรรมในชุมชน')}
        onMouseMove={updateHover}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + plotHeight - ratio * plotHeight
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(185,229,164,.11)" strokeDasharray="4 7" />
              <text x={padding.left - 8} y={y + 4} fill="#64748b" fontSize="10" textAnchor="end">{Math.round(maxValue * ratio)}</text>
            </g>
          )
        })}
        {insightMetrics.map((metric) => (
          <path
            d={linePath(metric.key)}
            fill="none"
            key={metric.key}
            stroke={metric.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.8"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {selectedRow ? (
          <g>
            <line x1={xAt(selectedIndex)} x2={xAt(selectedIndex)} y1={padding.top} y2={padding.top + plotHeight} stroke="rgba(230,255,221,.28)" strokeDasharray="3 5" />
            {insightMetrics.map((metric) => (
              <circle
                cx={xAt(selectedIndex)}
                cy={yAt(selectedRow[metric.key])}
                fill="#101511"
                key={metric.key}
                r="4"
                stroke={metric.color}
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ) : null}
        {series.length ? (
          <>
            <text x={padding.left} y={height - 8} fill="#64748b" fontSize="10">{dateFormatter.format(new Date(`${series[0].date}T00:00:00`))}</text>
            <text x={width - padding.right} y={height - 8} fill="#64748b" fontSize="10" textAnchor="end">{dateFormatter.format(new Date(`${series[series.length - 1].date}T00:00:00`))}</text>
          </>
        ) : null}
      </svg>
    </div>
  )
}

function CommunityInsights({ refreshKey = '' }) {
  const language = useCommunityLanguage()
  const [expanded, setExpanded] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const [days, setDays] = useState(30)
  const [mode, setMode] = useState('content')
  const [status, setStatus] = useState('loading')
  const [insights, setInsights] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    getCommunityInsights(days)
      .then((payload) => {
        if (cancelled) return
        setInsights(payload.data ?? null)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [days, reloadKey, refreshKey])

  const current = insights?.[mode] ?? { totals: {}, series: [] }
  const changeDays = (value) => {
    setStatus('loading')
    setDays(value)
  }
  const retry = () => {
    setStatus('loading')
    setReloadKey((value) => value + 1)
  }

  return (
    <section className="border-b border-lime-100/10 bg-[#111613] px-5 py-4 sm:px-8" data-tour="community-insights">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#78eda8]/15 bg-[#78eda8]/10 text-[#78eda8]">
            <AppIcon className="h-4 w-4" name="speed" />
          </span>
          <span className="min-w-0">
            <strong className="block text-sm text-lime-50">{copy(language, 'Community insights', 'สถิติชุมชนของฉัน')}</strong>
            <small className="block truncate text-xs text-slate-500">
              {copy(language, `Your activity during the last ${days} days`, `กิจกรรมของคุณในช่วง ${days} วันที่ผ่านมา`)}
            </small>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden rounded-lg border border-lime-100/10 bg-black/15 p-0.5 sm:flex" role="group" aria-label={copy(language, 'Statistics range', 'ช่วงเวลาสถิติ')}>
            {[7, 30, 90].map((value) => (
              <button
                className={`min-h-8 rounded-md px-2.5 text-xs font-black transition ${days === value ? 'bg-[#78eda8]/16 text-[#9cf3bd]' : 'text-slate-500 hover:text-slate-300'}`}
                key={value}
                onClick={() => changeDays(value)}
                type="button"
              >
                {value}D
              </button>
            ))}
          </div>
          <button
            className="grid h-9 w-9 place-items-center rounded-lg border border-lime-100/10 bg-white/[0.035] text-slate-300 transition hover:bg-white/[0.07] hover:text-lime-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? copy(language, 'Collapse insights', 'พับสถิติ') : copy(language, 'Expand insights', 'เปิดสถิติ')}
            onClick={() => setExpanded((currentValue) => !currentValue)}
          >
            <AppIcon className={`h-4 w-4 transition ${expanded ? '' : 'rotate-180'}`} name="arrowUp" />
          </button>
        </div>
      </header>

      {status === 'error' ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-300/15 bg-red-400/[0.06] px-3 py-2 text-xs text-red-100">
          <span>{copy(language, 'Statistics could not be loaded.', 'ไม่สามารถโหลดข้อมูลสถิติได้')}</span>
          <button className="font-black text-red-200 underline underline-offset-4" type="button" onClick={retry}>{copy(language, 'Retry', 'ลองใหม่')}</button>
        </div>
      ) : null}

      {status !== 'error' ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {insightMetrics.map((metric) => (
            <div className="rounded-lg border border-lime-100/[0.08] bg-white/[0.025] px-3 py-2.5" key={metric.key}>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: metric.color }} />
                <span className="truncate">{insightMetricLabel(metric.key, mode, language)}</span>
              </span>
              <strong className="mt-1 block text-lg font-black tabular-nums text-lime-50">{status === 'loading' ? '—' : Number(current.totals?.[metric.key] ?? 0).toLocaleString()}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {expanded && status !== 'error' ? (
        <div className="mt-3 rounded-xl border border-lime-100/[0.09] bg-[#0d120f] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-lg border border-lime-100/10 bg-black/20 p-0.5" role="group" aria-label={copy(language, 'Insight type', 'ประเภทสถิติ')}>
              {[
                ['content', copy(language, 'My content', 'ผลงานของฉัน')],
                ['activity', copy(language, 'My activity', 'กิจกรรมของฉัน')],
              ].map(([value, label]) => (
                <button
                  className={`min-h-8 rounded-md px-3 text-xs font-black transition ${mode === value ? 'bg-[#78eda8]/16 text-[#9cf3bd]' : 'text-slate-500 hover:text-slate-300'}`}
                  key={value}
                  onClick={() => setMode(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-lime-100/10 bg-black/15 p-0.5 sm:hidden" role="group" aria-label={copy(language, 'Statistics range', 'ช่วงเวลาสถิติ')}>
              {[7, 30, 90].map((value) => (
                <button className={`min-h-8 rounded-md px-2.5 text-xs font-black ${days === value ? 'bg-[#78eda8]/16 text-[#9cf3bd]' : 'text-slate-500'}`} key={value} onClick={() => changeDays(value)} type="button">{value}D</button>
              ))}
            </div>
          </div>
          {status === 'loading' ? <LoadingSkeleton count={2} label="Loading community insights" variant="list" /> : <InsightLineChart language={language} mode={mode} series={current.series ?? []} />}
        </div>
      ) : null}
    </section>
  )
}

function ProfileCenter({ actionBusy = false, actionError = '', friendsCount, hiddenPostIds = [], isOwnProfile = true, loading = false, onAddFriend, onBack, onEditProfile, onHidePost, onOpenGame, onOpenPost, onRestorePost, onSelectUser, onToggleLike, posts, reactionBursts, user }) {
  const language = useCommunityLanguage()
  const name = displayName(user)
  const handle = '@' + (user?.username ?? name.replace(/\s+/g, '').toLowerCase())
  const profilePosts = posts.filter((post) => {
    if (user?.id && post.user?.id) return String(post.user.id) === String(user.id)
    return post.handle === handle
  })
  const levelInfo = getLevelInfo(user)
  const friendStatus = user?.friendship_status ?? 'none'
  const canAddFriend = !isOwnProfile && friendStatus !== 'connected'
  const actionLabel = isOwnProfile
    ? copy(language, 'Edit profile', 'แก้ไขโปรไฟล์')
    : friendStatus === 'connected'
      ? copy(language, 'Friend', 'เพื่อน')
      : copy(language, 'Add Friend', 'เพิ่มเพื่อน')
  const profileFriendsCount = isOwnProfile ? friendsCount : Number(user?.friends_count ?? 0)
  const plantsGrownCount = Number(user?.plants_count ?? user?.plant_histories_count ?? 0)
  const bio = user?.bio || copy(language, 'Plant Growth Academy learner sharing saved simulations, healthy growth records, and classroom observations from the lab.', 'ผู้เรียน Plant Growth Academy ที่แบ่งปันการจำลอง บันทึกการเติบโต และข้อสังเกตจากห้องทดลอง')

  return (
    <main className="min-h-full min-w-0 bg-[#141817]">
      {!isOwnProfile ? (
        <div className="sticky top-0 z-20 border-b border-lime-100/10 bg-[#141817]/95 px-6 py-3 backdrop-blur">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-full border border-lime-100/10 bg-white/[0.035] px-3 text-sm font-bold text-slate-200 transition hover:border-[#8fbf78]/70 hover:bg-white/[0.06] hover:text-lime-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            onClick={onBack}
            type="button"
          >
            <AppIcon className="h-4 w-4" name="arrowBack" />
            {copy(language, 'Back', 'กลับ')}
          </button>
        </div>
      ) : null}
      <section className="border-b border-lime-100/10">
        <div className="relative z-0 h-28 overflow-hidden bg-[#f4f7f2]">
          <CoverImage user={user} />
        </div>
        <div className="px-8 pb-5">
          <div className="relative z-10 -mt-10 flex items-end justify-between gap-4">
            <UserAvatar className="h-20 w-20 border-4 border-[#141817] bg-[#f4f7f2] text-3xl text-[#111827]" fallback={avatarLabel(name)} user={user} />
            <div className="mb-1 mt-4 flex items-center gap-2">
              <button
                className={'min-h-11 rounded-full px-5 text-xs font-black transition focus:outline-none focus:ring-2 ' + (isOwnProfile ? 'border border-[#9bcf82] bg-[#9bcf82] text-[#101511] shadow-[0_6px_16px_rgba(91,145,77,.2)] hover:border-[#afe09a] hover:bg-[#afe09a] focus:ring-[#9bcf82]/50' : canAddFriend ? 'border border-lime-200/80 bg-lime-200 text-[#101511] hover:bg-lime-100 focus:ring-lime-300/70' : 'border border-lime-100/10 bg-white/[0.05] text-slate-300')}
                disabled={actionBusy || (!isOwnProfile && !canAddFriend)}
                onClick={isOwnProfile ? onEditProfile : canAddFriend ? onAddFriend : undefined}
                type="button"
              >
                {actionBusy ? copy(language, 'Adding...', 'กำลังเพิ่ม...') : actionLabel}
              </button>
            </div>
          </div>
          {actionError ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs leading-5 text-red-100" role="alert">
              <AppIcon className="mt-0.5 h-4 w-4 shrink-0" name="warning" />
              <span>{actionError}</span>
            </div>
          ) : null}
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-lime-50">{name}</h1>
              <span className="rounded-md border border-lime-100/10 bg-white/[0.04] px-2 py-0.5 text-xs font-bold text-lime-100">Lv.{levelInfo.level}</span>
              <span className="grid h-4 w-4 place-items-center rounded-full bg-[#8fbf78] text-xs text-[#101511]"><AppIcon className="h-3 w-3" name="check" /></span>
            </div>
            <p className="text-xs text-slate-500">{handle}</p>
            <div className="mt-2 flex max-w-[240px] items-center gap-2 text-xs font-semibold text-slate-500">
              <span>EXP</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-gradient-to-r from-[#78d67a] to-[#b8ec9e] transition-[width] duration-500" style={{ width: String(levelInfo.percent) + '%' }} /></span>
              <span>{levelInfo.exp}/{levelInfo.nextExp}</span>
            </div>
            <p className="mt-3 max-w-[58ch] whitespace-pre-line text-sm leading-6 text-slate-300">{bio}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-slate-500">
              <span className="inline-flex items-center gap-1.5"><AppIcon className="h-4 w-4" name="history" />{formatJoinedDate(user?.created_at, language)}</span>
              <span className="inline-flex items-center gap-1.5"><AppIcon className="h-4 w-4" name="groups" />{profileFriendsCount} {copy(language, 'friends', 'เพื่อน')}</span>
              <span className="inline-flex items-center gap-1.5"><AppIcon className="h-4 w-4" name="plant" />{plantsGrownCount} {copy(language, 'plants grown', 'ต้นที่ปลูก')}</span>
            </div>
          </div>
          <div className="mt-5 border-t border-lime-100/10 text-xs font-bold text-slate-400">
            <button className="relative min-h-11 px-2 py-3 text-lime-50" type="button">{copy(language, 'Posts', 'โพสต์')}<span className="absolute bottom-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-[#8fbf78]" /></button>
          </div>
        </div>
      </section>

      {isOwnProfile ? (
        <CommunityInsights
          refreshKey={posts.map((post) => `${post.id}:${post.likes}:${post.replies}:${post.likedByMe ? 1 : 0}`).join('|')}
        />
      ) : null}

      {loading ? <LoadingSkeleton count={2} label="Loading profile posts" variant="feed" /> : null}
      {!loading && profilePosts.map((post) => (
        <FeedPost
          key={post.id}
          hidden={hiddenPostIds.includes(String(post.id))}
          onHide={onHidePost}
          onOpenGame={onOpenGame}
          onOpenPost={onOpenPost}
          onRestore={onRestorePost}
          onSelectUser={onSelectUser}
          onToggleLike={onToggleLike}
          post={post}
          reactionBurstKey={reactionBursts['post-' + post.id]}
        />
      ))}
      {!loading && !profilePosts.length ? <div className="grid min-h-[320px] place-items-center border-t border-lime-100/10 px-8 text-center text-sm text-slate-400">{copy(language, 'Shared plant history posts will appear here.', 'โพสต์ประวัติพืชที่แชร์จะแสดงที่นี่')}</div> : null}
    </main>
  )
}

function EditProfileModal({ error, onClose, onSave, saving, user }) {
  const initialAvatarPreview = user?.avatar_url ? resolveAssetUrl(user.avatar_url) : ''
  const initialCoverPreview = user?.cover_url ? resolveAssetUrl(user.cover_url) : ''
  const [form, setForm] = useState({ username: user?.username ?? '', bio: user?.bio ?? '', avatar: null, avatarPreview: initialAvatarPreview, cover: null, coverPreview: initialCoverPreview })
  const name = form.username || displayName(user)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function setImage(field, previewField, file) {
    if (!file) return

    setForm((current) => {
      if (current[previewField]?.startsWith('blob:')) URL.revokeObjectURL(current[previewField])
      return { ...current, [field]: file, [previewField]: URL.createObjectURL(file) }
    })
  }

  function handleAvatarChange(event) {
    setImage('avatar', 'avatarPreview', event.target.files?.[0])
  }

  function handleCoverChange(event) {
    setImage('cover', 'coverPreview', event.target.files?.[0])
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 px-4 pb-8 pt-24 backdrop-blur-sm" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form className="w-full max-w-xl overflow-hidden rounded-xl border border-lime-100/10 bg-[#101312] shadow-[0_18px_50px_rgba(0,0,0,0.42)]" onSubmit={(event) => { event.preventDefault(); onSave(form) }}>
        <div className="flex items-center justify-between border-b border-lime-100/10 px-4 py-3">
          <button className="grid h-11 w-11 place-items-center rounded-md text-slate-400 transition hover:bg-white/[0.04] hover:text-lime-100" onClick={onClose} type="button" aria-label="Close edit profile"><span className="text-xl leading-none">&times;</span></button>
          <h2 className="text-base font-black text-lime-50">Edit profile</h2>
          <button className="min-h-11 rounded-full bg-sky-100 px-5 text-xs font-black text-sky-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving || !form.username.trim()} type="submit">{saving ? 'Saving...' : 'Save'}</button>
        </div>
        <div className="relative z-0 h-48 overflow-hidden bg-[#080b09]">
          <CoverImage preview={form.coverPreview} user={user} />
          <label className="absolute inset-0 grid cursor-pointer place-items-center bg-black/10 text-slate-400 transition hover:bg-black/20 hover:text-lime-100">
            <input accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleCoverChange} type="file" />
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#171b1a]/85 ring-1 ring-lime-100/10">
              <AppIcon className="h-6 w-6" name="camera" />
            </span>
          </label>
        </div>
        <div className="relative px-4 pb-5">
          <div className="relative z-10 -mt-10 flex items-end gap-4">
            <UserAvatar className="h-24 w-24 border-4 border-[#101312] bg-[#f4f7f2] text-3xl text-[#111827]" fallback={avatarLabel(name)} user={{ ...user, avatar_url: form.avatarPreview || user?.avatar_url }} />
            <div className="mb-2 min-w-0 flex-1 rounded-lg bg-[#181d1c] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-black text-lime-50"><AppIcon className="h-4 w-4" name="camera" />Update your profile photo</div>
                  <p className="mt-1 text-xs text-slate-500">Upload JPG, PNG, or WebP up to 2MB.</p>
                </div>
                <label className="shrink-0 cursor-pointer rounded-full bg-white/[0.08] px-4 py-2 text-xs font-black text-lime-50 transition hover:bg-white/[0.12]">
                  <input accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleAvatarChange} type="file" />
                  Change photo
                </label>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-400">Name</span><input className="h-14 w-full rounded-md border border-lime-100/15 bg-[#121514] px-3 text-sm text-lime-50 outline-none transition placeholder:text-slate-500 focus:border-[#8fbf78]" maxLength={80} onChange={(event) => updateField('username', event.target.value)} value={form.username} /></label>
            <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-400">Bio</span><textarea className="min-h-24 w-full resize-none rounded-md border border-lime-100/15 bg-[#121514] px-3 py-3 text-sm leading-6 text-lime-50 outline-none transition placeholder:text-slate-500 focus:border-[#8fbf78]" maxLength={500} onChange={(event) => updateField('bio', event.target.value)} placeholder="Share your plant growing role, lesson focus, or classroom goal." value={form.bio} /></label>
            {error ? <div className="rounded-md border border-rose-300/20 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
          </div>
        </div>
      </form>
    </div>
  )
}

function UserSearchRow({ user, compact = false, onSelect }) {
  const language = useCommunityLanguage()
  const normalized = normalizeUser(user)
  const plantCount = Number(user?.plants_count ?? user?.plant_histories_count ?? 0)

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-lg text-left transition hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${
        compact ? 'px-2 py-2' : 'px-4 py-3'
      }`}
      onClick={() => onSelect?.(user)}
    >
      <UserAvatar className={compact ? 'h-8 w-8 text-xs' : 'h-11 w-11 text-sm'} fallback={normalized.avatar} user={user} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <strong className="truncate text-sm text-lime-50">{normalized.name}</strong>
          <span className="rounded-md border border-lime-100/10 bg-white/[0.035] px-1.5 py-0.5 text-xs font-bold text-lime-100">Lv.{normalized.levelInfo.level}</span>
        </span>
        <span className="block truncate text-xs text-slate-500">{normalized.handle}</span>
      </span>
      {plantCount > 0 ? <span className="text-xs font-semibold text-slate-500">{plantCount} {copy(language, 'saves', 'รายการที่บันทึก')}</span> : null}
    </button>
  )
}

function SearchCenter({ error, query, results, loading, onQueryChange, onSelectUser }) {
  const language = useCommunityLanguage()

  return (
    <main className="min-h-full min-w-0 bg-[#141817]">
      <div className="sticky top-0 z-10 border-b border-lime-100/10 bg-[#141817]/95 px-6 py-3 backdrop-blur">
        <label className="relative block">
          <span className="sr-only">{copy(language, 'Search users', 'ค้นหาผู้ใช้')}</span>
          <AppIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" name="search" />
          <input
            autoFocus
            className="h-11 w-full rounded-full border border-lime-100/10 bg-[#080b09] pl-11 pr-4 text-sm text-lime-50 outline-none transition placeholder:text-slate-500 focus:border-[#8fbf78]"
            onChange={(event) => onQueryChange(event.target.value)}
            autoComplete="off"
            placeholder={copy(language, 'Search', 'ค้นหา')}
            type="search"
            value={query}
          />
        </label>
      </div>
      <div className="divide-y divide-lime-100/10">
        {loading ? (
          <CommunityState description={copy(language, 'Looking for matching learners.', 'กำลังค้นหาผู้เรียนที่ตรงกัน')} loading loadingVariant="list" title={copy(language, 'Searching...', 'กำลังค้นหา...')} />
        ) : error ? (
          <CommunityState description={error} title={copy(language, 'Search is unavailable', 'ไม่สามารถค้นหาได้')} />
        ) : results.length ? (
          results.map((result) => <UserSearchRow key={result.id} onSelect={onSelectUser} user={result} />)
        ) : (
          <div className="grid min-h-[360px] place-items-center px-8 text-center text-sm text-slate-400">
            {query.trim()
              ? copy(language, 'No learners found.', 'ไม่พบผู้เรียนที่ค้นหา')
              : copy(language, 'Search for friends or other learners by username or email.', 'ค้นหาเพื่อนหรือผู้เรียนคนอื่นด้วยชื่อผู้ใช้หรืออีเมล')}
          </div>
        )}
      </div>
    </main>
  )
}

function LeaderboardCard({ title, subtitle, icon, users, metric, onSelectUser }) {
  const language = useCommunityLanguage()

  return (
    <section className="rounded-xl border border-lime-100/10 bg-[#18201b] p-4 shadow-[0_10px_26px_rgba(0,0,0,.16)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#9bcf82]/15 bg-[#263822] text-lime-100">
          <AppIcon className="h-4 w-4" name={icon} />
        </span>
        <div>
          <h2 className="text-sm font-black text-lime-50">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-1">
        {users.slice(0, 10).map((user, index) => (
          <div key={user.id} className="group/profile relative">
            <button
              aria-label={`${copy(language, 'Open profile for', 'เปิดโปรไฟล์ของ')} ${displayName(user)}`}
              className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left transition hover:border-lime-100/10 hover:bg-[#223027] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
              onClick={() => onSelectUser?.(user)}
              type="button"
            >
              <span className={`w-5 text-center text-xs font-black ${index < 3 ? 'text-lime-100' : 'text-slate-500'}`}>{index + 1}</span>
              <UserAvatar className="h-7 w-7 text-xs" fallback={avatarLabel(displayName(user))} user={user} />
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-200">{displayName(user)}</span>
              <span className="text-xs font-black text-lime-100">{metric(user)}</span>
            </button>
            <ProfileHoverCard align="right" onSelectUser={onSelectUser} user={user} />
          </div>
        ))}
        {!users.length ? <p className="py-4 text-xs text-slate-500">No ranking data yet.</p> : null}
      </div>
    </section>
  )
}

function RightDashboard({ leaderboard, loading = false, onOpenSearch, onSelectUser }) {
  const language = useCommunityLanguage()

  return (
    <aside className="sticky top-0 min-h-[calc(100dvh-4rem)] self-start border-l border-lime-100/10 bg-[#101713] px-5 py-6 max-lg:hidden" data-tour="community-dashboard">
      <button
        className="relative block h-11 w-full min-w-0 rounded-xl border border-lime-100/15 bg-[#18201b] pl-11 pr-4 text-left text-sm text-slate-400 shadow-[0_8px_20px_rgba(0,0,0,.12)] outline-none transition hover:border-[#8fbf78]/60 hover:bg-[#1c2720] hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
        onClick={onOpenSearch}
        type="button"
        title={copy(language, 'Search the community...', 'ค้นหาในชุมชน...')}
      >
        <span className="sr-only">{copy(language, 'Open search', 'เปิดการค้นหา')}</span>
        <AppIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" name="search" />
        <span className="block min-w-0 truncate">
          {copy(language, 'Search the community...', 'ค้นหาในชุมชน...')}
        </span>
      </button>

      <div className="mt-6 space-y-4">
        {loading ? <LoadingSkeleton count={2} label="Loading community rankings" variant="panel" /> : (
          <>
            <LeaderboardCard
              icon="trophy"
              metric={(user) => `Lv.${user.level ?? 1}`}
              subtitle="top 10 Levels"
              title="Level ranking"
              users={leaderboard.levels}
              onSelectUser={onSelectUser}
            />
            <LeaderboardCard
              icon="plant"
              metric={(user) => user.plants_count ?? 0}
              subtitle="most saved plants"
              title="Grow ranking"
              users={leaderboard.growers}
              onSelectUser={onSelectUser}
            />
          </>
        )}
      </div>
    </aside>
  )
}

function NotificationRow({ item, onOpen }) {
  const language = useCommunityLanguage()
  const actorName = displayName(item.actor)
  const action = item.type === 'garden_prank'
    ? copy(language, 'sent a prank to your garden', 'ส่งของแกล้งมายังสวนของคุณ')
    : item.type === 'like'
    ? copy(language, 'liked your post', 'ถูกใจโพสต์ของคุณ')
    : item.type === 'comment_like'
      ? copy(language, 'liked your comment', 'ถูกใจความคิดเห็นของคุณ')
      : item.type === 'reply'
        ? copy(language, 'replied to your comment', 'ตอบกลับความคิดเห็นของคุณ')
        : copy(language, 'commented on your post', 'แสดงความคิดเห็นในโพสต์ของคุณ')

  return (
    <button
      className={`relative flex w-full gap-3 border-b border-lime-100/10 px-7 py-4 text-left transition hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${item.is_read ? 'bg-transparent' : 'bg-[#9bcf82]/[0.055]'}`}
      onClick={() => onOpen(item)}
      type="button"
    >
      {!item.is_read ? <span className="absolute right-5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-red-500" aria-label="Unread" /> : null}
      <UserAvatar className="h-11 w-11 text-xs" fallback={avatarLabel(actorName)} user={item.actor} />
      <span className="min-w-0 flex-1 pr-7">
        <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm leading-5">
          <strong className="text-lime-50">{actorName}</strong>
          <span className={item.is_read ? 'text-slate-400' : 'text-slate-200'}>{action}</span>
          <time
            className="cursor-help text-xs text-[#78906f] decoration-dotted underline-offset-4 hover:text-slate-300 hover:underline"
            dateTime={item.created_at || undefined}
            title={formatExactDateTime(item.created_at, language)}
          >
            {formatNotificationTime(item.created_at, language)}
          </time>
        </span>
        <span className="mt-1 block text-xs text-[#8fa38a]">{copy(language, 'On', 'ใน')} {item.plant_name || copy(language, 'your plant update', 'อัปเดตพืชของคุณ')}</span>
        {item.excerpt ? <span className="mt-1 block truncate text-xs text-slate-300">“{item.excerpt}”</span> : null}
      </span>
    </button>
  )
}

function NotificationsCenter({ error, items, loading, onOpen, onRetry }) {
  const language = useCommunityLanguage()
  const [tab, setTab] = useState('all')
  const visibleItems = tab === 'unread' ? items.filter((item) => !item.is_read) : items

  return (
    <main className="min-h-full min-w-0 bg-[#141817]">
      <header className="sticky top-0 z-10 border-b border-lime-100/10 bg-[#141817]/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-5">
          <h1 className="text-xl font-black text-lime-50">{copy(language, 'Notifications', 'การแจ้งเตือน')}</h1>
          <span className="hidden text-xs text-[#8fa38a] sm:block">{copy(language, 'Updates appear automatically', 'อัปเดตโดยอัตโนมัติ')}</span>
        </div>
        <div className="grid grid-cols-2 text-sm font-bold">
          {[
            { id: 'all', label: copy(language, 'All', 'ทั้งหมด') },
            { id: 'unread', label: copy(language, 'Unread', 'ยังไม่อ่าน') },
          ].map((nextTab) => (
            <button
              key={nextTab.id}
              className={`relative h-12 transition ${tab === nextTab.id ? 'text-lime-50' : 'text-slate-400 hover:bg-white/[0.025] hover:text-lime-100'}`}
              onClick={() => setTab(nextTab.id)}
              type="button"
            >
              {nextTab.label}
              {tab === nextTab.id ? <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-[#8fbf78]" /> : null}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <CommunityState description={copy(language, 'Checking your latest activity.', 'กำลังตรวจสอบกิจกรรมล่าสุดของคุณ')} loading loadingVariant="list" title={copy(language, 'Loading notifications', 'กำลังโหลดการแจ้งเตือน')} />
      ) : error ? (
        <CommunityState actionLabel={copy(language, 'Try again', 'ลองอีกครั้ง')} description={error} onAction={onRetry} title={copy(language, 'Notifications are unavailable', 'ไม่สามารถโหลดการแจ้งเตือนได้')} />
      ) : visibleItems.length ? (
        <div>
          {visibleItems.map((item) => (
            <NotificationRow key={item.id} item={item} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <section className="mx-auto max-w-md px-8 pt-10 text-left">
          <h2 className="text-3xl font-black leading-tight text-lime-50">{copy(language, 'Nothing to see here yet', 'ยังไม่มีรายการในขณะนี้')}</h2>
          <p className="mt-3 text-sm leading-6 text-[#8fa38a]">{copy(language, 'Likes, comments, and replies on your plant posts will appear here.', 'การถูกใจ ความคิดเห็น และคำตอบในโพสต์พืชจะแสดงที่นี่')}</p>
        </section>
      )}
    </main>
  )
}

function FeedCenter({ activeFeed, error, friendPosts, hiddenPostIds = [], onFeedChange, onHidePost, onOpenGame, onOpenPost, onRestorePost, onRetry, onSelectUser, onToggleLike, posts, reactionBursts, status }) {
  const language = useCommunityLanguage()
  const visiblePosts = activeFeed === 'friends' ? friendPosts : posts

  return (
    <main className="min-h-full min-w-0 bg-[#141817]" data-tour="community-feed">
      <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-lime-100/10 bg-[#141817]/95 backdrop-blur">
        <button
          type="button"
          className={`relative px-4 py-4 text-center text-sm transition ${activeFeed === 'for-you' ? 'font-bold text-lime-50' : 'text-slate-400 hover:text-lime-100'}`}
          onClick={() => onFeedChange('for-you')}
        >
          {copy(language, 'For you', 'สำหรับคุณ')}
          {activeFeed === 'for-you' ? <span className="absolute bottom-0 left-1/2 h-0.5 w-16 -translate-x-1/2 rounded-full bg-[#8fbf78]" /> : null}
        </button>
        <button
          type="button"
          className={`relative px-4 py-4 text-center text-sm transition ${activeFeed === 'friends' ? 'font-bold text-lime-50' : 'text-slate-400 hover:text-lime-100'}`}
          onClick={() => onFeedChange('friends')}
        >
          {copy(language, 'Friends', 'เพื่อน')}
          {activeFeed === 'friends' ? <span className="absolute bottom-0 left-1/2 h-0.5 w-16 -translate-x-1/2 rounded-full bg-[#8fbf78]" /> : null}
        </button>
      </div>
      {status === 'loading' ? (
        <CommunityState description={copy(language, 'Getting the latest plant stories ready.', 'กำลังเตรียมเรื่องราวพืชล่าสุด')} loading loadingVariant="feed" title={copy(language, 'Loading community', 'กำลังโหลดชุมชน')} />
      ) : status === 'error' ? (
        <CommunityState actionLabel={copy(language, 'Try again', 'ลองอีกครั้ง')} description={error} onAction={onRetry} title={copy(language, 'Community is unavailable', 'ไม่สามารถโหลดชุมชนได้')} />
      ) : visiblePosts.map((post) => (
        <FeedPost
          key={post.id}
          hidden={hiddenPostIds.includes(String(post.id))}
          onHide={onHidePost}
          onOpenGame={onOpenGame}
          onOpenPost={onOpenPost}
          onRestore={onRestorePost}
          onSelectUser={onSelectUser}
          onToggleLike={onToggleLike}
          post={post}
          reactionBurstKey={reactionBursts[`post-${post.id}`]}
        />
      ))}
      {status === 'ready' && !visiblePosts.length ? (
        <div className="grid min-h-[420px] place-items-center px-8 text-center text-sm text-slate-400">
          {activeFeed === 'friends'
            ? copy(language, 'Posts from you and your friends will appear here.', 'โพสต์จากคุณและเพื่อนจะแสดงที่นี่')
            : copy(language, 'Shared plant histories will appear here.', 'ประวัติพืชที่แชร์จะแสดงที่นี่')}
        </div>
      ) : null}
    </main>
  )
}

export function CommunityPage({ currentUser = null, notificationError = '', notificationItems = [], notificationStatus = 'idle', onNotificationRead, onNotificationsRefresh, onOpenGame, onUserChange, unreadCount = 0 } = {}) {
  const [returnState] = useState(consumeCommunityReturnState)
  const [language, setLanguage] = useState(() => getAppLanguage())
  const [activeView, setActiveView] = useState(returnState.activeView ?? 'home')
  const [activeFeed, setActiveFeed] = useState(returnState.activeFeed ?? 'for-you')
  const [posts, setPosts] = useState([])
  const [friendPosts, setFriendPosts] = useState([])
  const [communityStatus, setCommunityStatus] = useState('loading')
  const [communityError, setCommunityError] = useState('')
  const [communityReloadKey, setCommunityReloadKey] = useState(0)
  const [user, setUser] = useState(currentUser)
  const [selectedProfile, setSelectedProfile] = useState(returnState.selectedProfile ?? null)
  const [friendsCount, setFriendsCount] = useState(0)
  const [, setFriendRows] = useState([])
  const [leaderboard, setLeaderboard] = useState({ levels: [], growers: [] })
  const [leaderboardStatus, setLeaderboardStatus] = useState('loading')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selectedPost, setSelectedPost] = useState(null)
  const [postComments, setPostComments] = useState([])
  const [postCommentsLoading, setPostCommentsLoading] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [replyingToId, setReplyingToId] = useState(null)
  const [replyDrafts, setReplyDrafts] = useState({})
  const [submittingComment, setSubmittingComment] = useState(false)
  const [submittingReply, setSubmittingReply] = useState(false)
  const [reactionBursts, setReactionBursts] = useState({})
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileActionBusy, setProfileActionBusy] = useState(false)
  const [profileActionError, setProfileActionError] = useState('')
  const [postActionError, setPostActionError] = useState('')
  const [hiddenPostIds, setHiddenPostIds] = useState(() => loadHiddenCommunityPostIds(currentUser?.id))
  const [homeScrollTop, setHomeScrollTop] = useState(Number(returnState.homeScrollTop ?? 0))
  const sharedScrollRef = useRef(null)

  const navigateCommunityView = useCallback((nextView) => {
    if (activeView === 'home' && nextView !== 'home') {
      setHomeScrollTop(sharedScrollRef.current?.scrollTop ?? 0)
    }

    setActiveView(nextView)
  }, [activeView])

  useEffect(() => {
    const openNotifications = () => navigateCommunityView('notifications')
    window.addEventListener('plant-community-open-notifications', openNotifications)
    return () => window.removeEventListener('plant-community-open-notifications', openNotifications)
  }, [navigateCommunityView])

  useLayoutEffect(() => {
    const scrollContainer = sharedScrollRef.current
    if (!scrollContainer) return

    const targetScrollTop = activeView === 'home' ? homeScrollTop : 0
    const restoreScroll = () => {
      if (Math.abs(scrollContainer.scrollTop - targetScrollTop) > 1) {
        scrollContainer.scrollTop = targetScrollTop
      }
    }

    restoreScroll()
    const frame = window.requestAnimationFrame(restoreScroll)
    const settleTimer = window.setTimeout(restoreScroll, 80)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(settleTimer)
    }
  }, [activeView, communityStatus, homeScrollTop, posts.length, selectedProfile?.id])

  useEffect(() => {
    const handleSettingsChange = (event) => {
      setLanguage(event.detail?.language === 'th' ? 'th' : 'en')
    }

    window.addEventListener('plant-settings-change', handleSettingsChange)
    return () => window.removeEventListener('plant-settings-change', handleSettingsChange)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadCommunity() {
      setCommunityStatus((current) => current === 'ready' ? current : 'loading')
      setCommunityError('')
      setLeaderboardStatus((current) => current === 'ready' ? current : 'loading')

      const postsRequest = getPosts()
      const friendPostsRequest = getToken() ? getFriendPosts().catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
      const friendsRequest = getToken() ? getFriends().catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
      const leaderboardRequest = getToken()
        ? getCommunityLeaderboard().catch(() => ({ data: { levels: [], growers: [] } }))
        : Promise.resolve({ data: { levels: [], growers: [] } })

      try {
        const postPayload = await postsRequest

        if (!cancelled) {
          setPosts((postPayload.data ?? []).map(mapPost))
          setCommunityStatus('ready')
        }
      } catch {
        if (!cancelled) {
          setPosts([])
          setCommunityError(copy(language, 'We could not load the community. Check your connection and try again.', 'ไม่สามารถโหลดชุมชนได้ โปรดตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง'))
          setCommunityStatus('error')
        }
      }

      await Promise.allSettled([
        friendPostsRequest.then((payload) => {
          if (!cancelled) setFriendPosts((payload.data ?? []).map(mapPost))
        }),
        friendsRequest.then((payload) => {
          if (cancelled) return
          const friends = payload.data ?? []
          setFriendsCount(friends.filter((friend) => !friend.status || friend.status === 'accepted').length)
          setFriendRows(friends)
        }),
        leaderboardRequest.then((payload) => {
          if (!cancelled) {
            setLeaderboard({
              levels: payload.data?.levels ?? [],
              growers: payload.data?.growers ?? [],
            })
            setLeaderboardStatus('ready')
          }
        }),
      ])
    }

    loadCommunity()

    return () => {
      cancelled = true
    }
  }, [communityReloadKey, language])

  useEffect(() => {
    const query = searchQuery.trim()
    let cancelled = false

    if (!query || !getToken()) {
      return () => {
        cancelled = true
      }
    }

    const timer = window.setTimeout(() => {
      searchUsers(query)
        .then((payload) => {
          if (!cancelled) {
            setSearchResults(payload.data ?? [])
            setSearchError('')
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSearchResults([])
            setSearchError(copy(language, 'We could not complete your search. Please try again.', 'ไม่สามารถค้นหาได้ โปรดลองอีกครั้ง'))
          }
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false)
        })
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [language, searchQuery])

  const profileUser = useMemo(() => user ?? { username: 'Learner', email: 'learner@plantlab.local' }, [user])
  const combinedPosts = useMemo(() => {
    const seen = new Set()

    return [...posts, ...friendPosts].filter((post) => {
      if (seen.has(post.id)) return false
      seen.add(post.id)
      return true
    })
  }, [friendPosts, posts])

  const handleSaveProfile = useCallback(async (form) => {
    setProfileSaving(true)
    setProfileError('')

    try {
      const payload = await updateMe({
        username: form.username.trim(),
        bio: form.bio.trim(),
        avatar: form.avatar,
        cover: form.cover,
      })
      const nextUser = payload.data ?? payload.user
      if (nextUser) {
        setUser(nextUser)
        onUserChange?.(nextUser)
        setPosts((current) => current.map((post) => (String(post.user?.id) === String(nextUser.id) ? mapPost({ ...post, user: nextUser }) : post)))
        setFriendPosts((current) => current.map((post) => (String(post.user?.id) === String(nextUser.id) ? mapPost({ ...post, user: nextUser }) : post)))
      }
      setEditingProfile(false)
    } catch (error) {
      setProfileError(error.message || 'Could not save profile.')
    } finally {
      setProfileSaving(false)
    }
  }, [onUserChange])

  const handleSearchQueryChange = useCallback((value) => {
    const nextValue = looksLikeBrokenThai(value) ? '' : value
    setSearchQuery(nextValue)
    setSearchError('')
    if (!nextValue.trim()) {
      setSearchResults([])
      setSearchLoading(false)
    } else if (getToken()) {
      setSearchLoading(true)
    }
  }, [])

  const handleOpenSearch = useCallback(() => {
    setSearchQuery((current) => (looksLikeBrokenThai(current) ? '' : current))
    navigateCommunityView('search')
  }, [navigateCommunityView])

  const handleSelectUser = useCallback((selectedUser) => {
    setProfileActionError('')
    if (user?.id && selectedUser?.id && String(user.id) === String(selectedUser.id)) {
      setSelectedProfile(null)
      navigateCommunityView('profile')
      return
    }

    setSelectedProfile(selectedUser)
    navigateCommunityView('profile')
  }, [navigateCommunityView, user])

  const handleOpenOwnProfile = useCallback(() => {
    setProfileActionError('')
    setSelectedProfile(null)
    navigateCommunityView('profile')
  }, [navigateCommunityView])

  const handleAddFriend = useCallback(async () => {
    if (!selectedProfile?.id) return

    setProfileActionBusy(true)
    setProfileActionError('')
    try {
      await inviteFriend(selectedProfile.id)
      setSelectedProfile((current) => current ? { ...current, friendship_status: 'connected' } : current)
    } catch (error) {
      setProfileActionError(error.message || copy(language, 'Could not add this friend. Please try again.', 'ไม่สามารถเพิ่มเพื่อนได้ โปรดลองอีกครั้ง'))
    } finally {
      setProfileActionBusy(false)
    }
  }, [language, selectedProfile])

  const updateHiddenPostIds = useCallback((updater) => {
    setHiddenPostIds((current) => {
      const next = updater(current)
      saveHiddenCommunityPostIds(user?.id, next)
      return next
    })
  }, [user?.id])

  const handleHidePost = useCallback(async (post) => {
    if (!post?.id || hiddenPostIds.includes(String(post.id))) return

    const confirmation = await Swal.fire({
      title: copy(language, 'Hide this post?', 'ปิดการมองเห็นโพสต์นี้หรือไม่'),
      text: copy(
        language,
        `The post from ${post.author} will only be hidden from your Community feed. You can undo this afterward.`,
        `โพสต์ของ ${post.author} จะถูกซ่อนเฉพาะจากหน้าชุมชนของคุณ และสามารถยกเลิกได้ภายหลัง`,
      ),
      icon: 'question',
      showCancelButton: true,
      focusCancel: true,
      reverseButtons: true,
      buttonsStyling: false,
      confirmButtonText: copy(language, 'Hide post', 'ปิดการมองเห็น'),
      cancelButtonText: copy(language, 'Cancel', 'ยกเลิก'),
      background: '#101511',
      color: '#eaf7df',
      customClass: {
        popup: 'plantsim-shop-alert',
        title: 'plantsim-shop-alert__title',
        actions: 'plantsim-shop-alert__actions',
        confirmButton: 'plantsim-shop-alert__confirm',
        cancelButton: 'plantsim-shop-alert__cancel',
      },
    })

    if (!confirmation.isConfirmed) return
    updateHiddenPostIds((current) => [...new Set([...current, String(post.id)])])
  }, [hiddenPostIds, language, updateHiddenPostIds])

  const handleRestorePost = useCallback((post) => {
    if (!post?.id) return
    updateHiddenPostIds((current) => current.filter((id) => id !== String(post.id)))
  }, [updateHiddenPostIds])

  const updatePostEverywhere = useCallback((postId, updater) => {
    const updateList = (list) => list.map((post) => (String(post.id) === String(postId) ? updater(post) : post))

    setPosts(updateList)
    setFriendPosts(updateList)
    setSelectedPost((current) => (current && String(current.id) === String(postId) ? updater(current) : current))
  }, [])

  const handleOpenPost = useCallback((post) => {
    setPostActionError('')
    setSelectedPost(post)
    setCommentDraft('')
    setReplyingToId(null)
    setReplyDrafts({})
    setPostComments([])
    setPostCommentsLoading(true)

    getPostComments(post.id)
      .then((payload) => setPostComments(payload.data ?? []))
      .catch(() => setPostComments([]))
      .finally(() => setPostCommentsLoading(false))
  }, [])

  const handleClosePost = useCallback(() => {
    setPostActionError('')
    setSelectedPost(null)
    setPostComments([])
    setPostCommentsLoading(false)
    setCommentDraft('')
    setReplyingToId(null)
    setReplyDrafts({})
  }, [])

  const handleOpenNotification = useCallback(async (notification) => {
    onNotificationRead?.(notification)

    const post = combinedPosts.find((item) => String(item.id) === String(notification.post_id))
    if (post) {
      handleOpenPost(post)
    } else if (notification.actor) {
      handleSelectUser(notification.actor)
    }
  }, [combinedPosts, handleOpenPost, handleSelectUser, onNotificationRead])

  const triggerReactionBurst = useCallback((key) => {
    setReactionBursts((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 }))
    window.setTimeout(() => {
      setReactionBursts((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
    }, 760)
  }, [])
  const handleToggleLike = useCallback(async (post) => {
    const nextLiked = !post.likedByMe
    const nextLikes = Math.max(0, Number(post.likes ?? 0) + (nextLiked ? 1 : -1))

    if (nextLiked) triggerReactionBurst(`post-${post.id}`)
    updatePostEverywhere(post.id, (current) => ({ ...current, likedByMe: nextLiked, likes: nextLikes }))

    try {
      const payload = nextLiked ? await likePost(post.id) : await unlikePost(post.id)
      updatePostEverywhere(post.id, (current) => ({
        ...current,
        likedByMe: Boolean(payload.liked_by_me),
        likes: Number(payload.likes_count ?? current.likes),
      }))
    } catch {
      updatePostEverywhere(post.id, (current) => ({ ...current, likedByMe: post.likedByMe, likes: post.likes }))
    }
  }, [triggerReactionBurst, updatePostEverywhere])

  const handleToggleCommentLike = useCallback(async (comment) => {
    if (!selectedPost?.id) return

    const nextLiked = !comment.liked_by_me
    const nextLikes = Math.max(0, Number(comment.likes_count ?? 0) + (nextLiked ? 1 : -1))

    if (nextLiked) triggerReactionBurst(`comment-${comment.id}`)
    setPostComments((current) => updateCommentTree(current, comment.id, (item) => ({ ...item, liked_by_me: nextLiked, likes_count: nextLikes })))

    try {
      const payload = nextLiked ? await likePostComment(selectedPost.id, comment.id) : await unlikePostComment(selectedPost.id, comment.id)
      setPostComments((current) => updateCommentTree(current, comment.id, (item) => ({
        ...item,
        liked_by_me: Boolean(payload.liked_by_me),
        likes_count: Number(payload.likes_count ?? item.likes_count ?? 0),
      })))
    } catch {
      setPostComments((current) => updateCommentTree(current, comment.id, (item) => ({ ...item, liked_by_me: comment.liked_by_me, likes_count: comment.likes_count })))
    }
  }, [selectedPost, triggerReactionBurst])

  const handleStartReply = useCallback((commentId) => {
    setReplyingToId((current) => (String(current) === String(commentId) ? null : commentId))
  }, [])

  const handleReplyDraftChange = useCallback((commentId, value) => {
    setReplyDrafts((current) => ({ ...current, [commentId]: value }))
  }, [])

  const handleSubmitReply = useCallback(async (event, parentId) => {
    event.preventDefault()
    const text = (replyDrafts[parentId] ?? '').trim()

    if (!selectedPost?.id || !text) return

    setSubmittingReply(true)
    setPostActionError('')
    try {
      const payload = await createPostCommentReply(selectedPost.id, parentId, text)
      if (payload.data) setPostComments((current) => addReplyToTree(current, parentId, { ...payload.data, replies: payload.data.replies ?? [] }))
      updatePostEverywhere(selectedPost.id, (current) => ({
        ...current,
        replies: Number(payload.comments_count ?? current.replies + 1),
      }))
      setReplyDrafts((current) => ({ ...current, [parentId]: '' }))
      setReplyingToId(null)
    } catch (error) {
      setPostActionError(error.message || copy(language, 'Your reply could not be posted. Please try again.', 'ไม่สามารถส่งคำตอบได้ โปรดลองอีกครั้ง'))
    } finally {
      setSubmittingReply(false)
    }
  }, [language, replyDrafts, selectedPost, updatePostEverywhere])
  const handleSubmitComment = useCallback(async (event) => {
    event.preventDefault()
    const text = commentDraft.trim()

    if (!selectedPost?.id || !text) return

    setSubmittingComment(true)
    setPostActionError('')
    try {
      const payload = await createPostComment(selectedPost.id, text)
      if (payload.data) setPostComments((current) => [...current, { ...payload.data, replies: payload.data.replies ?? [] }])
      updatePostEverywhere(selectedPost.id, (current) => ({
        ...current,
        replies: Number(payload.comments_count ?? current.replies + 1),
      }))
      setCommentDraft('')
    } catch (error) {
      setPostActionError(error.message || copy(language, 'Your comment could not be posted. Please try again.', 'ไม่สามารถส่งความคิดเห็นได้ โปรดลองอีกครั้ง'))
    } finally {
      setSubmittingComment(false)
    }
  }, [commentDraft, language, selectedPost, updatePostEverywhere])

  const handleOpenCommunityGame = useCallback((post) => {
    const nextHomeScrollTop = activeView === 'home'
      ? sharedScrollRef.current?.scrollTop ?? homeScrollTop
      : homeScrollTop

    setHomeScrollTop(nextHomeScrollTop)
    try {
      window.sessionStorage.setItem(communityReturnStateKey, JSON.stringify({
        activeFeed,
        activeView,
        homeScrollTop: nextHomeScrollTop,
        selectedProfile,
      }))
    } catch {
      // Returning still works when session storage is unavailable.
    }
    onOpenGame?.(post)
  }, [activeFeed, activeView, homeScrollTop, onOpenGame, selectedProfile])

  const centerView = useMemo(() => {
    if (activeView === 'profile') {
      const shownProfile = selectedProfile ?? profileUser
      const isOwnProfile = !selectedProfile || (user?.id && selectedProfile?.id && String(user.id) === String(selectedProfile.id))

      return (
        <ProfileCenter
          actionBusy={profileActionBusy}
          actionError={profileActionError}
          friendsCount={friendsCount}
          hiddenPostIds={hiddenPostIds}
          isOwnProfile={isOwnProfile}
          loading={communityStatus === 'loading'}
          onAddFriend={handleAddFriend}
          onBack={() => {
            setProfileActionError('')
            setSelectedProfile(null)
            navigateCommunityView('home')
          }}
          onEditProfile={() => setEditingProfile(true)}
          onHidePost={handleHidePost}
          onOpenGame={handleOpenCommunityGame}
          onOpenPost={handleOpenPost}
          onRestorePost={handleRestorePost}
          onSelectUser={handleSelectUser}
          onToggleLike={handleToggleLike}
          posts={combinedPosts}
          reactionBursts={reactionBursts}
          user={shownProfile}
        />
      )
    }
    if (activeView === 'notifications') {
      return (
        <NotificationsCenter
          error={notificationError}
          items={notificationItems}
          loading={notificationStatus === 'loading'}
          onOpen={handleOpenNotification}
          onRetry={() => onNotificationsRefresh?.()}
        />
      )
    }
    if (activeView === 'search') {
      return (
        <SearchCenter
          error={searchError}
          loading={searchLoading}
          onQueryChange={handleSearchQueryChange}
          onSelectUser={handleSelectUser}
          query={searchQuery}
          results={searchResults}
        />
      )
    }

    return <FeedCenter activeFeed={activeFeed} error={communityError} friendPosts={friendPosts} hiddenPostIds={hiddenPostIds} onFeedChange={setActiveFeed} onHidePost={handleHidePost} onOpenGame={handleOpenCommunityGame} onOpenPost={handleOpenPost} onRestorePost={handleRestorePost} onRetry={() => setCommunityReloadKey((current) => current + 1)} onSelectUser={handleSelectUser} onToggleLike={handleToggleLike} posts={posts} reactionBursts={reactionBursts} status={communityStatus} />
  }, [activeFeed, activeView, combinedPosts, communityError, communityStatus, friendPosts, friendsCount, handleAddFriend, handleHidePost, handleOpenCommunityGame, handleOpenNotification, handleOpenPost, handleRestorePost, handleSearchQueryChange, handleSelectUser, handleToggleLike, hiddenPostIds, navigateCommunityView, notificationError, notificationItems, notificationStatus, onNotificationsRefresh, posts, profileActionBusy, profileActionError, profileUser, searchError, searchLoading, searchQuery, reactionBursts, searchResults, selectedProfile, user])

  return (
    <CommunityLanguageContext.Provider value={language}>
      <section className="user-page user-page--community particle-network-surface particle-network-surface--game absolute inset-x-0 bottom-0 top-16 z-10 overflow-hidden bg-[#111514] text-slate-100">
        <ParticleNetworkBackground variant="community" />
        <div
          className="community-shared-scroll relative z-[1] mx-auto grid h-full max-w-[1180px] items-start overflow-y-auto overscroll-contain border-x border-lime-100/10 grid-cols-[220px_minmax(420px,1fr)_260px] max-lg:grid-cols-[180px_minmax(0,1fr)] max-md:grid-cols-1 max-md:pb-20"
          ref={sharedScrollRef}
        >
          <aside className="sticky top-0 min-h-[calc(100dvh-4rem)] self-start border-r border-lime-100/10 bg-[#151817] px-5 py-8 max-md:hidden" data-tour="community-navigation">
            <nav className="space-y-2" aria-label={copy(language, 'Community sections', 'ส่วนต่าง ๆ ของชุมชน')}>
              <LeftNavItem active={activeView === 'home'} icon="home" label={copy(language, 'Home', 'หน้าหลัก')} onClick={() => navigateCommunityView('home')} />
              <LeftNavItem active={activeView === 'profile' && !selectedProfile} icon="profile" label={copy(language, 'Profile', 'โปรไฟล์')} onClick={handleOpenOwnProfile} />
              <LeftNavItem active={activeView === 'search'} icon="search" label={copy(language, 'Search', 'ค้นหา')} onClick={handleOpenSearch} />
              <LeftNavItem active={activeView === 'notifications'} badge={unreadCount} icon="notifications" label={copy(language, 'Notifications', 'การแจ้งเตือน')} onClick={() => navigateCommunityView('notifications')} />
            </nav>
          </aside>

          {centerView}

          <RightDashboard
            leaderboard={leaderboard}
            loading={leaderboardStatus === 'loading'}
            onOpenSearch={handleOpenSearch}
            onSelectUser={handleSelectUser}
          />
        </div>

        <nav className="absolute inset-x-0 bottom-0 z-40 hidden grid-cols-4 border-t border-lime-100/10 bg-[#101412]/95 shadow-[0_-10px_30px_rgba(0,0,0,.28)] backdrop-blur max-md:grid" data-tour="community-mobile-navigation" aria-label={copy(language, 'Community sections', 'ส่วนต่าง ๆ ของชุมชน')}>
          <MobileNavItem active={activeView === 'home'} icon="home" label={copy(language, 'Home', 'หน้าหลัก')} onClick={() => navigateCommunityView('home')} />
          <MobileNavItem active={activeView === 'profile'} icon="profile" label={copy(language, 'Profile', 'โปรไฟล์')} onClick={handleOpenOwnProfile} />
          <MobileNavItem active={activeView === 'search'} icon="search" label={copy(language, 'Search', 'ค้นหา')} onClick={handleOpenSearch} />
          <MobileNavItem active={activeView === 'notifications'} badge={unreadCount} icon="notifications" label={copy(language, 'Alerts', 'แจ้งเตือน')} onClick={() => navigateCommunityView('notifications')} />
        </nav>

        <CommunityMotionStyles />
        {editingProfile ? (
          <EditProfileModal
            error={profileError}
            onClose={() => setEditingProfile(false)}
            onSave={handleSaveProfile}
            saving={profileSaving}
            user={profileUser}
          />
        ) : null}
        <PostModal
          actionError={postActionError}
          commentBurstKeys={reactionBursts}
          commentDraft={commentDraft}
          comments={postComments}
          commentsLoading={postCommentsLoading}
          currentUser={profileUser}
          onClose={handleClosePost}
          onCommentDraftChange={setCommentDraft}
          onOpenGame={handleOpenCommunityGame}
          onReplyDraftChange={handleReplyDraftChange}
          onSelectUser={handleSelectUser}
          onStartReply={handleStartReply}
          onSubmitComment={handleSubmitComment}
          onSubmitReply={handleSubmitReply}
          onToggleCommentLike={handleToggleCommentLike}
          onToggleLike={handleToggleLike}
          post={selectedPost}
          postBurstKey={selectedPost ? reactionBursts[`post-${selectedPost.id}`] : undefined}
          replyingToId={replyingToId}
          replyDrafts={replyDrafts}
          submittingComment={submittingComment}
          submittingReply={submittingReply}
        />
      </section>
    </CommunityLanguageContext.Provider>
  )
}
