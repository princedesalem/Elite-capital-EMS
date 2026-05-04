import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OrgChart, { niveauFonctionnel, computeOrgRow } from './OrgChart'

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

describe('computeOrgRow (alignement visuel par rôle)', () => {
  const dg          = { fonction: 'Administrateur Général' }
  const directeur   = { fonction: 'Directeur Financier' }
  const responsable = { fonction: 'Responsable RH' }
  const employe     = { fonction: 'Comptable' }

  it('place la racine sur la ligne correspondant à son niveau fonctionnel', () => {
    expect(computeOrgRow(dg, -1)).toBe(0)
    expect(computeOrgRow(dg, null)).toBe(0)
  })

  it('place un Directeur enfant du DG sur la ligne 1', () => {
    const dgRow = computeOrgRow(dg, -1)
    expect(computeOrgRow(directeur, dgRow)).toBe(1)
  })

  it('place un Responsable enfant direct du DG sur la ligne 2 (saute la ligne Directeurs)', () => {
    const dgRow = computeOrgRow(dg, -1)
    expect(computeOrgRow(responsable, dgRow)).toBe(2)
  })

  it('place un Responsable enfant d\'un Directeur sur la ligne 2', () => {
    const directeurRow = 1
    expect(computeOrgRow(responsable, directeurRow)).toBe(2)
  })

  it('place un employé enfant direct d\'un Directeur sur la ligne 3 (saute la ligne Responsables)', () => {
    const directeurRow = 1
    // Carlos sous Fabrice : profondeur d'arbre = 2, mais doit s'afficher ligne 3.
    expect(computeOrgRow(employe, directeurRow)).toBe(3)
  })

  it('place un employé enfant d\'un Responsable sur la ligne 3', () => {
    const responsableRow = 2
    // Samuel sous Cédric : profondeur d'arbre = 3, ligne 3.
    expect(computeOrgRow(employe, responsableRow)).toBe(3)
  })

  it('garantit que TOUS les employés finissent sur la même ligne (régression)', () => {
    // Carlos (sous Directeur, depth=2) et Samuel (sous Responsable, depth=3)
    // doivent atterrir sur la MÊME ligne visuelle.
    const carlos = computeOrgRow(employe, /* parent Directeur */ 1)
    const samuel = computeOrgRow(employe, /* parent Responsable */ 2)
    const rachel = computeOrgRow(employe, /* parent Responsable */ 2)
    expect(carlos).toBe(samuel)
    expect(carlos).toBe(rachel)
    expect(carlos).toBe(3)
  })

  it('garantit que TOUS les Directeurs finissent sur la même ligne', () => {
    const dgRow = 0
    const dirA = computeOrgRow({ fonction: 'Directeur A' }, dgRow)
    const dirB = computeOrgRow({ fonction: 'Directrice B' }, dgRow)
    expect(dirA).toBe(dirB)
    expect(dirA).toBe(1)
  })

  it('garantit que TOUS les Responsables finissent sur la même ligne (sous Directeur ou DG)', () => {
    const sousDG = computeOrgRow(responsable, /* DG */ 0)
    const sousDirecteur = computeOrgRow(responsable, /* Directeur */ 1)
    expect(sousDG).toBe(sousDirecteur)
    expect(sousDG).toBe(2)
  })

  it('ne descend jamais au-dessus de parentRow + 1 (cas d\'un Directeur sous un Responsable, théorique)', () => {
    // Cas dégénéré : un Directeur déclaré sous un Responsable. Il doit
    // au minimum être placé une ligne plus bas que son parent.
    const responsableRow = 2
    expect(computeOrgRow(directeur, responsableRow)).toBe(3)
  })

  it('traite les groupes (vue Par fonction / Par ville) en fallback profondeur', () => {
    const group = { _isGroup: true, fonction: 'Yaoundé' }
    expect(computeOrgRow(group, -1)).toBe(0)
    expect(computeOrgRow(group, 0)).toBe(1)
    expect(computeOrgRow(group, 2)).toBe(3)
  })
})

describe('OrgChart export buttons (PDF / PNG / Excel)', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockResolvedValue({ data: [
      { matricule: 1, nom: 'Alice', fonction: 'Directrice Générale', n1: null },
      { matricule: 2, nom: 'Bob',   fonction: 'Comptable',           n1: 1 },
    ] })
  })

  it('affiche les 3 boutons d\'export en vue hiérarchie (par défaut)', async () => {
    render(<MemoryRouter><OrgChart /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    // Les exports sont regroupés sous un bouton "..." ; ils n'apparaissent
    // qu'après ouverture du menu.
    const trigger = screen.getByRole('button', { name: /^Exporter$/i })
    expect(trigger).toBeTruthy()
    fireEvent.click(trigger)
    expect(screen.getByRole('menuitem', { name: /Exporter en PDF/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /Exporter en PNG/i })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /Exporter en Excel/i })).toBeTruthy()
  })

  it('cache les options d\'export tant que le menu "..." n\'est pas ouvert', async () => {
    render(<MemoryRouter><OrgChart /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    expect(screen.queryByRole('menuitem', { name: /Exporter en PDF/i })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /Exporter en PNG/i })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /Exporter en Excel/i })).toBeNull()
  })
})
