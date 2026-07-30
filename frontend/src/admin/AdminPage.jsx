import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import plantGrowthLogo from '../assets/Logo for Plant Growth Academy Simulation Game-Photoroom.png'
import { AppIcon } from '../game/icons/FontAwesomeIcon'
import { loadSettings, saveSettings } from '../game/settings/settingsPreferences'
import { formatPlantDuration } from '../utils/plantDuration'
import { ImageUploadField } from './ImageUploadField'
import { ModelBundleField } from './ModelBundleField'
import {
  deleteAdminContent,
  deleteAdminResource,
  getAdminContent,
  getAdminContents,
  getAdminDashboard,
  getAdminResource,
  getAdminResourceLookups,
  getAdminUsers,
  restoreAdminContent,
  restoreAdminResource,
  saveAdminResource,
  saveAdminContent,
  resolveAssetUrl,
  updateAdminUser,
  uploadAdminContentImage,
  uploadAdminImage,
  uploadAdminModelBundle,
} from '../lib/api'
import './AdminPage.css'

const ContentRichEditor = lazy(() => import('./ContentRichEditor').then((module) => ({ default: module.ContentRichEditor })))
const ReactApexChart = lazy(() => import('react-apexcharts'))

const adminPreferenceKey = 'plant-growth-admin-preferences'
const ADMIN_DASHBOARD_REFRESH_MS = 15_000
const ADMIN_TABLE_REFRESH_MS = 10_000

function currentTrendValue(period, now = new Date()) {
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  if (period === 'day') return `${year}-${month}-${day}`
  if (period === 'year') return year
  return `${year}-${month}`
}

function defaultTrendSelection() {
  return { period: 'month', value: currentTrendValue('month') }
}

function adminAlertTheme() {
  const isLight = document.querySelector('.admin-shell')?.classList.contains('admin-theme--light')
  return {
    background: isLight ? '#ffffff' : '#151a17',
    color: isLight ? '#17231c' : '#edf4ef',
    customClass: {
      container: 'admin-swal-container',
      popup: 'admin-swal-popup',
      title: 'admin-swal-title',
      htmlContainer: 'admin-swal-text',
      actions: 'admin-swal-actions',
      confirmButton: 'admin-swal-confirm',
      cancelButton: 'admin-swal-cancel',
    },
  }
}

async function confirmAdminAction({ title, text, confirmButtonText, icon = 'warning' }) {
  const result = await Swal.fire({
    ...adminAlertTheme(),
    title,
    text,
    icon,
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: true,
    buttonsStyling: false,
    confirmButtonText,
    cancelButtonText: 'Cancel',
  })

  return result.isConfirmed
}

function showAdminSuccess(title, text = '') {
  return Swal.fire({
    ...adminAlertTheme(),
    title,
    text,
    icon: 'success',
    timer: 1400,
    timerProgressBar: true,
    showConfirmButton: false,
  })
}

function loadAdminPreferences() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(adminPreferenceKey) ?? '{}')
    return {
      theme: saved.theme === 'light' ? 'light' : 'dark',
      collapsed: Boolean(saved.collapsed),
      textSize: saved.textSize === 'large' ? 'large' : 'default',
    }
  } catch {
    return { theme: 'dark', collapsed: false, textSize: 'default' }
  }
}

function useModalLifecycle(onClose, dialogRef) {
  const closeRef = useRef(onClose)

  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousActiveElement = document.activeElement
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    const handleKeyDown = (event) => {
      if (document.querySelector('.swal2-container')) return
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current?.()
        return
      }
      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = [...dialog.querySelectorAll(focusableSelector)].filter((element) => !element.hidden && element.getClientRects().length)
      if (!focusable.length) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    const focusTimer = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current
      if (dialog && !dialog.contains(document.activeElement)) dialog.focus()
    })

    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      if (previousActiveElement?.isConnected) previousActiveElement.focus()
    }
  }, [dialogRef])
}

function dataSnapshot(value) {
  return JSON.stringify(value)
}

async function confirmDiscardChanges() {
  return confirmAdminAction({
    title: 'Discard unsaved changes?',
    text: 'The changes in this form have not been saved and will be lost.',
    confirmButtonText: 'Discard changes',
  })
}

function AdminAvatar({ user, className = '' }) {
  const avatarUrl = user?.avatar_url ? resolveAssetUrl(user.avatar_url) : ''
  const initial = user?.username?.trim()?.slice(0, 1)?.toUpperCase() || 'A'

  return (
    <span className={`admin-avatar ${avatarUrl ? 'has-image' : ''} ${className}`.trim()} aria-hidden="true">
      <b>{initial}</b>
      {avatarUrl && <img src={avatarUrl} alt="" onError={(event) => { event.currentTarget.hidden = true }} />}
    </span>
  )
}

function toDateTimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

const navigationGroups = [
  { label: 'CORE', items: [
    { id: 'dashboard', icon: 'home', label: 'Overview' },
    { id: 'contents', icon: 'bookmark', label: 'Learning content' },
    { id: 'users', icon: 'groups', label: 'Users & access' },
  ] },
  { label: 'GAME DATA', items: [
    { id: 'plants', icon: 'plant', label: 'Plants' },
    { id: 'pests', icon: 'pest', label: 'Pests & rules' },
    { id: 'store', icon: 'shop', label: 'Items & store' },
    { id: 'progression', icon: 'trophy', label: 'Progression' },
    { id: 'models', icon: 'hardware', label: 'Model assets' },
  ] },
  { label: 'MODERATION', items: [
    { id: 'community', icon: 'chat', label: 'Posts & comments' },
    { id: 'simulations', icon: 'controller', label: 'Simulation records' },
  ] },
  { label: 'AUDIT', items: [
    { id: 'activity', icon: 'history', label: 'Admin activity' },
  ] },
]

// Keep these sections available in the codebase while their admin tools are not ready to expose.
const hiddenAdminNavigationItems = new Set(['progression', 'models'])

const lookupLabel = {
  plants: (row) => row.name_en || row.name_th,
  stages: (row) => `${row.stage_no}. ${row.stage_name}`,
  pests: (row) => row.name_en || row.name_th,
  items: (row) => row.name,
}

