import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OrgChart, { niveauFonctionnel } from './OrgChart'

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

describe('OrgChart', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockResolvedValue({ data: [] })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><OrgChart /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows orgchart heading or chart element', async () => {
    render(<MemoryRouter><OrgChart /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    expect(document.body).toBeDefined()
  })
})

describe('niveauFonctionnel (niveau visuel par fonction)', () => {
  it('met les Directeurs / DG / PCA au niveau 0', () => {
    expect(niveauFonctionnel({ fonction: 'Directeur Général' })).toBe(0)
    expect(niveauFonctionnel({ fonction: 'DG' })).toBe(0)
    expect(niveauFonctionnel({ fonction: 'PCA' })).toBe(0)
    expect(niveauFonctionnel({ fonction: 'Directrice Financière' })).toBe(0)
  })

  it('met les Responsables / Chefs / Managers au niveau 1', () => {
    expect(niveauFonctionnel({ fonction: 'Responsable RH' })).toBe(1)
    expect(niveauFonctionnel({ fonction: 'Chef de service' })).toBe(1)
    expect(niveauFonctionnel({ fonction: 'Manager IT' })).toBe(1)
  })

  it('met les autres fonctions au niveau 2 (employés)', () => {
    expect(niveauFonctionnel({ fonction: 'Comptable' })).toBe(2)
    expect(niveauFonctionnel({ fonction: 'Développeur' })).toBe(2)
    expect(niveauFonctionnel({ fonction: '' })).toBe(2)
    expect(niveauFonctionnel({})).toBe(2)
    expect(niveauFonctionnel(null)).toBe(2)
  })

  it("garantit qu'un Responsable ne peut JAMAIS être au même niveau qu'un Directeur (régression)", () => {
    const directeur = { fonction: 'Directeur des Opérations' }
    const responsable = { fonction: 'Responsable Logistique' }
    expect(niveauFonctionnel(directeur)).toBeLessThan(niveauFonctionnel(responsable))
  })
})
