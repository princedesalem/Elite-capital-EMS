import React from 'react'

/**
 * Skeleton — bloc de placeholder animé (effet shimmer).
 * Variants préconfigurés: TableSkeleton, CardSkeleton, ListSkeleton.
 */

const SHIMMER = {
  background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)',
  backgroundSize: '200% 100%',
  animation: 'ems-skeleton-shimmer 1.4s ease-in-out infinite',
  borderRadius: 6,
}

export function Skeleton({ width = '100%', height = 14, style, className }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-block', width, height, ...SHIMMER, ...style }}
    />
  )
}

export function SkeletonStyles() {
  return (
    <style>{`
      @keyframes ems-skeleton-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  )
}

export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" style={{ width: '100%' }}>
      <SkeletonStyles />
      <span className="sr-only" style={{ position: 'absolute', left: -9999 }}>Chargement…</span>
      <div style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--border, #e2e8f0)',
          background: 'var(--bg, #f8fafc)',
        }}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} height={12} width="70%" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} style={{
            display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 12, padding: '14px 12px',
            borderBottom: '1px solid var(--border, #f1f5f9)',
          }}>
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                height={14}
                width={c === 0 ? '85%' : `${50 + ((r + c) * 7) % 40}%`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardSkeleton({ lines = 3 }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" style={{
      padding: 16, background: 'var(--card, #fff)',
      border: '1px solid var(--border, #e2e8f0)', borderRadius: 12,
    }}>
      <SkeletonStyles />
      <Skeleton height={16} width="60%" style={{ marginBottom: 12 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          width={i === lines - 1 ? '70%' : '100%'}
          style={{ marginBottom: 8, display: 'block' }}
        />
      ))}
    </div>
  )
}

export function ListSkeleton({ items = 6 }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <SkeletonStyles />
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px',
          borderBottom: '1px solid var(--border, #f1f5f9)',
        }}>
          <Skeleton width={40} height={40} style={{ borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <Skeleton height={12} width="45%" style={{ marginBottom: 6, display: 'block' }} />
            <Skeleton height={10} width="75%" style={{ display: 'block' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default Skeleton
