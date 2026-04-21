import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Pagination from '../Pagination'

function renderPagination(props = {}) {
  const defaults = {
    page: 2,
    pageCount: 5,
    pageSize: 10,
    total: 47,
    rangeLabel: '11–20 sur 47',
    setPage: vi.fn(),
    setPageSize: vi.fn(),
  }
  const merged = { ...defaults, ...props }
  return { ...render(<Pagination {...merged} />), props: merged }
}

describe('Pagination', () => {
  it('renders range label and aria-label', () => {
    renderPagination()
    expect(screen.getByLabelText('Pagination')).toBeInTheDocument()
    expect(screen.getByText('11–20 sur 47')).toBeInTheDocument()
  })

  it('invokes setPage when navigation buttons are clicked', () => {
    const { props } = renderPagination()
    fireEvent.click(screen.getByLabelText('Page précédente'))
    expect(props.setPage).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByLabelText('Page suivante'))
    expect(props.setPage).toHaveBeenCalledWith(3)
    fireEvent.click(screen.getByLabelText('Première page'))
    expect(props.setPage).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByLabelText('Dernière page'))
    expect(props.setPage).toHaveBeenCalledWith(5)
  })

  it('does not render when total is below smallest page size', () => {
    const { container } = renderPagination({ total: 5, pageCount: 1, page: 1, rangeLabel: '' })
    expect(container.firstChild).toBeNull()
  })
})
