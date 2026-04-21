import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PermissionsPage from './PermissionsPage'

const apiGetMock = vi.fn((url) => {
  if (url.includes('/api/permissions/mes-permissions/')) return Promise.resolve({ data: [] })
  if (url.includes('/api/workflow/boite/')) return Promise.resolve({ data: {} })
  if (url.includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 20 } })
  return Promise.resolve({ data: {} })
})

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: '1001', role: 'EMPLOYE', prenom: 'Jean', nom: 'Test' },
  }),
}))

vi.mock('../components/RemplacantModal', () => ({
  default: () => null,
}))

describe('PermissionsPage', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((url) => {
      if (url.includes('/api/permissions/mes-permissions/')) return Promise.resolve({ data: [] })
      if (url.includes('/api/workflow/boite/')) return Promise.resolve({ data: {} })
      if (url.includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 20 } })
      return Promise.resolve({ data: {} })
    })
  })

  it('calcule la duree ouvrable pour non-conventionnelle', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <PermissionsPage />
        </MemoryRouter>
      )
      await Promise.resolve()
    })

    fireEvent.click(screen.getByRole('button', { name: /nouvelle demande/i }))
    fireEvent.click(screen.getByRole('button', { name: /non-conventionnelle/i }))

    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-04-06' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-04-12' } })

    const durationInput = document.querySelector('input[type="number"][readonly]')
    expect(durationInput).not.toBeNull()
    expect(durationInput).toHaveValue(5)
  })

  it('masque le bouton remplaçant sur une opération refusée', async () => {
    apiGetMock.mockImplementation((url) => {
      if (url.includes('/api/permissions/mes-permissions/')) return Promise.resolve({ data: [] })
      if (url.includes('/api/workflow/boite/')) {
        return Promise.resolve({
          data: {
            envoye: [{
              id_operation: 502,
              type_demande: 'permission',
              statut: 'refusé',
              motif: 'Conge medical',
              date_debut: '2026-05-01',
              date_fin: '2026-05-03',
              date_demande: '2026-04-20',
            }],
            recu: [], valide: [], refuse: [],
          },
        })
      }
      if (url.includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 20 } })
      return Promise.resolve({ data: {} })
    })

    await act(async () => {
      render(<MemoryRouter><PermissionsPage /></MemoryRouter>)
      await Promise.resolve()
    })

    expect(screen.queryByTitle('Remplaçant')).not.toBeInTheDocument()
  })
})
