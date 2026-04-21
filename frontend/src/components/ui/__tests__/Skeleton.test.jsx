import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Skeleton, TableSkeleton } from '../Skeleton'

describe('Skeleton', () => {
  it('renders with default dimensions', () => {
    const { container } = render(<Skeleton />)
    const el = container.querySelector('span[aria-hidden="true"]')
    expect(el).not.toBeNull()
    expect(el.style.display).toBe('inline-block')
  })

  it('respects width and height props', () => {
    const { container } = render(<Skeleton width="120px" height={20} />)
    const el = container.querySelector('span[aria-hidden="true"]')
    expect(el.style.width).toBe('120px')
    expect(el.style.height).toBe('20px')
  })
})

describe('TableSkeleton', () => {
  it('exposes aria-busy role status for assistive tech', () => {
    render(<TableSkeleton rows={3} columns={4} />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
  })

  it('renders the requested number of rows and columns', () => {
    const { container } = render(<TableSkeleton rows={3} columns={4} />)
    const placeholders = container.querySelectorAll('span[aria-hidden="true"]')
    // 4 header cells + 3 rows × 4 cells = 16
    expect(placeholders.length).toBe(16)
  })
})
