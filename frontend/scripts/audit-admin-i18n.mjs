import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import { adminText } from '../src/admin/adminI18n.js'

const traverse = traverseModule.default
const sourceFiles = [
  'src/admin/AdminPage.jsx',
  'src/admin/ContentRichEditor.jsx',
  'src/admin/ImageUploadField.jsx',
  'src/admin/IssueReportsAdminView.jsx',
  'src/admin/ModelBundleField.jsx',
]
const translatedAttributes = new Set(['aria-label', 'placeholder', 'title'])
const translatedProperties = new Set([
  'label', 'createLabel', 'detail', 'description', 'filterLabel', 'badge',
  'title', 'text', 'helper', 'heading', 'summary', 'emptyLabel',
])
const technicalLabels = new Set(['A+', 'CKEditor 5 ·', 'EN', 'FAO, NASA, University…', 'HTML', 'Plant Growth', 'URL'])
const missing = new Map()
const orphanThai = new Map()

function normalize(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function looksUserFacing(value) {
  return value.length > 1
    && /[A-Za-z]/.test(value)
    && !/[\u0E00-\u0E7F]/.test(value)
    && !technicalLabels.has(value)
    && !/^https?:\/\//i.test(value)
    && !/^[a-z0-9_.:/-]+$/.test(value)
    && !/^#[0-9a-f]{3,8}$/i.test(value)
}

function isExplicitBilingual(pathRef) {
  if (pathRef.findParent((parent) => parent.isCallExpression() && parent.node.callee?.type === 'Identifier' && ['ui', 'copy'].includes(parent.node.callee.name))) {
    return true
  }
  return Boolean(pathRef.findParent((parent) => {
    if (!parent.isConditionalExpression() && !parent.isLogicalExpression()) return false
    const test = parent.isConditionalExpression() ? parent.node.test : parent.node.left
    const queue = [test]
    while (queue.length) {
      const node = queue.pop()
      if (!node || typeof node !== 'object') continue
      if (node.type === 'Identifier' && ['language', 'interfaceLanguage', 'isThai', 'documentElement'].includes(node.name)) return true
      for (const [key, value] of Object.entries(node)) {
        if (['loc', 'start', 'end', 'extra'].includes(key)) continue
        if (Array.isArray(value)) queue.push(...value)
        else if (value && typeof value === 'object') queue.push(value)
      }
    }
    return false
  }))
}

function remember(file, value, line) {
  const source = normalize(value)
  if (!looksUserFacing(source) || adminText('th', source) !== source) return
  const key = `${source}\u0000${file}`
  const existing = missing.get(key) ?? { file, lines: [], source }
  if (line && !existing.lines.includes(line)) existing.lines.push(line)
  missing.set(key, existing)
}

function rememberOrphanThai(file, value, line) {
  const source = normalize(value)
  if (!/[\u0E00-\u0E7F]/.test(source) || source === 'ไทย') return
  const key = `${source}\u0000${file}`
  const existing = orphanThai.get(key) ?? { file, lines: [], source }
  if (line && !existing.lines.includes(line)) existing.lines.push(line)
  orphanThai.set(key, existing)
}

for (const file of sourceFiles) {
  const absolutePath = path.resolve(process.cwd(), file)
  const code = fs.readFileSync(absolutePath, 'utf8')
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] })

  traverse(ast, {
    JSXText(pathRef) {
      remember(file, pathRef.node.value, pathRef.node.loc?.start.line)
      rememberOrphanThai(file, pathRef.node.value, pathRef.node.loc?.start.line)
    },
    JSXAttribute(pathRef) {
      const name = pathRef.node.name?.name
      const value = pathRef.node.value
      if (!translatedAttributes.has(name) || value?.type !== 'StringLiteral') return
      remember(file, value.value, value.loc?.start.line)
    },
    ObjectProperty(pathRef) {
      const key = pathRef.node.key?.name ?? pathRef.node.key?.value
      const value = pathRef.node.value
      if (!translatedProperties.has(key) || value?.type !== 'StringLiteral') return
      remember(file, value.value, value.loc?.start.line)
    },
    StringLiteral(pathRef) {
      if (!pathRef.findParent((parent) => parent.isJSXExpressionContainer())) return
      const attribute = pathRef.findParent((parent) => parent.isJSXAttribute())
      if (attribute && !translatedAttributes.has(attribute.node.name?.name)) return
      if (isExplicitBilingual(pathRef)) return
      remember(file, pathRef.node.value, pathRef.node.loc?.start.line)
      rememberOrphanThai(file, pathRef.node.value, pathRef.node.loc?.start.line)
    },
  })
}

const rows = [...missing.values()].sort((a, b) => a.file.localeCompare(b.file) || a.source.localeCompare(b.source))
const thaiRows = [...orphanThai.values()].sort((a, b) => a.file.localeCompare(b.file) || a.source.localeCompare(b.source))
if (rows.length === 0 && thaiRows.length === 0) {
  console.log('Admin i18n audit passed: no untranslated static interface strings found.')
  process.exit(0)
}

for (const row of rows) {
  console.log(`${row.file}:${row.lines.join(',')}  ${row.source}`)
}
for (const row of thaiRows) {
  console.log(`${row.file}:${row.lines.join(',')}  [Thai outside a language branch] ${row.source}`)
}
console.error(`Admin i18n audit failed: ${rows.length} untranslated English strings and ${thaiRows.length} unguarded Thai strings.`)
process.exit(1)
