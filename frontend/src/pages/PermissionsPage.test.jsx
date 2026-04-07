import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PermissionsPage from './PermissionsPage'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url.includes('/api/permissions/mes-permissions/')) return Promise.resolve({ data: [] })
      if (url.includes('/api/workflow/boite/')) return Promise.resolve({ data: {} })
      if (url.includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 20 } })
      return Promise.resolve({ data: {} })
    }),
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

describe('PermissionsPage', () => {
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
})
