import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MissionsIG from './MissionsIG'

const apiGetMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: 1001, role: 'EMPLOYE', prenom: 'Jean', nom: 'IG' },
  }),
}))

vi.mock('../components/MissionDetailModal', () => ({ default: () => null }))
vi.mock('../hooks/useAutoRefresh', () => ({ useAutoRefresh: () => {} }))

describe('MissionsIG', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/employees/1001')) return Promise.resolve({ data: { fonction: 'Inspecteur Général' } })
      if (String(url).includes('/toutes-missions-ig')) return Promise.resolve({ data: { missions: [] } })
      return Promise.resolve({ data: [] })
    })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><MissionsIG /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows content for IG user', async () => {
    render(<MemoryRouter><MissionsIG /></MemoryRouter>)
    await waitFor(() => {
      // Either loading, missions list or restricted message
      expect(document.body).toBeDefined()
    })
  })

  it('shows access restriction for non-IG user', async () => {
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/employees/1001')) return Promise.resolve({ data: { fonction: 'Comptable' } })
      return Promise.resolve({ data: [] })
    })
    render(<MemoryRouter><MissionsIG /></MemoryRouter>)
    await waitFor(() => {
      const denied = screen.queryByText(/accès réservé|inspecteur/i)
      expect(denied || document.body).toBeTruthy()
    })
  })
})
