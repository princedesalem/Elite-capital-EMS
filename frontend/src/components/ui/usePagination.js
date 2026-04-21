import { useMemo, useState } from 'react'

/**
 * usePagination — pagination client-side.
 *
 * Usage:
 *   const { pageItems, page, pageCount, pageSize, setPage, setPageSize, rangeLabel } = usePagination(items, { pageSize: 20 })
 */
export default function usePagination(items, options = {}) {
  const { pageSize: initialSize = 20, initialPage = 1 } = options
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialSize)

  const safeItems = Array.isArray(items) ? items : []
  const total = safeItems.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const currentPage = Math.min(Math.max(1, page), pageCount)

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return safeItems.slice(start, start + pageSize)
  }, [safeItems, currentPage, pageSize])

  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const to = Math.min(total, currentPage * pageSize)
  const rangeLabel = total === 0 ? '0 résultat' : `${from}–${to} sur ${total}`

  function changePageSize(n) {
    setPageSize(n)
    setPage(1)
  }

  return {
    pageItems,
    page: currentPage,
    pageCount,
    pageSize,
    total,
    setPage,
    setPageSize: changePageSize,
    rangeLabel,
  }
}
