import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import CongesPage from './CongesPage'
import PermissionsPage from './PermissionsPage'
import FraisPage from './FraisPage'
import MissionsPage from './MissionsPage'
import SortiesPage from './SortiesPage'

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
const apiPutMock = vi.fn()
const apiDeleteMock = vi.fn()
let currentRole = 'RESPONSABLE'

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
    user: {
      matricule: 123,
      sub: 123,
      role: currentRole,
      prenom: 'Jean',
      nom: 'Dupont',
    },
  }),
}))

vi.mock('../components/WorkflowModal', () => ({
  default: () => null,
}))

function makeWorkflowItem(id, typeDemande) {
  return {
    id_operation: id,
    type_demande: typeDemande,
    statut: 'en attente',
    date_demande: '2026-03-20',
    date_debut: '2026-03-20',
    date_fin: '2026-03-20',
    motif: 'Motif test',
    demandeur: { prenom: 'Aline', nom: 'Martin' },
  }
}

function makeBoite(typeDemande) {
  const pending = makeWorkflowItem(1, typeDemande)
  const toApprove = makeWorkflowItem(2, typeDemande)
  const validatedByMe = makeWorkflowItem(3, typeDemande)
  const refused = makeWorkflowItem(4, typeDemande)

  toApprove.statut = 'en attente'
  validatedByMe.statut = 'en attente'
  refused.statut = 'refusé'

  return {
    envoye: [pending],
    recu: [toApprove],
    valide: [validatedByMe],
    refuse: [refused],
  }
}

function setupApiForPage(typeDemande) {
  apiGetMock.mockImplementation((url) => {
    if (String(url).includes('/api/workflow/boite/')) {
      return Promise.resolve({ data: makeBoite(typeDemande) })
    }

    if (String(url).includes('/api/sorties/')) {
      return Promise.resolve({
        data: [
          { id_operation: 1, date_sortie: '2026-03-20', heure_sortie: '08:00:00', heure_retour: '18:00:00', commentaire: 'RAS' },
          { id_operation: 2, date_sortie: '2026-03-20', heure_sortie: '08:00:00', heure_retour: '18:00:00', commentaire: 'RAS' },
          { id_operation: 3, date_sortie: '2026-03-20', heure_sortie: '08:00:00', heure_retour: '18:00:00', commentaire: 'RAS' },
          { id_operation: 4, date_sortie: '2026-03-20', heure_sortie: '08:00:00', heure_retour: '18:00:00', commentaire: 'RAS' },
        ],
      })
    }

    if (String(url).includes('/api/conges/historique/')) return Promise.resolve({ data: [] })
    if (String(url).includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 10 } })
    if (String(url).includes('/api/missions/mes-missions/')) return Promise.resolve({ data: [] })
    if (String(url).includes('/employees/')) return Promise.resolve({ data: { solde_conges: 10 } })

    return Promise.resolve({ data: [] })
  })

  apiPostMock.mockResolvedValue({ data: {} })
  apiPutMock.mockResolvedValue({ data: {} })
  apiDeleteMock.mockResolvedValue({ data: {} })
}

function setupApiForSortiesWithValidatedRecu() {
  apiGetMock.mockImplementation((url) => {
    if (String(url).includes('/api/workflow/boite/')) {
      const boite = makeBoite('sortie')
      boite.recu = [{ ...makeWorkflowItem(9, 'sortie'), statut: 'validé' }]
      return Promise.resolve({ data: boite })
    }
    if (String(url).includes('/api/sorties/')) {
      return Promise.resolve({
        data: [
          { id_operation: 1, date_sortie: '2026-03-20', heure_sortie: '08:00:00', heure_retour: '18:00:00', commentaire: 'RAS' },
          { id_operation: 9, date_sortie: '2026-03-20', heure_sortie: '08:00:00', heure_retour: '18:00:00', commentaire: 'RAS' },
        ],
      })
    }
    return Promise.resolve({ data: [] })
  })
}

async function assertCanonicalStatusFilterOptions() {
  const statusOption = await screen.findByRole('option', { name: /Tous statuts/i })
  const select = statusOption.closest('select')
  expect(select).toBeInTheDocument()

  const optionLabels = within(select).getAllByRole('option').map((option) => option.textContent)

  expect(optionLabels).toEqual(['Tous statuts', 'en attente', 'validé', 'refusé'])
  expect(optionLabels).not.toContain('en cours')
  expect(optionLabels).not.toContain('annulé')
}

async function assertRecuTabShowsCanonicalBadges() {
  fireEvent.click(screen.getByRole('button', { name: /Re[çc]u/i }))

  await waitFor(() => {
    expect(screen.getAllByText('en attente', { selector: 'span' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('refusé', { selector: 'span' }).length).toBeGreaterThan(0)
  })
}

async function assertEnvoyeHidesSenderColumnAndRecuShowsIt() {
  await screen.findByRole('button', { name: /Envoy[eé]/i })
  expect(screen.queryByText(/Envoy[eé] par/i)).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Re[çc]u/i }))
  await waitFor(() => {
    expect(screen.getByText(/Envoy[eé] par/i)).toBeInTheDocument()
  })
}

