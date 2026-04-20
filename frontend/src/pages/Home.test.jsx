import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home'

// hoisted so it's available inside vi.mock factory closures
const { mockUser } = vi.hoisted(() => ({
  mockUser: { matricule: '1001', role: 'EMPLOYE', prenom: 'Jean', nom: 'Test' },
}))

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
  }),
}))

const renderHome = async () => {
  let result
  await act(async () => {
    result = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Home />
      </MemoryRouter>
    )
    // flush all microtasks (mocked API calls) so component settles
    await Promise.resolve()
  })
  return result
}

describe('Home — Demander un congé modal', () => {
  it('shows the Demander un congé button', async () => {
    await renderHome()
    expect(screen.getByRole('button', { name: /demander un cong/i })).toBeInTheDocument()
  })

  it('opens the leave modal when clicking the button', async () => {
    await renderHome()
    fireEvent.click(screen.getByRole('button', { name: /demander un cong/i }))
    expect(screen.getByText('Nouvelle demande de congé')).toBeInTheDocument()
  })

  it('modal has Date de début, Date de fin, Durée and Motif fields', async () => {
    await renderHome()
    fireEvent.click(screen.getByRole('button', { name: /demander un cong/i }))
    expect(screen.getByText(/date de d.but/i)).toBeInTheDocument()
    expect(screen.getByText(/date de fin/i)).toBeInTheDocument()
    expect(screen.getByText(/dur.e \(jours\)/i)).toBeInTheDocument()
    expect(screen.getByText(/motif/i)).toBeInTheDocument()
  })

  it('modal has Annuler and Soumettre la demande buttons', async () => {
    await renderHome()
    fireEvent.click(screen.getByRole('button', { name: /demander un cong/i }))
    expect(screen.getAllByRole('button', { name: /annuler/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /soumettre la demande/i })).toBeInTheDocument()
  })

  it('Annuler button closes the modal', async () => {
    await renderHome()
    fireEvent.click(screen.getByRole('button', { name: /demander un cong/i }))
    expect(screen.getByText('Nouvelle demande de congé')).toBeInTheDocument()
    const annulerBtns = screen.getAllByRole('button', { name: /annuler/i })
    fireEvent.click(annulerBtns[annulerBtns.length - 1])
    expect(screen.queryByText('Nouvelle demande de congé')).not.toBeInTheDocument()
  })

  it('submits leave request and calls API correctly', async () => {
    const api = (await import('../services/api')).default
    api.post.mockResolvedValueOnce({ data: {} })

    await renderHome()
    fireEvent.click(screen.getByRole('button', { name: /demander un cong/i }))
    expect(screen.getByText('Nouvelle demande de congé')).toBeInTheDocument()

    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-04-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-04-05' } })

    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/api/conges/demande',
      null,
      expect.objectContaining({
        params: expect.objectContaining({
          matricule: '1001',
          date_debut: '2026-04-01',
          date_fin: '2026-04-05',
        }),
      })
    ))
  })

  it('shows error message when API fails', async () => {
    const api = (await import('../services/api')).default
    api.post.mockRejectedValueOnce({ response: { data: { detail: 'Solde insuffisant' } } })

    await renderHome()
    fireEvent.click(screen.getByRole('button', { name: /demander un cong/i }))
    expect(screen.getByText('Nouvelle demande de congé')).toBeInTheDocument()

    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-04-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-04-05' } })

    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(screen.getByText(/solde insuffisant/i)).toBeInTheDocument())
  })
})

// ── Helpers for team-space post mocks ──────────────────────────────────────

const recentIso = () => new Date(Date.now() - 10 * 60 * 1000).toISOString()   // 10 min ago
const oldIso    = () => new Date(Date.now() - 90 * 60 * 1000).toISOString()   // 90 min ago

const makeShoutout = (overrides = {}) => ({
  id: 1,
  type: 'shoutout',
  from: 'Paul',
  date: '14/04/2026',
  destinataire: 'Samuel',
  message: 'Bravo pour le projet !',
  valeur: '',
  raison: '',
  question: '',
  options: [],
  votedBy: [],
  likes: 0,
  audience: { type: 'all', selected: [] },
  created_at: recentIso(),
  ...overrides,
})

const renderHomeWithPost = async (post) => {
  const api = (await import('../services/api')).default
  api.get.mockImplementation((url) => {
    if (url === '/api/team-space/posts') return Promise.resolve({ data: [post] })
    return Promise.resolve({ data: [] })
  })
  api.delete = vi.fn(() => Promise.resolve({ data: { ok: true } }))
  api.patch  = vi.fn(() => Promise.resolve({ data: { ...post } }))

  let result
  await act(async () => {
    result = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Home />
      </MemoryRouter>
    )
    await Promise.resolve()
  })
  return result
}

// ── Team Space — kebab menu ────────────────────────────────────────────────

describe('Home — Team Space kebab menu', () => {
  afterEach(() => vi.clearAllMocks())

  it('affiche le bouton kebab (⋮) sur chaque post', async () => {
    await renderHomeWithPost(makeShoutout())
    // At least one MoreVertical button rendered inside the feed area
    const kebabs = document.querySelectorAll('[data-post-menu] button')
    expect(kebabs.length).toBeGreaterThan(0)
  })

  it('ouvre le menu au clic sur le bouton kebab', async () => {
    await renderHomeWithPost(makeShoutout())
    const kebab = document.querySelector('[data-post-menu] button')
    fireEvent.click(kebab)
    expect(screen.getByText('Modifier')).toBeInTheDocument()
    expect(screen.getByText('Supprimer')).toBeInTheDocument()
  })

  it('affiche "Modifier" pour un post récent (< 1h)', async () => {
    await renderHomeWithPost(makeShoutout({ created_at: recentIso() }))
    const kebab = document.querySelector('[data-post-menu] button')
    fireEvent.click(kebab)
    expect(screen.getByText('Modifier')).toBeInTheDocument()
  })

  it('masque "Modifier" pour un post ancien (> 1h)', async () => {
    await renderHomeWithPost(makeShoutout({ created_at: oldIso() }))
    const kebab = document.querySelector('[data-post-menu] button')
    fireEvent.click(kebab)
    expect(screen.queryByText('Modifier')).not.toBeInTheDocument()
    expect(screen.getByText('Supprimer')).toBeInTheDocument()
  })

  it('"Supprimer" appelle api.delete et recharge les posts', async () => {
    await renderHomeWithPost(makeShoutout())
    const api = (await import('../services/api')).default

    fireEvent.click(document.querySelector('[data-post-menu] button'))
    // Confirm dialog
    vi.stubGlobal('confirm', () => true)
    fireEvent.click(screen.getByText('Supprimer'))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/team-space/posts/1'))
    vi.unstubAllGlobals()
  })

  it('"Modifier" ouvre le formulaire inline', async () => {
    await renderHomeWithPost(makeShoutout())

    fireEvent.click(document.querySelector('[data-post-menu] button'))
    fireEvent.click(screen.getByText('Modifier'))

    // The inline edit form should appear with an Enregistrer button
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /annuler/i })).toBeInTheDocument()
  })

  it('"Annuler" dans le formulaire inline ferme le formulaire', async () => {
    await renderHomeWithPost(makeShoutout())

    fireEvent.click(document.querySelector('[data-post-menu] button'))
    fireEvent.click(screen.getByText('Modifier'))
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /annuler/i }))
    expect(screen.queryByRole('button', { name: /enregistrer/i })).not.toBeInTheDocument()
  })
})
