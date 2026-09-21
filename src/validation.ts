export type WaitlistSource = 'landing' | 'workspace'

export const TALLY_FORM_URL = 'https://tally.so/r/44ZYAB'

export function waitlistUrl(source: WaitlistSource): string {
  const url = new URL(TALLY_FORM_URL)
  url.searchParams.set('source', source)
  return url.toString()
}
