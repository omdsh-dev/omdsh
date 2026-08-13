import { readFile } from 'node:fs/promises'

export const DEFAULT_LOCALE = 'en'
export const SUPPORTED_LOCALES = Object.freeze(['en', 'zh-CN'])

const localeFiles = Object.freeze({
  en: new URL('../../locales/en.json', import.meta.url),
  'zh-CN': new URL('../../locales/zh-CN.json', import.meta.url),
})

function canonicalizeLocale(value) {
  if (typeof value !== 'string') return undefined

  const normalized = value
    .trim()
    .replaceAll('_', '-')
    .split(/[.@]/, 1)[0]

  if (!normalized || ['C', 'POSIX'].includes(normalized.toUpperCase())) {
    return undefined
  }

  try {
    return Intl.getCanonicalLocales(normalized)[0]
  } catch {
    return undefined
  }
}

export function matchLocale(value) {
  const canonical = canonicalizeLocale(value)
  if (!canonical) return undefined
  if (SUPPORTED_LOCALES.includes(canonical)) return canonical

  const locale = new Intl.Locale(canonical)
  if (locale.language === 'en') return 'en'
  if (locale.language !== 'zh') return undefined

  // Traditional Chinese must not be silently presented as Simplified Chinese.
  if (locale.script === 'Hant' || ['HK', 'MO', 'TW'].includes(locale.region)) {
    return undefined
  }
  if (locale.script && locale.script !== 'Hans') return undefined
  if (locale.region && !['CN', 'SG'].includes(locale.region)) return undefined
  return 'zh-CN'
}

export function parseLocaleArgument(args = []) {
  const values = []
  let missingValue = false

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--locale') {
      const value = args[index + 1]
      if (!value || value.startsWith('-')) {
        missingValue = true
      } else {
        values.push(value)
        index += 1
      }
    } else if (argument.startsWith('--locale=')) {
      const value = argument.slice('--locale='.length)
      if (value) values.push(value)
      else missingValue = true
    }
  }

  if (missingValue) {
    return { provided: true, errorCode: 'cli.locale.missing', value: undefined }
  }
  if (values.length > 1) {
    return {
      provided: true,
      errorCode: 'cli.locale.duplicate',
      value: values.join(', '),
    }
  }
  return {
    provided: values.length === 1,
    errorCode: undefined,
    value: values[0],
  }
}

export function resolveLocale({ args = [], env = {} } = {}) {
  const explicit = parseLocaleArgument(args)
  if (explicit.errorCode) {
    return {
      locale: DEFAULT_LOCALE,
      requested: explicit.value,
      errorCode: explicit.errorCode,
    }
  }
  if (explicit.provided) {
    const locale = matchLocale(explicit.value)
    return {
      locale: locale ?? DEFAULT_LOCALE,
      requested: explicit.value,
      errorCode: locale ? undefined : 'cli.locale.unsupported',
    }
  }

  const requested = env.LC_ALL || env.LC_MESSAGES || env.LANG
  return {
    locale: matchLocale(requested) ?? DEFAULT_LOCALE,
    requested,
    errorCode: undefined,
  }
}

function getLocaleFile(locale, localeRoot) {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    throw new RangeError(`Unsupported locale catalog: ${locale}`)
  }
  if (localeRoot) return new URL(`${locale}.json`, localeRoot)
  return localeFiles[locale]
}

function assertSafeCatalog(messages, locale) {
  if (!messages || typeof messages !== 'object' || Array.isArray(messages)) {
    throw new TypeError(`Invalid locale catalog: ${locale}`)
  }
  const forbidden = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/u
  for (const value of Object.values(messages)) {
    if (typeof value !== 'string' || forbidden.test(value)) {
      throw new TypeError(`Unsafe locale catalog: ${locale}`)
    }
  }
  return messages
}

export async function loadMessages(locale, { localeRoot } = {}) {
  const fallback = assertSafeCatalog(JSON.parse(
    await readFile(getLocaleFile(DEFAULT_LOCALE, localeRoot), 'utf8'),
  ), DEFAULT_LOCALE)
  if (locale === DEFAULT_LOCALE) return { fallback, messages: fallback }

  const messages = assertSafeCatalog(JSON.parse(
    await readFile(getLocaleFile(locale, localeRoot), 'utf8'),
  ), locale)
  return { fallback, messages }
}

export function escapeTerminalText(value) {
  return String(value).replace(
    /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/gu,
    (character) => {
      const named = {
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\v': '\\v',
        '\f': '\\f',
        '\r': '\\r',
      }
      if (Object.hasOwn(named, character)) return named[character]
      const codePoint = character.codePointAt(0)
      if (codePoint <= 0xff) {
        return `\\x${codePoint.toString(16).padStart(2, '0')}`
      }
      return `\\u${codePoint.toString(16).padStart(4, '0')}`
    },
  )
}

function interpolate(template, variables = {}) {
  return template.replaceAll(/\{([A-Za-z0-9_.-]+)\}/g, (match, key) => {
    return Object.hasOwn(variables, key)
      ? escapeTerminalText(variables[key])
      : match
  })
}

export async function createI18n({ args = [], env = {}, localeRoot } = {}) {
  const resolution = resolveLocale({ args, env })
  const { fallback, messages } = await loadMessages(resolution.locale, { localeRoot })

  return {
    ...resolution,
    t(key, variables = {}) {
      const template = messages[key] ?? fallback[key]
      if (typeof template !== 'string') {
        throw new ReferenceError(`Missing source message: ${key}`)
      }
      return interpolate(template, variables)
    },
  }
}

export function formatLocaleError(i18n) {
  if (!i18n.errorCode) return undefined
  return i18n.t(i18n.errorCode, {
    locale: i18n.requested ?? '',
    supported: SUPPORTED_LOCALES.join(', '),
  })
}
