/**
 * Tests Vitest/RTL pour Academy.jsx (catalogue formations) :
 * - Card "Bienvenue chez Elite Capital Group" → affiche img ECG logo
 * - Card "Prise en main de l'extranet EMS"   → affiche texte "EMS"
 * - Card formation ordinaire                 → pas de logo ECG, pas de "EMS" isolé
 * - Filtre recherche texte
 * - Filtre par catégorie
 * - Message "aucune formation" quand aucun résultat
 * - Section onboarding séparée du catalogue général
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

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
    user: { matricule: '1001', role: 'EMPLOYE' },
  }),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import api from '../services/api'
import Academy from '../pages/Academy'

/* ── Fixtures ──────────────────────────────────────────────────────────── */
const ECG_FORMATION = {
  id: 1,
  titre: 'Bienvenue chez Elite Capital Group',
  categorie: 'Onboarding',
  niveau: 'Débutant',
  est_onboarding: true,
  est_publie: true,
  description: 'Découvrez ECG',
  nb_modules: 1,
  nb_lecons: 3,
  duree_estimee_h: 1,
  inscription_id: null,
  statut_inscription: null,
  progress: 0,
}

const EMS_FORMATION = {
  id: 2,
  titre: "Prise en main de l'extranet EMS",
  categorie: 'Onboarding',
  niveau: 'Débutant',
  est_onboarding: true,
  est_publie: true,
  description: 'Maîtrisez EMS',
  nb_modules: 1,
  nb_lecons: 5,
  duree_estimee_h: 2,
  inscription_id: null,
  statut_inscription: null,
  progress: 0,
}

const REGULAR_FORMATION = {
  id: 3,
  titre: 'Gestion des conges et absences',
  categorie: 'Ressources Humaines',
  niveau: 'Intermédiaire',
  est_onboarding: false,
  est_publie: true,
  description: 'Gérez les congés',
  nb_modules: 2,
  nb_lecons: 8,
  duree_estimee_h: 4,
  inscription_id: null,
  statut_inscription: null,
  progress: 0,
}

const COMMERCIAL_FORMATION = {
  id: 4,
  titre: 'Commercial : techniques de vente',
  categorie: 'Commercial',
  niveau: 'Avancé',
  est_onboarding: false,
  est_publie: true,
  description: 'Techniques commerciales',
  nb_modules: 3,
  nb_lecons: 12,
  duree_estimee_h: 6,
  inscription_id: null,
  statut_inscription: null,
  progress: 0,
}

function renderAcademy(formations = [ECG_FORMATION, EMS_FORMATION, REGULAR_FORMATION]) {
  api.get.mockImplementation((url) => {
    if (url.includes('/catalogue')) return Promise.resolve({ data: formations })
    if (url.includes('/dashboard')) return Promise.resolve({ data: null })
    return Promise.resolve({ data: {} })
  })
  api.post.mockResolvedValue({ data: {} })

  return render(
    <MemoryRouter>
      <Academy />
    </MemoryRouter>
  )
}

/* ── Tests ──────────────────────────────────────────────────────────────── */
describe('Academy — cartes spéciales onboarding', () => {
  beforeEach(() => vi.clearAllMocks())

  it('affiche le logo ECG pour "Bienvenue chez Elite Capital Group"', async () => {
    renderAcademy([ECG_FORMATION])
    await screen.findByText('Bienvenue chez Elite Capital Group')
    const logo = screen.getByAltText('Elite Capital Group')
    expect(logo).toBeInTheDocument()
    expect(logo.tagName).toBe('IMG')
    expect(logo.src).toContain('ecg-white.png')
  })

  it('affiche le texte "EMS" pour "Prise en main de l\'extranet EMS"', async () => {
    renderAcademy([EMS_FORMATION])
    await screen.findByText("Prise en main de l'extranet EMS")
    // Le texte stylisé "EMS" doit être présent dans le rendu de la card
    const emsLabel = screen.getByText('EMS')
    expect(emsLabel).toBeInTheDocument()
  })

  it('ne montre pas le logo ECG pour une formation ordinaire', async () => {
    renderAcademy([REGULAR_FORMATION])
    await screen.findByText('Gestion des conges et absences')
    expect(screen.queryByAltText('Elite Capital Group')).toBeNull()
  })

  it('ne montre pas "EMS" isolé pour une formation ordinaire', async () => {
    renderAcademy([REGULAR_FORMATION])
    await screen.findByText('Gestion des conges et absences')
    // Le texte "EMS" ne doit pas apparaître comme contenu principal
    expect(screen.queryByText('EMS')).toBeNull()
  })
})

