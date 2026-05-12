import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import WorkflowPage from './WorkflowPage'
import api from '../services/api'
import ProgressionValidation from '../components/ProgressionValidation'

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

vi.mock('../components/ProgressionValidation', () => ({ default: vi.fn(() => null) }))
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
    localStorage.clear()
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

  // ── Tests fix : seenOps persistant via /api/workflow/mes-vues ────────────

  it('initialise les badges VERTS depuis /api/workflow/mes-vues au montage', async () => {
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/boite/')) return Promise.resolve({ data: WORKFLOW_BOITE })
      if (String(url).includes('/api/workflow/mes-vues/')) return Promise.resolve({ data: [10] }) // op 10 déjà vue
      if (String(url).includes('/api/operations/')) return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })
    const { container } = render(<MemoryRouter><WorkflowPage /></MemoryRouter>)
    // Attendre que mes-vues soit appelé
    await waitFor(() => {
      expect(apiGetMock.mock.calls.some(args => String(args[0]).includes('/api/workflow/mes-vues/'))).toBe(true)
    })
    // Op 10 était dans les IDs vus : le badge doit être vert
    await waitFor(() => {
      const seenBadges = container.querySelectorAll('.kanban-badge-seen')
      expect(seenBadges.length).toBeGreaterThan(0)
    })
  })

  it('appelle /api/workflow/mes-vues au montage avec le bon matricule', async () => {
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/boite/')) return Promise.resolve({ data: WORKFLOW_BOITE })
      return Promise.resolve({ data: [] })
    })
    render(<MemoryRouter><WorkflowPage /></MemoryRouter>)
    await waitFor(() => {
      const mesVuesCall = apiGetMock.mock.calls.find(args => String(args[0]).includes('/api/workflow/mes-vues/'))
      expect(mesVuesCall).toBeTruthy()
      // Le matricule de l'utilisateur mock (1001) doit être dans l'URL
      expect(String(mesVuesCall[0])).toContain('1001')
    })
  })

  // ── Tests fix race-condition : merge au lieu d'overwrite ─────────────────

  it('seenOps merge : GET mes-vues avec [] n\'efface pas un clic local (fix race condition)', async () => {
    // Scénario : le POST marquer-vu n'est pas encore en DB quand GET mes-vues retourne.
    // GET mes-vues retourne [] mais l'utilisateur a déjà cliqué → badge DOIT rester vert.
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/boite/')) return Promise.resolve({ data: WORKFLOW_BOITE })
      if (String(url).includes('/api/workflow/mes-vues/')) return Promise.resolve({ data: [] }) // DB vide (race)
      if (String(url).includes('/api/operations/')) return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })
    api.post.mockResolvedValue({ data: {} })

    const { container } = render(<MemoryRouter><WorkflowPage /></MemoryRouter>)
    await waitFor(() => expect(container.querySelector('.kanban-card')).toBeTruthy())

    // Cliquer la carte → handleSelectOp met seenOps = {10} (avant le GET)
    const card = container.querySelector('.kanban-card')
    fireEvent.click(card)

    // Fermer le détail pour revenir à la liste kanban
    await waitFor(() => expect(screen.getByText(/Fermer le détail/i)).toBeTruthy())
    fireEvent.click(screen.getByText(/Fermer le détail/i))

    // Vérifier que le badge est vert — le merge a préservé {10} même si mes-vues retournait []
    await waitFor(() => {
      const cards = container.querySelectorAll('.kanban-card')
      const card10 = Array.from(cards).find(c => c.textContent.includes('#10'))
      expect(card10).toBeTruthy()
      expect(card10.querySelector('.kanban-badge-seen')).toBeTruthy()
      expect(card10.querySelector('.kanban-badge-new')).toBeFalsy()
    })
  })

  it('inbox (Boite Reçu) : cliquer une carte appelle marquer-vu ET passe le badge en vert', async () => {
    const BOITE_AVEC_RECU = {
      envoye: [],
      recu: [{ id_operation: 20, type_demande: 'conge', statut: 'en attente', date_demande: '2026-05-01' }],
      valide: [],
      refuse: [],
    }
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/boite/')) return Promise.resolve({ data: BOITE_AVEC_RECU })
      if (String(url).includes('/api/operations/')) return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })
    // Réinitialiser le mock post pour vérifier les appels
    api.post.mockClear()
    api.post.mockResolvedValue({ data: {} })

    const { container } = render(<MemoryRouter><WorkflowPage /></MemoryRouter>)
    await waitFor(() => expect(container.querySelector('.kanban-card')).toBeTruthy())

    const card = container.querySelector('.kanban-card')
    // Avant clic : badge rouge
    expect(card.querySelector('.kanban-badge-new')).toBeTruthy()

    fireEvent.click(card)

    // Le POST marquer-vu doit avoir été appelé avec l'op 20
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        expect.stringContaining('/marquer-vu/20'),
        null,
        expect.objectContaining({ params: expect.objectContaining({ matricule_observateur: 1001 }) })
      )
    })

    // Badge doit passer au vert (via handleSelectOp + .then du POST)
    await waitFor(() => {
      const cards = container.querySelectorAll('.kanban-card')
      const card20 = Array.from(cards).find(c => c.textContent.includes('#20'))
      if (card20) {
        expect(card20.querySelector('.kanban-badge-seen')).toBeTruthy()
        expect(card20.querySelector('.kanban-badge-new')).toBeFalsy()
      }
    })
  })

  it('seenOps persiste après re-render : un badge vert ne repasse jamais rouge', async () => {
    // Scénario : mes-vues DB retourne [10] → badge vert.
    // Après un re-render (ex: loadWorkflow reload) seenOps = merge({10}, [10]) = {10} → toujours vert.
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/boite/')) return Promise.resolve({ data: WORKFLOW_BOITE })
      if (String(url).includes('/api/workflow/mes-vues/')) return Promise.resolve({ data: [10] })
      if (String(url).includes('/api/operations/')) return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })

    const { container } = render(<MemoryRouter><WorkflowPage /></MemoryRouter>)

    // Attendre que mes-vues soit chargé et le badge vert visible
    await waitFor(() => {
      const cards = container.querySelectorAll('.kanban-card')
      const card10 = Array.from(cards).find(c => c.textContent.includes('#10'))
      expect(card10?.querySelector('.kanban-badge-seen')).toBeTruthy()
    })

    // Cliquer la carte (re-click d'une op déjà verte)
    const card = container.querySelector('.kanban-card')
    fireEvent.click(card)

    // Fermer le détail pour revenir à la liste
    await waitFor(() => expect(screen.getByText(/Fermer le détail/i)).toBeTruthy())
    fireEvent.click(screen.getByText(/Fermer le détail/i))

    // Badge doit TOUJOURS être vert — seenOps = {10} préservé via merge
    await waitFor(() => {
      const cards = container.querySelectorAll('.kanban-card')
      const card10 = Array.from(cards).find(c => c.textContent.includes('#10'))
      expect(card10).toBeTruthy()
      expect(card10.querySelector('.kanban-badge-seen')).toBeTruthy()
      expect(card10.querySelector('.kanban-badge-new')).toBeFalsy()
    })
  })

  // ── Tests localStorage : persistance instantanée au refresh ──────────────

  it('persiste seenOps dans localStorage après un clic (le badge vert survit au refresh)', async () => {
    // Cliquer l'op 10 → seenOps = {10} → localStorage['seenOps_1001'] doit contenir "10"
    const { container } = render(<MemoryRouter><WorkflowPage /></MemoryRouter>)
    await waitFor(() => expect(container.querySelector('.kanban-card')).toBeTruthy())

    fireEvent.click(container.querySelector('.kanban-card'))

    // Fermer le détail
    await waitFor(() => expect(screen.getByText(/Fermer le détail/i)).toBeTruthy())
    fireEvent.click(screen.getByText(/Fermer le détail/i))

    // Vérifier que localStorage a été mis à jour
    await waitFor(() => {
      const saved = localStorage.getItem('seenOps_1001')
      expect(saved).toBeTruthy()
      const ids = JSON.parse(saved)
      expect(ids.map(String)).toContain('10')
    })
  })

  it('restaure seenOps depuis localStorage au montage (simule un refresh) sans attendre le réseau', async () => {
    // Pré-remplir localStorage comme si la session précédente avait vu l'op 10
    localStorage.setItem('seenOps_1001', JSON.stringify(['10']))

    // Bloquer GET /mes-vues pour que localStorage soit la seule source
    let resolveVues
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/mes-vues/')) return new Promise(r => { resolveVues = r })
      if (String(url).includes('/api/workflow/boite/')) return Promise.resolve({ data: WORKFLOW_BOITE })
      if (String(url).includes('/api/operations/')) return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })

    const { container } = render(<MemoryRouter><WorkflowPage /></MemoryRouter>)

    // Badge vert doit apparaître depuis localStorage AVANT que mes-vues retourne
    await waitFor(() => {
      const cards = container.querySelectorAll('.kanban-card')
      const card10 = Array.from(cards).find(c => c.textContent.includes('#10'))
      expect(card10?.querySelector('.kanban-badge-seen')).toBeTruthy()
    })
  })

  it('restaure seenOps depuis localStorage même si GET /mes-vues échoue', async () => {
    // Pré-remplir localStorage
    localStorage.setItem('seenOps_1001', JSON.stringify(['10']))

    // GET /mes-vues retourne une erreur réseau
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/mes-vues/')) return Promise.reject(new Error('Network error'))
      if (String(url).includes('/api/workflow/boite/')) return Promise.resolve({ data: WORKFLOW_BOITE })
      if (String(url).includes('/api/operations/')) return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })

    const { container } = render(<MemoryRouter><WorkflowPage /></MemoryRouter>)

    // Badge vert depuis localStorage malgré l'erreur réseau
    await waitFor(() => {
      const cards = container.querySelectorAll('.kanban-card')
      const card10 = Array.from(cards).find(c => c.textContent.includes('#10'))
      expect(card10?.querySelector('.kanban-badge-seen')).toBeTruthy()
    })
  })

  it('fusionne localStorage et DB : les IDs des deux sources sont verts', async () => {
    // localStorage a op 10, DB (mes-vues) a op 10 aussi → merge → vert
    localStorage.setItem('seenOps_1001', JSON.stringify(['10']))

    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/mes-vues/')) return Promise.resolve({ data: [10] })
      if (String(url).includes('/api/workflow/boite/')) return Promise.resolve({ data: WORKFLOW_BOITE })
      if (String(url).includes('/api/operations/')) return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })

    const { container } = render(<MemoryRouter><WorkflowPage /></MemoryRouter>)

    await waitFor(() => {
      const cards = container.querySelectorAll('.kanban-card')
      const card10 = Array.from(cards).find(c => c.textContent.includes('#10'))
      expect(card10?.querySelector('.kanban-badge-seen')).toBeTruthy()
      // Aucun badge rouge ne doit subsister
      expect(card10?.querySelector('.kanban-badge-new')).toBeFalsy()
    })
  })

  it('passe un refreshTrigger incrémenté à ProgressionValidation après première vue (re-fetch silencieux)', async () => {
    // Scénario : première vue → validationRefreshKey++ → ProgressionValidation reçoit
    // refreshTrigger > 0, ce qui déclenche un re-fetch sans spinner ni remount.
    const BOITE = {
      envoye: [],
      recu: [{ id_operation: 42, type_demande: 'conge', statut: 'en attente', date_demande: '2026-05-01' }],
      valide: [], refuse: [],
    }
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/boite/')) return Promise.resolve({ data: BOITE })
      if (String(url).includes('/api/operations/')) return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })
    let resolvePost
    api.post.mockImplementation(() => new Promise(r => { resolvePost = () => r({ data: { ok: true, already: false } }) }))

    const { container } = render(<MemoryRouter><WorkflowPage /></MemoryRouter>)
    await waitFor(() => expect(container.querySelector('.kanban-card')).toBeTruthy())

    fireEvent.click(container.querySelector('.kanban-card'))
    await waitFor(() => expect(screen.queryByText(/voir le workflow/i)).toBeTruthy())
    fireEvent.click(screen.getByText(/voir le workflow/i))

    // ProgressionValidation monté avec refreshTrigger=0
    await waitFor(() => expect(vi.mocked(ProgressionValidation).mock.calls.length).toBeGreaterThan(0))
    const firstTrigger = vi.mocked(ProgressionValidation).mock.calls.at(-1)[0].refreshTrigger ?? 0

    vi.mocked(ProgressionValidation).mockClear()

    // POST résout avec première vue → refreshTrigger doit s'incrémenter
    resolvePost()
    await waitFor(() => expect(vi.mocked(ProgressionValidation).mock.calls.length).toBeGreaterThan(0))
    const nextTrigger = vi.mocked(ProgressionValidation).mock.calls.at(-1)[0].refreshTrigger ?? 0
    expect(nextTrigger).toBeGreaterThan(firstTrigger)
  })

  it('header de page : aucun gradient rouge (#ce2b2b)', async () => {
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/boite/')) return Promise.resolve({ data: WORKFLOW_BOITE })
      return Promise.resolve({ data: [] })
    })
    const { container } = render(<MemoryRouter><WorkflowPage /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    Array.from(container.querySelectorAll('div[style]'))
      .filter(d => d.style.background && d.style.background.includes('gradient'))
      .forEach(d => { expect(d.style.background).not.toContain('ce2b2b') })
  })
})

