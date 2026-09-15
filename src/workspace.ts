import { type ArchiveData, normalizeProfileUrl } from './data'

export const WORKSPACE_FORMAT = 'common-ground-workspace'
export const WORKSPACE_SCHEMA_VERSION = 1
export const WORKSPACE_STORAGE_KEY = 'common-ground.workspace.v1'
export const LEGACY_LOCATION_STORAGE_KEY = 'common-ground.locations.v1'

export type AnnotationSource = 'manual' | 'enrichment-csv'

export interface AnnotatedValue<T> {
  value: T
  source: AnnotationSource
  updatedAt: string
}

export interface PersonAnnotation {
  location?: AnnotatedValue<string>
  tags?: AnnotatedValue<string[]>
  notes?: AnnotatedValue<string>
}

export interface SourceArchiveMetadata {
  fileName: string
  importedAt: string
  connectionCount: number
  messageCount: number
  conversationCount: number
}

export interface WorkspaceFile {
  format: typeof WORKSPACE_FORMAT
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION
  createdAt: string
  updatedAt: string
  sourceArchives: SourceArchiveMetadata[]
  people: Record<string, PersonAnnotation>
}

export interface AnnotationDraft {
  location: string
  tags: string[]
  notes: string
}

type UnknownRecord = Record<string, unknown>

function nowIso(now?: Date) {
  return (now ?? new Date()).toISOString()
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validIso(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function cleanText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength)
}

function cleanTags(tags: string[]) {
  return [...new Set(tags.map((tag) => cleanText(tag, 80)).filter(Boolean))].slice(0, 100)
}

function archiveMetadata(data: ArchiveData, importedAt: string): SourceArchiveMetadata {
  return {
    fileName: data.sourceFileName,
    importedAt,
    connectionCount: data.connections.length,
    messageCount: data.messageCount,
    conversationCount: data.conversationCount,
  }
}

function archiveKey(archive: SourceArchiveMetadata) {
  return [archive.fileName, archive.connectionCount, archive.messageCount, archive.conversationCount].join('|')
}

export function createWorkspace(data: ArchiveData, now?: Date): WorkspaceFile {
  const timestamp = nowIso(now)
  return {
    format: WORKSPACE_FORMAT,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceArchives: [archiveMetadata(data, timestamp)],
    people: {},
  }
}

export function attachArchive(workspace: WorkspaceFile, data: ArchiveData, now?: Date): WorkspaceFile {
  const timestamp = nowIso(now)
  const archive = archiveMetadata(data, timestamp)
  const archives = workspace.sourceArchives.some((item) => archiveKey(item) === archiveKey(archive))
    ? workspace.sourceArchives
    : [...workspace.sourceArchives, archive]
  return { ...workspace, updatedAt: timestamp, sourceArchives: archives }
}

function parseAnnotatedString(value: unknown, field: string, maxLength: number): AnnotatedValue<string> | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value) || typeof value.value !== 'string' || !validIso(value.updatedAt)) {
    throw new Error(`Workspace ${field} annotation is invalid.`)
  }
  if (value.source !== 'manual' && value.source !== 'enrichment-csv') {
    throw new Error(`Workspace ${field} annotation has an unknown source.`)
  }
  if (value.value.length > maxLength) {
    throw new Error(`Workspace ${field} annotation is too long.`)
  }
  const cleaned = cleanText(value.value, maxLength)
  if (!cleaned) return undefined
  return { value: cleaned, source: value.source, updatedAt: value.updatedAt }
}

function parseAnnotatedTags(value: unknown): AnnotatedValue<string[]> | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value) || !Array.isArray(value.value) || !validIso(value.updatedAt)) {
    throw new Error('Workspace tags annotation is invalid.')
  }
  if (value.source !== 'manual' && value.source !== 'enrichment-csv') {
    throw new Error('Workspace tags annotation has an unknown source.')
  }
  if (!value.value.every((tag) => typeof tag === 'string')) {
    throw new Error('Workspace tags must be text values.')
  }
  if (value.value.length > 100 || value.value.some((tag) => tag.length > 80)) {
    throw new Error('Workspace tags exceed the supported limits.')
  }
  const tags = cleanTags(value.value)
  if (!tags.length) return undefined
  return { value: tags, source: value.source, updatedAt: value.updatedAt }
}

function parsePersonAnnotation(value: unknown): PersonAnnotation {
  if (!isRecord(value)) throw new Error('Workspace person annotation is invalid.')
  const annotation: PersonAnnotation = {}
  const location = parseAnnotatedString(value.location, 'location', 500)
  const tags = parseAnnotatedTags(value.tags)
  const notes = parseAnnotatedString(value.notes, 'notes', 50_000)
  if (location) annotation.location = location
  if (tags) annotation.tags = tags
  if (notes) annotation.notes = notes
  return annotation
}

