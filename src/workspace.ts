import { type ArchiveData, normalizeProfileUrl } from './data'

const WORKSPACE_FORMAT = 'common-ground-workspace'
const WORKSPACE_SCHEMA_VERSION = 2
const MAX_SAVED_SHORTLISTS = 100
export const WORKSPACE_STORAGE_KEY = 'common-ground.workspace.v1'
export const LEGACY_LOCATION_STORAGE_KEY = 'common-ground.locations.v1'

type AnnotationSource = 'manual' | 'enrichment-csv'

interface AnnotatedValue<T> {
  value: T
  source: AnnotationSource
  updatedAt: string
}

export interface PersonAnnotation {
  location?: AnnotatedValue<string>
  tags?: AnnotatedValue<string[]>
  notes?: AnnotatedValue<string>
}

interface SourceArchiveMetadata {
  fileName: string
  importedAt: string
  connectionCount: number
  messageCount: number
  conversationCount: number
}

export interface SavedShortlist {
  id: string
  name: string
  personIds: string[]
  createdAt: string
  updatedAt: string
}

export interface WorkspaceFile {
  format: typeof WORKSPACE_FORMAT
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION
  createdAt: string
  updatedAt: string
  sourceArchives: SourceArchiveMetadata[]
  people: Record<string, PersonAnnotation>
  savedShortlists: SavedShortlist[]
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
    savedShortlists: [],
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
  if (
    !isRecord(value) ||
    typeof value.fileName !== 'string' ||
    !validIso(value.importedAt) ||
    !Number.isInteger(value.connectionCount) ||
    !Number.isInteger(value.messageCount) ||
    !Number.isInteger(value.conversationCount) ||
    (value.connectionCount as number) < 0 ||
    (value.messageCount as number) < 0 ||
    (value.conversationCount as number) < 0
  ) {
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

function validPersonId(value: string) {
  return /^linkedin\.com\/in\/[a-z0-9_%.-]+$/i.test(value)
}

function parseSavedShortlist(value: unknown): SavedShortlist {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(value.id) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > 100 ||
    !Array.isArray(value.personIds) ||
    value.personIds.length === 0 ||
    value.personIds.length > 10_000 ||
    !value.personIds.every((id) => typeof id === 'string') ||
    !validIso(value.createdAt) ||
    !validIso(value.updatedAt)
  ) {
    throw new Error('Workspace saved shortlist is invalid.')
  }

  const personIds = [...new Set(value.personIds.map((id) => normalizeProfileUrl(id)))]
  if (!personIds.every(validPersonId)) {
    throw new Error('Workspace saved shortlist contains an invalid profile identifier.')
  }

  return {
    id: value.id,
    name: cleanText(value.name, 100),
    personIds,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
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
  if (value.schemaVersion !== 1 && value.schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
    throw new Error(`Workspace version ${String(value.schemaVersion)} is not supported.`)
  }
  if (!validIso(value.createdAt) || !validIso(value.updatedAt)) {
    throw new Error('Workspace timestamps are invalid.')
  }
  if (
    !Array.isArray(value.sourceArchives) ||
    !isRecord(value.people) ||
    (value.schemaVersion === WORKSPACE_SCHEMA_VERSION &&
      (!Array.isArray(value.savedShortlists) || value.savedShortlists.length > MAX_SAVED_SHORTLISTS))
  ) {
    throw new Error('Workspace structure is incomplete.')
  }

  const people: Record<string, PersonAnnotation> = Object.create(null) as Record<string, PersonAnnotation>
  for (const [rawId, rawAnnotation] of Object.entries(value.people)) {
    const id = normalizeProfileUrl(rawId)
    if (!validPersonId(id)) {
      throw new Error(`Workspace contains an invalid profile identifier: ${rawId}`)
    }
    const annotation = parsePersonAnnotation(rawAnnotation)
    if (Object.keys(annotation).length) people[id] = annotation
  }
  const savedShortlists = value.schemaVersion === 1 ? [] : (value.savedShortlists as unknown[]).map(parseSavedShortlist)
  if (new Set(savedShortlists.map((shortlist) => shortlist.id)).size !== savedShortlists.length) {
    throw new Error('Workspace contains duplicate saved shortlist identifiers.')
  }

  return {
    format: WORKSPACE_FORMAT,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    sourceArchives: value.sourceArchives.map(parseArchive).slice(0, 100),
    people,
    savedShortlists,
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
  if (!validPersonId(id)) {
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
    if (!validPersonId(id) || typeof rawLocation !== 'string') continue
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
    savedShortlists: mergeSavedShortlists(current.savedShortlists, imported.savedShortlists),
  }
  return attachArchive(merged, data, now)
}

export function countAnnotations(workspace: WorkspaceFile) {
  return Object.keys(workspace.people).length
}

function mergeSavedShortlists(current: SavedShortlist[], imported: SavedShortlist[]) {
  const shortlists = new Map(current.map((shortlist) => [shortlist.id, shortlist]))
  for (const shortlist of imported) shortlists.set(shortlist.id, shortlist)
  if (shortlists.size > MAX_SAVED_SHORTLISTS) {
    throw new Error(`A workspace can contain at most ${MAX_SAVED_SHORTLISTS} saved shortlists.`)
  }
  return [...shortlists.values()]
}

export function createSavedShortlist(
  workspace: WorkspaceFile,
  name: string,
  personIds: Iterable<string>,
  now?: Date,
  id: string = crypto.randomUUID(),
): WorkspaceFile {
  if (workspace.savedShortlists.length >= MAX_SAVED_SHORTLISTS) {
    throw new Error(`A workspace can contain at most ${MAX_SAVED_SHORTLISTS} saved shortlists.`)
  }
  const timestamp = nowIso(now)
  const shortlist = parseSavedShortlist({
    id,
    name,
    personIds: [...personIds],
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  if (workspace.savedShortlists.some((item) => item.id === shortlist.id)) {
    throw new Error('A saved shortlist with this identifier already exists.')
  }
  return {
    ...workspace,
    updatedAt: timestamp,
    savedShortlists: [...workspace.savedShortlists, shortlist],
  }
}

export function renameSavedShortlist(workspace: WorkspaceFile, id: string, name: string, now?: Date): WorkspaceFile {
  const timestamp = nowIso(now)
  let found = false
  const savedShortlists = workspace.savedShortlists.map((shortlist) => {
    if (shortlist.id !== id) return shortlist
    found = true
    return parseSavedShortlist({ ...shortlist, name, updatedAt: timestamp })
  })
  if (!found) throw new Error('The saved shortlist no longer exists.')
  return { ...workspace, updatedAt: timestamp, savedShortlists }
}

export function deleteSavedShortlist(workspace: WorkspaceFile, id: string, now?: Date): WorkspaceFile {
  const savedShortlists = workspace.savedShortlists.filter((shortlist) => shortlist.id !== id)
  if (savedShortlists.length === workspace.savedShortlists.length) return workspace
  return { ...workspace, updatedAt: nowIso(now), savedShortlists }
}
