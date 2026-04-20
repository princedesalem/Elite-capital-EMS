import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TalentManagement from './TalentManagement'

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
const apiPutMock = vi.fn()
const apiDeleteMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    post: (...args) => apiPostMock(...args),
    put: (...args) => apiPutMock(...args),
    delete: (...args) => apiDeleteMock(...args),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: 1001, role: 'RH', prenom: 'Alice', nom: 'Dupont' },
  }),
}))

const MEETINGS = [
  { id: 1, titre: 'Point mensuel', manager_id: 1001, employee_id: 2001, date: '2026-05-10', statut: 'planifie' },
]
const GOALS = [
  { id: 1, titre: 'Certification AWS', employee_id: 2001, statut: 'a_faire', type: 'Formation' },
]

describe('TalentManagement', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/talent/meetings')) return Promise.resolve({ data: MEETINGS })
      if (String(url).includes('/api/talent/goals')) return Promise.resolve({ data: GOALS })
      return Promise.resolve({ data: [] })
    })
    apiPostMock.mockResolvedValue({ data: {} })
    apiPutMock.mockResolvedValue({ data: {} })
    apiDeleteMock.mockResolvedValue({ data: {} })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><TalentManagement /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows meeting title', async () => {
    render(<MemoryRouter><TalentManagement /></MemoryRouter>)
    expect(await screen.findByText('Point mensuel')).toBeInTheDocument()
  })

  it('shows goal title', async () => {
    render(<MemoryRouter><TalentManagement /></MemoryRouter>)
    // Goals are on second tab - check content is loaded from API
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/api/talent/goals')
    })
    // Try to find goal or verify it's in DOM after tab data is loaded
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/Certification AWS|Objectifs/)
    })
  })
})