const pages = [
  { name: 'Conges', Component: CongesPage, typeDemande: 'conge' },
  { name: 'Permissions', Component: PermissionsPage, typeDemande: 'permission' },
  { name: 'Frais', Component: FraisPage, typeDemande: 'frais' },
  { name: 'Missions', Component: MissionsPage, typeDemande: 'mission' },
  { name: 'Sorties', Component: SortiesPage, typeDemande: 'sortie' },
]

describe('Workflow status filters and badges', () => {
  beforeEach(() => {
    currentRole = 'RESPONSABLE'
    apiGetMock.mockReset()
    apiPostMock.mockReset()
    apiPutMock.mockReset()
    apiDeleteMock.mockReset()
  })

  it.each(pages)('$name page keeps canonical status options and strict final-status display', async ({ Component, typeDemande }) => {
    setupApiForPage(typeDemande)

    render(<MemoryRouter><Component /></MemoryRouter>)

    await assertCanonicalStatusFilterOptions()
    await assertEnvoyeHidesSenderColumnAndRecuShowsIt()
    await assertRecuTabShowsCanonicalBadges()
  })
})

describe('Sorties responsive table structure', () => {
  beforeEach(() => {
    currentRole = 'RESPONSABLE'
    apiGetMock.mockReset()
    apiPostMock.mockReset()
    apiPutMock.mockReset()
    apiDeleteMock.mockReset()
    setupApiForPage('sortie')
  })

  const viewports = [360, 768, 1024, 1440]

  it.each(viewports)('keeps table without horizontal-scroll container at width %spx', async (viewportWidth) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: viewportWidth })
    window.dispatchEvent(new Event('resize'))

    render(<MemoryRouter><SortiesPage /></MemoryRouter>)

    const table = await screen.findByRole('table')
    expect(table).toHaveStyle({ width: '100%' })
    expect(table).toHaveStyle({ tableLayout: 'fixed' })

    const wrapper = table.parentElement
    expect(wrapper?.style?.overflowX).not.toBe('auto')
    expect(table.style.minWidth).toBe('')
  })
})

describe('Sorties Activer action visibility', () => {
  beforeEach(() => {
    currentRole = 'RESPONSABLE'
    apiGetMock.mockReset()
    apiPostMock.mockReset()
    apiPutMock.mockReset()
    apiDeleteMock.mockReset()
  })

  it('shows Activer in Envoye tab for non-RH users', async () => {
    // Activer button only shows when item is validated and etat === '--'
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/boite/')) {
        return Promise.resolve({ data: {
          envoye: [{ ...makeWorkflowItem(1, 'sortie'), statut: 'validé', validation_terminee: true }],
          recu: [], valide: [], refuse: [],
        } })
      }
      if (String(url).includes('/api/sorties/'))
        return Promise.resolve({ data: [{ id_operation: 1, date_sortie: '2026-03-20', heure_sortie: '08:00:00', heure_retour: '18:00:00', commentaire: 'RAS' }] })
      return Promise.resolve({ data: [] })
    })
    render(<MemoryRouter><SortiesPage /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Activer' })).toBeInTheDocument()
    })
  })

  it('shows Activer in Recu tab only for RH/Admin', async () => {
    // For RH activation, item must be validated with activation_demandeur_fait=true, activation_rh_fait=false (AttenteRH)
    function setupRecu() {
      apiGetMock.mockImplementation((url) => {
        if (String(url).includes('/api/workflow/boite/')) {
          return Promise.resolve({ data: {
            envoye: [],
            recu: [{ ...makeWorkflowItem(9, 'sortie'), statut: 'validé', validation_terminee: true, activation_demandeur_fait: true, activation_rh_fait: false }],
            valide: [], refuse: [],
          } })
        }
        if (String(url).includes('/api/sorties/'))
          return Promise.resolve({ data: [{ id_operation: 9, date_sortie: '2026-03-20', heure_sortie: '08:00:00', heure_retour: '18:00:00', commentaire: 'RAS' }] })
        return Promise.resolve({ data: [] })
      })
    }

    setupRecu()
    render(<MemoryRouter><SortiesPage /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: /Recu/i }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Activer' })).not.toBeInTheDocument()
    })
  })

  it('RH user sees Activer in Recu tab for AttenteRH items', async () => {
    currentRole = 'RH'
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/boite/')) {
        return Promise.resolve({ data: {
          envoye: [],
          recu: [{ ...makeWorkflowItem(9, 'sortie'), statut: 'validé', validation_terminee: true, activation_demandeur_fait: true, activation_rh_fait: false }],
          valide: [], refuse: [],
        } })
      }
      if (String(url).includes('/api/sorties/'))
        return Promise.resolve({ data: [{ id_operation: 9, date_sortie: '2026-03-20', heure_sortie: '08:00:00', heure_retour: '18:00:00', commentaire: 'RAS' }] })
      return Promise.resolve({ data: [] })
    })
    render(<MemoryRouter><SortiesPage /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: /Recu/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Activer' })).toBeInTheDocument()
    })
  })
})
