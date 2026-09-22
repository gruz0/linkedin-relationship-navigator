import { describe, expect, it } from 'vitest'
import { statsFor } from './data'
import { createDemoData, createDemoWorkspace } from './demo'
import { personCardToCopyText } from './person-card-copy'
import { createPrivacyAliases, personPresentation } from './privacy'

describe('person card clipboard text', () => {
  it('copies profile, relationship, and annotations without messages by default', () => {
    const data = createDemoData()
    const workspace = createDemoWorkspace(data)
    const person = data.connections[0]
    const aliases = createPrivacyAliases([person])
    const messages = data.messagesByPerson.get(person.id) ?? []
    const text = personCardToCopyText({
      person,
      presentation: personPresentation(person, aliases, false),
      stats: statsFor(data, person.id),
      messages,
      annotation: workspace.people[person.id],
      privacyMode: false,
    })

    expect(text).toContain('# LinkedIn relationship context')
    expect(text).toContain(`- Name: ${person.fullName}`)
    expect(text).toContain(`- Company: ${person.company}`)
    expect(text).toContain(`- LinkedIn profile: https://www.${person.profileUrl}`)
    expect(text).toContain(`- Location: ${workspace.people[person.id].location?.value}`)
    expect(text).toContain(workspace.people[person.id].notes?.value)
    expect(text).not.toContain('## Conversation history')
    expect(text).not.toContain(messages[0].content)
  })

  it('can include messages from oldest to newest without changing their source order', () => {
    const data = createDemoData()
    const person = data.connections[0]
    const aliases = createPrivacyAliases([person])
    const source = data.messagesByPerson.get(person.id)?.[0]
    if (!source) throw new Error('The demo person must have messages.')
    const messages = [
      { ...source, date: new Date('2026-03-01T00:00:00.000Z'), content: 'Newest message' },
      { ...source, date: null, dateRaw: '', content: 'Undated message' },
      {
        ...source,
        date: new Date('2026-01-01T00:00:00.000Z'),
        content: 'Oldest message',
        direction: 'received' as const,
      },
      { ...source, date: new Date('2026-02-01T00:00:00.000Z'), content: 'Middle message' },
    ]
    const text = personCardToCopyText({
      person,
      presentation: personPresentation(person, aliases, false),
      stats: statsFor(data, person.id),
      messages,
      privacyMode: false,
      includeMessages: true,
    })

    expect(text).toContain('## Conversation history (4 messages)')
    expect(text.indexOf('Oldest message')).toBeLessThan(text.indexOf('Middle message'))
    expect(text.indexOf('Middle message')).toBeLessThan(text.indexOf('Newest message'))
    expect(text.indexOf('Newest message')).toBeLessThan(text.indexOf('Undated message'))
    expect(text).toContain('· Received**')
    expect(text).not.toContain('Received from')
    expect(text).not.toContain('- Folder:')
    expect(messages.map((message) => message.content)).toEqual([
      'Newest message',
      'Undated message',
      'Oldest message',
      'Middle message',
    ])
  })

  it('omits identifying details, annotations, and message contents in Privacy mode', () => {
    const data = createDemoData()
    const workspace = createDemoWorkspace(data)
    const person = data.connections[0]
    const aliases = createPrivacyAliases([person])
    const messages = data.messagesByPerson.get(person.id) ?? []
    const text = personCardToCopyText({
      person,
      presentation: personPresentation(person, aliases, true),
      stats: statsFor(data, person.id),
      messages,
      annotation: workspace.people[person.id],
      privacyMode: true,
    })

    expect(text).toContain('- Name: Person 001')
    expect(text).toContain('Privacy mode was on')
    expect(text).not.toContain(person.fullName)
    expect(text).not.toContain(person.company)
    expect(text).not.toContain(person.profileUrl)
    expect(text).not.toContain(workspace.people[person.id].notes?.value)
    expect(text).not.toContain(messages[0].content)
    expect(text).not.toContain('## Conversation history')
  })

  it('keeps empty profiles useful and explicit when messages are requested', () => {
    const data = createDemoData()
    const person = { ...data.connections[3], connectedOn: null, connectedOnRaw: '' }
    const aliases = createPrivacyAliases([person])
    const text = personCardToCopyText({
      person,
      presentation: personPresentation(person, aliases, false),
      stats: statsFor(data, person.id),
      messages: [],
      privacyMode: false,
      includeMessages: true,
    })

    expect(text).toContain('- Connected on: Not available')
    expect(text).toContain('## My notes\n_No notes_')
    expect(text).toContain('_No matching conversation was found in the LinkedIn archive._')
  })
})
