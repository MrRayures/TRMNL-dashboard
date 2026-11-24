// Copies a plugin file to the clipboard, ready to paste into trmnl.com.
//
//   npm run copy -- <plugin> <part>
//   parts: full, shared, half_horizontal, half_vertical, quadrant (markup),
//          serverless (src/transform.js), fields (Form Fields YAML from
//          src/settings.yml)
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const [plugin, part] = process.argv.slice(2)
const src = resolve(import.meta.dirname, '..', 'plugins', plugin || '', 'src')

function parts() {
  if (!existsSync(src)) return []
  return readdirSync(src).map((f) =>
    f === 'transform.js' ? 'serverless' : f === 'settings.yml' ? 'fields' : f.replace('.liquid', ''),
  )
}

function content() {
  if (part === 'fields') {
    const yml = readFileSync(join(src, 'settings.yml'), 'utf8')
    const block = yml.split(/^custom_fields:\s*\n/m)[1]
    // The block runs until the next top-level key (a line not starting with
    // a space or a "-" list item).
    return block ? block.split(/^[^\s-]/m)[0].replace(/\s+$/, '') + '\n' : null
  }
  const file = join(src, part === 'serverless' ? 'transform.js' : `${part}.liquid`)
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

const text = plugin && part ? content() : null
if (!text) {
  console.error(`Usage: npm run copy -- <plugin> <part>\nParts: ${parts().join(', ') || '(unknown plugin)'}`)
  process.exit(1)
}

const tmp = join(tmpdir(), 'trmnl-copy.txt')
writeFileSync(tmp, text)
if (process.platform === 'win32') {
  // Through PowerShell so accents survive (clip.exe mangles UTF-8).
  execFileSync('powershell', ['-NoProfile', '-Command', `Get-Content -Raw -Encoding UTF8 -LiteralPath '${tmp}' | Set-Clipboard`])
} else if (process.platform === 'darwin') {
  execFileSync('sh', ['-c', `pbcopy < "${tmp}"`])
} else {
  execFileSync('sh', ['-c', `xclip -selection clipboard < "${tmp}"`])
}
console.log(`Copied ${plugin} ${part}: paste it on trmnl.com.`)
