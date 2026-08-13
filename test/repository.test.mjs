import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  isLicenseApproved,
  licenseDigest,
} from '../scripts/lib/release-readiness.mjs'

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url)),
)
const workflow = await readFile(
  new URL('../.github/workflows/validate.yml', import.meta.url),
  'utf8',
)
const orchestrator = await readFile(
  new URL('../scripts/run-checks.mjs', import.meta.url),
  'utf8',
)
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function run(script, args = []) {
  return spawnSync(process.execPath, [resolve(repositoryRoot, script), ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, LC_ALL: 'C', LANG: 'C' },
  })
}

test('package publication remains disabled', () => {
  assert.equal(packageJson.private, true)
  assert.equal(Object.hasOwn(packageJson.scripts, 'publish'), false)
})

test('license readiness requires a reviewed exact-text approval record', () => {
  const license = 'reviewed license text\n'
  const approval = { spdx: 'MIT', sha256: licenseDigest(license) }
  assert.equal(isLicenseApproved(license, undefined), false)
  assert.equal(isLicenseApproved(license, { ...approval, spdx: 'unknown' }), false)
  assert.equal(isLicenseApproved(`${license}changed`, approval), false)
  assert.equal(isLicenseApproved(license, approval), true)
})

test('the final release gate includes strict production validation', () => {
  assert.match(packageJson.scripts['public:check'], /run-checks\.mjs public/)
  assert.match(packageJson.scripts['visibility:check'], /run-checks\.mjs visibility/)
  assert.match(packageJson.scripts['release:check'], /run-checks\.mjs release/)
  assert.match(packageJson.scripts['validate:release'], /require-manifest/)
  assert.match(packageJson.scripts['validate:release'], /verify-evidence/)
  assert.match(orchestrator, /check-public-boundary/)
  assert.match(orchestrator, /check-release-readiness/)
  assert.match(orchestrator, /--require-manifest/)
  assert.match(orchestrator, /--verify-evidence/)
})

test('current visibility passes while the production release blocker fails closed', () => {
  const readiness = run('scripts/check-release-readiness.mjs')
  assert.equal(readiness.status, 0, readiness.stderr)
  assert.match(readiness.stdout, /Public-visibility readiness checks passed/)

  const releaseValidation = run(
    'scripts/validate-distributions.mjs',
    ['--require-manifest', '--verify-evidence'],
  )
  assert.equal(releaseValidation.status, 1)
  assert.match(releaseValidation.stderr, /requires at least one production definition/)
})

test('CI uses read-only permissions and immutable action references', () => {
  assert.match(workflow, /permissions:\s+contents: read/)
  assert.match(workflow, /npm run public:check/)
  assert.match(workflow, /npm run visibility:check/)
  assert.match(workflow, /npm run release:check/)
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/)
  assert.doesNotMatch(workflow, /uses:\s+[^\s]+@v\d+/)
  for (const match of workflow.matchAll(/uses:\s+[^\s]+@([^\s#]+)/g)) {
    assert.match(match[1], /^[a-f0-9]{40}$/)
  }
})
