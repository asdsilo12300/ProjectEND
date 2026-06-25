const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

export function getToken() {
  return window.localStorage.getItem('plant_game_token')
}

export function setToken(token) {
  if (token) {
    window.localStorage.setItem('plant_game_token', token)
  } else {
    window.localStorage.removeItem('plant_game_token')
  }
}

export function clearToken() {
  setToken(null)
}

export function resolveAssetUrl(path) {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/storage/')) return `${API_ORIGIN}${path}`
  return path
}

export async function apiFetch(path, options = {}) {
  const token = getToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const validationMessage = payload.errors ? Object.values(payload.errors).flat().join(' ') : null
    throw new Error(validationMessage || payload.message || 'API request failed')
  }

  return payload
}

export async function getPlants() {
  return apiFetch('/plants')
}

export async function getPlant(id) {
  return apiFetch(`/plants/${id}`)
}

export async function login(email, password) {
  const payload = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  setToken(payload.token)
  return payload
}

export async function register(username, email, password) {
  const payload = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  })

  setToken(payload.token)
  return payload
}

export async function getMe() {
  return apiFetch('/me')
}

export async function getFriends() {
  return apiFetch('/friends')
}

export async function searchUsers(query) {
  return apiFetch(`/users/search?q=${encodeURIComponent(query)}`)
}

export async function inviteFriend(userId) {
  return apiFetch('/friends/invite', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  })
}

export async function acceptFriend(friendshipId) {
  return apiFetch(`/friends/${friendshipId}/accept`, {
    method: 'POST',
  })
}

export async function startSimulator(plantId, mode = 'greenhouse', options = {}) {
  return apiFetch('/simulators', {
    method: 'POST',
    body: JSON.stringify({ plant_id: plantId, mode, ...options }),
  })
}

export async function tickSimulator(simulatorId, factors) {
  return apiFetch(`/simulators/${simulatorId}/tick`, {
    method: 'POST',
    body: JSON.stringify(factors),
  })
}
