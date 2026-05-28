/**
 * Tests Vitest/RTL pour Administration.jsx (onglet Fonctions) :
 * - Rendu de l'onglet Fonctions avec liste chargée depuis l'API
 * - startEditFonction : remplit le formulaire + appelle window.scrollTo
 * - Annuler : réinitialise le formulaire
 * - Soumission formulaire d'ajout : appelle api.post
 * - Double libellé : POST sur libellé existant retourne l'existant sans doublon
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

/* ── Mocks globaux ──────────────────────────────────────────────── */
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../components/ui/bridge', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  confirmDialog: vi.fn().mockResolvedValue(true),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: '9001', role: 'ADMIN', prenom: 'Admin', nom: 'Test' },
  }),
}))

vi.mock('./OrgChart', () => ({ default: () => <div data-testid="orgchart-mock" /> }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import api from '../services/api'
import Administration from '../pages/Administration'

/* ── Fixtures ──────────────────────────────────────────────────── */
const FONCTIONS = [
  { id_fonction: 1, libelle: 'Directeur Général', id_direction: null, dept_id: null, direction_nom: null, dept_nom: null },
  { id_fonction: 2, libelle: 'Chargé de Clientèle', id_direction: 10, dept_id: null, direction_nom: 'Direction Commerciale', dept_nom: null },
  { id_fonction: 3, libelle: 'Analyste Financier', id_direction: null, dept_id: 5, direction_nom: null, dept_nom: 'Finance' },
]

function mockApiResponses(overrides = {}) {
  api.get.mockImplementation((url) => {
    if (url.includes('entites-structure'))  return Promise.resolve({ data: [] })
    if (url.includes('directions-structure')) return Promise.resolve({ data: [] })
    if (url.includes('departements-structure')) return Promise.resolve({ data: [] })
    if (url.includes('fonctions-reference'))  return Promise.resolve({ data: FONCTIONS })
    if (url.includes('roles'))               return Promise.resolve({ data: [] })
    if (url.includes('entites'))             return Promise.resolve({ data: [] })
    if (url.includes('directions'))          return Promise.resolve({ data: [] })
    if (url.includes('departements'))        return Promise.resolve({ data: [] })
    if (url.includes('ci-status'))           return Promise.resolve({ data: {} })
    return Promise.resolve({ data: overrides[url] ?? [] })
  })
}

function renderAdministration() {
  return render(
    <MemoryRouter>
      <Administration />
    </MemoryRouter>
  )
}

/* ── Helpers ───────────────────────────────────────────────────── */
async function goToFonctionsTab() {
  const fonctionsBtn = await screen.findByRole('button', { name: /Fonctions/i })
  await act(async () => fireEvent.click(fonctionsBtn))
}

/* ── Tests ─────────────────────────────────────────────────────── */
describe('Administration — onglet Fonctions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiResponses()
    // Mock scroll APIs
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    Object.defineProperty(document.documentElement, 'scrollTop', {
      writable: true,
      configurable: true,
      value: 0,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── 1. Rendu liste ──────────────────────────────────────────────
  it('affiche la liste des fonctions après chargement', async () => {
    renderAdministration()
    await goToFonctionsTab()

    await waitFor(() => {
      expect(screen.getByText('Directeur Général')).toBeInTheDocument()
      expect(screen.getByText('Chargé de Clientèle')).toBeInTheDocument()
      expect(screen.getByText('Analyste Financier')).toBeInTheDocument()
    })
  })

  // ── 2. Compteur dans l'onglet ───────────────────────────────────
  it("affiche le compte de fonctions dans le bouton d'onglet", async () => {
    renderAdministration()
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Fonctions/i })
      expect(btn.textContent).toMatch(/3/)
    })
  })

  // ── 3. startEditFonction remplit le formulaire ──────────────────
  it('clic Modifier remplit le champ libellé', async () => {
    renderAdministration()
    await goToFonctionsTab()

    await waitFor(() => expect(screen.getByText('Directeur Général')).toBeInTheDocument())

    const modifierBtns = screen.getAllByRole('button', { name: /Modifier/i })
    await act(async () => fireEvent.click(modifierBtns[0]))

    const input = screen.getByPlaceholderText(/libellé de la fonction/i)
    expect(input.value).toBe('Directeur Général')
  })

  // ── 4. startEditFonction déclenche le scroll haut ───────────────
  it('clic Modifier appelle window.scrollTo vers le haut', async () => {
    renderAdministration()
    await goToFonctionsTab()

    await waitFor(() => expect(screen.getByText('Directeur Général')).toBeInTheDocument())

    const modifierBtns = screen.getAllByRole('button', { name: /Modifier/i })
    await act(async () => {
      fireEvent.click(modifierBtns[0])
      // Laisser le setTimeout(50ms) s'exécuter
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
  })

  // ── 5. Annuler réinitialise le formulaire ───────────────────────
  it('Annuler vide le champ libellé et quitte le mode édition', async () => {
    renderAdministration()
    await goToFonctionsTab()

    await waitFor(() => expect(screen.getByText('Directeur Général')).toBeInTheDocument())

    const modifierBtns = screen.getAllByRole('button', { name: /Modifier/i })
    await act(async () => fireEvent.click(modifierBtns[0]))

    const input = screen.getByPlaceholderText(/libellé de la fonction/i)
    expect(input.value).toBe('Directeur Général')

    const annulerBtn = screen.getByRole('button', { name: /Annuler/i })
    await act(async () => fireEvent.click(annulerBtn))

    expect(input.value).toBe('')
    // Le bouton "Mettre à jour" ne doit plus être présent
    expect(screen.queryByRole('button', { name: /Mettre à jour/i })).toBeNull()
  })

  // ── 6. Ajout de fonction appelle api.post ───────────────────────
  it("ajout d'une fonction appelle api.post avec le libellé saisi", async () => {
    api.post.mockResolvedValueOnce({
      data: { id_fonction: 99, libelle: 'Nouvelle Fonction Test', created: true },
    })
    // Après POST, la liste doit être rechargée
    api.get.mockImplementation((url) => {
      if (url.includes('fonctions-reference'))
        return Promise.resolve({ data: [...FONCTIONS, { id_fonction: 99, libelle: 'Nouvelle Fonction Test', id_direction: null, dept_id: null }] })
      return Promise.resolve({ data: [] })
    })

    renderAdministration()
    await goToFonctionsTab()
    await waitFor(() => expect(screen.getByText('Directeur Général')).toBeInTheDocument())

    const input = screen.getByPlaceholderText(/libellé de la fonction/i)
    await act(async () => fireEvent.change(input, { target: { value: 'Nouvelle Fonction Test' } }))

    const addBtn = screen.getByRole('button', { name: /Ajouter/i })
    await act(async () => fireEvent.click(addBtn))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/employees/admin/fonctions-reference',
        expect.objectContaining({ libelle: 'Nouvelle Fonction Test' })
      )
    )
  })

  // ── 7. Champ vide bloqué côté front ────────────────────────────
  it("n'appelle pas api.post si le libellé est vide", async () => {
    renderAdministration()
    await goToFonctionsTab()
    await waitFor(() => expect(screen.getByText('Directeur Général')).toBeInTheDocument())

    // Ne rien saisir, cliquer Ajouter
    const addBtn = screen.getByRole('button', { name: /Ajouter/i })
    await act(async () => fireEvent.click(addBtn))

    expect(api.post).not.toHaveBeenCalled()
  })

  // ── 8. Toast "ajoutée avec succès" après création ──────────────
  it('affiche un toast succès après ajout', async () => {
    const { toast } = await import('../components/ui/bridge')
    api.post.mockResolvedValueOnce({
      data: { id_fonction: 50, libelle: 'Chargé Conformité', created: true },
    })

    renderAdministration()
    await goToFonctionsTab()
    await waitFor(() => expect(screen.getByText('Directeur Général')).toBeInTheDocument())

    const input = screen.getByPlaceholderText(/libellé de la fonction/i)
    await act(async () => fireEvent.change(input, { target: { value: 'Chargé Conformité' } }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Ajouter/i })))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Chargé Conformité')))
  })

  // ── 9. Toast "existe déjà" quand created=false ─────────────────
  it('affiche un toast "existe déjà" si la fonction existe déjà', async () => {
    const { toast } = await import('../components/ui/bridge')
    api.post.mockResolvedValueOnce({
      data: { id_fonction: 1, libelle: 'Directeur Général', created: false },
    })

    renderAdministration()
    await goToFonctionsTab()
    await waitFor(() => expect(screen.getByText('Directeur Général')).toBeInTheDocument())

    const input = screen.getByPlaceholderText(/libellé de la fonction/i)
    await act(async () => fireEvent.change(input, { target: { value: 'Directeur Général' } }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Ajouter/i })))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('existe déjà')))
  })

  // ── 10. POST inclut id_direction quand sélectionnée ────────────
  it("api.post reçoit id_direction dans le payload quand une direction est choisie", async () => {
    // FONCTIONS[1] a id_direction:10 → cliquer Modifier le remplit dans le formulaire
    api.put.mockResolvedValueOnce({
      data: { id_fonction: 2, libelle: 'Chargé de Clientèle', updated: true },
    })

    renderAdministration()
    await goToFonctionsTab()
    await waitFor(() => expect(screen.getByText('Chargé de Clientèle')).toBeInTheDocument())

    // Modifier la 2ème fonction (id_direction: 10)
    const modifierBtns = screen.getAllByRole('button', { name: /Modifier/i })
    await act(async () => fireEvent.click(modifierBtns[1]))

    // Vérifier que le champ libellé est rempli avec la bonne valeur
    const input = screen.getByPlaceholderText(/libellé de la fonction/i)
    expect(input.value).toBe('Chargé de Clientèle')

    // Soumettre → PUT doit inclure id_direction
    const submitBtn = screen.getByRole('button', { name: /Mettre à jour/i })
    await act(async () => fireEvent.click(submitBtn))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        '/employees/admin/fonctions-reference/2',
        expect.objectContaining({ libelle: 'Chargé de Clientèle', id_direction: 10 })
      )
    )
  })
})
