import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CongesPage from './CongesPage'

const apiGetMock = vi.fn((url) => {
  if (url.includes('/api/conges/historique/')) return Promise.resolve({ data: [] })
  if (url.includes('/api/workflow/boite/')) return Promise.resolve({ data: {} })
  if (url.includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 12 } })
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

describe('CongesPage', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((url) => {
      if (url.includes('/api/conges/historique/')) return Promise.resolve({ data: [] })
      if (url.includes('/api/workflow/boite/')) return Promise.resolve({ data: {} })
      if (url.includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 12 } })
      return Promise.resolve({ data: {} })
    })
  })

  it('calcule la duree ouvrable en excluant samedi et dimanche', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <CongesPage />
        </MemoryRouter>
      )
      await Promise.resolve()
    })

    fireEvent.click(screen.getByRole('button', { name: /nouvelle demande/i }))

    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-03-30' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-04-05' } })

    expect(screen.getByText('5 jour(s)')).toBeInTheDocument()
  })

  it('affiche le badge modifiee dans la liste workflow', async () => {
    apiGetMock.mockImplementation((url) => {
      if (url.includes('/api/conges/historique/')) return Promise.resolve({ data: [] })
      if (url.includes('/api/workflow/boite/')) {
        return Promise.resolve({
          data: {
            envoye: [
              {
                id_operation: 77,
                type_demande: 'conge',
                statut: 'en attente',
                motif: 'Repos',
                date_debut: '2026-04-06',
                date_fin: '2026-04-08',
                date_demande: '2026-04-01',
                est_modifie: true,
                date_modification: '2026-04-02T09:30:00',
              },
            ],
            recu: [],
            valide: [],
            refuse: [],
          },
        })
      }
      if (url.includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 12 } })
      return Promise.resolve({ data: {} })
    })

    await act(async () => {
      render(
        <MemoryRouter>
          <CongesPage />
        </MemoryRouter>
      )
      await Promise.resolve()
    })

    expect(screen.getByText('Modifiée')).toBeInTheDocument()
  })

  it('masque Modifier et Annuler si statut refusé (tab envoyé)', async () => {
    apiGetMock.mockImplementation((url) => {
      if (url.includes('/api/conges/historique/')) return Promise.resolve({ data: [] })
      if (url.includes('/api/workflow/boite/')) {
        return Promise.resolve({
          data: {
            envoye: [{
              id_operation: 100,
              type_demande: 'conge',
              statut: 'refusé',
              motif: 'Repos',
              date_debut: '2026-05-01',
              date_fin: '2026-05-05',
              date_demande: '2026-04-20',
            }],
            recu: [], valide: [], refuse: [],
          },
        })
      }
      if (url.includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 12 } })
      return Promise.resolve({ data: {} })
    })

    await act(async () => {
      render(<MemoryRouter><CongesPage /></MemoryRouter>)
      await Promise.resolve()
    })

    expect(screen.queryByRole('button', { name: /modifier/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /annuler/i })).not.toBeInTheDocument()
  })

  it('masque Approuver/Refuser si statut déjà validé (tab reçu)', async () => {
    apiGetMock.mockImplementation((url) => {
      if (url.includes('/api/conges/historique/')) return Promise.resolve({ data: [] })
      if (url.includes('/api/workflow/boite/')) {
        return Promise.resolve({
          data: {
            envoye: [],
            recu: [{
              id_operation: 200,
              type_demande: 'conge',
              statut: 'validé',
              motif: 'Vacances',
              date_debut: '2026-06-01',
              date_fin: '2026-06-05',
              date_demande: '2026-05-20',
            }],
            valide: [], refuse: [],
          },
        })
      }
      if (url.includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 12 } })
      return Promise.resolve({ data: {} })
    })

    await act(async () => {
      render(<MemoryRouter><CongesPage /></MemoryRouter>)
      await Promise.resolve()
    })

    // Aller sur l'onglet reçu
    fireEvent.click(screen.getByText(/Re[çc]u/i))

    expect(screen.queryByRole('button', { name: /approuver/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /refuser/i })).not.toBeInTheDocument()
  })

  it('affiche Retour anticipé quand etat Active et date_fin future', async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)
    const futureDateStr = futureDate.toISOString().split('T')[0]

    apiGetMock.mockImplementation((url) => {
      if (url.includes('/api/conges/historique/')) return Promise.resolve({ data: [] })
      if (url.includes('/api/workflow/boite/')) {
        return Promise.resolve({
          data: {
            envoye: [{
              id_operation: 300,
              type_demande: 'conge',
              statut: 'validé',
              validation_terminee: true,
              motif: 'Voyage',
              date_debut: '2026-03-01',
              date_fin: futureDateStr,
              date_demande: '2026-02-20',
              activation_demandeur_fait: true,
              activation_rh_fait: true,
              activation_complete: true,
              cloture_complete: false,
            }],
            recu: [], valide: [], refuse: [],
          },
        })
      }
      if (url.includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 12 } })
      return Promise.resolve({ data: {} })
    })

    await act(async () => {
      render(<MemoryRouter><CongesPage /></MemoryRouter>)
      await Promise.resolve()
    })

    expect(screen.getByRole('button', { name: /clôturer/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retour anticipé/i })).toBeInTheDocument()
  })

  it('masque Retour anticipé quand date_fin passée', async () => {
    apiGetMock.mockImplementation((url) => {
      if (url.includes('/api/conges/historique/')) return Promise.resolve({ data: [] })
      if (url.includes('/api/workflow/boite/')) {
        return Promise.resolve({
          data: {
            envoye: [{
              id_operation: 301,
              type_demande: 'conge',
              statut: 'validé',
              validation_terminee: true,
              motif: 'Voyage',
              date_debut: '2025-01-01',
              date_fin: '2025-01-10',
              date_demande: '2024-12-20',
              activation_demandeur_fait: true,
              activation_rh_fait: true,
              activation_complete: true,
              cloture_complete: false,
            }],
            recu: [], valide: [], refuse: [],
          },
        })
      }
      if (url.includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 12 } })
      return Promise.resolve({ data: {} })
    })

    await act(async () => {
      render(<MemoryRouter><CongesPage /></MemoryRouter>)
      await Promise.resolve()
    })

    expect(screen.getByRole('button', { name: /clôturer/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retour anticipé/i })).not.toBeInTheDocument()
  })

  it('affiche dual badges Activé + Clôturé quand cloture_complete', async () => {
    apiGetMock.mockImplementation((url) => {
      if (url.includes('/api/conges/historique/')) return Promise.resolve({ data: [] })
      if (url.includes('/api/workflow/boite/')) {
        return Promise.resolve({
          data: {
            envoye: [{
              id_operation: 400,
              type_demande: 'conge',
              statut: 'validé',
              validation_terminee: true,
              motif: 'Dual badges test',
              date_debut: '2026-03-01',
              date_fin: '2026-03-10',
              date_demande: '2026-02-20',
              activation_demandeur_fait: true,
              activation_rh_fait: true,
              activation_complete: true,
              cloture_demandeur_fait: true,
              cloture_complete: true,
              activation_date_demandeur: '2026-03-01T08:00:00',
              activation_date_rh: '2026-03-01T09:00:00',
              cloture_date_demandeur: '2026-03-10T08:00:00',
              cloture_date_rh: '2026-03-10T09:00:00',
            }],
            recu: [], valide: [], refuse: [],
          },
        })
      }
      if (url.includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 12 } })
      return Promise.resolve({ data: {} })
    })

    await act(async () => {
      render(<MemoryRouter><CongesPage /></MemoryRouter>)
      await Promise.resolve()
    })

    expect(screen.getByText('Activé')).toBeInTheDocument()
    expect(screen.getByText('Clôturé')).toBeInTheDocument()
  })

  it('affiche "En attente confirmation RH" au lieu des boutons quand cloture_demandeur_fait', async () => {
    apiGetMock.mockImplementation((url) => {
      if (url.includes('/api/conges/historique/')) return Promise.resolve({ data: [] })
      if (url.includes('/api/workflow/boite/')) {
        return Promise.resolve({
          data: {
            envoye: [{
              id_operation: 401,
              type_demande: 'conge',
              statut: 'validé',
              validation_terminee: true,
              motif: 'Button lock test',
              date_debut: '2026-03-01',
              date_fin: '2026-04-15',
              date_demande: '2026-02-20',
              activation_demandeur_fait: true,
              activation_rh_fait: true,
              activation_complete: true,
              cloture_demandeur_fait: true,
              cloture_complete: false,
            }],
            recu: [], valide: [], refuse: [],
          },
        })
      }
      if (url.includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 12 } })
      return Promise.resolve({ data: {} })
    })

    await act(async () => {
      render(<MemoryRouter><CongesPage /></MemoryRouter>)
      await Promise.resolve()
    })

    expect(screen.getByText('En attente confirmation RH')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /clôturer/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retour anticipé/i })).not.toBeInTheDocument()
  })

  it('affiche dual badges Activé + Clôture en att. RH quand cloture_demandeur_fait non complète', async () => {
    apiGetMock.mockImplementation((url) => {
      if (url.includes('/api/conges/historique/')) return Promise.resolve({ data: [] })
      if (url.includes('/api/workflow/boite/')) {
        return Promise.resolve({
          data: {
            envoye: [{
              id_operation: 402,
              type_demande: 'conge',
              statut: 'validé',
              validation_terminee: true,
              motif: 'Partial cloture test',
              date_debut: '2026-03-01',
              date_fin: '2026-04-15',
              date_demande: '2026-02-20',
              activation_demandeur_fait: true,
              activation_rh_fait: true,
              activation_complete: true,
              cloture_demandeur_fait: true,
              cloture_complete: false,
              cloture_date_demandeur: '2026-03-10T08:00:00',
            }],
            recu: [], valide: [], refuse: [],
          },
        })
      }
      if (url.includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 12 } })
      return Promise.resolve({ data: {} })
    })

    await act(async () => {
      render(<MemoryRouter><CongesPage /></MemoryRouter>)
      await Promise.resolve()
    })

    expect(screen.getByText('Activé')).toBeInTheDocument()
    expect(screen.getByText('Clôture en att. RH')).toBeInTheDocument()
  })
})
