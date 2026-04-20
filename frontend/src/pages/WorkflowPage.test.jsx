import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import WorkflowPage from './WorkflowPage'

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

vi.mock('../components/ProgressionValidation', () => ({ default: () => null }))
vi.mock('../components/CommentairesMission', () => ({ default: () => null }))

const WORKFLOW_BOITE = {
  envoye: [{ id_operation: 10, type_demande: 'conge', statut: 'en attente', date_demande: '2026-05-01' }],
  recu: [],
  valide: [],
  refuse: [],
}

describe('WorkflowPage', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/boite/')) return Promise.resolve({ data: WORKFLOW_BOITE })
      if (String(url).includes('/api/operations/')) return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><WorkflowPage /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows workflow section headings', async () => {
    render(<MemoryRouter><WorkflowPage /></MemoryRouter>)
    await waitFor(() => {
      const mes = screen.queryAllByText(/mes demandes/i)
      const valider = screen.queryAllByText(/à valider/i)
      expect(mes.length + valider.length).toBeGreaterThan(0)
    })
  })
})
