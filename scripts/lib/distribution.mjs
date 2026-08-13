import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

export function createValidator(schema) {
  const ajv = new Ajv2020({
    allErrors: true,
    coerceTypes: false,
    removeAdditional: false,
    strict: true,
    useDefaults: false,
    validateFormats: true,
  })
  addFormats(ajv)
  return ajv.compile(schema)
}

export function schemaErrorToIssue(error) {
  const location = error.instancePath || '/'
  const base = { location }

  switch (error.keyword) {
    case 'required':
      return {
        code: 'schema.errors.required',
        params: { ...base, property: error.params.missingProperty },
      }
    case 'additionalProperties':
      return {
        code: 'schema.errors.additionalProperties',
        params: { ...base, property: error.params.additionalProperty },
      }
    case 'type':
      return {
        code: 'schema.errors.type',
        params: { ...base, type: error.params.type },
      }
    case 'const':
      return {
        code: 'schema.errors.const',
        params: { ...base, expected: JSON.stringify(error.params.allowedValue) },
      }
    case 'enum':
      return {
        code: 'schema.errors.enum',
        params: { ...base, expected: JSON.stringify(error.params.allowedValues) },
      }
    case 'format':
      return {
        code: 'schema.errors.format',
        params: { ...base, format: error.params.format },
      }
    case 'pattern':
      return { code: 'schema.errors.pattern', params: base }
    case 'minLength':
      return {
        code: 'schema.errors.minLength',
        params: { ...base, limit: error.params.limit },
      }
    case 'maxLength':
      return {
        code: 'schema.errors.maxLength',
        params: { ...base, limit: error.params.limit },
      }
    case 'minItems':
      return {
        code: 'schema.errors.minItems',
        params: { ...base, limit: error.params.limit },
      }
    case 'maxItems':
      return {
        code: 'schema.errors.maxItems',
        params: { ...base, limit: error.params.limit },
      }
    case 'uniqueItems':
      return { code: 'schema.errors.uniqueItems', params: base }
    case 'propertyNames':
      return {
        code: 'schema.errors.propertyNames',
        params: { ...base, property: error.params.propertyName },
      }
    default:
      return {
        code: 'schema.errors.default',
        params: { ...base, keyword: error.keyword },
      }
  }
}

export function formatValidationErrors(errors = [], t) {
  if (typeof t !== 'function') {
    throw new TypeError('formatValidationErrors requires a translator')
  }
  return errors
    .map(schemaErrorToIssue)
    .map((issue) => t(issue.code, issue.params))
    .join('\n')
}

export function validateSemantics(
  distribution,
  { fileName, publicComponents, production = false } = {},
) {
  const issues = []
  const componentIds = new Set()

  if (fileName && fileName !== `${distribution.id}.json`) {
    issues.push({
      code: 'semantic.fileName',
      params: { expected: `${distribution.id}.json` },
    })
  }

  for (const component of distribution.components ?? []) {
    if (componentIds.has(component.id)) {
      issues.push({
        code: 'semantic.duplicateComponent',
        params: { id: component.id },
      })
    }
    componentIds.add(component.id)
    const coordinate = `${component.id}@${component.version}`
    if (production && publicComponents && !publicComponents.has(coordinate)) {
      issues.push({
        code: 'semantic.componentNotApproved',
        params: { coordinate },
      })
    }
  }

  const originalIds = (distribution.components ?? []).map((component) => component.id)
  const sortedIds = [...originalIds].sort((left, right) => {
    if (left < right) return -1
    if (left > right) return 1
    return 0
  })
  if (JSON.stringify(sortedIds) !== JSON.stringify(originalIds)) {
    issues.push({ code: 'semantic.componentsSorted', params: {} })
  }

  if (
    distribution.channel === 'stable' &&
    (
      distribution.version?.includes('-') ||
      (distribution.components ?? []).some((component) => component.version.includes('-'))
    )
  ) {
    issues.push({ code: 'semantic.stablePrerelease', params: {} })
  }

  return issues
}
