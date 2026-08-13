import { lstat, readdir, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createI18n, formatLocaleError } from './lib/i18n.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ignoredRootDirectories = new Set(['.git', 'coverage', 'node_modules'])
const textExtensions = new Set([
  '.gitignore',
  '.json',
  '.md',
  '.mjs',
  '.npmrc',
  '.txt',
  '.yml',
  '.yaml',
])

export const forbiddenPatterns = [
  { key: 'boundary.findings.privateKey', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    key: 'boundary.findings.githubToken',
    pattern: new RegExp(`g${'h[pousr]'}_[A-Za-z0-9_]{20,}`),
  },
  {
    key: 'boundary.findings.githubFineGrainedToken',
    pattern: new RegExp(`${'github' + '_pat'}_[A-Za-z0-9_]{20,}`),
  },
  {
    key: 'boundary.findings.npmToken',
    pattern: new RegExp(`\\b${'npm' + '_'}[A-Za-z0-9]{20,}\\b`),
  },
  {
    key: 'boundary.findings.npmAuthToken',
    pattern: new RegExp(
      `(?:${'_auth' + 'Token'}|${'_au' + 'th'}|${'_pass' + 'word'}|` +
      `${'npm' + 'AuthToken'}|${'npm' + 'AuthIdent'}|${'NPM' + '_TOKEN'}|` +
      `${'NODE' + '_AUTH_TOKEN'}|${'YARN' + '_NPM_AUTH_TOKEN'})["']?\\s*[:=]\\s*` +
      `(?!["']?\\$\\{[A-Z_][A-Z0-9_]*\\}["']?\\s*(?:$|[#;]))["']?[^\\s#;"']{4,}`,
      'im',
    ),
  },
  { key: 'boundary.findings.awsAccessKey', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { key: 'boundary.findings.slackToken', pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  {
    key: 'boundary.findings.credentialAssignment',
    pattern: new RegExp(
      `(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)["']?\\s*[:=]\\s*` +
      `(?!["']?\\$\\{[A-Z_][A-Z0-9_]*\\}["']?\\s*(?:$|[#;]))["']?[^\\s#;"']{8,}`,
      'im',
    ),
  },
  {
    key: 'boundary.findings.emailAddress',
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  },
  { key: 'boundary.findings.absoluteMacPath', pattern: /\/Users\/[A-Za-z0-9._-]+\// },
  { key: 'boundary.findings.absoluteLinuxPath', pattern: /\/home\/[A-Za-z0-9._-]+\// },
  { key: 'boundary.findings.absoluteWindowsPath', pattern: /[A-Za-z]:\\Users\\[^\\]+\\/ },
  {
    key: 'boundary.findings.loopbackHost',
    pattern: new RegExp(`\\b(?:${'local' + 'host'}|${'127' + '\\.0\\.0\\.1'})\\b`, 'i'),
  },
  {
    key: 'boundary.findings.privateNetwork',
    pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/,
  },
  { key: 'boundary.findings.localDomain', pattern: new RegExp(`${'\\.lo' + 'cal'}\\b`, 'i') },
  { key: 'boundary.findings.fileUrl', pattern: new RegExp(`${'fi' + 'le'}://`, 'i') },
  { key: 'boundary.findings.sshUrl', pattern: new RegExp(`${'ss' + 'h'}://`, 'i') },
  { key: 'boundary.findings.gitSshAddress', pattern: new RegExp(`${'gi' + 't'}@[^\\s:]+:`, 'i') },
  {
    key: 'boundary.findings.malformedWebUrl',
    pattern: new RegExp(
      `(?:${'https?' + ':'}(?:(?:/{0,1})|(?:\\\\{1,2}))(?=[A-Za-z0-9])|(?:^|[\\s(])${'//' + '[A-Za-z0-9]'})`,
      'im',
    ),
  },
  {
    key: 'boundary.findings.unicodeControl',
    pattern: new RegExp(
      `[${'\\u061c'}${'\\u200b-\\u200f'}${'\\u202a-\\u202e'}${'\\u2060-\\u2069'}${'\\ufeff'}]`,
      'u',
    ),
  },
  {
    key: 'boundary.findings.binaryControl',
    pattern: /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/,
  },
]

const allowedUrlHosts = new Set([
  'example.invalid',
  'github.com',
  'json-schema.org',
  'opencollective.com',
  'registry.npmjs.org',
])

async function collectFiles(directory, t) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      directory === repositoryRoot &&
      entry.isDirectory() &&
      ignoredRootDirectories.has(entry.name)
    ) continue
    const path = resolve(directory, entry.name)
    const stats = await lstat(path)
    if (stats.isSymbolicLink()) {
      throw new Error(t('boundary.errors.symlink', {
        path: relative(repositoryRoot, path),
      }))
    }
    if (stats.isDirectory()) files.push(...(await collectFiles(path, t)))
    if (stats.isFile()) files.push(path)
  }
  return files
}

async function assertIgnoredFilesAreUntracked(t) {
  try {
    await lstat(resolve(repositoryRoot, '.git'))
  } catch {
    return
  }

  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(t('boundary.errors.gitIndex'))
  }

  const tracked = result.stdout.split('\0').filter(Boolean)
  const ignoredTracked = tracked.filter((path) => {
    const [root] = path.split('/')
    return ignoredRootDirectories.has(root)
  })
  if (ignoredTracked.length > 0) {
    throw new Error(t('boundary.errors.ignoredTracked', {
      paths: ignoredTracked.join(', '),
    }))
  }
}

