import type { Connection } from './data'

export const DEFAULT_PRIVACY_MODE = true

export interface PrivacyAliases {
  people: Map<string, string>
  companies: Map<string, string>
}

export interface PersonPresentation {
  name: string
  company: string
  position: string
  avatar: string
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function aliasMap(values: string[], prefix: string) {
  const unique = [...new Set(values.filter(Boolean))].sort(
    (left, right) => stableHash(left) - stableHash(right) || left.localeCompare(right),
  )
  const width = Math.max(3, String(unique.length).length)
  return new Map(unique.map((value, index) => [value, `${prefix} ${String(index + 1).padStart(width, '0')}`]))
}

export function createPrivacyAliases(connections: Connection[]): PrivacyAliases {
  return {
    people: aliasMap(
      connections.map((person) => person.id),
      'Person',
    ),
    companies: aliasMap(
      connections.map((person) => person.company),
      'Company',
    ),
  }
}

export function personPresentation(
  person: Connection,
  aliases: PrivacyAliases,
  privacyMode: boolean,
): PersonPresentation {
  if (!privacyMode) {
    return {
      name: person.fullName,
      company: person.company || 'Company unavailable',
      position: person.position || 'Position unavailable',
      avatar: `${person.firstName[0] ?? ''}${person.lastName[0] ?? ''}`.toUpperCase() || '?',
    }
  }

  const name = aliases.people.get(person.id) ?? 'Person hidden'
  const company = person.company ? (aliases.companies.get(person.company) ?? 'Company hidden') : 'Company unavailable'
  return {
    name,
    company,
    position: person.roles.length ? person.roles.join(' · ') : 'Position hidden',
    avatar: name.match(/\d+$/)?.[0] ?? '?',
  }
}
