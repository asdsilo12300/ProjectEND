import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

const write = process.argv.includes('--fix')
const colors = process.argv.includes('--colors')
const root = path.resolve('src')
const findings = []
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) { walk(file); continue }
    if (!/\.(css|jsx)$/.test(file)) continue
    const source = fs.readFileSync(file, 'utf8')
    let result = source
    let count = 0
    const size = (value) => value.replace(/(\d*\.?\d+)(px|rem)\b/g, (match, number, unit) => {
      const px = Number(number) * (unit === 'rem' ? 16 : 1)
      if (px <= 0 || px >= 14) return match
      count++
      return '0.875rem'
    })
    if (file.endsWith('.css')) {
      const ast = postcss.parse(source)
      if (colors) ast.walkDecls('color', (decl) => {
        const selectors = decl.parent.selectors ?? []
        if (!selectors.length || !selectors.every((selector) => /theme-light|theme--light|data-theme=['"]light/.test(selector))) return
        const hex = /^#([\da-f]{6})$/i.exec(decl.value)
        if (!hex) return
        const channels = hex[1].match(/../g).map((channel) => parseInt(channel, 16))
        const high = Math.max(...channels)
        const low = Math.min(...channels)
        // Neutral/grey text on the light surfaces; preserve white text and semantic colors.
        if (high > 0 && high < 210 && (high - low) / high < 0.4) {
          decl.value = '#000'
          count++
        }
      })
      ast.walkDecls('font-size', (decl) => {
        // Icon glyph sizing and deliberately hidden text are not body typography.
        if (/\bsvg\b|::before|::after|sr-only/.test(decl.parent.selector ?? '')) return
        decl.value = size(decl.value)
      })
      result = ast.toString()
    } else {
      result = result.replace(/text-\[(\d*\.?\d+)(px|rem)\]/g, (match, number, unit) => {
        const px = Number(number) * (unit === 'rem' ? 16 : 1)
        if (px <= 0 || px >= 14) return match
        count++
        return 'text-sm'
      }).replace(/(fontSize:\s*['"])(\d*\.?\d+)(px|rem)(['"])/g, (match, before, number, unit, after) => `${before}${size(number + unit)}${after}`)
        .replace(/fontSize="(\d+)"/g, (match, number) => {
          if (Number(number) >= 14 || Number(number) === 0) return match
          count++
          return 'fontSize="14"'
        })
    }
    if (count) findings.push({ file: path.relative(root, file), declarations: count })
    if (write && result !== source) fs.writeFileSync(file, result)
  }
}
walk(root)
console.log(JSON.stringify({ mode: write ? 'fixed' : 'audit', findings }, null, 2))
