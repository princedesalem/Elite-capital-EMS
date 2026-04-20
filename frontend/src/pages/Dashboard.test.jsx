import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard, { STATUT_COLORS_MAP } from './Dashboard'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const { mockUser } = vi.hoisted(() => ({
  mockUser: { matricule: '1001', role: 'EMPLOYE', prenom: 'Jean', nom: 'Dupont' },
}))

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }))
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

// Recharts uses ResizeObserver – polyfill for jsdom
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

import api from '../services/api'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockEmploye = {
  matricule: 1001,
  prenom: 'Jean',
  nom: 'Dupont',
  role: 'EMPLOYE',
  fonction: 'Développeur',
  date_embauche: '2021-03-15',
  date_naissance: '1990-06-20',
  solde_conges: 18,
  statut_employe: 'ACTIF',
  sexe: 'M',
}

const mockAnalytics = {
  role: 'EMPLOYE',
  show_org_stats: false,
  mes_operations: {
    total: 10,
    by_statut: [
      { statut: 'validé',     count: 5 },
      { statut: 'en attente', count: 3 },
      { statut: 'refusé',     count: 2 },
    ],
    by_type: [
      { type: 'Congé',      count: 6 },
      { type: 'Permission', count: 4 },
    ],
  },
  perimetre: null,
  organisation: null,
}

const renderDashboard = async () => {
  let result
  await act(async () => {
    result = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Dashboard />
      </MemoryRouter>
    )
    await Promise.resolve()
  })
  return result
}

// ─── Suite 1: STATUT_COLORS_MAP (pure unit) ─────────────────────────────────

describe('STATUT_COLORS_MAP', () => {
  it('returns professional green for validé', () => {
    expect(STATUT_COLORS_MAP['validé']).toBe('#16a34a')
  })

  it('returns professional green for valide (no accent)', () => {
    expect(STATUT_COLORS_MAP['valide']).toBe('#16a34a')
  })

  it('returns professional orange for en attente', () => {
    expect(STATUT_COLORS_MAP['en attente']).toBe('#d97706')
  })

  it('returns professional red for refusé', () => {
    expect(STATUT_COLORS_MAP['refusé']).toBe('#dc2626')
  })

  it('returns professional red for refuse (no accent)', () => {
    expect(STATUT_COLORS_MAP['refuse']).toBe('#dc2626')
  })

  it('returns undefined for unknown statut', () => {
    expect(STATUT_COLORS_MAP['inconnu']).toBeUndefined()
  })

  it('green is visually distinct from orange and red', () => {
    const green  = STATUT_COLORS_MAP['validé']
    const orange = STATUT_COLORS_MAP['en attente']
    const red    = STATUT_COLORS_MAP['refusé']
    expect(green).not.toBe(orange)
    expect(green).not.toBe(red)
    expect(orange).not.toBe(red)
  })
})

// ─── Suite 2: Dashboard renders ─────────────────────────────────────────────

describe('Dashboard — rendu utilisateur', () => {
  beforeEach(() => {
    api.get.mockImplementation((url) => {
      if (url.includes('/employees/')) return Promise.resolve({ data: mockEmploye })
      if (url.includes('/dashboard/analytics/')) return Promise.resolve({ data: mockAnalytics })
      return Promise.resolve({ data: null })
    })
  })

  afterEach(() => { vi.clearAllMocks() })

  it("affiche le nom et prénom de l'employé", async () => {
    await renderDashboard()
    expect(screen.getByText(/Jean/)).toBeInTheDocument()
    expect(screen.getByText(/Dupont/)).toBeInTheDocument()
  })

  it("affiche le matricule dans l'en-tête", async () => {
    await renderDashboard()
    expect(screen.getByText(/1001/)).toBeInTheDocument()
  })

  it("affiche le solde de congés dans l'en-tête", async () => {
    await renderDashboard()
    expect(screen.getByText(/18j/)).toBeInTheDocument()
  })

  it('affiche le statut ACTIF coloré', async () => {
    await renderDashboard()
    expect(screen.getByText('ACTIF')).toBeInTheDocument()
  })
})

