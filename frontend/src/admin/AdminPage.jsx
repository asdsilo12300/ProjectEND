import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import plantGrowthLogo from '../assets/Logo for Plant Growth Academy Simulation Game-Photoroom.png'
import { AppIcon } from '../game/icons/IconifyIcon'
import { loadSettings, saveSettings } from '../game/settings/settingsPreferences'
import {
  deleteAdminContent,
  deleteAdminResource,
  getAdminContents,
  getAdminDashboard,
  getAdminResource,
  getAdminResourceLookups,
  getAdminUsers,
  saveAdminResource,
  saveAdminContent,
  updateAdminUser,
} from '../lib/api'
import './AdminPage.css'

const adminPreferenceKey = 'plant-growth-admin-preferences'

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

function useModalLifecycle(onClose) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])
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
      defaults: { name_th: '', name_en: '', description: '', base_image_url: '', base_model_url: '', water_min: 40, water_max: 80, light_min: 40, light_max: 90, fertilizer_min: 20, fertilizer_max: 70, soil_humidity_min: 40, soil_humidity_max: 80, air_humidity_min: 40, air_humidity_max: 80, soil_temp_min: 18, soil_temp_max: 32, air_temp_min: 18, air_temp_max: 35 },
      fields: [
        { key: 'name_en', label: 'English name', required: true }, { key: 'name_th', label: 'Thai name', required: true },
        { key: 'description', label: 'Description', type: 'textarea', wide: true }, { key: 'base_image_url', label: 'Image URL', wide: true }, { key: 'base_model_url', label: 'Base 3D model URL', wide: true },
        ...['water', 'light', 'fertilizer', 'soil_humidity', 'air_humidity', 'soil_temp', 'air_temp'].flatMap((factor) => [
          { key: `${factor}_min`, label: `${factor.replaceAll('_', ' ')} min`, type: 'number', required: true },
          { key: `${factor}_max`, label: `${factor.replaceAll('_', ' ')} max`, type: 'number', required: true },
        ]),
      ],
      columns: [
        { label: 'Plant', render: (row) => row.name_en || row.name_th },
        { label: 'Thai name', render: (row) => row.name_th },
        { label: 'Water / light', render: (row) => `${row.water_min}–${row.water_max} / ${row.light_min}–${row.light_max}` },
        { label: 'Subtables', render: (row) => `${row.stages_count} stages · ${row.condition_rules_count} rules · ${row.visual_variants_count} visuals` },
      ],
    },
    {
      id: 'plant-stages', label: 'Growth stages', createLabel: 'New stage', icon: 'sprout',
      defaults: { plant_id: '', stage_no: 1, stage_name: '', required_growth_point: 0, image_url: '', model_url: '', description: '' },
      fields: [{ key: 'plant_id', label: 'Plant', type: 'lookup', lookup: 'plants', required: true }, { key: 'stage_no', label: 'Stage number', type: 'number', required: true }, { key: 'stage_name', label: 'Stage name', required: true }, { key: 'required_growth_point', label: 'Required growth points', type: 'number', required: true }, { key: 'image_url', label: 'Image URL', wide: true }, { key: 'model_url', label: '3D model URL', wide: true }, { key: 'description', label: 'Description', type: 'textarea', wide: true }],
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
      fields: [{ key: 'plant_id', label: 'Plant', type: 'lookup', lookup: 'plants', required: true }, { key: 'stage_id', label: 'Growth stage', type: 'lookup', lookup: 'stages' }, { key: 'state_key', label: 'State key', required: true }, { key: 'label', label: 'Display label' }, { key: 'model_url', label: '3D model URL', wide: true }, { key: 'leaf_color', label: 'Leaf color' }, { key: 'stem_color', label: 'Stem color' }, { key: 'leaf_state', label: 'Leaf state' }, { key: 'stem_state', label: 'Stem state' }, { key: 'scale', label: 'Scale', type: 'number', step: '0.01', required: true }, { key: 'priority', label: 'Priority', type: 'number', required: true }, commonActiveField],
      columns: [{ label: 'Plant', render: (row) => row.plant?.name_en || row.plant?.name_th }, { label: 'State', render: (row) => row.label || row.state_key }, { label: 'Stage', render: (row) => row.stage?.stage_name || 'All stages' }, { label: 'Appearance', render: (row) => `${row.leaf_color || '—'} / ${row.stem_color || '—'}` }],
    },
  ],
  pests: [
    { id: 'pests', label: 'Pest catalog', createLabel: 'New pest', icon: 'pest', defaults: { name_th: '', name_en: '', description: '', image_url: '', model_url: '', base_chance: 0, damage_per_turn: 0, behavior: '' }, fields: [{ key: 'name_en', label: 'English name' }, { key: 'name_th', label: 'Thai name', required: true }, { key: 'description', label: 'Description', type: 'textarea', wide: true }, { key: 'image_url', label: 'Image URL', wide: true }, { key: 'model_url', label: '3D model URL', wide: true }, { key: 'base_chance', label: 'Base chance (%)', type: 'number', step: '0.01', required: true }, { key: 'damage_per_turn', label: 'Damage per turn', type: 'number', required: true }, { key: 'behavior', label: 'Behavior notes', type: 'textarea', wide: true }], columns: [{ label: 'Pest', render: (row) => row.name_en || row.name_th }, { label: 'Thai name', render: (row) => row.name_th }, { label: 'Base chance', render: (row) => `${row.base_chance}%` }, { label: 'Rules / damage', render: (row) => `${row.condition_rules_count} rules · ${row.damage_per_turn} damage` }] },
    { id: 'pest-rules', label: 'Occurrence rules', createLabel: 'New pest rule', icon: 'bug', defaults: { pest_id: '', plant_id: '', factor: 'air_humidity', operator: 'above', min_value: 0, max_value: 100, chance_delta: 0, severity: 1, is_active: true }, fields: [{ key: 'pest_id', label: 'Pest', type: 'lookup', lookup: 'pests', required: true }, { key: 'plant_id', label: 'Specific plant (optional)', type: 'lookup', lookup: 'plants' }, { key: 'factor', label: 'Factor', required: true }, { key: 'operator', label: 'Operator', type: 'select', options: ['below', 'above', 'between', 'outside'], required: true }, { key: 'min_value', label: 'Minimum', type: 'number' }, { key: 'max_value', label: 'Maximum', type: 'number' }, { key: 'chance_delta', label: 'Chance change', type: 'number', step: '0.01', required: true }, { key: 'severity', label: 'Severity', type: 'number', required: true }, commonActiveField], columns: [{ label: 'Pest', render: (row) => row.pest?.name_en || row.pest?.name_th }, { label: 'Plant', render: (row) => row.plant?.name_en || row.plant?.name_th || 'All plants' }, { label: 'Condition', render: (row) => `${row.factor} ${row.operator} ${row.min_value ?? ''}${row.max_value !== null ? `–${row.max_value}` : ''}` }, { label: 'Chance / severity', render: (row) => `${row.chance_delta} / ${row.severity}` }] },
  ],
  store: [
    { id: 'items', label: 'Item catalog', createLabel: 'New item', icon: 'shop', defaults: { name: '', type: 'pesticide', description: '', image_url: '', effect_type: '', effect_value: 0, rarity: 'common', is_active: true }, fields: [{ key: 'name', label: 'Item name', required: true }, { key: 'type', label: 'Type', type: 'select', options: ['seed', 'water', 'fertilizer', 'pesticide', 'booster', 'cosmetic'], required: true }, { key: 'description', label: 'Description', type: 'textarea', wide: true }, { key: 'image_url', label: 'Image URL', wide: true }, { key: 'effect_type', label: 'Effect type' }, { key: 'effect_value', label: 'Effect value', type: 'number', required: true }, { key: 'rarity', label: 'Rarity', type: 'select', options: ['common', 'rare', 'epic', 'legendary'], required: true }, commonActiveField], columns: [{ label: 'Item', render: (row) => row.name }, { label: 'Type', render: (row) => row.type }, { label: 'Effect', render: (row) => `${row.effect_type || '—'} ${row.effect_value}` }, { label: 'Rarity', render: (row) => row.rarity }] },
    { id: 'shop-items', label: 'Shop listings', createLabel: 'New listing', icon: 'shoppingCart', defaults: { item_id: '', price_coin: 0, price_gem: 0, stock_limit: '', is_active: true, starts_at: '', ends_at: '' }, fields: [{ key: 'item_id', label: 'Item', type: 'lookup', lookup: 'items', required: true }, { key: 'price_coin', label: 'Coin price', type: 'number', required: true }, { key: 'price_gem', label: 'Gem price', type: 'number', required: true }, { key: 'stock_limit', label: 'Stock limit', type: 'number' }, { key: 'starts_at', label: 'Starts at', type: 'datetime-local' }, { key: 'ends_at', label: 'Ends at', type: 'datetime-local' }, commonActiveField], columns: [{ label: 'Item', render: (row) => row.item?.name }, { label: 'Type', render: (row) => row.item?.type }, { label: 'Price', render: (row) => `${row.price_coin} coins / ${row.price_gem} gems` }, { label: 'Stock', render: (row) => row.stock_limit ?? 'Unlimited' }] },
  ],
  progression: [
    { id: 'quests', label: 'Quests', createLabel: 'New quest', icon: 'trophy', defaults: { title: '', description: '', quest_type: 'daily', target_type: '', target_value: 1, reward_exp: 0, reward_coin: 0, reward_gem: 0, is_active: true }, fields: [{ key: 'title', label: 'Quest title', required: true }, { key: 'quest_type', label: 'Quest type', type: 'select', options: ['daily', 'weekly', 'story', 'event'], required: true }, { key: 'description', label: 'Description', type: 'textarea', wide: true }, { key: 'target_type', label: 'Target type', required: true }, { key: 'target_value', label: 'Target value', type: 'number', required: true }, { key: 'reward_exp', label: 'EXP reward', type: 'number', required: true }, { key: 'reward_coin', label: 'Coin reward', type: 'number', required: true }, { key: 'reward_gem', label: 'Gem reward', type: 'number', required: true }, commonActiveField], columns: [{ label: 'Quest', render: (row) => row.title }, { label: 'Type', render: (row) => row.quest_type }, { label: 'Target', render: (row) => `${row.target_type} × ${row.target_value}` }, { label: 'Rewards', render: (row) => `${row.reward_exp} EXP · ${row.reward_coin} coins` }] },
    { id: 'achievements', label: 'Achievements', createLabel: 'New achievement', icon: 'crown', defaults: { title: '', description: '', condition_type: '', condition_value: 1, reward_exp: 0, reward_coin: 0, badge_image_url: '', is_active: true }, fields: [{ key: 'title', label: 'Achievement title', required: true }, { key: 'condition_type', label: 'Condition type', required: true }, { key: 'description', label: 'Description', type: 'textarea', wide: true }, { key: 'condition_value', label: 'Condition value', type: 'number', required: true }, { key: 'reward_exp', label: 'EXP reward', type: 'number', required: true }, { key: 'reward_coin', label: 'Coin reward', type: 'number', required: true }, { key: 'badge_image_url', label: 'Badge image URL', wide: true }, commonActiveField], columns: [{ label: 'Achievement', render: (row) => row.title }, { label: 'Condition', render: (row) => `${row.condition_type} × ${row.condition_value}` }, { label: 'Rewards', render: (row) => `${row.reward_exp} EXP · ${row.reward_coin} coins` }, { label: 'Badge', render: (row) => row.badge_image_url ? 'Configured' : 'Not set' }] },
  ],
  models: [
    { id: 'model-assets', label: 'Model assets', createLabel: 'New model asset', icon: 'hardware', defaults: { asset_key: '', label: '', type: 'model', url: '', metadata: {} }, fields: [{ key: 'asset_key', label: 'Asset key', required: true }, { key: 'label', label: 'Display label' }, { key: 'type', label: 'Asset type', required: true }, { key: 'url', label: 'File URL', required: true, wide: true }, { key: 'metadata', label: 'Metadata (JSON)', type: 'json', wide: true }], columns: [{ label: 'Asset', render: (row) => row.label || row.asset_key }, { label: 'Key', render: (row) => row.asset_key }, { label: 'Type', render: (row) => row.type }, { label: 'URL', render: (row) => row.url }] },
  ],
  community: [
    { id: 'posts', label: 'Posts', icon: 'chat', moderation: true, statusField: 'visibility', statusOptions: ['public', 'friends', 'private'], columns: [{ label: 'Author', render: (row) => row.user?.username }, { label: 'Caption', render: (row) => row.caption || 'No caption' }, { label: 'Engagement', render: (row) => `${row.comments_count} comments · ${row.likes_count} likes` }, { label: 'Created', render: (row) => formatDate(row.created_at, true) }] },
    { id: 'comments', label: 'Post comments', icon: 'chat', moderation: true, statusField: 'status', statusOptions: ['visible', 'hidden', 'suspended'], columns: [{ label: 'Author', render: (row) => row.user?.username }, { label: 'Comment', render: (row) => row.comment_text }, { label: 'Thread', render: (row) => `${row.replies_count} replies · ${row.likes_count} likes` }, { label: 'Created', render: (row) => formatDate(row.created_at, true) }] },
    { id: 'simulator-comments', label: 'Game comments', icon: 'live', moderation: true, statusField: 'status', statusOptions: ['visible', 'hidden', 'suspended'], columns: [{ label: 'Author', render: (row) => row.user?.username }, { label: 'Comment', render: (row) => row.comment_text }, { label: 'Simulation', render: (row) => `#${row.simulator_id}` }, { label: 'Created', render: (row) => formatDate(row.created_at, true) }] },
  ],
  simulations: [
    { id: 'simulators', label: 'Simulations', icon: 'controller', moderation: true, statusField: 'status', statusOptions: ['active', 'completed', 'failed', 'cancelled'], extraStatusField: 'share_visibility', extraStatusOptions: ['private', 'friends', 'public'], columns: [{ label: 'Owner', render: (row) => row.user?.username }, { label: 'Plant / mode', render: (row) => `${row.plant?.name_en || row.plant?.name_th || 'Unknown'} · ${row.mode}` }, { label: 'Health / growth', render: (row) => `${row.health}% / ${row.growth_point} pts` }, { label: 'Started', render: (row) => formatDate(row.started_at, true) }] },
    { id: 'plant-histories', label: 'Plant histories', icon: 'history', moderation: true, statusField: 'visibility', statusOptions: ['private', 'friends', 'public'], columns: [{ label: 'Owner', render: (row) => row.user?.username }, { label: 'Plant', render: (row) => row.plant?.name_en || row.plant?.name_th }, { label: 'Result', render: (row) => `${row.final_health}% health · ${row.total_score} score` }, { label: 'Created', render: (row) => formatDate(row.created_at, true) }] },
  ],
  activity: [
    { id: 'activity-logs', label: 'Admin activity log', icon: 'history', readOnly: true, columns: [{ label: 'Administrator', render: (row) => row.admin?.username }, { label: 'Action', render: (row) => row.action }, { label: 'Target', render: (row) => `${row.target_type || 'system'} #${row.target_id || '—'}` }, { label: 'Time', render: (row) => formatDate(row.created_at, true) }] },
  ],
}

