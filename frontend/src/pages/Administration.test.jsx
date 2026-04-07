import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import Administration from './Administration'

const apiGetMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
  },
}))

let currentRole = 'RESPONSABLE'
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { role: currentRole },
  }),
}))

vi.mock('./OrgChart', () => ({
  default: () => <div>OrgChart mock</div>,
}))

describe('Administration read-only governance', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    currentRole = 'RESPONSABLE'
    apiGetMock.mockImplementation((url) => {
      if (url === '/employees/admin/entites-structure') return Promise.resolve({ data: [] })
      if (url === '/employees/admin/directions-structure') return Promise.resolve({ data: [] })
      if (url === '/employees/admin/departements') return Promise.resolve({ data: [] })
      if (url === '/employees/admin/fonctions-reference') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
  })

  it('all organisation tabs are visible and enabled; fonctions data is fetched for all roles', async () => {
    render(<Administration />)

    const fonctionsTab = await screen.findByRole('button', { name: /Fonctions/i })

    // All tabs must be clickable — no role gate on the tab buttons
    expect(fonctionsTab).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /Entités/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /Directions/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /Départements/i })).not.toBeDisabled()

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/employees/admin/entites-structure')
      expect(apiGetMock).toHaveBeenCalledWith('/employees/admin/directions-structure')
      expect(apiGetMock).toHaveBeenCalledWith('/employees/admin/departements')
      // Fonctions reference is fetched for everyone
      expect(apiGetMock).toHaveBeenCalledWith('/employees/admin/fonctions-reference')
    })
  })
})