// ─── Suite 3: KPI cards ──────────────────────────────────────────────────────

describe('Dashboard — KPI cards Mes Opérations', () => {
  beforeEach(() => {
    api.get.mockImplementation((url) => {
      if (url.includes('/employees/')) return Promise.resolve({ data: mockEmploye })
      if (url.includes('/dashboard/analytics/')) return Promise.resolve({ data: mockAnalytics })
      return Promise.resolve({ data: null })
    })
  })

  afterEach(() => { vi.clearAllMocks() })

  it('KPI Mes Opérations affiche le total', async () => {
    await renderDashboard()
    expect(screen.getByText('Mes Opérations')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('KPI Validées affiche le compteur', async () => {
    await renderDashboard()
    expect(screen.getByText('Validées')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('KPI En Attente affiche le compteur', async () => {
    await renderDashboard()
    expect(screen.getByText('En Attente')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})

// ─── Suite 4: Graphique Statut ───────────────────────────────────────────────

describe('Dashboard — graphique Mes Opérations par Statut', () => {
  beforeEach(() => {
    api.get.mockImplementation((url) => {
      if (url.includes('/employees/')) return Promise.resolve({ data: mockEmploye })
      if (url.includes('/dashboard/analytics/')) return Promise.resolve({ data: mockAnalytics })
      return Promise.resolve({ data: null })
    })
  })

  afterEach(() => { vi.clearAllMocks() })

  it('affiche le titre du graphique statut', async () => {
    await renderDashboard()
    expect(screen.getByText('Mes Opérations par Statut')).toBeInTheDocument()
  })

  it('chaque statut du mock a une couleur dans STATUT_COLORS_MAP', () => {
    // Vérifie que tous les statuts présents dans les données ont une couleur définie
    const statuts = ['validé', 'en attente', 'refusé']
    statuts.forEach(s => {
      expect(STATUT_COLORS_MAP[s]).toBeTruthy()
    })
  })

  it("aucune barre en attente n'utilise du vert (validé)", () => {
    // Test unitaire: la couleur en attente ≠ la couleur validé
    expect(STATUT_COLORS_MAP['en attente']).not.toBe(STATUT_COLORS_MAP['validé'])
  })

  it('la couleur refusé est bien du rouge (commence par #dc ou #c)', () => {
    const color = STATUT_COLORS_MAP['refusé']
    expect(color.toLowerCase()).toMatch(/^#(dc|c[0-9a-f])/)
  })

  it('la couleur validé est bien du vert (commence par #1[0-9a])', () => {
    const color = STATUT_COLORS_MAP['validé']
    expect(color.toLowerCase()).toMatch(/^#1[0-9a-f]/)
  })

  it('la couleur en attente est bien orange (commence par #d97 ou #e6)', () => {
    const color = STATUT_COLORS_MAP['en attente']
    expect(color.toLowerCase()).toMatch(/^#(d9|e[0-9a-f])/)
  })
})

// ─── Suite 5: État de chargement ─────────────────────────────────────────────

describe('Dashboard — état de chargement', () => {
  it('affiche "Chargement..." pendant le fetch', async () => {
    let resolve
    api.get.mockImplementation(() => new Promise(r => { resolve = r }))
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Dashboard />
      </MemoryRouter>
    )
    expect(screen.getByText(/Chargement/i)).toBeInTheDocument()
    resolve({ data: mockEmploye })
  })

  it("affiche un message d'erreur si l'API échoue", async () => {
    api.get.mockRejectedValue({ response: { data: { detail: 'Accès refusé' } } })
    await act(async () => {
      render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Dashboard />
        </MemoryRouter>
      )
      await Promise.resolve()
    })
    expect(screen.getByText(/Accès refusé/i)).toBeInTheDocument()
  })
})
