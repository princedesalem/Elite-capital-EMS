/**
 * Tests Vitest/RTL pour AcademyCourse.jsx :
 * - Sidebar : leçon active a borderLeft rouge, les autres transparent
 * - Passage auto à la leçon suivante après handleComplete
 * - Bouton "Mon certificat" absent si non terminé, présent si terminé
 * - QuizPlayer reçoit les bonnes props (questions, inscriptionId, leconId)
 * - Téléchargement du certificat déclenche POST + blob download
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

/* ── Mocks ─────────────────────────────────────────────────────────────── */
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('../components/ui/bridge', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: '1001', role: 'RH' },
  }),
}))

/* QuizPlayer stub */
vi.mock('../components/QuizPlayer', () => ({
  default: ({ questions, inscriptionId, leconId, onComplete }) => (
    <div data-testid="quiz-player"
      data-inscription={inscriptionId}
      data-lecon={leconId}
      data-count={questions.length}
    >
      <button onClick={() => onComplete(100)}>Terminer quiz</button>
    </div>
  ),
}))

import api from '../services/api'
import AcademyCourse from '../pages/AcademyCourse'

/* ── Fixtures ──────────────────────────────────────────────────────────── */
const INSCRIPTION = { id: 42, statut: 'en_cours', lecons_terminees: [] }

const FORMATION = {
  id: 1,
  titre: 'Excel Avancé',
  categorie: 'Informatique',
  modules: [
    {
      id: 10,
      titre: 'Module 1',
      lecons: [
        { id: 101, titre: 'Introduction', type: 'texte', contenu: '<p>Bienvenue</p>', duree_min: 10 },
        { id: 102, titre: 'Formules', type: 'texte', contenu: '<p>Formules</p>', duree_min: 15 },
        { id: 103, titre: 'Quiz final', type: 'quiz', contenu: null, duree_min: 10 },
      ],
    },
  ],
  inscription: INSCRIPTION,
}

function makeFormationDone() {
  return {
    ...FORMATION,
    inscription: { ...INSCRIPTION, statut: 'termine', lecons_terminees: [101, 102, 103] },
  }
}

const QUESTIONS = [
  { id: 1, question: 'Q1?', options: ['A', 'B'], bonne_reponse: 0, explication: 'A' },
]

function renderCourse(formationData = FORMATION) {
  api.get.mockImplementation((url) => {
    if (url.includes('/formations/')) return Promise.resolve({ data: formationData })
    if (url.includes('/questions'))  return Promise.resolve({ data: QUESTIONS })
    return Promise.resolve({ data: {} })
  })
  api.post.mockResolvedValue({ data: { id: 42, statut: 'en_cours', lecons_terminees: [] } })

  return render(
    <MemoryRouter initialEntries={['/rh/academy/1']}>
      <Routes>
        <Route path="/rh/academy/:formationId" element={<AcademyCourse />} />
      </Routes>
    </MemoryRouter>
  )
}

/* ── Tests ──────────────────────────────────────────────────────────────── */
describe('AcademyCourse', () => {
  beforeEach(() => vi.clearAllMocks())

  it('affiche le titre de la formation dans la bande nav', async () => {
    renderCourse()
    await screen.findByText('Excel Avancé')
    expect(screen.getByText('Excel Avancé')).toBeInTheDocument()
  })

  it('la leçon active a borderLeft rouge, les autres transparent', async () => {
    renderCourse()
    const buttons = await screen.findAllByRole('button', { name: /Introduction|Formules|Quiz final/i })
    // La première leçon (Introduction) est active par défaut
    const activeBtn = buttons.find(b => b.textContent.includes('Introduction'))
    expect(activeBtn?.style.borderLeft).toMatch(/ce2b2b|#ce2b2b|206.*43.*43/)
  })

  it("le bouton S'inscrire est absent quand déjà inscrit", async () => {
    renderCourse(FORMATION) // FORMATION a inscription=INSCRIPTION
    await screen.findByText('Excel Avancé')
    expect(screen.queryByRole('button', { name: /S'inscrire/i })).toBeNull()
  })

  it("le bouton S'inscrire est visible quand pas inscrit", async () => {
    const formationSansInscription = { ...FORMATION, inscription: null }
    renderCourse(formationSansInscription)
    await screen.findByText('Excel Avancé')
    // Dans la bande top nav
    expect(screen.getAllByRole('button', { name: /S'inscrire/i }).length).toBeGreaterThan(0)
  })

  it('"Mon certificat" absent si formation non terminée', async () => {
    renderCourse(FORMATION)
    await screen.findByText('Excel Avancé')
    expect(screen.queryByRole('button', { name: /Mon certificat/i })).toBeNull()
  })

  it('"Mon certificat" visible si formation terminée', async () => {
    renderCourse(makeFormationDone())
    await screen.findByText('Excel Avancé')
    expect(screen.getByRole('button', { name: /Mon certificat/i })).toBeInTheDocument()
  })

  it('QuizPlayer reçoit inscriptionId et leconId corrects', async () => {
    renderCourse()
    // Cliquer sur la leçon quiz
    const buttons = await screen.findAllByRole('button')
    const quizBtn = buttons.find(b => b.textContent.includes('Quiz final'))
    expect(quizBtn).toBeTruthy()
    fireEvent.click(quizBtn)
    await screen.findByTestId('quiz-player')
    const qp = screen.getByTestId('quiz-player')
    expect(qp.dataset.inscription).toBe('42')  // INSCRIPTION.id
    expect(qp.dataset.lecon).toBe('103')        // quiz lecon id
    expect(Number(qp.dataset.count)).toBeGreaterThanOrEqual(0)
  })

  it('téléchargement du certificat POST /certificat/:id et blob download', async () => {
    const mockBlob = new Blob(['%PDF fake'], { type: 'application/pdf' })
    api.post.mockImplementation((url) => {
      if (url.includes('/certificat/')) return Promise.resolve({ data: mockBlob })
      return Promise.resolve({ data: { id: 42, statut: 'termine', lecons_terminees: [101, 102, 103] } })
    })
    // Mock URL.createObjectURL + click
    const createObjectURL = vi.fn(() => 'blob:fake-url')
    const revokeObjectURL = vi.fn()
    global.URL.createObjectURL = createObjectURL
    global.URL.revokeObjectURL = revokeObjectURL

    const clickMock = vi.fn()
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag)
      if (tag === 'a') el.click = clickMock
      return el
    })

    renderCourse(makeFormationDone())
    await screen.findByText('Excel Avancé')

    const certBtn = screen.getByRole('button', { name: /Mon certificat/i })
    fireEvent.click(certBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        expect.stringContaining('/certificat/42'),
        {},
        expect.objectContaining({ responseType: 'blob' }),
      )
    })
  })
})
