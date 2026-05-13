/**
 * Tests unitaires — OrgChart
 * Framework : Vitest + React Testing Library
 * Exécuter : npx vitest run src/pages/__tests__/OrgChart.test.jsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ─── Mocks modules lourds ou réseau ───────────────────────────────────────────
vi.mock('html-to-image', () => ({ toPng: vi.fn(() => Promise.resolve('data:image/png;base64,AA')) }))
vi.mock('jspdf', () => ({ jsPDF: vi.fn(() => ({ addImage: vi.fn(), save: vi.fn() })) }))
vi.mock('xlsx', () => ({ utils: { book_new: vi.fn(), aoa_to_sheet: vi.fn(), book_append_sheet: vi.fn() }, writeFile: vi.fn() }))
// Mock eventBus avant tout import (chemin résolu depuis src/services/api.js)
vi.mock('../../utils/eventBus', () => ({ emit: vi.fn(), DATA_CHANGED: 'DATA_CHANGED' }))
vi.mock('../../services/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: [] })), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { matricule: '9001', role: 'RH', nom: 'Test', prenom: 'User' } }),
}))
vi.mock('../../components/ui/bridge', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// ─── Import des fonctions/composants exportés ─────────────────────────────────
import { niveauFonctionnel, computeOrgRow } from '../OrgChart'
import mockApi from '../../services/api'

// ─── 1. niveauFonctionnel ─────────────────────────────────────────────────────
describe('niveauFonctionnel — 5 niveaux', () => {
  // nf=0 : AG/PCA
  it('nf=0 : Administrateur Général (AG)', () => {
    expect(niveauFonctionnel({ fonction: 'Administrateur Général' })).toBe(0)
  })
  it('nf=0 : PCA', () => {
    expect(niveauFonctionnel({ fonction: 'Président Conseil Administration' })).toBe(0)
  })
  it('nf=0 : "Administrateur" seul (sans Directeur)', () => {
    expect(niveauFonctionnel({ fonction: 'Administrateur' })).toBe(0)
  })

  // nf=1 : DG filiale
  it('nf=1 : Directeur Général', () => {
    expect(niveauFonctionnel({ fonction: 'Directeur Général' })).toBe(1)
  })
  it('nf=1 : DG (abréviation)', () => {
    expect(niveauFonctionnel({ fonction: 'DG' })).toBe(1)
  })
  it('nf=1 : Administrateur Directeur Général (ADG filiale)', () => {
    expect(niveauFonctionnel({ fonction: 'Administrateur Directeur Général' })).toBe(1)
  })

  // nf=2 : Directeur département
  it('nf=2 : Directeur Audit Interne et Inspection Générale', () => {
    expect(niveauFonctionnel({ fonction: 'Directeur Audit Interne et Inspection Générale' })).toBe(2)
  })
  it('nf=2 : Directeur financier et Comptable(DFC)', () => {
    expect(niveauFonctionnel({ fonction: 'Directeur financier et Comptable(DFC)' })).toBe(2)
  })
  it('nf=2 : Directrice des Opérations', () => {
    expect(niveauFonctionnel({ fonction: 'Directrice des Opérations' })).toBe(2)
  })

  // nf=3 : Responsable/Chef/Manager
  it("nf=3 : Responsable des systèmes d'information", () => {
    expect(niveauFonctionnel({ fonction: "Responsable des systèmes d'information" })).toBe(3)
  })
  it('nf=3 : Responsable Des Resources Humaines (ECG réel)', () => {
    expect(niveauFonctionnel({ fonction: 'Responsable Des Resources Humaines' })).toBe(3)
  })
  it('nf=3 : Chef de projet', () => {
    expect(niveauFonctionnel({ fonction: 'Chef de projet' })).toBe(3)
  })
  it('nf=3 : Manager Commercial', () => {
    expect(niveauFonctionnel({ fonction: 'Manager Commercial' })).toBe(3)
  })

  // nf=4 : Autres
  it('nf=4 : Employé', () => {
    expect(niveauFonctionnel({ fonction: 'Employé' })).toBe(4)
  })
  it('nf=4 : Auditeur', () => {
    expect(niveauFonctionnel({ fonction: 'Auditeur' })).toBe(4)
  })
  it('nf=4 : chargé des organisations et projets', () => {
    expect(niveauFonctionnel({ fonction: 'chargé des organisations et projets' })).toBe(4)
  })
  it('nf=4 : fonction vide', () => {
    expect(niveauFonctionnel({ fonction: '' })).toBe(4)
  })
  it('nf=4 : employe null', () => {
    expect(niveauFonctionnel(null)).toBe(4)
  })
})

// ─── 2. computeOrgRow ─────────────────────────────────────────────────────────
describe('computeOrgRow — alignement hiérarchique', () => {
  // ── Racines ────────────────────────────────────────────────────────────────────────
  it('racine AG "Administrateur Général" → row 0', () => {
    expect(computeOrgRow({ fonction: 'Administrateur Général' }, -1)).toBe(0)
  })
  it('racine DG filiale "Directeur Général" → row 1', () => {
    expect(computeOrgRow({ fonction: 'Directeur Général' }, -1)).toBe(1)
  })
  it('racine Responsable → row 3', () => {
    expect(computeOrgRow({ fonction: 'Responsable RH' }, -1)).toBe(3)
  })
  it('parentRow null → identique à parentRow=-1', () => {
    expect(computeOrgRow({ fonction: 'Responsable' }, null)).toBe(3)
  })

  // ── Enfants de l'AG (parentRow=0) ────────────────────────────────────────────────────
  it('ADG sous AG row 0 → row max(1,1) = 1', () => {
    expect(computeOrgRow({ fonction: 'Administrateur Directeur Général' }, 0)).toBe(1)
  })
  it('Directeur département sous AG row 0 → row max(1,2) = 2', () => {
    expect(computeOrgRow({ fonction: 'Directeur des Organisations et projets' }, 0)).toBe(2)
  })
  it('Responsable sous AG row 0 → row max(1,3) = 3', () => {
    expect(computeOrgRow({ fonction: 'Responsable Des Resources Humaines' }, 0)).toBe(3)
  })
  it('Employé sous AG row 0 → row max(1,4) = 4', () => {
    expect(computeOrgRow({ fonction: 'Employé' }, 0)).toBe(4)
  })

  // ── Alignement cross-branch (cas ECG réels) ────────────────────────────────────
  it('IDRISSOU (Responsable, parent AG row 0) → row 3', () => {
    expect(computeOrgRow({ fonction: 'Responsable Des Resources Humaines' }, 0)).toBe(3)
  })
  it("Cédric (Responsable, parent Directeur row 2) → row 3 — même niveau qu'IDRISSOU", () => {
    expect(computeOrgRow({ fonction: "Responsable des systèmes d'information" }, 2)).toBe(3)
  })
  it('Samuel NGOULA (chargé, parent Responsable row 3) → row 4', () => {
    expect(computeOrgRow({ fonction: 'chargé des organisations et projets' }, 3)).toBe(4)
  })
  it('Systeme Admin (chargé, parent Directeur row 2) → row max(3,4)=4 — même niveau que Samuel', () => {
    expect(computeOrgRow({ fonction: 'chargé des organisations et projets' }, 2)).toBe(4)
  })
  it('Aline/Irene (ADG) à row 1, AVANT les Directeurs département row 2', () => {
    const adgRow = computeOrgRow({ fonction: 'Administrateur Directeur Général' }, 0)
    const dirRow = computeOrgRow({ fonction: 'Directeur des Organisations et projets' }, 0)
    expect(adgRow).toBe(1)
    expect(dirRow).toBe(2)
    expect(adgRow).toBeLessThan(dirRow)
  })

  // ── Groupes ────────────────────────────────────────────────────────────────────────
  it('groupe sous parent row 2 → row parentRow+1 = 3', () => {
    expect(computeOrgRow({ _isGroup: true }, 2)).toBe(3)
  })
})

// ─── 3. Rendu visuel Box via TreeNode ─────────────────────────────────────────
// On importe le composant par défaut pour le rendu intégration légère.
// On ne teste PAS l'export PDF/PNG (trop d'API DOM canvas non dispo en jsdom).
import OrgChart from '../OrgChart'

const mockEmployes = [
  { matricule: '1001', prenom: 'Paul', nom: 'Nfor', fonction: 'Directeur Général', ville: 'Yaoundé', n1: null, entite: 'ECG', departement: 'Direction' },
  { matricule: '1002', prenom: 'Ivan', nom: 'Deffo', fonction: 'Responsable SI', ville: 'Yaoundé', n1: '1001', entite: 'ECG', departement: 'SI' },
  { matricule: '1003', prenom: 'Julie', nom: 'Nanga', fonction: 'Employée', ville: 'Yaoundé', n1: '1002', entite: 'ECG', departement: 'SI' },
  { matricule: '2001', prenom: 'Marc', nom: 'Test', fonction: 'Directeur Général', ville: 'Douala', n1: null, entite: 'ELCAM', departement: 'Direction' },
  { matricule: '3001', prenom: 'Anne', nom: 'Test', fonction: 'Directeur Général', ville: 'Douala', n1: null, entite: 'EXCA', departement: 'Direction' },
]

describe('OrgChart — rendu composant', () => {
  beforeEach(() => {
    mockApi.get.mockResolvedValue({ data: mockEmployes })
  })

  it('affiche le titre "Organigramme"', async () => {
    render(<OrgChart />)
    const hits = await screen.findAllByText(/organigramme/i)
    expect(hits.length).toBeGreaterThan(0)
  })

  it('affiche les filtres entité (ECG, ELCAM, EXCA)', async () => {
    render(<OrgChart />)
    // Les pills entité sont toujours présentes (fixées dans le composant)
    const buttons = await screen.findAllByRole('button')
    const labels = buttons.map(b => b.textContent)
    expect(labels.some(l => /ecg/i.test(l))).toBe(true)
    expect(labels.some(l => /elcam/i.test(l))).toBe(true)
    expect(labels.some(l => /exca/i.test(l))).toBe(true)
  })

  it('affiche le nom du DG après chargement', async () => {
    render(<OrgChart />)
    expect(await screen.findByText(/Paul Nfor/i)).toBeInTheDocument()
  })

  it('affiche le bouton Exporter PDF', async () => {
    render(<OrgChart />)
    // Ouvre le menu export (bouton ⋯)
    const exportBtn = await screen.findByRole('button', { name: /exporter/i })
    fireEvent.click(exportBtn)
    // Le menu doit contenir l'option PDF
    expect(await screen.findByRole('menuitem', { name: /pdf/i })).toBeInTheDocument()
  })
})

// ─── 4. Symboles ▼/▲ dans oc-foot ────────────────────────────────────────────
describe('OrgChart — symboles expand/collapse', () => {
  beforeEach(() => {
    mockApi.get.mockResolvedValue({ data: mockEmployes })
  })

  it('affiche ▼ (nœud replié par défaut en profondeur >= 2)', async () => {
    render(<OrgChart />)
    // Le DG a des enfants → oc-foot visible avec ▼ ou ▲
    const arrows = await screen.findAllByText(/[▼▲]/)
    expect(arrows.length).toBeGreaterThan(0)
  })

  it('oc-foot affiche "subordonné(s)" et non un symbole corrompu', async () => {
    render(<OrgChart />)
    const footTexts = await screen.findAllByText(/subordonn/)
    expect(footTexts.length).toBeGreaterThan(0)
    // Aucun texte ne doit contenir "?" seul (symbole corrompu)
    footTexts.forEach(el => {
      expect(el.textContent).not.toMatch(/^\d+\?$/)
    })
  })
})

// ─── 5. PCA injection ELCAM / EXCA ───────────────────────────────────────────
// Données ECG réelles : Paul Nfor (9001) est AG ECG,
// Aline Manga (9002 ELCAM) et Irene Kouam (9004 EXCA) ont n1=9001.
const mockECGFull = [
  { matricule: '9001', prenom: 'Paul', nom: 'Nfor', fonction: 'Administrateur Général', ville: 'Yaoundé', n1: null, entite: 'ECG' },
  { matricule: '9002', prenom: 'Aline', nom: 'Manga', fonction: 'Administrateur Directeur Général', ville: 'Douala', n1: '9001', entite: 'ELCAM' },
  { matricule: '9004', prenom: 'Irene', nom: 'Kouam', fonction: 'Administrateur Directeur Général', ville: 'Douala', n1: '9001', entite: 'EXCA' },
  { matricule: '9011', prenom: 'Ivan', nom: 'DEFFO', fonction: 'Directeur des Organisations et projets', ville: 'Yaoundé', n1: '9001', entite: 'ECG' },
]

describe('OrgChart — PCA injection filiales', () => {
  beforeEach(() => {
    mockApi.get.mockResolvedValue({ data: mockECGFull })
  })

  it('filtre ECG : Paul Nfor garde son titre original, pas de PCA', async () => {
    render(<OrgChart />)
    const buttons = await screen.findAllByRole('button')
    const ecgBtn = buttons.find(b => b.textContent.trim() === 'ECG')
    fireEvent.click(ecgBtn)
    expect(await screen.findByText(/Paul Nfor/i)).toBeInTheDocument()
    // Le titre PCA injecté ne doit PAS apparaître sur ECG
    expect(screen.queryByText(/Président du Conseil/i)).toBeNull()
  })

  it('filtre ELCAM : Paul Nfor apparaît avec le titre PCA', async () => {
    render(<OrgChart />)
    const buttons = await screen.findAllByRole('button')
    const elcamBtn = buttons.find(b => b.textContent.trim() === 'ELCAM')
    fireEvent.click(elcamBtn)
    expect(await screen.findByText(/Paul Nfor/i)).toBeInTheDocument()
    expect(await screen.findByText(/Président du Conseil/i)).toBeInTheDocument()
    expect(await screen.findByText(/PCA/i)).toBeInTheDocument()
  })

  it('filtre EXCA : Paul Nfor apparaît avec le titre PCA', async () => {
    render(<OrgChart />)
    const buttons = await screen.findAllByRole('button')
    const excaBtn = buttons.find(b => b.textContent.trim() === 'EXCA')
    fireEvent.click(excaBtn)
    expect(await screen.findByText(/Paul Nfor/i)).toBeInTheDocument()
    expect(await screen.findByText(/Président du Conseil/i)).toBeInTheDocument()
  })

  it('filtre ELCAM : Aline Manga apparaît sous Paul Nfor', async () => {
    render(<OrgChart />)
    const buttons = await screen.findAllByRole('button')
    const elcamBtn = buttons.find(b => b.textContent.trim() === 'ELCAM')
    fireEvent.click(elcamBtn)
    expect(await screen.findByText(/Aline/i)).toBeInTheDocument()
    expect(await screen.findByText(/Manga/i)).toBeInTheDocument()
  })

  it('filtre EXCA : Irene Kouam apparaît sous Paul Nfor', async () => {
    render(<OrgChart />)
    const buttons = await screen.findAllByRole('button')
    const excaBtn = buttons.find(b => b.textContent.trim() === 'EXCA')
    fireEvent.click(excaBtn)
    expect(await screen.findByText(/Irene/i)).toBeInTheDocument()
    expect(await screen.findByText(/Kouam/i)).toBeInTheDocument()
  })
})

// ─── 6. CSS dimensions et polices verrouillées ────────────────────────────────
// Ces tests garantissent que les valeurs CSS critiques ne régressent pas.
describe('OrgChart — CSS dimensions figées', () => {
  beforeEach(() => {
    mockApi.get.mockResolvedValue({ data: mockEmployes })
  })

  const getStyles = async () => {
    render(<OrgChart />)
    await screen.findAllByText(/organigramme/i)
    return Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('')
  }

  it('boîtes : width 185px + height 120px (taille fixe)', async () => {
    const css = await getStyles()
    expect(css).toContain('width: 185px')
    expect(css).toContain('height: 120px')
  })

  it('oc-label : font-size 0.90rem', async () => {
    const css = await getStyles()
    expect(css).toContain('font-size: 0.90rem')
  })

  it('oc-sub : font-size 0.78rem', async () => {
    const css = await getStyles()
    expect(css).toContain('font-size: 0.78rem')
  })

  it('oc-stem : height 12px (espace vertical réduit)', async () => {
    const css = await getStyles()
    expect(css).toContain('height: 12px')
  })
})
