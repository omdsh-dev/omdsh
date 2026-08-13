import { readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createValidator,
  formatValidationErrors,
  validateSemantics,
} from './lib/distribution.mjs'
import { createI18n, formatLocaleError } from './lib/i18n.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

class ExpectedValidationError extends Error {}

async function readJson(path, t, displayPath) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    throw new ExpectedValidationError(
      t('validation.errors.invalidJson', { path: displayPath }),
    )
  }
}

function expectedError(message) {
  throw new ExpectedValidationError(message)
}

export function parsePublicComponents(entries, schema, t) {
  if (!Array.isArray(entries)) {
    expectedError(t('validation.errors.publicPolicyArray'))
  }

  const versionPattern = new RegExp(schema.$defs.version.pattern)
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      expectedError(t('validation.errors.publicPolicyFields'))
    }
    const keys = Object.keys(entry).sort()
    if (JSON.stringify(keys) !== JSON.stringify([
      'evidence',
      'id',
      'integrity',
      'package',
      'version',
    ])) {
      expectedError(t('validation.errors.publicPolicyFields'))
    }
    if (typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9._/-]*$/.test(entry.id)) {
      expectedError(t('validation.errors.publicIdInvalid', { id: entry.id }))
    }
    if (typeof entry.version !== 'string' || !versionPattern.test(entry.version)) {
      expectedError(t('validation.errors.publicVersionInvalid', {
        coordinate: `${entry.id}@${entry.version}`,
      }))
    }
    if (
      typeof entry.package !== 'string' ||
      !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(entry.package)
    ) {
      expectedError(t('validation.errors.publicPackageInvalid', { id: entry.id }))
    }
    if (
      typeof entry.integrity !== 'string' ||
      !/^sha512-[A-Za-z0-9+/]{80,}={0,2}$/.test(entry.integrity)
    ) {
      expectedError(t('validation.errors.publicIntegrityInvalid', { id: entry.id }))
    }

    let evidence
    try {
      evidence = new URL(entry.evidence)
    } catch {
      expectedError(t('validation.errors.publicEvidenceUrl', { id: entry.id }))
    }
    if (
      evidence.protocol !== 'https:' ||
      evidence.hostname !== 'github.com' ||
      evidence.username ||
      evidence.password ||
      evidence.port ||
      evidence.search ||
      evidence.hash
    ) {
      expectedError(t('validation.errors.publicEvidenceUrl', { id: entry.id }))
    }
    if (!evidence.pathname.match(
      /^\/([^/]+)\/([^/]+)\/(?:commit|blob|tree)\/([0-9a-f]{40})(?:\/|$)/,
    )) {
      expectedError(t('validation.errors.publicEvidenceCommit', { id: entry.id }))
    }
  }

  const coordinates = new Set(entries.map((entry) => `${entry.id}@${entry.version}`))
  if (coordinates.size !== entries.length) {
    expectedError(t('validation.errors.publicIdsUnique'))
  }
  return coordinates
}

function githubRepository(value) {
  const url = typeof value === 'string' ? value : value?.url
  if (typeof url !== 'string') return undefined
  const normalized = url.startsWith('git+') ? url.slice(4) : url
  try {
    const parsed = new URL(normalized)
    if (parsed.hostname !== 'github.com' || parsed.password) return undefined
    const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?$/)
    if (!match) return undefined
    return `${match[1]}/${match[2]}`.toLowerCase()
  } catch {
    const match = normalized.match(
      new RegExp(`^${'git' + '@'}github\\.com:([^/]+)/([^/#]+?)(?:\\.git)?$`, 'i'),
    )
    return match ? `${match[1]}/${match[2]}`.toLowerCase() : undefined
  }
}

