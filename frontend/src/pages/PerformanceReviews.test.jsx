import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PerformanceReviews from './PerformanceReviews'

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

const REVIEWS = [
  { id: 1, reviewer_id: 1001, reviewee_id: 2001, scores: [4, 4.5, 5], commentaire: 'Très bon', points_forts: 'Rigueur', points_amelioration: 'Communication' },
]

describe('PerformanceReviews', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/performance-reviews')) return Promise.resolve({ data: REVIEWS })
      return Promise.resolve({ data: [] })
    })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><PerformanceReviews /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows page heading', async () => {
    render(<MemoryRouter><PerformanceReviews /></MemoryRouter>)
    const matches = await screen.findAllByText(/360|performance|évaluation/i)
    expect(matches.length).toBeGreaterThan(0)
  })
})