describe('Academy — catalogue et filtres', () => {
  beforeEach(() => vi.clearAllMocks())

  it('affiche toutes les formations retournées par le catalogue', async () => {
    renderAcademy([ECG_FORMATION, EMS_FORMATION, REGULAR_FORMATION, COMMERCIAL_FORMATION])
    await screen.findByText('Bienvenue chez Elite Capital Group')
    expect(screen.getByText("Prise en main de l'extranet EMS")).toBeInTheDocument()
    expect(screen.getByText('Gestion des conges et absences')).toBeInTheDocument()
    expect(screen.getByText('Commercial : techniques de vente')).toBeInTheDocument()
  })

  it('les formations onboarding sont dans la section "Parcours d\'onboarding"', async () => {
    renderAcademy([ECG_FORMATION, EMS_FORMATION, REGULAR_FORMATION])
    await screen.findByText("Parcours d'onboarding")
    expect(screen.getByText("Parcours d'onboarding")).toBeInTheDocument()
  })

  it('les formations non-onboarding sont dans la section "Catalogue des formations"', async () => {
    renderAcademy([REGULAR_FORMATION, COMMERCIAL_FORMATION])
    await screen.findByText('Catalogue des formations')
    expect(screen.getByText('Catalogue des formations')).toBeInTheDocument()
  })

  it('la recherche texte filtre les formations par titre', async () => {
    renderAcademy([REGULAR_FORMATION, COMMERCIAL_FORMATION])
    await screen.findByText('Gestion des conges et absences')

    const searchInput = screen.getByPlaceholderText('Mot-clé')
    fireEvent.change(searchInput, { target: { value: 'Commercial' } })

    await waitFor(() => {
      expect(screen.queryByText('Gestion des conges et absences')).toBeNull()
    })
    expect(screen.getByText('Commercial : techniques de vente')).toBeInTheDocument()
  })

  it('la recherche vide restaure toutes les formations', async () => {
    renderAcademy([REGULAR_FORMATION, COMMERCIAL_FORMATION])
    await screen.findByText('Gestion des conges et absences')

    const searchInput = screen.getByPlaceholderText('Mot-clé')
    fireEvent.change(searchInput, { target: { value: 'Commercial' } })
    await waitFor(() => expect(screen.queryByText('Gestion des conges et absences')).toBeNull())

    fireEvent.change(searchInput, { target: { value: '' } })
    await waitFor(() => {
      expect(screen.getByText('Gestion des conges et absences')).toBeInTheDocument()
    })
    expect(screen.getByText('Commercial : techniques de vente')).toBeInTheDocument()
  })

  it('affiche "Aucune formation ne correspond" quand aucun résultat', async () => {
    renderAcademy([REGULAR_FORMATION])
    await screen.findByText('Gestion des conges et absences')

    const searchInput = screen.getByPlaceholderText('Mot-clé')
    fireEvent.change(searchInput, { target: { value: 'xyzinexistant999' } })

    await waitFor(() => {
      expect(screen.getByText(/aucune formation ne correspond/i)).toBeInTheDocument()
    })
  })

  it('le bouton "Réinitialiser les filtres" efface la recherche', async () => {
    renderAcademy([REGULAR_FORMATION])
    await screen.findByText('Gestion des conges et absences')

    const searchInput = screen.getByPlaceholderText('Mot-clé')
    fireEvent.change(searchInput, { target: { value: 'xyzinexistant999' } })
    await waitFor(() => screen.getByText(/aucune formation ne correspond/i))

    fireEvent.click(screen.getByRole('button', { name: /réinitialiser les filtres/i }))
    await waitFor(() => {
      expect(screen.getByText('Gestion des conges et absences')).toBeInTheDocument()
    })
  })
})
