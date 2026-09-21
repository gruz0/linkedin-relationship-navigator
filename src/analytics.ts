type ValidationEvent =
  | 'get_started_hero'
  | 'get_started_bottom'
  | 'demo_selected'
  | 'free_selected'
  | 'real_export_loaded'
  | 'waitlist_opened_landing'
  | 'waitlist_opened_workspace'

declare global {
  interface Window {
    umami?: { track: (event: string) => void }
  }
}

const queuedEvents: ValidationEvent[] = []
const UMAMI_WEBSITE_ID = '328e3242-d066-497a-b81c-8cc222dd22ba'
const UMAMI_DOMAIN = 'gruz0.github.io'

export function trackValidationEvent(event: ValidationEvent) {
  if (!import.meta.env.PROD || window.location.hostname !== UMAMI_DOMAIN) return
  if (window.umami) window.umami.track(event)
  else queuedEvents.push(event)
}

export function initAnalytics() {
  if (!import.meta.env.PROD || window.location.hostname !== UMAMI_DOMAIN) return

  const script = document.createElement('script')
  script.defer = true
  script.src = 'https://cloud.umami.is/script.js'
  script.dataset.websiteId = UMAMI_WEBSITE_ID
  script.dataset.domains = UMAMI_DOMAIN
  script.addEventListener('load', () => {
    for (const event of queuedEvents) window.umami?.track(event)
    queuedEvents.length = 0
  })
  document.head.appendChild(script)
}
