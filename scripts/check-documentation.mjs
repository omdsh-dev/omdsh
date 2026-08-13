import { access, readFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createI18n, formatLocaleError } from './lib/i18n.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bilingualPairs = [
  ['README.md', 'README.zh-CN.md'],
  ['SECURITY.md', 'SECURITY.zh-CN.md'],
  ['CONTRIBUTING.md', 'CONTRIBUTING.zh-CN.md'],
  ['CODE_OF_CONDUCT.md', 'CODE_OF_CONDUCT.zh-CN.md'],
  ['CHANGELOG.md', 'CHANGELOG.zh-CN.md'],
  ['distributions/README.md', 'distributions/README.zh-CN.md'],
  ['policy/README.md', 'policy/README.zh-CN.md'],
  ['docs/public-source-policy.md', 'docs/public-source-policy.zh-CN.md'],
  ['docs/i18n.md', 'docs/zh-CN/i18n.md'],
]

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function localLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1].trim())
    .filter((target) =>
      target &&
      !target.startsWith('#') &&
      !/^[a-z][a-z0-9+.-]*:/i.test(target))
    .map((target) => decodeURIComponent(target.split('#', 1)[0]))
}

async function check(t) {
  const failures = []
  const files = new Set(bilingualPairs.flat())

  for (const [english, chinese] of bilingualPairs) {
    const englishPath = resolve(repositoryRoot, english)
    const chinesePath = resolve(repositoryRoot, chinese)
    if (!await exists(englishPath)) {
      failures.push(t('docs.errors.missing', { path: english }))
    }
    if (!await exists(chinesePath)) {
      failures.push(t('docs.errors.missing', { path: chinese }))
    }
    if (await exists(englishPath) && await exists(chinesePath)) {
      const englishLinks = localLinks(await readFile(englishPath, 'utf8'))
        .map((target) => resolve(dirname(englishPath), target))
      const chineseLinks = localLinks(await readFile(chinesePath, 'utf8'))
        .map((target) => resolve(dirname(chinesePath), target))
      if (!englishLinks.includes(chinesePath) || !chineseLinks.includes(englishPath)) {
        failures.push(t('docs.errors.pairLink', { english, chinese }))
      }
    }
  }

  for (const relativePath of files) {
    const path = resolve(repositoryRoot, relativePath)
    if (!await exists(path)) continue
    const markdown = await readFile(path, 'utf8')
    for (const target of localLinks(markdown)) {
      const resolved = resolve(dirname(path), target)
      if (!resolved.startsWith(`${repositoryRoot}${sep}`) || !await exists(resolved)) {
        failures.push(t('docs.errors.link', {
          path: relativePath,
          target,
        }))
      }
    }
  }

  if (failures.length > 0) {
    console.error([...new Set(failures)].join('\n'))
    return 1
  }
  console.log(t('docs.success', { count: bilingualPairs.length }))
  return 0
}

const i18n = await createI18n({ args: process.argv.slice(2), env: process.env })
const localeError = formatLocaleError(i18n)
if (localeError) {
  console.error(localeError)
  process.exitCode = 2
} else {
  try {
    process.exitCode = await check(i18n.t)
  } catch {
    console.error(i18n.t('cli.errors.unexpected'))
    process.exitCode = 1
  }
}