const commonActiveField = { key: 'is_active', label: 'Active', type: 'boolean' }
const resourceGroups = {
  plants: [
    {
      id: 'plants', label: 'Plant catalog', createLabel: 'New plant', icon: 'plant',
      defaults: { name_th: '', name_en: '', description: '', base_image_url: '', base_model_url: '', real_maturity_days: 90, growth_reference_url: '', water_min: 40, water_max: 80, light_min: 40, light_max: 90, fertilizer_min: 20, fertilizer_max: 70, soil_humidity_min: 40, soil_humidity_max: 80, air_humidity_min: 40, air_humidity_max: 80, soil_temp_min: 18, soil_temp_max: 32, air_temp_min: 18, air_temp_max: 35 },
      fields: [
        { key: 'name_en', label: 'English name', required: true }, { key: 'name_th', label: 'Thai name', required: true },
        { key: 'description', label: 'Description', type: 'textarea', wide: true }, { key: 'base_image_url', label: 'Plant image', type: 'image-upload', scope: 'plants', wide: true }, { key: 'base_model_url', label: 'Base 3D model package', type: 'model-bundle', required: true, wide: true },
        { key: 'real_maturity_days', label: 'Real-life maturity (days)', type: 'number', required: true }, { key: 'growth_reference_url', label: 'Growth reference URL', type: 'url', wide: true },
        ...['water', 'light', 'fertilizer', 'soil_humidity', 'air_humidity', 'soil_temp', 'air_temp'].flatMap((factor) => [
          { key: `${factor}_min`, label: `${factor.replaceAll('_', ' ')} min`, type: 'number', required: true },
          { key: `${factor}_max`, label: `${factor.replaceAll('_', ' ')} max`, type: 'number', required: true },
        ]),
      ],
      columns: [
        { label: 'Plant', render: (row) => row.name_en || row.name_th },
        { label: 'Thai name', render: (row) => row.name_th },
        { label: 'Water / light', render: (row) => `${row.water_min}–${row.water_max} / ${row.light_min}–${row.light_max}` },
        { label: 'Real maturity', render: (row) => `~${row.real_maturity_days ?? 90} days` },
        { label: 'Subtables', render: (row) => `${row.stages_count} stages · ${row.condition_rules_count} rules · ${row.visual_variants_count} visuals` },
      ],
    },
    {
      id: 'plant-stages', label: 'Growth stages', createLabel: 'New stage', icon: 'sprout',
      defaults: { plant_id: '', stage_no: 1, stage_name: '', required_growth_point: 0, image_url: '', model_url: '', description: '' },
      fields: [{ key: 'plant_id', label: 'Plant', type: 'lookup', lookup: 'plants', required: true }, { key: 'stage_no', label: 'Stage number', type: 'number', required: true }, { key: 'stage_name', label: 'Stage name', required: true }, { key: 'required_growth_point', label: 'Required growth points', type: 'number', required: true }, { key: 'image_url', label: 'Stage image', type: 'image-upload', scope: 'plant-stages', wide: true }, { key: 'model_url', label: 'Stage 3D model package', type: 'model-bundle', wide: true }, { key: 'description', label: 'Description', type: 'textarea', wide: true }],
      columns: [{ label: 'Plant', render: (row) => row.plant?.name_en || row.plant?.name_th }, { label: 'Stage', render: (row) => `${row.stage_no}. ${row.stage_name}` }, { label: 'Growth points', render: (row) => row.required_growth_point }, { label: 'Model', render: (row) => row.model_url ? 'Configured' : 'Not set' }],
    },
    {
      id: 'plant-rules', label: 'Condition rules', createLabel: 'New rule', icon: 'settings',
      defaults: { plant_id: '', factor: 'water', operator: 'between', min_value: 0, max_value: 100, visual_state: 'healthy', severity: 1, health_delta: 0, growth_delta: 0, analysis_result: '', direction: '', is_active: true },
      fields: [{ key: 'plant_id', label: 'Plant', type: 'lookup', lookup: 'plants', required: true }, { key: 'factor', label: 'Factor', required: true }, { key: 'operator', label: 'Operator', type: 'select', options: ['below', 'above', 'between', 'outside'], required: true }, { key: 'min_value', label: 'Minimum', type: 'number' }, { key: 'max_value', label: 'Maximum', type: 'number' }, { key: 'visual_state', label: 'Visual state', required: true }, { key: 'severity', label: 'Severity', type: 'number', required: true }, { key: 'health_delta', label: 'Health change', type: 'number', required: true }, { key: 'growth_delta', label: 'Growth change', type: 'number', required: true }, { key: 'analysis_result', label: 'Analysis result', type: 'textarea', wide: true }, { key: 'direction', label: 'Player guidance', type: 'textarea', wide: true }, commonActiveField],
      columns: [{ label: 'Plant', render: (row) => row.plant?.name_en || row.plant?.name_th }, { label: 'Condition', render: (row) => `${row.factor} ${row.operator} ${row.min_value ?? ''}${row.max_value !== null ? `–${row.max_value}` : ''}` }, { label: 'Effect', render: (row) => `${row.health_delta} health / ${row.growth_delta} growth` }, { label: 'State', render: (row) => row.visual_state }],
    },
    {
      id: 'plant-variants', label: 'Visual variants', createLabel: 'New visual', icon: 'eye',
      defaults: { plant_id: '', stage_id: '', state_key: 'healthy', label: '', model_url: '', leaf_color: '#6fa84f', stem_color: '#5c8f42', leaf_state: 'normal', stem_state: 'normal', scale: 1, priority: 0, is_active: true },
      fields: [{ key: 'plant_id', label: 'Plant', type: 'lookup', lookup: 'plants', required: true }, { key: 'stage_id', label: 'Growth stage', type: 'lookup', lookup: 'stages' }, { key: 'state_key', label: 'State key', required: true }, { key: 'label', label: 'Display label' }, { key: 'model_url', label: 'Variant 3D model package', type: 'model-bundle', wide: true }, { key: 'leaf_color', label: 'Leaf color' }, { key: 'stem_color', label: 'Stem color' }, { key: 'leaf_state', label: 'Leaf state' }, { key: 'stem_state', label: 'Stem state' }, { key: 'scale', label: 'Scale', type: 'number', step: '0.01', required: true }, { key: 'priority', label: 'Priority', type: 'number', required: true }, commonActiveField],
      columns: [{ label: 'Plant', render: (row) => row.plant?.name_en || row.plant?.name_th }, { label: 'State', render: (row) => row.label || row.state_key }, { label: 'Stage', render: (row) => row.stage?.stage_name || 'All stages' }, { label: 'Appearance', render: (row) => `${row.leaf_color || '—'} / ${row.stem_color || '—'}` }],
    },
  ],
  pests: [
    { id: 'pests', label: 'Pest catalog', createLabel: 'New pest', icon: 'pest', defaults: { name_th: '', name_en: '', description: '', image_url: '', model_url: '', base_chance: 0, damage_per_turn: 0, behavior: '' }, fields: [{ key: 'name_en', label: 'English name' }, { key: 'name_th', label: 'Thai name', required: true }, { key: 'description', label: 'Description', type: 'textarea', wide: true }, { key: 'image_url', label: 'Pest image', type: 'image-upload', scope: 'pests', wide: true }, { key: 'model_url', label: 'Pest 3D model package', type: 'model-bundle', wide: true }, { key: 'base_chance', label: 'Base chance (%)', type: 'number', step: '0.01', required: true }, { key: 'damage_per_turn', label: 'Damage per turn', type: 'number', required: true }, { key: 'behavior', label: 'Behavior notes', type: 'textarea', wide: true }], columns: [{ label: 'Pest', render: (row) => row.name_en || row.name_th }, { label: 'Thai name', render: (row) => row.name_th }, { label: 'Base chance', render: (row) => `${row.base_chance}%` }, { label: 'Rules / damage', render: (row) => `${row.condition_rules_count} rules · ${row.damage_per_turn} damage` }] },
    { id: 'pest-rules', label: 'Occurrence rules', createLabel: 'New pest rule', icon: 'bug', defaults: { pest_id: '', plant_id: '', factor: 'air_humidity', operator: 'above', min_value: 0, max_value: 100, chance_delta: 0, severity: 1, is_active: true }, fields: [{ key: 'pest_id', label: 'Pest', type: 'lookup', lookup: 'pests', required: true }, { key: 'plant_id', label: 'Specific plant (optional)', type: 'lookup', lookup: 'plants' }, { key: 'factor', label: 'Factor', required: true }, { key: 'operator', label: 'Operator', type: 'select', options: ['below', 'above', 'between', 'outside'], required: true }, { key: 'min_value', label: 'Minimum', type: 'number' }, { key: 'max_value', label: 'Maximum', type: 'number' }, { key: 'chance_delta', label: 'Chance change', type: 'number', step: '0.01', required: true }, { key: 'severity', label: 'Severity', type: 'number', required: true }, commonActiveField], columns: [{ label: 'Pest', render: (row) => row.pest?.name_en || row.pest?.name_th }, { label: 'Plant', render: (row) => row.plant?.name_en || row.plant?.name_th || 'All plants' }, { label: 'Condition', render: (row) => `${row.factor} ${row.operator} ${row.min_value ?? ''}${row.max_value !== null ? `–${row.max_value}` : ''}` }, { label: 'Chance / severity', render: (row) => `${row.chance_delta} / ${row.severity}` }] },
  ],
  store: [
    { id: 'items', label: 'Item catalog', createLabel: 'New item', icon: 'shop', defaults: { name: '', type: 'pesticide', description: '', image_url: '', effect_type: '', effect_value: 0, rarity: 'common', is_active: true }, fields: [{ key: 'name', label: 'Item name', required: true }, { key: 'type', label: 'Type', type: 'select', options: ['seed', 'water', 'fertilizer', 'pesticide', 'booster', 'cosmetic'], required: true }, { key: 'description', label: 'Description', type: 'textarea', wide: true }, { key: 'image_url', label: 'Item image', type: 'image-upload', scope: 'items', wide: true }, { key: 'effect_type', label: 'Effect type' }, { key: 'effect_value', label: 'Effect value', type: 'number', required: true }, { key: 'rarity', label: 'Rarity', type: 'select', options: ['common', 'rare', 'epic', 'legendary'], required: true }, commonActiveField], columns: [{ label: 'Item', render: (row) => row.name }, { label: 'Type', render: (row) => row.type }, { label: 'Effect', render: (row) => `${row.effect_type || '—'} ${row.effect_value}` }, { label: 'Rarity', render: (row) => row.rarity }] },
    { id: 'shop-items', label: 'Shop listings', createLabel: 'New listing', icon: 'shoppingCart', defaults: { item_id: '', price_coin: 0, price_gem: 0, stock_limit: '', is_active: true, starts_at: '', ends_at: '' }, fields: [{ key: 'item_id', label: 'Item', type: 'lookup', lookup: 'items', required: true }, { key: 'price_coin', label: 'Coin price', type: 'number', required: true }, { key: 'price_gem', label: 'Gem price', type: 'number', required: true }, { key: 'stock_limit', label: 'Stock limit', type: 'number' }, { key: 'starts_at', label: 'Starts at', type: 'datetime-local' }, { key: 'ends_at', label: 'Ends at', type: 'datetime-local' }, commonActiveField], columns: [{ label: 'Item', render: (row) => row.item?.name }, { label: 'Type', render: (row) => row.item?.type }, { label: 'Price', render: (row) => `${row.price_coin} coins / ${row.price_gem} gems` }, { label: 'Stock', render: (row) => row.stock_limit ?? 'Unlimited' }] },
  ],
  progression: [
    { id: 'quests', label: 'Quests', createLabel: 'New quest', icon: 'trophy', defaults: { title: '', description: '', quest_type: 'daily', target_type: '', target_value: 1, reward_exp: 0, reward_coin: 0, reward_gem: 0, is_active: true }, fields: [{ key: 'title', label: 'Quest title', required: true }, { key: 'quest_type', label: 'Quest type', type: 'select', options: ['daily', 'weekly', 'story', 'event'], required: true }, { key: 'description', label: 'Description', type: 'textarea', wide: true }, { key: 'target_type', label: 'Target type', required: true }, { key: 'target_value', label: 'Target value', type: 'number', required: true }, { key: 'reward_exp', label: 'EXP reward', type: 'number', required: true }, { key: 'reward_coin', label: 'Coin reward', type: 'number', required: true }, { key: 'reward_gem', label: 'Gem reward', type: 'number', required: true }, commonActiveField], columns: [{ label: 'Quest', render: (row) => row.title }, { label: 'Type', render: (row) => row.quest_type }, { label: 'Target', render: (row) => `${row.target_type} × ${row.target_value}` }, { label: 'Rewards', render: (row) => `${row.reward_exp} EXP · ${row.reward_coin} coins` }] },
    { id: 'achievements', label: 'Achievements', createLabel: 'New achievement', icon: 'crown', defaults: { title: '', description: '', condition_type: '', condition_value: 1, reward_exp: 0, reward_coin: 0, badge_image_url: '', is_active: true }, fields: [{ key: 'title', label: 'Achievement title', required: true }, { key: 'condition_type', label: 'Condition type', required: true }, { key: 'description', label: 'Description', type: 'textarea', wide: true }, { key: 'condition_value', label: 'Condition value', type: 'number', required: true }, { key: 'reward_exp', label: 'EXP reward', type: 'number', required: true }, { key: 'reward_coin', label: 'Coin reward', type: 'number', required: true }, { key: 'badge_image_url', label: 'Badge image', type: 'image-upload', scope: 'achievements', wide: true }, commonActiveField], columns: [{ label: 'Achievement', render: (row) => row.title }, { label: 'Condition', render: (row) => `${row.condition_type} × ${row.condition_value}` }, { label: 'Rewards', render: (row) => `${row.reward_exp} EXP · ${row.reward_coin} coins` }, { label: 'Badge', render: (row) => row.badge_image_url ? 'Configured' : 'Not set' }] },
  ],
  models: [
    { id: 'model-assets', label: 'Model assets', createLabel: 'New model asset', icon: 'hardware', defaults: { asset_key: '', label: '', type: 'model', url: '', metadata: {} }, fields: [{ key: 'asset_key', label: 'Asset key', required: true }, { key: 'label', label: 'Display label' }, { key: 'type', label: 'Asset type', required: true }, { key: 'url', label: 'GLTF model package', type: 'model-bundle', required: true, wide: true }, { key: 'metadata', label: 'Metadata (JSON)', type: 'json', wide: true }], columns: [{ label: 'Asset', render: (row) => row.label || row.asset_key }, { label: 'Key', render: (row) => row.asset_key }, { label: 'Type', render: (row) => row.type }, { label: 'Model file', render: (row) => row.url ? decodeURIComponent(String(row.url).split(/[?#]/, 1)[0].split('/').pop()) : 'Not set' }] },
  ],
  community: [
    { id: 'posts', label: 'Posts', icon: 'chat', moderation: true, statusField: 'visibility', statusOptions: ['public', 'friends', 'private'], columns: [{ label: 'Author', render: (row) => row.user?.username }, { label: 'Caption', render: (row) => row.caption || 'No caption' }, { label: 'Engagement', render: (row) => `${row.comments_count} comments · ${row.likes_count} likes` }, { label: 'Created', render: (row) => formatDate(row.created_at, true) }] },
    { id: 'comments', label: 'Post comments', icon: 'chat', moderation: true, statusField: 'status', statusOptions: ['visible', 'hidden', 'suspended'], columns: [{ label: 'Author', render: (row) => row.user?.username }, { label: 'Comment', render: (row) => row.comment_text }, { label: 'Thread', render: (row) => `${row.replies_count} replies · ${row.likes_count} likes` }, { label: 'Created', render: (row) => formatDate(row.created_at, true) }] },
    { id: 'simulator-comments', label: 'Game comments', icon: 'live', moderation: true, statusField: 'status', statusOptions: ['visible', 'hidden', 'suspended'], columns: [{ label: 'Author', render: (row) => row.user?.username }, { label: 'Comment', render: (row) => row.comment_text }, { label: 'Simulation', render: (row) => `#${row.simulator_id}` }, { label: 'Created', render: (row) => formatDate(row.created_at, true) }] },
  ],
  simulations: [
    { id: 'simulators', label: 'Simulations', icon: 'controller', moderation: true, statusField: 'status', statusOptions: ['active', 'completed', 'failed', 'cancelled'], extraStatusField: 'share_visibility', extraStatusOptions: ['private', 'friends', 'public'], columns: [{ label: 'Owner', render: (row) => row.user?.username }, { label: 'Plant / mode', render: (row) => `${row.plant?.name_en || row.plant?.name_th || 'Unknown'} · ${row.mode}` }, { label: 'Health / growth', render: (row) => `${row.health}% / ${row.growth_point} pts` }, { label: 'Started', render: (row) => formatDate(row.started_at, true) }] },
    { id: 'plant-histories', label: 'Plant histories', icon: 'history', moderation: true, statusField: 'visibility', statusOptions: ['private', 'friends', 'public'], columns: [{ label: 'Owner', render: (row) => row.user?.username }, { label: 'Plant', render: (row) => row.plant?.name_en || row.plant?.name_th }, { label: 'Result', render: (row) => `${row.final_health}% health · ${row.total_score} score` }, { label: 'Grow time', render: (row) => formatPlantDuration(row, 'en', { compact: true }) }, { label: 'Created', render: (row) => formatDate(row.created_at, true) }] },
  ],
  activity: [
    { id: 'activity-logs', label: 'Admin activity log', icon: 'history', readOnly: true, columns: [{ label: 'Administrator', render: (row) => row.admin?.username }, { label: 'Action', render: (row) => row.action }, { label: 'Target', render: (row) => `${row.target_type || 'system'} #${row.target_id || '—'}` }, { label: 'Time', render: (row) => formatDate(row.created_at, true) }] },
  ],
}

const emptyContent = {
  slug: '', category: 'plant-science', icon: 'eco', eyebrow: '', eyebrow_th: '',
  title: '', title_th: '', summary: '', summary_th: '', body_html: '', body_html_th: '',
  cover_image_url: '', cover_image_alt: '', cover_image_alt_th: '', image_credit: '', image_credit_url: '',
  reading_minutes: '', sort_order: 0, status: 'draft', published_at: null, references: [],
}

function articleExcerpt(html, fallback = '') {
  const parsed = new DOMParser().parseFromString(String(html ?? ''), 'text/html')
  const text = (parsed.body.textContent || fallback).replace(/\s+/g, ' ').trim()
  return text.length > 320 ? `${text.slice(0, 317).trimEnd()}…` : text
}

function prepareContentPayload(form) {
  const title = String(form.title ?? '').trim() || String(form.title_th ?? '').trim()
  const titleTh = String(form.title_th ?? '').trim() || title
  const body = String(form.body_html ?? '').trim() || String(form.body_html_th ?? '').trim()
  const bodyTh = String(form.body_html_th ?? '').trim() || body

  return {
    ...form,
    title,
    title_th: titleTh,
    body_html: body,
    body_html_th: bodyTh,
    summary: String(form.summary ?? '').trim() || articleExcerpt(body, title),
    summary_th: String(form.summary_th ?? '').trim() || articleExcerpt(bodyTh, titleTh),
    slug: String(form.slug ?? '').trim(),
    reading_minutes: form.reading_minutes === '' ? null : Number(form.reading_minutes),
    sort_order: Number(form.sort_order || 0),
    published_at: form.published_at || null,
  }
}

function formatDate(value, includeTime = false) {
  if (!value) return '—'
  const locale = document.documentElement.lang === 'th' ? 'th-TH' : 'en-GB'
  return new Intl.DateTimeFormat(locale, includeTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

function AdminSkeletonBlock({ className = '' }) {
  return <span aria-hidden="true" className={`admin-skeleton-block ${className}`} />
}

function AdminDashboardSkeleton() {
  return (
    <div className="admin-view admin-dashboard-skeleton" role="status" aria-busy="true" aria-label="Loading dashboard data">
      <div className="admin-metric-grid">
        {Array.from({ length: 8 }, (_, index) => (
          <article className="admin-skeleton-metric" key={index}>
            <AdminSkeletonBlock className="is-icon" />
            <AdminSkeletonBlock className="is-label" />
            <AdminSkeletonBlock className="is-value" />
            <AdminSkeletonBlock className="is-detail" />
          </article>
        ))}
      </div>

      <section className="admin-skeleton-attention">
        <div><AdminSkeletonBlock className="is-eyebrow" /><AdminSkeletonBlock className="is-heading" /></div>
        <AdminSkeletonBlock className="is-badge" />
        <div className="admin-skeleton-attention-grid">
          {Array.from({ length: 6 }, (_, index) => <AdminSkeletonBlock className="is-action" key={index} />)}
        </div>
      </section>

      <div className="admin-dashboard-grid">
        <section className="admin-skeleton-panel is-chart">
          <div className="admin-skeleton-panel-heading"><span><AdminSkeletonBlock className="is-eyebrow" /><AdminSkeletonBlock className="is-heading" /></span><AdminSkeletonBlock className="is-tools" /></div>
          <div className="admin-skeleton-chart" aria-hidden="true">
            {Array.from({ length: 14 }, (_, index) => <span key={index} style={{ height: `${28 + ((index * 17) % 58)}%` }} />)}
          </div>
        </section>
        <section className="admin-skeleton-panel is-overview">
          <div className="admin-skeleton-panel-heading"><span><AdminSkeletonBlock className="is-eyebrow" /><AdminSkeletonBlock className="is-heading" /></span></div>
          <AdminSkeletonBlock className="is-ring" />
          <div className="admin-skeleton-overview-lines">{Array.from({ length: 5 }, (_, index) => <AdminSkeletonBlock key={index} />)}</div>
        </section>
      </div>
      <span className="sr-only">Loading management data</span>
    </div>
  )
}

function AdminTableSkeleton({ embedded = false }) {
  return (
    <div className={`admin-table-skeleton ${embedded ? 'is-embedded' : ''}`} role="status" aria-busy="true" aria-label="Loading table records">
      {!embedded ? (
        <div className="admin-table-skeleton-toolbar">
          <AdminSkeletonBlock className="is-search" />
          <AdminSkeletonBlock className="is-filter" />
          <AdminSkeletonBlock className="is-create" />
        </div>
      ) : null}
      <div className="admin-table-skeleton-frame">
        <div className="admin-table-skeleton-head">{Array.from({ length: 5 }, (_, index) => <AdminSkeletonBlock key={index} />)}</div>
        {Array.from({ length: 7 }, (_, index) => (
          <div className="admin-table-skeleton-row" key={index}>
            <AdminSkeletonBlock className="is-index" />
            <span className="admin-table-skeleton-copy"><AdminSkeletonBlock /><AdminSkeletonBlock /></span>
            <AdminSkeletonBlock className="is-secondary" />
            <AdminSkeletonBlock className="is-status" />
            <AdminSkeletonBlock className="is-actions" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading records</span>
    </div>
  )
}

function StatusBadge({ status }) {
  return <span className={`admin-status admin-status--${status}`}>{status}</span>
}

function AdminPagination({ currentPage = 1, lastPage = 1, onPageChange }) {
  const pageCount = Math.max(1, Math.trunc(Number(lastPage) || 1))
  const page = Math.min(pageCount, Math.max(1, Math.trunc(Number(currentPage) || 1)))

  function submitPage(event) {
    event.preventDefault()
    const input = event.currentTarget.elements.namedItem('page')
    const requestedPage = Number.parseInt(input?.value ?? '', 10)

    if (!Number.isInteger(requestedPage)) {
      if (input) input.value = String(page)
      return
    }

    const targetPage = Math.min(pageCount, Math.max(1, requestedPage))
    if (input) input.value = String(targetPage)
    if (targetPage !== page) onPageChange(targetPage)
  }

  return (
    <nav className="admin-pagination" aria-label="Table pagination">
      <button disabled={page <= 1} type="button" onClick={() => onPageChange(page - 1)}><AppIcon name="arrowBack" />Previous</button>
      <span className="admin-pagination__summary" aria-live="polite">Page <strong>{page}</strong> of <strong>{pageCount}</strong></span>
      <form className="admin-pagination__jump" onSubmit={submitPage} noValidate>
        <label>
          <span>Go to page</span>
          <input key={`${page}-${pageCount}`} name="page" type="number" min="1" max={pageCount} step="1" inputMode="numeric" defaultValue={page} aria-label={`Go to page, from 1 to ${pageCount}`} />
        </label>
        <button type="submit" disabled={pageCount <= 1}>Go</button>
      </form>
      <button disabled={page >= pageCount} type="button" onClick={() => onPageChange(page + 1)}>Next<AppIcon name="arrowForward" /></button>
    </nav>
  )
}

function MetricCard({ icon, label, value, detail, tone = 'green' }) {
  return (
    <article className={`admin-metric admin-metric--${tone}`}>
      <span className="admin-metric__icon"><AppIcon name={icon} /></span>
      <span className="admin-metric__label">{label}</span>
      <strong>{Number(value ?? 0).toLocaleString()}</strong>
      <small><i />{detail}</small>
    </article>
  )
}

const trendSeriesConfig = [
  { key: 'users', label: 'New users', color: '#53e39a' },
  { key: 'simulations', label: 'Simulations', color: '#6f9fff' },
  { key: 'posts', label: 'Posts', color: '#f2c653' },
  { key: 'harvests', label: 'Harvests', color: '#f1846d' },
]

const overviewColors = {
  accounts: '#67d29a',
  learning: '#e8be67',
  game_data: '#6ca7ef',
  activity: '#4cc7c9',
  community: '#ac87eb',
  audit: '#ee8b72',
}

const userActivityMeta = {
  user_registered: { label: 'Joined the academy', filterLabel: 'New accounts', badge: 'Account', icon: 'person', tone: 'account' },
  simulation_started: { label: 'Started a plant simulation', filterLabel: 'Simulation started', badge: 'Simulation', icon: 'controller', tone: 'simulation' },
  plant_saved: { label: 'Saved a plant result', filterLabel: 'Plant results saved', badge: 'Result', icon: 'plant', tone: 'simulation' },
  post_created: { label: 'Published a community post', filterLabel: 'Posts created', badge: 'Post', icon: 'chat', tone: 'community' },
  post_commented: { label: 'Commented on a post', filterLabel: 'Post comments', badge: 'Comment', icon: 'chat', tone: 'community' },
  simulation_commented: { label: 'Commented on a shared simulation', filterLabel: 'Game comments', badge: 'Comment', icon: 'controller', tone: 'community' },
  post_liked: { label: 'Liked a community post', filterLabel: 'Post likes', badge: 'Like', icon: 'heart', tone: 'reaction' },
  comment_liked: { label: 'Liked a comment', filterLabel: 'Comment likes', badge: 'Like', icon: 'thumbUp', tone: 'reaction' },
  item_used: { label: 'Used an item in the lab', filterLabel: 'Items used', badge: 'Item', icon: 'tool', tone: 'inventory' },
  shop_purchase: { label: 'Spent currency in the shop', filterLabel: 'Shop purchases', badge: 'Shop', icon: 'shop', tone: 'inventory' },
}

const attentionItemMeta = {
  moderated_comments: { label: 'Comments to review', detail: 'Hidden or suspended discussions', icon: 'chat' },
  draft_contents: { label: 'Draft content', detail: 'Articles waiting to be published', icon: 'bookmark' },
  suspended_users: { label: 'Suspended accounts', detail: 'Accounts with restricted access', icon: 'groups' },
  failed_simulations: { label: 'Failed simulations', detail: 'Runs that may need investigation', icon: 'controller' },
  cancelled_simulations: { label: 'Cancelled simulations', detail: 'Interrupted learner sessions', icon: 'history' },
  stale_active_simulations: { label: 'Long-running simulations', detail: 'Active for more than seven days', icon: 'live' },
  missing_model_assets: { label: 'Missing model files', detail: 'Asset records without a configured URL', icon: 'hardware' },
}

function AttentionCenter({ attention, onOpenSection }) {
  const items = attention?.items ?? []

  return (
    <section className="admin-panel admin-attention-panel">
      <header className="admin-panel__header">
        <div><small>ACTION CENTER</small><h2>Items that need attention</h2></div>
        <span className={attention?.total ? 'has-items' : 'is-clear'}>{attention?.total ? `${Number(attention.total).toLocaleString()} open` : 'All clear'}</span>
      </header>
      <div className="admin-attention-grid">
        {items.map((item) => {
          const meta = attentionItemMeta[item.key] ?? { label: item.key.replaceAll('_', ' '), detail: 'Open the related section to review', icon: 'shield' }
          return (
            <button className={`admin-attention-item is-${item.severity} ${item.value ? 'has-items' : 'is-clear'}`} type="button" key={item.key} onClick={() => onOpenSection(item.section)}>
              <span><AppIcon name={meta.icon} /></span>
              <span><strong>{meta.label}</strong><small>{meta.detail}</small></span>
              <b>{Number(item.value ?? 0).toLocaleString()}</b>
              <AppIcon name="arrowForward" />
            </button>
          )
        })}
      </div>
    </section>
  )
}

function TrendChart({ trend = [], activeSeries, period = 'month', periodLabel = '', theme = 'dark' }) {
  const selectedSeries = useMemo(
    () => trendSeriesConfig.filter((series) => activeSeries.includes(series.key)),
    [activeSeries],
  )
  const seriesLabel = selectedSeries.map((series) => series.label).join(', ')
  const isLight = theme === 'light'
  const parseTimestamp = (value, index) => {
    const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value
    const timestamp = new Date(normalized).getTime()
    return Number.isFinite(timestamp) ? timestamp : Date.UTC(2000, 0, index + 1)
  }
  const chartSeries = useMemo(() => selectedSeries.map((series) => ({
    name: series.label,
    data: trend.map((entry, index) => ({
      x: parseTimestamp(entry.date, index),
      y: Number(entry[series.key] ?? 0),
    })),
  })), [selectedSeries, trend])
  const visibleMaximum = useMemo(() => {
    const highestValue = Math.max(
      0,
      ...selectedSeries.flatMap((series) => trend.map((entry) => Number(entry[series.key] ?? 0))),
    )
    if (highestValue <= 10) return 10
    return Math.min(100, Math.ceil(highestValue / 10) * 10)
  }, [selectedSeries, trend])
  const options = useMemo(() => {
    const axisDate = new Intl.DateTimeFormat('en-US', period === 'day'
      ? { hour: '2-digit', minute: '2-digit' }
      : period === 'year'
        ? { month: 'short' }
        : { day: 'numeric', month: 'short' })
    const tooltipDate = new Intl.DateTimeFormat('en-US', period === 'day'
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : period === 'year'
        ? { month: 'long', year: 'numeric' }
        : { day: 'numeric', month: 'long', year: 'numeric' })

    return {
      chart: {
        id: 'admin-academy-growth-chart',
        type: 'line',
        height: '100%',
        background: 'transparent',
        fontFamily: 'Inter, "Noto Sans Thai", sans-serif',
        foreColor: isLight ? '#526259' : '#7f8d84',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 520,
          dynamicAnimation: { enabled: true, speed: 320 },
        },
        toolbar: {
          show: true,
          autoSelected: 'zoom',
          tools: {
            download: false,
            selection: false,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true,
          },
        },
        zoom: {
          enabled: true,
          type: 'x',
          autoScaleYaxis: false,
          allowMouseWheelZoom: true,
        },
      },
      colors: selectedSeries.map((series) => series.color),
      series: chartSeries,
      stroke: {
        curve: 'smooth',
        lineCap: 'round',
        colors: selectedSeries.map((series) => series.color),
        width: 5,
      },
      dataLabels: { enabled: false },
      markers: {
        size: 0,
        colors: selectedSeries.map((series) => series.color),
        strokeWidth: 2,
        strokeColors: isLight ? '#ffffff' : '#131915',
        hover: { size: 7, sizeOffset: 0 },
      },
      grid: {
        show: true,
        borderColor: isLight ? 'rgba(25,52,37,.18)' : 'rgba(225,240,230,.17)',
        strokeDashArray: 5,
        padding: { left: 12, right: 18, top: 18, bottom: 6 },
      },
      fill: {
        type: 'solid',
        colors: selectedSeries.map((series) => series.color),
        opacity: 1,
      },
      legend: { show: false },
      tooltip: {
        enabled: true,
        shared: true,
        intersect: false,
        followCursor: false,
        theme: isLight ? 'light' : 'dark',
        onDatasetHover: {
          highlightDataSeries: false,
        },
        x: {
          show: true,
          formatter: (value) => tooltipDate.format(new Date(Number(value))),
        },
        y: {
          formatter: (value) => `${Number(value ?? 0).toLocaleString()} records`,
        },
        marker: { show: true },
      },
      xaxis: {
        type: 'datetime',
        tickAmount: trend.length > 20 ? 10 : Math.max(2, trend.length - 1),
        labels: {
          show: true,
          hideOverlappingLabels: true,
          rotate: 0,
          style: {
            colors: isLight ? '#405248' : '#9ba9a1',
            fontSize: '11px',
            fontWeight: 650,
          },
          formatter: (value, timestamp) => axisDate.format(new Date(Number(timestamp ?? value))),
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        crosshairs: {
          show: true,
          position: 'back',
          stroke: {
            color: isLight ? 'rgba(35,80,51,.28)' : 'rgba(210,228,217,.32)',
            width: 1,
            dashArray: 4,
          },
        },
        tooltip: { enabled: false },
      },
      yaxis: {
        show: true,
        min: 0,
        max: visibleMaximum,
        tickAmount: 5,
        forceNiceScale: false,
        decimalsInFloat: 0,
        title: {
          text: 'Records',
          style: {
            color: isLight ? '#526259' : '#718078',
            fontSize: '11px',
            fontWeight: 700,
          },
        },
        labels: {
          minWidth: 28,
          formatter: (value) => Math.round(value),
          style: {
            colors: isLight ? '#405248' : '#9ba9a1',
            fontSize: '11px',
            fontWeight: 650,
          },
        },
      },
      noData: {
        text: 'No activity data for this period',
        align: 'center',
        verticalAlign: 'middle',
        style: {
          color: isLight ? '#526259' : '#839087',
          fontSize: '13px',
        },
      },
    }
  }, [chartSeries, isLight, period, selectedSeries, trend.length, visibleMaximum])

  return (
    <div className="admin-trend" role="group" aria-label={`${periodLabel || 'Selected period'} line chart showing ${seriesLabel}`}>
      <Suspense fallback={<div className="admin-trend__loading"><span aria-hidden="true" />Loading chart…</div>}>
        <ReactApexChart className="admin-trend__chart" options={options} series={chartSeries} type="line" height="100%" />
      </Suspense>
    </div>
  )
}

function DashboardView({ data, trendSelection, onChangeTrendSelection, onOpenSection, theme = 'dark' }) {
  const metrics = data?.metrics ?? {}
  const totalContent = (metrics.published_contents ?? 0) + (metrics.draft_contents ?? 0)
  const totalComments = (metrics.post_comments ?? 0) + (metrics.simulator_comments ?? 0)
  const totalSpecies = (metrics.plants ?? 0) + (metrics.pests ?? 0)
  const totalGameCatalog = (metrics.items ?? 0) + (metrics.shop_items ?? 0) + (metrics.quests ?? 0) + (metrics.achievements ?? 0) + (metrics.model_assets ?? 0)
  const [activeSeries, setActiveSeries] = useState(['users', 'simulations'])
  const [activityType, setActivityType] = useState('all')
  const [activityUser, setActivityUser] = useState('all')
  const recentActivities = useMemo(() => data?.recent_user_activities ?? [], [data?.recent_user_activities])
  const activityTypeCounts = useMemo(() => recentActivities.reduce((counts, activity) => ({
    ...counts,
    [activity.type]: (counts[activity.type] ?? 0) + 1,
  }), {}), [recentActivities])
  const activityUsers = useMemo(() => [...new Map(
    recentActivities
      .filter((activity) => activity.user?.id)
      .map((activity) => [String(activity.user.id), activity.user]),
  ).values()].sort((left, right) => String(left.username).localeCompare(String(right.username))), [recentActivities])
  const filteredActivities = useMemo(() => recentActivities.filter((activity) => (
    (activityType === 'all' || activity.type === activityType)
    && (activityUser === 'all' || String(activity.user?.id) === activityUser)
  )), [activityType, activityUser, recentActivities])
  const overview = data?.system_overview ?? { total: 0, groups: [] }
  let overviewAngle = 0
  const overviewSegments = (overview.groups ?? []).map((group) => {
    const start = overviewAngle
    overviewAngle += overview.total ? (group.value / overview.total) * 360 : 0
    return `${overviewColors[group.key] ?? '#87928b'} ${start}deg ${overviewAngle}deg`
  })
  const overviewBackground = overview.total && overviewSegments.length
    ? `conic-gradient(${overviewSegments.join(',')})`
    : 'conic-gradient(#29312c 0deg 360deg)'
  const selectedYear = Number(trendSelection.value) || new Date().getFullYear()
  const currentYear = new Date().getFullYear()
  const firstYear = Math.min(currentYear - 9, selectedYear)
  const lastYear = Math.max(currentYear, selectedYear)
  const yearOptions = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => lastYear - index)

  function toggleSeries(seriesKey) {
    setActiveSeries((current) => {
      if (current.includes(seriesKey)) return current.length === 1 ? current : current.filter((key) => key !== seriesKey)
      return [...current, seriesKey]
    })
  }

  function changeTrendPeriod(period) {
    if (period === trendSelection.period) return
    onChangeTrendSelection({ period, value: currentTrendValue(period) })
  }

  return (
    <div className="admin-view admin-dashboard-view">
      <div className="admin-metric-grid">
        <MetricCard icon="groups" label="Total Users" value={metrics.users} detail={`${metrics.active_users ?? 0} active accounts`} />
        <MetricCard icon="controller" label="Simulations" value={metrics.simulations} detail={`${metrics.active_simulations ?? 0} currently active`} tone="blue" />
        <MetricCard icon="history" label="Harvested plants" value={metrics.harvests} detail="Completed learning results" tone="cyan" />
        <MetricCard icon="bookmark" label="Learning content" value={totalContent} detail={`${metrics.published_contents ?? 0} published · ${metrics.draft_contents ?? 0} draft`} tone="gold" />
        <MetricCard icon="chat" label="Community posts" value={metrics.community_posts} detail="Shared learning activity" tone="violet" />
        <MetricCard icon="live" label="All comments" value={totalComments} detail={`${metrics.hidden_comments ?? 0} require moderation`} tone="coral" />
        <MetricCard icon="plant" label="Plants & pests" value={totalSpecies} detail={`${metrics.plants ?? 0} plants · ${metrics.pests ?? 0} pests`} tone="green" />
        <MetricCard icon="shop" label="Game catalog" value={totalGameCatalog} detail={`${metrics.items ?? 0} items · ${metrics.quests ?? 0} quests`} tone="blue" />
      </div>

      <AttentionCenter attention={data?.attention} onOpenSection={onOpenSection} />

      <div className="admin-dashboard-grid">
        <section className="admin-panel admin-panel--trend">
          <header className="admin-panel__header">
            <div><small>ACTIVITY</small><h2>Academy growth</h2></div>
            <div className="admin-panel__tools">
              <div className="admin-series-picker" role="group" aria-label="Chart data">
                {trendSeriesConfig.map((series) => <button className={activeSeries.includes(series.key) ? 'is-active' : ''} type="button" aria-pressed={activeSeries.includes(series.key)} key={series.key} onClick={() => toggleSeries(series.key)}><i style={{ background: series.color }} />{series.label}</button>)}
              </div>
              <div className="admin-trend-filter">
                <div className="admin-range-switch" role="group" aria-label="Chart period type">
                  {['day', 'month', 'year'].map((period) => <button className={trendSelection.period === period ? 'is-active' : ''} type="button" aria-pressed={trendSelection.period === period} key={period} onClick={() => changeTrendPeriod(period)}>{period}</button>)}
                </div>
                <label className="admin-trend-picker">
                  <span className="sr-only">Select {trendSelection.period}</span>
                  {trendSelection.period === 'year' ? (
                    <select value={trendSelection.value} onChange={(event) => onChangeTrendSelection({ period: 'year', value: event.target.value })}>
                      {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  ) : (
                    <input
                      aria-label={`Select ${trendSelection.period}`}
                      type={trendSelection.period === 'day' ? 'date' : 'month'}
                      value={trendSelection.value}
                      onChange={(event) => event.target.value && onChangeTrendSelection({ ...trendSelection, value: event.target.value })}
                    />
                  )}
                </label>
              </div>
            </div>
          </header>
          <div className="admin-trend-context"><span>{data?.trend_label || trendSelection.value}</span><small>{data?.trend?.length ?? 0} data points</small></div>
          <TrendChart trend={data?.trend} activeSeries={activeSeries} period={data?.trend_period || trendSelection.period} periodLabel={data?.trend_label} theme={theme} />
        </section>

        <section className="admin-panel admin-system-panel">
          <header className="admin-panel__header"><div><small>SYSTEM OVERVIEW</small><h2>Data composition</h2></div></header>
          <div className="admin-system-panel__body">
            <div className="admin-system-ring" style={{ background: overviewBackground }}><span><strong>{Number(overview.total ?? 0).toLocaleString()}</strong><small>total records</small></span></div>
            <div className="admin-system-breakdown">
              {(overview.groups ?? []).map((group) => (
                <button type="button" key={group.key} onClick={() => onOpenSection(group.section)}>
                  <span><i style={{ background: overviewColors[group.key] }} />{group.label}</span>
                  <strong>{Number(group.value ?? 0).toLocaleString()}</strong>
                  <AppIcon name="arrowForward" />
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="admin-dashboard-grid admin-dashboard-grid--tables">
        <section className="admin-panel">
          <header className="admin-panel__header"><div><small>NEW ACCOUNTS</small><h2>Recent Users</h2></div><button type="button" onClick={() => onOpenSection('users')}>View all</button></header>
          <div className="admin-list">
            {(data?.recent_users ?? []).map((user) => (
              <div className="admin-list__row" key={user.id}>
                <AdminAvatar user={user} />
                <span><strong>{user.username}</strong><small>{user.email}</small></span>
                <StatusBadge status={user.role} />
                <time>{formatDate(user.created_at)}</time>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel admin-user-activity-panel">
          <header className="admin-panel__header">
            <div><small>LEARNER ACTIVITY</small><h2>Latest user activity</h2></div>
            <span className="admin-activity-live"><i />Live feed</span>
          </header>
          <div className="admin-activity-filters">
            <label>
              <span>Activity type</span>
              <select value={activityType} onChange={(event) => setActivityType(event.target.value)}>
                <option value="all">All activities ({recentActivities.length})</option>
                {Object.entries(userActivityMeta).map(([type, meta]) => (
                  <option value={type} key={type}>{meta.filterLabel} ({activityTypeCounts[type] ?? 0})</option>
                ))}
              </select>
            </label>
            <label>
              <span>User</span>
              <select value={activityUser} onChange={(event) => setActivityUser(event.target.value)}>
                <option value="all">All users</option>
                {activityUsers.map((user) => <option value={String(user.id)} key={user.id}>{user.username}</option>)}
              </select>
            </label>
            <span className="admin-activity-result">{filteredActivities.length} shown</span>
          </div>
          <div className="admin-list admin-user-activity-list" aria-live="polite">
            {filteredActivities.map((activity) => {
              const meta = userActivityMeta[activity.type] ?? { label: 'Completed an activity', badge: 'Activity', icon: 'history', tone: 'default' }
              const detail = activity.subject ? `${meta.label} · ${activity.subject}` : meta.label

              return (
                <div className="admin-list__row admin-list__row--activity" key={activity.id}>
                  <AdminAvatar user={activity.user} />
                  <span><strong>{activity.user?.username || 'Unknown user'}</strong><small title={detail}>{detail}</small></span>
                  <span className={`admin-activity-kind is-${meta.tone}`}><AppIcon name={meta.icon} />{meta.badge}</span>
                  <time title={formatDate(activity.occurred_at, true)}>{formatDate(activity.occurred_at, true)}</time>
                </div>
              )
            })}
            {!filteredActivities.length && <div className="admin-list__empty">No user activity matches these filters.</div>}
          </div>
        </section>

        <section className="admin-panel admin-audit-summary">
          <header className="admin-panel__header"><div><small>ADMIN ACTIVITY</small><h2>Recent changes</h2></div><button type="button" onClick={() => onOpenSection('activity')}>View audit log</button></header>
          <div className="admin-list">
            {(data?.attention?.recent_admin_actions ?? []).map((action) => (
              <div className="admin-list__row admin-list__row--audit" key={action.id}>
                <span className="admin-list__content-icon"><AppIcon name="history" /></span>
                <span><strong>{action.action?.replaceAll('_', ' ')}</strong><small>{action.admin?.username || 'System administrator'} · {action.target_type || 'system'} #{action.target_id || '—'}</small></span>
                <time>{formatDate(action.created_at, true)}</time>
              </div>
            ))}
            {!data?.attention?.recent_admin_actions?.length && <div className="admin-list__empty">No recent administrator changes.</div>}
          </div>
        </section>
      </div>
    </div>
  )
}

function ContentEditor({ content, onClose, onSaved }) {
  const [initialState] = useState(() => ({
    form: { ...emptyContent, ...content },
    references: (content?.references ?? []).map((reference) => ({
      title: reference.title ?? '', organization: reference.organization ?? '', url: reference.url ?? '',
    })),
  }))
  const [form, setForm] = useState(initialState.form)
  const [language, setLanguage] = useState('en')
  const [editorMode, setEditorMode] = useState('visual')
  const [references, setReferences] = useState(initialState.references)
  const [coverUploadStatus, setCoverUploadStatus] = useState('idle')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const dialogRef = useRef(null)
  const editorScrollRef = useRef(null)
  const coverInputRef = useRef(null)
  const dirty = useMemo(() => dataSnapshot({ form, references }) !== dataSnapshot(initialState), [form, initialState, references])
  const requestClose = useCallback(async () => {
    if (status === 'saving') return
    if (dirty && !await confirmDiscardChanges()) return
    onClose()
  }, [dirty, onClose, status])
  useModalLifecycle(requestClose, dialogRef)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function updateReference(index, field, value) {
    setReferences((current) => current.map((reference, referenceIndex) => (
      referenceIndex === index ? { ...reference, [field]: value } : reference
    )))
  }

  async function uploadCover(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const previousScrollTop = editorScrollRef.current?.scrollTop ?? 0
    const restoreScrollPosition = () => window.requestAnimationFrame(() => {
      if (editorScrollRef.current) editorScrollRef.current.scrollTop = previousScrollTop
    })
    setError('')
    setCoverUploadStatus('uploading')
    try {
      const payload = await uploadAdminContentImage(file)
      update('cover_image_url', payload.reference ?? payload.url)
      setCoverUploadStatus('idle')
      restoreScrollPosition()
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to upload the cover image.')
      setCoverUploadStatus('idle')
      restoreScrollPosition()
    }
  }

  async function submit(event, requestedStatus = form.status) {
    event?.preventDefault()
    setError('')
    try {
      const nextForm = { ...form, status: requestedStatus }
      const currentTitle = String((language === 'th' ? form.title_th : form.title) ?? '').trim()
      const currentBody = String((language === 'th' ? form.body_html_th : form.body_html) ?? '').trim()
      if (!currentTitle) throw new Error(language === 'th' ? 'กรุณาใส่ชื่อบทความ' : 'Please enter the article title.')
      if (!currentBody) throw new Error(language === 'th' ? 'กรุณาเขียนเนื้อหาบทความใน Editor' : 'Please write the article content in the editor.')
      const preparedReferences = references
        .map((reference) => ({
          title: reference.title.trim(),
          organization: reference.organization.trim(),
          url: reference.url.trim(),
        }))
        .filter((reference) => reference.title || reference.organization || reference.url)
      const incompleteReference = preparedReferences.find((reference) => !reference.title || !reference.url)
      if (incompleteReference) throw new Error(language === 'th' ? 'รายการอ้างอิงต้องมีชื่อและ URL ให้ครบ' : 'Each reference needs both a title and URL.')
      if (requestedStatus === 'published' && !form.cover_image_url) throw new Error(language === 'th' ? 'กรุณาเพิ่มรูปปกก่อนเผยแพร่' : 'Please add a cover image before publishing.')
      if (requestedStatus === 'published' && preparedReferences.length === 0) throw new Error(language === 'th' ? 'กรุณาเพิ่มแหล่งอ้างอิงอย่างน้อย 1 รายการก่อนเผยแพร่' : 'Please add at least one reference before publishing.')
      if (form.id) {
        const confirmed = await confirmAdminAction({
          title: 'Save content changes?',
          text: `The changes to “${form.title || form.slug}” will be visible in the administration system.`,
          confirmButtonText: 'Save changes',
          icon: 'question',
        })
        if (!confirmed) return
      }
      setStatus('saving')
      setForm(nextForm)
      const payload = await saveAdminContent({ ...prepareContentPayload(nextForm), references: preparedReferences })
      await onSaved(payload.data)
      await showAdminSuccess(form.id ? 'Content updated' : 'Content added', form.id ? 'Your changes were saved successfully.' : 'The new content was placed at the bottom of the list.')
    } catch (saveError) {
      setError(saveError.message || 'Unable to save content.')
      setStatus('idle')
    }
  }

  const previewHtml = language === 'th' ? form.body_html_th : form.body_html

  return (
    <div className="admin-editor-backdrop" role="presentation">
      <form ref={dialogRef} className="admin-editor" role="dialog" aria-modal="true" aria-labelledby="admin-content-editor-title" tabIndex="-1" onSubmit={submit}>
        <header className="admin-editor__header">
          <div><small>{form.id ? `CONTENT / VERSION ${form.version}` : 'CONTENT / NEW ARTICLE'}</small><h2 id="admin-content-editor-title">{form.id ? 'Edit learning content' : 'Create learning content'}</h2></div>
          <button type="button" onClick={requestClose} aria-label="Close editor">×</button>
        </header>

        <div className="admin-editor__toolbar">
          <div className="admin-editor__language"><button className={language === 'en' ? 'is-active' : ''} type="button" onClick={() => setLanguage('en')}>English</button><button className={language === 'th' ? 'is-active' : ''} type="button" onClick={() => setLanguage('th')}>ไทย</button></div>
          <label>Status<select value={form.status} onChange={(event) => update('status', event.target.value)}><option value="draft">Draft</option><option value="published">Published</option></select></label>
        </div>

        <div className={`admin-editor__body ${editorMode === 'visual' ? 'admin-editor__body--visual' : ''}`}>
          <div className="admin-editor__form" ref={editorScrollRef}>
            <section className="admin-writing-section">
              <div className="admin-writing-section__intro">
                <div><small>{language === 'th' ? 'เขียนบทความแบบง่าย' : 'QUICK ARTICLE EDITOR'}</small><h3>{language === 'th' ? 'ใส่ชื่อ แล้วเริ่มเขียนได้เลย' : 'Add a title, then start writing.'}</h3></div>
                <p>{language === 'th' ? 'Slug, สรุปบทความ และเวลาอ่าน ระบบจะสร้างให้อัตโนมัติ' : 'Slug, summary, and reading time are generated automatically.'}</p>
              </div>
              <label className="admin-writing-title">{language === 'th' ? 'ชื่อบทความ' : 'Article title'}<input autoFocus placeholder={language === 'th' ? 'ชื่อบทความของคุณ' : 'Enter the article title'} value={language === 'th' ? form.title_th : form.title} onChange={(event) => update(language === 'th' ? 'title_th' : 'title', event.target.value)} /></label>
              <div className="admin-content-mode">
                <div><strong>{language === 'th' ? 'รูปแบบการเขียน' : 'Writing mode'}</strong><small>{language === 'th' ? 'สลับโหมดได้โดยเนื้อหาไม่หาย' : 'Switch modes without losing the content.'}</small></div>
                <div className="admin-content-mode__switch" role="tablist" aria-label="Content editing mode">
                  <button className={editorMode === 'visual' ? 'is-active' : ''} type="button" role="tab" aria-selected={editorMode === 'visual'} onClick={() => setEditorMode('visual')}><AppIcon name="edit" />{language === 'th' ? 'เขียนปกติ' : 'Visual editor'}</button>
                  <button className={editorMode === 'html' ? 'is-active' : ''} type="button" role="tab" aria-selected={editorMode === 'html'} onClick={() => setEditorMode('html')}><AppIcon name="code" />HTML</button>
                </div>
              </div>
              {editorMode === 'visual' ? (
                <Suspense fallback={<div className="admin-rich-editor-loading"><span /><strong>Loading visual editor…</strong></div>}>
                  <ContentRichEditor key={language} data={previewHtml} language={language} onChange={(html) => update(language === 'th' ? 'body_html_th' : 'body_html', html)} />
                </Suspense>
              ) : (
                <label>{language === 'th' ? 'โครงสร้าง HTML' : 'HTML source'}<textarea className="admin-code-field admin-html-source-field" rows="20" spellCheck="false" value={previewHtml} onChange={(event) => update(language === 'th' ? 'body_html_th' : 'body_html', event.target.value)} /></label>
              )}
            </section>

            <section className="admin-content-essentials">
              <div className="admin-content-essentials__header">
                <div><small>{language === 'th' ? 'ข้อมูลสำหรับเผยแพร่' : 'PUBLICATION DETAILS'}</small><h3>{language === 'th' ? 'รูปปกและแหล่งอ้างอิง' : 'Cover image and references'}</h3></div>
                <span>{form.status === 'published' ? (language === 'th' ? 'จำเป็นสำหรับการเผยแพร่' : 'Required to publish') : (language === 'th' ? 'กรอกไว้ก่อนเผยแพร่' : 'Complete before publishing')}</span>
              </div>

              <label>{language === 'th' ? 'สรุปบทความ' : 'Article summary'}<textarea placeholder={language === 'th' ? 'เว้นว่างได้ ระบบจะสร้างจากเนื้อหาให้อัตโนมัติ' : 'Optional — generated automatically from the article when left blank'} rows="3" value={language === 'th' ? form.summary_th : form.summary} onChange={(event) => update(language === 'th' ? 'summary_th' : 'summary', event.target.value)} /></label>

              <div className="admin-cover-editor">
                <div className={`admin-cover-editor__preview ${form.cover_image_url ? 'has-image' : ''}`}>
                  {form.cover_image_url ? <img src={resolveAssetUrl(form.cover_image_url)} alt="" /> : <AppIcon name="camera" />}
                </div>
                <div className="admin-cover-editor__fields">
                  <div className="admin-cover-editor__heading"><strong>{language === 'th' ? 'รูปปกบทความ' : 'Article cover'}</strong><small>{language === 'th' ? 'แนะนำภาพแนวนอน JPG, PNG หรือ WebP ไม่เกิน 8 MB' : 'Landscape JPG, PNG, or WebP up to 8 MB is recommended.'}</small></div>
                  <div className="admin-cover-editor__actions">
                    <input className="admin-cover-file-input" ref={coverInputRef} accept="image/jpeg,image/png,image/webp,image/gif" disabled={coverUploadStatus === 'uploading'} tabIndex="-1" type="file" onChange={uploadCover} />
                    <button className="admin-cover-upload" disabled={coverUploadStatus === 'uploading'} type="button" onClick={() => coverInputRef.current?.click()}><AppIcon name="camera" />{coverUploadStatus === 'uploading' ? (language === 'th' ? 'กำลังอัปโหลด…' : 'Uploading…') : (language === 'th' ? 'อัปโหลดรูป' : 'Upload image')}</button>
                    {form.cover_image_url && <button type="button" onClick={() => update('cover_image_url', '')}><AppIcon name="delete" />{language === 'th' ? 'นำรูปออก' : 'Remove'}</button>}
                  </div>
                </div>
              </div>

              <div className="admin-form-grid">
                <label>{language === 'th' ? 'คำอธิบายรูป' : 'Image description'} <small>{language === 'th' ? 'ไม่บังคับ' : 'OPTIONAL'}</small><input placeholder={language === 'th' ? 'อธิบายสิ่งที่อยู่ในภาพ' : 'Describe what is shown in the image'} value={language === 'th' ? form.cover_image_alt_th ?? '' : form.cover_image_alt ?? ''} onChange={(event) => update(language === 'th' ? 'cover_image_alt_th' : 'cover_image_alt', event.target.value)} /></label>
                <label>{language === 'th' ? 'เครดิตรูปภาพ' : 'Image credit'} <small>{language === 'th' ? 'ไม่บังคับ' : 'OPTIONAL'}</small><input placeholder={language === 'th' ? 'ชื่อช่างภาพหรือองค์กร' : 'Photographer or organization'} value={form.image_credit ?? ''} onChange={(event) => update('image_credit', event.target.value)} /></label>
                <label className="is-wide">Image credit URL <small>{language === 'th' ? 'ไม่บังคับ' : 'OPTIONAL'}</small><input placeholder="https://…" value={form.image_credit_url ?? ''} onChange={(event) => update('image_credit_url', event.target.value)} /></label>
              </div>

              <div className="admin-reference-editor">
                <div className="admin-reference-editor__header"><div><strong>{language === 'th' ? 'แหล่งอ้างอิง' : 'References'}</strong><small>{language === 'th' ? 'อย่างน้อย 1 รายการเมื่อเผยแพร่บทความ' : 'At least one source is required when publishing.'}</small></div><button type="button" onClick={() => setReferences((current) => [...current, { title: '', organization: '', url: '' }])}><AppIcon name="add" />{language === 'th' ? 'เพิ่มอ้างอิง' : 'Add reference'}</button></div>
                {references.length === 0 ? (
                  <button className="admin-reference-editor__empty" type="button" onClick={() => setReferences([{ title: '', organization: '', url: '' }])}><AppIcon name="bookmark" /><span><strong>{language === 'th' ? 'ยังไม่มีแหล่งอ้างอิง' : 'No references yet'}</strong><small>{language === 'th' ? 'กดเพื่อเพิ่มแหล่งข้อมูลที่น่าเชื่อถือ' : 'Add the first trusted source for this article.'}</small></span></button>
                ) : references.map((reference, index) => (
                  <div className="admin-reference-row" key={index}>
                    <span>{index + 1}</span>
                    <label>{language === 'th' ? 'ชื่อแหล่งข้อมูล' : 'Source title'}<input placeholder={language === 'th' ? 'ชื่อบทความหรือเอกสาร' : 'Article or document title'} value={reference.title} onChange={(event) => updateReference(index, 'title', event.target.value)} /></label>
                    <label>{language === 'th' ? 'องค์กร' : 'Organization'}<input placeholder="FAO, NASA, University…" value={reference.organization} onChange={(event) => updateReference(index, 'organization', event.target.value)} /></label>
                    <label>URL<input placeholder="https://…" type="url" value={reference.url} onChange={(event) => updateReference(index, 'url', event.target.value)} /></label>
                    <button type="button" aria-label={language === 'th' ? `ลบอ้างอิงที่ ${index + 1}` : `Remove reference ${index + 1}`} onClick={() => setReferences((current) => current.filter((_, referenceIndex) => referenceIndex !== index))}><AppIcon name="delete" /></button>
                  </div>
                ))}
              </div>
            </section>

            <details className="admin-editor-advanced">
              <summary><span><AppIcon name="settings" /><strong>{language === 'th' ? 'ตั้งค่าเพิ่มเติม' : 'Advanced settings'}</strong><small>{language === 'th' ? 'ไม่จำเป็นต้องกรอก ระบบตั้งค่าให้แล้ว' : 'Optional — the system fills these automatically.'}</small></span><AppIcon name="arrowDown" /></summary>
              <div className="admin-editor-advanced__body">
                <section>
                  <h3>{language === 'th' ? 'ข้อมูลบทความเพิ่มเติม' : 'Article details'}</h3>
                  <div className="admin-form-grid">
                    <label>Slug <small>AUTO</small><input placeholder="Generated from the title" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => update('slug', event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} /></label>
                    <label>Category<input value={form.category} onChange={(event) => update('category', event.target.value)} /></label>
                    <label>{language === 'th' ? 'ป้ายกำกับ' : 'Eyebrow'}<input value={language === 'th' ? form.eyebrow_th : form.eyebrow} onChange={(event) => update(language === 'th' ? 'eyebrow_th' : 'eyebrow', event.target.value)} /></label>
                    <label>{language === 'th' ? 'เวลาอ่าน (นาที)' : 'Reading time'} <small>AUTO</small><input min="1" max="60" placeholder="Auto" type="number" value={form.reading_minutes} onChange={(event) => update('reading_minutes', event.target.value)} /></label>
                    <label>Sort order<input min="0" max="999" type="number" value={form.sort_order} onChange={(event) => update('sort_order', event.target.value)} /></label>
                  </div>
                </section>
              </div>
            </details>
          </div>

          {editorMode === 'html' && <aside className="admin-editor__preview">
            <div><span>LIVE PREVIEW</span><strong>{language === 'th' ? form.title_th : form.title || 'Untitled article'}</strong></div>
            {form.cover_image_url && <img src={resolveAssetUrl(form.cover_image_url)} alt="" />}
            <iframe title="Article HTML preview" sandbox="" srcDoc={`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:28px;font-family:"Inter Variable","Noto Sans Thai Variable",Inter,"Noto Sans Thai",ui-sans-serif,system-ui,"Segoe UI",sans-serif;color:#1c2b21;line-height:1.7}h1,h2,h3,h4{margin:1.4em 0 .55em;color:#163b23;line-height:1.25}p{margin:.6em 0 1em}img{display:block;max-width:100%;height:auto;border-radius:10px}figure{max-width:100%;margin:1.5em auto}figcaption{margin-top:.5em;color:#647168;font-size:12px;text-align:center}table{width:100%;margin:1.5em 0;border-collapse:collapse}th,td{padding:10px;border:1px solid #ccd8cf;text-align:left;vertical-align:top}th{background:#edf4ef}blockquote,.article-callout,.article-science-note{margin:1.5em 0;padding:16px 18px;border-left:4px solid #75b45c;background:#edf6e9}.article-science-note{border-left-color:#4e8eae;background:#edf5f8}pre{overflow:auto;padding:16px;border-radius:9px;background:#132119;color:#e9f5eb}code{font-family:Consolas,monospace}.media{position:relative;overflow:hidden;padding-top:56.25%}.media iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style>${previewHtml}`} />
          </aside>}
        </div>

        {error && <div className="admin-editor__error" role="alert">{error}</div>}
        <footer className="admin-editor__footer">
          <span className={`admin-unsaved-state ${dirty ? 'is-dirty' : ''}`}>{dirty ? 'Unsaved changes' : 'No unsaved changes'}</span>
          <button type="button" onClick={requestClose}>Cancel</button>
          <button disabled={status === 'saving'} type="button" onClick={(event) => submit(event, 'draft')}>Save draft</button>
          <button className="is-primary" disabled={status === 'saving'} type="button" onClick={(event) => submit(event, 'published')}><AppIcon name="save" />{status === 'saving' ? 'Saving…' : form.status === 'published' ? 'Update published' : 'Publish content'}</button>
        </footer>
      </form>
    </div>
  )
}

function ContentsView({ contents, onRefresh }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [trashed, setTrashed] = useState('')
  const [editor, setEditor] = useState(null)
  const [editingContentId, setEditingContentId] = useState(null)
  const [actionError, setActionError] = useState('')

  async function runSearch(event) {
    event?.preventDefault()
    await onRefresh({ search, status: filter, trashed })
  }

  async function editContent(content) {
    setActionError('')
    setEditingContentId(content.id)
    try {
      const payload = await getAdminContent(content.id)
      setEditor(payload.data)
    } catch (error) {
      setActionError(error.message || 'Unable to load this article for editing.')
    } finally {
      setEditingContentId(null)
    }
  }

  async function remove(content) {
    const confirmed = await confirmAdminAction({
      title: 'Move this content to trash?',
      text: `“${content.title}” will be hidden from the learning pages and can be restored later.`,
      confirmButtonText: 'Move to trash',
    })
    if (!confirmed) return
    setActionError('')
    try {
      await deleteAdminContent(content.id)
      await onRefresh({ search, status: filter, trashed })
      await showAdminSuccess('Moved to trash')
    } catch (error) {
      setActionError(error.message || 'Unable to delete content.')
    }
  }

  async function restore(content) {
    const confirmed = await confirmAdminAction({
      title: 'Restore this content?',
      text: `“${content.title}” will return to the content workspace.`,
      confirmButtonText: 'Restore content',
      icon: 'question',
    })
    if (!confirmed) return
    setActionError('')
    try {
      await restoreAdminContent(content.id)
      await onRefresh({ search, status: filter, trashed })
      await showAdminSuccess('Content restored')
    } catch (error) {
      setActionError(error.message || 'Unable to restore content.')
    }
  }

  return (
    <div className="admin-view">
      <div className="admin-content-toolbar">
        <form onSubmit={runSearch}>
          <input aria-label="Search learning content" placeholder="Search title or slug" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select aria-label="Filter content by publication status" value={filter} onChange={(event) => { const value = event.target.value; setFilter(value); onRefresh({ search, status: value, trashed }) }}><option value="">All status</option><option value="published">Published</option><option value="draft">Draft</option></select>
          <select aria-label="Filter content by trash status" value={trashed} onChange={(event) => { const value = event.target.value; setTrashed(value); onRefresh({ search, status: filter, trashed: value }) }}><option value="">Active content</option><option value="only">Trash</option><option value="with">Active + trash</option></select>
          <button className="admin-search-submit" type="submit" aria-label="Search learning content" title="Search"><AppIcon name="search" /></button>
        </form>
        <button className="admin-primary-button" type="button" onClick={() => setEditor({ ...emptyContent })}><AppIcon name="plus" />New content</button>
      </div>
      {actionError && <div className="admin-inline-error">{actionError}</div>}
      <section className="admin-panel admin-table-panel">
        <table className="admin-table">
          <thead><tr><th className="admin-index-column">#</th><th>Content</th><th>Category</th><th>Status</th><th>Version</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {contents.map((content, index) => (
              <tr className={content.deleted_at ? 'is-trashed' : ''} key={content.id}>
                <td className="admin-index-cell">{index + 1}</td>
                <td><div className="admin-content-cell">{content.cover_image_url ? <img src={resolveAssetUrl(content.cover_image_url)} alt="" /> : <span><AppIcon name="bookmark" /></span>}<div><strong>{content.title}</strong><small>/{content.slug}</small></div></div></td>
                <td>{content.category}</td><td><StatusBadge status={content.deleted_at ? 'archived' : content.status} /></td><td>v{content.version}</td><td>{formatDate(content.updated_at, true)}</td>
                <td><div className="admin-row-actions">{!content.deleted_at && <button disabled={editingContentId !== null} type="button" onClick={() => editContent(content)}><AppIcon name="settings" />{editingContentId === content.id ? 'Loading…' : 'Edit'}</button>}{!content.deleted_at && <button className="is-danger" type="button" aria-label={`Move ${content.title} to trash`} onClick={() => remove(content)}><AppIcon name="trash" /></button>}{content.deleted_at && <button type="button" onClick={() => restore(content)}><AppIcon name="history" />Restore</button>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!contents.length && <div className="admin-empty"><AppIcon name="bookmark" /><strong>No content found</strong><span>Adjust the filter or create a new learning article.</span></div>}
      </section>
      {editor && <ContentEditor content={editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await onRefresh({ search, status: filter, trashed }) }} />}
    </div>
  )
}

function UsersView({ currentUser, usersPayload, onRefresh }) {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [busyUser, setBusyUser] = useState(null)
  const [error, setError] = useState('')
  const users = usersPayload?.data ?? []

  async function changeUser(user, updates) {
    const nextRole = updates.role ?? user.role
    const nextStatus = updates.status ?? user.status
    const confirmed = await confirmAdminAction({
      title: 'Update this account?',
      text: `${user.username} will be changed to role “${nextRole}” with status “${nextStatus}”.`,
      confirmButtonText: 'Update account',
      icon: 'question',
    })
    if (!confirmed) return
    setBusyUser(user.id)
    setError('')
    try {
      await updateAdminUser(user.id, { role: updates.role ?? user.role, status: updates.status ?? user.status })
      await onRefresh({ search, role, page: usersPayload?.current_page ?? 1 })
      await showAdminSuccess('Account updated')
    } catch (updateError) {
      setError(updateError.message || 'Unable to update this account.')
    } finally {
      setBusyUser(null)
    }
  }

  return (
    <div className="admin-view">
      <div className="admin-content-toolbar">
        <form onSubmit={(event) => { event.preventDefault(); onRefresh({ search, role, page: 1 }) }}>
          <input aria-label="Search user accounts" placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select aria-label="Filter accounts by role" value={role} onChange={(event) => { const value = event.target.value; setRole(value); onRefresh({ search, role: value, page: 1 }) }}><option value="">All roles</option><option value="member">Member</option><option value="admin">Admin</option></select>
          <button className="admin-search-submit" type="submit" aria-label="Search user accounts" title="Search"><AppIcon name="search" /></button>
        </form>
        <span className="admin-result-count">{usersPayload?.total ?? 0} accounts</span>
      </div>
      {error && <div className="admin-inline-error">{error}</div>}
      <section className="admin-panel admin-table-panel">
        <table className="admin-table admin-users-table">
          <thead><tr><th className="admin-index-column">#</th><th>User</th><th>Progress</th><th>Simulations</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
          <tbody>{users.map((user, index) => (
            <tr className={busyUser === user.id ? 'is-busy' : ''} key={user.id}>
              <td className="admin-index-cell">{((usersPayload?.current_page ?? 1) - 1) * (usersPayload?.per_page ?? users.length) + index + 1}</td>
              <td><div className="admin-user-cell"><AdminAvatar user={user} /><div><strong>{user.username}{currentUser.id === user.id && <em>YOU</em>}</strong><small>{user.email}</small></div></div></td>
              <td>Level {user.level ?? 1}<small>{Number(user.coin ?? 0).toLocaleString()} coins</small></td><td>{user.simulators_count ?? 0}<small>{user.plant_histories_count ?? 0} harvests</small></td>
              <td><select disabled={busyUser === user.id || currentUser.id === user.id} value={user.role} onChange={(event) => changeUser(user, { role: event.target.value })}><option value="member">Member</option><option value="admin">Admin</option></select></td>
              <td><select className={`is-${user.status}`} disabled={busyUser === user.id || currentUser.id === user.id} value={user.status} onChange={(event) => changeUser(user, { status: event.target.value })}><option value="active">Active</option><option value="suspended">Suspended</option></select></td>
              <td>{formatDate(user.created_at)}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <AdminPagination currentPage={usersPayload?.current_page} lastPage={usersPayload?.last_page} onPageChange={(page) => onRefresh({ search, role, page })} />
    </div>
  )
}

function ResourceEditor({ config, record, lookups, onClose, onSaved }) {
  const [initialForm] = useState(() => ({ ...config.defaults, ...record }))
  const [form, setForm] = useState(initialForm)
  const [imageFiles, setImageFiles] = useState({})
  const [modelBundles, setModelBundles] = useState({})
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const dialogRef = useRef(null)
  const dirty = useMemo(() => dataSnapshot(form) !== dataSnapshot(initialForm) || Object.values(imageFiles).some((file) => file instanceof File) || Object.values(modelBundles).some((bundle) => bundle?.model), [form, imageFiles, initialForm, modelBundles])
  const requestClose = useCallback(async () => {
    if (status !== 'idle') return
    if (dirty && !await confirmDiscardChanges()) return
    onClose()
  }, [dirty, onClose, status])
  useModalLifecycle(requestClose, dialogRef)

  function fieldValue(field) {
    const value = form[field.key]
    if (field.type === 'json') return typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2)
    if (field.type === 'datetime-local') return toDateTimeLocal(value)
    return value ?? ''
  }

  function updateField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value }

      if (key === 'plant_id' && Object.prototype.hasOwnProperty.call(current, 'stage_id')) {
        const selectedStage = (lookups.stages ?? []).find((stage) => String(stage.id) === String(current.stage_id))
        if (!value || !selectedStage || String(selectedStage.plant_id) !== String(value)) {
          next.stage_id = ''
        }
      }

      return next
    })
  }

  function lookupOptions(field) {
    const options = lookups[field.lookup] ?? []
    if (field.lookup !== 'stages') return options
    if (!form.plant_id) return []
    return options.filter((stage) => String(stage.plant_id) === String(form.plant_id))
  }

  function lookupPlaceholder(field) {
    if (field.lookup === 'stages') {
      if (!form.plant_id) return 'Select a plant first'
      if (!lookupOptions(field).length) return 'No stages available for this plant'
      return 'All stages / not specified'
    }
    return field.required ? 'Select a record' : 'All / not specified'
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      const payload = { ...form }
      for (const field of config.fields) {
        if (field.type === 'number' || field.type === 'lookup') payload[field.key] = payload[field.key] === '' ? null : Number(payload[field.key])
        if (field.type === 'boolean') payload[field.key] = Boolean(payload[field.key])
        if (field.type === 'json' && typeof payload[field.key] === 'string') payload[field.key] = payload[field.key].trim() ? JSON.parse(payload[field.key]) : null
        if (field.type === 'datetime-local' && !payload[field.key]) payload[field.key] = null
      }
      if (record?.id) {
        const confirmed = await confirmAdminAction({
          title: `Save changes to ${config.label}?`,
          text: `Record #${record.id} will be updated with the values currently shown in this form.`,
          confirmButtonText: 'Save changes',
          icon: 'question',
        })
        if (!confirmed) return
      }
      setStatus('saving')
      for (const field of config.fields.filter((item) => item.type === 'model-bundle')) {
        const bundle = modelBundles[field.key]
        if (field.required && !payload[field.key] && !bundle?.model) {
          throw new Error(`${field.label} is required.`)
        }
        if (bundle?.model) {
          setStatus('uploading')
          const uploaded = await uploadAdminModelBundle(bundle)
          payload[field.key] = uploaded.reference
        }
      }
      for (const field of config.fields.filter((item) => item.type === 'image-upload')) {
        const file = imageFiles[field.key]
        if (field.required && !payload[field.key] && !(file instanceof File)) {
          throw new Error(`${field.label} is required.`)
        }
        if (file instanceof File) {
          setStatus('uploading')
          const uploaded = await uploadAdminImage({ file, scope: field.scope })
          payload[field.key] = uploaded.reference
        }
      }
      setStatus('saving')
      const result = await saveAdminResource(config.id, payload)
      await onSaved(result.data)
      await showAdminSuccess(record?.id ? 'Changes saved' : 'Record added', record?.id ? 'The record was updated successfully.' : 'The new record was placed at the bottom of the list.')
    } catch (saveError) {
      setError(saveError.message || 'Unable to save this record.')
      setStatus('idle')
    }
  }

  return (
    <div className="admin-editor-backdrop" role="presentation">
      <form ref={dialogRef} className="admin-resource-editor" data-resource={config.id} role="dialog" aria-modal="true" aria-labelledby="admin-resource-editor-title" tabIndex="-1" onSubmit={submit}>
        <header className="admin-editor__header"><div><small>{config.label.toUpperCase()} / {record?.id ? `RECORD #${record.id}` : 'NEW RECORD'}</small><h2 id="admin-resource-editor-title">{record?.id ? `Edit ${config.label}` : config.createLabel}</h2></div><button type="button" onClick={requestClose} aria-label="Close editor">×</button></header>
        <div className="admin-resource-editor__body">
          <div className="admin-resource-form-grid">
            {config.fields.map((field) => (
              field.type === 'image-upload' ? (
                <ImageUploadField
                  disabled={status !== 'idle'}
                  file={imageFiles[field.key]}
                  key={field.key}
                  label={field.label}
                  onFileChange={(file) => setImageFiles((current) => ({ ...current, [field.key]: file }))}
                  onRemove={() => {
                    setImageFiles((current) => ({ ...current, [field.key]: null }))
                    setForm((current) => ({ ...current, [field.key]: '' }))
                  }}
                  required={field.required && !form[field.key]}
                  value={form[field.key]}
                />
              ) : field.type === 'model-bundle' ? (
                <ModelBundleField
                  bundle={modelBundles[field.key]}
                  disabled={status !== 'idle'}
                  key={field.key}
                  label={field.label}
                  onChange={(bundle) => setModelBundles((current) => ({ ...current, [field.key]: bundle }))}
                  required={field.required && !form[field.key]}
                  value={form[field.key]}
                />
              ) : <label className={field.wide ? 'is-wide' : ''} key={field.key}>
                {field.label}{field.required && <em>*</em>}
                {field.type === 'textarea' || field.type === 'json' ? (
                  <textarea className={field.type === 'json' ? 'admin-code-field' : ''} required={field.required} rows={field.type === 'json' ? 8 : 4} value={fieldValue(field)} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} />
                ) : field.type === 'select' ? (
                  <select required={field.required} value={fieldValue(field)} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                ) : field.type === 'lookup' ? (
                  <>
                    <select
                      disabled={field.lookup === 'stages' && (!form.plant_id || !lookupOptions(field).length)}
                      required={field.required}
                      value={fieldValue(field)}
                      onChange={(event) => updateField(field.key, event.target.value)}
                    >
                      <option value="">{lookupPlaceholder(field)}</option>
                      {lookupOptions(field).map((option) => <option key={option.id} value={option.id}>{lookupLabel[field.lookup](option)}</option>)}
                    </select>
                    {field.lookup === 'stages' && !form.plant_id && <small className="admin-field-hint">Choose a plant to show only its growth stages.</small>}
                  </>
                ) : field.type === 'boolean' ? (
                  <button className={`admin-toggle ${form[field.key] ? 'is-active' : ''}`} type="button" role="switch" aria-checked={Boolean(form[field.key])} onClick={() => setForm((current) => ({ ...current, [field.key]: !current[field.key] }))}><i /><span>{form[field.key] ? 'Enabled' : 'Disabled'}</span></button>
                ) : (
                  <input required={field.required} type={field.type || 'text'} step={field.step} value={fieldValue(field)} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} />
                )}
              </label>
            ))}
          </div>
        </div>
        {error && <div className="admin-editor__error">{error}</div>}
        <footer className="admin-editor__footer"><span className={`admin-unsaved-state ${dirty ? 'is-dirty' : ''}`}>{dirty ? 'Unsaved changes' : 'No unsaved changes'}</span><button disabled={status !== 'idle'} type="button" onClick={requestClose}>Cancel</button><button className="is-primary" disabled={status !== 'idle'} type="submit"><AppIcon name="save" />{status === 'uploading' ? 'Uploading files…' : status === 'saving' ? 'Saving…' : 'Save record'}</button></footer>
      </form>
    </div>
  )
}

const detailFieldMap = {
  posts: [
    ['Record ID', 'id'], ['Visibility', 'visibility'], ['Caption', 'caption'], ['Comments', 'comments_count'], ['Likes', 'likes_count'],
    ['Plant history', 'plant_history_id'], ['Simulation', 'simulator_id'], ['Created', 'created_at', 'date'], ['Last updated', 'updated_at', 'date'],
  ],
  comments: [
    ['Record ID', 'id'], ['Moderation status', 'status'], ['Full comment', 'comment_text'], ['Post', 'post_id'], ['Parent comment', 'parent_id'],
    ['Replies', 'replies_count'], ['Likes', 'likes_count'], ['Created', 'created_at', 'date'], ['Last updated', 'updated_at', 'date'],
  ],
  'simulator-comments': [
    ['Record ID', 'id'], ['Moderation status', 'status'], ['Full comment', 'comment_text'], ['Simulation', 'simulator_id'],
    ['Created', 'created_at', 'date'], ['Last updated', 'updated_at', 'date'],
  ],
  simulators: [
    ['Record ID', 'id'], ['Run status', 'status'], ['Sharing', 'share_visibility'], ['Mode', 'mode'], ['Location', 'location_name'],
    ['Health', 'health', 'percent'], ['Growth points', 'growth_point'], ['Visual state', 'visual_state'], ['State version', 'state_version'],
    ['Community posts', 'posts_count'], ['Started', 'started_at', 'date'], ['Ended', 'ended_at', 'date'], ['Last updated', 'updated_at', 'date'],
  ],
  'plant-histories': [
    ['Record ID', 'id'], ['Visibility', 'visibility'], ['Final health', 'final_health', 'percent'], ['Total score', 'total_score'],
    ['Grow time', 'duration_seconds', 'duration'], ['Analysis result', 'analysis_result'], ['Player guidance', 'direction'], ['Created', 'created_at', 'date'],
  ],
  'activity-logs': [
    ['Log ID', 'id'], ['Action', 'action'], ['Target type', 'target_type'], ['Target ID', 'target_id'], ['Details', 'detail'], ['Recorded', 'created_at', 'date'],
  ],
}

function recordDetailValue(record, field, format) {
  const value = record?.[field]
  if (value === null || value === undefined || value === '') return '—'
  if (format === 'date') return formatDate(value, true)
  if (format === 'percent') return `${value}%`
  if (format === 'duration') return formatPlantDuration(record, 'en')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function ResourceDetailsDrawer({ config, record, onClose, onEdit, onDelete, onRestore, onModerate }) {
  const dialogRef = useRef(null)
  useModalLifecycle(onClose, dialogRef)
  const fields = detailFieldMap[config.id] ?? [
    ['Record ID', 'id'],
    ...config.columns.map((column) => [column.label, null, null, column.render(record)]),
    ['Created', 'created_at', 'date'], ['Last updated', 'updated_at', 'date'],
  ]
  const person = record.user ?? record.admin
  const imageUrl = resolveAssetUrl(record.live_snapshot_url || record.snapshot_image_url || '')
  const plantName = record.plant?.name_en || record.plant?.name_th

  return (
    <div className="admin-details-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside ref={dialogRef} className="admin-details-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-details-title" tabIndex="-1">
        <header className="admin-details-drawer__header">
          <div><small>{config.label.toUpperCase()} / RECORD #{record.id}</small><h2 id="admin-details-title">Record details</h2></div>
          <button type="button" onClick={onClose} aria-label="Close details">×</button>
        </header>

        <div className="admin-details-drawer__body">
          {person && (
            <section className="admin-details-person">
              <AdminAvatar user={person} />
              <span><small>{record.user ? 'Account owner' : 'Administrator'}</small><strong>{person.username}</strong><a href={`mailto:${person.email}`}>{person.email}</a></span>
            </section>
          )}

          {(plantName || record.mode) && (
            <section className="admin-details-context">
              <span className="admin-list__content-icon"><AppIcon name="plant" /></span>
              <span><small>Simulation context</small><strong>{plantName || 'Plant not available'}</strong><p>{record.mode ? `${record.mode} mode` : 'Saved plant result'}</p></span>
            </section>
          )}

          {imageUrl && <img className="admin-details-media" src={imageUrl} alt="Simulation or harvested plant preview" onError={(event) => { event.currentTarget.hidden = true }} />}

          {record.deleted_at && <div className="admin-trash-notice"><AppIcon name="history" /><span><strong>This record is in the trash.</strong><small>Restore it to edit or use it again.</small></span></div>}

          {config.moderation && !record.deleted_at && (
            <section className="admin-details-moderation">
              <div><small>MODERATION</small><h3>Review decision</h3><p>Changes are confirmed before they are applied and recorded in the audit log.</p></div>
              <label>{config.statusField.replaceAll('_', ' ')}<select value={record[config.statusField]} onChange={(event) => onModerate(config.statusField, event.target.value)}>{config.statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              {config.extraStatusField && <label>{config.extraStatusField.replaceAll('_', ' ')}<select value={record[config.extraStatusField]} onChange={(event) => onModerate(config.extraStatusField, event.target.value)}>{config.extraStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>}
            </section>
          )}

          <section className="admin-details-fields">
            <div><small>COMPLETE RECORD</small><h3>Available information</h3></div>
            <dl>
              {fields.map(([label, field, format, rendered]) => (
                <div className={(field === 'caption' || field === 'comment_text' || field === 'detail' || field === 'analysis_result' || field === 'direction') ? 'is-wide' : ''} key={`${label}-${field}`}>
                  <dt>{label}</dt><dd>{rendered ?? recordDetailValue(record, field, format)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <footer className="admin-details-drawer__footer">
          {!record.deleted_at && !config.moderation && !config.readOnly && <button type="button" onClick={onEdit}><AppIcon name="settings" />Edit record</button>}
          {!record.deleted_at && !config.readOnly && <button className="is-danger" type="button" onClick={onDelete}><AppIcon name="trash" />Move to trash</button>}
          {record.deleted_at && !config.readOnly && <button type="button" onClick={onRestore}><AppIcon name="history" />Restore record</button>}
          <button className="is-primary" type="button" onClick={onClose}>Done</button>
        </footer>
      </aside>
    </div>
  )
}

function ResourceView({ groupKey }) {
  const configs = resourceGroups[groupKey]
  const [activeResource, setActiveResource] = useState(configs[0].id)
  const [payload, setPayload] = useState(null)
  const [lookups, setLookups] = useState({})
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [trashed, setTrashed] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [appliedFilter, setAppliedFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [refreshState, setRefreshState] = useState('connected')
  const refreshInFlightRef = useRef(false)
  const config = configs.find((item) => item.id === activeResource) ?? configs[0]
  const records = payload?.data ?? []
  const pagination = payload?.current_page ? payload : null

  async function load(resource = activeResource, options = {}, { silent = false } = {}) {
    if (!silent) { setLoading(true); setError('') }
    try {
      const result = await getAdminResource(resource, options)
      setPayload(result)
      setLastUpdatedAt(new Date())
      setRefreshState('connected')
      return result
    } catch (loadError) {
      if (silent) setRefreshState('stale')
      else setError(loadError.message || 'Unable to load this database table.')
      return null
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([getAdminResource(configs[0].id), getAdminResourceLookups()])
      .then(([resourcePayload, lookupPayload]) => {
        if (!cancelled) { setPayload(resourcePayload); setLookups(lookupPayload.data ?? {}); setLastUpdatedAt(new Date()); setRefreshState('connected'); setLoading(false) }
      })
      .catch((loadError) => { if (!cancelled) { setError(loadError.message || 'Unable to load management data.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [configs])

  useEffect(() => {
    let cancelled = false
    let refreshTimer

    const scheduleRefresh = () => {
      if (!cancelled) refreshTimer = window.setTimeout(refresh, ADMIN_TABLE_REFRESH_MS)
    }

    const refresh = async () => {
      const activeElement = document.activeElement
      const isEditingFilter = activeElement?.closest?.('.admin-resource-view') && activeElement.matches('input, select, textarea')
      if (refreshInFlightRef.current || editor || selectedRecord || isEditingFilter || document.visibilityState === 'hidden' || document.querySelector('[role="dialog"]')) {
        scheduleRefresh()
        return
      }
      refreshInFlightRef.current = true
      try {
        const result = await getAdminResource(config.id, { search: appliedSearch, status: appliedFilter, trashed, page: pagination?.current_page ?? 1 })
        if (!cancelled) {
          setPayload(result)
          setLastUpdatedAt(new Date())
          setRefreshState('connected')
        }
      } catch {
        if (!cancelled) setRefreshState('stale')
      } finally {
        refreshInFlightRef.current = false
        scheduleRefresh()
      }
    }

    scheduleRefresh()
    return () => {
      cancelled = true
      window.clearTimeout(refreshTimer)
    }
  }, [appliedFilter, appliedSearch, config.id, editor, pagination?.current_page, selectedRecord, trashed])

  async function chooseResource(resource) {
    setActiveResource(resource)
    setSearch('')
    setFilter('')
    setAppliedSearch('')
    setAppliedFilter('')
    setTrashed('')
    setEditor(null)
    setSelectedRecord(null)
    await load(resource)
  }

  async function updateModeration(record, field, value) {
    const confirmed = await confirmAdminAction({
      title: 'Confirm this change?',
      text: `Record #${record.id} will change ${field.replaceAll('_', ' ')} to “${value}”.`,
      confirmButtonText: 'Apply change',
      icon: 'question',
    })
    if (!confirmed) return
    setError('')
    try {
      const updates = { [config.statusField]: field === config.statusField ? value : record[config.statusField] }
      if (config.extraStatusField) updates[config.extraStatusField] = field === config.extraStatusField ? value : record[config.extraStatusField]
      await saveAdminResource(config.id, { id: record.id, ...updates })
      await load(config.id, { search: appliedSearch, status: appliedFilter, trashed, page: pagination?.current_page ?? 1 })
      setSelectedRecord((current) => current?.id === record.id ? { ...current, [field]: value } : current)
      await showAdminSuccess('Change applied')
      return true
    } catch (updateError) {
      setError(updateError.message || 'Unable to update this record.')
      return false
    }
  }

  async function removeRecord(record) {
    const confirmed = await confirmAdminAction({
      title: 'Move this record to trash?',
      text: `Record #${record.id} from ${config.label} will be hidden from the live system. It can be restored later.`,
      confirmButtonText: 'Move to trash',
    })
    if (!confirmed) return
    try {
      await deleteAdminResource(config.id, record.id)
      await load(config.id, { search: appliedSearch, status: appliedFilter, trashed, page: pagination?.current_page ?? 1 })
      setSelectedRecord(null)
      await showAdminSuccess('Moved to trash')
      return true
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete this record.')
      return false
    }
  }

  async function restoreRecord(record) {
    const confirmed = await confirmAdminAction({
      title: 'Restore this record?',
      text: `Record #${record.id} will become available to the live system again.`,
      confirmButtonText: 'Restore record',
      icon: 'question',
    })
    if (!confirmed) return false
    try {
      await restoreAdminResource(config.id, record.id)
      await load(config.id, { search: appliedSearch, status: appliedFilter, trashed, page: pagination?.current_page ?? 1 })
      setSelectedRecord(null)
      await showAdminSuccess('Record restored')
      return true
    } catch (restoreError) {
      setError(restoreError.message || 'Unable to restore this record.')
      return false
    }
  }

  return (
    <div className="admin-view admin-resource-view">
      <div className="admin-subtable-tabs" role="tablist" aria-label="Database tables">
        {configs.map((item) => <button className={activeResource === item.id ? 'is-active' : ''} type="button" role="tab" aria-selected={activeResource === item.id} key={item.id} onClick={() => chooseResource(item.id)}><AppIcon name={item.icon} /><span>{item.label}</span></button>)}
      </div>

      <div className="admin-content-toolbar">
        <form onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search); setAppliedFilter(filter); load(config.id, { search, status: filter, trashed, page: 1 }) }}>
          <input aria-label={`Search ${config.label}`} placeholder="Search records" value={search} onChange={(event) => setSearch(event.target.value)} />
          {config.statusOptions && <select aria-label={`Filter ${config.label} by status`} value={filter} onChange={(event) => { const value = event.target.value; setFilter(value); setAppliedSearch(search); setAppliedFilter(value); load(config.id, { search, status: value, trashed, page: 1 }) }}><option value="">All status</option>{config.statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>}
          {!config.readOnly && <select aria-label={`Filter ${config.label} by trash status`} value={trashed} onChange={(event) => { const value = event.target.value; setTrashed(value); setAppliedSearch(search); setAppliedFilter(filter); load(config.id, { search, status: filter, trashed: value, page: 1 }) }}><option value="">Active records</option><option value="only">Trash</option><option value="with">Active + trash</option></select>}
          <button className="admin-search-submit" type="submit" aria-label={`Search ${config.label}`} title="Search"><AppIcon name="search" /></button>
        </form>
        {!config.moderation && !config.readOnly && <button className="admin-primary-button" type="button" onClick={() => setEditor({ ...config.defaults })}><AppIcon name="plus" />{config.createLabel}</button>}
        {config.readOnly && <span className="admin-readonly-label"><AppIcon name="shield" />Read-only audit evidence</span>}
        <span className={`admin-refresh-state is-${refreshState}`}><i />{refreshState === 'stale' ? 'Update delayed' : 'Live data'}<small>{lastUpdatedAt ? `Last updated ${lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Connecting…'}</small></span>
      </div>

      {error && <div className="admin-inline-error">{error}</div>}
      <section className="admin-panel admin-table-panel">
        {loading ? <div className="admin-resource-loading"><AdminTableSkeleton embedded /></div> : (
          <table className="admin-table admin-resource-table">
            <thead><tr><th className="admin-index-column">#</th>{config.columns.map((column) => <th key={column.label}>{column.label}</th>)}{!config.readOnly && <th>Status</th>}<th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{records.map((record, index) => (
              <tr className={record.deleted_at ? 'is-trashed' : ''} key={record.id}>
                <td className="admin-index-cell">{pagination ? (pagination.current_page - 1) * pagination.per_page + index + 1 : index + 1}</td>
                {config.columns.map((column) => <td key={column.label}><span className="admin-table-value">{column.render(record) ?? '—'}</span></td>)}
                {!config.readOnly && <td>{record.deleted_at ? <StatusBadge status="archived" /> : config.moderation ? <div className="admin-moderation-controls"><select aria-label={`Change ${config.statusField.replaceAll('_', ' ')} for record #${record.id}`} value={record[config.statusField]} onChange={(event) => updateModeration(record, config.statusField, event.target.value)}>{config.statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>{config.extraStatusField && <select aria-label={`Change ${config.extraStatusField.replaceAll('_', ' ')} for record #${record.id}`} value={record[config.extraStatusField]} onChange={(event) => updateModeration(record, config.extraStatusField, event.target.value)}>{config.extraStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>}</div> : <StatusBadge status={record.is_active === false ? 'disabled' : 'active'} />}</td>}
                <td><div className="admin-row-actions"><button type="button" onClick={() => setSelectedRecord(record)}><AppIcon name="eye" />View</button>{!record.deleted_at && !config.moderation && !config.readOnly && <button type="button" onClick={() => setEditor(record)}><AppIcon name="settings" />Edit</button>}{!record.deleted_at && !config.readOnly && <button className="is-danger" type="button" aria-label={`Move record #${record.id} to trash`} onClick={() => removeRecord(record)}><AppIcon name="trash" /></button>}{record.deleted_at && <button type="button" onClick={() => restoreRecord(record)}><AppIcon name="history" />Restore</button>}</div></td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {!loading && !records.length && <div className="admin-empty"><AppIcon name={config.icon} /><strong>No records found</strong><span>This database table does not have matching records yet.</span></div>}
      </section>

      {pagination && <AdminPagination currentPage={pagination.current_page} lastPage={pagination.last_page} onPageChange={(page) => load(config.id, { search: appliedSearch, status: appliedFilter, trashed, page })} />}
      {selectedRecord && <ResourceDetailsDrawer config={config} record={selectedRecord} onClose={() => setSelectedRecord(null)} onEdit={() => { setEditor(selectedRecord); setSelectedRecord(null) }} onDelete={() => removeRecord(selectedRecord)} onRestore={() => restoreRecord(selectedRecord)} onModerate={(field, value) => updateModeration(selectedRecord, field, value)} />}
      {editor && <ResourceEditor config={config} record={editor} lookups={lookups} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); const [lookupPayload] = await Promise.all([getAdminResourceLookups(), load(config.id, { search: appliedSearch, status: appliedFilter, trashed })]); setLookups(lookupPayload.data ?? {}) }} />}
    </div>
  )
}

const validAdminSections = new Set(navigationGroups.flatMap((group) => group.items.map((item) => item.id)))

function adminSectionFromLocation() {
  const section = new URL(window.location.href).searchParams.get('admin')
  return validAdminSections.has(section) ? section : 'dashboard'
}

function writeAdminSectionToHistory(section, method = 'pushState') {
  const url = new URL(window.location.href)
  url.searchParams.set('admin', section)
  window.history[method]({ ...window.history.state, adminSection: section }, '', url)
}

export function AdminPage({ user, onLogout }) {
  const [section, setSection] = useState(adminSectionFromLocation)
  const [dashboard, setDashboard] = useState(null)
  const [contents, setContents] = useState([])
  const [users, setUsers] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [preferences, setPreferences] = useState(loadAdminPreferences)
  const [language, setLanguage] = useState(() => loadSettings().language === 'th' ? 'th' : 'en')
  const [trendSelection, setTrendSelection] = useState(defaultTrendSelection)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [refreshState, setRefreshState] = useState('connecting')
  const contentFiltersRef = useRef({})
  const userFiltersRef = useRef({})
  const usersPayloadRef = useRef(null)
  const usersRequestRef = useRef(null)
  const dashboardRequestRef = useRef(0)
  const trendSelectionRef = useRef(defaultTrendSelection())
  const refreshInFlightRef = useRef(false)
  const initialSectionRef = useRef(section)

  const sectionMeta = useMemo(() => ({
    dashboard: ['Academy overview', 'Monitor learning activity and system health.'],
    contents: ['Learning content', 'Create, review, and publish bilingual educational articles.'],
    users: ['Users & access', 'Manage learner status and administrator permissions.'],
    plants: ['Plants & growth data', 'Manage plant profiles, growth stages, condition rules, and visual states.'],
    pests: ['Pests & occurrence rules', 'Maintain pest definitions and the environmental rules that trigger them.'],
    store: ['Items & shop', 'Manage usable items, effects, prices, stock, and availability.'],
    progression: ['Quests & achievements', 'Configure player goals, rewards, and achievement milestones.'],
    models: ['3D model assets', 'Maintain reusable model files and structured asset metadata.'],
    community: ['Community moderation', 'Review posts and moderate comments across community and game sessions.'],
    simulations: ['Simulation records', 'Review simulation runs and harvested plant histories.'],
    activity: ['Administrator activity', 'Review an immutable audit trail of management actions.'],
  }[section]), [section])
  const refreshIntervalSeconds = section === 'dashboard' ? ADMIN_DASHBOARD_REFRESH_MS / 1000 : ADMIN_TABLE_REFRESH_MS / 1000

  const loadDashboard = useCallback(async ({ silent = false, selection = trendSelectionRef.current } = {}) => {
    const requestId = ++dashboardRequestRef.current
    trendSelectionRef.current = selection
    if (!silent) { setStatus('loading'); setError('') }
    try {
      const payload = await getAdminDashboard(selection)
      if (requestId !== dashboardRequestRef.current) return
      setDashboard(payload.data)
      setLastUpdatedAt(new Date())
      setRefreshState('connected')
      if (!silent) setStatus('ready')
    } catch (loadError) {
      if (requestId !== dashboardRequestRef.current) return
      setRefreshState('stale')
      if (!silent) { setError(loadError.message || 'Unable to load admin dashboard.'); setStatus('error') }
    }
  }, [])

  const loadContents = useCallback(async (filters, { silent = false } = {}) => {
    if (filters) contentFiltersRef.current = filters
    const activeFilters = filters ?? contentFiltersRef.current
    if (!silent) { setStatus('loading'); setError('') }
    try {
      const payload = await getAdminContents(activeFilters)
      setContents(payload.data ?? [])
      setLastUpdatedAt(new Date())
      setRefreshState('connected')
      if (!silent) setStatus('ready')
    } catch (loadError) {
      setRefreshState('stale')
      if (!silent) { setError(loadError.message || 'Unable to load content.'); setStatus('error') }
    }
  }, [])

  const loadUsers = useCallback(async (filters, { silent = false, affectRefreshState = true } = {}) => {
    const activeFilters = filters ?? userFiltersRef.current
    const normalizedFilters = {
      search: activeFilters.search ?? '',
      role: activeFilters.role ?? '',
      page: Number(activeFilters.page ?? 1),
    }
    userFiltersRef.current = normalizedFilters
    const requestKey = JSON.stringify(normalizedFilters)
    if (!silent) { setStatus(usersPayloadRef.current ? 'ready' : 'loading'); setError('') }

    try {
      if (!usersRequestRef.current || usersRequestRef.current.key !== requestKey) {
        usersRequestRef.current = { key: requestKey, promise: getAdminUsers(normalizedFilters) }
      }
      const activeRequest = usersRequestRef.current.promise
      const payload = await activeRequest
      usersPayloadRef.current = payload
      setUsers(payload)
      if (affectRefreshState) {
        setLastUpdatedAt(new Date())
        setRefreshState('connected')
      }
      if (!silent) setStatus('ready')
    } catch (loadError) {
      if (affectRefreshState) setRefreshState('stale')
      if (!silent) { setError(loadError.message || 'Unable to load users.'); setStatus('error') }
    } finally {
      if (usersRequestRef.current?.key === requestKey) usersRequestRef.current = null
    }
  }, [])

  const loadSection = useCallback((nextSection) => {
    setSection(nextSection)
    if (nextSection === 'dashboard') loadDashboard()
    if (nextSection === 'contents') loadContents()
    if (nextSection === 'users') loadUsers()
    if (resourceGroups[nextSection]) { setError(''); setStatus('ready'); setRefreshState('connected'); setLastUpdatedAt(new Date()) }
  }, [loadContents, loadDashboard, loadUsers])

  function openSection(nextSection) {
    if (!validAdminSections.has(nextSection)) return
    if (nextSection !== section) writeAdminSectionToHistory(nextSection)
    loadSection(nextSection)
  }

  function updatePreferences(updates) {
    setPreferences((current) => {
      const next = { ...current, ...updates }
      window.localStorage.setItem(adminPreferenceKey, JSON.stringify(next))
      return next
    })
  }

  function changeLanguage(nextLanguage) {
    const normalized = nextLanguage === 'th' ? 'th' : 'en'
    setLanguage(normalized)
    saveSettings({ ...loadSettings(), language: normalized })
  }

  useEffect(() => {
    writeAdminSectionToHistory(initialSectionRef.current, 'replaceState')
    const initialLoadTimer = window.setTimeout(() => loadSection(initialSectionRef.current), 0)
    return () => window.clearTimeout(initialLoadTimer)
  }, [loadSection])

  useEffect(() => {
    const restoreSection = () => loadSection(adminSectionFromLocation())
    window.addEventListener('popstate', restoreSection)
    return () => window.removeEventListener('popstate', restoreSection)
  }, [loadSection])

  useEffect(() => {
    if (section !== 'dashboard' || usersPayloadRef.current) return undefined
    const preloadTimer = window.setTimeout(() => {
      loadUsers(undefined, { silent: true, affectRefreshState: false })
    }, 1200)
    return () => window.clearTimeout(preloadTimer)
  }, [loadUsers, section])

  useEffect(() => {
    let cancelled = false
    let refreshTimer
    const refreshDelay = section === 'dashboard' ? ADMIN_DASHBOARD_REFRESH_MS : ADMIN_TABLE_REFRESH_MS

    const scheduleRefresh = () => {
      if (!cancelled) refreshTimer = window.setTimeout(refresh, refreshDelay)
    }

    const refresh = async () => {
      const activeElement = document.activeElement
      const isEditing = activeElement?.matches?.('input, select, textarea, [contenteditable="true"]')
      if (refreshInFlightRef.current || isEditing || document.visibilityState === 'hidden' || document.querySelector('[role="dialog"]') || document.querySelector('.admin-users-table tr.is-busy')) {
        scheduleRefresh()
        return
      }
      refreshInFlightRef.current = true
      try {
        if (section === 'dashboard') await loadDashboard({ silent: true })
        if (section === 'contents') await loadContents(undefined, { silent: true })
        if (section === 'users') await loadUsers(undefined, { silent: true })
      } finally {
        refreshInFlightRef.current = false
        scheduleRefresh()
      }
    }

    scheduleRefresh()
    return () => {
      cancelled = true
      window.clearTimeout(refreshTimer)
    }
  }, [loadContents, loadDashboard, loadUsers, section])

  function changeTrendSelection(selection) {
    setTrendSelection(selection)
    trendSelectionRef.current = selection
    setRefreshState('connecting')
    loadDashboard({ silent: true, selection })
  }

  return (
    <main className={`admin-shell admin-theme--${preferences.theme} ${preferences.collapsed ? 'is-sidebar-collapsed' : ''} ${preferences.textSize === 'large' ? 'is-text-large' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-brand"><img src={plantGrowthLogo} alt="Plant Growth Academy" /><span><strong>Plant Growth</strong><small>ADMIN CONSOLE</small></span><button type="button" onClick={() => updatePreferences({ collapsed: !preferences.collapsed })} aria-label={preferences.collapsed ? 'Expand navigation' : 'Collapse navigation'} title={preferences.collapsed ? 'Expand navigation' : 'Collapse navigation'}><AppIcon name={preferences.collapsed ? 'panelOpen' : 'panelClose'} /></button></div>
        <nav aria-label="Admin navigation">
          {navigationGroups.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <small>{group.label}</small>
              {group.items.filter((item) => !hiddenAdminNavigationItems.has(item.id)).map((item) => <button className={section === item.id ? 'is-active' : ''} type="button" key={item.id} title={preferences.collapsed ? item.label : undefined} onClick={() => openSection(item.id)}><AppIcon name={item.icon} /><b>{item.label}</b><span /></button>)}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar__account"><AdminAvatar user={user} /><span><strong>{user.username}</strong><small>Administrator</small></span><button type="button" onClick={onLogout} aria-label="Log out"><AppIcon name="logout" /></button></div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div><small>ADMINISTRATION / {section.toUpperCase()}</small><h1>{sectionMeta[0]}</h1><p>{sectionMeta[1]}</p></div>
          <div className="admin-topbar__actions">
            <span className={`admin-system-status is-${refreshState}`}><AppIcon name="live" /><i />{refreshState === 'connecting' ? 'Connecting data' : refreshState === 'stale' ? 'Update delayed' : 'Live data'}<em>{lastUpdatedAt ? `Last updated ${lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Auto ${refreshIntervalSeconds}s` : `Auto refresh · ${refreshIntervalSeconds}s`}</em></span>
            <div className="admin-language-switch" role="group" aria-label="Interface language"><AppIcon name="translate" /><button className={language === 'en' ? 'is-active' : ''} type="button" onClick={() => changeLanguage('en')} aria-pressed={language === 'en'}>EN</button><button className={language === 'th' ? 'is-active' : ''} type="button" onClick={() => changeLanguage('th')} aria-pressed={language === 'th'}>ไทย</button></div>
            <button className="admin-text-size-button" type="button" onClick={() => updatePreferences({ textSize: preferences.textSize === 'large' ? 'default' : 'large' })} aria-label={preferences.textSize === 'large' ? 'Use standard text size' : 'Use large text size'} aria-pressed={preferences.textSize === 'large'} title={preferences.textSize === 'large' ? 'Standard text size' : 'Large text size'}>{preferences.textSize === 'large' ? 'A' : 'A+'}</button>
            <button type="button" onClick={() => updatePreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })} aria-label={preferences.theme === 'dark' ? 'Use light theme' : 'Use dark theme'} title={preferences.theme === 'dark' ? 'Use light theme' : 'Use dark theme'}><AppIcon name={preferences.theme === 'dark' ? 'lightMode' : 'darkMode'} /></button>
            <time>{formatDate(new Date())}</time>
          </div>
        </header>

        <div className="admin-content">
          {status === 'loading' && <div className="admin-loading">{section === 'dashboard' ? <AdminDashboardSkeleton /> : <AdminTableSkeleton />}</div>}
          {status === 'error' && <div className="admin-error"><AppIcon name="shield" /><h2>Unable to load this section</h2><p>{error}</p><button type="button" onClick={() => openSection(section)}>Try again</button></div>}
          {status === 'ready' && section === 'dashboard' && <DashboardView data={dashboard} trendSelection={trendSelection} onChangeTrendSelection={changeTrendSelection} onOpenSection={openSection} theme={preferences.theme} />}
          {status === 'ready' && section === 'contents' && <ContentsView contents={contents} onRefresh={loadContents} />}
          {status === 'ready' && section === 'users' && <UsersView currentUser={user} usersPayload={users} onRefresh={loadUsers} />}
          {status === 'ready' && resourceGroups[section] && <ResourceView key={section} groupKey={section} />}
        </div>
      </section>
    </main>
  )
}
