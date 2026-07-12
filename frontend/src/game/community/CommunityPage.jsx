import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPostComment, createPostCommentReply, getCommunityLeaderboard, getFriendPosts, getFriends, getMe, getNotifications, getPostComments, getPosts, getToken, inviteFriend, likePost, likePostComment, markNotificationRead, resolveAssetUrl, searchUsers, unlikePost, unlikePostComment, updateMe } from '../../lib/api'
import { AppIcon } from '../icons/IconifyIcon'

function displayName(user) {
  return user?.username ?? user?.email?.split('@')[0] ?? 'Learner'
}

function avatarLabel(value) {
  return String(value ?? 'L').slice(0, 1).toUpperCase()
}

function UserAvatar({ user, fallback, className = '' }) {
  const label = fallback ?? avatarLabel(displayName(user))

  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#263022] font-black text-lime-100 ring-1 ring-lime-100/10 ${className}`}>
      {user?.avatar_url ? <img className="h-full w-full object-cover object-center" src={resolveAssetUrl(user.avatar_url)} alt="" /> : label}
    </span>
  )
}

function CoverImage({ user, preview = '' }) {
  const src = preview || (user?.cover_url ? resolveAssetUrl(user.cover_url) : '')

  if (!src) return null

  return <img className="absolute inset-0 z-0 h-full w-full object-cover object-center" src={src} alt="" />
}

