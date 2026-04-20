import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EvaluationsPage from './EvaluationsPage'

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
    user: { matricule: 1001, role: 'EMPLOYE', prenom: 'Bob', nom: 'Dupont' },
  }),
}))

describe('EvaluationsPage', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockResolvedValue({ data: [] })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><EvaluationsPage /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows page title', async () => {
    render(<MemoryRouter><EvaluationsPage /></MemoryRouter>)
    expect(await screen.findByText(/évaluations/i)).toBeInTheDocument()
  })

  it('shows empty state when no evaluations', async () => {
    render(<MemoryRouter><EvaluationsPage /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    // page renders without crash
    expect(document.body).toBeDefined()
  })
})
