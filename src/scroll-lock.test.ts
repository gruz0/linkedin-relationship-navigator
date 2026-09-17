import { afterEach, describe, expect, it, vi } from 'vitest'
import { lockDocumentScroll } from './scroll-lock'

describe('document scroll lock', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('freezes the document in place and restores its scroll position and inline styles', () => {
    const originalStyles = {
      position: 'relative',
      top: '1px',
      left: '2px',
      right: '3px',
      width: '90%',
      overflow: 'visible',
      overscrollBehavior: 'auto',
      paddingRight: '4px',
    }
    const style = { ...originalStyles }
    const scrollTo = vi.fn()
    vi.stubGlobal('document', { body: { style }, documentElement: { clientWidth: 1180 } })
    vi.stubGlobal('window', {
      scrollX: 12,
      scrollY: 345,
      innerWidth: 1200,
      getComputedStyle: () => ({ paddingRight: '4px' }),
      scrollTo,
    })

    const unlock = lockDocumentScroll()

    expect(style).toEqual({
      position: 'fixed',
      top: '-345px',
      left: '-12px',
      right: '0',
      width: '100%',
      overflow: 'hidden',
      overscrollBehavior: 'none',
      paddingRight: '24px',
    })

    unlock()
    unlock()

    expect(style).toEqual(originalStyles)
    expect(scrollTo).toHaveBeenCalledOnce()
    expect(scrollTo).toHaveBeenCalledWith(12, 345)
  })

  it('does not change body padding when no scrollbar is present', () => {
    const style = {
      position: '',
      top: '',
      left: '',
      right: '',
      width: '',
      overflow: '',
      overscrollBehavior: '',
      paddingRight: '6px',
    }
    vi.stubGlobal('document', { body: { style }, documentElement: { clientWidth: 1200 } })
    vi.stubGlobal('window', {
      scrollX: 0,
      scrollY: 0,
      innerWidth: 1200,
      getComputedStyle: () => ({ paddingRight: '6px' }),
      scrollTo: vi.fn(),
    })

    const unlock = lockDocumentScroll()

    expect(style.paddingRight).toBe('6px')
    unlock()
    expect(style.paddingRight).toBe('6px')
  })
})
