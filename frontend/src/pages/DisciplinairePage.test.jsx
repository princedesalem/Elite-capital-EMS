import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────
const { apiMock, stableUser } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
  stableUser: { matricule: 'RH001', sub: 'RH001', role: 'RH', prenom: 'Alice', nom: 'Martin' },
}))
vi.mock('../services/api', () => ({ default: apiMock }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: stableUser }) }))
const mockToast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
vi.mock('../components/ui/ToastProvider', () => ({ useToast: () => mockToast }))

import DisciplinairePage from './DisciplinairePage'

const MESURES = [
  {
    id_mesure: 1,
    matricule: 'EMP001',
    nom_employe: 'Jean Dupont',
    type_mesure: 'avertissement',
    motif: 'Retard répété',
    gravite: 2,
    date_mesure: '2026-05-01',
    cree_par: 'RH001',
    nom_createur: 'Alice Martin',
  },
]

const AUTOCOMPLETE_RESULTS = [
  { matricule: 'EMP001', nom: 'Dupont', prenom: 'Jean', fonction: 'Employé' },
  { matricule: 'EMP002', nom: 'Martin', prenom: 'Marie', fonction: 'RH' },
]

function setup() {
  apiMock.get.mockImplementation((url) => {
    if (url === '/api/disciplinaire/') return Promise.resolve({ data: MESURES })
    if (url.startsWith('/employees/autocomplete/employes')) return Promise.resolve({ data: AUTOCOMPLETE_RESULTS })
    return Promise.resolve({ data: [] })
  })
  apiMock.post.mockResolvedValue({ data: { id_mesure: 2 } })
  apiMock.put.mockResolvedValue({ data: {} })
  apiMock.delete.mockResolvedValue({})
}

function renderPage() {
  return render(<MemoryRouter><DisciplinairePage /></MemoryRouter>)
}

describe('DisciplinairePage', () => {
  beforeEach(() => {
    apiMock.get.mockClear()
    apiMock.post.mockClear()
    mockToast.success.mockClear()
    mockToast.warning.mockClear()
    setup()
  })

  it('affiche la page avec le titre Disciplinaire', async () => {
    renderPage()
    await waitFor(() => {
      expect(document.body.innerHTML).toMatch(/disciplinaire/i)
    })
  })

  it('affiche la liste des mesures chargées', async () => {
    renderPage()
    await waitFor(() => {
      expect(document.body.innerHTML).toContain('Jean Dupont')
    })
  })

  it('le bouton Nouvelle mesure ouvre le modal', async () => {
    renderPage()
    await waitFor(() => expect(document.body.innerHTML).toMatch(/nouvelle mesure/i))
    const btn = screen.getByRole('button', { name: /nouvelle mesure/i })
    fireEvent.click(btn)
    await waitFor(() => {
      expect(document.body.innerHTML).toContain('Employé concerné')
    })
  })

  it('le champ Employé concerné est un autocomplete (pas un input matricule)', async () => {
    renderPage()
    await waitFor(() => expect(document.body.innerHTML).toMatch(/nouvelle mesure/i))
    fireEvent.click(screen.getByRole('button', { name: /nouvelle mesure/i }))
    await waitFor(() => {
      // Doit afficher "Employé concerné" et non "Matricule employé"
      expect(document.body.innerHTML).toContain('Employé concerné')
      expect(document.body.innerHTML).not.toContain('Matricule employé')
      // Doit avoir un placeholder autocomplete
      expect(document.body.innerHTML).toContain("Nom ou matricule de l'employé")
    })
  })

  it('l\'autocomplete affiche des suggestions au saisie', async () => {
    renderPage()
    await waitFor(() => expect(document.body.innerHTML).toMatch(/nouvelle mesure/i))
    fireEvent.click(screen.getByRole('button', { name: /nouvelle mesure/i }))
    await waitFor(() => expect(document.body.innerHTML).toContain("Nom ou matricule de l'employé"))

    const input = document.querySelector('input[placeholder="Nom ou matricule de l\'employé"]')
    expect(input).toBeTruthy()
    fireEvent.change(input, { target: { value: 'Dup' } })

    await waitFor(() => {
      expect(document.body.innerHTML).toContain('DUPONT')
    }, { timeout: 1000 })
  })

  it('la soumission sans employé affiche un warning', async () => {
    renderPage()
    await waitFor(() => expect(document.body.innerHTML).toMatch(/nouvelle mesure/i))
    fireEvent.click(screen.getByRole('button', { name: /nouvelle mesure/i }))
    await waitFor(() => expect(document.body.innerHTML).toContain('Employé concerné'))

    const saveBtn = screen.getByRole('button', { name: /enregistrer/i })
    fireEvent.click(saveBtn)
    await waitFor(() => {
      expect(mockToast.warning).toHaveBeenCalled()
    })
    expect(apiMock.post).not.toHaveBeenCalled()
  })

  it('affiche les badges de type (avertissement, blâme...)', async () => {
    renderPage()
    await waitFor(() => {
      expect(document.body.innerHTML).toContain('Avertissement')
    })
  })
})
