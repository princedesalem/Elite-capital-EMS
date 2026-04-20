import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LeaveForm from './LeaveForm'

vi.mock('../components/LeaveRequestForm', () => ({
  default: ({ onSuccess, submitLabel }) => (
    <form data-testid="leave-request-form">
      <button type="button" onClick={onSuccess}>{submitLabel}</button>
    </form>
  ),
}))

describe('LeaveForm', () => {
  it('renders without crashing', () => {
    render(<MemoryRouter><LeaveForm /></MemoryRouter>)
  })

  it('shows page heading', () => {
    render(<MemoryRouter><LeaveForm /></MemoryRouter>)
    expect(screen.getByText('Nouvelle demande')).toBeInTheDocument()
  })

  it('renders the LeaveRequestForm component with submit label', () => {
    render(<MemoryRouter><LeaveForm /></MemoryRouter>)
    expect(screen.getByTestId('leave-request-form')).toBeInTheDocument()
    expect(screen.getByText('Envoyer')).toBeInTheDocument()
  })
})
