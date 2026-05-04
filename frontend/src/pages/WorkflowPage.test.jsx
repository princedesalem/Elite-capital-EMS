import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import WorkflowPage from './WorkflowPage'

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

vi.mock('../components/ProgressionValidation', () => ({ default: () => null }))
vi.mock('../components/CommentairesMission', () => ({ default: () => null }))

const WORKFLOW_BOITE = {
  envoye: [{ id_operation: 10, type_demande: 'conge', statut: 'en attente', date_demande: '2026-05-01' }],
  recu: [],
  valide: [],
  refuse: [],
}

describe('WorkflowPage', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/boite/')) return Promise.resolve({ data: WORKFLOW_BOITE })
      if (String(url).includes('/api/operations/')) return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><WorkflowPage /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows workflow section headings', async () => {
    render(<MemoryRouter><WorkflowPage /></MemoryRouter>)
    await waitFor(() => {
      const mes = screen.queryAllByText(/mes demandes/i)
      const valider = screen.queryAllByText(/à valider/i)
      expect(mes.length + valider.length).toBeGreaterThan(0)
    })
  })

  it('affiche un point ROUGE « nouveau » sur chaque carte non encore consultée', async () => {
    const { container } = render(<MemoryRouter><WorkflowPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText(/#10/)).toBeTruthy())
    const badges = container.querySelectorAll('.kanban-badge-new')
    expect(badges.length).toBeGreaterThan(0)
    // La pastille doit exister et NE PAS être verte (pas kanban-badge-seen)
    const seenBadges = container.querySelectorAll('.kanban-badge-seen')
    expect(seenBadges.length).toBe(0)
  })

  it('change le badge de ROUGE (écarté) à VERT (vu) après clic sur la carte', async () => {
    const { container } = render(<MemoryRouter><WorkflowPage /></MemoryRouter>)
    await waitFor(() => expect(container.querySelector('.kanban-card')).toBeTruthy())
    const card = container.querySelector('.kanban-card')
    // Avant clic : badge rouge
    expect(card.querySelector('.kanban-badge-new')).toBeTruthy()
    expect(card.querySelector('.kanban-badge-seen')).toBeFalsy()
    fireEvent.click(card)
    // La sélection ouvre le panneau détail ; on le ferme pour revenir au kanban.
    await waitFor(() => expect(screen.getByText(/Fermer le détail/i)).toBeTruthy())
    fireEvent.click(screen.getByText(/Fermer le détail/i))
    await waitFor(() => {
      const cards = container.querySelectorAll('.kanban-card')
      const cardWith10 = Array.from(cards).find(c => c.textContent.includes('#10'))
      expect(cardWith10).toBeTruthy()
      // Après clic : badge vert
      expect(cardWith10.querySelector('.kanban-badge-seen')).toBeTruthy()
      expect(cardWith10.querySelector('.kanban-badge-new')).toBeFalsy()
    })
  })

  it('déduplicate les opérations : clés dupliquées dans recu ne génèrent pas de warning', async () => {
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/boite/')) {
        return Promise.resolve({ data: {
          envoye: [],
          recu: [],
          valide: [],
          refuse: [
            { id_operation: 35, type_demande: 'conge', statut: 'refusé', date_demande: '2026-01-01' },
            { id_operation: 35, type_demande: 'conge', statut: 'refusé', date_demande: '2026-01-01' },
          ],
        } })
      }
      if (String(url).includes('/api/operations/')) return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<MemoryRouter><WorkflowPage /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    // Après déduplication, id=35 n'apparaît qu'une seule fois
    const warnMessages = warnSpy.mock.calls.map(a => String(a[0]))
    const dupKeyWarnings = warnMessages.filter(m => m.includes('rr-35') || (m.includes('duplicate') && m.includes('key')))
    expect(dupKeyWarnings.length).toBe(0)
    warnSpy.mockRestore()
  })
})
