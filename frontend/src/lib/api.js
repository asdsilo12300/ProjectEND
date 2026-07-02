const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const API_ROOT_URL = API_BASE_URL.replace(/\/api\/?$/, '')

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
  if (path.startsWith('/storage/')) return `${API_ROOT_URL}${path}`
  return path
}

export function storageAsset(path) {
  if (!path) return null
  const cleanPath = String(path).replace(/^\/+/, '')
  const encodedPath = cleanPath.split('/').map(encodeURIComponent).join('/')
  return resolveAssetUrl(`/storage/${encodedPath}`)
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

export async function getModelAssets() {
  return apiFetch('/model-assets')
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

export async function getFriendLatestSimulator(friendshipId) {
  return apiFetch(`/friends/${friendshipId}/simulator/latest`)
}
export async function getLatestSimulator() {
  return apiFetch('/simulators/latest')
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
export async function syncSimulatorSnapshot(simulatorId, snapshot, options = {}) {
  return apiFetch(`/simulators/${simulatorId}/sync`, {
    method: 'POST',
    body: JSON.stringify(snapshot),
    keepalive: options.keepalive ?? false,
  })
}

export async function getSimulatorComments(simulatorId) {
  return apiFetch(`/simulators/${simulatorId}/comments`)
}

export async function createSimulatorComment(simulatorId, commentText) {
  return apiFetch(`/simulators/${simulatorId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment_text: commentText }),
  })
}
export async function finishSimulator(simulatorId) {
  return apiFetch(`/simulators/${simulatorId}/finish`, {
    method: 'POST',
  })
}
export async function claimMaturityReward(simulatorId) {
  return apiFetch(`/simulators/${simulatorId}/claim-maturity-reward`, {
    method: 'POST',
  })
}

export async function applySimulatorItem(simulatorId, itemKey, quantity = 1) {
  return apiFetch(`/simulators/${simulatorId}/use-item`, {
    method: 'POST',
    body: JSON.stringify({ item_key: itemKey, quantity }),
  })
}

