// Runs a plugin's src/transform.js the way TRMNL's default runtime does: plain
// JS in an isolated context, `transform(input)` (or a `result` variable), 1 s
// timeout, output serialised to JSON. `now` freezes Date for the run.
import vm from 'node:vm'

export function runTransform(code, input, now = new Date()) {
  const fixed = new Date(now).getTime()
  if (Number.isNaN(fixed)) throw new Error(`Invalid "now": ${now}`)

  class FrozenDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [fixed]))
    }
    static now() {
      return fixed
    }
  }

  const context = vm.createContext({ input: JSON.parse(JSON.stringify(input)), Date: FrozenDate })
  const output = vm.runInContext(
    `${code}\n;typeof transform === 'function' ? transform(input) : typeof result !== 'undefined' ? result : input`,
    context,
    { timeout: 1000, filename: 'transform.js' },
  )
  return JSON.parse(JSON.stringify(output))
}
