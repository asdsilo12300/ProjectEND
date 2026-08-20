import {
  getDemoApiToken,
  handleDemoApiRequest,
  isDemoApiSessionActive,
  recordDemoPublicResponse,
  updateDemoProfile,
} from '../demo/demoApiSession'

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '')
const API_BASE_URL = configuredApiBaseUrl || (import.meta.env.DEV ? 'http://localhost:8000/api' : '')

if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL is required for a production build.')
}

const API_ROOT_URL = API_BASE_URL.replace(/\/api$/, '')
const inflightGetRequests = new Map()
const responseCache = new Map()
let responseCacheGeneration = 0

function clearApiResponseCache() {
  responseCacheGeneration += 1
  inflightGetRequests.clear()
  responseCache.clear()
}

function notifyContentCatalogChanged() {
  clearApiResponseCache()
  window.dispatchEvent(new Event('plant-game:content-catalog-updated'))
}

export function getToken() {
  return getDemoApiToken() ?? window.localStorage.getItem('plant_game_token')
}

export function setToken(token) {
  clearApiResponseCache()

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
  const value = String(path).trim()
  const backendStoragePrefix = `${API_ROOT_URL}/storage/`

  if (value.startsWith('/storage/')) {
    return `${API_BASE_URL}/media/${value.slice('/storage/'.length)}`
  }
  if (value.startsWith(backendStoragePrefix)) {
    return `${API_BASE_URL}/media/${value.slice(backendStoragePrefix.length)}`
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const url = new URL(value)
      const storagePrefix = '/storage/'
      const mediaPrefix = '/api/media/'
      const isBackendOwnedHost = url.origin === API_ROOT_URL
        || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)

      // Older records contain absolute localhost storage URLs. Always route
      // backend-owned media through the current API host after deployment.
      if (isBackendOwnedHost && url.pathname.startsWith(storagePrefix)) {
        return `${API_BASE_URL}/media/${url.pathname.slice(storagePrefix.length)}`
      }
      if (isBackendOwnedHost && url.pathname.startsWith(mediaPrefix)) {
        return `${API_BASE_URL}/media/${url.pathname.slice(mediaPrefix.length)}`
      }
    } catch {
      return value
    }

    return value
  }
  return value
}

export function storageAsset(path) {
  if (!path) return null
  const cleanPath = String(path).replace(/^\/+/, '')
  const encodedPath = cleanPath.split('/').map(encodeURIComponent).join('/')
  return resolveAssetUrl(`/storage/${encodedPath}`)
}

export async function apiFetch(path, options = {}) {
  const { auth = true, cacheTtl = 0, ...fetchOptions } = options
  const token = getToken()
  const method = String(fetchOptions.method ?? 'GET').toUpperCase()

  if (isDemoApiSessionActive()) {
    const demoResponse = await handleDemoApiRequest(path, { ...fetchOptions, method })
    if (demoResponse.handled) return demoResponse.payload
  }

  const canShareRequest = method === 'GET' && !fetchOptions.signal
  const requestKey = canShareRequest ? `${auth ? token ?? 'guest' : 'public'}:${path}` : null
  const cached = requestKey ? responseCache.get(requestKey) : null
  const requestCacheGeneration = responseCacheGeneration

  if (cached && cached.expiresAt > Date.now()) {
    if (isDemoApiSessionActive()) {
      recordDemoPublicResponse(path, cached.payload)
    }
    return cached.payload
  }

  if (requestKey && inflightGetRequests.has(requestKey)) {
    return inflightGetRequests.get(requestKey)
  }

  const request = (async () => {
    const isMultipart = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers: {
        Accept: 'application/json',
        ...(!isMultipart ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(fetchOptions.headers ?? {}),
      },
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      if (response.status === 401 && token && getToken() === token) {
        clearToken()
        window.dispatchEvent(new Event('plant-game:session-expired'))
      }

      const validationMessage = payload.errors ? Object.values(payload.errors).flat().join(' ') : null
      const error = new Error(validationMessage || payload.message || 'API request failed')
      error.status = response.status
      error.payload = payload
      throw error
    }

    if (requestKey && cacheTtl > 0 && requestCacheGeneration === responseCacheGeneration) {
      responseCache.set(requestKey, { payload, expiresAt: Date.now() + cacheTtl })
    }

    if (isDemoApiSessionActive()) {
      recordDemoPublicResponse(path, payload)
    }

    return payload
  })()

  if (requestKey) {
    inflightGetRequests.set(requestKey, request)
    request.finally(() => {
      if (inflightGetRequests.get(requestKey) === request) {
        inflightGetRequests.delete(requestKey)
      }
    }).catch(() => {})
  }

  return request
}

