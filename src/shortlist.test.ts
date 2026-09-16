import { describe, expect, it } from 'vitest'
import { createDemoData, createDemoWorkspace } from './demo'
import { createPrivacyAliases } from './privacy'
import {
  buildShortlistRows,
  shortlistColumns,
  shortlistToCopyText,
  shortlistToCsv,
  shortlistToMarkdown,
} from './shortlist'

describe('shortlist export', () => {
  it('omits sensitive fields and uses stable aliases in Privacy mode', () => {
    const data = createDemoData()
    const workspace = createDemoWorkspace(data)
    const person = data.connections[0]
    const aliases = createPrivacyAliases(data.connections.filter((connection) => connection.isIdentifiable))
    const rows = buildShortlistRows({ people: [person], data, workspace, privacyAliases: aliases, privacyMode: true })
    const columns = shortlistColumns(true)
    const serialized = JSON.stringify({ rows, columns })

    expect(rows[0].name).toMatch(/^Person \d+$/)
    expect(rows[0].company).toMatch(/^Company \d+$/)
    expect(rows[0].profileUrl).toBe('')
    expect(rows[0].location).toBe('')
    expect(rows[0].tags).toBe('')
    expect(columns.map((column) => column.key)).not.toContain('profileUrl')
    expect(columns.map((column) => column.key)).not.toContain('location')
    expect(serialized).not.toContain(person.fullName)
    expect(serialized).not.toContain(person.company)
    expect(serialized).not.toContain(person.profileUrl)
    expect(serialized).not.toContain(workspace.people[person.id].notes?.value)
  })

  it('includes useful relationship context but never notes, email, or message content in a real-data export', () => {
    const data = createDemoData()
    const workspace = createDemoWorkspace(data)
    const person = data.connections[0]
    const aliases = createPrivacyAliases(data.connections.filter((connection) => connection.isIdentifiable))
    const rows = buildShortlistRows({ people: [person], data, workspace, privacyAliases: aliases, privacyMode: false })
    const csv = shortlistToCsv(rows, shortlistColumns(false))

    expect(csv).toContain(person.fullName)
    expect(csv).toContain(`https://www.${person.profileUrl}`)
    expect(csv).toContain('Two-way')
    expect(csv).toContain('12')
    expect(csv).toContain(workspace.people[person.id].location?.value)
    expect(csv).not.toContain(person.email)
    expect(csv).not.toContain(workspace.people[person.id].notes?.value)
    expect(csv).not.toContain(data.messagesByPerson.get(person.id)?.[0].content)
  })

  it('neutralizes spreadsheet formulas and escapes Markdown tables', () => {
    const data = createDemoData()
    const workspace = createDemoWorkspace(data)
    const person = { ...data.connections[0], fullName: '=HYPERLINK("bad")', company: 'A | B' }
    const aliases = createPrivacyAliases([person])
    const rows = buildShortlistRows({ people: [person], data, workspace, privacyAliases: aliases, privacyMode: false })
    const csv = shortlistToCsv(rows, shortlistColumns(false))
    const markdown = shortlistToMarkdown(rows, shortlistColumns(false))

    expect(csv).toContain('\'=HYPERLINK(""bad"")')
    expect(csv).not.toContain('"=HYPERLINK')
    expect(markdown).toContain('A \\| B')
  })

  it('copies profile links only when real data is visible', () => {
    const data = createDemoData()
    const workspace = createDemoWorkspace(data)
    const person = data.connections[0]
    const aliases = createPrivacyAliases([person])
    const visibleRows = buildShortlistRows({
      people: [person],
      data,
      workspace,
      privacyAliases: aliases,
      privacyMode: false,
    })
    const privateRows = buildShortlistRows({
      people: [person],
      data,
      workspace,
      privacyAliases: aliases,
      privacyMode: true,
    })

    expect(shortlistToCopyText(visibleRows, false)).toContain('https://www.linkedin.com/in/')
    expect(shortlistToCopyText(privateRows, true)).toBe('- Person 001')
  })
})
