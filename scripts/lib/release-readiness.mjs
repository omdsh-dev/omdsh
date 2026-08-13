import { createHash } from 'node:crypto'

const approvedSpdxIds = new Set(['MIT', 'Apache-2.0'])

export function licenseDigest(licenseText) {
  return createHash('sha256').update(licenseText, 'utf8').digest('hex')
}

export function isLicenseApproved(licenseText, approval) {
  if (!approval || typeof approval !== 'object' || Array.isArray(approval)) {
    return false
  }
  if (JSON.stringify(Object.keys(approval).sort()) !== JSON.stringify(['sha256', 'spdx'])) {
    return false
  }
  if (!approvedSpdxIds.has(approval.spdx)) return false
  if (typeof approval.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(approval.sha256)) {
    return false
  }
  return licenseDigest(licenseText) === approval.sha256
}
