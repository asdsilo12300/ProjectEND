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
    if (response.status === 401 && token) {
      clearToken()
      window.dispatchEvent(new Event('plant-game:session-expired'))
    }

    const validationMessage = payload.errors ? Object.values(payload.errors).flat().join(' ') : null
    const error = new Error(validationMessage || payload.message || 'API request failed')
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload
}

export async function getShopItems() {
  return apiFetch('/shop/items')
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
  return apiFetch('/plants')
}

export async function getLearningContents() {
  return apiFetch('/contents')
}

export async function getLearningContent(slug) {
  return apiFetch(`/contents/${encodeURIComponent(slug)}`)
}

export async function getAdminDashboard(days = 7) {
  return apiFetch(`/admin/dashboard?days=${encodeURIComponent(days)}`)
}

export async function getAdminContents({ search = '', status = '' } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  const query = params.toString()
  return apiFetch(`/admin/contents${query ? `?${query}` : ''}`)
}

export async function saveAdminContent(content) {
  const hasId = Boolean(content.id)
  return apiFetch(hasId ? `/admin/contents/${content.id}` : '/admin/contents', {
    method: hasId ? 'PUT' : 'POST',
    body: JSON.stringify(content),
  })
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

export async function deleteAdminContent(contentId) {
  return apiFetch(`/admin/contents/${contentId}`, { method: 'DELETE' })
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

export async function getAdminResource(resource, { search = '', status = '', page = 1 } = {}) {
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set('search', search)
  if (status) params.set('status', status)
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

export async function register(username, email, password, passwordConfirmation) {
  const payload = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username,
      email,
      password,
      password_confirmation: passwordConfirmation,
    }),
  })

  setToken(payload.token)
  return payload
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

export async function requestPasswordResetOtp() {
  return apiFetch('/auth/password-reset/request', { method: 'POST' })
}

export async function verifyPasswordResetOtp(otp) {
  return apiFetch('/auth/password-reset/verify', {
    method: 'POST',
    body: JSON.stringify({ otp }),
  })
}

export async function completePasswordReset(resetToken, password, passwordConfirmation) {
  return apiFetch('/auth/password-reset/complete', {
    method: 'POST',
    body: JSON.stringify({
      reset_token: resetToken,
      password,
      password_confirmation: passwordConfirmation,
    }),
  })
}

export async function updateMe(profile) {
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

export async function getSimulators() {
  return apiFetch('/simulators')
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

export async function applySimulatorItem(simulatorId, itemKey, quantity = 1) {
  return apiFetch(`/simulators/${simulatorId}/use-item`, {
    method: 'POST',
    body: JSON.stringify({ item_key: itemKey, quantity }),
  })
}


