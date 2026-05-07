/**
 * Tests vitest pour DocumentationPage.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { baseURL: 'http://localhost:8000' },
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: '9999', role: 'RH', nom: 'Admin', prenom: 'Super' },
    logout: vi.fn(),
  }),
}))

vi.mock('../components/ui/bridge', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  confirmDialog: vi.fn(() => Promise.resolve(true)),
}))

import api from '../services/api'
import DocumentationPage from '../pages/DocumentationPage'

const SAMPLE_ARTICLES = [
  { id_doc: 1, titre: 'Guide de congé', contenu: 'Contenu...', categorie: 'RH', auteur_nom: 'Admin', auteur_matricule: '9999', type_doc: 'article', created_at: '2025-01-01T10:00:00' },
  { id_doc: 2, titre: 'Procédure IT', contenu: 'Étapes...', categorie: 'IT', auteur_nom: 'Tech', auteur_matricule: '1001', type_doc: 'article', created_at: '2025-02-15T08:00:00' },
]

describe('DocumentationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: SAMPLE_ARTICLES })
  })

  it('affiche le titre "Documentation"', async () => {
    render(
      <MemoryRouter>
        <DocumentationPage />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: /documentation/i })).toBeTruthy()
  })

  it('affiche l\'onglet Articles', () => {
    render(
      <MemoryRouter>
        <DocumentationPage />
      </MemoryRouter>
    )
    expect(screen.getByText('Articles')).toBeTruthy()
  })

  it('affiche l\'onglet Fichiers', () => {
    render(
      <MemoryRouter>
        <DocumentationPage />
      </MemoryRouter>
    )
    expect(screen.getByText('Fichiers')).toBeTruthy()
  })

  it('affiche le bouton "Nouvel article" pour le rôle RH', () => {
    render(
      <MemoryRouter>
        <DocumentationPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/nouvel article/i)).toBeTruthy()
  })

  it('affiche les articles chargés depuis l\'API', async () => {
    render(
      <MemoryRouter>
        <DocumentationPage />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Guide de congé')).toBeTruthy()
    })
  })

  it('affiche les catégories dans la sidebar', () => {
    render(
      <MemoryRouter>
        <DocumentationPage />
      </MemoryRouter>
    )
    expect(screen.getByText('RH')).toBeTruthy()
    expect(screen.getByText('IT')).toBeTruthy()
  })

  it('ouvre le formulaire de création au clic sur "Nouvel article"', async () => {
    render(
      <MemoryRouter>
        <DocumentationPage />
      </MemoryRouter>
    )
    const btn = screen.getByText(/nouvel article/i)
    fireEvent.click(btn)
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/titre de l'article/i)).toBeTruthy()
    })
  })

  it('bascule sur l\'onglet Fichiers au clic', async () => {
    render(
      <MemoryRouter>
        <DocumentationPage />
      </MemoryRouter>
    )
    const fichiersTab = screen.getByText('Fichiers')
    fireEvent.click(fichiersTab)
    await waitFor(() => {
      expect(screen.getByText(/choisir un fichier/i)).toBeTruthy()
    })
  })

  it('affiche l\'état vide si aucun article', async () => {
    api.get.mockResolvedValue({ data: [] })
    render(
      <MemoryRouter>
        <DocumentationPage />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/en construction/i)).toBeTruthy()
    })
  })
})
