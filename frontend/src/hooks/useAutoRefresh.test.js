import { renderHook } from '@testing-library/react'
import { useAutoRefresh } from './useAutoRefresh'

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls refreshFn when tab becomes visible', () => {
    const refreshFn = vi.fn()
    renderHook(() => useAutoRefresh(refreshFn))

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(refreshFn).toHaveBeenCalledTimes(1)
  })

  it('does not call refreshFn when tab becomes hidden', () => {
    const refreshFn = vi.fn()
    renderHook(() => useAutoRefresh(refreshFn))

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(refreshFn).not.toHaveBeenCalled()
  })

  it('calls refreshFn on ems:newNotification event', () => {
    const refreshFn = vi.fn()
    renderHook(() => useAutoRefresh(refreshFn))

    window.dispatchEvent(new CustomEvent('ems:newNotification'))

    expect(refreshFn).toHaveBeenCalledTimes(1)
  })

  it('removes event listeners on unmount', () => {
    const refreshFn = vi.fn()
    const { unmount } = renderHook(() => useAutoRefresh(refreshFn))
    unmount()

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new CustomEvent('ems:newNotification'))

    expect(refreshFn).not.toHaveBeenCalled()
  })

  it('uses the latest refreshFn reference after update', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    const { rerender } = renderHook(({ fn }) => useAutoRefresh(fn), {
      initialProps: { fn: fn1 },
    })

    rerender({ fn: fn2 })

    window.dispatchEvent(new CustomEvent('ems:newNotification'))

    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).toHaveBeenCalledTimes(1)
  })
})
