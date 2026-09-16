import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createDemoData, createDemoWorkspace } from './demo'

describe('fictional demo workspace', () => {
  it('offers archive upload and demo exploration as separate landing actions', () => {
    const html = renderToStaticMarkup(createElement(App))

    expect(html).toContain('Choose ZIP archive')
    expect(html).toContain('Explore demo workspace')
    expect(html).toContain('You may already know someone who can help.')
    expect(html).toContain('LinkedIn helps you find a person.')
    expect(html).toContain('Which founders have I actually spoken with?')
    expect(html).toContain('Who did I contact without receiving a reply?')
    expect(html).toContain('Which connections have no matching conversation?')
    expect(html).toContain('Connections.csv')
    expect(html).toContain('Messages.csv')
    expect(html).toContain('Use the right tool for the question.')
    expect(html).toContain('Current profiles and locations')
    expect(html).toContain('Combining role or company with relationship status')
    expect(html).toContain('Find the right person')
    expect(html).toContain('Decide who to contact')
    expect(html).toContain('showcase/workspace-overview.jpg')
    expect(html).toContain('showcase/relationship-detail.jpg')
    expect(html).toContain('showcase/privacy-mode.jpg')
    expect(html).not.toContain('Your network, made useful')
    expect(html).not.toContain('Browser only')
    expect(html).not.toContain('Useful when')
    expect(html).not.toContain('Inside Common Ground')
    expect(html).toContain('type="file"')
    expect(html).toContain('https://www.linkedin.com/in/alexanderkadyrov/')
    expect(html).toContain('https://github.com/gruz0')
  })

  it('builds a deterministic and varied relationship dataset', () => {
    const first = createDemoData()
    const second = createDemoData()
    const identifiable = first.connections.filter((person) => person.isIdentifiable)
    const statuses = new Set(identifiable.map((person) => first.statsByPerson.get(person.id)?.status))

    expect(first.sourceFileName).toContain('fictional-demo')
    expect(identifiable).toHaveLength(48)
    expect(first.unavailableConnectionCount).toBe(2)
    expect(new Set(first.connections.map((person) => person.id)).size).toBe(first.connections.length)
    expect(statuses).toEqual(new Set(['two-way', 'outbound', 'inbound', 'none']))
    expect(first.messageCount).toBeGreaterThan(50)
    expect(first.messageCount).toBe(second.messageCount)
    expect(first.connections.map((person) => person.fullName)).toEqual(second.connections.map((person) => person.fullName))
  })

  it('provides annotations only for identifiable demo people', () => {
    const data = createDemoData()
    const workspace = createDemoWorkspace(data)
    const identifiableIds = new Set(data.connections.filter((person) => person.isIdentifiable).map((person) => person.id))

    expect(Object.keys(workspace.people)).toHaveLength(18)
    expect(Object.keys(workspace.people).every((id) => identifiableIds.has(id))).toBe(true)
    expect(Object.values(workspace.people).some((person) => person.location?.value === 'Dubai')).toBe(true)
  })
})
