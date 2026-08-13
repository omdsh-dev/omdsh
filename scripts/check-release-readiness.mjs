import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createI18n, formatLocaleError } from './lib/i18n.mjs'
import { isLicenseApproved } from './lib/release-readiness.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const i18n = await createI18n({ args: process.argv.slice(2), env: process.env })
const localeError = formatLocaleError(i18n)

if (localeError) {
  console.error(localeError)
  process.exitCode = 2
} else {
  try {
    const license = await readFile(resolve(repositoryRoot, 'LICENSE.md'), 'utf8')
    let licenseApproval
    try {
      licenseApproval = JSON.parse(await readFile(
        resolve(repositoryRoot, 'policy/approved-license.json'),
        'utf8',
      ))
    } catch {
      licenseApproval = undefined
    }
    const blockers = []
    if (!isLicenseApproved(license, licenseApproval)) {
      blockers.push(i18n.t('visibility.blockers.license'))
    }
    if (blockers.length > 0) {
      console.error(i18n.t('visibility.blocked', {
        blockers: blockers.join('; '),
      }))
      process.exitCode = 1
    } else {
      console.log(i18n.t('visibility.success'))
    }
  } catch {
    console.error(i18n.t('cli.errors.unexpected'))
    process.exitCode = 1
  }
}
