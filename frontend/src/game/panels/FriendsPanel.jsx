import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Panel } from '../components/Panel'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { AppIcon } from '../icons/FontAwesomeIcon'
import { acceptFriend, deleteFriend, getFriends, getToken, inviteFriend, resolveAssetUrl, searchUsers } from '../../lib/api'

function avatarLabel(user) {
  return (user?.username ?? user?.email ?? '?').slice(0, 1).toUpperCase()
}

function displayName(user) {
  return user?.username ?? user?.email?.split('@')[0] ?? 'Learner'
}

function FriendAvatar({ user, presence, status = 'accepted', size = 'md' }) {
  const isLarge = size === 'lg'
  const isPending = status === 'pending'
  const presenceLabel = isPending ? 'Invitation pending' : presence === 'online' ? 'Online now' : 'Offline'
  const dotClass = isPending
    ? 'bg-amber-300'
    : presence === 'online'
      ? 'bg-emerald-400'
      : 'bg-slate-500'

  return (
    <span className={`relative block shrink-0 ${isLarge ? 'h-10 w-10' : 'h-9 w-9'}`}>
      <span className={`relative grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#9bcf82] font-black text-[#101511] ring-1 ring-lime-100/15 ${isLarge ? 'text-sm' : 'text-xs'}`}>
        <span className="grid h-full w-full place-items-center">{avatarLabel(user)}</span>
        {user?.avatar_url && (
          <img
            className="absolute inset-0 block h-full w-full rounded-full object-cover object-center"
            src={resolveAssetUrl(user.avatar_url)}
            alt=""
            onError={(event) => { event.currentTarget.hidden = true }}
          />
        )}
      </span>
      <span
        className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#111712] ${dotClass}`}
        aria-label={presenceLabel}
        role="img"
        title={presenceLabel}
      />
    </span>
  )
}

function SearchField({ id, label, onChange, placeholder, value }) {
  return (
    <div className="relative">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <AppIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" name="search" />
      <input
        id={id}
        className="h-9 w-full rounded-lg border border-lime-100/12 bg-[#0b0f0c]/72 py-2 pl-9 pr-9 text-xs text-lime-50 outline-none transition placeholder:text-slate-500 hover:border-lime-100/20 focus:border-[#9bcf82]/70 focus:ring-2 focus:ring-[#9bcf82]/10"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
      />
      {value && (
        <button
          className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition hover:bg-white/[0.07] hover:text-lime-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          <AppIcon className="h-3 w-3" name="close" />
        </button>
      )}
    </div>
  )
}

