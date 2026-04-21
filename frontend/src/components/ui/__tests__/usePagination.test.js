import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import usePagination from '../usePagination'

describe('usePagination', () => {
  const items = Array.from({ length: 47 }, (_, i) => ({ id: i + 1 }))

  it('returns first page by default with correct size', () => {
    const { result } = renderHook(() => usePagination(items, { pageSize: 10 }))
    expect(result.current.pageItems).toHaveLength(10)
    expect(result.current.page).toBe(1)
    expect(result.current.pageCount).toBe(5)
    expect(result.current.total).toBe(47)
    expect(result.current.pageItems[0].id).toBe(1)
  })

  it('slices correctly on page change', () => {
    const { result } = renderHook(() => usePagination(items, { pageSize: 10 }))
    act(() => result.current.setPage(3))
    expect(result.current.pageItems[0].id).toBe(21)
    expect(result.current.pageItems).toHaveLength(10)
  })

  it('clamps page above pageCount', () => {
    const { result } = renderHook(() => usePagination(items, { pageSize: 10 }))
    act(() => result.current.setPage(99))
    expect(result.current.pageItems[0].id).toBe(41)
    expect(result.current.pageItems).toHaveLength(7)
  })

  it('handles non-array input gracefully', () => {
    const { result } = renderHook(() => usePagination(null, { pageSize: 10 }))
    expect(result.current.pageItems).toEqual([])
    expect(result.current.total).toBe(0)
    expect(result.current.pageCount).toBe(1)
  })

  it('emits a range label', () => {
    const { result } = renderHook(() => usePagination(items, { pageSize: 20 }))
    expect(result.current.rangeLabel).toBe('1–20 sur 47')
    act(() => result.current.setPage(3))
    expect(result.current.rangeLabel).toBe('41–47 sur 47')
  })

  it('resets to first page when page size changes', () => {
    const { result } = renderHook(() => usePagination(items, { pageSize: 10 }))
    act(() => result.current.setPage(3))
    act(() => result.current.setPageSize(25))
    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(25)
  })
})
