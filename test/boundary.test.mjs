import assert from 'node:assert/strict'
import test from 'node:test'

import { findForbiddenPatternKeys } from '../scripts/check-public-boundary.mjs'

const join = (...parts) => parts.join('')

test('the boundary scanner rejects current and legacy npm credential forms', () => {
  const secret = 'a'.repeat(32)
  const cases = [
    `${join('npm', '_')}A1b2C3d4E5f6G7h8I9j0K1l2`,
    `${join('_auth', 'Token')}=${secret}`,
    `${join('_au', 'th')}=${secret}`,
    `${join('_pass', 'word')}=${secret}`,
    `${join('npm', 'AuthToken')}: ${secret}`,
    `"${join('npm', 'AuthToken')}": "${secret}"`,
    `${join('NPM', '_TOKEN')}=${secret}`,
  ]
  for (const value of cases) {
    assert.ok(findForbiddenPatternKeys(value).length > 0, value.slice(0, 8))
  }
})

test('environment placeholders remain allowed while terminal controls fail', () => {
  const placeholder = `${join('_auth', 'Token')}=\${${join('NPM', '_TOKEN')}}`
  assert.deepEqual(findForbiddenPatternKeys(placeholder), [])
  assert.ok(findForbiddenPatternKeys('\u0000').includes(
    'boundary.findings.binaryControl',
  ))
  assert.ok(findForbiddenPatternKeys('\u202e').includes(
    'boundary.findings.unicodeControl',
  ))
  assert.ok(findForbiddenPatternKeys('\u061c').includes(
    'boundary.findings.unicodeControl',
  ))
  assert.ok(findForbiddenPatternKeys('\u2062').includes(
    'boundary.findings.unicodeControl',
  ))
  for (const value of [
    `${join('https', ':')}private.example/path`,
    `${join('https', ':/')}private.example/path`,
    String.raw`${join('https', ':')}\\private.example\\path`,
    `${join('/', '/')}private.example/path`,
  ]) {
    assert.ok(findForbiddenPatternKeys(value).includes(
      'boundary.findings.malformedWebUrl',
    ))
  }
})

test('generic credentials are rejected while environment placeholders are allowed', () => {
  const secret = 'supersecretvalue'
  for (const value of [
    `${join('pass', 'word')}: ${secret}`,
    `${join('api', '_key')}=${secret}`,
    `${join('client', '-secret')}: ${secret}`,
    `${join('access', '_token')}=${secret}`,
  ]) {
    assert.ok(findForbiddenPatternKeys(value).includes(
      'boundary.findings.credentialAssignment',
    ))
  }
  assert.deepEqual(findForbiddenPatternKeys(
    `${join('pass', 'word')}: \${APP_PASSWORD}`,
  ), [])
})