function parseArchive(value: unknown): SourceArchiveMetadata {
  if (!isRecord(value)
    || typeof value.fileName !== 'string'
    || !validIso(value.importedAt)
    || !Number.isInteger(value.connectionCount)
    || !Number.isInteger(value.messageCount)
    || !Number.isInteger(value.conversationCount)
    || (value.connectionCount as number) < 0
    || (value.messageCount as number) < 0
    || (value.conversationCount as number) < 0) {
    throw new Error('Workspace archive metadata is invalid.')
  }
  return {
    fileName: cleanText(value.fileName, 500),
    importedAt: value.importedAt,
    connectionCount: value.connectionCount as number,
    messageCount: value.messageCount as number,
    conversationCount: value.conversationCount as number,
  }
}

export function parseWorkspaceFile(text: string): WorkspaceFile {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('This workspace is not valid JSON.')
  }
  if (!isRecord(value) || value.format !== WORKSPACE_FORMAT) {
    throw new Error('This is not a Common Ground workspace file.')
  }
  if (value.schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
    throw new Error(`Workspace version ${String(value.schemaVersion)} is not supported.`)
  }
  if (!validIso(value.createdAt) || !validIso(value.updatedAt)) {
    throw new Error('Workspace timestamps are invalid.')
  }
  if (!Array.isArray(value.sourceArchives) || !isRecord(value.people)) {
    throw new Error('Workspace structure is incomplete.')
  }

  const people: Record<string, PersonAnnotation> = Object.create(null) as Record<string, PersonAnnotation>
  for (const [rawId, rawAnnotation] of Object.entries(value.people)) {
    const id = normalizeProfileUrl(rawId)
    if (!/^linkedin\.com\/in\/[a-z0-9_%.-]+$/i.test(id)) {
      throw new Error(`Workspace contains an invalid profile identifier: ${rawId}`)
    }
    const annotation = parsePersonAnnotation(rawAnnotation)
    if (Object.keys(annotation).length) people[id] = annotation
  }

  return {
    format: WORKSPACE_FORMAT,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    sourceArchives: value.sourceArchives.map(parseArchive).slice(0, 100),
    people,
  }
}

export function serializeWorkspace(workspace: WorkspaceFile) {
  return `${JSON.stringify(workspace, null, 2)}\n`
}

export function updatePersonAnnotation(
  workspace: WorkspaceFile,
  personId: string,
  draft: AnnotationDraft,
  now?: Date,
): WorkspaceFile {
  const id = normalizeProfileUrl(personId)
  if (!/^linkedin\.com\/in\/[a-z0-9_%.-]+$/i.test(id)) {
    throw new Error('Annotations require a valid LinkedIn profile URL.')
  }
  const timestamp = nowIso(now)
  const location = cleanText(draft.location, 500)
  const tags = cleanTags(draft.tags)
  const notes = cleanText(draft.notes, 50_000)
  const annotation: PersonAnnotation = {}
  if (location) annotation.location = { value: location, source: 'manual', updatedAt: timestamp }
  if (tags.length) annotation.tags = { value: tags, source: 'manual', updatedAt: timestamp }
  if (notes) annotation.notes = { value: notes, source: 'manual', updatedAt: timestamp }

  const people = { ...workspace.people }
  if (Object.keys(annotation).length) people[id] = annotation
  else delete people[id]
  return { ...workspace, people, updatedAt: timestamp }
}

export function migrateLegacyLocations(workspace: WorkspaceFile, raw: string | null, now?: Date): WorkspaceFile {
  if (!raw) return workspace
  let values: unknown
  try {
    values = JSON.parse(raw)
  } catch {
    return workspace
  }
  if (!isRecord(values)) return workspace

  const timestamp = nowIso(now)
  const people = { ...workspace.people }
  for (const [rawId, rawLocation] of Object.entries(values)) {
    const id = normalizeProfileUrl(rawId)
    if (!/^linkedin\.com\/in\/[a-z0-9_%.-]+$/i.test(id) || typeof rawLocation !== 'string') continue
    const location = cleanText(rawLocation, 500)
    if (location && !people[id]?.location) {
      people[id] = {
        ...people[id],
        location: { value: location, source: 'manual', updatedAt: timestamp },
      }
    }
  }
  return { ...workspace, people, updatedAt: timestamp }
}

export function mergeWorkspaces(
  current: WorkspaceFile,
  imported: WorkspaceFile,
  data: ArchiveData,
  now?: Date,
): WorkspaceFile {
  const timestamp = nowIso(now)
  const archiveMap = new Map<string, SourceArchiveMetadata>()
  for (const archive of [...current.sourceArchives, ...imported.sourceArchives]) {
    archiveMap.set(archiveKey(archive), archive)
  }
  const merged: WorkspaceFile = {
    ...current,
    createdAt: imported.createdAt,
    updatedAt: timestamp,
    sourceArchives: [...archiveMap.values()].slice(-100),
    people: { ...current.people, ...imported.people },
  }
  return attachArchive(merged, data, now)
}

export function countAnnotations(workspace: WorkspaceFile) {
  return Object.keys(workspace.people).length
}
