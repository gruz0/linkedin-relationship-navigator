const LOCKED_STYLE_PROPERTIES = [
  'position',
  'top',
  'left',
  'right',
  'width',
  'overflow',
  'overscrollBehavior',
  'paddingRight',
] as const

type LockedStyleProperty = (typeof LOCKED_STYLE_PROPERTIES)[number]

export function lockDocumentScroll() {
  const body = document.body
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const previousStyles = Object.fromEntries(
    LOCKED_STYLE_PROPERTIES.map((property) => [property, body.style[property]]),
  ) as Record<LockedStyleProperty, string>
  const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth)
  const bodyPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0

  body.style.position = 'fixed'
  body.style.top = `-${scrollY}px`
  body.style.left = `-${scrollX}px`
  body.style.right = '0'
  body.style.width = '100%'
  body.style.overflow = 'hidden'
  body.style.overscrollBehavior = 'none'
  if (scrollbarWidth > 0) body.style.paddingRight = `${bodyPaddingRight + scrollbarWidth}px`

  let restored = false
  return () => {
    if (restored) return
    restored = true
    for (const property of LOCKED_STYLE_PROPERTIES) body.style[property] = previousStyles[property]
    window.scrollTo(scrollX, scrollY)
  }
}
