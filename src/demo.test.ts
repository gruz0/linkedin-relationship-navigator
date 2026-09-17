import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App, { Dashboard } from './App'
import { createDemoData, createDemoWorkspace } from './demo'

describe('fictional demo workspace', () => {
  afterEach(() => vi.unstubAllGlobals())

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
    expect(html).toContain('Get your LinkedIn archive.')
    expect(html).toContain('linkedin-export-01-data-privacy.png')
    expect(html).toContain('linkedin-export-02-request-archive.png')
    expect(html).toContain('Allow up to 24 hours.')
    expect(html).toContain('Keep a private backup.')
    expect(html).toContain('https://www.linkedin.com/help/linkedin/answer/a1339364')
    expect(html).toContain('network-overview-privacy.png')
    expect(html).toContain('founders-two-way.png')
    expect(html).toContain('relationship-detail-privacy.png')
    expect(html).toContain('Tested on a real network, not only demo data.')
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
    const threadCounts = new Set(identifiable.map((person) => first.statsByPerson.get(person.id)?.conversationCount))
    const lastDirections = new Set(identifiable.map((person) => first.statsByPerson.get(person.id)?.lastDirection))

    expect(first.sourceFileName).toContain('fictional-demo')
    expect(identifiable).toHaveLength(48)
    expect(first.unavailableConnectionCount).toBe(2)
    expect(new Set(first.connections.map((person) => person.id)).size).toBe(first.connections.length)
    expect(statuses).toEqual(new Set(['two-way', 'outbound', 'inbound', 'none']))
    expect(threadCounts).toEqual(new Set([0, 1, 2, 3]))
    expect(lastDirections).toEqual(new Set(['sent', 'received', null]))
    expect(first.messageCount).toBeGreaterThan(50)
    expect(first.messageCount).toBe(second.messageCount)
    expect(identifiable.filter((person) => person.roles.length === 0).length).toBeGreaterThan(0)
    expect(first.connections.map((person) => person.fullName)).toEqual(
      second.connections.map((person) => person.fullName),
    )
  })

  it('provides annotations only for identifiable demo people', () => {
    const data = createDemoData()
    const workspace = createDemoWorkspace(data)
    const identifiableIds = new Set(
      data.connections.filter((person) => person.isIdentifiable).map((person) => person.id),
    )

    expect(Object.keys(workspace.people)).toHaveLength(18)
    expect(Object.keys(workspace.people).every((id) => identifiableIds.has(id))).toBe(true)
    expect(Object.values(workspace.people).some((person) => person.location?.value === 'Dubai')).toBe(true)
  })

  it('explains archive coverage, conversation counts, and privacy search limits', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    })

    const html = renderToStaticMarkup(
      createElement(Dashboard, { data: createDemoData(), isDemo: false, onReset: () => undefined }),
    )

    expect(html).toContain('3 relevant files used · 3 present')
    expect(html).toContain('aria-label="Conversation"')
    expect(html).toContain('All connections · 48')
    expect(html).toContain('Any message · 36')
    expect(html).toContain('Two-way · 12')
    expect(html).toContain('Outbound only · 12')
    expect(html).toContain('Inbound only · 12')
    expect(html).toContain('No messages found · 12')
    expect(html).toContain('People &amp; Talent')
    expect(html).toContain('Other')
    expect(html).toContain('Start with a useful question')
    expect(html).toContain('Each shortcut applies ordinary filters you can inspect, change, or clear.')
    expect(html).toContain('Founders I’ve spoken with')
    expect(html).toContain('Founder · Two-way conversation')
    expect(html).toContain('People who never replied')
    expect(html).toContain('Outbound only')
    expect(html).toContain('No conversation found')
    expect(html).toContain('No matched messages')
    expect(html).toContain('Strong conversations that went quiet')
    expect(html).toContain('Two-way · 10+ messages · 1+ year quiet')
    expect(html).toContain('Conversations where I sent the last message')
    expect(html).toContain('Any message · Last message by you')
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(6)
    expect(html).toContain('Select all 48 results')
    expect(html).toContain('aria-label="Results per batch"')
    expect(html).toContain('50 at a time')
    expect(html).toContain('Showing <strong>48</strong> of 48 results')
    expect(html).toContain('aria-label="Last contact"')
    expect(html).toContain('90+ days ago')
    expect(html).toContain('1+ year ago')
    expect(html).toContain('2+ years ago')
    expect(html).toContain('aria-label="Message depth"')
    expect(html).toContain('1–2 messages')
    expect(html).toContain('3–9 messages')
    expect(html).toContain('10+ messages')
    expect(html).toContain('aria-label="Conversation threads"')
    expect(html).toContain('1 thread')
    expect(html).toContain('2–3 threads')
    expect(html).toContain('4+ threads')
    expect(html).toContain('aria-label="Last message direction"')
    expect(html).toContain('Last message by you')
    expect(html).toContain('Last message by them')
    expect(html).toContain('Identifying details are masked; role categories stay useful.')
    expect(html).toContain('Names, companies, raw job titles, annotations, and messages stay hidden.')
    expect(html).toContain('Broad roles such as Founder or Engineering are derived from those titles')
    expect(html).toContain('Broad categories stay visible; raw titles are hidden.')
  })
})