export async function verifyPublicEvidence(entries, t, fetchImpl = fetch) {
  for (const entry of entries) {
    const coordinate = `${entry.id}@${entry.version}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetchImpl(entry.evidence, {
        headers: { 'user-agent': 'omdsh-public-evidence-check' },
        redirect: 'error',
        signal: controller.signal,
      })
      if (!response.ok) {
        expectedError(t('validation.errors.publicEvidenceHttp', {
          coordinate,
          status: response.status,
        }))
      }
      if (response.url && response.url !== entry.evidence) {
        expectedError(t('validation.errors.publicEvidenceRedirect', { coordinate }))
      }
      clearTimeout(timeout)

      const npmController = new AbortController()
      const npmTimeout = setTimeout(() => npmController.abort(), 10_000)
      let versionResponse
      try {
        versionResponse = await fetchImpl(
        new URL(
          `${encodeURIComponent(entry.package)}/${encodeURIComponent(entry.version)}`,
          'https://registry.npmjs.org/',
        ).href,
          {
            headers: { accept: 'application/json' },
            redirect: 'error',
            signal: npmController.signal,
          },
        )
      } finally {
        clearTimeout(npmTimeout)
      }
      if (!versionResponse.ok) {
        expectedError(t('validation.errors.publicPackageHttp', {
          coordinate,
          status: versionResponse.status,
        }))
      }
      const metadata = await versionResponse.json()
      if (metadata.name !== entry.package || metadata.version !== entry.version) {
        expectedError(t('validation.errors.publicPackageMismatch', { coordinate }))
      }
      if (metadata.dist?.integrity !== entry.integrity) {
        expectedError(t('validation.errors.publicIntegrityMismatch', { coordinate }))
      }
      const gitHead = metadata.gitHead?.toLowerCase()
      const evidenceMatch = new URL(entry.evidence).pathname.match(
        /^\/([^/]+)\/([^/]+)\/(?:commit|blob|tree)\/([0-9a-f]{40})(?:\/|$)/,
      )
      const evidenceRepository = evidenceMatch
        ? `${evidenceMatch[1]}/${evidenceMatch[2].replace(/\.git$/i, '')}`.toLowerCase()
        : undefined
      const commit = evidenceMatch?.[3]
      if (!evidenceRepository || githubRepository(metadata.repository) !== evidenceRepository) {
        expectedError(t('validation.errors.publicEvidenceRepository', {
          id: entry.id,
        }))
      }
      if (!gitHead || !commit || gitHead !== commit) {
        expectedError(t('validation.errors.publicEvidenceGitHead', { coordinate }))
      }
    } catch (error) {
      if (error instanceof ExpectedValidationError) throw error
      expectedError(t('validation.errors.publicEvidenceUnreadable', { coordinate }))
    } finally {
      clearTimeout(timeout)
    }
  }
}

async function validateDistributions({ t, requireManifest, verifyEvidence }) {
  const schemaPath = resolve(repositoryRoot, 'schemas/distribution-v1.schema.json')
  const schema = await readJson(schemaPath, t, 'schemas/distribution-v1.schema.json')
  const validate = createValidator(schema)
  const policyPath = resolve(repositoryRoot, 'policy/public-components.json')
  const publicComponentEntries = await readJson(
    policyPath,
    t,
    'policy/public-components.json',
  )
  const publicComponents = parsePublicComponents(publicComponentEntries, schema, t)

  if (verifyEvidence) await verifyPublicEvidence(publicComponentEntries, t)

  const failures = []
  let checked = 0
  const directory = 'distributions'
  const directoryPath = resolve(repositoryRoot, directory)
  const entries = await readdir(directoryPath, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue

    const relativePath = `${directory}/${entry.name}`
    let document
    try {
      document = JSON.parse(await readFile(resolve(directoryPath, entry.name), 'utf8'))
    } catch {
      failures.push(t('validation.errors.invalidJson', { path: relativePath }))
      continue
    }

    checked += 1
    if (!validate(document)) {
      failures.push(t('validation.errors.schemaFailed', {
        path: relativePath,
        details: formatValidationErrors(validate.errors, t),
      }))
      continue
    }

    for (const issue of validateSemantics(document, {
      fileName: entry.name,
      production: true,
      publicComponents,
    })) {
      failures.push(t('validation.errors.semantic', {
        path: relativePath,
        message: t(issue.code, issue.params),
      }))
    }
  }

  if (requireManifest && checked === 0) {
    failures.push(t('validation.errors.manifestRequired'))
  }

  if (failures.length > 0) {
    console.error(failures.join('\n'))
    return 1
  }

  console.log(t('validation.success', { count: checked }))
  return 0
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const i18n = await createI18n({ args, env })
  const localeError = formatLocaleError(i18n)
  if (localeError) {
    console.error(localeError)
    return 2
  }

  try {
    return await validateDistributions({
      t: i18n.t,
      requireManifest: args.includes('--require-manifest'),
      verifyEvidence: args.includes('--verify-evidence'),
    })
  } catch (error) {
    console.error(
      error instanceof ExpectedValidationError
        ? error.message
        : i18n.t('cli.errors.unexpected'),
    )
    return 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main()
}
