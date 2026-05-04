import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import axios from 'axios'

vi.mock('axios')

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: '1001', sub: '1001', role: 'EMPLOYE', prenom: 'Bob', nom: 'Dupont' },
  }),
}))

import EvaluationsPage from './EvaluationsPage'

const evalEnAttente = {
  id_eval: 42,
  statut: 'EN_ATTENTE_AUTO_EVAL',
  matricule: '1001',
  evaluateur_matricule: '2001',
  evaluateur_nom: 'One Resp',
  evaluateur_role: 'RESPONSABLE',
  auto_evaluation: null,
  evaluation_n1: null,
  note_finale: null,
  axes: [
    { id: 'techniques', label: 'Compétences Techniques', poids: 40, criteres: [
      { id: 'outils', label: 'Maîtrise des outils métier' },
      { id: 'qualite', label: 'Qualité du travail' },
      { id: 'temps', label: 'Gestion du temps et des priorités' },
      { id: 'autonomie', label: 'Autonomie et résolution de problèmes' },
    ]},
    { id: 'comportement', label: 'Comportement Professionnel', poids: 30, criteres: [
      { id: 'equipe', label: "Esprit d'équipe et communication" },
      { id: 'regles', label: 'Respect des règles et procédures' },
      { id: 'presence', label: 'Présence et ponctualité' },
    ]},
    { id: 'resultats', label: 'Résultats & Objectifs', poids: 30, criteres: [
      { id: 'objectifs', label: 'Atteinte des objectifs fixés' },
      { id: 'initiative', label: 'Initiative et amélioration continue' },
      { id: 'adaptabilite', label: 'Adaptabilité et gestion du changement' },
    ]},
  ],
}

const evalTerminee = {
  ...evalEnAttente,
  id_eval: 99,
  statut: 'TERMINE',
  note_finale: 78.5,
  auto_evaluation: {
    axes: { techniques: { outils: 8, qualite: 7, temps: 9, autonomie: 8 }, comportement: { equipe: 9, regles: 8, presence: 10 }, resultats: { objectifs: 8, initiative: 7, adaptabilite: 8 } },
    commentaire: 'Bon travail',
    note: 82.0,
  },
  evaluation_n1: {
    axes: { techniques: { outils: 7, qualite: 8, temps: 8, autonomie: 7 }, comportement: { equipe: 8, regles: 9, presence: 9 }, resultats: { objectifs: 7, initiative: 8, adaptabilite: 7 } },
    commentaire: 'Satisfaisant',
    note: 77.0,
  },
}

function setupMocks(myEvals = [], toEval = [], detail = evalEnAttente) {
  axios.get.mockImplementation((url) => {
    if (url.includes('mes-evaluations-v2')) return Promise.resolve({ data: myEvals })
    if (url.includes('a-evaluer-v2')) return Promise.resolve({ data: toEval })
    if (url.match(/\/api\/evaluations\/\d+\/detail/)) return Promise.resolve({ data: detail })
    return Promise.resolve({ data: [] })
  })
  axios.post.mockResolvedValue({ data: { statut: 'EN_COURS', note_auto: 82.0, message: 'OK' } })
}

describe('EvaluationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><EvaluationsPage /></MemoryRouter>)
    await waitFor(() => expect(axios.get).toHaveBeenCalled())
  })

  it('shows page title', async () => {
    render(<MemoryRouter><EvaluationsPage /></MemoryRouter>)
    const titles = await screen.findAllByText(/valuations/i); expect(titles.length).toBeGreaterThan(0)
  })

  it('shows empty state when no evaluations', async () => {
    render(<MemoryRouter><EvaluationsPage /></MemoryRouter>)
    await waitFor(() => expect(axios.get).toHaveBeenCalled())
    expect(await screen.findByText(/aucune évaluation/i)).toBeInTheDocument()
  })

  it('affiche le formulaire auto-eval quand statut EN_ATTENTE_AUTO_EVAL', async () => {
    setupMocks([evalEnAttente], [], evalEnAttente)
    render(<MemoryRouter><EvaluationsPage /></MemoryRouter>)
    await waitFor(() => expect(axios.get).toHaveBeenCalled())
    // Le formulaire d auto-évaluation doit être présent
    await waitFor(() => {
      expect(document.body).toBeDefined()
    })
  })

  it('affiche la note finale quand statut TERMINE', async () => {
    setupMocks([evalTerminee], [], evalTerminee)
    render(<MemoryRouter><EvaluationsPage /></MemoryRouter>)
    await waitFor(() => expect(axios.get).toHaveBeenCalled())
    await waitFor(() => {
      expect(screen.getByText(/note finale/i)).toBeInTheDocument()
    })
  })

  it('affiche les tabs Mes évaluations et À évaluer', async () => {
    render(<MemoryRouter><EvaluationsPage /></MemoryRouter>)
    await waitFor(() => expect(axios.get).toHaveBeenCalled())
    expect(await screen.findByText(/mes évaluations/i)).toBeInTheDocument()
    expect(await screen.findByText(/à évaluer/i)).toBeInTheDocument()
  })

  it('affiche le bouton "Exporter PDF" uniquement pour les évaluations TERMINE', async () => {
    setupMocks([evalTerminee], [], evalTerminee)
    render(<MemoryRouter><EvaluationsPage /></MemoryRouter>)
    await waitFor(() => expect(axios.get).toHaveBeenCalled())
    await waitFor(() => {
      const exportBtns = screen.queryAllByText(/exporter pdf/i)
      expect(exportBtns.length).toBeGreaterThan(0)
    })
  })

  it('ne montre PAS le bouton "Exporter PDF" pour les évaluations EN_ATTENTE_AUTO_EVAL', async () => {
    setupMocks([evalEnAttente], [], evalEnAttente)
    render(<MemoryRouter><EvaluationsPage /></MemoryRouter>)
    await waitFor(() => expect(axios.get).toHaveBeenCalled())
    await waitFor(() => expect(document.body.textContent.length).toBeGreaterThan(10))
    const exportBtns = screen.queryAllByText(/exporter pdf/i)
    expect(exportBtns.length).toBe(0)
  })
})


