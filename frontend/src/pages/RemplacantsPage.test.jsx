import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RemplacantsPage from './RemplacantsPage'

const apiGetMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: 1001, role: 'RH', prenom: 'Alice', nom: 'Dupont' },
  }),
}))

describe('RemplacantsPage', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockResolvedValue({ data: [] })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><RemplacantsPage /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows tab navigation', async () => {
    render(<MemoryRouter><RemplacantsPage /></MemoryRouter>)
    await waitFor(() => {
      const missions = screen.queryAllByText(/missions/i)
      const conges = screen.queryAllByText(/congés/i)
      expect(missions.length + conges.length).toBeGreaterThan(0)
    })
  })
})
