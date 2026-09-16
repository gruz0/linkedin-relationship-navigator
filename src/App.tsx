import {
  ArrowDownUp,
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Code2,
  ContactRound,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FileUp,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  StickyNote,
  Tags,
  Trash2,
  UploadCloud,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import foundersTwoWayScreenshot from '../screenshots/founders-two-way.png'
import linkedInDataPrivacyScreenshot from '../screenshots/linkedin-export-01-data-privacy.png'
import linkedInRequestArchiveScreenshot from '../screenshots/linkedin-export-02-request-archive.png'
import networkOverviewScreenshot from '../screenshots/network-overview-privacy.png'
import relationshipDetailScreenshot from '../screenshots/relationship-detail-privacy.png'
import {
  type ArchiveData,
  type Connection,
  type ConversationStatus,
  conversationCountsFor,
  matchesRoleFilters,
  parseLinkedInArchive,
  ROLE_FILTER_CATEGORIES,
  type RoleFilterCategory,
  statsFor,
} from './data'
import { createDemoData, createDemoWorkspace } from './demo'
import { createPrivacyAliases, DEFAULT_PRIVACY_MODE, type PrivacyAliases, personPresentation } from './privacy'
import { countQuickQuestionMatches, QUICK_QUESTIONS, type QuickQuestion } from './quick-questions'
import {
  MESSAGE_DEPTH_FILTER_LABELS,
  MESSAGE_DEPTH_FILTER_OPTIONS,
  type MessageDepthFilter,
  matchesMessageDepthFilter,
  matchesRecencyFilter,
  matchesRelationshipFilters,
  RECENCY_FILTER_LABELS,
  RECENCY_FILTER_OPTIONS,
  type RecencyFilter,
} from './relationship-filters'
import {
  type AnnotationDraft,
  attachArchive,
  countAnnotations,
  createWorkspace,
  LEGACY_LOCATION_STORAGE_KEY,
  mergeWorkspaces,
  migrateLegacyLocations,
  type PersonAnnotation,
  parseWorkspaceFile,
  serializeWorkspace,
  updatePersonAnnotation,
  WORKSPACE_STORAGE_KEY,
  type WorkspaceFile,
} from './workspace'

const PAGE_SIZE = 60
const CREATOR_LINKEDIN_URL = 'https://www.linkedin.com/in/alexanderkadyrov/'
const CREATOR_GITHUB_URL = 'https://github.com/gruz0'
const LINKEDIN_DOWNLOAD_HELP_URL = 'https://www.linkedin.com/help/linkedin/answer/a1339364'

type ConversationFilter = ConversationStatus | 'all' | 'any'
type LocationFilter = 'all' | 'unknown' | string
type SortMode = 'connected' | 'contacted' | 'messages' | 'name'

const conversationLabels: Record<ConversationStatus, string> = {
  'two-way': 'Two-way',
  outbound: 'Outbound only',
  inbound: 'Inbound only',
  none: 'No messages found',
}

const conversationFilterOptions: Array<[ConversationFilter, string]> = [
  ['all', 'All connections'],
  ['any', 'Any message'],
  ['two-way', 'Two-way'],
  ['outbound', 'Outbound only'],
  ['inbound', 'Inbound only'],
  ['none', 'No messages found'],
]

const conversationFilterLabels = Object.fromEntries(conversationFilterOptions) as Record<ConversationFilter, string>

function loadWorkspace(data: ArchiveData): WorkspaceFile {
  let workspace = createWorkspace(data)
  try {
    const saved = localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (saved) workspace = attachArchive(parseWorkspaceFile(saved), data)
  } catch {
    // A broken local copy must not prevent the user from opening their archive.
  }
  workspace = migrateLegacyLocations(workspace, localStorage.getItem(LEGACY_LOCATION_STORAGE_KEY))
  localStorage.setItem(WORKSPACE_STORAGE_KEY, serializeWorkspace(workspace))
  localStorage.removeItem(LEGACY_LOCATION_STORAGE_KEY)
  return workspace
}

function downloadWorkspace(workspace: WorkspaceFile) {
  const blob = new Blob([serializeWorkspace(workspace)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'common-ground.workspace.json'
  link.click()
  URL.revokeObjectURL(url)
}

function formatDate(date: Date | null, fallback = '—') {
  if (!date) return fallback
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function linkedInUrl(profileUrl: string) {
  return /^linkedin\.com\/in\/[a-z0-9_%.-]+$/i.test(profileUrl) ? `https://www.${profileUrl}` : ''
}

function ImportScreen({ onImport, onDemo }: { onImport: (file: File) => Promise<void>; onDemo: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async (file?: File) => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      await onImport(file)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The archive could not be opened.')
      setLoading(false)
    }
  }

  return (
    <main className="import-page">
      <nav className="landing-nav">
        <div className="landing-nav-frame">
          <Brand />
          <span className="privacy-pill">
            <LockKeyhole size={14} /> Your data stays here
          </span>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <h1>You may already know someone who can help.</h1>
          <p>
            LinkedIn helps you find a person. Common Ground connects your exported connections and message history so
            you can see who is relevant, whether you have actually spoken, and the context before reaching out—all
            inside your browser.
          </p>
          <section
            className="outcome-path"
            aria-label="Find the right person, understand the relationship, and decide who to contact"
          >
            <strong>Find the right person</strong>
            <span aria-hidden="true">→</span>
            <strong>Understand the relationship</strong>
            <span aria-hidden="true">→</span>
            <strong>Decide who to contact</strong>
          </section>
        </div>

        <section
          className={`drop-card ${dragging ? 'is-dragging' : ''}`}
          aria-label="LinkedIn archive upload"
          onDragEnter={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            event.preventDefault()
            setDragging(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void load(event.dataTransfer.files[0])
          }}
        >
          <div className="upload-icon">
            <UploadCloud size={28} />
          </div>
          <h2>{loading ? 'Reading your archive…' : 'Open your LinkedIn export'}</h2>
          <p>Choose the complete ZIP you downloaded from LinkedIn.</p>
          <button type="button" className="primary-button" onClick={() => inputRef.current?.click()} disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={18} /> : <Download size={18} />}
            {loading ? 'Preparing workspace' : 'Choose ZIP archive'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(event) => void load(event.target.files?.[0])}
          />
          <span className="drop-hint">or drop it here · nothing leaves this browser</span>
          <div className="import-choice">
            <span>or</span>
          </div>
          <button type="button" className="demo-button" onClick={onDemo} disabled={loading}>
            <Sparkles size={17} /> Explore demo workspace
          </button>
          {error && (
            <div className="import-error">
              <CircleAlert size={16} /> {error}
            </div>
          )}
        </section>
      </section>

      <section className="use-cases" aria-labelledby="use-cases-heading">
        <header>
          <h2 id="use-cases-heading">Ask questions that cross your network and message history.</h2>
        </header>
        <div className="use-case-grid">
          <article>
            <span className="use-case-icon">
              <BriefcaseBusiness size={21} />
            </span>
            <div>
              <h3>Which founders have I actually spoken with?</h3>
              <p>Combine role information with two-way conversation history.</p>
            </div>
          </article>
          <article>
            <span className="use-case-icon">
              <ArrowUpRight size={21} />
            </span>
            <div>
              <h3>Who did I contact without receiving a reply?</h3>
              <p>See outbound-only relationships across the complete network.</p>
            </div>
          </article>
          <article>
            <span className="use-case-icon">
              <Inbox size={21} />
            </span>
            <div>
              <h3>Which connections have no matching conversation?</h3>
              <p>Separate accumulated connections from relationships with visible history.</p>
            </div>
          </article>
        </div>
        <div
          className="data-join"
          role="img"
          aria-label="Common Ground combines connection role and company data with message direction, recency, and history"
        >
          <div className="data-source">
            <code>Connections.csv</code>
            <span>Role · Company</span>
          </div>
          <span className="join-operator" aria-hidden="true">
            +
          </span>
          <div className="data-source">
            <code>Messages.csv</code>
            <span>Direction · Recency · History</span>
          </div>
          <span className="join-operator join-arrow" aria-hidden="true">
            →
          </span>
          <div className="data-source data-result">
            <strong>Common Ground</strong>
            <span>Relationship context</span>
          </div>
        </div>
      </section>

      <section className="tool-boundary" aria-labelledby="tool-boundary-heading">
        <header>
          <h2 id="tool-boundary-heading">Use the right tool for the question.</h2>
          <p>Common Ground is a companion to LinkedIn, not a replacement.</p>
        </header>
        <div className="tool-boundary-grid">
          <article>
            <h3>Use LinkedIn for</h3>
            <ul>
              <li>Current profiles and locations</li>
              <li>Finding one particular person</li>
              <li>Sending and continuing messages</li>
            </ul>
          </article>
          <article>
            <h3>Use Common Ground for</h3>
            <ul>
              <li>Combining role or company with relationship status</li>
              <li>Reviewing conversation evidence across many connections</li>
              <li>Keeping private notes, tags, and portable annotations</li>
              <li>Working locally with a snapshot you control</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="export-guide" aria-labelledby="export-guide-heading">
        <header>
          <h2 id="export-guide-heading">Get your LinkedIn archive.</h2>
          <p>Use LinkedIn on desktop to request the larger account-data archive that Common Ground can open.</p>
        </header>
        <div className="export-steps">
          <article>
            <div className="export-step-copy">
              <span>1</span>
              <div>
                <h3>Open Download your data</h3>
                <p>
                  Go to Settings &amp; Privacy → Data privacy, then choose <strong>Download your data</strong>.
                </p>
              </div>
            </div>
            <figure>
              <a
                href={linkedInDataPrivacyScreenshot}
                target="_blank"
                rel="noreferrer"
                aria-label="Open the LinkedIn Data privacy settings screenshot"
              >
                <img
                  src={linkedInDataPrivacyScreenshot}
                  width="1194"
                  height="771"
                  loading="lazy"
                  decoding="async"
                  alt="LinkedIn Data privacy settings with Download your data highlighted"
                />
              </a>
            </figure>
          </article>
          <article>
            <div className="export-step-copy">
              <span>2</span>
              <div>
                <h3>Request the larger archive</h3>
                <p>
                  Select the larger data archive and click <strong>Request archive</strong>. LinkedIn will email you
                  when it is ready.
                </p>
              </div>
            </div>
            <figure>
              <a
                href={linkedInRequestArchiveScreenshot}
                target="_blank"
                rel="noreferrer"
                aria-label="Open the LinkedIn archive request screenshot"
              >
                <img
                  src={linkedInRequestArchiveScreenshot}
                  width="1194"
                  height="701"
                  loading="lazy"
                  decoding="async"
                  alt="LinkedIn Download my data page with the larger archive selected and a 24-hour estimate"
                />
              </a>
            </figure>
          </article>
        </div>
        <div className="export-notes">
          <article>
            <Clock3 size={21} />
            <div>
              <strong>Allow up to 24 hours.</strong>
              <p>
                LinkedIn may prepare a request in stages, so do not expect the complete archive immediately. If you
                receive multiple notifications, wait for the larger archive. Its download link is currently available
                for 72 hours.
              </p>
            </div>
          </article>
          <article>
            <ShieldCheck size={21} />
            <div>
              <strong>Keep a private backup.</strong>
              <p>
                Export periodically so you retain a snapshot you control if you ever lose access to your account. The
                ZIP contains sensitive personal data, so store it securely.
              </p>
            </div>
          </article>
        </div>
        <a className="export-help-link" href={LINKEDIN_DOWNLOAD_HELP_URL} target="_blank" rel="noreferrer">
          Read LinkedIn’s current download instructions <ArrowUpRight size={15} />
        </a>
      </section>

      <section className="showcase-section">
        <header>
          <h2>Tested on a real network, not only demo data.</h2>
          <p>
            These screenshots come from the creator’s own 1,660-connection export. Privacy mode keeps every identity,
            company, raw title, annotation, and message hidden.
          </p>
        </header>
        <figure className="showcase-primary">
          <a
            href={networkOverviewScreenshot}
            target="_blank"
            rel="noreferrer"
            aria-label="Open the real network overview screenshot"
          >
            <img
              src={networkOverviewScreenshot}
              width="1440"
              height="1024"
              loading="lazy"
              decoding="async"
              alt="Privacy-masked Common Ground workspace showing statistics from a real 1,660-connection network"
            />
          </a>
          <figcaption>
            <strong>Audit the whole network</strong>
            <span>
              1,660 identifiable connections, 8,774 archived messages, and relationship status in one workspace.
            </span>
          </figcaption>
        </figure>
        <div className="showcase-grid">
          <figure>
            <a
              href={foundersTwoWayScreenshot}
              target="_blank"
              rel="noreferrer"
              aria-label="Open the filtered founders screenshot"
            >
              <img
                src={foundersTwoWayScreenshot}
                width="1440"
                height="1024"
                loading="lazy"
                decoding="async"
                alt="Privacy-masked real network filtered to founders with two-way conversations"
              />
            </a>
            <figcaption>
              <strong>Turn a question into a shortlist</strong>
              <span>The real archive contains 140 founders with matched two-way conversation history.</span>
            </figcaption>
          </figure>
          <figure>
            <a
              href={relationshipDetailScreenshot}
              target="_blank"
              rel="noreferrer"
              aria-label="Open the private relationship detail screenshot"
            >
              <img
                src={relationshipDetailScreenshot}
                width="1440"
                height="1024"
                loading="lazy"
                decoding="async"
                alt="Privacy-masked relationship details showing message counts, direction, threads, and recency"
              />
            </a>
            <figcaption>
              <strong>Inspect the evidence safely</strong>
              <span>Relationship metrics remain useful while message content and personal context stay hidden.</span>
            </figcaption>
          </figure>
        </div>
      </section>
      <CreatorFooter />
    </main>
  )
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <span />
        <span />
      </span>
      <span>Common Ground</span>
    </div>
  )
}

function CreatorFooter() {
  return (
    <footer className="creator-footer">
      <div>
        <span className="creator-kicker">Made thoughtfully in Dubai</span>
        <strong>
          Built by{' '}
          <a href={CREATOR_LINKEDIN_URL} target="_blank" rel="noreferrer">
            Alexander Kadyrov
          </a>
        </strong>
        <small>Small, focused tools for messy real-world workflows.</small>
      </div>
      <nav aria-label="Creator links">
        <a href={CREATOR_GITHUB_URL} target="_blank" rel="noreferrer">
          <Code2 size={16} /> GitHub
        </a>
        <a className="creator-cta" href={CREATOR_LINKEDIN_URL} target="_blank" rel="noreferrer">
          <MessageCircle size={16} /> Discuss a project
        </a>
      </nav>
    </footer>
  )
}

export function Dashboard({ data, isDemo, onReset }: { data: ArchiveData; isDemo: boolean; onReset: () => void }) {
  const [privacyMode, setPrivacyMode] = useState(isDemo ? false : DEFAULT_PRIVACY_MODE)
  const [query, setQuery] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<Set<RoleFilterCategory>>(new Set())
  const [conversation, setConversation] = useState<ConversationFilter>('all')
  const [recency, setRecency] = useState<RecencyFilter>('all')
  const [messageDepth, setMessageDepth] = useState<MessageDepthFilter>('all')
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all')
  const [dubaiSignalsOnly, setDubaiSignalsOnly] = useState(false)
  const [sort, setSort] = useState<SortMode>('connected')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceFile>(() =>
    isDemo ? createDemoWorkspace(data) : loadWorkspace(data),
  )
  const [workspaceNotice, setWorkspaceNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const workspaceInputRef = useRef<HTMLInputElement>(null)
  const explorerRef = useRef<HTMLElement>(null)
  const referenceDate = useMemo(() => new Date(), [])

  const identifiable = useMemo(() => data.connections.filter((person) => person.isIdentifiable), [data])
  const privacyAliases = useMemo(() => createPrivacyAliases(identifiable), [identifiable])
  const conversationCounts = useMemo(() => conversationCountsFor(data), [data])
  const quickQuestionCounts = useMemo(
    () =>
      new Map(
        QUICK_QUESTIONS.map((question) => [question.id, countQuickQuestionMatches(data, question, referenceDate)]),
      ),
    [data, referenceDate],
  )
  const recencyCounts = useMemo(
    () =>
      new Map(
        RECENCY_FILTER_OPTIONS.map((option) => [
          option.value,
          identifiable.filter((person) => matchesRecencyFilter(statsFor(data, person.id), option.value, referenceDate))
            .length,
        ]),
      ),
    [data, identifiable, referenceDate],
  )
  const messageDepthCounts = useMemo(
    () =>
      new Map(
        MESSAGE_DEPTH_FILTER_OPTIONS.map((option) => [
          option.value,
          identifiable.filter((person) => matchesMessageDepthFilter(statsFor(data, person.id), option.value)).length,
        ]),
      ),
    [data, identifiable],
  )
  const cityOptions = useMemo(
    () =>
      [
        ...new Set(
          Object.values(workspace.people)
            .map((annotation) => annotation.location?.value.trim() ?? '')
            .filter(Boolean),
        ),
      ].sort(),
    [workspace],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    const people = identifiable.filter((person) => {
      const stats = statsFor(data, person.id)
      const annotation = workspace.people[person.id]
      const location = annotation?.location?.value.trim() ?? ''
      const presentation = personPresentation(person, privacyAliases, privacyMode)
      const searchValues = privacyMode
        ? [presentation.name, presentation.company, presentation.position, person.roles.join(' ')]
        : [
            person.fullName,
            person.company,
            person.position,
            location,
            annotation?.tags?.value.join(' ') ?? '',
            annotation?.notes?.value ?? '',
          ]
      const matchesQuery = !needle || searchValues.some((value) => value.toLocaleLowerCase().includes(needle))
      const matchesRole = matchesRoleFilters(person.roles, selectedRoles)
      const matchesConversation =
        conversation === 'all' || (conversation === 'any' ? stats.status !== 'none' : stats.status === conversation)
      const matchesRelationship = matchesRelationshipFilters(stats, recency, messageDepth, referenceDate)
      const matchesLocation =
        privacyMode ||
        locationFilter === 'all' ||
        (locationFilter === 'unknown' ? !location : location.toLocaleLowerCase() === locationFilter.toLocaleLowerCase())
      return (
        matchesQuery &&
        matchesRole &&
        matchesConversation &&
        matchesRelationship &&
        matchesLocation &&
        (privacyMode || !dubaiSignalsOnly || person.dubaiCompanySignal)
      )
    })

    return people.sort((a, b) => {
      if (sort === 'name') {
        return personPresentation(a, privacyAliases, privacyMode).name.localeCompare(
          personPresentation(b, privacyAliases, privacyMode).name,
        )
      }
      if (sort === 'messages') return statsFor(data, b.id).messageCount - statsFor(data, a.id).messageCount
      if (sort === 'contacted') {
        return (
          (statsFor(data, b.id).lastMessageAt?.valueOf() ?? 0) - (statsFor(data, a.id).lastMessageAt?.valueOf() ?? 0)
        )
      }
      return (b.connectedOn?.valueOf() ?? 0) - (a.connectedOn?.valueOf() ?? 0)
    })
  }, [
    conversation,
    data,
    dubaiSignalsOnly,
    identifiable,
    locationFilter,
    messageDepth,
    privacyAliases,
    privacyMode,
    query,
    recency,
    referenceDate,
    selectedRoles,
    sort,
    workspace,
  ])

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset pagination when any result-shaping control changes.
  useEffect(
    () => setVisibleCount(PAGE_SIZE),
    [query, selectedRoles, conversation, recency, messageDepth, locationFilter, dubaiSignalsOnly, sort],
  )

  const selected = selectedId ? (data.connections.find((person) => person.id === selectedId) ?? null) : null
  const founderCount = identifiable.filter((person) => person.roles.includes('Founder')).length
  const messagedCount = identifiable.filter((person) => statsFor(data, person.id).status !== 'none').length
  const twoWayCount = identifiable.filter((person) => statsFor(data, person.id).status === 'two-way').length
  const activeFilterCount =
    selectedRoles.size +
    (conversation === 'all' ? 0 : 1) +
    (recency === 'all' ? 0 : 1) +
    (messageDepth === 'all' ? 0 : 1) +
    (!privacyMode && locationFilter !== 'all' ? 1 : 0) +
    (!privacyMode && dubaiSignalsOnly ? 1 : 0)
  const activeQuickQuestion = QUICK_QUESTIONS.find(
    (question) =>
      !query &&
      locationFilter === 'all' &&
      !dubaiSignalsOnly &&
      conversation === question.conversation &&
      recency === question.recency &&
      messageDepth === question.messageDepth &&
      selectedRoles.size === question.roles.length &&
      question.roles.every((role) => selectedRoles.has(role)),
  )

  const togglePrivacyMode = () => {
    if (privacyMode) {
      if (!window.confirm('Turn off Privacy mode and show real names, companies, messages, and annotations?')) return
      setPrivacyMode(false)
      return
    }
    setPrivacyMode(true)
    setQuery('')
    setLocationFilter('all')
    setDubaiSignalsOnly(false)
    setSort('connected')
  }

  const persistWorkspace = (next: WorkspaceFile) => {
    setWorkspace(next)
    if (!isDemo) localStorage.setItem(WORKSPACE_STORAGE_KEY, serializeWorkspace(next))
  }

  const updateAnnotation = (id: string, draft: AnnotationDraft) => {
    const next = updatePersonAnnotation(workspace, id, draft)
    persistWorkspace(next)
    setWorkspaceNotice({
      tone: 'success',
      message: isDemo ? 'Annotation saved for this demo session.' : 'Annotation saved locally.',
    })
  }

  const importWorkspace = async (file?: File) => {
    if (!file) return
    try {
      const imported = parseWorkspaceFile(await file.text())
      const next = mergeWorkspaces(workspace, imported, data)
      persistWorkspace(next)
      setWorkspaceNotice({
        tone: 'success',
        message: `Workspace imported with ${countAnnotations(imported).toLocaleString()} annotated people.`,
      })
    } catch (cause) {
      setWorkspaceNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'The workspace could not be imported.',
      })
    } finally {
      if (workspaceInputRef.current) workspaceInputRef.current.value = ''
    }
  }

  const clearWorkspace = () => {
    const warning = isDemo
      ? 'Clear all locations, tags, and notes from this demo session?'
      : 'Clear all locations, tags, and notes saved in this browser? Export the workspace first if you need a backup.'
    if (!window.confirm(warning)) return
    const next = createWorkspace(data)
    persistWorkspace(next)
    setWorkspaceNotice({
      tone: 'success',
      message: isDemo ? 'Demo annotations cleared for this session.' : 'Local annotations cleared.',
    })
  }

  const clearFilters = () => {
    setQuery('')
    setSelectedRoles(new Set())
    setConversation('all')
    setRecency('all')
    setMessageDepth('all')
    setLocationFilter('all')
    setDubaiSignalsOnly(false)
  }

  const showExplorer = () => {
    window.requestAnimationFrame(() => explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const applyQuickQuestion = (question: QuickQuestion) => {
    if (activeQuickQuestion?.id === question.id) {
      clearFilters()
      showExplorer()
      return
    }

    setQuery('')
    setSelectedRoles(new Set(question.roles))
    setConversation(question.conversation)
    setRecency(question.recency)
    setMessageDepth(question.messageDepth)
    setLocationFilter('all')
    setDubaiSignalsOnly(false)
    setSort(question.sort)
    setFiltersOpen(false)
    showExplorer()
  }

  return (
    <div className="app-shell">
      <header className={`app-header ${privacyMode ? 'privacy-active' : ''}`}>
        <div className="app-header-frame">
          <div className="header-identity">
            <Brand />
            <span className="local-status">
              <span /> Local session
            </span>
            {isDemo && (
              <span className="demo-status">
                <Sparkles size={13} /> Demo data
              </span>
            )}
          </div>
          <div className="header-actions">
            <button
              type="button"
              className={`privacy-toggle ${privacyMode ? 'active' : ''}`}
              onClick={togglePrivacyMode}
              aria-pressed={privacyMode}
            >
              {privacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
              {privacyMode ? 'Privacy on' : 'Privacy mode'}
            </button>
            <details className="workspace-menu">
              <summary>
                <StickyNote size={16} /> <span className="workspace-label">Workspace</span>
                {countAnnotations(workspace) > 0 && (
                  <span className="workspace-count">{countAnnotations(workspace)}</span>
                )}
                <ChevronDown size={13} />
              </summary>
              <div className="workspace-menu-panel">
                <button type="button" onClick={() => downloadWorkspace(workspace)}>
                  <FileDown size={16} />
                  <span>
                    <strong>Export workspace</strong>
                    <small>Download annotations as JSON</small>
                  </span>
                </button>
                <button type="button" onClick={() => workspaceInputRef.current?.click()}>
                  <FileUp size={16} />
                  <span>
                    <strong>Import workspace</strong>
                    <small>Restore or merge a backup</small>
                  </span>
                </button>
                <button type="button" className="danger" onClick={clearWorkspace}>
                  <Trash2 size={16} />
                  <span>
                    <strong>Clear annotations</strong>
                    <small>Remove local locations, tags, and notes</small>
                  </span>
                </button>
              </div>
            </details>
            <input
              ref={workspaceInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => void importWorkspace(event.target.files?.[0])}
            />
            <button type="button" className="quiet-button close-archive" onClick={onReset}>
              <ArrowLeft size={16} /> {isDemo ? 'Close demo' : 'Close archive'}
            </button>
          </div>
        </div>
      </header>

      {workspaceNotice && (
        <div className={`workspace-notice ${workspaceNotice.tone}`}>
          {workspaceNotice.tone === 'success' ? <Check size={16} /> : <CircleAlert size={16} />}
          <span>{workspaceNotice.message}</span>
          <button type="button" onClick={() => setWorkspaceNotice(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {privacyMode && (
        <div className="privacy-watermark">
          <ShieldCheck size={15} /> Privacy mode · display data is masked
        </div>
      )}
      {isDemo && (
        <div className="demo-watermark">
          <Sparkles size={14} /> Fictional demo data
        </div>
      )}

      <main className="dashboard">
        <section className="dashboard-heading">
          <div>
            <p className="overline">Relationship workspace</p>
            <h1>Your network at a glance</h1>
            <p>
              {isDemo
                ? `${identifiable.length.toLocaleString()} fictional connections created to explore every feature safely.`
                : `${identifiable.length.toLocaleString()} identifiable connections, current through this export.`}
            </p>
          </div>
          <div className={`archive-chip ${isDemo ? 'is-demo' : ''}`}>
            {isDemo ? <Sparkles size={17} /> : <ContactRound size={17} />}
            {isDemo
              ? 'Curated demo workspace'
              : `${data.archiveFilesUsed.length} relevant files used · ${data.archiveFileCount} present`}
          </div>
        </section>

        <section className="stats-grid">
          <StatCard
            icon={<Users />}
            value={identifiable.length}
            label="Connections"
            detail={`${data.unavailableConnectionCount} unavailable profiles omitted`}
          />
          <StatCard
            icon={<BriefcaseBusiness />}
            value={founderCount}
            label="Founders"
            detail="Multi-label title matching"
            tone="gold"
          />
          <StatCard
            icon={<MessageCircle />}
            value={messagedCount}
            label="With messages"
            detail={`${data.messageCount.toLocaleString()} messages in archive`}
            tone="blue"
          />
          <StatCard icon={<Inbox />} value={twoWayCount} label="Two-way" detail="Both sent and received" tone="green" />
        </section>

        <section className="quick-questions" aria-labelledby="quick-questions-heading">
          <header>
            <div>
              <h2 id="quick-questions-heading">Start with a useful question</h2>
              <p>Each shortcut applies ordinary filters you can inspect, change, or clear.</p>
            </div>
          </header>
          <div className="quick-question-grid">
            {QUICK_QUESTIONS.map((question) => {
              const active = activeQuickQuestion?.id === question.id
              return (
                <button
                  type="button"
                  key={question.id}
                  className={active ? 'active' : ''}
                  aria-pressed={active}
                  onClick={() => applyQuickQuestion(question)}
                >
                  <span className="quick-question-copy">
                    <strong>{question.title}</strong>
                    <small>{question.filterSummary}</small>
                  </span>
                  <span className="quick-question-result">
                    <strong>{quickQuestionCounts.get(question.id)?.toLocaleString() ?? '0'}</strong>
                    <small>people</small>
                  </span>
                  <ArrowUpRight size={17} aria-hidden="true" />
                </button>
              )
            })}
          </div>
        </section>

        <section className="location-notice">
          <div className="notice-icon">
            <MapPin size={20} />
          </div>
          <div>
            <strong>
              {privacyMode
                ? 'Privacy mode masks display and search.'
                : isDemo
                  ? 'Demo locations are manual annotations.'
                  : 'LinkedIn did not include connection locations.'}
            </strong>
            <span>
              {privacyMode
                ? 'Search uses masked aliases and normalized roles only. Turn off Privacy mode to search real names, companies, locations, tags, or notes. Source files and workspace data are unchanged.'
                : isDemo
                  ? 'They illustrate context you can add yourself; LinkedIn does not supply locations for connections in this export.'
                  : 'Add a city when reviewing a person. Company-name hints are available separately and are never treated as locations.'}
            </span>
          </div>
          {!privacyMode && (
            <button
              type="button"
              onClick={() => setDubaiSignalsOnly((current) => !current)}
              className={dubaiSignalsOnly ? 'is-active' : ''}
            >
              {dubaiSignalsOnly && <Check size={14} />} Dubai company hints
            </button>
          )}
        </section>

        <section className="explorer" ref={explorerRef}>
          <aside className={`filter-panel ${filtersOpen ? 'mobile-open' : ''}`}>
            <div className="filter-panel-heading">
              <span>
                <SlidersHorizontal size={16} />
                <strong>Filters</strong>
              </span>
              {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
            </div>
            <div className="filter-mobile-title">
              <strong>Filters</strong>
              <button type="button" onClick={() => setFiltersOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <FilterSection title="Roles">
              <div className="role-filter-list">
                {ROLE_FILTER_CATEGORIES.map((role) => {
                  const active = selectedRoles.has(role)
                  const count = identifiable.filter((person) =>
                    role === 'Other' ? person.roles.length === 0 : person.roles.includes(role),
                  ).length
                  return (
                    <button
                      type="button"
                      key={role}
                      className={active ? 'active' : ''}
                      onClick={() => {
                        const next = new Set(selectedRoles)
                        if (active) next.delete(role)
                        else next.add(role)
                        setSelectedRoles(next)
                      }}
                    >
                      <span>{role}</span>
                      <span>{count}</span>
                    </button>
                  )
                })}
              </div>
            </FilterSection>

            <FilterSection title="Conversation">
              <div className="radio-list">
                {conversationFilterOptions.map(([value, label]) => (
                  <label key={value} aria-label={`${label}: ${conversationCounts[value].toLocaleString()}`}>
                    <input type="radio" checked={conversation === value} onChange={() => setConversation(value)} />
                    <span className="custom-radio" />
                    <span className="radio-option-label">{label}</span>
                    <span className="radio-option-count">{conversationCounts[value].toLocaleString()}</span>
                  </label>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Last contact">
              <div className="select-wrap">
                <Clock3 size={15} />
                <select
                  aria-label="Last contact"
                  value={recency}
                  onChange={(event) => setRecency(event.target.value as RecencyFilter)}
                >
                  {RECENCY_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} · {recencyCounts.get(option.value)?.toLocaleString() ?? '0'}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </FilterSection>

            <FilterSection title="Message depth">
              <div className="select-wrap">
                <MessageCircle size={15} />
                <select
                  aria-label="Message depth"
                  value={messageDepth}
                  onChange={(event) => setMessageDepth(event.target.value as MessageDepthFilter)}
                >
                  {MESSAGE_DEPTH_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} · {messageDepthCounts.get(option.value)?.toLocaleString() ?? '0'}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </FilterSection>

            <FilterSection title="Location annotation">
              {privacyMode ? (
                <div className="privacy-filter-note">
                  <EyeOff size={14} /> Hidden in Privacy mode
                </div>
              ) : (
                <div className="select-wrap">
                  <MapPin size={15} />
                  <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
                    <option value="all">All locations</option>
                    <option value="unknown">Not annotated</option>
                    {cityOptions.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
              )}
            </FilterSection>

            {activeFilterCount > 0 && (
              <button type="button" className="clear-filter" onClick={clearFilters}>
                Clear {activeFilterCount} filters
              </button>
            )}
          </aside>

          <div className="results-panel">
            <div className="results-heading">
              <div>
                <p className="overline">Network explorer</p>
                <h2>Connections</h2>
              </div>
              <span>
                <strong>{filtered.length.toLocaleString()}</strong> of {identifiable.length.toLocaleString()}
              </span>
            </div>
            <div className="toolbar">
              <label className="search-box">
                <Search size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    privacyMode ? 'Search aliases or normalized roles' : 'Search person, company, role, or city'
                  }
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')}>
                    <X size={15} />
                  </button>
                )}
              </label>
              <button type="button" className="mobile-filter-button" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal size={17} /> Filters {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
              </button>
              <label className="sort-control">
                <ArrowDownUp size={16} />
                <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
                  <option value="connected">Recently connected</option>
                  <option value="contacted">Recently contacted</option>
                  <option value="messages">Most messages</option>
                  <option value="name">Name A–Z</option>
                </select>
                <ChevronDown size={14} />
              </label>
            </div>

            {activeFilterCount > 0 && (
              <fieldset className="active-filters" aria-label="Active filters">
                <span className="active-filters-label">Active</span>
                {[...selectedRoles].map((role) => (
                  <button
                    type="button"
                    key={role}
                    onClick={() => {
                      const next = new Set(selectedRoles)
                      next.delete(role)
                      setSelectedRoles(next)
                    }}
                  >
                    {role}
                    <X size={12} />
                  </button>
                ))}
                {conversation !== 'all' && (
                  <button type="button" onClick={() => setConversation('all')}>
                    {conversationFilterLabels[conversation]}
                    <X size={12} />
                  </button>
                )}
                {recency !== 'all' && (
                  <button type="button" onClick={() => setRecency('all')}>
                    {RECENCY_FILTER_LABELS[recency]}
                    <X size={12} />
                  </button>
                )}
                {messageDepth !== 'all' && (
                  <button type="button" onClick={() => setMessageDepth('all')}>
                    {MESSAGE_DEPTH_FILTER_LABELS[messageDepth]}
                    <X size={12} />
                  </button>
                )}
                {!privacyMode && locationFilter !== 'all' && (
                  <button type="button" onClick={() => setLocationFilter('all')}>
                    {locationFilter === 'unknown' ? 'Location: Not annotated' : `Location: ${locationFilter}`}
                    <X size={12} />
                  </button>
                )}
                {!privacyMode && dubaiSignalsOnly && (
                  <button type="button" onClick={() => setDubaiSignalsOnly(false)}>
                    Dubai company hints
                    <X size={12} />
                  </button>
                )}
                <button type="button" className="clear-all-filters" onClick={clearFilters}>
                  Clear all
                </button>
              </fieldset>
            )}

            <div className="people-list">
              <div className="people-head">
                <span>Person</span>
                <span>Role</span>
                <span>Relationship</span>
                <span>Connected</span>
              </div>
              {filtered.slice(0, visibleCount).map((person) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  data={data}
                  annotation={workspace.people[person.id]}
                  privacyMode={privacyMode}
                  privacyAliases={privacyAliases}
                  onClick={() => setSelectedId(person.id)}
                />
              ))}
              {filtered.length === 0 && (
                <div className="empty-results">
                  <span className="empty-results-icon">
                    <Search size={23} />
                  </span>
                  <strong>No people match this view</strong>
                  <span>Try removing a filter or broadening your search.</span>
                  <button type="button" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              )}
            </div>

            {visibleCount < filtered.length && (
              <button type="button" className="load-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
              </button>
            )}
          </div>
        </section>
      </main>

      <CreatorFooter />

      {selected && (
        <PersonDrawer
          key={selected.id}
          person={selected}
          data={data}
          annotation={workspace.people[selected.id]}
          privacyMode={privacyMode}
          privacyAliases={privacyAliases}
          onAnnotationChange={(draft) => updateAnnotation(selected.id, draft)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

function StatCard({
  icon,
  value,
  label,
  detail,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  value: number
  label: string
  detail: string
  tone?: string
}) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div>
        <span className="stat-value">{value.toLocaleString()}</span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="filter-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export function PersonRow({
  person,
  data,
  annotation,
  privacyMode,
  privacyAliases,
  onClick,
}: {
  person: Connection
  data: ArchiveData
  annotation?: PersonAnnotation
  privacyMode: boolean
  privacyAliases: PrivacyAliases
  onClick: () => void
}) {
  const stats = statsFor(data, person.id)
  const location = annotation?.location?.value
  const presentation = personPresentation(person, privacyAliases, privacyMode)
  return (
    <button type="button" className="person-row" onClick={onClick}>
      <span className="person-cell">
        <span className="avatar">{presentation.avatar}</span>
        <span className="person-name">
          <strong>{presentation.name}</strong>
          <small>
            <Building2 size={13} /> {presentation.company}
          </small>
        </span>
      </span>
      <span className="role-cell">
        <strong>{presentation.position}</strong>
        <span className="tag-row">
          {person.roles.slice(0, 2).map((role) => (
            <span className="role-tag" key={role}>
              {role}
            </span>
          ))}
          {annotation?.tags?.value.length ? (
            <span className="personal-tag">{privacyMode ? 'Private tag' : annotation.tags.value[0]}</span>
          ) : null}
          {location && (
            <span className="location-tag">
              <MapPin size={11} /> {privacyMode ? 'Location hidden' : location}
            </span>
          )}
          {!privacyMode && !location && person.dubaiCompanySignal && (
            <span className="hint-tag">Dubai company hint</span>
          )}
        </span>
      </span>
      <span className="relationship-cell">
        <span className={`status-dot status-${stats.status}`} />
        <span>
          <strong>{conversationLabels[stats.status]}</strong>
          <small>
            {stats.messageCount
              ? `${stats.messageCount} messages · ${formatDate(stats.lastMessageAt)}`
              : 'No URL match in archive'}
          </small>
        </span>
      </span>
      <span className="date-cell">{formatDate(person.connectedOn, person.connectedOnRaw)}</span>
      <span className="row-arrow">›</span>
    </button>
  )
}

export function PersonDrawer({
  person,
  data,
  annotation,
  privacyMode,
  privacyAliases,
  onAnnotationChange,
  onClose,
}: {
  person: Connection
  data: ArchiveData
  annotation?: PersonAnnotation
  privacyMode: boolean
  privacyAliases: PrivacyAliases
  onAnnotationChange: (draft: AnnotationDraft) => void
  onClose: () => void
}) {
  const stats = statsFor(data, person.id)
  const messages = data.messagesByPerson.get(person.id) ?? []
  const location = annotation?.location?.value ?? ''
  const tags = annotation?.tags?.value ?? []
  const notes = annotation?.notes?.value ?? ''
  const [draftLocation, setDraftLocation] = useState(location)
  const [draftTags, setDraftTags] = useState(tags.join(', '))
  const [draftNotes, setDraftNotes] = useState(notes)
  const [messageLimit, setMessageLimit] = useState(8)
  const presentation = personPresentation(person, privacyAliases, privacyMode)
  const externalUrl = privacyMode ? '' : linkedInUrl(person.profileUrl)
  const parsedDraftTags = [
    ...new Set(
      draftTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ]
  const annotationDates = [
    annotation?.location?.updatedAt,
    annotation?.tags?.updatedAt,
    annotation?.notes?.updatedAt,
  ].filter((value): value is string => Boolean(value))
  const annotationUpdatedAt = annotationDates.length
    ? new Date(Math.max(...annotationDates.map((value) => Date.parse(value))))
    : null
  const annotationChanged =
    draftLocation.trim() !== location || parsedDraftTags.join('|') !== tags.join('|') || draftNotes.trim() !== notes

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return (
    <div className="drawer-layer">
      <button type="button" className="drawer-backdrop" onClick={onClose} aria-label="Close relationship details" />
      <aside className="person-drawer" role="dialog" aria-modal="true" aria-label={`${presentation.name} details`}>
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
          <X size={19} />
        </button>
        <div className="drawer-profile">
          <div className="avatar avatar-large">{presentation.avatar}</div>
          <div>
            <p className="overline">Connection</p>
            <h2>{presentation.name}</h2>
            <p>
              {presentation.position}
              {presentation.company !== 'Company unavailable' ? ` at ${presentation.company}` : ''}
            </p>
          </div>
        </div>
        <div className="drawer-tags">
          {person.roles.map((role) => (
            <span className="role-tag" key={role}>
              {role}
            </span>
          ))}
          {privacyMode && annotation && <span className="personal-tag">Private annotations hidden</span>}
          {!privacyMode && person.dubaiCompanySignal && <span className="hint-tag">Company mentions Dubai</span>}
        </div>
        <div className="drawer-actions">
          {externalUrl && (
            <a href={externalUrl} target="_blank" rel="noreferrer">
              Open LinkedIn <ArrowUpRight size={15} />
            </a>
          )}
          <span>
            <CalendarDays size={15} /> Connected {formatDate(person.connectedOn, person.connectedOnRaw)}
          </span>
        </div>

        {privacyMode ? (
          <section className="privacy-redaction-card">
            <EyeOff size={20} />
            <div>
              <strong>Annotations hidden</strong>
              <span>Locations, tags, and notes are not rendered while Privacy mode is active.</span>
            </div>
          </section>
        ) : (
          <section className="context-editor">
            <div className="context-editor-heading">
              <StickyNote size={18} />
              <span>
                <strong>Your context</strong>
                <small>Saved locally and included in workspace exports.</small>
              </span>
            </div>
            <div className="context-fields">
              <label>
                <span>
                  <MapPin size={13} /> Location
                </span>
                <input
                  value={draftLocation}
                  onChange={(event) => setDraftLocation(event.target.value)}
                  placeholder="e.g. Dubai"
                />
              </label>
              <label>
                <span>
                  <Tags size={13} /> Tags
                </span>
                <input
                  value={draftTags}
                  onChange={(event) => setDraftTags(event.target.value)}
                  placeholder="investor, fintech, met at GITEX"
                />
              </label>
              <label>
                <span>Notes</span>
                <textarea
                  value={draftNotes}
                  onChange={(event) => setDraftNotes(event.target.value)}
                  placeholder="Private notes about this relationship…"
                  rows={3}
                />
              </label>
            </div>
            <div className="context-editor-footer">
              <small>
                {annotationUpdatedAt ? `Last updated ${formatDate(annotationUpdatedAt)}` : 'No annotation yet'}
              </small>
              <button
                type="button"
                onClick={() =>
                  onAnnotationChange({ location: draftLocation, tags: parsedDraftTags, notes: draftNotes })
                }
                disabled={!annotationChanged}
              >
                <Check size={15} /> Save annotation
              </button>
            </div>
          </section>
        )}

        <section className="conversation-section">
          <div className="section-title-row">
            <div>
              <p className="overline">Conversation</p>
              <h3>{conversationLabels[stats.status]}</h3>
            </div>
            {stats.messageCount > 0 && (
              <span className={`conversation-badge status-${stats.status}`}>{stats.messageCount} messages</span>
            )}
          </div>
          {stats.messageCount > 0 ? (
            <>
              <div className="conversation-metrics">
                <div>
                  <strong>{stats.sentCount}</strong>
                  <span>Sent</span>
                </div>
                <div>
                  <strong>{stats.receivedCount}</strong>
                  <span>Received</span>
                </div>
                <div>
                  <strong>{stats.conversationCount}</strong>
                  <span>Threads</span>
                </div>
                <div>
                  <strong>{formatDate(stats.lastMessageAt)}</strong>
                  <span>Last contact</span>
                </div>
              </div>
              <div className="message-list">
                {messages.slice(0, messageLimit).map((message, index) => (
                  <article
                    className={`message-card ${message.direction}`}
                    // biome-ignore lint/suspicious/noArrayIndexKey: LinkedIn messages have no unique ID; the index disambiguates identical exported rows.
                    key={`${message.conversationId}-${message.dateRaw}-${index}`}
                  >
                    <header>
                      <strong>{message.direction === 'sent' ? 'You' : presentation.name}</strong>
                      <time>{formatDate(message.date)}</time>
                    </header>
                    {!privacyMode && message.subject && <b>{message.subject}</b>}
                    <p>
                      {privacyMode
                        ? 'Message content hidden in Privacy mode.'
                        : message.content || 'Attachment or empty message'}
                    </p>
                    {!privacyMode && message.attachmentUrl.startsWith('https://') && (
                      <a href={message.attachmentUrl} target="_blank" rel="noreferrer">
                        Attachment link <ArrowUpRight size={12} />
                      </a>
                    )}
                  </article>
                ))}
              </div>
              {messageLimit < messages.length && (
                <button type="button" className="show-messages" onClick={() => setMessageLimit((value) => value + 20)}>
                  Show earlier messages
                </button>
              )}
            </>
          ) : (
            <div className="no-conversation">
              <MessageCircle size={23} />
              <strong>No conversation found</strong>
              <span>
                This means no matching profile URL appeared in the exported message history. It is not proof that you
                have never spoken elsewhere.
              </span>
            </div>
          )}
        </section>
      </aside>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<{ data: ArchiveData; isDemo: boolean } | null>(null)

  return session ? (
    <Dashboard data={session.data} isDemo={session.isDemo} onReset={() => setSession(null)} />
  ) : (
    <ImportScreen
      onImport={async (file) =>
        setSession({
          data: await parseLinkedInArchive(await file.arrayBuffer(), file.name),
          isDemo: false,
        })
      }
      onDemo={() => setSession({ data: createDemoData(), isDemo: true })}
    />
  )
}
