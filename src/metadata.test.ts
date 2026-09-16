import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

describe('social sharing metadata', () => {
  it('uses the dedicated 1200 by 630 Open Graph image', () => {
    expect(indexHtml).toContain('showcase/og-image.png')
    expect(indexHtml).toContain('property="og:image:width" content="1200"')
    expect(indexHtml).toContain('property="og:image:height" content="630"')
    expect(indexHtml).toContain('name="twitter:image"')
    expect(indexHtml).not.toContain(
      'property="og:image" content="https://gruz0.github.io/linkedin-relationship-navigator/showcase/social-preview.png"',
    )
  })
})
