import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SandboxPage from './SandboxPage'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: 1001, role: 'ADMIN', prenom: 'Alice', nom: 'Dupont' },
  }),
}))

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

describe('SandboxPage', () => {
  it('renders without crashing', () => {
    render(<MemoryRouter><SandboxPage /></MemoryRouter>)
  })

  it('shows API tester section', () => {
    render(<MemoryRouter><SandboxPage /></MemoryRouter>)
    expect(screen.getByText(/sandbox|api tester|bac à sable/i)).toBeInTheDocument()
  })

  it('shows feature flags section', () => {
    render(<MemoryRouter><SandboxPage /></MemoryRouter>)
    // 'Feature Flags' heading or 'Mode sombre' flag item
    const matches = screen.queryAllByText(/feature flags|mode sombre|dark/i)
    expect(matches.length).toBeGreaterThan(0)
  })
})
