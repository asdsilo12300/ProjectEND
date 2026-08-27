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
  generateAdminPlantSetup,
  getAdminResource,
  getAdminResourceLookups,
  getAdminUsers,
  getAdminIssueReportSummary,
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
import { IssueReportsAdminView } from './IssueReportsAdminView'
import { adminText, useAdminLanguage } from './adminI18n'
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
  const language = document.documentElement.lang === 'th' ? 'th' : 'en'
  const result = await Swal.fire({
    ...adminAlertTheme(),
    title: adminText(language, title),
    text: adminText(language, text),
    icon,
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: true,
    buttonsStyling: false,
    confirmButtonText: adminText(language, confirmButtonText),
    cancelButtonText: adminText(language, 'Cancel'),
  })

  return result.isConfirmed
}

function showAdminSuccess(title, text = '') {
  const language = document.documentElement.lang === 'th' ? 'th' : 'en'
  return Swal.fire({
    ...adminAlertTheme(),
    title: adminText(language, title),
    text: adminText(language, text),
    icon: 'success',
    timer: 1400,
    timerProgressBar: true,
    showConfirmButton: false,
  })
}

function AdminSelectionCheckbox({ checked = false, disabled = false, indeterminate = false, label, onChange }) {
  const inputRef = useRef(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <label className="admin-selection-checkbox">
      <input
        aria-label={label}
        checked={checked}
        disabled={disabled}
        ref={inputRef}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span aria-hidden="true"><AppIcon name="check" /></span>
    </label>
  )
}

function AdminBulkDeleteBar({ busy = false, count = 0, language = 'en', onClear, onDelete }) {
  const isThai = language === 'th'

  return (
    <div className="admin-bulk-bar" role="toolbar" aria-label={isThai ? 'คำสั่งสำหรับรายการที่เลือก' : 'Selected row actions'}>
      <div>
        <span className="admin-bulk-bar__count">{count}</span>
        <span><strong>{isThai ? `เลือกแล้ว ${count} รายการ` : `${count} selected`}</strong><small>{isThai ? 'คำสั่งสำหรับรายการที่เลือก: ลบเท่านั้น' : 'Available action: delete only'}</small></span>
      </div>
      <div>
        <button disabled={busy} type="button" onClick={onClear}>{isThai ? 'ยกเลิกการเลือก' : 'Clear selection'}</button>
        <button className="is-danger" disabled={busy} type="button" onClick={onDelete}><AppIcon name="trash" />{busy ? (isThai ? 'กำลังลบ…' : 'Deleting…') : (isThai ? `ลบ ${count} รายการ` : `Delete ${count}`)}</button>
      </div>
    </div>
  )
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
    { id: 'contents', icon: 'bookmark', label: 'Content library' },
    { id: 'users', icon: 'groups', label: 'Users & access' },
  ] },
  { label: 'SIMULATION DATA', items: [
    { id: 'plants', icon: 'plant', label: 'Plants' },
    { id: 'pests', icon: 'pest', label: 'Pests & rules' },
    { id: 'store', icon: 'shop', label: 'Items & store' },
    { id: 'events', icon: 'live', label: 'Events & situations' },
    { id: 'modeRewards', icon: 'coin', label: 'Mode rewards' },
    { id: 'progression', icon: 'trophy', label: 'Progression' },
    { id: 'models', icon: 'hardware', label: 'Model assets' },
  ] },
  { label: 'MODERATION', items: [
    { id: 'community', icon: 'chat', label: 'Posts & comments' },
    { id: 'simulations', icon: 'controller', label: 'Simulation records' },
  ] },
  { label: 'SUPPORT', items: [
    { id: 'reports', icon: 'warning', label: 'Problem reports' },
  ] },
  { label: 'AUDIT', items: [
    { id: 'activity', icon: 'history', label: 'Admin activity' },
  ] },
]

// Keep these sections available in the codebase while their admin tools are not ready to expose.
const hiddenAdminNavigationItems = new Set(['progression', 'models'])

const lookupLabel = {
  plants: (row) => document.documentElement.lang === 'th' ? row.name_th || row.name_en : row.name_en || row.name_th,
  stages: (row) => `${row.stage_no}. ${row.stage_name}`,
  pests: (row) => document.documentElement.lang === 'th' ? row.name_th || row.name_en : row.name_en || row.name_th,
  items: (row) => row.name,
}

function localizedAdminName(row) {
  if (!row) return ''
  return document.documentElement.lang === 'th'
    ? row.name_th || row.name_en
    : row.name_en || row.name_th
}

const environmentFactorOptions = [
  { value: 'water', label: 'Water' },
  { value: 'light', label: 'Light' },
  { value: 'fertilizer', label: 'Fertilizer' },
  { value: 'soil_humidity', label: 'Soil moisture' },
  { value: 'air_humidity', label: 'Air humidity' },
  { value: 'soil_temp', label: 'Soil temperature' },
  { value: 'air_temp', label: 'Air temperature' },
]
const visualStateOptions = [
  'healthy', 'underwatered', 'overwatered', 'dry_soil', 'waterlogged', 'low_light',
  'nutrient_deficient', 'fertilizer_burn', 'burnt', 'heat_stress', 'cold_stress',
  'dry_air', 'fungal_risk', 'botrytis', 'wind_stress', 'stunted',
]
const leafStateOptions = ['normal', 'upright', 'wilted', 'drooping', 'yellowing', 'pale', 'spotted', 'burnt_edges', 'root_burn', 'darkened', 'small']
const stemStateOptions = ['normal', 'upright', 'leaning', 'soft', 'thin', 'dry', 'slow', 'short']
const severityOptions = Array.from({ length: 10 }, (_, index) => ({ value: index + 1, label: `${index + 1} / 10` }))
const itemEffectTypeOptions = [
  { value: '', label: 'No legacy effect' },
  ...['water', 'fertilizer', 'drainage', 'shade', 'windbreak', 'frost-cover', 'mulch'].map((key) => ({ value: `environment:${key}`, label: `Environment · ${key.replaceAll('-', ' ')}` })),
  { value: 'manual_pest_control:aphid,snail', label: 'Manual pest control · aphid and snail' },
  { value: 'pest_control:aphid', label: 'Pest control · aphid' },
  { value: 'pest_control:snail', label: 'Pest control · snail' },
  { value: 'pest_control:fungus', label: 'Pest control · fungus' },
  { value: 'friend_pest:aphid', label: 'Friend prank · aphid' },
  { value: 'friend_pest:snail', label: 'Friend prank · snail' },
]
const itemActionOptions = [
  { value: '', label: 'No simulation action' },
  ...['water', 'fertilizer', 'drainage', 'shade', 'windbreak', 'frost-cover', 'mulch', 'manual-pest-control', 'aphid-treatment', 'snail-treatment', 'fungus-treatment'].map((value) => ({ value, label: value.replaceAll('-', ' ') })),
]
const itemAnimationOptions = [
  { value: '', label: 'No 3D animation' },
  ...['watering-can', 'fertilizer-pour', 'soil-mix', 'shade-cover', 'windbreak', 'frost-cover', 'straw-mulch', 'hand-pick', 'pest-spray'].map((value) => ({ value, label: value.replaceAll('-', ' ') })),
]
const itemEffectPresets = {
  'environment:water': { action_key: 'water', animation_key: 'watering-can', effect_payload: { strategy: 'refill_reserve', resource: 'water', duration_ticks: 1, duration_seconds: 30 } },
  'environment:fertilizer': { action_key: 'fertilizer', animation_key: 'fertilizer-pour', effect_payload: { strategy: 'refill_reserve', resource: 'fertilizer', duration_ticks: 1, duration_seconds: 30 } },
  'environment:drainage': { action_key: 'drainage', animation_key: 'soil-mix', effect_payload: { strategy: 'drainage', resource: 'soil_humidity', duration_ticks: 2, duration_seconds: 30 } },
  'environment:shade': { action_key: 'shade', animation_key: 'shade-cover', effect_payload: { strategy: 'toward_healthy_midpoint', resource: 'light', duration_ticks: 2, duration_seconds: 30 } },
  'environment:windbreak': { action_key: 'windbreak', animation_key: 'windbreak', effect_payload: { strategy: 'toward_healthy_midpoint', resource: 'air_humidity', duration_ticks: 2, duration_seconds: 30 } },
  'environment:frost-cover': { action_key: 'frost-cover', animation_key: 'frost-cover', effect_payload: { strategy: 'toward_healthy_midpoint', resource: 'air_temp', duration_ticks: 2, duration_seconds: 30 } },
  'environment:mulch': { action_key: 'mulch', animation_key: 'straw-mulch', effect_payload: { strategy: 'moisture_retention', resource: 'soil_humidity', duration_ticks: 2, duration_seconds: 30 } },
  'manual_pest_control:aphid,snail': { action_key: 'manual-pest-control', animation_key: 'hand-pick', effect_payload: {} },
  'pest_control:aphid': { action_key: 'aphid-treatment', animation_key: 'pest-spray', effect_payload: {} },
  'pest_control:snail': { action_key: 'snail-treatment', animation_key: 'pest-spray', effect_payload: {} },
  'pest_control:fungus': { action_key: 'fungus-treatment', animation_key: 'pest-spray', effect_payload: {} },
}

function ColorCodePreview({ value }) {
  if (!value) return <span className="admin-color-code is-empty">—</span>
  return <span className="admin-color-code"><i style={{ backgroundColor: value }} /><code>{value}</code></span>
}

