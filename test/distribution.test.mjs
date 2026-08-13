import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  createValidator,
  validateSemantics,
} from '../scripts/lib/distribution.mjs'
import {
  parsePublicComponents,
  validateWorkshopProjectionLock,
  verifyPublicEvidence,
} from '../scripts/validate-distributions.mjs'

const schema = JSON.parse(
  await readFile(new URL('../schemas/distribution-v1.schema.json', import.meta.url)),
)
const distribution = JSON.parse(
  await readFile(new URL('./fixtures/minimal.distribution.json', import.meta.url)),
)

test('Workshop projection lock pins the sole catalog source and exact projection', () => {
  const projectionText = '[]\n'
  const lock = {
    schema: 'omdsh-workshop-distribution-projection-lock/v1',
    authority: 'read-only-derived-snapshot',
    producer: {
      product: 'DSH Hub Workshop',
      repository: 'https://github.com/omdsh-dev/dsh-hub-workshop',
    },
    registry: {
      schema: 'omdsh-registry/v1',
      snapshotId: `sha256:${'a'.repeat(64)}`,
      revision: 1,
      digest: `sha256:${'b'.repeat(64)}`,
    },
    projection: {
      path: 'policy/public-components.json',
      digest: 'sha256:37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570',
    },
  }
  assert.doesNotThrow(() => validateWorkshopProjectionLock(lock, projectionText, (key) => key))
  assert.throws(
    () => validateWorkshopProjectionLock(lock, '[{}]\n', (key) => key),
    /validation\.errors\.workshopProjectionLock/,
  )
})

test('the fictional bilingual fixture passes the complete JSON Schema', () => {
  const validate = createValidator(schema)
  assert.equal(validate(distribution), true, JSON.stringify(validate.errors))
  assert.deepEqual(validateSemantics(distribution), [])
})

test('unknown top-level fields are rejected', () => {
  const validate = createValidator(schema)
  const changed = { ...distribution, unpublishedSetting: true }
  assert.equal(validate(changed), false)
  assert.ok(validate.errors.some((error) => error.keyword === 'additionalProperties'))
})

test('version ranges are rejected', () => {
  const validate = createValidator(schema)
  const changed = {
    ...distribution,
    components: [{ id: 'example-extension', version: '^1.0.0' }],
  }
  assert.equal(validate(changed), false)
})

test('both English and Simplified Chinese metadata are required', () => {
  const validate = createValidator(schema)
  const changed = {
    ...distribution,
    name: { en: distribution.name.en },
  }
  assert.equal(validate(changed), false)
  assert.ok(validate.errors.some((error) =>
    error.keyword === 'required' && error.params.missingProperty === 'zh-CN'))
})

test('future valid locale tags do not require a Schema change', () => {
  const validate = createValidator(schema)
  const changed = {
    ...distribution,
    name: { ...distribution.name, 'zh-TW': '元件組合範例' },
    summary: { ...distribution.summary, ja: 'ローカルテスト専用の架空例です。' },
  }
  assert.equal(validate(changed), true, JSON.stringify(validate.errors))
})

test('invalid locale tags and whitespace-only text are rejected', () => {
  const validate = createValidator(schema)
  assert.equal(validate({
    ...distribution,
    name: { ...distribution.name, zh_cn: '无效语言标签' },
  }), false)
  assert.equal(validate({
    ...distribution,
    summary: { ...distribution.summary, en: '   ' },
  }), false)
})

test('semantic validation returns stable issue codes and parameters', () => {
  const duplicate = {
    ...distribution,
    components: [
      { id: 'example-extension', version: '1.0.0' },
      { id: 'example-extension', version: '1.1.0' },
    ],
  }
  assert.deepEqual(validateSemantics(duplicate), [{
    code: 'semantic.duplicateComponent',
    params: { id: 'example-extension' },
  }])

  assert.deepEqual(validateSemantics({
    ...distribution,
    channel: 'stable',
    components: [{ id: 'example-extension', version: '0.1.0-preview.0' }],
  }), [{ code: 'semantic.stablePrerelease', params: {} }])

  assert.deepEqual(validateSemantics({
    ...distribution,
    channel: 'stable',
    version: '1.0.0-rc.1',
  }), [{ code: 'semantic.stablePrerelease', params: {} }])
})

test('file names and public evidence are checked semantically', () => {
  assert.deepEqual(
    validateSemantics(distribution, { fileName: 'different.json' }),
    [{
      code: 'semantic.fileName',
      params: { expected: 'example-component-set.json' },
    }],
  )

  assert.deepEqual(
    validateSemantics(distribution, {
      production: true,
      publicComponents: new Set(),
    }),
    [{
      code: 'semantic.componentNotApproved',
      params: { coordinate: 'example-extension@0.1.0' },
    }],
  )
})

test('public component evidence binds package, integrity, repository, and commit', async () => {
  const commit = 'a'.repeat(40)
  const integrity = `sha512-${'A'.repeat(86)}==`
  const entry = {
    id: 'example-extension',
    package: '@example/example-extension',
    version: '1.2.3',
    integrity,
    evidence: `https://github.com/example/example-extension/commit/${commit}`,
  }
  assert.deepEqual(
    parsePublicComponents([entry], schema, (key) => key),
    new Set(['example-extension@1.2.3']),
  )

  const requests = []
  await verifyPublicEvidence([entry], (key) => key, async (url) => {
    requests.push(url)
    if (url === entry.evidence) {
      return { ok: true, status: 200, url }
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          name: entry.package,
          version: entry.version,
          gitHead: commit,
          repository: {
            url: 'git+https://github.com/example/example-extension.git',
          },
          dist: { integrity },
        }
      },
    }
  })
  assert.deepEqual(requests, [
    entry.evidence,
    new URL(
      '%40example%2Fexample-extension/1.2.3',
      'https://registry.npmjs.org/',
    ).href,
  ])
})

test('public evidence rejects a package repository URL that only contains github.com in its path', async () => {
  const commit = 'b'.repeat(40)
  const integrity = `sha512-${'B'.repeat(86)}==`
  const entry = {
    id: 'example-extension',
    package: 'example-extension',
    version: '1.2.3',
    integrity,
    evidence: `https://github.com/example/example-extension/commit/${commit}`,
  }
  await assert.rejects(
    verifyPublicEvidence([entry], (key) => key, async (url) => {
      if (url === entry.evidence) return { ok: true, status: 200, url }
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            name: entry.package,
            version: entry.version,
            gitHead: commit,
            repository: {
              url: new URL(
                'path/github.com/example/example-extension',
                'https://example.invalid/',
              ).href,
            },
            dist: { integrity },
          }
        },
      }
    }),
    /validation\.errors\.publicEvidenceRepository/,
  )
})

test('public component policy rejects credential-bearing or mutable evidence URLs', () => {
  const base = {
    id: 'example-extension',
    package: 'example-extension',
    version: '1.2.3',
    integrity: `sha512-${'C'.repeat(86)}==`,
  }
  const commit = 'c'.repeat(40)
  for (const suffix of [
    `?${['access', 'token'].join('_')}=${['secret', 'value'].join('-')}`,
    '#fragment',
  ]) {
    assert.throws(() => parsePublicComponents([{
      ...base,
      evidence: `https://github.com/example/example-extension/commit/${commit}${suffix}`,
    }], schema, (key) => key), /validation\.errors\.publicEvidenceUrl/)
  }
})