async function scan(t) {
  const failures = []
  await assertIgnoredFilesAreUntracked(t)
  const files = await collectFiles(repositoryRoot, t)

  for (const path of files) {
    const relativePath = relative(repositoryRoot, path)
    const extension = extname(relativePath) ||
      (relativePath.startsWith('.') ? relativePath : '')
    if (!textExtensions.has(extension)) {
      failures.push(t('boundary.errors.fileType', { path: relativePath }))
      continue
    }

    const stats = await lstat(path)
    if (stats.size > 512 * 1024) {
      failures.push(t('boundary.errors.fileSize', { path: relativePath }))
    }

    let content
    try {
      const bytes = await readFile(path)
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      failures.push(t('boundary.errors.invalidUtf8', { path: relativePath }))
      continue
    }
    const searchable = `${relativePath}\n${content}`

    for (const key of findForbiddenPatternKeys(searchable)) {
      failures.push(t('boundary.errors.contains', {
        path: relativePath,
        finding: t(key),
      }))
    }

    for (const match of content.matchAll(/https?:\/\/[^\s<>()"'`]+/gi)) {
      let url
      try {
        url = new URL(match[0])
      } catch {
        failures.push(t('boundary.errors.invalidUrl', {
          path: relativePath,
          url: match[0],
        }))
        continue
      }
      if (url.username || url.password) {
        failures.push(t('boundary.errors.urlCredentials', { path: relativePath }))
      }
      for (const key of url.searchParams.keys()) {
        if (/(?:token|key|secret|password|auth)/i.test(key)) {
          failures.push(t('boundary.errors.urlCredentials', { path: relativePath }))
        }
      }
      if (!allowedUrlHosts.has(url.hostname)) {
        failures.push(t('boundary.errors.urlHost', {
          path: relativePath,
          host: url.hostname,
        }))
      }
    }
  }

  if (failures.length > 0) {
    console.error([...new Set(failures)].join('\n'))
    return 1
  }
  console.log(t('boundary.success', { count: files.length }))
  return 0
}

export function findForbiddenPatternKeys(value) {
  return forbiddenPatterns
    .filter(({ pattern }) => pattern.test(value))
    .map(({ key }) => key)
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const i18n = await createI18n({ args, env })
  const localeError = formatLocaleError(i18n)
  if (localeError) {
    console.error(localeError)
    return 2
  }

  try {
    return await scan(i18n.t)
  } catch (error) {
    console.error(error instanceof Error ? error.message : i18n.t('cli.errors.unexpected'))
    return 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main()
}
