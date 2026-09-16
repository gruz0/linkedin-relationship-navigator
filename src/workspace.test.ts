import { describe, expect, it } from 'vitest'
import type { ArchiveData } from './data'
import {
  createWorkspace,
  mergeWorkspaces,
  migrateLegacyLocations,
  parseWorkspaceFile,
  serializeWorkspace,
  updatePersonAnnotation,
} from './workspace'

function archive(fileName = 'export.zip'): ArchiveData {
  return {
    sourceFileName: fileName,
    connections: [] as ArchiveData['connections'],
    messagesByPerson: new Map(),
    statsByPerson: new Map(),
    messageCount: 12,
    conversationCount: 3,
    archiveFileCount: 4,
    archiveFilesUsed: ['Connections.csv', 'messages.csv', 'Profile.csv'],
    selfName: 'Test User',
    unavailableConnectionCount: 0,
  }
}

const firstDate = new Date('2026-09-01T10:00:00.000Z')
const secondDate = new Date('2026-09-02T10:00:00.000Z')

describe('portable workspace', () => {
  it('round-trips annotations without including archive messages', () => {
    const empty = createWorkspace(archive(), firstDate)
    const annotated = updatePersonAnnotation(
      empty,
      'https://www.linkedin.com/in/Ada/?trk=export',
      {
        location: 'Dubai',
        tags: ['Founder', 'fintech', 'Founder'],
        notes: 'Met at a conference.',
      },
      secondDate,
    )

    const text = serializeWorkspace(annotated)
    const restored = parseWorkspaceFile(text)

    expect(restored.people['linkedin.com/in/ada']).toMatchObject({
      location: { value: 'Dubai', source: 'manual' },
      tags: { value: ['Founder', 'fintech'], source: 'manual' },
      notes: { value: 'Met at a conference.', source: 'manual' },
    })
    expect(text).not.toContain('messagesByPerson')
    expect(text).not.toContain('message content')
  })

  it('migrates legacy locations and normalizes their profile URLs', () => {
    const workspace = createWorkspace(archive(), firstDate)
    const migrated = migrateLegacyLocations(
      workspace,
      JSON.stringify({
        'https://www.linkedin.com/in/Ada/?trk=old': ' Dubai ',
        'not-a-profile': 'London',
      }),
      secondDate,
    )

    expect(migrated.people).toEqual({
      'linkedin.com/in/ada': {
        location: { value: 'Dubai', source: 'manual', updatedAt: secondDate.toISOString() },
      },
    })
  })

  it('merges imported annotations over local values and preserves archive history', () => {
    const current = updatePersonAnnotation(
      createWorkspace(archive('current.zip'), firstDate),
      'linkedin.com/in/ada',
      {
        location: 'London',
        tags: [],
        notes: '',
      },
      firstDate,
    )
    const imported = updatePersonAnnotation(
      createWorkspace(archive('older.zip'), firstDate),
      'linkedin.com/in/ada',
      {
        location: 'Dubai',
        tags: ['Investor'],
        notes: '',
      },
      secondDate,
    )

    const merged = mergeWorkspaces(current, imported, archive('current.zip'), secondDate)
    expect(merged.people['linkedin.com/in/ada'].location?.value).toBe('Dubai')
    expect(merged.sourceArchives.map((source) => source.fileName)).toEqual(['current.zip', 'older.zip'])
  })

  it('rejects malformed and unsupported workspace files', () => {
    expect(() => parseWorkspaceFile('{broken')).toThrow('not valid JSON')
    expect(() => parseWorkspaceFile(JSON.stringify({ format: 'something-else' }))).toThrow('not a Common Ground')
    expect(() =>
      parseWorkspaceFile(
        JSON.stringify({
          format: 'common-ground-workspace',
          schemaVersion: 99,
        }),
      ),
    ).toThrow('version 99 is not supported')
  })
})