function formatTime(value) {
  if (!value) return 'just now'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'recently'

  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function formatNotificationTime(value) {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return 'just now'
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
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
    reposts: post.reposts ?? Math.max(4, Number(history?.duration_days ?? 1) * 8),
    likes: post.likes_count ?? post.likes ?? Math.max(12, Number(history?.total_score ?? 0)),
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
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${
        active ? 'bg-white/[0.055] font-bold text-lime-50' : 'text-slate-300 hover:bg-white/[0.04] hover:text-lime-50'
      }`}
      onClick={onClick}
    >
      <span className="relative shrink-0">
        <AppIcon className={`h-4 w-4 ${active ? 'text-lime-100' : 'text-slate-400'}`} name={icon} />
        {badge > 0 ? (
          <span className="absolute -right-2 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-[#151817]">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      {label}
    </button>
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
      className={`relative inline-flex items-center gap-2 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${
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
  if (!history && !liveSimulator) return null

  const isLive = Boolean(liveSimulator && liveSimulator.status === 'active' && liveSimulator.share_visibility !== 'private')
  const score = Number(history?.total_score ?? liveSimulator?.growth_point ?? 0)
  const health = Number(history?.final_health ?? history?.health ?? liveSimulator?.health ?? 0)
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
      aria-label={isLive ? 'Enter spectator mode' : 'Open saved game state'}
    >
      <div className="relative h-48 bg-[#080b09]">
        {imageUrl ? (
          <img className={`h-full w-full transition duration-300 group-hover:scale-[1.015] ${snapshotUrl ? 'object-cover' : 'object-contain p-6'}`} src={resolveAssetUrl(imageUrl)} alt={isLive ? 'Live plant garden' : 'Saved plant game state'} />
        ) : (
          <div className="grid h-full place-items-center text-sm text-slate-400">{isLive ? 'Live plant garden' : 'Saved game state'}</div>
        )}
        <span className={`absolute left-3 top-3 inline-flex items-center gap-2 rounded-md px-2 py-1 text-[10px] font-black ${isLive ? 'bg-[#9bcf82] text-[#101511]' : 'bg-[#101511]/90 text-lime-100'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-[#101511]' : 'bg-slate-400'}`} />
          {isLive ? 'LIVE GARDEN' : 'SAVED GAME STATE'}
        </span>
        <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 transition duration-200 group-hover:bg-black/35 group-focus-visible:bg-black/35">
          <span className="game-preview-eye grid h-12 w-12 scale-75 place-items-center rounded-full border border-lime-100/25 bg-[#101511]/90 text-lime-100 opacity-0 shadow-[0_8px_18px_rgba(0,0,0,.3)] group-hover:opacity-100 group-focus-visible:opacity-100">
            <AppIcon className="h-6 w-6" name="eye" />
          </span>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3 text-xs">
        <span className="rounded-md bg-white/[0.04] px-2 py-2 text-slate-300">Score <strong className="text-lime-100">{score}</strong></span>
        <span className="rounded-md bg-white/[0.04] px-2 py-2 text-slate-300">Health <strong className="text-lime-100">{health}%</strong></span>
        <span className="rounded-md bg-white/[0.04] px-2 py-2 text-slate-300">{isLive ? 'Growth' : 'Days'} <strong className="text-lime-100">{isLive ? `${Math.round(score)}%` : history?.duration_days ?? 1}</strong></span>
      </div>
      <span className="flex w-full items-center justify-center gap-2 border-t border-lime-100/10 bg-[#9bcf82]/10 px-3 py-3 text-xs font-black text-lime-100 transition group-hover:bg-[#9bcf82]/18">
        <AppIcon className="h-4 w-4" name="eye" />
        {isLive ? 'Enter spectator mode' : 'Open saved game state'}
      </span>
    </button>
  )
}

function ProfileHoverCard({ onSelectUser, user }) {
  const normalized = normalizeUser(user)
  const bio = user?.bio || 'Plant Growth Academy learner sharing saved simulations and classroom observations.'
  const plantCount = Number(user?.plants_count ?? user?.plant_histories_count ?? 0)
  const friendCount = Number(user?.friends_count ?? 0)

  return (
    <div className="pointer-events-none absolute left-0 top-full z-30 mt-3 w-72 translate-y-1 rounded-xl border border-lime-100/10 bg-[#101312] p-4 text-left opacity-0 shadow-[0_14px_34px_rgba(0,0,0,0.36)] transition duration-200 group-hover/profile:pointer-events-auto group-hover/profile:translate-y-0 group-hover/profile:opacity-100 group-focus-within/profile:pointer-events-auto group-focus-within/profile:translate-y-0 group-focus-within/profile:opacity-100">
      <button className="flex w-full items-start gap-3 text-left" onClick={() => onSelectUser?.(user)} type="button">
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[#263022] text-base font-black text-lime-100 ring-1 ring-lime-100/10">
          {user?.avatar_url ? <img className="h-full w-full object-cover" src={resolveAssetUrl(user.avatar_url)} alt="" /> : normalized.avatar}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <strong className="truncate text-sm text-lime-50">{normalized.name}</strong>
            <span className="rounded-md border border-lime-100/10 bg-white/[0.035] px-1.5 py-0.5 text-[10px] font-bold text-lime-100">Lv.{normalized.levelInfo.level}</span>
          </span>
          <span className="block truncate text-xs text-slate-500">{normalized.handle}</span>
        </span>
      </button>
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">{bio}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-400">
        <span className="rounded-md bg-white/[0.04] px-2 py-2"><strong className="text-lime-100">{friendCount}</strong> friends</span>
        <span className="rounded-md bg-white/[0.04] px-2 py-2"><strong className="text-lime-100">{plantCount}</strong> plants</span>
      </div>
    </div>
  )
}

function FeedPost({ onOpenGame, onOpenPost, onSelectUser, onToggleLike, post, reactionBurstKey }) {
  const postUser = post.user ?? { username: post.author, level: post.level }

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
        <div className="group/profile relative h-fit shrink-0" onClick={(event) => event.stopPropagation()}>
          <button
            className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#263022] text-sm font-black text-lime-100 ring-1 ring-lime-100/10 transition hover:ring-[#8fbf78]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            onClick={() => onSelectUser?.(postUser)}
            type="button"
            aria-label={'Open ' + post.author + ' profile'}
          >
            {postUser.avatar_url ? <img className="h-full w-full object-cover" src={resolveAssetUrl(postUser.avatar_url)} alt="" /> : post.avatar}
          </button>
          <ProfileHoverCard onSelectUser={onSelectUser} user={postUser} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-3">
            <div className="group/profile relative min-w-0" onClick={(event) => event.stopPropagation()}>
              <button className="min-w-0 text-left" onClick={() => onSelectUser?.(postUser)} type="button">
                <strong className="mr-1 text-sm text-lime-50">{post.author}</strong>
                <span className="text-xs text-slate-400">{post.handle}</span>
                {post.level ? <span className="ml-2 rounded-md border border-lime-100/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-bold text-slate-500">Lv.{post.level}</span> : null}
                <span className="ml-2 text-xs text-slate-500">{formatTime(post.created_at)}</span>
              </button>
              <ProfileHoverCard onSelectUser={onSelectUser} user={postUser} />
            </div>
            <button type="button" className="rounded-md p-1 text-slate-400 transition hover:bg-white/[0.06] hover:text-lime-50" onClick={(event) => event.stopPropagation()} aria-label="Post menu">
              <AppIcon className="h-4 w-4" name="more" />
            </button>
          </div>
          <div className="block w-full text-left">
            <p className="whitespace-pre-line text-sm leading-6 text-slate-100">{post.body}</p>
            {post.history || post.liveSimulator ? <HistoryPreview history={post.history} liveSimulator={post.liveSimulator} onOpenGame={onOpenGame} post={post} /> : null}
          </div>
          <div className="mt-5 grid max-w-[180px] grid-cols-2 text-slate-400">
            <ActionButton active={post.likedByMe} burstKey={reactionBurstKey} icon="heart" label="Like post" onClick={() => onToggleLike(post)} value={post.likes} />
            <ActionButton icon="chat" label="Comment on post" onClick={() => onOpenPost(post)} value={post.replies} />
          </div>
        </div>
      </div>
    </article>
  )
}

function CommentItem({ burstKeys, comment, depth = 0, onReplyDraftChange, onSelectUser, onStartReply, onSubmitReply, onToggleCommentLike, replyingToId, replyDrafts, submittingReply }) {
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
            <button className="block text-left text-xs font-black text-lime-50 transition hover:text-[#9bcf82] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200" onClick={() => onSelectUser?.(comment.user)} type="button">{author}</button>
            <p className="whitespace-pre-line text-sm leading-5 text-slate-100">{comment.comment_text}</p>
          </div>
          <div className="mt-1 flex items-center gap-3 px-2 text-[11px] font-semibold text-slate-500">
            <span>{formatTime(comment.created_at)}</span>
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
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#8fbf78] text-[#101511] transition hover:bg-[#a6d892] disabled:cursor-not-allowed disabled:opacity-50"
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
function PostModal({ commentBurstKeys, commentDraft, comments, currentUser, onClose, onCommentDraftChange, onOpenGame, onReplyDraftChange, onSelectUser, onStartReply, onSubmitComment, onSubmitReply, onToggleCommentLike, onToggleLike, post, postBurstKey, replyingToId, replyDrafts, submittingComment, submittingReply }) {
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
            <p className="text-xs text-slate-500">{post.handle} - {formatTime(post.created_at)}</p>
          </div>
          <button
            className="grid h-8 w-8 place-items-center rounded-md border border-lime-100/10 text-slate-400 transition hover:bg-white/[0.05] hover:text-lime-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
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
            {comments.length ? comments.map((comment) => (
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
function ProfileCenter({ friendsCount, isOwnProfile = true, onAddFriend, onBack, onEditProfile, onOpenGame, onOpenPost, onSelectUser, onToggleLike, posts, reactionBursts, user }) {
  const name = displayName(user)
  const handle = '@' + (user?.username ?? name.replace(/\s+/g, '').toLowerCase())
  const profilePosts = posts.filter((post) => {
    if (user?.id && post.user?.id) return String(post.user.id) === String(user.id)
    return post.handle === handle
  })
  const levelInfo = getLevelInfo(user)
  const friendStatus = user?.friendship_status ?? 'none'
  const canAddFriend = !isOwnProfile && friendStatus !== 'connected'
  const actionLabel = isOwnProfile ? 'Edit profile' : friendStatus === 'connected' ? 'Friend' : 'Add Friend'
  const profileFriendsCount = isOwnProfile ? friendsCount : Number(user?.friends_count ?? 0)
  const plantsGrownCount = Number(user?.plants_count ?? user?.plant_histories_count ?? 0)
  const bio = user?.bio || 'Plant Growth Academy learner sharing saved simulations, healthy growth records, and classroom observations from the lab.'

  return (
    <main className="min-w-0 overflow-y-auto bg-[#141817]">
      {!isOwnProfile ? (
        <div className="sticky top-0 z-20 border-b border-lime-100/10 bg-[#141817]/95 px-6 py-3 backdrop-blur">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-full border border-lime-100/10 bg-white/[0.035] px-3 text-sm font-bold text-slate-200 transition hover:border-[#8fbf78]/70 hover:bg-white/[0.06] hover:text-lime-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            onClick={onBack}
            type="button"
          >
            <AppIcon className="h-4 w-4" name="arrowBack" />
            Back
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
                className={'h-8 rounded-full px-5 text-xs font-black transition focus:outline-none focus:ring-2 ' + (isOwnProfile ? 'border border-sky-200/80 bg-sky-100 text-sky-950 hover:bg-sky-200 focus:ring-sky-300/70' : canAddFriend ? 'border border-lime-200/80 bg-lime-200 text-[#101511] hover:bg-lime-100 focus:ring-lime-300/70' : 'border border-lime-100/10 bg-white/[0.05] text-slate-300')}
                disabled={!isOwnProfile && !canAddFriend}
                onClick={isOwnProfile ? onEditProfile : canAddFriend ? onAddFriend : undefined}
                type="button"
              >
                {actionLabel}
              </button>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-lime-50">{name}</h1>
              <span className="rounded-md border border-lime-100/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-bold text-lime-100">Lv.{levelInfo.level}</span>
              <span className="grid h-4 w-4 place-items-center rounded-full bg-[#8fbf78] text-[10px] text-[#101511]"><AppIcon className="h-3 w-3" name="check" /></span>
            </div>
            <p className="text-xs text-slate-500">{handle}</p>
            <div className="mt-2 flex max-w-[240px] items-center gap-2 text-[10px] font-semibold text-slate-500">
              <span>EXP</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-gradient-to-r from-[#78d67a] to-[#b8ec9e] transition-[width] duration-500" style={{ width: String(levelInfo.percent) + '%' }} /></span>
              <span>{levelInfo.exp}/{levelInfo.nextExp}</span>
            </div>
            <p className="mt-3 max-w-[58ch] whitespace-pre-line text-sm leading-6 text-slate-300">{bio}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-slate-500">
              <span className="inline-flex items-center gap-1.5"><AppIcon className="h-4 w-4" name="history" />Joined July 2026</span>
              <span className="inline-flex items-center gap-1.5"><AppIcon className="h-4 w-4" name="groups" />{profileFriendsCount} friends</span>
              <span className="inline-flex items-center gap-1.5"><AppIcon className="h-4 w-4" name="plant" />{plantsGrownCount} plants grown</span>
            </div>
          </div>
          <div className="mt-5 border-t border-lime-100/10 text-xs font-bold text-slate-400">
            <button className="relative px-2 py-3 text-lime-50" type="button">Posts<span className="absolute bottom-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-[#8fbf78]" /></button>
          </div>
        </div>
      </section>

      {profilePosts.map((post) => (
        <FeedPost key={post.id} onOpenGame={onOpenGame} onOpenPost={onOpenPost} onSelectUser={onSelectUser} onToggleLike={onToggleLike} post={post} reactionBurstKey={reactionBursts['post-' + post.id]} />
      ))}
      {!profilePosts.length ? <div className="grid min-h-[320px] place-items-center border-t border-lime-100/10 px-8 text-center text-sm text-slate-400">Shared plant history posts will appear here.</div> : null}
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
          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition hover:bg-white/[0.04] hover:text-lime-100" onClick={onClose} type="button" aria-label="Close edit profile"><span className="text-xl leading-none">&times;</span></button>
          <h2 className="text-base font-black text-lime-50">Edit profile</h2>
          <button className="h-8 rounded-full bg-sky-100 px-5 text-xs font-black text-sky-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving || !form.username.trim()} type="submit">{saving ? 'Saving...' : 'Save'}</button>
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
          <span className="rounded-md border border-lime-100/10 bg-white/[0.035] px-1.5 py-0.5 text-[10px] font-bold text-lime-100">Lv.{normalized.levelInfo.level}</span>
        </span>
        <span className="block truncate text-xs text-slate-500">{normalized.handle}</span>
      </span>
      {plantCount > 0 ? <span className="text-[11px] font-semibold text-slate-500">{plantCount} saves</span> : null}
    </button>
  )
}

function SearchCenter({ query, results, loading, onQueryChange, onSelectUser }) {
  return (
    <main className="min-w-0 overflow-y-auto bg-[#141817]">
      <div className="sticky top-0 z-10 border-b border-lime-100/10 bg-[#141817]/95 px-6 py-3 backdrop-blur">
        <label className="relative block">
          <span className="sr-only">Search users</span>
          <AppIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" name="search" />
          <input
            autoFocus
            className="h-11 w-full rounded-full border border-lime-100/10 bg-[#080b09] pl-11 pr-4 text-sm text-lime-50 outline-none transition placeholder:text-slate-500 focus:border-[#8fbf78]"
            onChange={(event) => onQueryChange(event.target.value)}
            autoComplete="off"
            placeholder="Search"
            type="search"
            value={query}
          />
        </label>
      </div>
      <div className="divide-y divide-lime-100/10">
        {loading ? (
          <div className="px-8 py-8 text-sm text-slate-400">Searching ...</div>
        ) : results.length ? (
          results.map((result) => <UserSearchRow key={result.id} onSelect={onSelectUser} user={result} />)
        ) : (
          <div className="grid min-h-[360px] place-items-center px-8 text-center text-sm text-slate-400">
            {query.trim() ? 'No learners found.' : 'Search for friends or other learners by username or email.'}
          </div>
        )}
      </div>
    </main>
  )
}

function LeaderboardCard({ title, subtitle, icon, users, metric }) {
  return (
    <section className="rounded-lg bg-[#171b1a] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-[#22301f] text-lime-100">
          <AppIcon className="h-4 w-4" name={icon} />
        </span>
        <div>
          <h2 className="text-sm font-black text-lime-50">{title}</h2>
          <p className="text-[11px] text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-1">
        {users.slice(0, 10).map((user, index) => (
          <div key={user.id} className="flex items-center gap-2 rounded-md px-2 py-2">
            <span className={`w-5 text-center text-xs font-black ${index < 3 ? 'text-lime-100' : 'text-slate-500'}`}>{index + 1}</span>
            <UserAvatar className="h-7 w-7 text-[11px]" fallback={avatarLabel(displayName(user))} user={user} />
            <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-200">{displayName(user)}</span>
            <span className="text-[11px] font-black text-lime-100">{metric(user)}</span>
          </div>
        ))}
        {!users.length ? <p className="py-4 text-xs text-slate-500">No ranking data yet.</p> : null}
      </div>
    </section>
  )
}

function RightDashboard({ leaderboard, onOpenSearch }) {
  return (
    <aside className="overflow-y-auto border-l border-lime-100/10 bg-[#151817] px-5 py-6 max-lg:hidden">
      <button
        className="relative block h-11 w-full rounded-full border border-lime-100/10 bg-[#101312] pl-11 pr-4 text-left text-sm text-slate-500 outline-none transition hover:border-[#8fbf78] hover:text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
        onClick={onOpenSearch}
        type="button"
      >
        <span className="sr-only">Open search</span>
        <AppIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" name="search" />
        search here...
      </button>

      <div className="mt-6 space-y-4">
        <LeaderboardCard
          icon="trophy"
          metric={(user) => `Lv.${user.level ?? 1}`}
          subtitle="top 10 Levels"
          title="Level ranking"
          users={leaderboard.levels}
        />
        <LeaderboardCard
          icon="plant"
          metric={(user) => user.plants_count ?? 0}
          subtitle="most saved plants"
          title="Grow ranking"
          users={leaderboard.growers}
        />
      </div>
    </aside>
  )
}

function NotificationRow({ item, onOpen }) {
  const actorName = displayName(item.actor)
  const action = item.type === 'like'
    ? 'liked your post'
    : item.type === 'comment_like'
      ? 'liked your comment'
      : item.type === 'reply'
        ? 'replied to your comment'
        : 'commented on your post'

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
          <span className="text-xs text-[#78906f]">{formatNotificationTime(item.created_at)}</span>
        </span>
        <span className="mt-1 block text-xs text-[#8fa38a]">On {item.plant_name || 'your plant update'}</span>
        {item.excerpt ? <span className="mt-1 block truncate text-xs text-slate-300">“{item.excerpt}”</span> : null}
      </span>
    </button>
  )
}

function NotificationsCenter({ items, onOpen }) {
  const [tab, setTab] = useState('all')
  const visibleItems = tab === 'unread' ? items.filter((item) => !item.is_read) : items

  return (
    <main className="min-w-0 overflow-y-auto bg-[#141817]">
      <header className="sticky top-0 z-10 border-b border-lime-100/10 bg-[#141817]/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-5">
          <h1 className="text-xl font-black text-lime-50">Notifications</h1>
          <span className="text-xs text-[#8fa38a]">Updates appear automatically</span>
        </div>
        <div className="grid grid-cols-2 text-sm font-bold">
          {[
            { id: 'all', label: 'All' },
            { id: 'unread', label: 'Unread' },
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

      {visibleItems.length ? (
        <div>
          {visibleItems.map((item) => (
            <NotificationRow key={item.id} item={item} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <section className="mx-auto max-w-md px-8 pt-10 text-left">
          <h2 className="text-3xl font-black leading-tight text-lime-50">Nothing to see here yet</h2>
          <p className="mt-3 text-sm leading-6 text-[#8fa38a]">Likes, comments, and replies on your plant posts will appear here.</p>
        </section>
      )}
    </main>
  )
}

function FeedCenter({ posts, friendPosts, activeFeed, onFeedChange, onOpenGame, onOpenPost, onSelectUser, onToggleLike, reactionBursts }) {
  const visiblePosts = activeFeed === 'friends' ? friendPosts : posts

  return (
    <main className="min-w-0 overflow-y-auto bg-[#141817]">
      <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-lime-100/10 bg-[#141817]/95 backdrop-blur">
        <button
          type="button"
          className={`relative px-4 py-4 text-center text-sm transition ${activeFeed === 'for-you' ? 'font-bold text-lime-50' : 'text-slate-400 hover:text-lime-100'}`}
          onClick={() => onFeedChange('for-you')}
        >
          For you
          {activeFeed === 'for-you' ? <span className="absolute bottom-0 left-1/2 h-0.5 w-16 -translate-x-1/2 rounded-full bg-[#8fbf78]" /> : null}
        </button>
        <button
          type="button"
          className={`relative px-4 py-4 text-center text-sm transition ${activeFeed === 'friends' ? 'font-bold text-lime-50' : 'text-slate-400 hover:text-lime-100'}`}
          onClick={() => onFeedChange('friends')}
        >
          Friends
          {activeFeed === 'friends' ? <span className="absolute bottom-0 left-1/2 h-0.5 w-16 -translate-x-1/2 rounded-full bg-[#8fbf78]" /> : null}
        </button>
      </div>
      {visiblePosts.map((post) => (
        <FeedPost key={post.id} onOpenGame={onOpenGame} onOpenPost={onOpenPost} onSelectUser={onSelectUser} onToggleLike={onToggleLike} post={post} reactionBurstKey={reactionBursts[`post-${post.id}`]} />
      ))}
      {!visiblePosts.length ? (
        <div className="grid min-h-[420px] place-items-center px-8 text-center text-sm text-slate-400">
          {activeFeed === 'friends' ? 'Posts from you and your friends will appear here.' : 'Shared plant histories will appear here.'}
        </div>
      ) : null}
    </main>
  )
}

export function CommunityPage({ currentUser = null, onOpenGame, onUserChange } = {}) {
  const [activeView, setActiveView] = useState('home')
  const [activeFeed, setActiveFeed] = useState('for-you')
  const [posts, setPosts] = useState([])
  const [friendPosts, setFriendPosts] = useState([])
  const [user, setUser] = useState(currentUser)
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [friendsCount, setFriendsCount] = useState(0)
  const [, setFriendRows] = useState([])
  const [leaderboard, setLeaderboard] = useState({ levels: [], growers: [] })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)
  const [postComments, setPostComments] = useState([])
  const [commentDraft, setCommentDraft] = useState('')
  const [replyingToId, setReplyingToId] = useState(null)
  const [replyDrafts, setReplyDrafts] = useState({})
  const [submittingComment, setSubmittingComment] = useState(false)
  const [submittingReply, setSubmittingReply] = useState(false)
  const [reactionBursts, setReactionBursts] = useState({})
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [notificationItems, setNotificationItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadCommunity() {
      try {
        const [postPayload, friendPostPayload, userPayload, friendsPayload, leaderboardPayload] = await Promise.all([
          getPosts(),
          getToken() ? getFriendPosts().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          getToken() ? getMe().catch(() => null) : Promise.resolve(null),
          getToken() ? getFriends().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          getToken() ? getCommunityLeaderboard().catch(() => ({ data: { levels: [], growers: [] } })) : Promise.resolve({ data: { levels: [], growers: [] } }),
        ])

        if (cancelled) return
        const loadedPosts = (postPayload.data ?? []).map(mapPost)
        const loadedFriendPosts = (friendPostPayload.data ?? []).map(mapPost)
        const friends = friendsPayload.data ?? []
        setPosts(loadedPosts)
        setFriendPosts(loadedFriendPosts)
        setUser(userPayload?.data ?? userPayload?.user ?? null)
        setFriendsCount(friends.filter((friend) => !friend.status || friend.status === 'accepted').length)
        setFriendRows(friends)
        setLeaderboard({
          levels: leaderboardPayload.data?.levels ?? [],
          growers: leaderboardPayload.data?.growers ?? [],
        })
      } catch {
        if (!cancelled) {
          setPosts([])
          setFriendPosts([])
          setFriendsCount(0)
          setFriendRows([])
          setLeaderboard({ levels: [], growers: [] })
        }
      }
    }

    loadCommunity()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!getToken()) return undefined
    let cancelled = false

    async function loadNotifications() {
      try {
        const payload = await getNotifications()
        if (!cancelled) {
          setNotificationItems(payload.data ?? [])
          setUnreadCount(Number(payload.unread_count ?? 0))
        }
      } catch {
        if (!cancelled) {
          setNotificationItems([])
          setUnreadCount(0)
        }
      }
    }

    loadNotifications()
    const interval = window.setInterval(loadNotifications, 15000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

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
          if (!cancelled) setSearchResults(payload.data ?? [])
        })
        .catch(() => {
          if (!cancelled) setSearchResults([])
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false)
        })
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchQuery])

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
    if (!nextValue.trim()) {
      setSearchResults([])
      setSearchLoading(false)
    } else if (getToken()) {
      setSearchLoading(true)
    }
  }, [])

  const handleOpenSearch = useCallback(() => {
    setSearchQuery((current) => (looksLikeBrokenThai(current) ? '' : current))
    setActiveView('search')
  }, [])

  const handleSelectUser = useCallback((selectedUser) => {
    if (user?.id && selectedUser?.id && String(user.id) === String(selectedUser.id)) {
      setSelectedProfile(null)
      setActiveView('profile')
      return
    }

    setSelectedProfile(selectedUser)
    setActiveView('profile')
  }, [user])

  const handleOpenOwnProfile = useCallback(() => {
    setSelectedProfile(null)
    setActiveView('profile')
  }, [])

  const handleAddFriend = useCallback(async () => {
    if (!selectedProfile?.id) return

    try {
      await inviteFriend(selectedProfile.id)
      setSelectedProfile((current) => current ? { ...current, friendship_status: 'connected' } : current)
    } catch {
      setSelectedProfile((current) => current ? { ...current, friendship_status: 'connected' } : current)
    }
  }, [selectedProfile])

  const updatePostEverywhere = useCallback((postId, updater) => {
    const updateList = (list) => list.map((post) => (String(post.id) === String(postId) ? updater(post) : post))

    setPosts(updateList)
    setFriendPosts(updateList)
    setSelectedPost((current) => (current && String(current.id) === String(postId) ? updater(current) : current))
  }, [])

  const handleOpenPost = useCallback((post) => {
    setSelectedPost(post)
    setCommentDraft('')
    setReplyingToId(null)
    setReplyDrafts({})
    setPostComments([])

    getPostComments(post.id)
      .then((payload) => setPostComments(payload.data ?? []))
      .catch(() => setPostComments([]))
  }, [])

  const handleClosePost = useCallback(() => {
    setSelectedPost(null)
    setPostComments([])
    setCommentDraft('')
    setReplyingToId(null)
    setReplyDrafts({})
  }, [])

  const handleOpenNotification = useCallback(async (notification) => {
    if (!notification.is_read) {
      setNotificationItems((current) => current.map((item) => String(item.id) === String(notification.id) ? { ...item, is_read: true, read_at: new Date().toISOString() } : item))
      setUnreadCount((current) => Math.max(0, current - 1))
      markNotificationRead(notification.id).catch(() => {})
    }

    const post = combinedPosts.find((item) => String(item.id) === String(notification.post_id))
    if (post) {
      handleOpenPost(post)
    } else if (notification.actor) {
      handleSelectUser(notification.actor)
    }
  }, [combinedPosts, handleOpenPost, handleSelectUser])

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
    try {
      const payload = await createPostCommentReply(selectedPost.id, parentId, text)
      if (payload.data) setPostComments((current) => addReplyToTree(current, parentId, { ...payload.data, replies: payload.data.replies ?? [] }))
      updatePostEverywhere(selectedPost.id, (current) => ({
        ...current,
        replies: Number(payload.comments_count ?? current.replies + 1),
      }))
      setReplyDrafts((current) => ({ ...current, [parentId]: '' }))
      setReplyingToId(null)
    } finally {
      setSubmittingReply(false)
    }
  }, [replyDrafts, selectedPost?.id, updatePostEverywhere])
  const handleSubmitComment = useCallback(async (event) => {
    event.preventDefault()
    const text = commentDraft.trim()

    if (!selectedPost?.id || !text) return

    setSubmittingComment(true)
    try {
      const payload = await createPostComment(selectedPost.id, text)
      if (payload.data) setPostComments((current) => [...current, { ...payload.data, replies: payload.data.replies ?? [] }])
      updatePostEverywhere(selectedPost.id, (current) => ({
        ...current,
        replies: Number(payload.comments_count ?? current.replies + 1),
      }))
      setCommentDraft('')
    } finally {
      setSubmittingComment(false)
    }
  }, [commentDraft, selectedPost?.id, updatePostEverywhere])

  const centerView = useMemo(() => {
    if (activeView === 'profile') {
      const shownProfile = selectedProfile ?? profileUser
      const isOwnProfile = !selectedProfile || (user?.id && selectedProfile?.id && String(user.id) === String(selectedProfile.id))

      return (
        <ProfileCenter
          friendsCount={friendsCount}
          isOwnProfile={isOwnProfile}
          onAddFriend={handleAddFriend}
          onBack={() => {
            setSelectedProfile(null)
            setActiveView('home')
          }}
          onEditProfile={() => setEditingProfile(true)}
          onOpenGame={onOpenGame}
          onOpenPost={handleOpenPost}
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
          items={notificationItems}
          onOpen={handleOpenNotification}
        />
      )
    }
    if (activeView === 'search') {
      return (
        <SearchCenter
          loading={searchLoading}
          onQueryChange={handleSearchQueryChange}
          onSelectUser={handleSelectUser}
          query={searchQuery}
          results={searchResults}
        />
      )
    }

    return <FeedCenter activeFeed={activeFeed} friendPosts={friendPosts} onFeedChange={setActiveFeed} onOpenGame={onOpenGame} onOpenPost={handleOpenPost} onSelectUser={handleSelectUser} onToggleLike={handleToggleLike} posts={posts} reactionBursts={reactionBursts} />
  }, [activeFeed, activeView, combinedPosts, friendPosts, friendsCount, handleAddFriend, handleOpenNotification, handleOpenPost, handleSearchQueryChange, handleSelectUser, handleToggleLike, notificationItems, onOpenGame, posts, profileUser, searchLoading, searchQuery, reactionBursts, searchResults, selectedProfile, user])

  return (
    <section className="absolute inset-x-0 bottom-0 top-16 z-10 overflow-hidden bg-[#111514] text-slate-100">
      <div className="mx-auto grid h-full max-w-[1180px] grid-cols-[220px_minmax(420px,1fr)_260px] border-x border-lime-100/10 max-lg:grid-cols-[180px_minmax(0,1fr)] max-md:grid-cols-1">
        <aside className="border-r border-lime-100/10 bg-[#151817] px-5 py-8 max-md:hidden">
          <nav className="space-y-2" aria-label="Community sections">
            <LeftNavItem active={activeView === 'home'} icon="home" label="Home" onClick={() => setActiveView('home')} />
            <LeftNavItem active={activeView === 'profile' && !selectedProfile} icon="profile" label="Profile" onClick={handleOpenOwnProfile} />
            <LeftNavItem active={activeView === 'search'} icon="search" label="Search" onClick={handleOpenSearch} />
            <LeftNavItem active={activeView === 'notifications'} badge={unreadCount} icon="notifications" label="Notifications" onClick={() => setActiveView('notifications')} />
          </nav>
        </aside>

        {centerView}

        <RightDashboard
          leaderboard={leaderboard}
          onOpenSearch={handleOpenSearch}
        />
      </div>
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
        commentBurstKeys={reactionBursts}
        commentDraft={commentDraft}
        comments={postComments}
        currentUser={profileUser}
        onClose={handleClosePost}
        onCommentDraftChange={setCommentDraft}
        onOpenGame={onOpenGame}
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
  )
}
