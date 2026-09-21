import { describe, expect, it } from 'vitest'
import { TALLY_FORM_URL, waitlistUrl } from './validation'

describe('waitlist links', () => {
  it('uses one form with distinct entry sources', () => {
    expect(waitlistUrl('landing')).toBe(`${TALLY_FORM_URL}?source=landing`)
    expect(waitlistUrl('workspace')).toBe(`${TALLY_FORM_URL}?source=workspace`)
  })
})
