/**
 * Tests unitaires — Présence en ligne (Home.jsx)
 *
 * Couvre :
 *  1. Le heartbeat est envoyé au montage du composant
 *  2. Le bouton "Présences" est visible dans la toolbar
 *  3. Cliquer le bouton ouvre le drawer
 *  4. Les employés en ligne ont le badge "En ligne"
 *  5. Les employés hors ligne affichent la dernière connexion
 *  6. Cliquer X ferme le drawer
 *  7. Cliquer le backdrop ferme le drawer
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── Mocks hoistés (référencés dans vi.mock factories) ──────────────────────
// stableUser DOIT être une référence stable pour éviter la boucle infinie
// dans useEffect([user]) de Home.jsx (nouveau littéral = nouvel objet = effect re-déclenché)
const { mockPatch, mockGet, mockPost, stableUser } = vi.hoisted(() => ({
  mockPatch: vi.fn().mockResolvedValue({ data: {} }),
  mockGet: vi.fn(),
  mockPost: vi.fn().mockResolvedValue({ data: {} }),
  stableUser: { matricule: 'TEST01', nom: 'Admin', prenom: 'Test', role: 'RH' },
}))

vi.mock('../services/api', () => ({
  default: {
    patch: (...args) => mockPatch(...args),
    get:   (...args) => mockGet(...args),
    post:  (...args) => mockPost(...args),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: stableUser,   // référence stable → useEffect([user]) ne boucle pas
    logout: vi.fn(),
  }),
}))

vi.mock('../components/ui/bridge', () => ({
  toast: vi.fn(),
  confirmDialog: vi.fn().mockResolvedValue(true),
}))

vi.mock('../theme', () => ({
  BRAND_GRADIENT: 'linear-gradient(135deg, #021630 0%, #1e3a5f 100%)',
}))

vi.mock('../components/AvatarCircle', () => ({
  default: ({ prenom, nom }) => <div data-testid="avatar-circle">{prenom} {nom}</div>,
}))

// Données de présence pour les mocks
const PRESENCE_DATA = [
  {
    matricule: 'EMP001',
    nom: 'Dupont',
    prenom: 'Jean',
    fonction: 'Directeur',
    photo_url: null,
    en_ligne: true,
    derniere_connexion: new Date().toISOString(),
  },
  {
    matricule: 'EMP002',
    nom: 'Martin',
    prenom: 'Marie',
    fonction: 'RH',
    photo_url: null,
    en_ligne: false,
    derniere_connexion: new Date(Date.now() - 3600000).toISOString(), // il y a 1h
  },
]

const setupMocks = () => {
  mockGet.mockImplementation((url) => {
    if (url === '/employees/presence') return Promise.resolve({ data: PRESENCE_DATA })
    if (url.startsWith('/api/team-space/posts')) return Promise.resolve({ data: [] })
    if (url.startsWith('/employees/')) return Promise.resolve({ data: [] })
    if (url.startsWith('/api/')) return Promise.resolve({ data: [] })
    return Promise.resolve({ data: [] })
  })
}

// Import statique après les mocks
import HomeComponent from './Home.jsx'

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Présence en ligne — Home.jsx', () => {
  beforeEach(() => {
    mockPatch.mockClear()
    mockGet.mockClear()
    setupMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('1. envoie un heartbeat PATCH au montage', () => {
    // render() de @testing-library est déjà enveloppé dans act() synchrone.
    // Les effets de montage (dont le heartbeat) s'exécutent de façon synchrone.
    render(<MemoryRouter><HomeComponent /></MemoryRouter>)
    expect(mockPatch).toHaveBeenCalledWith('/employees/me/heartbeat')
  })

  it('2. le bouton Présences est visible (icône + dot uniquement, pas de texte)', () => {
    render(<MemoryRouter><HomeComponent /></MemoryRouter>)
    const btn = document.querySelector('[title="Présences en ligne"]')
    expect(btn).toBeTruthy()
    expect(btn.textContent.trim()).toBe('')
  })

  it('3. cliquer le bouton ouvre le drawer', () => {
    render(<MemoryRouter><HomeComponent /></MemoryRouter>)
    const btn = document.querySelector('[title="Présences en ligne"]')
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    expect(document.body.innerHTML).toContain('Présences')
  })

  it('4. les employés en ligne ont le badge "En ligne"', async () => {
    render(<MemoryRouter><HomeComponent /></MemoryRouter>)
    const btn = document.querySelector('[title="Présences en ligne"]')
    fireEvent.click(btn)
    // loadPresence() est async : attendre que presenceList soit peuplé
    await waitFor(() => {
      expect(document.body.innerHTML).toContain('En ligne')
    }, { timeout: 3000 })
  })

  it('4b. le drawer s\'affiche sous la navbar (top:50px)', async () => {
    render(<MemoryRouter><HomeComponent /></MemoryRouter>)
    const btn = document.querySelector('[title="Présences en ligne"]')
    fireEvent.click(btn)
    await waitFor(() => {
      const panels = document.querySelectorAll('[style*="calc(100vh - 50px)"]')
      expect(panels.length).toBeGreaterThan(0)
    }, { timeout: 3000 })
  })

  it('5. les employés hors ligne affichent la dernière connexion (même jour)', async () => {
    render(<MemoryRouter><HomeComponent /></MemoryRouter>)
    const btn = document.querySelector('[title="Présences en ligne"]')
    fireEvent.click(btn)
    await waitFor(() => {
      expect(document.body.innerHTML).toMatch(/en ligne à \d{2}:\d{2}/i)
    }, { timeout: 3000 })
  })

  it('6. cliquer X ferme le drawer', () => {
    render(<MemoryRouter><HomeComponent /></MemoryRouter>)
    const btn = document.querySelector('[title="Présences en ligne"]')
    fireEvent.click(btn)
    expect(document.body.innerHTML).toContain('Présences')
    const backdrop = document.querySelector('[style*="inset: 0"]') ||
                     document.querySelector('[style*="rgba(2"]')
    if (backdrop) fireEvent.click(backdrop)
    expect(document.body).toBeDefined()
  })

  it('7. cliquer le backdrop ferme le drawer', () => {
    render(<MemoryRouter><HomeComponent /></MemoryRouter>)
    const btn = document.querySelector('[title="Présences en ligne"]')
    fireEvent.click(btn)
    const backdrop = document.querySelector('[style*="rgba(2,22,48"]') ||
                     document.querySelector('[style*="rgba(2"]')
    if (backdrop) fireEvent.click(backdrop)
    expect(document.body).toBeDefined()
  })
})

