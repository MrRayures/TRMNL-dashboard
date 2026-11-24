import { defineConfig } from 'vite'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { Liquid } from 'liquidjs'
import { runTransform } from './scripts/run-transform.mjs'

// Local preview of the plugins in plugins/<name>/. It approximates what TRMNL
// renders; TRMNL itself stays the reference (see .claude/rules/preview.md).

const projectRoot = import.meta.dirname
const pluginsDir = resolve(projectRoot, 'plugins')
const previewDir = resolve(projectRoot, 'preview')

const VIEWS = ['full', 'half_horizontal', 'half_vertical', 'quadrant']
// Non-full views only exist inside a mashup. slots = number of views in it.
const MASHUPS = {
  half_horizontal: { mashup_class: 'mashup--1Tx1B', slots: 2 },
  half_vertical: { mashup_class: 'mashup--1Lx1R', slots: 2 },
  quadrant: { mashup_class: 'mashup--2x2', slots: 4 },
}
const BITS = { 1: 'screen--1bit', 2: 'screen--2bit', 4: 'screen--4bit' }
// TRMNL X (model "v2"): 1040x780 CSS px, scaled 1.8x to the 1872x1404 panel.
const DEVICE = 'screen--v2 screen--lg screen--density-2x'

const read = (file) => readFileSync(file, 'utf8')
const readJson = (file) => JSON.parse(read(file))

// TRMNL renders with Ruby (Shopify) Liquid: only nil and false are falsy, so
// jsTruthy stays off. Unknown filters throw instead of passing silently.
const LIQUID_OPTIONS = { cache: false, jsTruthy: false, strictFilters: true }
const pageEngine = new Liquid(LIQUID_OPTIONS)

/**
 * TRMNL's {% template name %}…{% endtemplate %} tag (shared markup) defines a
 * partial that {% render "name" %} uses. liquidjs has no such tag, so the
 * blocks are lifted out of the source and served to {% render %} from memory.
 */
function pluginEngine(source) {
  const templates = {}
  const rest = source.replace(
    /\{%-?\s*template\s+([\w/]+)\s*-?%\}([\s\S]*?)\{%-?\s*endtemplate\s*-?%\}/g,
    (_, name, body) => {
      templates[name] = body
      return ''
    },
  )
  const engine = new Liquid({
    ...LIQUID_OPTIONS,
    root: ['/'],
    extname: '',
    relativeReference: false,
    fs: {
      existsSync: (f) => f in templates,
      exists: async (f) => f in templates,
      readFileSync: (f) => templates[f],
      readFile: async (f) => templates[f],
      resolve: (_root, file) => file,
      contains: () => true,
      dirname: () => '/',
      sep: '/',
    },
  })
  return { engine, source: rest }
}

/** Reads the few top-level keys the preview needs from src/settings.yml. */
function readSettings(dir) {
  const file = join(dir, 'src', 'settings.yml')
  const text = existsSync(file) ? read(file) : ''
  const get = (key) => text.match(new RegExp(`^${key}:\\s*['"]?([^'"\\n]*)['"]?\\s*$`, 'm'))?.[1].trim()
  // custom_fields: `- keyname: x` blocks; keep each field's `default` value.
  const fields = {}
  for (const block of text.split(/^\s*- keyname:/m).slice(1)) {
    const keyname = block.match(/^\s*(\w+)/)?.[1]
    const value = block.match(/^\s*default:\s*['"]?([^'"\n]*)['"]?\s*$/m)?.[1].trim()
    if (keyname) fields[keyname] = value ?? null
  }
  return { name: get('name') || 'Plugin', framework: get('framework_version') || 'latest', fields }
}