const emptyContent = {
  slug: '', category: 'plant-science', icon: 'eco', eyebrow: '', eyebrow_th: '',
  title: '', title_th: '', summary: '', summary_th: '', body_html: '<h2>Section heading</h2>\n<p>Write the lesson content here.</p>',
  body_html_th: '<h2>หัวข้อเนื้อหา</h2>\n<p>เขียนเนื้อหาบทเรียนที่นี่</p>', cover_image_url: '', cover_image_alt: '', cover_image_alt_th: '',
  image_credit: '', image_credit_url: '', reading_minutes: 5, sort_order: 0, status: 'draft', published_at: null, references: [],
}

function formatDate(value, includeTime = false) {
  if (!value) return '—'
  const locale = document.documentElement.lang === 'th' ? 'th-TH' : 'en-GB'
  return new Intl.DateTimeFormat(locale, includeTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

function StatusBadge({ status }) {
  return <span className={`admin-status admin-status--${status}`}>{status}</span>
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

function TrendChart({ trend = [] }) {
  const maximum = Math.max(1, ...trend.flatMap((day) => [day.users, day.simulations]))

  return (
    <div className="admin-trend" role="img" aria-label={`${trend.length} day user and simulation activity chart`}>
      <div className="admin-trend__axis"><span>{maximum}</span><span>{Math.ceil(maximum / 2)}</span><span>0</span></div>
      <div className="admin-trend__scroller">
        <div className="admin-trend__plot" style={{ gridTemplateColumns: `repeat(${Math.max(trend.length, 1)}, minmax(28px, 1fr))`, minWidth: trend.length > 14 ? `${trend.length * 32}px` : undefined }}>
          {[0, 1, 2].map((line) => <i className="admin-trend__gridline" key={line} />)}
          {trend.map((day) => (
            <div className="admin-trend__day" key={day.date}>
              <div className="admin-trend__bars">
                <span className="admin-trend__bar admin-trend__bar--users" style={{ height: `${Math.max(4, (day.users / maximum) * 100)}%` }} title={`${day.users} new users on ${day.date}`} />
                <span className="admin-trend__bar admin-trend__bar--simulations" style={{ height: `${Math.max(4, (day.simulations / maximum) * 100)}%` }} title={`${day.simulations} simulations on ${day.date}`} />
              </div>
              <small>{day.label}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DashboardView({ data, days, onChangeDays, onOpenSection }) {
  const metrics = data?.metrics ?? {}
  const totalContent = (metrics.published_contents ?? 0) + (metrics.draft_contents ?? 0)
  const publishedPercent = totalContent ? Math.round((metrics.published_contents / totalContent) * 100) : 0

  return (
    <div className="admin-view admin-dashboard-view">
      <div className="admin-metric-grid">
        <MetricCard icon="groups" label="Total Users" value={metrics.users} detail={`${metrics.active_users ?? 0} active accounts`} />
        <MetricCard icon="controller" label="Simulations" value={metrics.simulations} detail={`${metrics.harvests ?? 0} completed harvests`} tone="blue" />
        <MetricCard icon="bookmark" label="Published lessons" value={metrics.published_contents} detail={`${metrics.draft_contents ?? 0} drafts waiting`} tone="gold" />
        <MetricCard icon="chat" label="Community posts" value={metrics.community_posts} detail="Shared learning activity" tone="violet" />
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-panel admin-panel--trend">
          <header className="admin-panel__header">
            <div><small>ACTIVITY</small><h2>Academy growth</h2></div>
            <div className="admin-panel__tools">
              <div className="admin-chart-legend"><span><i className="is-users" />New users</span><span><i className="is-simulations" />Simulations</span></div>
              <div className="admin-range-switch" role="group" aria-label="Activity period">
                {[7, 14, 30].map((period) => <button className={days === period ? 'is-active' : ''} type="button" aria-pressed={days === period} key={period} onClick={() => onChangeDays(period)}>{period}D</button>)}
              </div>
            </div>
          </header>
          <TrendChart trend={data?.trend} />
        </section>

        <section className="admin-panel admin-publish-panel">
          <header className="admin-panel__header"><div><small>CONTENT HEALTH</small><h2>Publication</h2></div></header>
          <div className="admin-publish-panel__body">
            <div className="admin-publish-ring" style={{ '--publish-progress': `${publishedPercent * 3.6}deg` }}><span><strong>{publishedPercent}%</strong><small>published</small></span></div>
            <dl>
              <div><dt><i className="is-published" />Published</dt><dd>{metrics.published_contents ?? 0}</dd></div>
              <div><dt><i className="is-draft" />Draft</dt><dd>{metrics.draft_contents ?? 0}</dd></div>
            </dl>
            <button type="button" onClick={() => onOpenSection('contents')}>Manage content<AppIcon name="arrowForward" /></button>
          </div>
        </section>
      </div>

      <div className="admin-dashboard-grid admin-dashboard-grid--tables">
        <section className="admin-panel">
          <header className="admin-panel__header"><div><small>NEW ACCOUNTS</small><h2>Recent Users</h2></div><button type="button" onClick={() => onOpenSection('users')}>View all</button></header>
          <div className="admin-list">
            {(data?.recent_users ?? []).map((user) => (
              <div className="admin-list__row" key={user.id}>
                <span className="admin-avatar">{user.username?.slice(0, 1).toUpperCase()}</span>
                <span><strong>{user.username}</strong><small>{user.email}</small></span>
                <StatusBadge status={user.role} />
                <time>{formatDate(user.created_at)}</time>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <header className="admin-panel__header"><div><small>RECENTLY EDITED</small><h2>Learning content</h2></div><button type="button" onClick={() => onOpenSection('contents')}>View all</button></header>
          <div className="admin-list">
            {(data?.recent_contents ?? []).map((content) => (
              <div className="admin-list__row admin-list__row--content" key={content.id}>
                <span className="admin-list__content-icon"><AppIcon name="bookmark" /></span>
                <span><strong>{content.title}</strong><small>Version {content.version}</small></span>
                <StatusBadge status={content.status} />
                <time>{formatDate(content.updated_at)}</time>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function ContentEditor({ content, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...emptyContent, ...content }))
  const [language, setLanguage] = useState('en')
  const [referencesText, setReferencesText] = useState(() => JSON.stringify(content?.references ?? [], null, 2))
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  useModalLifecycle(onClose)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      const references = referencesText.trim() ? JSON.parse(referencesText) : []
      if (!Array.isArray(references)) throw new Error('References must be a JSON array.')
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
      const payload = await saveAdminContent({
        ...form,
        references,
        reading_minutes: Number(form.reading_minutes),
        sort_order: Number(form.sort_order),
        published_at: form.published_at || null,
      })
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
      <form className="admin-editor" role="dialog" aria-modal="true" aria-labelledby="admin-content-editor-title" onSubmit={submit}>
        <header className="admin-editor__header">
          <div><small>{form.id ? `CONTENT / VERSION ${form.version}` : 'CONTENT / NEW ARTICLE'}</small><h2 id="admin-content-editor-title">{form.id ? 'Edit learning content' : 'Create learning content'}</h2></div>
          <button type="button" onClick={onClose} aria-label="Close editor">×</button>
        </header>

        <div className="admin-editor__toolbar">
          <div className="admin-editor__language"><button className={language === 'en' ? 'is-active' : ''} type="button" onClick={() => setLanguage('en')}>English</button><button className={language === 'th' ? 'is-active' : ''} type="button" onClick={() => setLanguage('th')}>ไทย</button></div>
          <label>Status<select value={form.status} onChange={(event) => update('status', event.target.value)}><option value="draft">Draft</option><option value="published">Published</option></select></label>
        </div>

        <div className="admin-editor__body">
          <div className="admin-editor__form">
            <section>
              <h3>Article identity</h3>
              <div className="admin-form-grid">
                <label className="is-wide">{language === 'th' ? 'ชื่อบทความ (ไทย)' : 'Article title (English)'}<input required value={language === 'th' ? form.title_th : form.title} onChange={(event) => update(language === 'th' ? 'title_th' : 'title', event.target.value)} /></label>
                <label>Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => update('slug', event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} /></label>
                <label>Category<input required value={form.category} onChange={(event) => update('category', event.target.value)} /></label>
                <label>{language === 'th' ? 'ป้ายกำกับ (ไทย)' : 'Eyebrow (English)'}<input value={language === 'th' ? form.eyebrow_th : form.eyebrow} onChange={(event) => update(language === 'th' ? 'eyebrow_th' : 'eyebrow', event.target.value)} /></label>
                <label>Reading minutes<input min="1" max="60" type="number" value={form.reading_minutes} onChange={(event) => update('reading_minutes', event.target.value)} /></label>
                <label>Sort order<input min="0" max="999" type="number" value={form.sort_order} onChange={(event) => update('sort_order', event.target.value)} /></label>
              </div>
            </section>

            <section>
              <h3>Summary & HTML body</h3>
              <label>{language === 'th' ? 'สรุปบทความ (ไทย)' : 'Article summary (English)'}<textarea required rows="3" value={language === 'th' ? form.summary_th : form.summary} onChange={(event) => update(language === 'th' ? 'summary_th' : 'summary', event.target.value)} /></label>
              <label>{language === 'th' ? 'เนื้อหา HTML (ไทย)' : 'HTML content (English)'}<textarea className="admin-code-field" required rows="15" spellCheck="false" value={previewHtml} onChange={(event) => update(language === 'th' ? 'body_html_th' : 'body_html', event.target.value)} /></label>
            </section>

            <section>
              <h3>Cover image & sources</h3>
              <div className="admin-form-grid">
                <label className="is-wide">Cover image URL<input value={form.cover_image_url ?? ''} onChange={(event) => update('cover_image_url', event.target.value)} /></label>
                <label>{language === 'th' ? 'คำอธิบายรูป (ไทย)' : 'Image alt text (English)'}<input value={language === 'th' ? form.cover_image_alt_th ?? '' : form.cover_image_alt ?? ''} onChange={(event) => update(language === 'th' ? 'cover_image_alt_th' : 'cover_image_alt', event.target.value)} /></label>
                <label>Image credit<input value={form.image_credit ?? ''} onChange={(event) => update('image_credit', event.target.value)} /></label>
                <label className="is-wide">Image credit URL<input value={form.image_credit_url ?? ''} onChange={(event) => update('image_credit_url', event.target.value)} /></label>
              </div>
              <label>References (JSON array)<textarea className="admin-code-field" rows="7" spellCheck="false" value={referencesText} onChange={(event) => setReferencesText(event.target.value)} /></label>
            </section>
          </div>

          <aside className="admin-editor__preview">
            <div><span>LIVE PREVIEW</span><strong>{language === 'th' ? form.title_th : form.title || 'Untitled article'}</strong></div>
            {form.cover_image_url && <img src={form.cover_image_url} alt="" />}
            <iframe title="Article HTML preview" sandbox="" srcDoc={`<!doctype html><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px;color:#1c2b21;line-height:1.7}h2{margin-top:28px;color:#163b23}img{max-width:100%}.article-callout{padding:16px;border-left:4px solid #75b45c;background:#edf6e9}</style>${previewHtml}`} />
          </aside>
        </div>

        {error && <div className="admin-editor__error" role="alert">{error}</div>}
        <footer className="admin-editor__footer"><button type="button" onClick={onClose}>Cancel</button><button className="is-primary" disabled={status === 'saving'} type="submit"><AppIcon name="save" />{status === 'saving' ? 'Saving…' : 'Save content'}</button></footer>
      </form>
    </div>
  )
}

function ContentsView({ contents, onRefresh }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [editor, setEditor] = useState(null)
  const [actionError, setActionError] = useState('')

  async function runSearch(event) {
    event?.preventDefault()
    await onRefresh({ search, status: filter })
  }

  async function remove(content) {
    const confirmed = await confirmAdminAction({
      title: 'Delete this content?',
      text: `“${content.title}” will be permanently removed. This action cannot be undone.`,
      confirmButtonText: 'Delete content',
    })
    if (!confirmed) return
    setActionError('')
    try {
      await deleteAdminContent(content.id)
      await onRefresh({ search, status: filter })
      await showAdminSuccess('Content deleted')
    } catch (error) {
      setActionError(error.message || 'Unable to delete content.')
    }
  }

  return (
    <div className="admin-view">
      <div className="admin-content-toolbar">
        <form onSubmit={runSearch}><AppIcon name="search" /><input placeholder="Search title or slug" value={search} onChange={(event) => setSearch(event.target.value)} /><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All status</option><option value="published">Published</option><option value="draft">Draft</option></select><button type="submit">Filter</button></form>
        <button className="admin-primary-button" type="button" onClick={() => setEditor({ ...emptyContent })}><AppIcon name="plus" />New content</button>
      </div>
      {actionError && <div className="admin-inline-error">{actionError}</div>}
      <section className="admin-panel admin-table-panel">
        <table className="admin-table">
          <thead><tr><th className="admin-index-column">#</th><th>Content</th><th>Category</th><th>Status</th><th>Version</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {contents.map((content, index) => (
              <tr key={content.id}>
                <td className="admin-index-cell">{index + 1}</td>
                <td><div className="admin-content-cell">{content.cover_image_url ? <img src={content.cover_image_url} alt="" /> : <span><AppIcon name="bookmark" /></span>}<div><strong>{content.title}</strong><small>/{content.slug}</small></div></div></td>
                <td>{content.category}</td><td><StatusBadge status={content.status} /></td><td>v{content.version}</td><td>{formatDate(content.updated_at, true)}</td>
                <td><div className="admin-row-actions"><button type="button" onClick={() => setEditor(content)}><AppIcon name="settings" />Edit</button><button className="is-danger" type="button" aria-label={`Delete ${content.title}`} onClick={() => remove(content)}><AppIcon name="trash" /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!contents.length && <div className="admin-empty"><AppIcon name="bookmark" /><strong>No content found</strong><span>Adjust the filter or create a new learning article.</span></div>}
      </section>
      {editor && <ContentEditor content={editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await onRefresh({ search, status: filter }) }} />}
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
        <form onSubmit={(event) => { event.preventDefault(); onRefresh({ search, role, page: 1 }) }}><AppIcon name="search" /><input placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} /><select value={role} onChange={(event) => setRole(event.target.value)}><option value="">All roles</option><option value="member">Member</option><option value="admin">Admin</option></select><button type="submit">Filter</button></form>
        <span className="admin-result-count">{usersPayload?.total ?? 0} accounts</span>
      </div>
      {error && <div className="admin-inline-error">{error}</div>}
      <section className="admin-panel admin-table-panel">
        <table className="admin-table admin-users-table">
          <thead><tr><th className="admin-index-column">#</th><th>User</th><th>Progress</th><th>Simulations</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
          <tbody>{users.map((user, index) => (
            <tr className={busyUser === user.id ? 'is-busy' : ''} key={user.id}>
              <td className="admin-index-cell">{((usersPayload?.current_page ?? 1) - 1) * (usersPayload?.per_page ?? users.length) + index + 1}</td>
              <td><div className="admin-user-cell"><span className="admin-avatar">{user.username?.slice(0, 1).toUpperCase()}</span><div><strong>{user.username}{currentUser.id === user.id && <em>YOU</em>}</strong><small>{user.email}</small></div></div></td>
              <td>Level {user.level ?? 1}<small>{Number(user.coin ?? 0).toLocaleString()} coins</small></td><td>{user.simulators_count ?? 0}<small>{user.plant_histories_count ?? 0} harvests</small></td>
              <td><select disabled={busyUser === user.id || currentUser.id === user.id} value={user.role} onChange={(event) => changeUser(user, { role: event.target.value })}><option value="member">Member</option><option value="admin">Admin</option></select></td>
              <td><select className={`is-${user.status}`} disabled={busyUser === user.id || currentUser.id === user.id} value={user.status} onChange={(event) => changeUser(user, { status: event.target.value })}><option value="active">Active</option><option value="suspended">Suspended</option></select></td>
              <td>{formatDate(user.created_at)}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <div className="admin-pagination"><button disabled={!usersPayload?.prev_page_url} type="button" onClick={() => onRefresh({ search, role, page: usersPayload.current_page - 1 })}><AppIcon name="arrowBack" />Previous</button><span>Page {usersPayload?.current_page ?? 1} of {usersPayload?.last_page ?? 1}</span><button disabled={!usersPayload?.next_page_url} type="button" onClick={() => onRefresh({ search, role, page: usersPayload.current_page + 1 })}>Next<AppIcon name="arrowForward" /></button></div>
    </div>
  )
}

function ResourceEditor({ config, record, lookups, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...config.defaults, ...record }))
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  useModalLifecycle(onClose)

  function fieldValue(field) {
    const value = form[field.key]
    if (field.type === 'json') return typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2)
    if (field.type === 'datetime-local') return toDateTimeLocal(value)
    return value ?? ''
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
      <form className="admin-resource-editor" data-resource={config.id} role="dialog" aria-modal="true" aria-labelledby="admin-resource-editor-title" onSubmit={submit}>
        <header className="admin-editor__header"><div><small>{config.label.toUpperCase()} / {record?.id ? `RECORD #${record.id}` : 'NEW RECORD'}</small><h2 id="admin-resource-editor-title">{record?.id ? `Edit ${config.label}` : config.createLabel}</h2></div><button type="button" onClick={onClose} aria-label="Close editor">×</button></header>
        <div className="admin-resource-editor__body">
          <div className="admin-resource-form-grid">
            {config.fields.map((field) => (
              <label className={field.wide ? 'is-wide' : ''} key={field.key}>
                {field.label}{field.required && <em>*</em>}
                {field.type === 'textarea' || field.type === 'json' ? (
                  <textarea className={field.type === 'json' ? 'admin-code-field' : ''} required={field.required} rows={field.type === 'json' ? 8 : 4} value={fieldValue(field)} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} />
                ) : field.type === 'select' ? (
                  <select required={field.required} value={fieldValue(field)} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                ) : field.type === 'lookup' ? (
                  <select required={field.required} value={fieldValue(field)} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}><option value="">{field.required ? 'Select a record' : 'All / not specified'}</option>{(lookups[field.lookup] ?? []).map((option) => <option key={option.id} value={option.id}>{lookupLabel[field.lookup](option)}</option>)}</select>
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
        <footer className="admin-editor__footer"><button type="button" onClick={onClose}>Cancel</button><button className="is-primary" disabled={status === 'saving'} type="submit"><AppIcon name="save" />{status === 'saving' ? 'Saving…' : 'Save record'}</button></footer>
      </form>
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const config = configs.find((item) => item.id === activeResource) ?? configs[0]
  const records = payload?.data ?? []
  const pagination = payload?.mode === 'catalog' ? null : payload

  async function load(resource = activeResource, options = {}) {
    setLoading(true)
    setError('')
    try {
      const result = await getAdminResource(resource, options)
      setPayload(result)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load this database table.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([getAdminResource(configs[0].id), getAdminResourceLookups()])
      .then(([resourcePayload, lookupPayload]) => {
        if (!cancelled) { setPayload(resourcePayload); setLookups(lookupPayload.data ?? {}); setLoading(false) }
      })
      .catch((loadError) => { if (!cancelled) { setError(loadError.message || 'Unable to load management data.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [configs])

  useEffect(() => {
    if (editor) return undefined
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'hidden' || document.querySelector('[role="dialog"]')) return
      getAdminResource(config.id, { search, status: filter, page: pagination?.current_page ?? 1 })
        .then((result) => setPayload(result))
        .catch(() => {})
    }, 2000)
    return () => window.clearInterval(refreshTimer)
  }, [config.id, editor, filter, pagination?.current_page, search])

  async function chooseResource(resource) {
    setActiveResource(resource)
    setSearch('')
    setFilter('')
    setEditor(null)
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
      await load(config.id, { search, status: filter, page: pagination?.current_page ?? 1 })
      await showAdminSuccess('Change applied')
    } catch (updateError) {
      setError(updateError.message || 'Unable to update this record.')
    }
  }

  async function removeRecord(record) {
    const confirmed = await confirmAdminAction({
      title: 'Delete this record?',
      text: `Record #${record.id} from ${config.label} will be permanently removed. This action cannot be undone.`,
      confirmButtonText: 'Delete record',
    })
    if (!confirmed) return
    try {
      await deleteAdminResource(config.id, record.id)
      await load(config.id, { search, status: filter, page: pagination?.current_page ?? 1 })
      await showAdminSuccess('Record deleted')
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete this record.')
    }
  }

  return (
    <div className="admin-view admin-resource-view">
      <div className="admin-subtable-tabs" role="tablist" aria-label="Database tables">
        {configs.map((item) => <button className={activeResource === item.id ? 'is-active' : ''} type="button" role="tab" aria-selected={activeResource === item.id} key={item.id} onClick={() => chooseResource(item.id)}><AppIcon name={item.icon} /><span>{item.label}</span></button>)}
      </div>

      <div className="admin-content-toolbar">
        <form onSubmit={(event) => { event.preventDefault(); load(config.id, { search, status: filter }) }}><AppIcon name="search" /><input placeholder="Search records" value={search} onChange={(event) => setSearch(event.target.value)} />{config.statusOptions && <select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All status</option>{config.statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>}<button type="submit">Filter</button></form>
        {!config.moderation && !config.readOnly && <button className="admin-primary-button" type="button" onClick={() => setEditor({ ...config.defaults })}><AppIcon name="plus" />{config.createLabel}</button>}
        {config.readOnly && <span className="admin-readonly-label"><AppIcon name="shield" />Read-only audit evidence</span>}
      </div>

      {error && <div className="admin-inline-error">{error}</div>}
      <section className="admin-panel admin-table-panel">
        {loading ? <div className="admin-resource-loading"><span /><strong>Loading records…</strong></div> : (
          <table className="admin-table admin-resource-table">
            <thead><tr><th className="admin-index-column">#</th>{config.columns.map((column) => <th key={column.label}>{column.label}</th>)}{!config.readOnly && <th>Status</th>}<th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{records.map((record, index) => (
              <tr key={record.id}>
                <td className="admin-index-cell">{pagination ? (pagination.current_page - 1) * pagination.per_page + index + 1 : index + 1}</td>
                {config.columns.map((column) => <td key={column.label}><span className="admin-table-value">{column.render(record) ?? '—'}</span></td>)}
                {!config.readOnly && <td>{config.moderation ? <div className="admin-moderation-controls"><select value={record[config.statusField]} onChange={(event) => updateModeration(record, config.statusField, event.target.value)}>{config.statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>{config.extraStatusField && <select value={record[config.extraStatusField]} onChange={(event) => updateModeration(record, config.extraStatusField, event.target.value)}>{config.extraStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>}</div> : <StatusBadge status={record.is_active === false ? 'disabled' : 'active'} />}</td>}
                <td><div className="admin-row-actions">{!config.moderation && !config.readOnly && <button type="button" onClick={() => setEditor(record)}><AppIcon name="settings" />Edit</button>}{!config.readOnly && <button className="is-danger" type="button" aria-label={`Delete record #${record.id}`} onClick={() => removeRecord(record)}><AppIcon name="trash" /></button>}</div></td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {!loading && !records.length && <div className="admin-empty"><AppIcon name={config.icon} /><strong>No records found</strong><span>This database table does not have matching records yet.</span></div>}
      </section>

      {pagination && <div className="admin-pagination"><button disabled={!pagination.prev_page_url} type="button" onClick={() => load(config.id, { search, status: filter, page: pagination.current_page - 1 })}><AppIcon name="arrowBack" />Previous</button><span>Page {pagination.current_page} of {pagination.last_page}</span><button disabled={!pagination.next_page_url} type="button" onClick={() => load(config.id, { search, status: filter, page: pagination.current_page + 1 })}>Next<AppIcon name="arrowForward" /></button></div>}
      {editor && <ResourceEditor config={config} record={editor} lookups={lookups} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await load(config.id, { search, status: filter }) }} />}
    </div>
  )
}

export function AdminPage({ user, onLogout }) {
  const [section, setSection] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [contents, setContents] = useState([])
  const [users, setUsers] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [preferences, setPreferences] = useState(loadAdminPreferences)
  const [language, setLanguage] = useState(() => loadSettings().language === 'th' ? 'th' : 'en')
  const [trendDays, setTrendDays] = useState(7)
  const contentFiltersRef = useRef({})
  const userFiltersRef = useRef({})
  const trendDaysRef = useRef(7)
  const refreshInFlightRef = useRef(false)

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

  const loadDashboard = useCallback(async ({ silent = false, days = trendDaysRef.current } = {}) => {
    trendDaysRef.current = days
    if (!silent) { setStatus('loading'); setError('') }
    try {
      const payload = await getAdminDashboard(days)
      setDashboard(payload.data)
      if (!silent) setStatus('ready')
    } catch (loadError) {
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
      if (!silent) setStatus('ready')
    } catch (loadError) {
      if (!silent) { setError(loadError.message || 'Unable to load content.'); setStatus('error') }
    }
  }, [])

  const loadUsers = useCallback(async (filters, { silent = false } = {}) => {
    if (filters) userFiltersRef.current = filters
    const activeFilters = filters ?? userFiltersRef.current
    if (!silent) { setStatus('loading'); setError('') }
    try {
      const payload = await getAdminUsers(activeFilters)
      setUsers(payload)
      if (!silent) setStatus('ready')
    } catch (loadError) {
      if (!silent) { setError(loadError.message || 'Unable to load users.'); setStatus('error') }
    }
  }, [])

  function openSection(nextSection) {
    setSection(nextSection)
    if (nextSection === 'dashboard') loadDashboard()
    if (nextSection === 'contents') loadContents()
    if (nextSection === 'users') loadUsers()
    if (resourceGroups[nextSection]) { setError(''); setStatus('ready') }
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
    const initialLoadTimer = window.setTimeout(() => loadDashboard(), 0)
    return () => window.clearTimeout(initialLoadTimer)
  }, [loadDashboard])

  useEffect(() => {
    const refreshTimer = window.setInterval(async () => {
      if (refreshInFlightRef.current || document.visibilityState === 'hidden' || document.querySelector('[role="dialog"]') || document.querySelector('.admin-users-table tr.is-busy')) return
      refreshInFlightRef.current = true
      try {
        if (section === 'dashboard') await loadDashboard({ silent: true })
        if (section === 'contents') await loadContents(undefined, { silent: true })
        if (section === 'users') await loadUsers(undefined, { silent: true })
      } finally {
        refreshInFlightRef.current = false
      }
    }, 2000)
    return () => window.clearInterval(refreshTimer)
  }, [loadContents, loadDashboard, loadUsers, section])

  function changeTrendPeriod(days) {
    setTrendDays(days)
    trendDaysRef.current = days
    loadDashboard({ silent: true, days })
  }

  return (
    <main className={`admin-shell admin-theme--${preferences.theme} ${preferences.collapsed ? 'is-sidebar-collapsed' : ''} ${preferences.textSize === 'large' ? 'is-text-large' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-brand"><img src={plantGrowthLogo} alt="Plant Growth Academy" /><span><strong>Plant Growth</strong><small>ADMIN CONSOLE</small></span><button type="button" onClick={() => updatePreferences({ collapsed: !preferences.collapsed })} aria-label={preferences.collapsed ? 'Expand navigation' : 'Collapse navigation'} title={preferences.collapsed ? 'Expand navigation' : 'Collapse navigation'}><AppIcon name={preferences.collapsed ? 'panelOpen' : 'panelClose'} /></button></div>
        <nav aria-label="Admin navigation">
          {navigationGroups.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <small>{group.label}</small>
              {group.items.map((item) => <button className={section === item.id ? 'is-active' : ''} type="button" key={item.id} title={preferences.collapsed ? item.label : undefined} onClick={() => openSection(item.id)}><AppIcon name={item.icon} /><b>{item.label}</b><span /></button>)}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar__account"><span className="admin-avatar">{user.username?.slice(0, 1).toUpperCase()}</span><span><strong>{user.username}</strong><small>Administrator</small></span><button type="button" onClick={onLogout} aria-label="Log out"><AppIcon name="logout" /></button></div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div><small>ADMINISTRATION / {section.toUpperCase()}</small><h1>{sectionMeta[0]}</h1><p>{sectionMeta[1]}</p></div>
          <div className="admin-topbar__actions">
            <span className="admin-system-status"><AppIcon name="live" /><i />System online<em>Auto · 2s</em></span>
            <div className="admin-language-switch" role="group" aria-label="Interface language"><AppIcon name="translate" /><button className={language === 'en' ? 'is-active' : ''} type="button" onClick={() => changeLanguage('en')} aria-pressed={language === 'en'}>EN</button><button className={language === 'th' ? 'is-active' : ''} type="button" onClick={() => changeLanguage('th')} aria-pressed={language === 'th'}>ไทย</button></div>
            <button className="admin-text-size-button" type="button" onClick={() => updatePreferences({ textSize: preferences.textSize === 'large' ? 'default' : 'large' })} aria-label={preferences.textSize === 'large' ? 'Use standard text size' : 'Use large text size'} aria-pressed={preferences.textSize === 'large'} title={preferences.textSize === 'large' ? 'Standard text size' : 'Large text size'}>{preferences.textSize === 'large' ? 'A' : 'A+'}</button>
            <button type="button" onClick={() => updatePreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })} aria-label={preferences.theme === 'dark' ? 'Use light theme' : 'Use dark theme'} title={preferences.theme === 'dark' ? 'Use light theme' : 'Use dark theme'}><AppIcon name={preferences.theme === 'dark' ? 'lightMode' : 'darkMode'} /></button>
            <time>{formatDate(new Date())}</time>
          </div>
        </header>

        <div className="admin-content">
          {status === 'loading' && <div className="admin-loading"><span /><strong>Loading management data…</strong></div>}
          {status === 'error' && <div className="admin-error"><AppIcon name="shield" /><h2>Unable to load this section</h2><p>{error}</p><button type="button" onClick={() => openSection(section)}>Try again</button></div>}
          {status === 'ready' && section === 'dashboard' && <DashboardView data={dashboard} days={trendDays} onChangeDays={changeTrendPeriod} onOpenSection={openSection} />}
          {status === 'ready' && section === 'contents' && <ContentsView contents={contents} onRefresh={loadContents} />}
          {status === 'ready' && section === 'users' && <UsersView currentUser={user} usersPayload={users} onRefresh={loadUsers} />}
          {status === 'ready' && resourceGroups[section] && <ResourceView key={section} groupKey={section} />}
        </div>
      </section>
    </main>
  )
}
