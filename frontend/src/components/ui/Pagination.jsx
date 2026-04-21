import React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

/**
 * Pagination — composant contrôlé pour usePagination.
 * Props:
 *   page, pageCount, pageSize, total, rangeLabel, setPage, setPageSize
 *   pageSizeOptions (optional, default [10, 20, 50, 100])
 *   compact (optional, hides page size selector)
 */
export default function Pagination({
  page,
  pageCount,
  pageSize,
  total = 0,
  rangeLabel,
  setPage,
  setPageSize,
  pageSizeOptions = [10, 20, 50, 100],
  compact = false,
}) {
  if (!pageCount || pageCount <= 1 && total <= pageSize && !rangeLabel) {
    // n'affiche rien quand il n'y a pas d'intérêt à paginer
    if (total <= (pageSizeOptions[0] || 10)) return null
  }

  const canPrev = page > 1
  const canNext = page < pageCount

  const btn = (disabled) => ({
    minWidth: 30, height: 30,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 8px',
    background: disabled ? 'var(--bg, #f1f5f9)' : '#ffffff',
    border: '1px solid var(--border, #e2e8f0)',
    borderRadius: 8,
    color: disabled ? '#cbd5e1' : '#334155',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '0.78rem', fontWeight: 600,
  })

  return (
    <nav
      aria-label="Pagination"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '10px 4px', flexWrap: 'wrap',
      }}
    >
      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
        {rangeLabel || `Page ${page} / ${pageCount}`}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {!compact && setPageSize && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label htmlFor="ems-page-size" style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Par page
            </label>
            <select
              id="ems-page-size"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{
                height: 30, borderRadius: 8,
                border: '1px solid var(--border, #e2e8f0)',
                padding: '0 8px', fontSize: '0.78rem',
                background: '#ffffff', color: '#334155', cursor: 'pointer',
              }}
            >
              {pageSizeOptions.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: 'inline-flex', gap: 4 }}>
          <button
            type="button"
            aria-label="Première page"
            disabled={!canPrev}
            onClick={() => setPage(1)}
            style={btn(!canPrev)}
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            type="button"
            aria-label="Page précédente"
            disabled={!canPrev}
            onClick={() => setPage(Math.max(1, page - 1))}
            style={btn(!canPrev)}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{
            minWidth: 60, height: 30,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 10px', fontSize: '0.78rem', fontWeight: 600, color: '#0f172a',
            background: '#ffffff', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8,
          }}>
            {page} / {pageCount}
          </span>
          <button
            type="button"
            aria-label="Page suivante"
            disabled={!canNext}
            onClick={() => setPage(Math.min(pageCount, page + 1))}
            style={btn(!canNext)}
          >
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            aria-label="Dernière page"
            disabled={!canNext}
            onClick={() => setPage(pageCount)}
            style={btn(!canNext)}
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </nav>
  )
}
