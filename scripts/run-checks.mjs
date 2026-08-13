import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createI18n, formatLocaleError } from './lib/i18n.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [mode, ...args] = process.argv.slice(2)
const i18n = await createI18n({ args, env: process.env })
const localeError = formatLocaleError(i18n)

if (localeError) {
  console.error(localeError)
  process.exit(2)
}

const localeArgs = ['--locale', i18n.locale]
const node = process.execPath
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const publicChecks = [
  [node, ['scripts/check-public-boundary.mjs', ...localeArgs]],
  [node, ['scripts/check-documentation.mjs', ...localeArgs]],
  [node, ['scripts/validate-distributions.mjs', ...localeArgs]],
  [npm, ['test']],
]
const checksByMode = {
  public: publicChecks,
  visibility: [
    ...publicChecks,
    [node, ['scripts/check-release-readiness.mjs', ...localeArgs]],
  ],
  release: [
    ...publicChecks,
    [node, ['scripts/check-release-readiness.mjs', ...localeArgs]],
    [node, [
      'scripts/validate-distributions.mjs',
      '--require-manifest',
      '--verify-evidence',
      ...localeArgs,
    ]],
  ],
}

const checks = checksByMode[mode]
if (!checks) {
  console.error(i18n.t('checks.mode.invalid', { mode: mode ?? '' }))
  process.exit(2)
}

for (const [command, commandArgs] of checks) {
  const result = spawnSync(command, commandArgs, {
    cwd: repositoryRoot,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.error) {
    console.error(i18n.t('cli.errors.unexpected'))
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}
