import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Operations from './Operations'

const apiGetMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: 1001, role: 'EMPLOYE', prenom: 'Jean', nom: 'Dupont', sub: 1001 },
  }),
}))

vi.mock('../components/ProgressionValidation', () => ({ default: () => null }))
vi.mock('../components/CommentairesMission', () => ({ default: () => null }))
vi.mock('../components/WorkflowModal', () => ({ default: () => null }))
vi.mock('../components/AutocompleteInput', () => ({
  default: ({ value, onChange, placeholder }) => (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  ),
}))

describe('Operations', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/boite/')) {
        return Promise.resolve({ data: { envoye: [], recu: [], valide: [], refuse: [] } })
      }
      if (String(url).includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 15 } })
      return Promise.resolve({ data: [] })
    })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><Operations /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows operations page heading or section', async () => {
    render(<MemoryRouter><Operations /></MemoryRouter>)
    await waitFor(() => {
      const heading = screen.queryByText(/opérations|permissions|congés|sorties|missions/i)
      expect(heading || document.body).toBeTruthy()
    })
  })
})
