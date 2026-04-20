import React from 'react'
import { render, screen } from '@testing-library/react'
import ModifiedBadge from './ModifiedBadge'

describe('ModifiedBadge', () => {
  it('renders nothing when estModifie is false', () => {
    const { container } = render(<ModifiedBadge estModifie={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows "Modifiée" when estModifie is true', () => {
    render(<ModifiedBadge estModifie={true} />)
    expect(screen.getByText('Modifiée')).toBeInTheDocument()
  })

  it('shows title without date when no dateModification', () => {
    render(<ModifiedBadge estModifie={true} />)
    expect(screen.getByText('Modifiée').title).toBe('Demande modifiée')
  })

  it('shows tooltip with formatted date', () => {
    render(<ModifiedBadge estModifie={true} dateModification="2026-05-10T14:30:00" />)
    const badge = screen.getByText('Modifiée')
    expect(badge.title).toContain('10')  // day
    expect(badge.title).toContain('05')  // month or formatted
  })

  it('applies correct styling', () => {
    render(<ModifiedBadge estModifie={true} />)
    const badge = screen.getByText('Modifiée')
    expect(badge).toHaveStyle({ background: '#ffedd5', color: '#9a3412' })
  })
})
