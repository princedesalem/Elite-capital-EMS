import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { emit, useBusEvent, DATA_CHANGED } from './eventBus'

describe('utils/eventBus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits and dispatches a custom event on window', () => {
    const handler = vi.fn()
    window.addEventListener('ems:test', handler)
    emit('ems:test', { foo: 'bar' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].detail).toEqual({ foo: 'bar' })
    window.removeEventListener('ems:test', handler)
  })

  it('useBusEvent debounces by default', () => {
    const fn = vi.fn()
    renderHook(() => useBusEvent(DATA_CHANGED, fn, { debounce: 200 }))
    act(() => {
      emit(DATA_CHANGED, { a: 1 })
      emit(DATA_CHANGED, { a: 2 })
      emit(DATA_CHANGED, { a: 3 })
    })
    expect(fn).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(210)
    })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0][0]).toEqual({ a: 3 })
  })

  it('useBusEvent fires immediately when debounce is 0', () => {
    const fn = vi.fn()
    renderHook(() => useBusEvent(DATA_CHANGED, fn, { debounce: 0 }))
    act(() => {
      emit(DATA_CHANGED, { x: 1 })
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('useBusEvent unsubscribes on unmount', () => {
    const fn = vi.fn()
    const { unmount } = renderHook(() => useBusEvent(DATA_CHANGED, fn, { debounce: 0 }))
    unmount()
    emit(DATA_CHANGED, { done: true })
    expect(fn).not.toHaveBeenCalled()
  })
})