export function FriendsPanel({ windows, setWindows, user, onAuthRequired, onViewFriend }) {
  const [mode, setMode] = useState('list')
  const [friends, setFriends] = useState([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [inviteId, setInviteId] = useState(null)
  const [acceptId, setAcceptId] = useState(null)
  const [manageFriendId, setManageFriendId] = useState(null)
  const [removeCandidate, setRemoveCandidate] = useState(null)
  const [removeId, setRemoveId] = useState(null)

  const isLoggedIn = Boolean(user && getToken())
  const requests = useMemo(() => friends.filter((friend) => friend.status === 'pending' && friend.direction === 'incoming'), [friends])
  const visibleFriends = useMemo(() => friends.filter((friend) => friend.status === 'accepted'), [friends])
  const pendingOutgoing = useMemo(() => friends.filter((friend) => friend.status === 'pending' && friend.direction === 'outgoing'), [friends])
  const onlineFriends = useMemo(() => visibleFriends.filter((friend) => friend.presence === 'online'), [visibleFriends])
  const currentRows = useMemo(() => {
    const source = mode === 'online' ? onlineFriends : mode === 'requests' ? requests : [...visibleFriends, ...pendingOutgoing]
    const term = query.trim().toLowerCase()

    if (!term || mode === 'invite') return source

    return source.filter((friend) => {
      const name = displayName(friend.user).toLowerCase()
      const handle = String(friend.user?.username ?? '').toLowerCase()
      const email = String(friend.user?.email ?? '').toLowerCase()
      return name.includes(term) || handle.includes(term) || email.includes(term)
    })
  }, [mode, onlineFriends, pendingOutgoing, query, requests, visibleFriends])

  useEffect(() => {
    if (!isLoggedIn) return undefined

    let cancelled = false

    async function loadFriends() {
      setStatus('loading')
      setError('')

      try {
        const payload = await getFriends()
        if (cancelled) return
        setFriends(payload.data ?? [])
        setStatus('idle')
      } catch (loadError) {
        if (cancelled) return
        setError(loadError.message || 'Unable to load friends')
        setStatus('idle')
      }
    }

    loadFriends()

    return () => {
      cancelled = true
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (!removeCandidate) return undefined

    function closeOnEscape(event) {
      if (event.key === 'Escape' && removeId === null) setRemoveCandidate(null)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [removeCandidate, removeId])

  function changeMode(nextMode) {
    setMode(nextMode)
    setQuery('')
    setError('')
    setManageFriendId(null)
  }

  function changeQuery(nextQuery) {
    setQuery(nextQuery)
    setManageFriendId(null)
  }

  function openInvite() {
    if (!isLoggedIn) {
      onAuthRequired?.('login')
      return
    }

    changeMode('invite')
    setResults([])
  }

  async function search(event) {
    event.preventDefault()
    const nextQuery = query.trim()

    if (!nextQuery) {
      setResults([])
      return
    }

    setStatus('searching')
    setError('')

    try {
      const payload = await searchUsers(nextQuery)
      setResults(payload.data ?? [])
    } catch (searchError) {
      setError(searchError.message || 'Search failed')
    } finally {
      setStatus('idle')
    }
  }

  async function invite(userId) {
    setInviteId(userId)
    setError('')

    try {
      await inviteFriend(userId)
      const [friendsPayload, searchPayload] = await Promise.all([
        getFriends(),
        query.trim() ? searchUsers(query.trim()) : Promise.resolve({ data: [] }),
      ])
      setFriends(friendsPayload.data ?? [])
      setResults(searchPayload.data ?? [])
    } catch (inviteError) {
      setError(inviteError.message || 'Invite failed')
    } finally {
      setInviteId(null)
    }
  }

  async function accept(friendshipId) {
    setAcceptId(friendshipId)
    setError('')

    try {
      await acceptFriend(friendshipId)
      const payload = await getFriends()
      setFriends(payload.data ?? [])
      changeMode('list')
    } catch (acceptError) {
      setError(acceptError.message || 'Accept failed')
    } finally {
      setAcceptId(null)
    }
  }

  function confirmRemoval(friend) {
    setManageFriendId(null)
    setRemoveCandidate(friend)
  }

  async function removeFriend() {
    if (!removeCandidate) return

    setRemoveId(removeCandidate.id)
    setError('')

    try {
      await deleteFriend(removeCandidate.id)
      setFriends((value) => value.filter((friend) => friend.id !== removeCandidate.id))
      setRemoveCandidate(null)
    } catch (removeError) {
      setError(removeError.message || 'Remove friend failed')
    } finally {
      setRemoveId(null)
    }
  }

  const removalType = removeCandidate?.status === 'pending'
    ? removeCandidate.direction === 'incoming' ? 'decline' : 'cancel'
    : 'remove'
  const removalTitle = removalType === 'decline'
    ? 'Decline friend request?'
    : removalType === 'cancel'
      ? 'Cancel invitation?'
      : 'Remove friend?'
  const removalDescription = removalType === 'decline'
    ? `The request from ${displayName(removeCandidate?.user)} will be declined.`
    : removalType === 'cancel'
      ? `Your invitation to ${displayName(removeCandidate?.user)} will be cancelled.`
      : `${displayName(removeCandidate?.user)} will be removed from your friends list.`
  const removalAction = removalType === 'decline' ? 'Decline' : removalType === 'cancel' ? 'Cancel invitation' : 'Remove'

  const requestButton = isLoggedIn ? (
    <button
      type="button"
      className={`relative grid h-7 w-7 place-items-center rounded-md border border-lime-100/15 text-slate-200 transition hover:border-lime-100/25 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-200 ${mode === 'requests' ? 'bg-[#9bcf82]/18 text-lime-100' : 'bg-white/5'}`}
      aria-label={`${requests.length} friend ${requests.length === 1 ? 'request' : 'requests'}`}
      aria-pressed={mode === 'requests'}
      onClick={() => changeMode(mode === 'requests' ? 'list' : 'requests')}
    >
      <AppIcon className="h-3.5 w-3.5" name="groups" />
      {requests.length > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-400 px-1 text-[10px] font-black leading-none text-[#101511]">
          {requests.length > 9 ? '9+' : requests.length}
        </span>
      )}
    </button>
  ) : null

  return (
    <Panel
      id="friends"
      title={mode === 'requests' ? 'Requests' : mode === 'online' ? 'Online' : 'Friends'}
      subtitle={mode === 'invite' ? 'invite friends' : 'friend list'}
      windows={windows}
      setWindows={setWindows}
      className="w-[360px]"
      headerActions={requestButton}
    >
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-lime-100/10 bg-white/[0.045] p-2">
        <div className="grid min-w-0 flex-1 grid-cols-2 divide-x divide-lime-100/10">
          <div className="px-2">
            <strong className="block text-sm font-black text-lime-50">{visibleFriends.length}</strong>
            <span className="block truncate text-[11px] text-slate-400">Friends</span>
          </div>
          <div className="px-3">
            <strong className="block text-sm font-black text-emerald-300">{onlineFriends.length}</strong>
            <span className="block text-[11px] text-slate-400">Online</span>
          </div>
        </div>
        <button
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#9bcf82] px-3 text-xs font-bold text-[#101511] shadow-[0_6px_16px_rgba(112,166,88,.14)] transition hover:bg-[#addf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-200"
          type="button"
          onClick={mode === 'invite' ? () => changeMode('list') : openInvite}
        >
          <AppIcon className="h-3.5 w-3.5" name={mode === 'invite' ? 'arrowBack' : 'plus'} />
          {mode === 'invite' ? 'Back' : 'Invite friend'}
        </button>
      </div>

      {!isLoggedIn ? (
        <div className="rounded-lg border border-lime-100/10 bg-[#0b0f0c]/70 p-4 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#9bcf82]/14 text-lime-100">
            <AppIcon className="h-4.5 w-4.5" name="groups" />
          </span>
          <p className="mt-3 text-sm font-semibold text-lime-50">Login to see real friends</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Friend data is loaded from your account database.</p>
          <button
            className="mt-3 w-full rounded-lg bg-[#9bcf82] px-3 py-2 text-xs font-bold text-[#101511] transition hover:bg-[#addf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            type="button"
            onClick={() => onAuthRequired?.('login')}
          >
            Login or sign up
          </button>
        </div>
      ) : mode === 'invite' ? (
        <div className="space-y-2.5">
          <form className="flex gap-2" onSubmit={search}>
            <div className="min-w-0 flex-1">
              <SearchField
                id="friend-search"
                label="Search by name"
                value={query}
                onChange={changeQuery}
                placeholder="Search name or email"
              />
            </div>
            <button
              className="grid h-9 w-10 place-items-center rounded-lg bg-[#9bcf82] text-[#101511] transition hover:bg-[#addf96] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
              type="submit"
              disabled={status === 'searching' || !query.trim()}
              aria-label="Search users"
            >
              <AppIcon className="h-4 w-4" name="search" />
            </button>
          </form>

          {error && <p className="rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs text-red-100">{error}</p>}

          <div className="game-themed-scrollbar max-h-[190px] min-h-36 overflow-y-auto pr-1">
            {status === 'searching' ? (
              <LoadingSkeleton count={3} label="Searching users" variant="list" />
            ) : (
              <ul className="space-y-1" role="list" aria-label="Search results">
                {results.map((result) => {
                  const connected = result.friendship_status === 'connected'
                  const busy = inviteId === result.id

                  return (
                    <li key={result.id} className="flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 transition hover:border-lime-100/8 hover:bg-white/[0.05]">
                      <FriendAvatar user={result} presence={result.presence} status={connected ? 'accepted' : 'pending'} />
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-xs text-lime-50">{displayName(result)}</strong>
                        <span className="block truncate text-[11px] text-slate-400">@{result.username ?? result.email?.split('@')[0] ?? 'learner'}</span>
                      </span>
                      <button
                        className="rounded-lg border border-lime-100/12 bg-white/[0.055] px-3 py-2 text-xs font-semibold text-lime-100 transition hover:border-lime-100/25 hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-55"
                        type="button"
                        disabled={connected || busy}
                        onClick={() => invite(result.id)}
                      >
                        {connected ? 'Added' : busy ? 'Sending' : 'Invite'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {status !== 'searching' && query.trim() && results.length === 0 && !error && (
              <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-lime-100/12 bg-[#0b0f0c]/45 px-4 text-center">
                <div>
                  <AppIcon className="mx-auto h-5 w-5 text-slate-500" name="search" />
                  <p className="mt-2 text-xs font-semibold text-slate-300">No learners found</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">Try another username or email.</p>
                </div>
              </div>
            )}
            {status !== 'searching' && !query.trim() && results.length === 0 && (
              <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-lime-100/12 bg-[#0b0f0c]/45 px-4 text-center">
                <div>
                  <AppIcon className="mx-auto h-5 w-5 text-slate-500" name="person" />
                  <p className="mt-2 text-xs font-semibold text-slate-300">Find a friend</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">Search with a username or email address.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <SearchField
            id="friend-filter"
            label="Search friends"
            value={query}
            onChange={changeQuery}
            placeholder="Search friends"
          />

          <div className="grid grid-cols-3 gap-1 rounded-lg border border-lime-100/10 bg-[#0b0f0c]/55 p-1" role="tablist" aria-label="Friend filters">
            {[
              { id: 'list', label: 'Friends', icon: 'person' },
              { id: 'requests', label: 'Requests', icon: 'groups', count: requests.length },
              { id: 'online', label: 'Online', icon: 'check' },
            ].map((tab) => {
              const active = mode === tab.id

              return (
                <button
                  key={tab.id}
                  className={`relative flex h-9 min-w-0 items-center justify-center gap-1 rounded-md px-1 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${active ? 'bg-[#9bcf82]/18 text-lime-50 shadow-[inset_0_0_0_1px_rgba(155,207,130,.28)]' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => changeMode(tab.id)}
                >
                  <AppIcon className={`h-3.5 w-3.5 ${active ? 'text-[#aee094]' : ''}`} name={tab.icon} />
                  <span>{tab.label}</span>
                  {tab.id === 'requests' && tab.count > 0 && (
                    <span className="grid h-4 min-w-4 place-items-center rounded-full bg-red-400 px-1 text-[10px] font-black leading-none text-[#101511]">
                      {tab.count > 9 ? '9+' : tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {error && <p className="rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs text-red-100">{error}</p>}

          <div className="game-themed-scrollbar max-h-[190px] min-h-36 overflow-y-auto pr-1">
            {status === 'loading' ? (
              <LoadingSkeleton count={3} label="Loading friends" variant="list" />
            ) : (
              <ul className="space-y-1" role="list" aria-label={mode === 'requests' ? 'Friend requests' : mode === 'online' ? 'Online friends' : 'Friend list'}>
                {currentRows.map((friend) => {
                  const isIncomingRequest = mode === 'requests'
                  const isAccepted = friend.status === 'accepted'
                  const busy = acceptId === friend.id
                  const statusLabel = isIncomingRequest
                    ? 'Wants to connect'
                    : isAccepted
                      ? friend.presence === 'online' ? 'Online now' : 'Offline'
                      : 'Invitation sent'

                  return (
                    <li key={friend.id} className="rounded-lg border border-transparent px-2 py-2 transition hover:border-lime-100/8 hover:bg-white/[0.05]">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <FriendAvatar user={friend.user} presence={friend.presence} status={friend.status} size="lg" />
                        <button
                          className={`min-w-0 flex-1 text-left ${isAccepted ? 'cursor-pointer' : 'cursor-default'}`}
                          type="button"
                          disabled={!isAccepted}
                          title={isAccepted ? `View ${displayName(friend.user)}'s garden` : undefined}
                          onClick={() => {
                            if (!isAccepted) return
                            setManageFriendId(null)
                            onViewFriend?.(friend)
                          }}
                        >
                          <strong className="block truncate text-xs text-lime-50">{displayName(friend.user)}</strong>
                          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-slate-400">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isIncomingRequest || !isAccepted ? 'bg-amber-300' : friend.presence === 'online' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                            <span className="truncate">{statusLabel}</span>
                          </span>
                        </button>

                        {isIncomingRequest ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              className="rounded-lg bg-[#9bcf82] px-2.5 py-2 text-xs font-bold text-[#101511] transition hover:bg-[#addf96] disabled:cursor-not-allowed disabled:opacity-60"
                              type="button"
                              disabled={busy}
                              onClick={() => accept(friend.id)}
                            >
                              {busy ? 'Accepting' : 'Accept'}
                            </button>
                            <button
                              className="grid h-8 w-8 place-items-center rounded-lg border border-lime-100/10 text-slate-400 transition hover:border-red-300/25 hover:bg-red-400/10 hover:text-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-200"
                              type="button"
                              aria-label={`Decline request from ${displayName(friend.user)}`}
                              onClick={() => confirmRemoval(friend)}
                            >
                              <AppIcon className="h-3.5 w-3.5" name="close" />
                            </button>
                          </div>
                        ) : isAccepted ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-lime-100/12 bg-white/[0.055] px-2.5 text-xs font-semibold text-lime-100 transition hover:border-lime-100/25 hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
                              type="button"
                              onClick={() => {
                                setManageFriendId(null)
                                onViewFriend?.(friend)
                              }}
                            >
                              <AppIcon className="h-3 w-3" name="eye" />
                              Garden
                            </button>
                            <button
                              className={`grid h-8 w-8 place-items-center rounded-lg border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${manageFriendId === friend.id ? 'border-lime-100/25 bg-white/[0.1] text-lime-50' : 'border-lime-100/10 bg-white/[0.035] text-slate-400 hover:border-lime-100/20 hover:bg-white/[0.07] hover:text-slate-200'}`}
                              type="button"
                              aria-label={`Manage ${displayName(friend.user)}`}
                              aria-expanded={manageFriendId === friend.id}
                              aria-haspopup="menu"
                              onClick={() => setManageFriendId((value) => value === friend.id ? null : friend.id)}
                            >
                              <AppIcon className="h-3.5 w-3.5" name="more" />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="rounded-full border border-amber-200/12 bg-amber-300/8 px-2.5 py-1.5 text-[11px] font-semibold text-amber-100 transition hover:border-amber-200/22 hover:bg-amber-300/12"
                            type="button"
                            onClick={() => setManageFriendId((value) => value === friend.id ? null : friend.id)}
                            aria-expanded={manageFriendId === friend.id}
                          >
                            Sent
                          </button>
                        )}
                      </div>

                      {manageFriendId === friend.id && (
                        <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-lime-100/8 bg-black/20 px-2.5 py-2" role="menu">
                          <span className="text-[11px] text-slate-400">
                            {isAccepted ? 'Friend options' : 'Invitation pending'}
                          </span>
                          <button
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-red-200 transition hover:bg-red-400/10 hover:text-red-100"
                            type="button"
                            role="menuitem"
                            onClick={() => confirmRemoval(friend)}
                          >
                            <AppIcon className="h-3 w-3" name={isAccepted ? 'delete' : 'close'} />
                            {isAccepted ? 'Remove friend' : 'Cancel invitation'}
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {status !== 'loading' && currentRows.length === 0 && !error && (
              <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-lime-100/12 bg-[#0b0f0c]/45 px-5 text-center">
                <div>
                  <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white/[0.045] text-slate-500">
                    <AppIcon className="h-4 w-4" name={mode === 'online' ? 'person' : 'groups'} />
                  </span>
                  <p className="mt-2 text-xs font-semibold text-slate-300">
                    {query.trim() ? 'No matching friends.' : mode === 'requests' ? 'No friend requests right now.' : mode === 'online' ? 'No friends online right now.' : 'No friends yet.'}
                  </p>
                  {!query.trim() && mode === 'list' && (
                    <button
                      className="mt-2 text-[11px] font-semibold text-[#aee094] underline-offset-2 hover:underline"
                      type="button"
                      onClick={openInvite}
                    >
                      Invite a friend to get started
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {removeCandidate && createPortal((
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/55 px-4 backdrop-blur-sm motion-safe:animate-[friendOverlayIn_160ms_ease-out]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && removeId === null) setRemoveCandidate(null)
          }}
        >
          <div
            className="w-full max-w-[330px] rounded-xl border border-red-200/15 bg-[#111712] p-4 shadow-[0_18px_42px_rgba(0,0,0,.46)] motion-safe:animate-[friendDialogIn_190ms_cubic-bezier(.16,1,.3,1)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-friend-title"
          >
            <div className="mb-4 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-400/14 text-red-100">
                <AppIcon className="h-4.5 w-4.5" name={removalType === 'remove' ? 'delete' : 'groups'} />
              </span>
              <div className="min-w-0">
                <h3 id="remove-friend-title" className="text-sm font-black text-lime-50">{removalTitle}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-300">{removalDescription}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-lg border border-lime-100/10 bg-white/[0.045] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
                type="button"
                onClick={() => setRemoveCandidate(null)}
                disabled={removeId === removeCandidate.id}
              >
                Keep
              </button>
              <button
                className="rounded-lg bg-red-300 px-3 py-2 text-xs font-black text-[#170b0b] transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-100"
                type="button"
                onClick={removeFriend}
                disabled={removeId === removeCandidate.id}
              >
                {removeId === removeCandidate.id ? 'Please wait...' : removalAction}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </Panel>
  )
}