export async function apiFetchBlob(path) {
  const token = getToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'image/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (!response.ok) throw new Error('Unable to load the protected attachment.')
  return response.blob()
}

export function createIssueReport(formData) {
  return apiFetch('/issue-reports', { method: 'POST', body: formData })
}

export function getIssueReports(page = 1) {
  return apiFetch(`/issue-reports?page=${page}`, { cache: 'no-store' })
}

export function getIssueReport(id) {
  return apiFetch(`/issue-reports/${id}`, { cache: 'no-store' })
}

export function getIssueAttachment(reportId, attachmentId) {
  return apiFetchBlob(`/issue-reports/${reportId}/attachments/${attachmentId}`)
}

export function getAdminIssueReports(filters = {}) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value != null)).toString()
  return apiFetch(`/admin/issue-reports${query ? `?${query}` : ''}`, { cache: 'no-store' })
}

export function getAdminIssueReportSummary() {
  return apiFetch('/admin/issue-reports/summary', { cache: 'no-store' })
}

export function getAdminIssueReport(id) {
  return apiFetch(`/admin/issue-reports/${id}`, { cache: 'no-store' })
}

export function markAdminIssueReportSeen(id) {
  return apiFetch(`/admin/issue-reports/${id}/seen`, { method: 'POST', body: '{}' })
}

