import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Utilisateurs from './Utilisateurs'

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
    user: { matricule: 1001, role: 'ADMIN', prenom: 'Alice', nom: 'Dupont' },
  }),
}))

const USERS = [
  { matricule: 1001, prenom: 'Alice', nom: 'Dupont', role: 'ADMIN', email: 'alice@test.com' },
  { matricule: 2001, prenom: 'Bob', nom: 'Martin', role: 'RH', email: 'bob@test.com' },
]

describe('Utilisateurs', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/admin/utilisateurs')) return Promise.resolve({ data: USERS })
      if (String(url).includes('/employes-sans-compte')) return Promise.resolve({ data: [] })
      if (String(url).includes('/roles/')) return Promise.resolve({ data: [{ id_role: 1, name: 'RH' }] })
      return Promise.resolve({ data: [] })
    })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><Utilisateurs /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows user names', async () => {
    render(<MemoryRouter><Utilisateurs /></MemoryRouter>)
    // Names are rendered as 'prenom nom' join  text may be split across elements
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/Alice/)
      expect(document.body.textContent).toMatch(/Bob/)
    })
  })
})
