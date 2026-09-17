import { describe, expect, it } from 'vitest'
import type { ArchiveData } from './data'
import {
  createSavedShortlist,
  createWorkspace,
  deleteSavedShortlist,
  mergeWorkspaces,
  migrateLegacyLocations,
  parseWorkspaceFile,
  renameSavedShortlist,
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

  it('round-trips named shortlists with normalized profile identifiers', () => {
    const workspace = createSavedShortlist(
      createWorkspace(archive(), firstDate),
      ' Dubai founders ',
      ['https://www.linkedin.com/in/Ada/?trk=export', 'linkedin.com/in/ada', 'linkedin.com/in/grace'],
      secondDate,
      'shortlist-1',
    )

    const restored = parseWorkspaceFile(serializeWorkspace(workspace))

    expect(restored.schemaVersion).toBe(2)
    expect(restored.savedShortlists).toEqual([
      {
        id: 'shortlist-1',
        name: 'Dubai founders',
        personIds: ['linkedin.com/in/ada', 'linkedin.com/in/grace'],
        createdAt: secondDate.toISOString(),
        updatedAt: secondDate.toISOString(),
      },
    ])
  })

  it('migrates version 1 workspaces without losing annotations', () => {
    const current = updatePersonAnnotation(
      createWorkspace(archive(), firstDate),
      'linkedin.com/in/ada',
      { location: 'Dubai', tags: [], notes: '' },
      secondDate,
    )
    const legacy = JSON.parse(serializeWorkspace(current))
    legacy.schemaVersion = 1
    delete legacy.savedShortlists

    const migrated = parseWorkspaceFile(JSON.stringify(legacy))

    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.people['linkedin.com/in/ada'].location?.value).toBe('Dubai')
    expect(migrated.savedShortlists).toEqual([])
  })

  it('renames and deletes a saved shortlist without changing its people', () => {
    const saved = createSavedShortlist(
      createWorkspace(archive(), firstDate),
      'Initial name',
      ['linkedin.com/in/ada'],
      firstDate,
      'shortlist-1',
    )
    const renamed = renameSavedShortlist(saved, 'shortlist-1', 'Reconnect', secondDate)

    expect(renamed.savedShortlists[0]).toMatchObject({
      name: 'Reconnect',
      personIds: ['linkedin.com/in/ada'],
      createdAt: firstDate.toISOString(),
      updatedAt: secondDate.toISOString(),
    })
    expect(deleteSavedShortlist(renamed, 'shortlist-1', secondDate).savedShortlists).toEqual([])
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

  it('merges saved shortlists by stable identifier and preserves distinct lists', () => {
    const current = createSavedShortlist(
      createWorkspace(archive('current.zip'), firstDate),
      'Local list',
      ['linkedin.com/in/ada'],
      firstDate,
      'shared-list',
    )
    let imported = createSavedShortlist(
      createWorkspace(archive('older.zip'), firstDate),
      'Imported replacement',
      ['linkedin.com/in/grace'],
      secondDate,
      'shared-list',
    )
    imported = createSavedShortlist(imported, 'Another list', ['linkedin.com/in/linus'], secondDate, 'another-list')

    const merged = mergeWorkspaces(current, imported, archive('current.zip'), secondDate)

    expect(merged.savedShortlists.map((shortlist) => shortlist.name)).toEqual(['Imported replacement', 'Another list'])
    expect(merged.savedShortlists[0].personIds).toEqual(['linkedin.com/in/grace'])
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

    const malformed = createWorkspace(archive(), firstDate)
    expect(() =>
      parseWorkspaceFile(
        JSON.stringify({
          ...malformed,
          savedShortlists: [
            {
              id: 'bad list id',
              name: 'Broken',
              personIds: ['not-a-profile'],
              createdAt: firstDate.toISOString(),
              updatedAt: firstDate.toISOString(),
            },
          ],
        }),
      ),
    ).toThrow('saved shortlist')
  })
})