export function updateAdminIssueReportStatus(id, payload) {
  return apiFetch(`/admin/issue-reports/${id}/status`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export async function getShopItems() {
  return apiFetch('/shop/items', { auth: false, cacheTtl: 15000 })
}

export async function getInventory() {
  return apiFetch('/inventory')
}

export async function buyShopItem(shopItemId, quantity = 1) {
  return apiFetch(`/shop/items/${shopItemId}/buy`, {
    method: 'POST',
    body: JSON.stringify({ quantity }),
  })
}
export async function getPlants() {
  return apiFetch('/plants', { auth: false, cacheTtl: 15000 })
}

export async function getLearningContents() {
  return apiFetch('/contents', { auth: false, cacheTtl: 30000, cache: 'no-store' })
}

export async function getLearningContent(slug) {
  return apiFetch(`/contents/${encodeURIComponent(slug)}`, { auth: false, cacheTtl: 30000, cache: 'no-store' })
}

export async function getAdminDashboard(selection = 7) {
  const params = new URLSearchParams()
  if (typeof selection === 'number') {
    params.set('days', String(selection))
  } else {
    params.set('period', selection?.period || 'month')
    params.set('value', selection?.value || '')
  }
  return apiFetch(`/admin/dashboard?${params.toString()}`)
}

export async function getAdminContents({ search = '', status = '', trashed = '' } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  if (trashed) params.set('trashed', trashed)
  const query = params.toString()
  return apiFetch(`/admin/contents${query ? `?${query}` : ''}`)
}

export async function getAdminContent(contentId) {
  return apiFetch(`/admin/contents/${contentId}`)
}

export async function saveAdminContent(content) {
  const hasId = Boolean(content.id)
  const payload = await apiFetch(hasId ? `/admin/contents/${content.id}` : '/admin/contents', {
    method: hasId ? 'PUT' : 'POST',
    body: JSON.stringify(content),
  })
  notifyContentCatalogChanged()
  return payload
}

export async function uploadAdminContentImage(file, signal) {
  const token = getToken()
  const form = new FormData()
  form.append('upload', file)
  const response = await fetch(`${API_BASE_URL}/admin/contents/images`, {
    method: 'POST',
    signal,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const validationMessage = payload.errors ? Object.values(payload.errors).flat().join(' ') : null
    throw new Error(validationMessage || payload.message || 'Unable to upload this image.')
  }

  return { ...payload, url: resolveAssetUrl(payload.url) }
}

export async function uploadAdminImage({ file, scope }, signal) {
  const token = getToken()
  const form = new FormData()
  form.append('scope', scope)
  form.append('upload', file)

  const response = await fetch(`${API_BASE_URL}/admin/media/images`, {
    method: 'POST',
    signal,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const validationMessage = payload.errors ? Object.values(payload.errors).flat().join(' ') : null
    throw new Error(validationMessage || payload.message || 'Unable to upload this image.')
  }

  return {
    ...payload.data,
    url: resolveAssetUrl(payload.data?.url ?? payload.data?.reference),
  }
}

export async function deleteAdminContent(contentId) {
  const payload = await apiFetch(`/admin/contents/${contentId}`, { method: 'DELETE' })
  notifyContentCatalogChanged()
  return payload
}

export async function restoreAdminContent(contentId) {
  const payload = await apiFetch(`/admin/contents/${contentId}/restore`, { method: 'POST' })
  notifyContentCatalogChanged()
  return payload
}

export async function getAdminUsers({ search = '', role = '', page = 1 } = {}) {
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set('search', search)
  if (role) params.set('role', role)
  return apiFetch(`/admin/users?${params.toString()}`)
}

export async function updateAdminUser(userId, updates) {
  return apiFetch(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export async function getAdminResourceLookups() {
  return apiFetch('/admin/resources/lookups')
}

export async function getAdminResource(resource, { search = '', status = '', trashed = '', page = 1 } = {}) {
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  if (trashed) params.set('trashed', trashed)
  return apiFetch(`/admin/resources/${encodeURIComponent(resource)}?${params.toString()}`)
}

export async function saveAdminResource(resource, record) {
  const hasId = Boolean(record.id)
  return apiFetch(`/admin/resources/${encodeURIComponent(resource)}${hasId ? `/${record.id}` : ''}`, {
    method: hasId ? 'PUT' : 'POST',
    body: JSON.stringify(record),
  })
}

export async function deleteAdminResource(resource, recordId) {
  return apiFetch(`/admin/resources/${encodeURIComponent(resource)}/${recordId}`, { method: 'DELETE' })
}

export async function restoreAdminResource(resource, recordId) {
  return apiFetch(`/admin/resources/${encodeURIComponent(resource)}/${recordId}/restore`, { method: 'POST' })
}

export async function uploadAdminModelBundle({ model, resources = [] }) {
  const token = getToken()
  const form = new FormData()
  form.append('model', model)

  resources.forEach((file) => {
    form.append('resources[]', file)
    const rawPath = String(file.webkitRelativePath || file.name || '').replaceAll('\\', '/')
    const segments = rawPath.split('/').filter(Boolean)
    if (file.webkitRelativePath && segments.length > 1) segments.shift()
    form.append('resource_paths[]', segments.join('/'))
  })

  const response = await fetch(`${API_BASE_URL}/admin/model-bundles`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const validationMessage = payload.errors ? Object.values(payload.errors).flat().join(' ') : null
    throw new Error(validationMessage || payload.message || 'Unable to upload this GLTF model package.')
  }

  return payload.data
}

export async function getModelAssets() {
  return apiFetch('/model-assets', { auth: false, cacheTtl: 15000 })
}

export async function getPlant(id) {
  return apiFetch(`/plants/${id}`)
}

export function loginWithGoogle() {
  return new Promise((resolve, reject) => {
    const popupWidth = 520
    const popupHeight = 680
    const popupLeft = Math.max(0, window.screenX + (window.outerWidth - popupWidth) / 2)
    const popupTop = Math.max(0, window.screenY + (window.outerHeight - popupHeight) / 2)
    const popup = window.open(
      `${API_BASE_URL}/auth/google/redirect`,
      'plant-growth-google-login',
      `popup=yes,width=${popupWidth},height=${popupHeight},left=${popupLeft},top=${popupTop}`,
    )

    if (!popup) {
      reject(new Error('Your browser blocked the Google sign-in window. Please allow popups and try again.'))
      return
    }

    const expectedOrigin = new URL(API_ROOT_URL, window.location.href).origin
    let settled = false
    let closedTimer
    let timeoutTimer

    function cleanup() {
      window.removeEventListener('message', handleMessage)
      window.clearInterval(closedTimer)
      window.clearTimeout(timeoutTimer)
    }

    function finish(callback) {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }

    function handleMessage(event) {
      if (event.origin !== expectedOrigin || event.source !== popup || event.data?.type !== 'plant-growth-google-auth') return

      if (event.data.error) {
        finish(() => reject(new Error(event.data.error)))
        return
      }

      if (!event.data.token) {
        finish(() => reject(new Error('Google sign-in did not return a session. Please try again.')))
        return
      }

      setToken(event.data.token)
      finish(() => resolve(event.data))
    }

    window.addEventListener('message', handleMessage)
    popup.focus()

    closedTimer = window.setInterval(() => {
      if (popup.closed) {
        finish(() => reject(new Error('Google sign-in was closed before it finished.')))
      }
    }, 400)

    timeoutTimer = window.setTimeout(() => {
      popup.close()
      finish(() => reject(new Error('Google sign-in took too long. Please try again.')))
    }, 120000)
  })
}

export async function getMe() {
  return apiFetch('/me')
}

export async function updateOnboardingProgress(page, version, state) {
  return apiFetch('/me/onboarding', {
    method: 'PATCH',
    body: JSON.stringify({ page, version, state }),
  })
}

export async function updateMe(profile) {
  if (isDemoApiSessionActive()) {
    return updateDemoProfile(profile)
  }

  const token = getToken()
  const form = new FormData()
  form.append('username', profile.username ?? '')
  form.append('bio', profile.bio ?? '')

  if (profile.avatar instanceof File) {
    form.append('avatar', profile.avatar)
  }

  if (profile.cover instanceof File) {
    form.append('cover', profile.cover)
  }

  const response = await fetch(`${API_BASE_URL}/me/profile`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const validationMessage = payload.errors ? Object.values(payload.errors).flat().join(' ') : null
    throw new Error(validationMessage || payload.message || 'Could not update profile')
  }

  return payload
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

export async function deleteFriend(friendshipId) {
  return apiFetch(`/friends/${friendshipId}`, {
    method: 'DELETE',
  })
}

export async function getFriendLatestSimulator(friendshipId) {
  return apiFetch(`/friends/${friendshipId}/simulator/latest`)
}
export async function getLatestSimulator() {
  return apiFetch('/simulators/latest')
}

export async function getSimulators({ status = '' } = {}) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiFetch(`/simulators${query}`)
}

export async function getPlantHistories(query = '') {
  const suffix = query ? `?q=${encodeURIComponent(query)}` : ''
  return apiFetch(`/plant-histories${suffix}`)
}

export async function getPosts() {
  return apiFetch('/posts')
}

export async function getFriendPosts() {
  return apiFetch('/posts/friends')
}

export async function getCommunityLeaderboard() {
  return apiFetch('/community/leaderboard')
}

export async function getCommunityInsights(days = 30) {
  return apiFetch(`/community/insights?days=${encodeURIComponent(days)}`)
}

export async function getPostComments(postId) {
  return apiFetch(`/posts/${postId}/comments`)
}

export async function createPostComment(postId, commentText) {
  return apiFetch(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ comment_text: commentText }),
  })
}

export async function createPostCommentReply(postId, commentId, commentText) {
  return apiFetch(`/posts/${postId}/comments/${commentId}/replies`, {
    method: 'POST',
    body: JSON.stringify({ comment_text: commentText }),
  })
}

export async function likePostComment(postId, commentId) {
  return apiFetch(`/posts/${postId}/comments/${commentId}/likes`, {
    method: 'POST',
  })
}

export async function unlikePostComment(postId, commentId) {
  return apiFetch(`/posts/${postId}/comments/${commentId}/likes`, {
    method: 'DELETE',
  })
}

export async function likePost(postId) {
  return apiFetch(`/posts/${postId}/likes`, {
    method: 'POST',
  })
}

export async function unlikePost(postId) {
  return apiFetch(`/posts/${postId}/likes`, {
    method: 'DELETE',
  })
}

export async function savePlantHistory(simulatorId, options = {}) {
  return apiFetch(`/simulators/${simulatorId}/histories`, {
    method: 'POST',
    body: JSON.stringify(options),
  })
}
export async function deletePlantHistory(historyId) {
  return apiFetch(`/plant-histories/${historyId}`, {
    method: 'DELETE',
  })
}
export async function updatePlantHistoryVisibility(historyId, visibility) {
  return apiFetch(`/plant-histories/${historyId}/visibility`, {
    method: 'POST',
    body: JSON.stringify({ visibility }),
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
export async function uprootSimulator(simulatorId) {
  return apiFetch(`/simulators/${simulatorId}/uproot`, {
    method: 'POST',
  })
}

export async function shareSimulator(simulatorId, visibility = 'public', caption = '', snapshotImageData = null) {
  return apiFetch(`/simulators/${simulatorId}/share`, {
    method: 'POST',
    body: JSON.stringify({ visibility, caption: caption || undefined, snapshot_image_data: snapshotImageData || undefined }),
  })
}

export async function getSpectatorSimulator(simulatorId) {
  return apiFetch(`/spectator/simulators/${simulatorId}`)
}

export async function getNotifications() {
  return apiFetch('/notifications')
}

export async function markNotificationRead(notificationId) {
  return apiFetch(`/notifications/${notificationId}/read`, {
    method: 'POST',
  })
}
export async function claimMaturityReward(simulatorId) {
  return apiFetch(`/simulators/${simulatorId}/claim-maturity-reward`, {
    method: 'POST',
  })
}

export async function applySimulatorItem(simulatorId, itemKey, quantity = 1, itemId = null) {
  return apiFetch(`/simulators/${simulatorId}/use-item`, {
    method: 'POST',
    body: JSON.stringify({ item_id: itemId || undefined, item_key: itemKey, quantity }),
  })
}

export async function applySimulationAction(simulatorId, action) {
  return apiFetch(`/simulators/${simulatorId}/actions`, {
    method: 'POST',
    body: JSON.stringify(action),
  })
}

export async function updateSimulatorLocation(simulatorId, location) {
  return apiFetch(`/simulators/${simulatorId}/location`, {
    method: 'POST',
    body: JSON.stringify(location),
  })
}

export async function searchLocations(query) {
  return apiFetch(`/locations/search?q=${encodeURIComponent(query)}`)
}

export async function reverseLocation(latitude, longitude) {
  return apiFetch(`/locations/reverse?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`)
}

export async function getLocationWeatherPreview(latitude, longitude) {
  return apiFetch(`/locations/weather-preview?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`)
}

export async function getSeasonalLocationPreview(latitude, longitude, month, plantId = null) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    month: String(month),
  })
  if (plantId != null) params.set('plant_id', String(plantId))
  return apiFetch(`/locations/seasonal-preview?${params.toString()}`)
}

export async function getSeasonalContext(simulatorId) {
  return apiFetch(`/simulators/${simulatorId}/seasonal-context`)
}

export async function getSimulatorEvents(simulatorId) {
  return apiFetch(`/simulators/${simulatorId}/events`)
}

export async function getAdminEventDefinitions(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null))
  return apiFetch(`/admin/event-definitions${query.size ? `?${query}` : ''}`)
}

export async function createAdminEventDefinition(data) {
  return apiFetch('/admin/event-definitions', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateAdminEventDefinition(id, data) {
  return apiFetch(`/admin/event-definitions/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteAdminEventDefinition(id) {
  return apiFetch(`/admin/event-definitions/${id}`, { method: 'DELETE' })
}

export async function restoreAdminEventDefinition(id) {
  return apiFetch(`/admin/event-definitions/${id}/restore`, { method: 'POST' })
}

export async function prankFriendSimulator(simulatorId, itemKey) {
  return apiFetch(`/simulators/${simulatorId}/prank`, {
    method: 'POST',
    body: JSON.stringify({ item_key: itemKey }),
  })
}


