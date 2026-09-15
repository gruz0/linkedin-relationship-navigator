import { useEffect, useMemo, useRef, useState } from 'react'
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
  ContactRound,
  Download,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  Users,
  X,
} from 'lucide-react'
import {
  ROLE_CATEGORIES,
  type ArchiveData,
  type Connection,
  type ConversationStatus,
  type RoleCategory,
  parseLinkedInArchive,
  statsFor,
} from './data'

const LOCATION_STORAGE_KEY = 'common-ground.locations.v1'
const PAGE_SIZE = 60

type LocationMap = Record<string, string>
type ConversationFilter = ConversationStatus | 'all' | 'any'
type LocationFilter = 'all' | 'unknown' | string
type SortMode = 'connected' | 'contacted' | 'messages' | 'name'

const conversationLabels: Record<ConversationStatus, string> = {
  'two-way': 'Two-way',
  outbound: 'Outbound only',
  inbound: 'Inbound only',
  none: 'No messages found',
}

function loadLocations(): LocationMap {
  try {
    return JSON.parse(localStorage.getItem(LOCATION_STORAGE_KEY) ?? '{}') as LocationMap
  } catch {
    return {}
  }
}

function formatDate(date: Date | null, fallback = '—') {
  if (!date) return fallback
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function initials(person: Connection) {
  const value = `${person.firstName[0] ?? ''}${person.lastName[0] ?? ''}`.toUpperCase()
  return value || '?'
}

function linkedInUrl(profileUrl: string) {
  return /^linkedin\.com\/in\/[a-z0-9_%.-]+$/i.test(profileUrl) ? `https://www.${profileUrl}` : ''
}

function ImportScreen({ onImport }: { onImport: (file: File) => Promise<void> }) {
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
        <Brand />
        <span className="privacy-pill"><LockKeyhole size={14} /> Your data stays here</span>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} /> Your network, made useful</div>
          <h1>Find the people already in your corner.</h1>
          <p>
            Turn your LinkedIn export into a private relationship workspace. Find founders, see who replied,
            and pick up conversations worth continuing.
          </p>
          <div className="trust-row">
            <div><Check size={16} /><span><strong>Browser only</strong>No uploads</span></div>
            <div><Check size={16} /><span><strong>Readable answers</strong>Not another spreadsheet</span></div>
            <div><Check size={16} /><span><strong>Under your control</strong>Clear it anytime</span></div>
          </div>
        </div>

        <div
          className={`drop-card ${dragging ? 'is-dragging' : ''}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => { event.preventDefault(); setDragging(false) }}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void load(event.dataTransfer.files[0])
          }}
        >
          <div className="upload-icon"><UploadCloud size={28} /></div>
          <h2>{loading ? 'Reading your archive…' : 'Open your LinkedIn export'}</h2>
          <p>Choose the complete ZIP you downloaded from LinkedIn.</p>
          <button className="primary-button" onClick={() => inputRef.current?.click()} disabled={loading}>
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
          {error && <div className="import-error"><CircleAlert size={16} /> {error}</div>}
        </div>
      </section>

      <section className="preview-strip">
        <div className="preview-card"><Users size={21} /><span><strong>People</strong>Role, company, connection date</span></div>
        <div className="preview-card"><MessageCircle size={21} /><span><strong>Conversations</strong>Replies, recency, message history</span></div>
        <div className="preview-card"><MapPin size={21} /><span><strong>Locations</strong>Add the missing context yourself</span></div>
      </section>
    </main>
  )
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark"><span /><span /></span>
      <span>Common Ground</span>
    </div>
  )
}

function Dashboard({ data, onReset }: { data: ArchiveData; onReset: () => void }) {
  const [query, setQuery] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<Set<RoleCategory>>(new Set())
  const [conversation, setConversation] = useState<ConversationFilter>('all')
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all')
  const [dubaiSignalsOnly, setDubaiSignalsOnly] = useState(false)
  const [sort, setSort] = useState<SortMode>('connected')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [locations, setLocations] = useState<LocationMap>(loadLocations)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const identifiable = useMemo(() => data.connections.filter((person) => person.isIdentifiable), [data])
  const cityOptions = useMemo(
    () => [...new Set(Object.values(locations).map((value) => value.trim()).filter(Boolean))].sort(),
    [locations],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    const people = identifiable.filter((person) => {
      const stats = statsFor(data, person.id)
      const location = locations[person.id]?.trim() ?? ''
      const matchesQuery = !needle || [person.fullName, person.company, person.position, location]
        .some((value) => value.toLocaleLowerCase().includes(needle))
      const matchesRole = selectedRoles.size === 0 || person.roles.some((role) => selectedRoles.has(role))
      const matchesConversation = conversation === 'all'
        || (conversation === 'any' ? stats.status !== 'none' : stats.status === conversation)
      const matchesLocation = locationFilter === 'all'
        || (locationFilter === 'unknown' ? !location : location.toLocaleLowerCase() === locationFilter.toLocaleLowerCase())
      return matchesQuery && matchesRole && matchesConversation && matchesLocation
        && (!dubaiSignalsOnly || person.dubaiCompanySignal)
    })

    return people.sort((a, b) => {
      if (sort === 'name') return a.fullName.localeCompare(b.fullName)
      if (sort === 'messages') return statsFor(data, b.id).messageCount - statsFor(data, a.id).messageCount
      if (sort === 'contacted') {
        return (statsFor(data, b.id).lastMessageAt?.valueOf() ?? 0) - (statsFor(data, a.id).lastMessageAt?.valueOf() ?? 0)
      }
      return (b.connectedOn?.valueOf() ?? 0) - (a.connectedOn?.valueOf() ?? 0)
    })
  }, [conversation, data, dubaiSignalsOnly, identifiable, locationFilter, locations, query, selectedRoles, sort])

  useEffect(() => setVisibleCount(PAGE_SIZE), [query, selectedRoles, conversation, locationFilter, dubaiSignalsOnly, sort])

  const selected = selectedId ? data.connections.find((person) => person.id === selectedId) ?? null : null
  const founderCount = identifiable.filter((person) => person.roles.includes('Founder')).length
  const messagedCount = identifiable.filter((person) => statsFor(data, person.id).status !== 'none').length
  const twoWayCount = identifiable.filter((person) => statsFor(data, person.id).status === 'two-way').length
  const activeFilterCount = selectedRoles.size + (conversation === 'all' ? 0 : 1)
    + (locationFilter === 'all' ? 0 : 1) + (dubaiSignalsOnly ? 1 : 0)

  const updateLocation = (id: string, value: string) => {
    const next = { ...locations }
    if (value.trim()) next[id] = value.trim()
    else delete next[id]
    setLocations(next)
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next))
  }

  const clearFilters = () => {
    setQuery('')
    setSelectedRoles(new Set())
    setConversation('all')
    setLocationFilter('all')
    setDubaiSignalsOnly(false)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Brand />
        <div className="header-actions">
          <span className="local-status"><span /> Local session</span>
          <button className="quiet-button" onClick={onReset}><ArrowLeft size={16} /> Close archive</button>
        </div>
      </header>

      <main className="dashboard">
        <section className="dashboard-heading">
          <div>
            <p className="overline">Relationship workspace</p>
            <h1>Your network at a glance</h1>
            <p>{identifiable.length.toLocaleString()} identifiable connections, current through this export.</p>
          </div>
          <div className="archive-chip"><ContactRound size={17} /> {data.archiveFileCount} export files read</div>
        </section>

        <section className="stats-grid">
          <StatCard icon={<Users />} value={identifiable.length} label="Connections" detail={`${data.unavailableConnectionCount} unavailable profiles omitted`} />
          <StatCard icon={<BriefcaseBusiness />} value={founderCount} label="Founders" detail="Multi-label title matching" tone="gold" />
          <StatCard icon={<MessageCircle />} value={messagedCount} label="With messages" detail={`${data.messageCount.toLocaleString()} messages in archive`} tone="blue" />
          <StatCard icon={<Inbox />} value={twoWayCount} label="Two-way" detail="Both sent and received" tone="green" />
        </section>

        <section className="location-notice">
          <div className="notice-icon"><MapPin size={20} /></div>
          <div>
            <strong>LinkedIn did not include connection locations.</strong>
            <span>Add a city when reviewing a person. Company-name hints are available separately and are never treated as locations.</span>
          </div>
          <button onClick={() => setDubaiSignalsOnly((current) => !current)} className={dubaiSignalsOnly ? 'is-active' : ''}>
            {dubaiSignalsOnly && <Check size={14} />} Dubai company hints
          </button>
        </section>

        <section className="explorer">
          <aside className={`filter-panel ${filtersOpen ? 'mobile-open' : ''}`}>
            <div className="filter-mobile-title">
              <strong>Filters</strong><button onClick={() => setFiltersOpen(false)}><X size={18} /></button>
            </div>
            <FilterSection title="Roles">
              <div className="role-filter-list">
                {ROLE_CATEGORIES.map((role) => {
                  const active = selectedRoles.has(role)
                  const count = identifiable.filter((person) => person.roles.includes(role)).length
                  return (
                    <button
                      key={role}
                      className={active ? 'active' : ''}
                      onClick={() => {
                        const next = new Set(selectedRoles)
                        if (active) next.delete(role); else next.add(role)
                        setSelectedRoles(next)
                      }}
                    >
                      <span>{role}</span><span>{count}</span>
                    </button>
                  )
                })}
              </div>
            </FilterSection>

            <FilterSection title="Conversation">
              <div className="radio-list">
                {([
                  ['all', 'All connections'],
                  ['any', 'Any message'],
                  ['two-way', 'Two-way'],
                  ['outbound', 'Outbound only'],
                  ['inbound', 'Inbound only'],
                  ['none', 'No messages found'],
                ] as Array<[ConversationFilter, string]>).map(([value, label]) => (
                  <label key={value}>
                    <input type="radio" checked={conversation === value} onChange={() => setConversation(value)} />
                    <span className="custom-radio" /> {label}
                  </label>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Location annotation">
              <div className="select-wrap">
                <MapPin size={15} />
                <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
                  <option value="all">All locations</option>
                  <option value="unknown">Not annotated</option>
                  {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
            </FilterSection>

            {activeFilterCount > 0 && <button className="clear-filter" onClick={clearFilters}>Clear {activeFilterCount} filters</button>}
          </aside>

          <div className="results-panel">
            <div className="toolbar">
              <label className="search-box">
                <Search size={18} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search person, company, role, or city" />
                {query && <button onClick={() => setQuery('')}><X size={15} /></button>}
              </label>
              <button className="mobile-filter-button" onClick={() => setFiltersOpen(true)}>
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

            <div className="result-summary">
              <span><strong>{filtered.length.toLocaleString()}</strong> people</span>
              {selectedRoles.size > 0 && <span className="summary-tag">{[...selectedRoles].join(' · ')}</span>}
            </div>

            <div className="people-list">
              <div className="people-head">
                <span>Person</span><span>Role</span><span>Relationship</span><span>Connected</span>
              </div>
              {filtered.slice(0, visibleCount).map((person) => (
                <PersonRow key={person.id} person={person} data={data} location={locations[person.id]} onClick={() => setSelectedId(person.id)} />
              ))}
              {filtered.length === 0 && (
                <div className="empty-results">
                  <Search size={24} /><strong>No people match these filters</strong><span>Try clearing a role or broadening your search.</span>
                  <button onClick={clearFilters}>Clear filters</button>
                </div>
              )}
            </div>

            {visibleCount < filtered.length && (
              <button className="load-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
              </button>
            )}
          </div>
        </section>
      </main>

      {selected && (
        <PersonDrawer
          person={selected}
          data={data}
          location={locations[selected.id] ?? ''}
          onLocationChange={(value) => updateLocation(selected.id, value)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

function StatCard({ icon, value, label, detail, tone = 'neutral' }: { icon: React.ReactNode; value: number; label: string; detail: string; tone?: string }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div><span className="stat-value">{value.toLocaleString()}</span><strong>{label}</strong><small>{detail}</small></div>
    </article>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="filter-section"><h3>{title}</h3>{children}</section>
}

function PersonRow({ person, data, location, onClick }: { person: Connection; data: ArchiveData; location?: string; onClick: () => void }) {
  const stats = statsFor(data, person.id)
  return (
    <button className="person-row" onClick={onClick}>
      <span className="person-cell">
        <span className="avatar">{initials(person)}</span>
        <span className="person-name"><strong>{person.fullName}</strong><small><Building2 size={13} /> {person.company || 'Company unavailable'}</small></span>
      </span>
      <span className="role-cell">
        <strong>{person.position || 'Position unavailable'}</strong>
        <span className="tag-row">
          {person.roles.slice(0, 2).map((role) => <span className="role-tag" key={role}>{role}</span>)}
          {location && <span className="location-tag"><MapPin size={11} /> {location}</span>}
          {!location && person.dubaiCompanySignal && <span className="hint-tag">Dubai company hint</span>}
        </span>
      </span>
      <span className="relationship-cell">
        <span className={`status-dot status-${stats.status}`} />
        <span><strong>{conversationLabels[stats.status]}</strong><small>{stats.messageCount ? `${stats.messageCount} messages · ${formatDate(stats.lastMessageAt)}` : 'No URL match in archive'}</small></span>
      </span>
      <span className="date-cell">{formatDate(person.connectedOn, person.connectedOnRaw)}</span>
      <span className="row-arrow">›</span>
    </button>
  )
}

function PersonDrawer({ person, data, location, onLocationChange, onClose }: {
  person: Connection
  data: ArchiveData
  location: string
  onLocationChange: (value: string) => void
  onClose: () => void
}) {
  const stats = statsFor(data, person.id)
  const messages = data.messagesByPerson.get(person.id) ?? []
  const [draftLocation, setDraftLocation] = useState(location)
  const [messageLimit, setMessageLimit] = useState(8)
  const externalUrl = linkedInUrl(person.profileUrl)

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return (
    <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="person-drawer" role="dialog" aria-modal="true" aria-label={`${person.fullName} details`}>
        <button className="drawer-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="drawer-profile">
          <div className="avatar avatar-large">{initials(person)}</div>
          <div>
            <p className="overline">Connection</p>
            <h2>{person.fullName}</h2>
            <p>{person.position || 'Position unavailable'}{person.company ? ` at ${person.company}` : ''}</p>
          </div>
        </div>
        <div className="drawer-tags">
          {person.roles.map((role) => <span className="role-tag" key={role}>{role}</span>)}
          {person.dubaiCompanySignal && <span className="hint-tag">Company mentions Dubai</span>}
        </div>
        <div className="drawer-actions">
          {externalUrl && <a href={externalUrl} target="_blank" rel="noreferrer">Open LinkedIn <ArrowUpRight size={15} /></a>}
          <span><CalendarDays size={15} /> Connected {formatDate(person.connectedOn, person.connectedOnRaw)}</span>
        </div>

        <section className="location-editor">
          <div><MapPin size={18} /><span><strong>Location</strong><small>Not included by LinkedIn. Add your own annotation.</small></span></div>
          <div className="location-input-row">
            <input value={draftLocation} onChange={(event) => setDraftLocation(event.target.value)} placeholder="e.g. Dubai" />
            <button onClick={() => onLocationChange(draftLocation)} disabled={draftLocation.trim() === location.trim()}>
              <Check size={15} /> Save
            </button>
          </div>
        </section>

        <section className="conversation-section">
          <div className="section-title-row">
            <div><p className="overline">Conversation</p><h3>{conversationLabels[stats.status]}</h3></div>
            {stats.messageCount > 0 && <span className={`conversation-badge status-${stats.status}`}>{stats.messageCount} messages</span>}
          </div>
          {stats.messageCount > 0 ? (
            <>
              <div className="conversation-metrics">
                <div><strong>{stats.sentCount}</strong><span>Sent</span></div>
                <div><strong>{stats.receivedCount}</strong><span>Received</span></div>
                <div><strong>{stats.conversationCount}</strong><span>Threads</span></div>
                <div><strong>{formatDate(stats.lastMessageAt)}</strong><span>Last contact</span></div>
              </div>
              <div className="message-list">
                {messages.slice(0, messageLimit).map((message, index) => (
                  <article className={`message-card ${message.direction}`} key={`${message.conversationId}-${message.dateRaw}-${index}`}>
                    <header><strong>{message.direction === 'sent' ? 'You' : message.from}</strong><time>{formatDate(message.date)}</time></header>
                    {message.subject && <b>{message.subject}</b>}
                    <p>{message.content || 'Attachment or empty message'}</p>
                    {message.attachmentUrl.startsWith('https://') && (
                      <a href={message.attachmentUrl} target="_blank" rel="noreferrer">Attachment link <ArrowUpRight size={12} /></a>
                    )}
                  </article>
                ))}
              </div>
              {messageLimit < messages.length && <button className="show-messages" onClick={() => setMessageLimit((value) => value + 20)}>Show earlier messages</button>}
            </>
          ) : (
            <div className="no-conversation">
              <MessageCircle size={23} />
              <strong>No conversation found</strong>
              <span>This means no matching profile URL appeared in the exported message history. It is not proof that you have never spoken elsewhere.</span>
            </div>
          )}
        </section>
      </aside>
    </div>
  )
}

export default function App() {
  const [data, setData] = useState<ArchiveData | null>(null)

  return data ? (
    <Dashboard data={data} onReset={() => setData(null)} />
  ) : (
    <ImportScreen onImport={async (file) => setData(await parseLinkedInArchive(await file.arrayBuffer()))} />
  )
}
