const URL_CANDIDATE_PATTERN = /https?:\/\/[^\s<>"']+/giu
const UNCONDITIONAL_TRAILING_PUNCTUATION = new Set(['.', ',', '!', '?', ':', ';'])
const CLOSING_PAIRS = new Map([
  [')', '('],
  [']', '['],
  ['}', '{'],
])

export type MessageContentSegment =
  | { kind: 'text'; value: string; start: number }
  | { kind: 'link'; value: string; href: string; start: number }

function occurrences(value: string, character: string) {
  return [...value].filter((item) => item === character).length
}

function trimTrailingPunctuation(candidate: string) {
  let end = candidate.length
  while (end > 0) {
    const lastCharacter = candidate[end - 1]
    if (UNCONDITIONAL_TRAILING_PUNCTUATION.has(lastCharacter)) {
      end -= 1
      continue
    }

    const openingCharacter = CLOSING_PAIRS.get(lastCharacter)
    if (!openingCharacter) break
    const current = candidate.slice(0, end)
    if (occurrences(current, lastCharacter) <= occurrences(current, openingCharacter)) break
    end -= 1
  }
  return candidate.slice(0, end)
}

function safeHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname ? value : null
  } catch {
    return null
  }
}

export function messageContentSegments(content: string): MessageContentSegment[] {
  const segments: MessageContentSegment[] = []
  let cursor = 0

  for (const match of content.matchAll(URL_CANDIDATE_PATTERN)) {
    const start = match.index
    const value = trimTrailingPunctuation(match[0])
    const href = safeHttpUrl(value)
    if (!href) continue
    if (start > cursor) segments.push({ kind: 'text', value: content.slice(cursor, start), start: cursor })
    segments.push({ kind: 'link', value, href, start })
    cursor = start + value.length
  }

  if (cursor < content.length) segments.push({ kind: 'text', value: content.slice(cursor), start: cursor })
  return segments
}

export function MessageContent({ content }: { content: string }) {
  return (
    <p>
      {messageContentSegments(content).map((segment) =>
        segment.kind === 'link' ? (
          <a key={segment.start} href={segment.href} target="_blank" rel="nofollow noopener noreferrer">
            {segment.value}
          </a>
        ) : (
          segment.value
        ),
      )}
    </p>
  )
}
