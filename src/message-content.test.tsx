import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { highlightedTextSegments, MessageContent, messageContentSegments } from './message-content'

describe('message content links', () => {
  it('turns explicit HTTP and HTTPS URLs into safe links while preserving surrounding text', () => {
    const html = renderToStaticMarkup(
      <MessageContent content="Visit https://example.com/docs?q=one&x=two, then http://example.org/test." />,
    )

    expect(html).toContain('href="https://example.com/docs?q=one&amp;x=two"')
    expect(html).toContain('href="http://example.org/test"')
    expect(html.match(/target="_blank"/g)).toHaveLength(2)
    expect(html.match(/rel="nofollow noopener noreferrer"/g)).toHaveLength(2)
    expect(html).toContain('</a>, then ')
    expect(html).toContain('</a>.</p>')
  })

  it('keeps balanced URL parentheses but excludes sentence punctuation', () => {
    expect(messageContentSegments('See (https://example.com/a_(b)).')).toEqual([
      { kind: 'text', value: 'See (', start: 0 },
      { kind: 'link', value: 'https://example.com/a_(b)', href: 'https://example.com/a_(b)', start: 5 },
      { kind: 'text', value: ').', start: 30 },
    ])
  })

  it('leaves non-HTTP schemes, incomplete URLs, and HTML as inert text', () => {
    const content = '<script>alert(1)</script> www.example.com javascript:alert(1) ftp://example.com https://'
    const html = renderToStaticMarkup(<MessageContent content={content} />)

    expect(html).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt; www.example.com javascript:alert(1) ftp://example.com https://</p>',
    )
    expect(html).not.toContain('<a')
  })

  it('highlights every literal case-insensitive match without breaking links or interpreting HTML', () => {
    const html = renderToStaticMarkup(
      <MessageContent content="MVP notes: https://example.com/MVP?next=<unsafe> and another mvp." highlight="mvp" />,
    )

    expect(highlightedTextSegments('MVP and mvp', 'mvp')).toEqual([
      { value: 'MVP', highlighted: true, start: 0 },
      { value: ' and ', highlighted: false, start: 3 },
      { value: 'mvp', highlighted: true, start: 8 },
    ])
    expect(html.match(/<mark>/g)).toHaveLength(3)
    expect(html).toContain('href="https://example.com/MVP?next="')
    expect(html).toContain('&lt;unsafe&gt;')
  })
})
