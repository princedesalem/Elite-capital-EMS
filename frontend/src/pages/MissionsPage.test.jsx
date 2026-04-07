import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MissionsPage from './MissionsPage'

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
    user: { matricule: 1001, role: 'EMPLOYE', prenom: 'Jean', nom: 'Test' },
  }),
}))

vi.mock('../components/WorkflowModal', () => ({
  default: () => null,
}))

describe('MissionsPage cancellation', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()
    apiPutMock.mockReset()
    apiDeleteMock.mockReset()

    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/boite/')) {
        return Promise.resolve({
          data: {
            envoye: [
              {
                id_operation: 42,
                type_demande: 'mission',
                statut: 'en attente',
                date_debut: '2026-03-20',
                date_fin: '2026-03-22',
                motif: 'Mission test',
              },
            ],
            recu: [],
            valide: [],
            refuse: [],
          },
        })
      }
      if (String(url).includes('/api/missions/mes-missions/')) return Promise.resolve({ data: [] })
      if (String(url).includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 10 } })
      return Promise.resolve({ data: [] })
    })

    apiDeleteMock.mockResolvedValue({ data: {} })

    window.confirm = vi.fn(() => true)
  })

  it('uses operations delete endpoint when cancelling a mission request', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <MissionsPage />
        </MemoryRouter>
      )
    })

    const cancelBtn = await screen.findByRole('button', { name: 'Annuler' })
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(apiDeleteMock).toHaveBeenCalledWith('/api/operations/42')
    })
  })
})
