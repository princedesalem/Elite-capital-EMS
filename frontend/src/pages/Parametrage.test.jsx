import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Parametrage from './Parametrage'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { matricule: 1, role: 'RH' } }),
}))

vi.mock('../services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: { settings: {} } }), put: vi.fn().mockResolvedValue({}) },
}))

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'clair', setTheme: vi.fn() }),
}))

describe('Parametrage', () => {
  it('renders without crashing', () => {
    render(<MemoryRouter><Parametrage /></MemoryRouter>)
  })

  it('shows section menu items', () => {
    render(<MemoryRouter><Parametrage /></MemoryRouter>)
    const generals = screen.getAllByText('Général')
    expect(generals.length).toBeGreaterThan(0)
    expect(screen.getAllByText('Apparence').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Notifications').length).toBeGreaterThan(0)
  })

  it('switches section on click', () => {
    render(<MemoryRouter><Parametrage /></MemoryRouter>)
    fireEvent.click(screen.getByText('Apparence'))
    expect(screen.getByText('Affichage')).toBeInTheDocument()
  })
})