function listPlugins() {
  if (!existsSync(pluginsDir)) return []
  return readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map(({ name }) => {
      const dir = join(pluginsDir, name)
      const src = existsSync(join(dir, 'src')) ? readdirSync(join(dir, 'src')) : []
      const fixtures = existsSync(join(dir, 'fixtures'))
        ? readdirSync(join(dir, 'fixtures')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
        : []
      fixtures.sort((a, b) => (a === 'default' ? -1 : b === 'default' ? 1 : a.localeCompare(b)))
      const { name: title, framework } = readSettings(dir)
      return {
        name,
        title,
        framework,
        views: VIEWS.filter((v) => src.includes(`${v}.liquid`)),
        fixtures,
      }
    })
}

/**
 * The merge variables for a fixture. Without src/transform.js the fixture *is*
 * the payload. With one, the fixture is a scenario { now, input, settings? }:
 * `input` is what polling returns (inline, or a path under fixtures/: JSON
 * parsed, other files as text), run
 * through the transform at time `now` (overridable with ?now=); `settings`
 * sets custom field values for the scenario.
 */
function loadVariables(dir, fixtureFile, query) {
  const fixture = readJson(fixtureFile)
  const transformFile = join(dir, 'src', 'transform.js')
  if (!existsSync(transformFile)) return { variables: fixture, fieldValues: {} }

  // A one-line string is a path: .json files are parsed, anything else (.ics,
  // .xml…) is passed as text. A multi-line string is inline text input.
  const isPath = typeof fixture.input === 'string' && !fixture.input.includes('\n')
  const inputFile = isPath ? join(dir, 'fixtures', fixture.input) : null
  const input = inputFile ? (inputFile.endsWith('.json') ? readJson(inputFile) : read(inputFile)) : fixture.input
  const now = query.get('now') || fixture.now || new Date()
  return { variables: runTransform(read(transformFile), input, now), fieldValues: fixture.settings || {} }
}

/**
 * Renders plugins/<plugin>/src/<view>.liquid the way TRMNL does: shared.liquid
 * prepended, merge variables top-level, platform globals under `trmnl`. The
 * result is wrapped in the .screen/.view shell TRMNL supplies.
 */
async function renderPlugin(plugin, view, query) {
  const dir = join(pluginsDir, plugin)
  const viewFile = join(dir, 'src', `${view}.liquid`)
  if (!VIEWS.includes(view) || !existsSync(viewFile)) return null

  const fixtureName = query.get('fixture') || 'default'
  const fixtureFile = join(dir, 'fixtures', `${fixtureName}.json`)
  if (!existsSync(fixtureFile)) throw new Error(`Fixture not found: ${fixtureFile}`)
  const { variables, fieldValues } = loadVariables(dir, fixtureFile, query)

  // Custom field values: settings.yml defaults, then the fixture's `settings`
  // (transform scenarios only), then ?<keyname>= in the URL.
  const settings = readSettings(dir)
  const trmnl = readJson(join(previewDir, 'trmnl.json'))
  trmnl.plugin_settings.instance_name = settings.name
  const values = { ...settings.fields, ...fieldValues }
  for (const key of Object.keys(settings.fields)) if (query.has(key)) values[key] = query.get(key)
  trmnl.plugin_settings.custom_fields_values = values

  const sharedFile = join(dir, 'src', 'shared.liquid')
  const shared = existsSync(sharedFile) ? read(sharedFile) + '\n' : ''
  const { engine, source } = pluginEngine(shared + read(viewFile))
  const markup = await engine.parseAndRender(source, { ...variables, trmnl })

  return pageEngine.parseAndRender(read(join(previewDir, 'shell.liquid')), {
    plugin,
    view,
    markup,
    framework: settings.framework,
    device_class: `${DEVICE} ${BITS[query.get('bits') ?? '4'] ?? BITS[4]}`,
    ...MASHUPS[view],
  })
}

function trmnlPreview() {
  return {
    name: 'trmnl-preview',
    configureServer(server) {
      // Plugin files are not in Vite's module graph: reload explicitly.
      server.watcher.add([pluginsDir, previewDir])
      server.watcher.on('change', (file) => {
        if (/\.(liquid|json|ya?ml)$/.test(file) || file.endsWith('transform.js')) {
          server.ws.send({ type: 'full-reload' })
        }
      })

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        const parts = url.pathname.split('/').filter(Boolean)
        try {
          let html = null
          if (parts.length === 0) {
            html = await pageEngine.parseAndRender(read(join(previewDir, 'index.liquid')), {
              plugins: listPlugins(),
            })
          } else if (parts.length === 2 && existsSync(join(pluginsDir, parts[0]))) {
            html = await renderPlugin(parts[0], parts[1], url.searchParams)
          }
          if (html === null) return next()
          html = await server.transformIndexHtml(req.url, html)
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(String(err.stack ?? err))
        }
      })
    },
  }
}

export default defineConfig({
  root: previewDir,
  publicDir: false,
  plugins: [trmnlPreview()],
  server: {
    port: 5173,
    open: true,
    // The framework CSS loads its fonts from the absolute path /fonts/*.
    proxy: { '/fonts': { target: 'https://trmnl.com', changeOrigin: true } },
  },
})
