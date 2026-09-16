import { describe, expect, it } from 'vitest'
import type { Connection } from './data'
import { createPrivacyAliases, DEFAULT_PRIVACY_MODE, personPresentation } from './privacy'

function person(
  id: string,
  fullName: string,
  company: string,
  position: string,
  roles: Connection['roles'],
): Connection {
  const [firstName, ...lastName] = fullName.split(' ')
  return {
    id,
    firstName,
    lastName: lastName.join(' '),
    fullName,
    profileUrl: id,
    email: '',
    company,
    position,
    connectedOn: null,
    connectedOnRaw: '',
    roles,
    isIdentifiable: true,
    dubaiCompanySignal: false,
  }
}

const ada = person('linkedin.com/in/ada-lovelace', 'Ada Lovelace', 'Analytical Engines', 'Founder & CEO', [
  'Founder',
  'CEO',
  'C-suite',
])
const grace = person('linkedin.com/in/grace-hopper', 'Grace Hopper', 'Analytical Engines', 'Rear Admiral', [])

describe('privacy preference', () => {
  it('starts every imported archive in privacy mode', () => {
    expect(DEFAULT_PRIVACY_MODE).toBe(true)
  })
})

describe('privacy aliases', () => {
  it('creates stable aliases regardless of connection order', () => {
    const first = createPrivacyAliases([ada, grace])
    const second = createPrivacyAliases([grace, ada])

    expect(first.people.get(ada.id)).toBe(second.people.get(ada.id))
    expect(first.people.get(grace.id)).toBe(second.people.get(grace.id))
    expect(first.people.get(ada.id)).not.toBe(first.people.get(grace.id))
    expect(first.companies.get(ada.company)).toBe(first.companies.get(grace.company))
  })

  it('removes identifying person, company, and raw-position text from the presentation', () => {
    const presentation = personPresentation(ada, createPrivacyAliases([ada, grace]), true)
    const rendered = JSON.stringify(presentation)

    expect(presentation.name).toMatch(/^Person \d{3}$/)
    expect(presentation.company).toMatch(/^Company \d{3}$/)
    expect(presentation.position).toBe('Founder · CEO · C-suite')
    expect(rendered).not.toContain('Ada')
    expect(rendered).not.toContain('Lovelace')
    expect(rendered).not.toContain('Analytical Engines')
    expect(rendered).not.toContain('Founder & CEO')
  })

  it('returns original display values when privacy mode is disabled', () => {
    expect(personPresentation(ada, createPrivacyAliases([ada]), false)).toMatchObject({
      name: 'Ada Lovelace',
      company: 'Analytical Engines',
      position: 'Founder & CEO',
      avatar: 'AL',
    })
  })
})
