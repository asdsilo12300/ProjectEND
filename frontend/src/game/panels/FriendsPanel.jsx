import { useEffect, useMemo, useState } from 'react'
import { Panel } from '../components/Panel'
import { AppIcon } from '../icons/IconifyIcon'
import { acceptFriend, deleteFriend, getFriends, getToken, inviteFriend, searchUsers } from '../../lib/api'

function avatarLabel(user) {
  return (user?.username ?? user?.email ?? '?').slice(0, 1).toUpperCase()
}

function displayName(user) {
  return user?.username ?? user?.email?.split('@')[0] ?? 'Learner'
}

function FriendAvatar({ user, presence, request = false }) {
  return (
    <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#9bcf82] text-xs font-black text-[#101511]">
      {user?.avatar_url ? <img className="h-full w-full rounded-full object-cover" src={user.avatar_url} alt="" /> : avatarLabel(user)}
      <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-[#101511] ${request ? 'bg-red-400' : presence === 'online' ? 'bg-[#9bcf82]' : 'bg-red-400'}`} />
    </span>
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
  const listTitle = useMemo(() => `${visibleFriends.length} classmates`, [visibleFriends.length])
  const activeNow = useMemo(() => visibleFriends.filter((friend) => friend.presence === 'online').length, [visibleFriends])

  useEffect(() => {
    if (!isLoggedIn) {
      return undefined
    }

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

  function openInvite() {
    if (!isLoggedIn) {
      onAuthRequired?.('login')
      return
    }

    setMode('invite')
    setError('')
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
      setMode('list')
    } catch (acceptError) {
      setError(acceptError.message || 'Accept failed')
    } finally {
      setAcceptId(null)
    }
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

  const requestButton = isLoggedIn ? (
    <button
      type="button"
      className={`relative grid h-6 w-6 place-items-center rounded-md border border-lime-100/15 text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-200 ${mode === 'requests' ? 'bg-[#9bcf82]/18 text-lime-100' : 'bg-white/5'}`}
      aria-label={`${requests.length} friend requests`}
      onClick={() => setMode((value) => (value === 'requests' ? 'list' : 'requests'))}
    >
      <AppIcon className="h-4 w-4" name="groups" />
      {requests.length > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-400 px-1 text-[9px] font-black leading-none text-[#101511]">
          {requests.length}
        </span>
      )}
    </button>
  ) : null

  return (
    <Panel
      id="friends"
      title={mode === 'requests' ? 'Requests' : mode === 'online' ? 'Online' : 'Friends'}
      subtitle={mode === 'invite' ? 'invite classmates' : 'lab partners'}
      windows={windows}
      setWindows={setWindows}
      className="w-[330px]"
      headerActions={requestButton}
    >
      <div className="mb-1.5 flex items-center justify-between rounded-md border border-lime-100/10 bg-white/[0.045] px-2.5 py-1.5">
        <div>
          <strong className="block text-xs text-lime-50">{mode === 'invite' ? 'Find classmates' : listTitle}</strong>
          <span className="text-[10px] text-slate-400">{mode === 'invite' ? 'search by name or email' : `${activeNow} active now`}</span>
        </div>
        <button
          className="inline-flex items-center gap-1 rounded-md bg-[#9bcf82] px-2 py-1 text-[11px] font-semibold text-[#101511] transition hover:bg-[#addf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
          type="button"
          onClick={mode === 'invite' || mode === 'requests' ? () => setMode('list') : openInvite}
        >
          <AppIcon className="h-3.5 w-3.5" name={mode === 'invite' || mode === 'requests' ? 'arrowForward' : 'plus'} />
          {mode === 'invite' || mode === 'requests' ? 'Back' : 'Invite'}
        </button>
      </div>

      {!isLoggedIn ? (
        <div className="rounded-md border border-lime-100/10 bg-[#0b0f0c]/70 p-3">
          <p className="text-sm font-semibold text-lime-50">Login to see real friends</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">Friend data is loaded from your account database.</p>
          <button
            className="mt-3 w-full rounded-md bg-[#9bcf82] px-3 py-2 text-xs font-bold text-[#101511] transition hover:bg-[#addf96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
            type="button"
            onClick={() => onAuthRequired?.('login')}
          >
            Login or sign up
          </button>
        </div>
      ) : mode === 'invite' ? (
        <div className="min-h-[262px] space-y-2">
          <form className="flex gap-2" onSubmit={search}>
            <label className="sr-only" htmlFor="friend-search">Search by name</label>
            <input
              id="friend-search"
              className="min-w-0 flex-1 rounded-md border border-lime-100/15 bg-[#0b0f0c]/80 px-2.5 py-1.5 text-sm text-lime-50 outline-none transition placeholder:text-slate-400 focus:border-[#9bcf82]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or email"
              type="search"
            />
            <button
              className="grid h-8 w-9 place-items-center rounded-md bg-[#9bcf82] text-[#101511] transition hover:bg-[#addf96] disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={status === 'searching'}
              aria-label="Search users"
            >
              <AppIcon className="h-4.5 w-4.5" name="search" />
            </button>
          </form>

          {error && <p className="rounded-md border border-red-300/20 bg-red-400/10 px-3 py-2 text-[11px] text-red-100">{error}</p>}

          <ul className="min-h-48 max-h-48 space-y-1 overflow-y-auto pr-1" role="list" aria-label="Search results">
            {results.map((result) => {
              const connected = result.friendship_status === 'connected'
              const busy = inviteId === result.id

              return (
                <li key={result.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition hover:bg-white/[0.06]">
                  <FriendAvatar user={result} presence={result.presence} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs text-lime-50">{displayName(result)}</strong>
                    <span className="block truncate text-[11px] text-slate-400">{result.email}</span>
                  </span>
                  <button
                    className="rounded-md border border-lime-100/10 bg-white/[0.055] px-2.5 py-1.5 text-[11px] font-semibold text-lime-100 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-55"
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

          {status !== 'searching' && query.trim() && results.length === 0 && !error && (
            <p className="rounded-md border border-lime-100/10 bg-[#0b0f0c]/60 px-3 py-3 text-center text-xs text-slate-400">No learners found</p>
          )}
        </div>
      ) : (
        <div className="min-h-[262px] space-y-2">
          <form className="flex items-center gap-2 border-b border-lime-100/10 pb-1" onSubmit={(event) => event.preventDefault()}>
            <label className="sr-only" htmlFor="friend-filter">Search friends</label>
            <input
              id="friend-filter"
              className="min-w-0 flex-1 bg-transparent px-1 py-0 text-sm text-lime-50 outline-none placeholder:text-slate-400"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              type="search"
            />
            <AppIcon className="h-4 w-4 text-slate-400" name="search" />
          </form>

          <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="Friend filters">
            {[
              { id: 'list', label: 'Friends', icon: 'person', count: visibleFriends.length },
              { id: 'requests', label: 'Requests', icon: 'groups', count: requests.length },
              { id: 'online', label: 'Online', icon: 'check', count: onlineFriends.length },
            ].map((tab) => {
              const active = mode === tab.id

              return (
                <button
                  key={tab.id}
                  className={`relative flex flex-col items-center gap-0.5 rounded-md border px-2 py-1 text-[10px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${active ? 'border-[#9bcf82]/35 bg-[#9bcf82]/16 text-lime-100' : 'border-lime-100/10 bg-white/[0.035] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200'}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(tab.id)}
                >
                  <span className={`grid h-5 w-5 place-items-center rounded-full ${active ? 'bg-[#9bcf82] text-[#101511]' : 'bg-slate-500/18 text-slate-300'}`}>
                    <AppIcon className="h-3 w-3" name={tab.icon} />
                  </span>
                  <span>{tab.label}</span>
                  {tab.id === 'requests' && tab.count > 0 && (
                    <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-400 px-1 text-[9px] font-black leading-none text-[#101511]">
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {error && <p className="mb-2 rounded-md border border-red-300/20 bg-red-400/10 px-3 py-2 text-[11px] text-red-100">{error}</p>}

          <ul className="min-h-48 max-h-48 overflow-y-auto pr-1" role="list" aria-label={mode === 'requests' ? 'Friend requests' : mode === 'online' ? 'Online friends' : 'Friend list'}>
            {currentRows.map((friend) => {
              const isRequest = mode === 'requests'
              const busy = acceptId === friend.id

              return (
                <li key={friend.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition hover:bg-white/[0.06]">
                  <FriendAvatar user={friend.user} presence={friend.presence} request={isRequest} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs text-lime-50">{displayName(friend.user)}</strong>
                    <span className="block truncate text-[11px] text-slate-400">@{friend.user?.username ?? 'learner'}</span>
                  </span>
                  {isRequest ? (
                    <button
                      className="rounded-md bg-[#9bcf82] px-2.5 py-1.5 text-[11px] font-bold text-[#101511] transition hover:bg-[#addf96] disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      disabled={busy}
                      onClick={() => accept(friend.id)}
                    >
                      {busy ? 'Accepting' : 'Accept'}
                    </button>
                  ) : friend.status === 'accepted' ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        className="rounded-md border border-lime-100/10 bg-white/[0.055] px-2.5 py-1.5 text-[11px] font-semibold text-lime-100 transition hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
                        type="button"
                        onClick={() => onViewFriend?.(friend)}
                      >
                        View
                      </button>
                      <button
                        className="grid h-8 w-8 place-items-center rounded-md border border-red-300/15 bg-red-400/10 text-red-100 transition hover:border-red-300/35 hover:bg-red-400/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-200"
                        type="button"
                        aria-label={`Remove ${displayName(friend.user)}`}
                        onClick={() => setRemoveCandidate(friend)}
                      >
                        <AppIcon className="h-4 w-4" name="delete" />
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-md bg-yellow-300/10 px-2.5 py-1.5 text-[11px] font-semibold text-yellow-100">Pending</span>
                  )}
                </li>
              )
            })}
          </ul>

          {status === 'loading' && <p className="rounded-md border border-lime-100/10 bg-[#0b0f0c]/60 px-3 py-3 text-center text-xs text-slate-400">Loading friends</p>}
          {status !== 'loading' && currentRows.length === 0 && !error && (
            <p className="rounded-md border border-lime-100/10 bg-[#0b0f0c]/60 px-3 py-3 text-center text-xs text-slate-400">
              {mode === 'requests' ? 'No friend requests right now.' : mode === 'online' ? 'No friends online right now.' : 'No friends yet. Invite a classmate to start.'}
            </p>
          )}
        </div>
      )}
      {removeCandidate && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/50 px-4 backdrop-blur-sm motion-safe:animate-[friendOverlayIn_160ms_ease-out]" role="presentation">
          <div
            className="w-full max-w-[310px] rounded-lg border border-red-200/15 bg-[#111712] p-4 shadow-[0_18px_42px_rgba(0,0,0,.46)] motion-safe:animate-[friendDialogIn_190ms_cubic-bezier(.16,1,.3,1)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-friend-title"
          >
            <div className="mb-3 flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-red-400/16 text-red-100">
                <AppIcon className="h-5 w-5" name="delete" />
              </span>
              <div className="min-w-0">
                <h3 id="remove-friend-title" className="text-sm font-black text-lime-50">Remove friend?</h3>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  {displayName(removeCandidate.user)} will be removed from your classmates list.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md border border-lime-100/10 bg-white/[0.045] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200"
                type="button"
                onClick={() => setRemoveCandidate(null)}
                disabled={removeId === removeCandidate.id}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-red-300 px-3 py-2 text-xs font-black text-[#170b0b] transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-100"
                type="button"
                onClick={removeFriend}
                disabled={removeId === removeCandidate.id}
              >
                {removeId === removeCandidate.id ? 'Removing' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}

