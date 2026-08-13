import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  createI18n,
  escapeTerminalText,
  matchLocale,
  parseLocaleArgument,
  resolveLocale,
} from '../scripts/lib/i18n.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const en = JSON.parse(await readFile(new URL('../locales/en.json', import.meta.url)))
const zh = JSON.parse(await readFile(new URL('../locales/zh-CN.json', import.meta.url)))
const forbiddenControls = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/u

function placeholders(message) {
  return [...message.matchAll(/\{([A-Za-z0-9_.-]+)\}/g)]
    .map((match) => match[1])
    .sort()
}

function run(script, args = [], env = {}) {
  return spawnSync(process.execPath, [resolve(repositoryRoot, script), ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      LC_ALL: 'C',
      LANG: 'C',
      ...env,
    },
  })
}

test('shipped catalogs have identical keys, placeholders, and non-empty values', () => {
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
  for (const key of Object.keys(en)) {
    assert.equal(typeof en[key], 'string')
    assert.equal(typeof zh[key], 'string')
    assert.notEqual(en[key].trim(), '')
    assert.notEqual(zh[key].trim(), '')
    assert.doesNotMatch(en[key], forbiddenControls, key)
    assert.doesNotMatch(zh[key], forbiddenControls, key)
    assert.deepEqual(placeholders(zh[key]), placeholders(en[key]), key)
  }
})

test('locale matching distinguishes Simplified and Traditional Chinese', () => {
  for (const locale of ['zh-CN', 'zh_CN.UTF-8', 'zh-Hans', 'zh-SG']) {
    assert.equal(matchLocale(locale), 'zh-CN', locale)
  }
  for (const locale of ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant']) {
    assert.equal(matchLocale(locale), undefined, locale)
  }
  assert.equal(matchLocale('en_US.UTF-8'), 'en')
  assert.equal(matchLocale('C'), undefined)
  assert.equal(matchLocale('POSIX'), undefined)
})

test('locale selection follows explicit, LC_ALL, LC_MESSAGES, LANG, English', () => {
  assert.equal(resolveLocale({
    args: ['--locale', 'en'],
    env: { LC_ALL: 'zh_CN.UTF-8' },
  }).locale, 'en')
  assert.equal(resolveLocale({
    env: { LC_ALL: 'zh_CN', LC_MESSAGES: 'en_US', LANG: 'en_US' },
  }).locale, 'zh-CN')
  assert.equal(resolveLocale({
    env: { LC_MESSAGES: 'zh_CN', LANG: 'en_US' },
  }).locale, 'zh-CN')
  assert.equal(resolveLocale({ env: { LANG: 'zh_CN' } }).locale, 'zh-CN')
  assert.equal(resolveLocale({ env: { LANG: 'fr_FR' } }).locale, 'en')
})

test('explicit locale parsing rejects missing, duplicate, and unsupported values', () => {
  assert.equal(parseLocaleArgument(['--locale']).errorCode, 'cli.locale.missing')
  assert.equal(
    parseLocaleArgument(['--locale=en', '--locale', 'zh-CN']).errorCode,
    'cli.locale.duplicate',
  )
  assert.equal(
    resolveLocale({ args: ['--locale', 'fr'] }).errorCode,
    'cli.locale.unsupported',
  )
})

test('interpolation escapes terminal controls and never evaluates values', async () => {
  const i18n = await createI18n({ args: ['--locale', 'en'], env: {} })
  const unsafe = 'one\ntwo\r\u001b[31m${process.exit(9)}'
  const output = i18n.t('validation.errors.semantic', {
    path: unsafe,
    message: '{still-data}',
  })
  assert.equal(output.includes('\n'), false)
  assert.equal(output.includes('\r'), false)
  assert.equal(output.includes('\u001b'), false)
  assert.match(output, /one\\ntwo\\r\\x1b/)
  assert.match(output, /\$\{process\.exit\(9\)\}/)
  assert.equal(escapeTerminalText('\u0000'), '\\x00')
  assert.equal(escapeTerminalText('\u202e'), '\\u202e')
  assert.throws(() => i18n.t('missing.message.key'), /Missing source message/)
})

test('validation and readiness commands produce Simplified Chinese output', () => {
  const validation = run('scripts/validate-distributions.mjs', ['--locale', 'zh-CN'])
  assert.equal(validation.status, 0, validation.stderr)
  assert.match(validation.stdout, /已校验 0 个生产定义/)

  const readiness = run('scripts/check-release-readiness.mjs', ['--locale=zh-CN'])
  assert.equal(readiness.status, 0, readiness.stderr)
  assert.match(readiness.stdout, /仓库公开就绪检查已通过/)
})

test('unsupported locale exits with usage error and orchestrator keeps locale', () => {
  const unsupported = run('scripts/check-public-boundary.mjs', ['--locale', 'fr'])
  assert.equal(unsupported.status, 2)
  assert.match(unsupported.stderr, /Unsupported locale/)

  const orchestrator = run('scripts/run-checks.mjs', ['unknown', '--locale', 'zh-CN'])
  assert.equal(orchestrator.status, 2)
  assert.match(orchestrator.stderr, /未知检查模式/)
})