function ColorPairPreview({ first, second }) {
  return <span className="admin-color-pair"><ColorCodePreview value={first} /><b>/</b><ColorCodePreview value={second} /></span>
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
        { label: 'Plant', render: (row) => localizedAdminName(row) },
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
      columns: [{ label: 'Plant', render: (row) => localizedAdminName(row.plant) }, { label: 'Stage', render: (row) => `${row.stage_no}. ${row.stage_name}` }, { label: 'Growth points', render: (row) => row.required_growth_point }, { label: 'Model', render: (row) => row.model_url ? 'Configured' : 'Not set' }],
    },
    {
      id: 'plant-rules', label: 'Condition rules', createLabel: 'New rule', icon: 'settings',
      defaults: { plant_id: '', factor: 'water', operator: 'between', min_value: 0, max_value: 100, visual_state: 'healthy', severity: 1, health_delta: 0, growth_delta: 0, analysis_result: '', direction: '', is_active: true },
      fields: [{ key: 'plant_id', label: 'Plant', type: 'lookup', lookup: 'plants', required: true }, { key: 'factor', label: 'Factor', type: 'select', options: environmentFactorOptions, required: true }, { key: 'operator', label: 'Operator', type: 'select', options: ['below', 'above', 'between', 'outside'], required: true }, { key: 'min_value', label: 'Minimum', type: 'number' }, { key: 'max_value', label: 'Maximum', type: 'number' }, { key: 'visual_state', label: 'Visual state', type: 'select', options: visualStateOptions, required: true }, { key: 'severity', label: 'Severity', type: 'select', options: severityOptions, required: true }, { key: 'health_delta', label: 'Health change', type: 'number', required: true }, { key: 'growth_delta', label: 'Growth change', type: 'number', required: true }, { key: 'analysis_result', label: 'Analysis result', type: 'textarea', wide: true }, { key: 'direction', label: 'Player guidance', type: 'textarea', wide: true }, commonActiveField],
      columns: [{ label: 'Plant', render: (row) => localizedAdminName(row.plant) }, { label: 'Condition', render: (row) => `${row.factor} ${row.operator} ${row.min_value ?? ''}${row.max_value !== null ? `–${row.max_value}` : ''}` }, { label: 'Effect', render: (row) => `${row.health_delta} health / ${row.growth_delta} growth` }, { label: 'State', render: (row) => row.visual_state }],
    },
    {
      id: 'plant-variants', label: 'Visual variants', createLabel: 'New visual', icon: 'eye',
      defaults: { plant_id: '', stage_id: '', state_key: 'healthy', label: '', model_url: '', leaf_color: '#6fa84f', stem_color: '#5c8f42', leaf_state: 'normal', stem_state: 'normal', scale: 1, priority: 0, is_active: true },
      fields: [{ key: 'plant_id', label: 'Plant', type: 'lookup', lookup: 'plants', required: true }, { key: 'stage_id', label: 'Growth stage', type: 'lookup', lookup: 'stages' }, { key: 'state_key', label: 'State key', type: 'select', options: visualStateOptions, required: true }, { key: 'label', label: 'Display label' }, { key: 'model_url', label: 'Variant 3D model package', type: 'model-bundle', wide: true }, { key: 'leaf_color', label: 'Leaf color', type: 'color-rgb' }, { key: 'stem_color', label: 'Stem color', type: 'color-rgb' }, { key: 'leaf_state', label: 'Leaf state', type: 'select', options: leafStateOptions }, { key: 'stem_state', label: 'Stem state', type: 'select', options: stemStateOptions }, { key: 'scale', label: 'Scale', type: 'number', step: '0.01', required: true }, { key: 'priority', label: 'Priority', type: 'number', required: true }, commonActiveField],
      columns: [{ label: 'Plant', render: (row) => localizedAdminName(row.plant) }, { label: 'State', render: (row) => row.label || row.state_key }, { label: 'Stage', render: (row) => row.stage?.stage_name || 'All stages' }, { label: 'Appearance', render: (row) => <ColorPairPreview first={row.leaf_color} second={row.stem_color} /> }],
    },
    {
      id: 'plant-knowledge', label: 'Plant knowledge', createLabel: 'New plant guide', icon: 'bookmark',
      defaults: {
        plant_id: '', scientific_name: '', family: '', category_en: '', category_th: '',
        summary_en: '', summary_th: '', care_en: [], care_th: [], caution_en: '', caution_th: '',
        photo_url: '', photo_alt_en: '', photo_alt_th: '', photo_credit: '', photo_source_url: '',
        photo_license: '', photo_license_url: '', sources: [],
      },
      fields: [
        { key: 'plant_id', label: 'Plant', type: 'lookup', lookup: 'plants', required: true },
        { key: 'scientific_name', label: 'Scientific name' }, { key: 'family', label: 'Family' },
        { key: 'category_en', label: 'Category (English)' }, { key: 'category_th', label: 'Category (Thai)' },
        { key: 'summary_en', label: 'Guide summary (English)', type: 'textarea', wide: true },
        { key: 'summary_th', label: 'Guide summary (Thai)', type: 'textarea', wide: true },
        { key: 'care_en', label: 'Care steps (English)', type: 'string-list', itemPlaceholder: 'Add an English care step…', addLabel: 'Add English step', emptyLabel: 'No English care steps yet.', wide: true },
        { key: 'care_th', label: 'Care steps (Thai)', type: 'string-list', itemPlaceholder: 'เพิ่มขั้นตอนการดูแลภาษาไทย…', addLabel: 'เพิ่มขั้นตอนภาษาไทย', emptyLabel: 'ยังไม่มีขั้นตอนการดูแลภาษาไทย', wide: true },
        { key: 'caution_en', label: 'Caution (English)', type: 'textarea', wide: true },
        { key: 'caution_th', label: 'Caution (Thai)', type: 'textarea', wide: true },
        { key: 'photo_url', label: 'Guide photo', type: 'image-upload', scope: 'plant-guides', wide: true },
        { key: 'photo_alt_en', label: 'Photo alt text (English)', wide: true },
        { key: 'photo_alt_th', label: 'Photo alt text (Thai)', wide: true },
        { key: 'photo_credit', label: 'Photo credit' }, { key: 'photo_source_url', label: 'Photo source URL', type: 'url' },
        { key: 'photo_license', label: 'Photo license', type: 'select', options: [{ value: '', label: 'Not specified' }, 'Public domain', 'CC0', 'CC BY 4.0', 'CC BY-SA 4.0', 'Unsplash License', 'Pexels License'] }, { key: 'photo_license_url', label: 'License URL', type: 'url' },
        { key: 'sources', label: 'References', type: 'reference-list', wide: true },
      ],
      columns: [
        { label: 'Plant', render: (row) => localizedAdminName(row.plant) || `#${row.plant_id}` },
        { label: 'Scientific name', render: (row) => row.scientific_name || 'Not recorded' },
        { label: 'Category', render: (row) => document.documentElement.lang === 'th' ? row.category_th || row.category_en || '—' : row.category_en || row.category_th || '—' },
        { label: 'Care / references', render: (row) => `${Array.isArray(row.care_en) ? row.care_en.length : 0} steps · ${Array.isArray(row.sources) ? row.sources.length : 0} sources` },
        { label: 'Photo', render: (row) => row.photo_url ? 'Configured' : 'Not set' },
      ],
    },
  ],
  pests: [
    { id: 'pests', label: 'Pest catalog', createLabel: 'New pest', icon: 'pest', defaults: { name_th: '', name_en: '', description: '', image_url: '', model_url: '', placement_mode: 'ground_random', base_chance: 3, damage_per_turn: 0, behavior: '' }, fields: [{ key: 'name_en', label: 'English name' }, { key: 'name_th', label: 'Thai name', required: true }, { key: 'description', label: 'Description', type: 'textarea', wide: true }, { key: 'placement_mode', label: '3D placement', type: 'select', required: true, options: [{ value: 'ground_random', label: 'Random on soil' }, { value: 'leaf', label: 'Attached to leaves' }, { value: 'plant_surface', label: 'Plant surface effect' }] }, { key: 'image_url', label: 'Pest image', type: 'image-upload', scope: 'pests', wide: true }, { key: 'model_url', label: 'Pest 3D model package', type: 'model-bundle', wide: true }, { key: 'base_chance', label: 'Base chance (%)', type: 'number', step: '0.01', required: true }, { key: 'damage_per_turn', label: 'Damage per turn', type: 'number', required: true }, { key: 'behavior', label: 'Behavior notes', type: 'textarea', wide: true }], columns: [{ label: 'Pest', render: (row) => localizedAdminName(row) }, { label: 'Thai name', render: (row) => row.name_th }, { label: 'Placement', render: (row) => ({ ground_random: 'Soil', leaf: 'Leaf', plant_surface: 'Surface' })[row.placement_mode] ?? 'Soil' }, { label: 'Base chance', render: (row) => `${row.base_chance}%` }, { label: 'Rules / damage', render: (row) => `${row.condition_rules_count} rules · ${row.damage_per_turn} damage` }] },
    {
      id: 'pest-knowledge', label: 'Pest knowledge', createLabel: 'New pest guide', icon: 'bookmark',
      defaults: {
        pest_id: '', scientific_name: '', family: '', category_en: '', category_th: '', summary_en: '', summary_th: '',
        signs_en: [], signs_th: [], favorable_conditions_en: [], favorable_conditions_th: [], prevention_en: [], prevention_th: [],
        treatment_action_keys: [], sources: [],
      },
      fields: [
        { key: 'pest_id', label: 'Pest', type: 'lookup', lookup: 'pests', required: true },
        { key: 'scientific_name', label: 'Scientific name' }, { key: 'family', label: 'Group / family' },
        { key: 'category_en', label: 'Category (English)' }, { key: 'category_th', label: 'Category (Thai)' },
        { key: 'summary_en', label: 'Summary (English)', type: 'textarea', wide: true },
        { key: 'summary_th', label: 'Summary (Thai)', type: 'textarea', wide: true },
        { key: 'signs_en', label: 'What to look for (English)', type: 'string-list', itemPlaceholder: 'Add one sign…', addLabel: 'Add sign', emptyLabel: 'No English signs yet.', wide: true },
        { key: 'signs_th', label: 'What to look for (Thai)', type: 'string-list', itemPlaceholder: 'เพิ่มอาการที่ควรสังเกต…', addLabel: 'เพิ่มอาการ', emptyLabel: 'ยังไม่มีอาการภาษาไทย', wide: true },
        { key: 'favorable_conditions_en', label: 'Risk conditions (English)', type: 'string-list', itemPlaceholder: 'Add one condition…', addLabel: 'Add condition', emptyLabel: 'No English risk conditions yet.', wide: true },
        { key: 'favorable_conditions_th', label: 'Risk conditions (Thai)', type: 'string-list', itemPlaceholder: 'เพิ่มปัจจัยเพิ่มความเสี่ยง…', addLabel: 'เพิ่มปัจจัย', emptyLabel: 'ยังไม่มีปัจจัยภาษาไทย', wide: true },
        { key: 'prevention_en', label: 'Prevention steps (English)', type: 'string-list', itemPlaceholder: 'Add one prevention step…', addLabel: 'Add prevention step', emptyLabel: 'No English prevention steps yet.', wide: true },
        { key: 'prevention_th', label: 'Prevention steps (Thai)', type: 'string-list', itemPlaceholder: 'เพิ่มวิธีป้องกัน…', addLabel: 'เพิ่มวิธีป้องกัน', emptyLabel: 'ยังไม่มีวิธีป้องกันภาษาไทย', wide: true },
        { key: 'treatment_action_keys', label: 'Items that can remove this pest', type: 'string-list', optionLookup: 'item-actions', addLabel: 'Add treatment item', emptyLabel: 'No treatment item configured.', hint: 'Choose existing active items. The selected items will also be allowed to remove this pest in the simulation.', wide: true },
        { key: 'sources', label: 'Sources and further reading', type: 'reference-list', wide: true },
      ],
      columns: [
        { label: 'Pest', render: (row) => localizedAdminName(row.pest) || `#${row.pest_id}` },
        { label: 'Group / family', render: (row) => row.family || row.category_en || row.category_th || '—' },
        { label: 'Guide content', render: (row) => `${Array.isArray(row.signs_en) ? row.signs_en.length : 0} signs · ${Array.isArray(row.prevention_en) ? row.prevention_en.length : 0} prevention steps` },
        { label: 'Treatment items', render: (row) => Array.isArray(row.treatment_action_keys) ? row.treatment_action_keys.length : 0 },
        { label: 'Sources', render: (row) => Array.isArray(row.sources) ? row.sources.length : 0 },
      ],
    },
    { id: 'pest-rules', label: 'Occurrence rules', createLabel: 'New pest rule', icon: 'bug', defaults: { pest_id: '', plant_id: '', factor: 'air_humidity', operator: 'above', min_value: 0, max_value: 100, chance_delta: 0, severity: 1, is_active: true }, fields: [{ key: 'pest_id', label: 'Pest', type: 'lookup', lookup: 'pests', required: true }, { key: 'plant_id', label: 'Specific plant (optional)', type: 'lookup', lookup: 'plants' }, { key: 'factor', label: 'Factor', type: 'select', options: environmentFactorOptions, required: true }, { key: 'operator', label: 'Operator', type: 'select', options: ['below', 'above', 'between', 'outside'], required: true }, { key: 'min_value', label: 'Minimum', type: 'number' }, { key: 'max_value', label: 'Maximum', type: 'number' }, { key: 'chance_delta', label: 'Chance change', type: 'number', step: '0.01', required: true }, { key: 'severity', label: 'Severity', type: 'select', options: severityOptions, required: true }, commonActiveField], columns: [{ label: 'Pest', render: (row) => localizedAdminName(row.pest) }, { label: 'Plant', render: (row) => localizedAdminName(row.plant) || 'All plants' }, { label: 'Condition', render: (row) => `${row.factor} ${row.operator} ${row.min_value ?? ''}${row.max_value !== null ? `–${row.max_value}` : ''}` }, { label: 'Chance / severity', render: (row) => `${row.chance_delta} / ${row.severity}` }] },
  ],
  store: [
    { id: 'items', label: 'Item catalog', createLabel: 'New item', icon: 'shop', defaults: { name: '', type: 'pesticide', description: '', image_url: '', effect_type: '', effect_value: 0, action_key: '', animation_key: '', mode_scope: 'both', effect_payload: { strategy: '', resource: '', duration_ticks: 1, duration_seconds: 30 }, rarity: 'common', is_active: true }, fields: [{ key: 'name', label: 'Item name', required: true }, { key: 'type', label: 'Type', type: 'select', options: ['seed', 'water', 'fertilizer', 'pesticide', 'booster', 'cosmetic'], required: true }, { key: 'description', label: 'Description', type: 'textarea', wide: true }, { key: 'image_url', label: 'Item image', type: 'image-upload', scope: 'items', wide: true }, { key: 'effect_type', label: 'Effect type', type: 'select', options: itemEffectTypeOptions }, { key: 'effect_value', label: 'Effect strength', type: 'number', required: true }, { key: 'action_key', label: 'Simulation action', type: 'select', options: itemActionOptions }, { key: 'animation_key', label: '3D animation', type: 'select', options: itemAnimationOptions }, { key: 'mode_scope', label: 'Available mode', type: 'select', options: ['both', 'greenhouse', 'outdoor', 'seasonal'], required: true }, { key: 'effect_payload', label: 'How this item works', type: 'item-effect', wide: true }, { key: 'rarity', label: 'Rarity', type: 'select', options: ['common', 'rare', 'epic', 'legendary'], required: true }, commonActiveField], columns: [{ label: 'Item', render: (row) => row.name }, { label: 'Type / mode', render: (row) => `${row.type} · ${row.mode_scope || 'both'}` }, { label: 'Action', render: (row) => row.action_key || row.effect_type || '—' }, { label: 'Animation', render: (row) => row.animation_key || '—' }] },
    { id: 'shop-items', label: 'Shop listings', createLabel: 'New listing', icon: 'shoppingCart', defaults: { item_id: '', price_coin: 0, price_gem: 0, stock_limit: '', is_active: true, starts_at: '', ends_at: '' }, fields: [{ key: 'item_id', label: 'Item', type: 'lookup', lookup: 'items', required: true }, { key: 'price_coin', label: 'Coin price', type: 'number', required: true }, { key: 'price_gem', label: 'Gem price', type: 'number', required: true }, { key: 'stock_limit', label: 'Stock limit', type: 'number' }, { key: 'starts_at', label: 'Starts at', type: 'datetime-local' }, { key: 'ends_at', label: 'Ends at', type: 'datetime-local' }, commonActiveField], columns: [{ label: 'Item', render: (row) => row.item?.name }, { label: 'Type', render: (row) => row.item?.type }, { label: 'Price', render: (row) => `${row.price_coin} coins / ${row.price_gem} gems` }, { label: 'Stock', render: (row) => row.stock_limit ?? 'Unlimited' }] },
  ],
  events: [
    {
      id: 'event-definitions', label: 'Event catalog', createLabel: 'New event', icon: 'live',
      defaults: { event_key: '', name_en: '', name_th: '', description_en: '', description_th: '', mode_scope: 'both', severity: 'low', weight: 10, trigger_chance: 12, warning_ticks: 1, duration_ticks: 1, cooldown_ticks: 2, conditions: [], effects: { factor_delta: {} }, response_action_keys: [], is_harmful: true, is_active: true },
      fields: [
        { key: 'event_key', label: 'Stable event key', required: true },
        { key: 'name_en', label: 'English name', required: true }, { key: 'name_th', label: 'Thai name', required: true },
        { key: 'description_en', label: 'English explanation', type: 'textarea', wide: true }, { key: 'description_th', label: 'Thai explanation', type: 'textarea', wide: true },
        { key: 'mode_scope', label: 'Mode', type: 'select', options: ['both', 'greenhouse', 'outdoor', 'seasonal'], required: true },
        { key: 'severity', label: 'Severity', type: 'select', options: ['low', 'medium', 'high'], required: true },
        { key: 'weight', label: 'Random weight', type: 'number', required: true }, { key: 'trigger_chance', label: 'Trigger chance (%)', type: 'number', required: true },
        { key: 'warning_ticks', label: 'Warning updates', type: 'number', required: true }, { key: 'duration_ticks', label: 'Duration updates', type: 'number', required: true },
        { key: 'cooldown_ticks', label: 'Recovery updates', type: 'number', required: true },
        { key: 'conditions', label: 'Environmental conditions', type: 'condition-list', wide: true },
        { key: 'effects', label: 'Event effects', type: 'effect-map', wide: true },
        { key: 'response_action_keys', label: 'Response actions', type: 'string-list', optionLookup: 'item-actions', addLabel: 'Add response action', emptyLabel: 'No response actions yet.', hint: 'Choose an item action that can resolve this event.', wide: true },
        { key: 'is_harmful', label: 'Harmful event', type: 'boolean' }, commonActiveField,
      ],
      columns: [
        { label: 'Event', render: (row) => localizedAdminName(row) },
        { label: 'Mode / severity', render: (row) => `${row.mode_scope} · ${row.severity}` },
        { label: 'Chance / weight', render: (row) => `${row.trigger_chance}% · ${row.weight}` },
        { label: 'Timing', render: (row) => `${row.warning_ticks} warning · ${row.duration_ticks} active · ${row.cooldown_ticks} recovery` },
        { label: 'Runs', render: (row) => row.simulation_events_count ?? 0 },
      ],
    },
  ],
  modeRewards: [
    {
      id: 'simulation-mode-rewards', label: 'Simulation mode rewards', createLabel: '', icon: 'coin', noCreate: true, noDelete: true, noTrashFilter: true,
      defaults: {},
      fields: [
        { key: 'mode', label: 'Mode key', type: 'select', options: ['greenhouse', 'outdoor', 'seasonal'], required: true },
        { key: 'name_en', label: 'English name', required: true }, { key: 'name_th', label: 'Thai name', required: true },
        { key: 'experience_reward', label: 'EXP on maturity', type: 'number', required: true },
        { key: 'coin_reward', label: 'Coins on maturity', type: 'number', required: true }, commonActiveField,
      ],
      columns: [
        { label: 'Mode', render: (row) => localizedAdminName(row) || row.mode },
        { label: 'Mode key', render: (row) => row.mode },
        { label: 'Completion reward', render: (row) => `${row.experience_reward} EXP · ${row.coin_reward} coins` },
      ],
    },
  ],
  progression: [
    { id: 'quests', label: 'Quests', createLabel: 'New quest', icon: 'trophy', defaults: { title: '', description: '', quest_type: 'daily', target_type: 'simulation_started', target_value: 1, reward_exp: 0, reward_coin: 0, reward_gem: 0, is_active: true }, fields: [{ key: 'title', label: 'Quest title', required: true }, { key: 'quest_type', label: 'Quest type', type: 'select', options: ['daily', 'weekly', 'story', 'event'], required: true }, { key: 'description', label: 'Description', type: 'textarea', wide: true }, { key: 'target_type', label: 'Target type', type: 'select', options: ['simulation_started', 'simulation_completed', 'plant_harvested', 'item_used', 'item_purchased', 'post_created', 'comment_created', 'friend_added'], required: true }, { key: 'target_value', label: 'Target value', type: 'number', required: true }, { key: 'reward_exp', label: 'EXP reward', type: 'number', required: true }, { key: 'reward_coin', label: 'Coin reward', type: 'number', required: true }, { key: 'reward_gem', label: 'Gem reward', type: 'number', required: true }, commonActiveField], columns: [{ label: 'Quest', render: (row) => row.title }, { label: 'Type', render: (row) => row.quest_type }, { label: 'Target', render: (row) => `${row.target_type} × ${row.target_value}` }, { label: 'Rewards', render: (row) => `${row.reward_exp} EXP · ${row.reward_coin} coins` }] },
    { id: 'achievements', label: 'Achievements', createLabel: 'New achievement', icon: 'crown', defaults: { title: '', description: '', condition_type: 'simulation_completed', condition_value: 1, reward_exp: 0, reward_coin: 0, badge_image_url: '', is_active: true }, fields: [{ key: 'title', label: 'Achievement title', required: true }, { key: 'condition_type', label: 'Condition type', type: 'select', options: ['simulation_started', 'simulation_completed', 'plant_harvested', 'perfect_health_harvest', 'item_used', 'item_purchased', 'post_created', 'friend_added', 'level_reached'], required: true }, { key: 'description', label: 'Description', type: 'textarea', wide: true }, { key: 'condition_value', label: 'Condition value', type: 'number', required: true }, { key: 'reward_exp', label: 'EXP reward', type: 'number', required: true }, { key: 'reward_coin', label: 'Coin reward', type: 'number', required: true }, { key: 'badge_image_url', label: 'Badge image', type: 'image-upload', scope: 'achievements', wide: true }, commonActiveField], columns: [{ label: 'Achievement', render: (row) => row.title }, { label: 'Condition', render: (row) => `${row.condition_type} × ${row.condition_value}` }, { label: 'Rewards', render: (row) => `${row.reward_exp} EXP · ${row.reward_coin} coins` }, { label: 'Badge', render: (row) => row.badge_image_url ? 'Configured' : 'Not set' }] },
  ],
  models: [
    { id: 'model-assets', label: 'Model assets', createLabel: 'New model asset', icon: 'hardware', defaults: { asset_key: '', label: '', type: 'model', url: '', metadata: {} }, fields: [{ key: 'asset_key', label: 'Asset key', required: true }, { key: 'label', label: 'Display label' }, { key: 'type', label: 'Asset type', type: 'select', options: ['model', 'plant', 'scene', 'pest', 'item', 'action', 'effect'], required: true }, { key: 'url', label: 'GLTF model package', type: 'model-bundle', required: true, wide: true }, { key: 'metadata', label: 'Metadata (JSON)', type: 'json', wide: true }], columns: [{ label: 'Asset', render: (row) => row.label || row.asset_key }, { label: 'Key', render: (row) => row.asset_key }, { label: 'Type', render: (row) => row.type }, { label: 'Model file', render: (row) => row.url ? decodeURIComponent(String(row.url).split(/[?#]/, 1)[0].split('/').pop()) : 'Not set' }] },
  ],
  community: [
    { id: 'posts', label: 'Posts', icon: 'chat', moderation: true, noDelete: true, statusField: 'visibility', statusOptions: ['public', 'friends', 'private'], columns: [{ label: 'Author', render: (row) => row.user?.username }, { label: 'Caption', render: (row) => row.caption || 'No caption' }, { label: 'Engagement', render: (row) => `${row.comments_count} comments · ${row.likes_count} likes` }, { label: 'Created', render: (row) => formatDate(row.created_at, true) }] },
    { id: 'comments', label: 'Post comments', icon: 'chat', moderation: true, noDelete: true, statusField: 'status', statusOptions: ['visible', 'hidden', 'suspended'], columns: [{ label: 'Author', render: (row) => row.user?.username }, { label: 'Comment', render: (row) => row.comment_text }, { label: 'Thread', render: (row) => `${row.replies_count} replies · ${row.likes_count} likes` }, { label: 'Created', render: (row) => formatDate(row.created_at, true) }] },
    { id: 'simulator-comments', label: 'Simulation comments', icon: 'live', moderation: true, noDelete: true, statusField: 'status', statusOptions: ['visible', 'hidden', 'suspended'], columns: [{ label: 'Author', render: (row) => row.user?.username }, { label: 'Comment', render: (row) => row.comment_text }, { label: 'Simulation', render: (row) => `#${row.simulator_id}` }, { label: 'Created', render: (row) => formatDate(row.created_at, true) }] },
  ],
  simulations: [
    { id: 'simulators', label: 'Simulations', icon: 'controller', moderation: true, statusField: 'status', statusOptions: ['active', 'completed', 'failed', 'cancelled'], extraStatusField: 'share_visibility', extraStatusOptions: ['private', 'friends', 'public'], columns: [{ label: 'Owner', render: (row) => row.user?.username }, { label: 'Plant / mode', render: (row) => `${localizedAdminName(row.plant) || 'Unknown'} · ${row.mode}` }, { label: 'Health / growth', render: (row) => `${row.health}% / ${row.growth_point} pts` }, { label: 'Started', render: (row) => formatDate(row.started_at, true) }] },
    { id: 'plant-histories', label: 'Plant histories', icon: 'history', moderation: true, statusField: 'visibility', statusOptions: ['private', 'friends', 'public'], columns: [{ label: 'Owner', render: (row) => row.user?.username }, { label: 'Plant', render: (row) => localizedAdminName(row.plant) }, { label: 'Result', render: (row) => `${row.final_health}% health · ${row.total_score} score` }, { label: 'Grow time', render: (row) => formatPlantDuration(row, document.documentElement.lang === 'th' ? 'th' : 'en', { compact: true }) }, { label: 'Created', render: (row) => formatDate(row.created_at, true) }] },
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

      <section className="admin-skeleton-attention">
        <div><AdminSkeletonBlock className="is-eyebrow" /><AdminSkeletonBlock className="is-heading" /></div>
        <AdminSkeletonBlock className="is-badge" />
        <div className="admin-skeleton-attention-grid">
          {Array.from({ length: 6 }, (_, index) => <AdminSkeletonBlock className="is-action" key={index} />)}
        </div>
      </section>
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
  user_registered: { label: 'Joined the platform', filterLabel: 'New accounts', badge: 'Account', icon: 'person', tone: 'account' },
  simulation_started: { label: 'Started a plant simulation', filterLabel: 'Simulation started', badge: 'Simulation', icon: 'controller', tone: 'simulation' },
  plant_saved: { label: 'Saved a plant result', filterLabel: 'Plant results saved', badge: 'Result', icon: 'plant', tone: 'simulation' },
  post_created: { label: 'Published a community post', filterLabel: 'Posts created', badge: 'Post', icon: 'chat', tone: 'community' },
  post_commented: { label: 'Commented on a post', filterLabel: 'Post comments', badge: 'Comment', icon: 'chat', tone: 'community' },
  simulation_commented: { label: 'Commented on a shared simulation', filterLabel: 'Simulation comments', badge: 'Comment', icon: 'controller', tone: 'community' },
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
  cancelled_simulations: { label: 'Cancelled simulations', detail: 'Interrupted user sessions', icon: 'history' },
  stale_active_simulations: { label: 'Long-running simulations', detail: 'Active for more than seven days', icon: 'live' },
  missing_model_assets: { label: 'Missing model files', detail: 'Asset records without a configured URL', icon: 'hardware' },
}

function AttentionCenter({ attention, onOpenSection, language = 'en' }) {
  const items = attention?.items ?? []

  return (
    <section className="admin-panel admin-attention-panel">
      <header className="admin-panel__header">
        <div><small>{adminText(language, 'ACTION CENTER')}</small><h2>{adminText(language, 'Items that need attention')}</h2></div>
        <span className={attention?.total ? 'has-items' : 'is-clear'}>{adminText(language, attention?.total ? `${Number(attention.total).toLocaleString()} open` : 'All clear')}</span>
      </header>
      <div className="admin-attention-grid">
        {items.map((item) => {
          const meta = attentionItemMeta[item.key] ?? { label: item.key.replaceAll('_', ' '), detail: 'Open the related section to review', icon: 'shield' }
          return (
            <button className={`admin-attention-item is-${item.severity} ${item.value ? 'has-items' : 'is-clear'}`} type="button" key={item.key} onClick={() => onOpenSection(item.section)}>
              <span><AppIcon name={meta.icon} /></span>
              <span><strong>{adminText(language, meta.label)}</strong><small>{adminText(language, meta.detail)}</small></span>
              <b>{Number(item.value ?? 0).toLocaleString()}</b>
              <AppIcon name="arrowForward" />
            </button>
          )
        })}
      </div>
    </section>
  )
}

function TrendChart({ trend = [], activeSeries, period = 'month', periodLabel = '', theme = 'dark', language = 'en' }) {
  const selectedSeries = useMemo(
    () => trendSeriesConfig.filter((series) => activeSeries.includes(series.key)).map((series) => ({ ...series, displayLabel: adminText(language, series.label) })),
    [activeSeries, language],
  )
  const seriesLabel = selectedSeries.map((series) => series.displayLabel).join(', ')
  const isLight = theme === 'light'
  const parseTimestamp = (value, index) => {
    const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value
    const timestamp = new Date(normalized).getTime()
    return Number.isFinite(timestamp) ? timestamp : Date.UTC(2000, 0, index + 1)
  }
  const chartSeries = useMemo(() => selectedSeries.map((series) => ({
    name: series.displayLabel,
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
    const locale = language === 'th' ? 'th-TH' : 'en-US'
    const axisDate = new Intl.DateTimeFormat(locale, period === 'day'
      ? { hour: '2-digit', minute: '2-digit' }
      : period === 'year'
        ? { month: 'short' }
        : { day: 'numeric', month: 'short' })
    const tooltipDate = new Intl.DateTimeFormat(locale, period === 'day'
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : period === 'year'
        ? { month: 'long', year: 'numeric' }
        : { day: 'numeric', month: 'long', year: 'numeric' })

    return {
      chart: {
        id: 'admin-system-activity-chart',
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
          formatter: (value) => language === 'th' ? `${Number(value ?? 0).toLocaleString('th-TH')} รายการ` : `${Number(value ?? 0).toLocaleString()} records`,
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
          text: adminText(language, 'Records'),
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
        text: adminText(language, 'No activity data for this period'),
        align: 'center',
        verticalAlign: 'middle',
        style: {
          color: isLight ? '#526259' : '#839087',
          fontSize: '13px',
        },
      },
    }
  }, [chartSeries, isLight, language, period, selectedSeries, trend.length, visibleMaximum])

  return (
    <div className="admin-trend" role="group" aria-label={`${adminText(language, periodLabel || 'Selected period')} ${adminText(language, 'line chart showing')} ${seriesLabel}`}>
      <Suspense fallback={<div className="admin-trend__loading"><span aria-hidden="true" />Loading chart…</div>}>
        <ReactApexChart className="admin-trend__chart" options={options} series={chartSeries} type="line" height="100%" />
      </Suspense>
    </div>
  )
}

function DashboardView({ data, trendSelection, onChangeTrendSelection, onOpenSection, theme = 'dark', language = 'en' }) {
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
  const selectedDateParts = String(trendSelection.value).split('-').map(Number)
  const selectedYear = selectedDateParts[0] || new Date().getFullYear()
  const selectedMonth = selectedDateParts[1] || (new Date().getMonth() + 1)
  const selectedDay = selectedDateParts[2] || 1
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

  function changeTrendDatePart(part, value) {
    const nextYear = part === 'year' ? Number(value) : selectedYear
    const nextMonth = part === 'month' ? Number(value) : selectedMonth
    const maximumDay = new Date(nextYear, nextMonth, 0).getDate()
    const nextDay = Math.min(part === 'day' ? Number(value) : selectedDay, maximumDay)
    const monthValue = String(nextMonth).padStart(2, '0')
    const dayValue = String(nextDay).padStart(2, '0')
    onChangeTrendSelection({ period: trendSelection.period, value: trendSelection.period === 'day' ? `${nextYear}-${monthValue}-${dayValue}` : `${nextYear}-${monthValue}` })
  }

  return (
    <div className="admin-view admin-dashboard-view">
      <div className="admin-metric-grid">
        <MetricCard icon="groups" label={adminText(language, 'Total Users')} value={metrics.users} detail={adminText(language, `${metrics.active_users ?? 0} active accounts`)} />
        <MetricCard icon="controller" label={adminText(language, 'Simulations')} value={metrics.simulations} detail={adminText(language, `${metrics.active_simulations ?? 0} currently active`)} tone="blue" />
        <MetricCard icon="history" label={adminText(language, 'Harvested plants')} value={metrics.harvests} detail={adminText(language, 'Completed plant results')} tone="cyan" />
        <MetricCard icon="bookmark" label={adminText(language, 'Plant articles')} value={totalContent} detail={adminText(language, `${metrics.published_contents ?? 0} published · ${metrics.draft_contents ?? 0} draft`)} tone="gold" />
        <MetricCard icon="chat" label={adminText(language, 'Community posts')} value={metrics.community_posts} detail={adminText(language, 'Published community activity')} tone="violet" />
        <MetricCard icon="live" label={adminText(language, 'All comments')} value={totalComments} detail={adminText(language, `${metrics.hidden_comments ?? 0} require moderation`)} tone="coral" />
        <MetricCard icon="plant" label={adminText(language, 'Plants & pests')} value={totalSpecies} detail={adminText(language, `${metrics.plants ?? 0} plants · ${metrics.pests ?? 0} pests`)} tone="green" />
        <MetricCard icon="shop" label={adminText(language, 'Simulation catalog')} value={totalGameCatalog} detail={adminText(language, `${metrics.items ?? 0} items · ${metrics.quests ?? 0} quests`)} tone="blue" />
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-panel admin-panel--trend">
          <header className="admin-panel__header">
            <div><small>{adminText(language, 'ACTIVITY')}</small><h2>{adminText(language, 'System activity')}</h2></div>
            <div className="admin-panel__tools">
              <div className="admin-series-picker" role="group" aria-label={adminText(language, 'Chart data')}>
                {trendSeriesConfig.map((series) => <button className={activeSeries.includes(series.key) ? 'is-active' : ''} type="button" aria-pressed={activeSeries.includes(series.key)} key={series.key} onClick={() => toggleSeries(series.key)}><i style={{ background: series.color }} />{adminText(language, series.label)}</button>)}
              </div>
              <div className="admin-trend-filter">
                <div className="admin-range-switch" role="group" aria-label={adminText(language, 'Chart period type')}>
                  {['day', 'month', 'year'].map((period) => <button className={trendSelection.period === period ? 'is-active' : ''} type="button" aria-pressed={trendSelection.period === period} key={period} onClick={() => changeTrendPeriod(period)}>{adminText(language, period[0].toUpperCase() + period.slice(1))}</button>)}
                </div>
                <label className={`admin-trend-picker ${trendSelection.period !== 'year' ? 'admin-trend-picker--parts' : ''}`}>
                  <span className="sr-only">Select {trendSelection.period}</span>
                  {trendSelection.period === 'year' ? (
                    <select value={trendSelection.value} onChange={(event) => onChangeTrendSelection({ period: 'year', value: event.target.value })}>
                      {yearOptions.map((year) => <option key={year} value={year}>{language === 'th' ? year + 543 : year}</option>)}
                    </select>
                  ) : (
                    <>
                      {trendSelection.period === 'day' && <select aria-label={language === 'th' ? 'เลือกวันที่' : 'Select day'} value={selectedDay} onChange={(event) => changeTrendDatePart('day', event.target.value)}>{Array.from({ length: new Date(selectedYear, selectedMonth, 0).getDate() }, (_, index) => index + 1).map((day) => <option value={day} key={day}>{day}</option>)}</select>}
                      <select aria-label={language === 'th' ? 'เลือกเดือน' : 'Select month'} value={selectedMonth} onChange={(event) => changeTrendDatePart('month', event.target.value)}>{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option value={month} key={month}>{new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { month: 'short' }).format(new Date(2024, month - 1, 1))}</option>)}</select>
                      <select aria-label={language === 'th' ? 'เลือกปี' : 'Select year'} value={selectedYear} onChange={(event) => changeTrendDatePart('year', event.target.value)}>{yearOptions.map((year) => <option key={year} value={year}>{language === 'th' ? year + 543 : year}</option>)}</select>
                    </>
                  )}
                </label>
              </div>
            </div>
          </header>
          <div className="admin-trend-context"><span>{adminText(language, data?.trend_label || trendSelection.value)}</span><small>{adminText(language, `${data?.trend?.length ?? 0} data points`)}</small></div>
          <TrendChart trend={data?.trend} activeSeries={activeSeries} period={data?.trend_period || trendSelection.period} periodLabel={data?.trend_label} theme={theme} language={language} />
        </section>

        <section className="admin-panel admin-system-panel">
          <header className="admin-panel__header"><div><small>{adminText(language, 'SYSTEM OVERVIEW')}</small><h2>{adminText(language, 'Data composition')}</h2></div></header>
          <div className="admin-system-panel__body">
            <div className="admin-system-ring" style={{ background: overviewBackground }}><span><strong>{Number(overview.total ?? 0).toLocaleString()}</strong><small>{adminText(language, 'total records')}</small></span></div>
            <div className="admin-system-breakdown">
              {(overview.groups ?? []).map((group) => (
                <button type="button" key={group.key} onClick={() => onOpenSection(group.section)}>
                  <span><i style={{ background: overviewColors[group.key] }} />{adminText(language, group.label)}</span>
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
          <header className="admin-panel__header"><div><small>{adminText(language, 'NEW ACCOUNTS')}</small><h2>{adminText(language, 'Recent Users')}</h2></div><button type="button" onClick={() => onOpenSection('users')}>{adminText(language, 'View all')}</button></header>
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
            <div><small>{adminText(language, 'USER ACTIVITY')}</small><h2>{adminText(language, 'Latest user activity')}</h2></div>
            <span className="admin-activity-live"><i />{adminText(language, 'Live feed')}</span>
          </header>
          <div className="admin-activity-filters">
            <label>
              <span>{adminText(language, 'Activity type')}</span>
              <select value={activityType} onChange={(event) => setActivityType(event.target.value)}>
                <option value="all">{adminText(language, `All activities (${recentActivities.length})`)}</option>
                {Object.entries(userActivityMeta).map(([type, meta]) => (
                  <option value={type} key={type}>{adminText(language, meta.filterLabel)} ({activityTypeCounts[type] ?? 0})</option>
                ))}
              </select>
            </label>
            <label>
              <span>{adminText(language, 'User')}</span>
              <select value={activityUser} onChange={(event) => setActivityUser(event.target.value)}>
                <option value="all">{adminText(language, 'All users')}</option>
                {activityUsers.map((user) => <option value={String(user.id)} key={user.id}>{user.username}</option>)}
              </select>
            </label>
            <span className="admin-activity-result">{adminText(language, `${filteredActivities.length} shown`)}</span>
          </div>
          <div className="admin-list admin-user-activity-list" aria-live="polite">
            {filteredActivities.map((activity) => {
              const meta = userActivityMeta[activity.type] ?? { label: 'Completed an activity', badge: 'Activity', icon: 'history', tone: 'default' }
              const subject = language === 'th' ? (activity.subject_th || adminText(language, activity.subject)) : (activity.subject || activity.subject_th)
              const detail = subject ? `${adminText(language, meta.label)} · ${subject}` : adminText(language, meta.label)

              return (
                <div className="admin-list__row admin-list__row--activity" key={activity.id}>
                  <AdminAvatar user={activity.user} />
                  <span><strong>{activity.user?.username || 'Unknown user'}</strong><small title={detail}>{detail}</small></span>
                  <span className={`admin-activity-kind is-${meta.tone}`}><AppIcon name={meta.icon} />{adminText(language, meta.badge)}</span>
                  <time title={formatDate(activity.occurred_at, true)}>{formatDate(activity.occurred_at, true)}</time>
                </div>
              )
            })}
            {!filteredActivities.length && <div className="admin-list__empty">{adminText(language, 'No user activity matches these filters.')}</div>}
          </div>
        </section>

        <section className="admin-panel admin-audit-summary">
          <header className="admin-panel__header"><div><small>{adminText(language, 'ADMIN ACTIVITY')}</small><h2>{adminText(language, 'Recent changes')}</h2></div><button type="button" onClick={() => onOpenSection('activity')}>{adminText(language, 'View audit log')}</button></header>
          <div className="admin-list">
            {(data?.attention?.recent_admin_actions ?? []).map((action) => (
              <div className="admin-list__row admin-list__row--audit" key={action.id}>
                <span className="admin-list__content-icon"><AppIcon name="history" /></span>
                <span><strong>{action.action?.replaceAll('_', ' ')}</strong><small>{action.admin?.username || 'System administrator'} · {action.target_type || 'system'} #{action.target_id || '—'}</small></span>
                <time>{formatDate(action.created_at, true)}</time>
              </div>
            ))}
            {!data?.attention?.recent_admin_actions?.length && <div className="admin-list__empty">{adminText(language, 'No recent administrator changes.')}</div>}
          </div>
        </section>
      </div>

      <AttentionCenter attention={data?.attention} onOpenSection={onOpenSection} language={language} />
    </div>
  )
}

function ContentEditor({ content, interfaceLanguage = 'en', onClose, onSaved }) {
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
  const ui = useCallback((english, translated) => interfaceLanguage === 'th' ? translated : english, [interfaceLanguage])
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
      if (!currentBody) throw new Error(language === 'th' ? 'กรุณาเขียนเนื้อหาบทความในเครื่องมือเขียน' : 'Please write the article content in the editor.')
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
          <div><small>{form.id ? ui(`CONTENT / VERSION ${form.version}`, `บทความ / รุ่น ${form.version}`) : ui('CONTENT / NEW ARTICLE', 'บทความ / สร้างใหม่')}</small><h2 id="admin-content-editor-title">{form.id ? ui('Edit article', 'แก้ไขบทความ') : ui('Create article', 'สร้างบทความ')}</h2></div>
          <button type="button" onClick={requestClose} aria-label="Close editor">×</button>
        </header>

        <div className="admin-editor__toolbar">
          <div className="admin-editor__language"><button className={language === 'en' ? 'is-active' : ''} type="button" onClick={() => setLanguage('en')}>English</button><button className={language === 'th' ? 'is-active' : ''} type="button" onClick={() => setLanguage('th')}>ไทย</button></div>
          <label>{ui('Status', 'สถานะ')}<select value={form.status} onChange={(event) => update('status', event.target.value)}><option value="draft">{ui('Draft', 'ฉบับร่าง')}</option><option value="published">{ui('Published', 'เผยแพร่แล้ว')}</option></select></label>
        </div>

        <div className={`admin-editor__body ${editorMode === 'visual' ? 'admin-editor__body--visual' : ''}`}>
          <div className="admin-editor__form" ref={editorScrollRef}>
            <section className="admin-writing-section">
              <div className="admin-writing-section__intro">
                <div><small>{ui('QUICK ARTICLE EDITOR', 'เขียนบทความแบบง่าย')}</small><h3>{ui('Add a title, then start writing.', 'ใส่ชื่อ แล้วเริ่มเขียนได้เลย')}</h3></div>
                <p>{ui('Slug, summary, and reading time are generated automatically.', 'ชื่อสำหรับ URL สรุปบทความ และเวลาอ่าน ระบบจะสร้างให้อัตโนมัติ')}</p>
              </div>
              <label className="admin-writing-title">{ui('Article title', 'ชื่อบทความ')}<input autoFocus placeholder={ui('Enter the article title', 'กรอกชื่อบทความ')} value={language === 'th' ? form.title_th : form.title} onChange={(event) => update(language === 'th' ? 'title_th' : 'title', event.target.value)} /></label>
              <div className="admin-content-mode">
                <div><strong>{ui('Writing mode', 'รูปแบบการเขียน')}</strong><small>{ui('Switch modes without losing the content.', 'สลับโหมดได้โดยเนื้อหาไม่หาย')}</small></div>
                <div className="admin-content-mode__switch" role="tablist" aria-label="Content editing mode">
                  <button className={editorMode === 'visual' ? 'is-active' : ''} type="button" role="tab" aria-selected={editorMode === 'visual'} onClick={() => setEditorMode('visual')}><AppIcon name="edit" />{ui('Visual editor', 'เครื่องมือเขียน')}</button>
                  <button className={editorMode === 'html' ? 'is-active' : ''} type="button" role="tab" aria-selected={editorMode === 'html'} onClick={() => setEditorMode('html')}><AppIcon name="code" />HTML</button>
                </div>
              </div>
              {editorMode === 'visual' ? (
                <Suspense fallback={<div className="admin-rich-editor-loading"><span /><strong>Loading visual editor…</strong></div>}>
                  <ContentRichEditor key={`${language}-${interfaceLanguage}`} data={previewHtml} language={language} interfaceLanguage={interfaceLanguage} onChange={(html) => update(language === 'th' ? 'body_html_th' : 'body_html', html)} />
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
                    <label>{ui('Category', 'หมวดหมู่')}<select value={form.category} onChange={(event) => update('category', event.target.value)}><option value="plant-science">{ui('Plant science', 'ข้อมูลพืช')}</option><option value="plant-care">{ui('Plant care', 'การดูแลพืช')}</option><option value="environment">{ui('Environment', 'สภาพแวดล้อม')}</option><option value="pests">{ui('Pests and diseases', 'ศัตรูพืชและโรค')}</option><option value="simulation-guide">{ui('Simulation guide', 'คู่มือการจำลอง')}</option></select></label>
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

function ContentsView({ contents, language = 'en', onRefresh }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [trashed, setTrashed] = useState('')
  const [editor, setEditor] = useState(null)
  const [editingContentId, setEditingContentId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [selectedIdState, setSelectedIds] = useState([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const selectableContentIds = contents.filter((content) => !content.deleted_at).map((content) => content.id)
  const availableContentIds = new Set(selectableContentIds)
  const selectedIds = selectedIdState.filter((id) => availableContentIds.has(id))
  const selectedIdSet = new Set(selectedIds)
  const allSelectableSelected = selectableContentIds.length > 0 && selectableContentIds.every((id) => selectedIdSet.has(id))

  function toggleContent(contentId, checked) {
    setSelectedIds((current) => checked
      ? [...new Set([...current, contentId])]
      : current.filter((id) => id !== contentId))
  }

  function toggleAllContents(checked) {
    setSelectedIds(checked ? selectableContentIds : [])
  }

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
      text: `“${content.title}” will be hidden from public pages and can be restored later.`,
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

  async function removeSelectedContents() {
    if (!selectedIds.length) return
    const confirmed = await confirmAdminAction({
      title: language === 'th' ? `ลบเนื้อหา ${selectedIds.length} รายการหรือไม่` : `Delete ${selectedIds.length} content items?`,
      text: language === 'th' ? 'รายการที่เลือกจะถูกย้ายไปถังขยะและซ่อนจากหน้าสาธารณะ โดยสามารถกู้คืนภายหลังได้' : 'Selected items will move to trash and disappear from public pages. They can be restored later.',
      confirmButtonText: language === 'th' ? `ลบ ${selectedIds.length} รายการ` : `Delete ${selectedIds.length}`,
    })
    if (!confirmed) return

    setBulkDeleting(true)
    setActionError('')
    const ids = [...selectedIds]
    try {
      const results = await Promise.allSettled(ids.map((id) => deleteAdminContent(id)))
      const failedIds = ids.filter((_, index) => results[index].status === 'rejected')
      setSelectedIds(failedIds)
      await onRefresh({ search, status: filter, trashed })
      if (failedIds.length) {
        setActionError(language === 'th' ? `ลบสำเร็จ ${ids.length - failedIds.length} รายการ และลบไม่สำเร็จ ${failedIds.length} รายการ` : `${ids.length - failedIds.length} deleted; ${failedIds.length} could not be deleted.`)
      } else {
        await showAdminSuccess(language === 'th' ? 'ลบรายการที่เลือกแล้ว' : 'Selected items deleted', language === 'th' ? `ย้าย ${ids.length} รายการไปถังขยะแล้ว` : `${ids.length} items moved to trash.`)
      }
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="admin-view">
      {selectedIds.length === 0 ? <div className="admin-content-toolbar">
        <form onSubmit={runSearch}>
          <input aria-label="Search articles" placeholder="Search title or slug" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select aria-label="Filter content by publication status" value={filter} onChange={(event) => { const value = event.target.value; setFilter(value); onRefresh({ search, status: value, trashed }) }}><option value="">All status</option><option value="published">Published</option><option value="draft">Draft</option></select>
          <select aria-label="Filter content by trash status" value={trashed} onChange={(event) => { const value = event.target.value; setTrashed(value); onRefresh({ search, status: filter, trashed: value }) }}><option value="">Active content</option><option value="only">Trash</option><option value="with">Active + trash</option></select>
          <button className="admin-search-submit" type="submit" aria-label="Search articles" title="Search"><AppIcon name="search" /></button>
        </form>
        <button className="admin-primary-button" type="button" onClick={() => setEditor({ ...emptyContent })}><AppIcon name="plus" />New content</button>
      </div> : <AdminBulkDeleteBar busy={bulkDeleting} count={selectedIds.length} language={language} onClear={() => setSelectedIds([])} onDelete={removeSelectedContents} />}
      {actionError && <div className="admin-inline-error">{actionError}</div>}
      <section className="admin-panel admin-table-panel">
        <table className="admin-table">
          <thead><tr><th className="admin-selection-column"><AdminSelectionCheckbox checked={allSelectableSelected} disabled={!selectableContentIds.length || bulkDeleting} indeterminate={selectedIds.length > 0 && !allSelectableSelected} label={language === 'th' ? 'เลือกเนื้อหาทั้งหมดในหน้านี้' : 'Select all content on this page'} onChange={toggleAllContents} /></th><th className="admin-index-column">#</th><th>Content</th><th>Category</th><th>Status</th><th>Version</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {contents.map((content, index) => (
              <tr className={`${content.deleted_at ? 'is-trashed' : ''} ${selectedIdSet.has(content.id) ? 'is-selected' : ''}`.trim()} key={content.id}>
                <td className="admin-selection-cell"><AdminSelectionCheckbox checked={selectedIdSet.has(content.id)} disabled={Boolean(content.deleted_at) || bulkDeleting} label={language === 'th' ? `เลือก ${content.title_th || content.title}` : `Select ${content.title || content.title_th}`} onChange={(checked) => toggleContent(content.id, checked)} /></td>
                <td className="admin-index-cell">{index + 1}</td>
                <td><div className="admin-content-cell">{content.cover_image_url ? <img src={resolveAssetUrl(content.cover_image_url)} alt="" /> : <span><AppIcon name="bookmark" /></span>}<div><strong>{language === 'th' ? (content.title_th || content.title) : (content.title || content.title_th)}</strong><small>/{content.slug}</small></div></div></td>
                <td>{adminText(language, content.category)}</td><td><StatusBadge status={content.deleted_at ? 'archived' : content.status} /></td><td>v{content.version}</td><td>{formatDate(content.updated_at, true)}</td>
                <td><div className="admin-row-actions">{selectedIds.length === 0 && <>{!content.deleted_at && <button className="is-edit" disabled={editingContentId !== null} type="button" onClick={() => editContent(content)}><AppIcon name="settings" />{editingContentId === content.id ? 'Loading…' : 'Edit'}</button>}{!content.deleted_at && <button className="is-danger" type="button" aria-label={`Move ${content.title} to trash`} onClick={() => remove(content)}><AppIcon name="trash" /></button>}{content.deleted_at && <button className="is-restore" type="button" onClick={() => restore(content)}><AppIcon name="history" />Restore</button>}</>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!contents.length && <div className="admin-empty"><AppIcon name="bookmark" /><strong>No articles found</strong><span>Adjust the filter or create a new article.</span></div>}
      </section>
      {editor && <ContentEditor content={editor} interfaceLanguage={language} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await onRefresh({ search, status: filter, trashed }) }} />}
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

const eventFactorOptions = environmentFactorOptions

const eventOperatorOptions = [
  { value: 'above', label: 'Above' },
  { value: 'above_or_equal', label: 'At least' },
  { value: 'below', label: 'Below' },
  { value: 'below_or_equal', label: 'At most' },
  { value: 'between', label: 'Between' },
  { value: 'outside', label: 'Outside' },
  { value: 'equals', label: 'Equals' },
]

function eventFactorLabel(value) {
  return eventFactorOptions.find((option) => option.value === value)?.label || value.replaceAll('_', ' ')
}

function eventNumber(value, fieldLabel) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${fieldLabel} must be a number.`)
  return parsed
}

function normaliseEventConditions(value) {
  const rows = Array.isArray(value) ? value : []
  return rows.map((condition, index) => {
    const factor = String(condition?.factor ?? '').trim()
    const operator = String(condition?.operator ?? '').trim()
    const valueInput = condition?.value ?? ''
    const minInput = condition?.min ?? ''
    const maxInput = condition?.max ?? ''
    const hasInput = factor || operator || valueInput !== '' || minInput !== '' || maxInput !== ''
    if (!hasInput) return null
    if (!factor) throw new Error(`Condition ${index + 1} needs a factor.`)
    if (!operator) throw new Error(`Condition ${index + 1} needs an operator.`)
    if (['between', 'outside'].includes(operator)) {
      const min = eventNumber(minInput, `Condition ${index + 1} minimum`)
      const max = eventNumber(maxInput, `Condition ${index + 1} maximum`)
      if (min === null || max === null) throw new Error(`Condition ${index + 1} needs both a minimum and maximum.`)
      return { factor, operator, min, max }
    }
    const parsedValue = eventNumber(valueInput, `Condition ${index + 1} value`)
    if (parsedValue === null) throw new Error(`Condition ${index + 1} needs a value.`)
    return { factor, operator, value: parsedValue }
  }).filter(Boolean)
}

function normaliseEventEffects(value) {
  const effects = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const factorDelta = effects.factor_delta && typeof effects.factor_delta === 'object' && !Array.isArray(effects.factor_delta) ? effects.factor_delta : {}
  const cleanedDelta = {}
  for (const [factor, delta] of Object.entries(factorDelta)) {
    const parsed = eventNumber(delta, `${eventFactorLabel(factor)} effect`)
    if (parsed !== null) cleanedDelta[factor] = parsed
  }
  return { ...effects, factor_delta: cleanedDelta }
}

function ConditionListEditor({ label, conditions, onChange, disabled, wide }) {
  const safeConditions = Array.isArray(conditions) ? conditions : []

  function updateCondition(index, key, value) {
    onChange(safeConditions.map((condition, conditionIndex) => conditionIndex === index ? { ...(condition || {}), [key]: value } : condition))
  }

  function removeCondition(index) {
    onChange(safeConditions.filter((_, conditionIndex) => conditionIndex !== index))
  }

  return (
    <section className={`admin-resource-custom-field ${wide ? 'is-wide' : ''}`} aria-label={label}>
      <div className="admin-list-editor__heading">
        <div><strong>{label}</strong><small>Add rules only when an event should be limited to a specific environment. Empty means any environment.</small></div>
        <span className="admin-list-editor__count">{safeConditions.length} {safeConditions.length === 1 ? 'condition' : 'conditions'}</span>
      </div>
      <div className="admin-event-condition-list__stack">
        {safeConditions.length === 0 ? (
          <div className="admin-list-editor__empty">No conditions. This event can be considered in any matching mode.</div>
        ) : safeConditions.map((condition, index) => {
          const isRange = ['between', 'outside'].includes(condition?.operator)
          return (
            <div className="admin-event-condition-row" key={index}>
              <div className="admin-event-condition-row__head"><span className="admin-list-editor__index">{String(index + 1).padStart(2, '0')}</span><strong>Condition {index + 1}</strong><button aria-label={`Remove condition ${index + 1}`} disabled={disabled} title="Remove condition" type="button" onClick={() => removeCondition(index)}><span aria-hidden="true">×</span></button></div>
              <div className="admin-event-condition-row__grid">
                <label><span>Factor</span><select disabled={disabled} value={condition?.factor ?? ''} onChange={(event) => updateCondition(index, 'factor', event.target.value)}><option value="">Choose factor</option>{eventFactorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label><span>Rule</span><select disabled={disabled} value={condition?.operator ?? ''} onChange={(event) => updateCondition(index, 'operator', event.target.value)}><option value="">Choose rule</option>{eventOperatorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                {isRange ? (
                  <>
                    <label><span>Minimum</span><input disabled={disabled} type="number" value={condition?.min ?? ''} onChange={(event) => updateCondition(index, 'min', event.target.value)} /></label>
                    <label><span>Maximum</span><input disabled={disabled} type="number" value={condition?.max ?? ''} onChange={(event) => updateCondition(index, 'max', event.target.value)} /></label>
                  </>
                ) : (
                  <label className="is-value"><span>Value</span><input disabled={disabled} type="number" value={condition?.value ?? ''} onChange={(event) => updateCondition(index, 'value', event.target.value)} /></label>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <button className="admin-list-editor__add" disabled={disabled} type="button" onClick={() => onChange([...safeConditions, { factor: '', operator: '', value: '', min: '', max: '' }])}><span aria-hidden="true">+</span>Add condition</button>
    </section>
  )
}

function EffectMapEditor({ label, value, onChange, disabled, wide }) {
  const effects = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const factorDelta = effects.factor_delta && typeof effects.factor_delta === 'object' && !Array.isArray(effects.factor_delta) ? effects.factor_delta : {}
  const storedFactors = Object.keys(factorDelta)
  const factors = [...eventFactorOptions, ...storedFactors.filter((factor) => !eventFactorOptions.some((option) => option.value === factor)).map((factor) => ({ value: factor, label: eventFactorLabel(factor) }))]
  const canAdd = eventFactorOptions.some((option) => !Object.prototype.hasOwnProperty.call(factorDelta, option.value))

  function updateFactor(oldFactor, newFactor) {
    const nextDelta = { ...factorDelta }
    const currentValue = nextDelta[oldFactor] ?? 0
    delete nextDelta[oldFactor]
    nextDelta[newFactor] = currentValue
    onChange({ ...effects, factor_delta: nextDelta })
  }

  function updateDelta(factor, valueInput) {
    onChange({ ...effects, factor_delta: { ...factorDelta, [factor]: valueInput } })
  }

  function removeFactor(factor) {
    const nextDelta = { ...factorDelta }
    delete nextDelta[factor]
    onChange({ ...effects, factor_delta: nextDelta })
  }

  function addFactor() {
    const nextFactor = eventFactorOptions.find((option) => !Object.prototype.hasOwnProperty.call(factorDelta, option.value))?.value
    if (nextFactor) onChange({ ...effects, factor_delta: { ...factorDelta, [nextFactor]: 0 } })
  }

  return (
    <section className={`admin-resource-custom-field ${wide ? 'is-wide' : ''}`} aria-label={label}>
      <div className="admin-list-editor__heading">
        <div><strong>{label}</strong><small>Choose which environmental factors change while the event is active. Negative values reduce a factor.</small></div>
        <span className="admin-list-editor__count">{storedFactors.length} {storedFactors.length === 1 ? 'factor' : 'factors'}</span>
      </div>
      <div className="admin-event-effect-list__stack">
        {storedFactors.length === 0 ? (
          <div className="admin-list-editor__empty">No factor effects yet. Add one to make this event change the simulation.</div>
        ) : storedFactors.map((factor) => (
          <div className="admin-event-effect-row" key={factor}>
            <select aria-label={`Effect factor ${factor}`} disabled={disabled} value={factor} onChange={(event) => updateFactor(factor, event.target.value)}>{factors.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <label><span>Change</span><input aria-label={`${eventFactorLabel(factor)} effect change`} disabled={disabled} type="number" value={factorDelta[factor] ?? ''} onChange={(event) => updateDelta(factor, event.target.value)} /></label>
            <button aria-label={`Remove ${eventFactorLabel(factor)} effect`} disabled={disabled} title="Remove effect" type="button" onClick={() => removeFactor(factor)}><span aria-hidden="true">×</span></button>
          </div>
        ))}
      </div>
      <button className="admin-list-editor__add" disabled={disabled || !canAdd} type="button" onClick={addFactor}><span aria-hidden="true">+</span>{canAdd ? 'Add factor effect' : 'All factors added'}</button>
    </section>
  )
}

function StringListEditor({ label, items, onChange, options = [], placeholder, addLabel, emptyLabel, hint, disabled, wide }) {
  const safeItems = Array.isArray(items) ? items : []
  const selectOptions = options.map((option) => typeof option === 'object' ? option : { value: option, label: option })
  const nextOption = selectOptions.find((option) => !safeItems.includes(option.value))

  function updateItem(index, value) {
    onChange(safeItems.map((item, itemIndex) => (itemIndex === index ? value : item)))
  }

  function removeItem(index) {
    onChange(safeItems.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <section className={`admin-resource-custom-field ${wide ? 'is-wide' : ''}`} aria-label={label}>
      <div className="admin-list-editor__heading">
        <div><strong>{label}</strong><small>{hint || 'One clear instruction per line. Empty lines are removed when saved.'}</small></div>
        <span className="admin-list-editor__count">{safeItems.length} {safeItems.length === 1 ? 'item' : 'items'}</span>
      </div>
      <div className="admin-list-editor__stack">
        {safeItems.length === 0 ? (
          <div className="admin-list-editor__empty">{emptyLabel}</div>
        ) : safeItems.map((item, index) => (
          <div className="admin-list-editor__row" key={index}>
            <span className="admin-list-editor__index">{String(index + 1).padStart(2, '0')}</span>
            {selectOptions.length ? (
              <select aria-label={`${label} ${index + 1}`} disabled={disabled} value={item ?? ''} onChange={(event) => updateItem(index, event.target.value)}>
                <option value="">Choose an action</option>
                {!selectOptions.some((option) => option.value === item) && item && <option value={item}>{item} (existing)</option>}
                {selectOptions.map((option) => <option disabled={safeItems.some((selected, selectedIndex) => selectedIndex !== index && selected === option.value)} key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            ) : (
              <input aria-label={`${label} ${index + 1}`} disabled={disabled} placeholder={placeholder} type="text" value={item ?? ''} onChange={(event) => updateItem(index, event.target.value)} />
            )}
            <button aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} disabled={disabled} title="Remove item" type="button" onClick={() => removeItem(index)}><span aria-hidden="true">×</span></button>
          </div>
        ))}
      </div>
      <button className="admin-list-editor__add" disabled={disabled || (selectOptions.length > 0 && !nextOption)} type="button" onClick={() => onChange([...safeItems, nextOption?.value ?? ''])}><span aria-hidden="true">+</span>{addLabel || 'Add item'}</button>
    </section>
  )
}

function ReferenceListEditor({ label, items, onChange, disabled, wide }) {
  const safeItems = Array.isArray(items) ? items : []

  function updateItem(index, key, value) {
    onChange(safeItems.map((item, itemIndex) => itemIndex === index ? { ...(item || {}), [key]: value } : item))
  }

  function removeItem(index) {
    onChange(safeItems.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <section className={`admin-resource-custom-field ${wide ? 'is-wide' : ''}`} aria-label={label}>
      <div className="admin-list-editor__heading">
        <div><strong>{label}</strong><small>Add a source name and URL. The URL is required for each non-empty reference.</small></div>
        <span className="admin-list-editor__count">{safeItems.length} {safeItems.length === 1 ? 'source' : 'sources'}</span>
      </div>
      <div className="admin-reference-list__stack">
        {safeItems.length === 0 ? (
          <div className="admin-list-editor__empty">No references yet. Add trusted sources to support this guide.</div>
        ) : safeItems.map((source, index) => (
          <div className="admin-reference-list__row" key={index}>
            <div className="admin-reference-list__row-head"><span className="admin-list-editor__index">{String(index + 1).padStart(2, '0')}</span><strong>Reference {index + 1}</strong><button aria-label={`Remove reference ${index + 1}`} disabled={disabled} title="Remove reference" type="button" onClick={() => removeItem(index)}><span aria-hidden="true">×</span></button></div>
            <div className="admin-reference-list__grid">
              <input aria-label={`Reference ${index + 1} English title`} disabled={disabled} placeholder="English source name" type="text" value={source?.label_en ?? ''} onChange={(event) => updateItem(index, 'label_en', event.target.value)} />
              <input aria-label={`Reference ${index + 1} Thai title`} disabled={disabled} placeholder="Thai source name" type="text" value={source?.label_th ?? ''} onChange={(event) => updateItem(index, 'label_th', event.target.value)} />
              <input aria-label={`Reference ${index + 1} URL`} className="is-url" disabled={disabled} placeholder="https://trusted-source.example/..." type="url" value={source?.url ?? ''} onChange={(event) => updateItem(index, 'url', event.target.value)} />
            </div>
          </div>
        ))}
      </div>
      <button className="admin-list-editor__add" disabled={disabled} type="button" onClick={() => onChange([...safeItems, { label_en: '', label_th: '', url: '' }])}><span aria-hidden="true">+</span>Add reference</button>
    </section>
  )
}

function parseRgbColor(value) {
  const text = String(value ?? '').trim()
  const hex = text.match(/^#([\da-f]{3}|[\da-f]{6})$/i)
  if (hex) {
    const full = hex[1].length === 3 ? [...hex[1]].map((channel) => channel + channel).join('') : hex[1]
    return [0, 2, 4].map((index) => Number.parseInt(full.slice(index, index + 2), 16))
  }
  const rgb = text.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,[^)]+)?\)$/i)
  if (!rgb) return null
  return rgb.slice(1, 4).map((channel) => Math.min(255, Math.max(0, Number(channel))))
}

function rgbToHex(channels) {
  return `#${channels.map((channel) => Math.min(255, Math.max(0, Number(channel) || 0)).toString(16).padStart(2, '0')).join('')}`
}

function ColorRgbField({ disabled, label, onChange, required, value }) {
  const channels = parseRgbColor(value) ?? [0, 0, 0]
  const pickerValue = rgbToHex(channels)

  function updateChannel(index, nextValue) {
    const nextChannels = [...channels]
    nextChannels[index] = Math.min(255, Math.max(0, Number(nextValue) || 0))
    onChange(rgbToHex(nextChannels))
  }

  return (
    <section className="admin-color-field" aria-label={label}>
      <div className="admin-color-field__heading"><strong>{label}{required && <em>*</em>}</strong><small>Choose a color or enter RGB values from 0–255</small></div>
      <div className="admin-color-field__controls">
        <label className="admin-color-field__picker"><input aria-label={`${label} color picker`} disabled={disabled} type="color" value={pickerValue} onChange={(event) => onChange(event.target.value)} /><i style={{ backgroundColor: value || pickerValue }} /></label>
        {channels.map((channel, index) => <label className="admin-color-field__channel" key={['R', 'G', 'B'][index]}><span>{['R', 'G', 'B'][index]}</span><input aria-label={`${label} ${['red', 'green', 'blue'][index]}`} disabled={disabled} max="255" min="0" type="number" value={channel} onChange={(event) => updateChannel(index, event.target.value)} /></label>)}
      </div>
      <input className="admin-color-field__code" disabled={disabled} pattern="(?:#[0-9a-fA-F]{3,6}|rgba?\(.+\))" required={required} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
    </section>
  )
}

function ItemEffectEditor({ disabled, label, onChange, value, wide }) {
  let effects = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  if (typeof value === 'string') {
    try { effects = JSON.parse(value) } catch { effects = {} }
  }
  const strategyOptions = [
    { value: '', label: 'No extra behavior' },
    { value: 'refill_reserve', label: 'Refill a plant reserve' },
    { value: 'toward_healthy_midpoint', label: 'Move environment toward healthy range' },
    { value: 'drainage', label: 'Reduce excess soil moisture' },
    { value: 'moisture_retention', label: 'Retain water and soil moisture' },
    { value: 'moisture_retention', label: 'Retain water and soil moisture' },
  ]

  function update(key, nextValue) {
    onChange({ ...effects, [key]: nextValue })
  }

  return (
    <section className={`admin-resource-custom-field admin-item-effect-editor ${wide ? 'is-wide' : ''}`} aria-label={label}>
      <div className="admin-list-editor__heading"><div><strong>{label}</strong><small>Choose the intended result. The system builds the data without requiring JSON.</small></div><span className="admin-list-editor__count">EASY SETUP</span></div>
      <div className="admin-item-effect-editor__grid">
        <label><span>Behavior</span><select disabled={disabled} value={effects.strategy ?? ''} onChange={(event) => update('strategy', event.target.value)}>{strategyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Resource</span><select disabled={disabled} value={effects.resource ?? ''} onChange={(event) => update('resource', event.target.value)}><option value="">Automatic / not needed</option><option value="water">Water reserve</option><option value="fertilizer">Fertilizer reserve</option><option value="soil_humidity">Soil moisture</option><option value="light">Light</option><option value="air_humidity">Air humidity</option><option value="soil_temp">Soil temperature</option><option value="air_temp">Air temperature</option></select></label>
        <label><span>Duration (updates)</span><input disabled={disabled} min="1" type="number" value={effects.duration_ticks ?? 1} onChange={(event) => update('duration_ticks', event.target.value)} /></label>
        <label><span>Duration (seconds)</span><input disabled={disabled} max="300" min="5" type="number" value={effects.duration_seconds ?? 30} onChange={(event) => update('duration_seconds', event.target.value)} /></label>
      </div>
      <p className="admin-item-effect-editor__summary">{effects.strategy ? `Selected effect: ${strategyOptions.find((option) => option.value === effects.strategy)?.label ?? effects.strategy}${effects.resource ? ` · ${effects.resource.replaceAll('_', ' ')}` : ''}` : 'No extra behavior. The effect type and strength above will be used.'}</p>
    </section>
  )
}

function ResourceEditor({ config, record, lookups, onClose, onSaved }) {
  const [initialForm] = useState(() => ({ ...config.defaults, ...record }))
  const [form, setForm] = useState(initialForm)
  const [imageFiles, setImageFiles] = useState({})
  const [modelBundles, setModelBundles] = useState({})
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const quickPlantCreate = config.id === 'plants' && !record?.id
  const visibleFields = useMemo(() => quickPlantCreate
    ? config.fields.filter((field) => ['name_en', 'name_th', 'description', 'base_image_url', 'base_model_url'].includes(field.key))
    : config.fields, [config.fields, quickPlantCreate])
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

  function fieldRequired(field) {
    if (field.required) return true
    return config.id === 'pests'
      && field.key === 'model_url'
      && form.placement_mode !== 'plant_surface'
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

      if (config.id === 'items' && key === 'effect_type' && itemEffectPresets[value]) {
        Object.assign(next, itemEffectPresets[value])
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
        if (field.type === 'string-list') {
          const list = Array.isArray(payload[field.key]) ? payload[field.key] : typeof payload[field.key] === 'string' ? payload[field.key].split('\n') : []
          payload[field.key] = list.map((item) => String(item ?? '').trim()).filter(Boolean)
        }
        if (field.type === 'condition-list') payload[field.key] = normaliseEventConditions(payload[field.key])
        if (field.type === 'effect-map') payload[field.key] = normaliseEventEffects(payload[field.key])
        if (field.type === 'item-effect') {
          const effects = payload[field.key] && typeof payload[field.key] === 'object' && !Array.isArray(payload[field.key]) ? { ...payload[field.key] } : {}
          if (!effects.strategy) delete effects.strategy
          if (!effects.resource) delete effects.resource
          if (effects.duration_ticks !== undefined && effects.duration_ticks !== '') effects.duration_ticks = Math.max(1, Number(effects.duration_ticks) || 1)
          else delete effects.duration_ticks
          if (effects.duration_seconds !== undefined && effects.duration_seconds !== '') effects.duration_seconds = Math.min(300, Math.max(5, Number(effects.duration_seconds) || 30))
          else delete effects.duration_seconds
          payload[field.key] = effects
        }
        if (field.type === 'reference-list') {
          const references = Array.isArray(payload[field.key]) ? payload[field.key] : []
          const cleanedReferences = references.map((source) => ({
            label_en: String(source?.label_en ?? '').trim(),
            label_th: String(source?.label_th ?? '').trim(),
            url: String(source?.url ?? '').trim(),
          })).filter((source) => source.label_en || source.label_th || source.url)
          const incompleteIndex = cleanedReferences.findIndex((source) => !source.url)
          if (incompleteIndex >= 0) throw new Error(`Reference ${incompleteIndex + 1} needs a URL before it can be saved.`)
          payload[field.key] = cleanedReferences
        }
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
        if (fieldRequired(field) && !payload[field.key] && !bundle?.model) {
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
          {quickPlantCreate && <div className="admin-quick-create-note"><span><AppIcon name="robot" /></span><div><strong>{document.documentElement.lang === 'th' ? 'กรอกเพียงข้อมูลหลัก' : 'Only the essentials are needed'}</strong><p>{document.documentElement.lang === 'th' ? 'ระบบจะใส่ค่าช่วงสภาพแวดล้อมมาตรฐาน และสร้างระยะเริ่มต้น 3 ระยะให้อัตโนมัติ หลังบันทึกจะแจ้งเฉพาะข้อมูลที่ยังขาดตรงมุมขวาล่าง' : 'Standard environment ranges and three starter growth stages are generated automatically. Only missing information will be shown afterward.'}</p></div></div>}
          <div className="admin-resource-form-grid">
            {visibleFields.map((field) => (
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
                  required={fieldRequired(field) && !form[field.key]}
                  value={form[field.key]}
                />
              ) : field.type === 'model-bundle' ? (
                <ModelBundleField
                  bundle={modelBundles[field.key]}
                  disabled={status !== 'idle'}
                  key={field.key}
                  label={field.label}
                  onChange={(bundle) => setModelBundles((current) => ({ ...current, [field.key]: bundle }))}
                  required={fieldRequired(field) && !form[field.key]}
                  value={form[field.key]}
                />
              ) : field.type === 'color-rgb' ? (
                <ColorRgbField
                  disabled={status !== 'idle'}
                  key={field.key}
                  label={field.label}
                  onChange={(value) => updateField(field.key, value)}
                  required={fieldRequired(field)}
                  value={form[field.key]}
                />
              ) : field.type === 'item-effect' ? (
                <ItemEffectEditor
                  disabled={status !== 'idle'}
                  key={field.key}
                  label={field.label}
                  onChange={(value) => updateField(field.key, value)}
                  value={form[field.key]}
                  wide={field.wide}
                />
              ) : field.type === 'string-list' ? (
                <StringListEditor
                  addLabel={field.addLabel}
                  disabled={status !== 'idle'}
                  emptyLabel={field.emptyLabel}
                  hint={field.hint}
                  items={form[field.key]}
                  key={field.key}
                  label={field.label}
                  onChange={(items) => updateField(field.key, items)}
                  options={field.optionLookup === 'item-actions' ? (lookups.items ?? []).filter((item) => item.action_key).map((item) => ({ value: item.action_key, label: `${item.name} · ${item.action_key}` })) : field.options}
                  placeholder={field.itemPlaceholder}
                  wide={field.wide}
                />
              ) : field.type === 'reference-list' ? (
                <ReferenceListEditor
                  disabled={status !== 'idle'}
                  items={form[field.key]}
                  key={field.key}
                  label={field.label}
                  onChange={(items) => updateField(field.key, items)}
                  wide={field.wide}
                />
              ) : field.type === 'condition-list' ? (
                <ConditionListEditor
                  conditions={form[field.key]}
                  disabled={status !== 'idle'}
                  key={field.key}
                  label={field.label}
                  onChange={(conditions) => updateField(field.key, conditions)}
                  wide={field.wide}
                />
              ) : field.type === 'effect-map' ? (
                <EffectMapEditor
                  disabled={status !== 'idle'}
                  key={field.key}
                  label={field.label}
                  onChange={(effects) => updateField(field.key, effects)}
                  value={form[field.key]}
                  wide={field.wide}
                />
              ) : <label className={field.wide ? 'is-wide' : ''} key={field.key}>
                {field.label}{fieldRequired(field) && <em>*</em>}
                {field.type === 'textarea' || field.type === 'json' ? (
                  <textarea className={field.type === 'json' ? 'admin-code-field' : ''} required={fieldRequired(field)} rows={field.type === 'json' ? 8 : 4} value={fieldValue(field)} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} />
                ) : field.type === 'select' ? (
                  <select required={fieldRequired(field)} value={fieldValue(field)} onChange={(event) => updateField(field.key, event.target.value)}>{field.options.map((option) => {
                    const optionValue = typeof option === 'object' ? option.value : option
                    const optionLabel = typeof option === 'object' ? option.label : option
                    return <option key={optionValue} value={optionValue}>{optionLabel}</option>
                  })}{fieldValue(field) !== '' && !field.options.some((option) => String(typeof option === 'object' ? option.value : option) === String(fieldValue(field))) && <option value={fieldValue(field)}>{fieldValue(field)} (existing)</option>}</select>
                ) : field.type === 'lookup' ? (
                  <>
                    <select
                      disabled={field.lookup === 'stages' && (!form.plant_id || !lookupOptions(field).length)}
                      required={fieldRequired(field)}
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
                  <input required={fieldRequired(field)} type={field.type || 'text'} step={field.step} value={fieldValue(field)} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} />
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
  if (format === 'duration') return formatPlantDuration(record, document.documentElement.lang === 'th' ? 'th' : 'en')
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
  const plantName = localizedAdminName(record.plant)

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
          {!record.deleted_at && !config.readOnly && !config.noDelete && <button className="is-danger" type="button" onClick={onDelete}><AppIcon name="trash" />Move to trash</button>}
          {record.deleted_at && !config.readOnly && <button type="button" onClick={onRestore}><AppIcon name="history" />Restore record</button>}
          <button className="is-primary" type="button" onClick={onClose}>Done</button>
        </footer>
      </aside>
    </div>
  )
}

const plantSetupSteps = [
  { resource: 'plants', icon: 'plant', countKey: null, minimum: 1 },
  { resource: 'plant-stages', icon: 'sprout', countKey: 'stages_count', minimum: 3 },
  { resource: 'plant-rules', icon: 'settings', countKey: 'condition_rules_count', minimum: 1 },
  { resource: 'plant-variants', icon: 'eye', countKey: 'visual_variants_count', minimum: 1 },
  { resource: 'plant-knowledge', icon: 'bookmark', countKey: 'knowledge_count', minimum: 1 },
]

const plantSetupCopy = {
  en: {
    title: 'Plant setup is incomplete', select: 'Plant', progress: 'complete', next: 'Add next', missing: 'Still needed',
    steps: [
      ['Plant information', 'Add names, image, base 3D model, growing duration, and suitable conditions.'],
      ['Growth stages', 'Add at least 3 stages: seed, young plant, and mature plant.'],
      ['Environment rules', 'Define how unsuitable water, light, humidity, and temperature affect the plant.'],
      ['Visual states', 'Set how the plant looks when healthy or affected by each condition.'],
      ['Plant guide', 'Add the public description, care instructions, photo, and trusted references.'],
    ],
  },
  th: {
    title: 'การตั้งค่าพืชยังไม่เสร็จ', select: 'พืช', progress: 'เสร็จแล้ว', next: 'เพิ่มขั้นตอนถัดไป', missing: 'ยังต้องเพิ่ม',
    steps: [
      ['ข้อมูลพืช', 'เพิ่มชื่อ รูป โมเดล 3 มิติ ระยะโตเต็มที่ และช่วงสภาพแวดล้อมที่เหมาะสม'],
      ['ระยะการเติบโต', 'เพิ่มอย่างน้อย 3 ระยะ ได้แก่ เมล็ด ต้นอ่อน และโตเต็มที่'],
      ['กฎสภาพแวดล้อม', 'กำหนดผลของน้ำ แสง ความชื้น และอุณหภูมิที่ไม่เหมาะสม'],
      ['รูปแบบการแสดงผล', 'กำหนดลักษณะของพืชเมื่อสมบูรณ์หรือได้รับผลจากแต่ละสภาวะ'],
      ['คู่มือพืช', 'เพิ่มคำอธิบาย วิธีดูแล รูปภาพ และแหล่งอ้างอิงที่น่าเชื่อถือ'],
    ],
  },
}

const plantSetupReminderCollapsedKey = 'plant-growth-admin-plant-reminder-collapsed'

function PlantSetupReminder({ language, onOpenStep, onSelectPlant, plants, selectedPlantId }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(plantSetupReminderCollapsedKey) === 'true'
    } catch {
      return false
    }
  })
  const copy = plantSetupCopy[language === 'th' ? 'th' : 'en']
  const incompletePlants = plants.filter((plant) => plantSetupSteps.some((step) => step.countKey !== null && Number(plant[step.countKey] ?? 0) < step.minimum))
  const selectedPlant = incompletePlants.find((plant) => String(plant.id) === String(selectedPlantId)) ?? incompletePlants[0]
  if (!selectedPlant) return null

  const stepStates = plantSetupSteps.map((step) => step.countKey === null || Number(selectedPlant[step.countKey] ?? 0) >= step.minimum)
  const completedCount = stepStates.filter(Boolean).length
  const currentStepIndex = stepStates.findIndex((complete) => !complete)
  const currentStep = plantSetupSteps[currentStepIndex]
  const missingLabels = stepStates.map((complete, index) => complete ? null : copy.steps[index][0]).filter(Boolean)

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    try {
      window.localStorage.setItem(plantSetupReminderCollapsedKey, String(next))
    } catch {
      // The reminder still works when browser storage is unavailable.
    }
  }

  return (
    <aside className={`admin-plant-reminder ${collapsed ? 'is-collapsed' : ''}`} aria-live="polite">
      <header>
        <span><AppIcon name="plant" /></span>
        <div><small>{localizedAdminName(selectedPlant)}</small><strong>{copy.title}</strong></div>
        <em>{completedCount}/{plantSetupSteps.length}</em>
        <button aria-controls="admin-plant-reminder-details" aria-expanded={!collapsed} aria-label={collapsed ? (language === 'th' ? 'ขยายกล่องสถานะการตั้งค่าพืช' : 'Expand plant setup status') : (language === 'th' ? 'พับกล่องสถานะการตั้งค่าพืช' : 'Collapse plant setup status')} title={collapsed ? (language === 'th' ? 'ขยาย' : 'Expand') : (language === 'th' ? 'พับ' : 'Collapse')} type="button" onClick={toggleCollapsed}><AppIcon name={collapsed ? 'arrowDown' : 'arrowUp'} /></button>
      </header>
      <div className="admin-plant-reminder__details" id="admin-plant-reminder-details" hidden={collapsed}>
        {incompletePlants.length > 1 && <label>{copy.select}<select value={selectedPlant.id} onChange={(event) => onSelectPlant(event.target.value)}>{incompletePlants.map((plant) => <option value={plant.id} key={plant.id}>{localizedAdminName(plant)}</option>)}</select></label>}
        <div className="admin-plant-reminder__progress"><i><span style={{ width: `${(completedCount / plantSetupSteps.length) * 100}%` }} /></i><small>{completedCount}/{plantSetupSteps.length} {copy.progress}</small></div>
        <div className="admin-plant-reminder__next"><span><AppIcon name={currentStep.icon} /></span><div><small>{copy.next}</small><strong>{copy.steps[currentStepIndex][0]}</strong><p>{copy.steps[currentStepIndex][1]}</p></div></div>
        <div className="admin-plant-reminder__missing"><small>{copy.missing}</small><span>{missingLabels.join(' · ')}</span></div>
        <button type="button" onClick={() => onOpenStep(currentStep.resource, selectedPlant, false)}>{copy.next}<AppIcon name="arrowForward" /></button>
      </div>
    </aside>
  )
}

function PlantAutoSetupBar({ busy, language, onGenerate, onSelectPlant, plants }) {
  const isThai = language === 'th'
  const [selectedPlantId, setSelectedPlantId] = useState('')
  if (!plants.length) return null
  const value = plants.some((plant) => String(plant.id) === String(selectedPlantId)) ? selectedPlantId : ''
  const placeholder = isThai ? 'เลือกพืชที่ต้องการ' : 'Select the plant you want'
  return (
    <section className="admin-auto-setup-bar">
      <span><AppIcon name="robot" /></span>
      <div><strong>{isThai ? 'สร้างกฎและรูปแบบให้อัตโนมัติ' : 'Generate rules and visual states'}</strong><small>{isThai ? 'ระบบใช้ช่วงสภาพแวดล้อมของพืชสร้างรายการที่สัมพันธ์กัน โดยไม่เขียนทับสิ่งที่แก้ไว้แล้ว' : 'Uses the plant’s suitable ranges and keeps existing custom records unchanged.'}</small></div>
      <select aria-label={isThai ? 'เลือกพืชที่จะสร้างชุดแนะนำ' : 'Select a plant for automatic setup'} value={value} onChange={(event) => { setSelectedPlantId(event.target.value); onSelectPlant(event.target.value) }}><option value="" disabled>{placeholder}</option>{plants.map((plant) => <option value={plant.id} key={plant.id}>{localizedAdminName(plant)}</option>)}</select>
      <button disabled={busy || !value} type="button" onClick={() => onGenerate(value)}><AppIcon name={busy ? 'restartAlt' : 'bolt'} />{busy ? (isThai ? 'กำลังสร้าง…' : 'Generating…') : (isThai ? 'สร้างชุดแนะนำ' : 'Generate set')}</button>
    </section>
  )
}

function ResourceView({ groupKey, language = 'en' }) {
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
  const [setupPlants, setSetupPlants] = useState([])
  const [setupPlantId, setSetupPlantId] = useState('')
  const [generatingSetup, setGeneratingSetup] = useState(false)
  const [selectedIdState, setSelectedIds] = useState([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const refreshInFlightRef = useRef(false)
  const config = configs.find((item) => item.id === activeResource) ?? configs[0]
  const records = payload?.data ?? []
  const pagination = payload?.current_page ? payload : null
  const selectionEnabled = !config.readOnly && !config.noDelete
  const selectableRecordIds = selectionEnabled ? records.filter((record) => !record.deleted_at).map((record) => record.id) : []
  const availableRecordIds = new Set(selectableRecordIds)
  const selectedIds = selectedIdState.filter((id) => availableRecordIds.has(id))
  const selectedIdSet = new Set(selectedIds)
  const allSelectableSelected = selectableRecordIds.length > 0 && selectableRecordIds.every((id) => selectedIdSet.has(id))

  function toggleRecord(recordId, checked) {
    setSelectedIds((current) => checked
      ? [...new Set([...current, recordId])]
      : current.filter((id) => id !== recordId))
  }

  function toggleAllRecords(checked) {
    setSelectedIds(checked ? selectableRecordIds : [])
  }

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
        if (!cancelled) {
          setPayload(resourcePayload)
          setLookups(lookupPayload.data ?? {})
          if (groupKey === 'plants') {
            const plants = resourcePayload.data ?? []
            setSetupPlants(plants)
            setSetupPlantId((current) => current || String(plants.find((plant) => Number(plant.stages_count ?? 0) < 3 || Number(plant.condition_rules_count ?? 0) < 1 || Number(plant.visual_variants_count ?? 0) < 1 || Number(plant.knowledge_count ?? 0) < 1)?.id ?? plants[0]?.id ?? ''))
          }
          setLastUpdatedAt(new Date()); setRefreshState('connected'); setLoading(false)
        }
      })
      .catch((loadError) => { if (!cancelled) { setError(loadError.message || 'Unable to load management data.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [configs, groupKey])

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
    setSelectedIds([])
    setActiveResource(resource)
    setSearch('')
    setFilter('')
    setAppliedSearch('')
    setAppliedFilter('')
    setTrashed('')
    setEditor(null)
    setSelectedRecord(null)
    return load(resource)
  }

  async function openPlantSetupStep(resource, plant, complete = false) {
    const targetConfig = configs.find((item) => item.id === resource)
    if (!targetConfig) return
    await chooseResource(resource)
    if (complete) return
    setEditor(resource === 'plants' ? plant : { ...targetConfig.defaults, plant_id: String(plant.id) })
  }

  async function refreshPlantSetup(savedRecord) {
    const plantsPayload = await getAdminResource('plants')
    const plants = plantsPayload.data ?? []
    setSetupPlants(plants)
    if (savedRecord?.id && config.id === 'plants') setSetupPlantId(String(savedRecord.id))
  }

  async function generateRecommendedSetup(plantId) {
    const plant = setupPlants.find((item) => String(item.id) === String(plantId))
    if (!plant) return
    const confirmed = await confirmAdminAction({
      title: language === 'th' ? 'สร้างชุดแนะนำสำหรับพืชนี้หรือไม่' : 'Generate the recommended setup?',
      text: language === 'th' ? `ระบบจะเพิ่มกฎและรูปแบบที่ยังขาดสำหรับ “${localizedAdminName(plant)}” โดยไม่เขียนทับรายการเดิม` : `Missing rules and visual states will be added for “${localizedAdminName(plant)}” without replacing existing records.`,
      confirmButtonText: language === 'th' ? 'สร้างชุดแนะนำ' : 'Generate set',
      icon: 'question',
    })
    if (!confirmed) return
    setGeneratingSetup(true)
    setError('')
    try {
      await generateAdminPlantSetup(plant.id)
      await Promise.all([load(config.id, { search: appliedSearch, status: appliedFilter, trashed }), refreshPlantSetup()])
      await showAdminSuccess(language === 'th' ? 'สร้างชุดแนะนำแล้ว' : 'Recommended setup generated', language === 'th' ? 'เพิ่มกฎและรูปแบบที่ขาดเรียบร้อยแล้ว' : 'Missing rules and visual states were added.')
    } catch (setupError) {
      setError(setupError.message || (language === 'th' ? 'ไม่สามารถสร้างชุดแนะนำได้' : 'Unable to generate the recommended setup.'))
    } finally {
      setGeneratingSetup(false)
    }
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

  async function removeSelectedRecords() {
    if (!selectedIds.length || !selectionEnabled) return
    const confirmed = await confirmAdminAction({
      title: language === 'th' ? `ลบ ${selectedIds.length} รายการหรือไม่` : `Delete ${selectedIds.length} records?`,
      text: language === 'th' ? `รายการที่เลือกจาก “${adminText(language, config.label)}” จะถูกย้ายไปถังขยะและสามารถกู้คืนภายหลังได้` : `Selected records from “${config.label}” will move to trash and can be restored later.`,
      confirmButtonText: language === 'th' ? `ลบ ${selectedIds.length} รายการ` : `Delete ${selectedIds.length}`,
    })
    if (!confirmed) return

    setBulkDeleting(true)
    setError('')
    const ids = [...selectedIds]
    try {
      const results = await Promise.allSettled(ids.map((id) => deleteAdminResource(config.id, id)))
      const failedIds = ids.filter((_, index) => results[index].status === 'rejected')
      setSelectedIds(failedIds)
      await load(config.id, { search: appliedSearch, status: appliedFilter, trashed, page: pagination?.current_page ?? 1 })
      if (groupKey === 'plants') await refreshPlantSetup()
      if (failedIds.length) {
        setError(language === 'th' ? `ลบสำเร็จ ${ids.length - failedIds.length} รายการ และลบไม่สำเร็จ ${failedIds.length} รายการ` : `${ids.length - failedIds.length} deleted; ${failedIds.length} could not be deleted.`)
      } else {
        await showAdminSuccess(language === 'th' ? 'ลบรายการที่เลือกแล้ว' : 'Selected records deleted', language === 'th' ? `ย้าย ${ids.length} รายการไปถังขยะแล้ว` : `${ids.length} records moved to trash.`)
      }
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="admin-view admin-resource-view">
      <div className="admin-subtable-tabs" role="tablist" aria-label="Database tables">
        {configs.map((item) => <button className={activeResource === item.id ? 'is-active' : ''} type="button" role="tab" aria-selected={activeResource === item.id} key={item.id} onClick={() => chooseResource(item.id)}><AppIcon name={item.icon} /><span>{item.label}</span></button>)}
      </div>

      {groupKey === 'plants' && <PlantSetupReminder language={language} plants={setupPlants} selectedPlantId={setupPlantId} onSelectPlant={setSetupPlantId} onOpenStep={openPlantSetupStep} />}

      {selectedIds.length === 0 ? <div className="admin-content-toolbar">
        <form onSubmit={(event) => { event.preventDefault(); setSelectedIds([]); setAppliedSearch(search); setAppliedFilter(filter); load(config.id, { search, status: filter, trashed, page: 1 }) }}>
          <input aria-label={`Search ${config.label}`} placeholder="Search records" value={search} onChange={(event) => setSearch(event.target.value)} />
          {config.statusOptions && <select aria-label={`Filter ${config.label} by status`} value={filter} onChange={(event) => { const value = event.target.value; setSelectedIds([]); setFilter(value); setAppliedSearch(search); setAppliedFilter(value); load(config.id, { search, status: value, trashed, page: 1 }) }}><option value="">All status</option>{config.statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>}
          {!config.readOnly && !config.noTrashFilter && <select aria-label={`Filter ${config.label} by trash status`} value={trashed} onChange={(event) => { const value = event.target.value; setSelectedIds([]); setTrashed(value); setAppliedSearch(search); setAppliedFilter(filter); load(config.id, { search, status: filter, trashed: value, page: 1 }) }}><option value="">Active records</option><option value="only">Trash</option><option value="with">Active + trash</option></select>}
          <button className="admin-search-submit" type="submit" aria-label={`Search ${config.label}`} title="Search"><AppIcon name="search" /></button>
        </form>
        {!config.moderation && !config.readOnly && !config.noCreate && <button className="admin-primary-button" type="button" onClick={() => setEditor({ ...config.defaults })}><AppIcon name="plus" />{config.createLabel}</button>}
        <span className={`admin-refresh-state is-${refreshState}`}><i />{refreshState === 'stale' ? 'Update delayed' : 'Live data'}<small>{lastUpdatedAt ? `Last updated ${lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Connecting…'}</small></span>
      </div> : <AdminBulkDeleteBar busy={bulkDeleting} count={selectedIds.length} language={language} onClear={() => setSelectedIds([])} onDelete={removeSelectedRecords} />}

      {groupKey === 'plants' && ['plant-rules', 'plant-variants'].includes(activeResource) && <PlantAutoSetupBar busy={generatingSetup} language={language} plants={setupPlants} onSelectPlant={setSetupPlantId} onGenerate={generateRecommendedSetup} />}

      {error && <div className="admin-inline-error">{error}</div>}
      <section className="admin-panel admin-table-panel">
        {loading ? <div className="admin-resource-loading"><AdminTableSkeleton embedded /></div> : (
          <table className="admin-table admin-resource-table">
            <thead><tr>{selectionEnabled && <th className="admin-selection-column"><AdminSelectionCheckbox checked={allSelectableSelected} disabled={!selectableRecordIds.length || bulkDeleting} indeterminate={selectedIds.length > 0 && !allSelectableSelected} label={language === 'th' ? 'เลือกทุกรายการในหน้านี้' : 'Select all records on this page'} onChange={toggleAllRecords} /></th>}<th className="admin-index-column">#</th>{config.columns.map((column) => <th key={column.label}>{column.label}</th>)}{!config.readOnly && <th>Status</th>}<th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{records.map((record, index) => (
              <tr className={`${record.deleted_at ? 'is-trashed' : ''} ${selectedIdSet.has(record.id) ? 'is-selected' : ''}`.trim()} key={record.id}>
                {selectionEnabled && <td className="admin-selection-cell"><AdminSelectionCheckbox checked={selectedIdSet.has(record.id)} disabled={Boolean(record.deleted_at) || bulkDeleting} label={language === 'th' ? `เลือกรายการที่ ${record.id}` : `Select record ${record.id}`} onChange={(checked) => toggleRecord(record.id, checked)} /></td>}
                <td className="admin-index-cell">{pagination ? (pagination.current_page - 1) * pagination.per_page + index + 1 : index + 1}</td>
                {config.columns.map((column) => <td key={column.label}><span className="admin-table-value">{column.render(record) ?? '—'}</span></td>)}
                {!config.readOnly && <td>{record.deleted_at ? <StatusBadge status="archived" /> : config.moderation ? <div className="admin-moderation-controls"><select aria-label={`Change ${config.statusField.replaceAll('_', ' ')} for record #${record.id}`} disabled={selectedIds.length > 0 || bulkDeleting} value={record[config.statusField]} onChange={(event) => updateModeration(record, config.statusField, event.target.value)}>{config.statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>{config.extraStatusField && <select aria-label={`Change ${config.extraStatusField.replaceAll('_', ' ')} for record #${record.id}`} disabled={selectedIds.length > 0 || bulkDeleting} value={record[config.extraStatusField]} onChange={(event) => updateModeration(record, config.extraStatusField, event.target.value)}>{config.extraStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>}</div> : <StatusBadge status={record.is_active === false ? 'disabled' : 'active'} />}</td>}
                <td><div className="admin-row-actions">{selectedIds.length === 0 && <><button className="is-view" type="button" onClick={() => setSelectedRecord(record)}><AppIcon name="eye" />View</button>{!record.deleted_at && !config.moderation && !config.readOnly && <button className="is-edit" type="button" onClick={() => setEditor(record)}><AppIcon name="settings" />Edit</button>}{!record.deleted_at && !config.readOnly && !config.noDelete && <button className="is-danger" type="button" aria-label={`Move record #${record.id} to trash`} onClick={() => removeRecord(record)}><AppIcon name="trash" /></button>}{record.deleted_at && <button className="is-restore" type="button" onClick={() => restoreRecord(record)}><AppIcon name="history" />Restore</button>}</>}</div></td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {!loading && !records.length && <div className="admin-empty"><AppIcon name={config.icon} /><strong>No records found</strong><span>This database table does not have matching records yet.</span></div>}
      </section>

      {pagination && <AdminPagination currentPage={pagination.current_page} lastPage={pagination.last_page} onPageChange={(page) => { setSelectedIds([]); load(config.id, { search: appliedSearch, status: appliedFilter, trashed, page }) }} />}
      {selectedRecord && <ResourceDetailsDrawer config={config} record={selectedRecord} onClose={() => setSelectedRecord(null)} onEdit={() => { setEditor(selectedRecord); setSelectedRecord(null) }} onDelete={() => removeRecord(selectedRecord)} onRestore={() => restoreRecord(selectedRecord)} onModerate={(field, value) => updateModeration(selectedRecord, field, value)} />}
      {editor && <ResourceEditor config={config} record={editor} lookups={lookups} onClose={() => setEditor(null)} onSaved={async (savedRecord) => { setEditor(null); const [lookupPayload] = await Promise.all([getAdminResourceLookups(), load(config.id, { search: appliedSearch, status: appliedFilter, trashed }), groupKey === 'plants' ? refreshPlantSetup(savedRecord) : Promise.resolve()]); setLookups(lookupPayload.data ?? {}) }} />}
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
  const adminShellRef = useRef(null)
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
  const [unseenReportCount, setUnseenReportCount] = useState(0)
  const contentFiltersRef = useRef({})
  const userFiltersRef = useRef({})
  const usersPayloadRef = useRef(null)
  const usersRequestRef = useRef(null)
  const dashboardRequestRef = useRef(0)
  const trendSelectionRef = useRef(defaultTrendSelection())
  const refreshInFlightRef = useRef(false)
  const initialSectionRef = useRef(section)

  useAdminLanguage(language, adminShellRef)

  const sectionMeta = useMemo(() => ({
    dashboard: ['System overview', 'Monitor user activity and system health.'],
    contents: ['Content library', 'Manage articles, plant information, and bilingual public content.'],
    users: ['Users & access', 'Manage user status and administrator permissions.'],
    plants: ['Plants & growth data', 'Manage plant profiles, growth stages, plant knowledge, condition rules, and visual states.'],
    pests: ['Pests & occurrence rules', 'Maintain pest definitions and the environmental rules that trigger them.'],
    store: ['Items & shop', 'Manage usable items, effects, prices, stock, and availability.'],
    events: ['Events & situations', 'Configure natural indoor and outdoor events, warning time, effects, response actions, and recovery periods.'],
    modeRewards: ['Simulation mode rewards', 'Set the EXP and coin reward granted when each growing mode reaches maturity.'],
    progression: ['Quests & achievements', 'Configure player goals, rewards, and achievement milestones.'],
    models: ['3D model assets', 'Maintain reusable model files and structured asset metadata.'],
    community: ['Community moderation', 'Review posts and moderate comments across community and simulation sessions.'],
    simulations: ['Simulation records', 'Review simulation runs and harvested plant histories.'],
    activity: ['Administrator activity', 'Review an immutable audit trail of management actions.'],
    reports: [language === 'th' ? 'รายงานปัญหา' : 'Problem reports', language === 'th' ? 'ตรวจสอบหลักฐาน เปลี่ยนสถานะ และแจ้งความคืบหน้าแก่ผู้ใช้' : 'Review immutable evidence, update status, and publish progress to reporters.'],
  }[section].map((value) => adminText(language, value))), [language, section])
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
    if (nextSection === 'reports') { setError(''); setStatus('ready'); setRefreshState('connected'); setLastUpdatedAt(new Date()) }
    if (resourceGroups[nextSection]) { setError(''); setStatus('ready'); setRefreshState('connected'); setLastUpdatedAt(new Date()) }
  }, [loadContents, loadDashboard, loadUsers])

  const loadReportSummary = useCallback(async () => {
    try { const payload = await getAdminIssueReportSummary(); setUnseenReportCount(Number(payload.data?.unseen ?? 0)) } catch { /* Keep navigation usable if support summary is temporarily unavailable. */ }
  }, [])

  useEffect(() => {
    const initialTimer = window.setTimeout(loadReportSummary, 0)
    const timer = window.setInterval(() => { if (document.visibilityState !== 'hidden') loadReportSummary() }, 15000)
    return () => { window.clearTimeout(initialTimer); window.clearInterval(timer) }
  }, [loadReportSummary])

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
    document.documentElement.lang = normalized
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
    <main ref={adminShellRef} className={`admin-shell admin-theme--${preferences.theme} ${preferences.collapsed ? 'is-sidebar-collapsed' : ''} ${preferences.textSize === 'large' ? 'is-text-large' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-brand"><img src={plantGrowthLogo} alt="Plant Growth" /><span><strong>Plant Growth</strong><small>{adminText(language, 'ADMIN CONSOLE')}</small></span><button type="button" onClick={() => updatePreferences({ collapsed: !preferences.collapsed })} aria-label={adminText(language, preferences.collapsed ? 'Expand navigation' : 'Collapse navigation')} title={adminText(language, preferences.collapsed ? 'Expand navigation' : 'Collapse navigation')}><AppIcon name={preferences.collapsed ? 'panelOpen' : 'panelClose'} /></button></div>
        <nav aria-label={adminText(language, 'Admin navigation')}>
          {navigationGroups.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <small>{adminText(language, group.label)}</small>
              {group.items.filter((item) => !hiddenAdminNavigationItems.has(item.id)).map((item) => <button className={section === item.id ? 'is-active' : ''} type="button" key={item.id} title={preferences.collapsed ? adminText(language, item.label) : undefined} onClick={() => openSection(item.id)}><AppIcon name={item.icon} /><b>{adminText(language, item.label)}</b>{item.id === 'reports' && unseenReportCount > 0 ? <em className="admin-nav-badge">{unseenReportCount > 99 ? '99+' : unseenReportCount}</em> : <span />}</button>)}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar__account"><AdminAvatar user={user} /><span><strong>{user.username}</strong><small>{adminText(language, 'Administrator')}</small></span><button type="button" onClick={onLogout} aria-label={adminText(language, 'Log out')}><AppIcon name="logout" /></button></div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div><small>{adminText(language, 'ADMINISTRATION')} / {adminText(language, section.toUpperCase())}</small><h1>{sectionMeta[0]}</h1><p>{sectionMeta[1]}</p></div>
          <div className="admin-topbar__actions">
            <span className={`admin-system-status is-${refreshState}`}><AppIcon name="live" /><i />{adminText(language, refreshState === 'connecting' ? 'Connecting data' : refreshState === 'stale' ? 'Update delayed' : 'Live data')}<em>{adminText(language, lastUpdatedAt ? `Last updated ${lastUpdatedAt.toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Auto ${refreshIntervalSeconds}s` : `Auto refresh · ${refreshIntervalSeconds}s`)}</em></span>
            <div className="admin-language-switch" role="group" aria-label={adminText(language, 'Interface language')}><AppIcon name="translate" /><button className={language === 'en' ? 'is-active' : ''} type="button" onClick={() => changeLanguage('en')} aria-pressed={language === 'en'}>EN</button><button className={language === 'th' ? 'is-active' : ''} type="button" onClick={() => changeLanguage('th')} aria-pressed={language === 'th'}>ไทย</button></div>
            <button className="admin-text-size-button" type="button" onClick={() => updatePreferences({ textSize: preferences.textSize === 'large' ? 'default' : 'large' })} aria-label={adminText(language, preferences.textSize === 'large' ? 'Use standard text size' : 'Use large text size')} aria-pressed={preferences.textSize === 'large'} title={adminText(language, preferences.textSize === 'large' ? 'Standard text size' : 'Large text size')}>{preferences.textSize === 'large' ? 'A' : 'A+'}</button>
            <button type="button" onClick={() => updatePreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })} aria-label={adminText(language, preferences.theme === 'dark' ? 'Use light theme' : 'Use dark theme')} title={adminText(language, preferences.theme === 'dark' ? 'Use light theme' : 'Use dark theme')}><AppIcon name={preferences.theme === 'dark' ? 'lightMode' : 'darkMode'} /></button>
            <time>{formatDate(new Date())}</time>
          </div>
        </header>

        <div className="admin-content">
          {status === 'loading' && <div className="admin-loading">{section === 'dashboard' ? <AdminDashboardSkeleton /> : <AdminTableSkeleton />}</div>}
          {status === 'error' && <div className="admin-error"><AppIcon name="shield" /><h2>{adminText(language, 'Unable to load this section')}</h2><p>{adminText(language, error)}</p><button type="button" onClick={() => openSection(section)}>{adminText(language, 'Try again')}</button></div>}
          {status === 'ready' && section === 'dashboard' && <DashboardView data={dashboard} trendSelection={trendSelection} onChangeTrendSelection={changeTrendSelection} onOpenSection={openSection} theme={preferences.theme} language={language} />}
          {status === 'ready' && section === 'contents' && <ContentsView contents={contents} language={language} onRefresh={loadContents} />}
          {status === 'ready' && section === 'users' && <UsersView currentUser={user} usersPayload={users} onRefresh={loadUsers} />}
          {status === 'ready' && section === 'reports' && <IssueReportsAdminView language={language} onSeenChange={loadReportSummary} />}
          {status === 'ready' && resourceGroups[section] && <ResourceView key={section} groupKey={section} language={language} />}
        </div>
      </section>
    </main>
  )
}
