import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EmployeeTimeline, { buildTimeline, isStatutValide } from './EmployeeTimeline'

const apiGetMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: 1001, role: 'RH', prenom: 'Alice', nom: 'Dupont' },
  }),
}))

vi.mock('../components/AvatarCircle', () => ({
  default: () => <div data-testid="avatar" />,
}))

const EMPLOYEE = {
  matricule: 1001, prenom: 'Alice', nom: 'Dupont', statut: 'ACTIF',
  fonction: 'Analyste', date_embauche: '2022-01-15',
}

describe('EmployeeTimeline', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((url) => {
      const s = String(url)
      if (s.includes('/parcours')) return Promise.resolve({ data: [] })
      if (s.includes('/employees/1001')) return Promise.resolve({ data: EMPLOYEE })
      return Promise.resolve({ data: [] })
    })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter initialEntries={['/?matricule=1001']}><EmployeeTimeline /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows timeline heading', async () => {
    render(<MemoryRouter initialEntries={['/?matricule=1001']}><EmployeeTimeline /></MemoryRouter>)
    // Heading text may be split across icon+text nodes; check document contains the keyword
    await waitFor(() => {
      const matches = screen.queryAllByText(/timeline|historique|parcours/i)
      expect(matches.length + (document.body.textContent.match(/parcours|timeline|historique/i) ? 1 : 0)).toBeGreaterThan(0)
    })
  })

  it('header de page : aucun gradient rouge (#ce2b2b)', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/?matricule=1001']}><EmployeeTimeline /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    Array.from(container.querySelectorAll('div[style]'))
      .filter(d => d.style.background && d.style.background.includes('gradient'))
      .forEach(d => { expect(d.style.background).not.toContain('ce2b2b') })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests unitaires de buildTimeline et isStatutValide
// ─────────────────────────────────────────────────────────────────────────────

const EMP = { date_embauche: '2020-01-15', fonction: 'Analyste', nom_entite: 'ECG' }

describe('isStatutValide', () => {
  it('accepte les variantes valides courantes', () => {
    expect(isStatutValide('approuve')).toBe(true)
    expect(isStatutValide('approuv\u00e9')).toBe(true)
    expect(isStatutValide('valid\u00e9')).toBe(true)
    expect(isStatutValide('valid\u00e9e')).toBe(true)
    expect(isStatutValide('accord\u00e9')).toBe(true)
    expect(isStatutValide('termine')).toBe(true)
    expect(isStatutValide('termin\u00e9')).toBe(true)
    expect(isStatutValide('effectu\u00e9')).toBe(true)
  })

  it('rejette les statuts non valid\u00e9s', () => {
    expect(isStatutValide('en_attente')).toBe(false)
    expect(isStatutValide('refuse')).toBe(false)
    expect(isStatutValide('refus\u00e9')).toBe(false)
    expect(isStatutValide('brouillon')).toBe(false)
    expect(isStatutValide('')).toBe(false)
    expect(isStatutValide(null)).toBe(false)
    expect(isStatutValide(undefined)).toBe(false)
  })
})

describe('buildTimeline \u2014 ordre chronologique ascendant', () => {
  it('le plus ancien \u00e9v\u00e9nement est en t\u00eate', () => {
    const parcours = [{ type_action: 'PROMOTION', date_action: '2023-06-01', libelle: 'Promo' }]
    const events = buildTimeline(EMP, [], [], parcours, [], [], [])
    expect(events[0].type).toBe('embauche')
    expect(new Date(events[0].date) < new Date(events[1].date)).toBe(true)
  })

  it('ne plante pas avec des tableaux undefined', () => {
    expect(() => buildTimeline(EMP, undefined, undefined, undefined, undefined, undefined, undefined)).not.toThrow()
  })

  it('retourne [] si aucun \u00e9v\u00e9nement', () => {
    expect(buildTimeline({}, [], [], [], [], [], [])).toHaveLength(0)
  })
})

describe('buildTimeline \u2014 embauche', () => {
  it('g\u00e9n\u00e8re un \u00e9v\u00e9nement embauche si date_embauche pr\u00e9sente', () => {
    const events = buildTimeline(EMP, [], [], [], [], [], [])
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('embauche')
    expect(events[0].date).toBe('2020-01-15')
    expect(events[0].detail).toContain('Analyste')
    expect(events[0].detail).toContain('ECG')
  })

  it("n'ajoute pas d'embauche si date_embauche absente", () => {
    expect(buildTimeline({}, [], [], [], [], [], []).filter(e => e.type === 'embauche')).toHaveLength(0)
  })
})

describe('buildTimeline \u2014 cong\u00e9s (valid\u00e9s uniquement)', () => {
  const cv = { statut: 'approuv\u00e9', date_debut: '2022-07-01', date_fin: '2022-07-15', duree_jours: 14 }
  const cr = { statut: 'refus\u00e9',   date_debut: '2023-01-10', date_fin: '2023-01-12', duree_jours: 2  }
  const ca = { statut: 'en_attente', date_debut: '2024-03-01', duree_jours: 5 }

  it('inclut seulement les cong\u00e9s valid\u00e9s', () => {
    const events = buildTimeline(EMP, [cv, cr, ca], [], [], [], [], [])
    expect(events.filter(e => e.type === 'conge')).toHaveLength(1)
    expect(events.find(e => e.type === 'conge').date).toBe('2022-07-01')
  })

  it("le titre indique Cong\u00e9 approuv\u00e9", () => {
    const events = buildTimeline(EMP, [cv], [], [], [], [], [])
    expect(events.find(e => e.type === 'conge').title).toBe('Cong\u00e9 approuv\u00e9')
  })

  it('le d\u00e9tail contient la dur\u00e9e en jours', () => {
    const events = buildTimeline(EMP, [cv], [], [], [], [], [])
    expect(events.find(e => e.type === 'conge').detail).toContain('14j')
  })

  it('accepte la variante statut valid\u00e9e', () => {
    const events = buildTimeline(EMP, [{ ...cv, statut: 'valid\u00e9e' }], [], [], [], [], [])
    expect(events.filter(e => e.type === 'conge')).toHaveLength(1)
  })

  it('exclut les cong\u00e9s avec statut vide', () => {
    const events = buildTimeline(EMP, [{ statut: '', date_debut: '2024-01-01', duree_jours: 3 }], [], [], [], [], [])
    expect(events.filter(e => e.type === 'conge')).toHaveLength(0)
  })
})

describe('buildTimeline \u2014 missions (missionnaire valid\u00e9)', () => {
  const mv = { statut: 'approuv\u00e9', date_debut: '2023-03-10', ville: 'Paris', pays: 'France', initiateur_nom: 'Jean Dupont' }
  const ma = { statut: 'en_attente', date_debut: '2023-05-01', ville: 'Douala', pays: 'Cameroun', initiateur_nom: 'Marie Curie' }

  it('inclut seulement les missions valid\u00e9es', () => {
    const events = buildTimeline(EMP, [], [mv, ma], [], [], [], [])
    expect(events.filter(e => e.type === 'mission')).toHaveLength(1)
    expect(events.find(e => e.type === 'mission').title).toContain('Paris')
  })

  it('le d\u00e9tail contient le nom de l\u2019initiateur', () => {
    const events = buildTimeline(EMP, [], [mv], [], [], [], [])
    expect(events.find(e => e.type === 'mission').detail).toContain('Jean Dupont')
  })

  it('retourne 0 mission si toutes en attente', () => {
    expect(buildTimeline(EMP, [], [ma], [], [], [], []).filter(e => e.type === 'mission')).toHaveLength(0)
  })

  it('affiche N/A si ville et pays absents', () => {
    const m = { ...mv, ville: null, pays: null }
    expect(buildTimeline(EMP, [], [m], [], [], [], []).find(e => e.type === 'mission').title).toContain('N/A')
  })
})

describe('buildTimeline \u2014 \u00e9valuations', () => {
  it('inclut les \u00e9valuations avec note_finale', () => {
    const e1 = { statut: 'en_cours', date_creation: '2023-12-01', note_finale: 82 }
    const events = buildTimeline(EMP, [], [], [], [], [e1], [])
    expect(events.filter(e => e.type === 'evaluation')).toHaveLength(1)
    expect(events.find(e => e.type === 'evaluation').detail).toContain('82/100')
  })

  it('inclut les \u00e9valuations avec statut valid\u00e9 sans note', () => {
    const e2 = { statut: 'valid\u00e9', date_creation: '2024-01-10', note_finale: null }
    expect(buildTimeline(EMP, [], [], [], [], [e2], []).filter(e => e.type === 'evaluation')).toHaveLength(1)
  })

  it('exclut les brouillons sans note', () => {
    const e3 = { statut: 'brouillon', date_creation: '2024-05-01', note_finale: null }
    expect(buildTimeline(EMP, [], [], [], [], [e3], []).filter(e => e.type === 'evaluation')).toHaveLength(0)
  })
})

describe('buildTimeline \u2014 formations', () => {
  const f1 = { titre: 'Excel avanc\u00e9', date: '2021-11-05', statut: 'pr\u00e9sent', lieu: 'Salle A', source: 'evenement' }
  const f2 = { titre: 'S\u00e9curit\u00e9 SI', date: '2022-02-20', statut: 'inscrit', source: 'tache' }

  it('inclut toutes les formations sans filtre de statut', () => {
    expect(buildTimeline(EMP, [], [], [], [], [], [f1, f2]).filter(e => e.type === 'formation')).toHaveLength(2)
  })

  it('le d\u00e9tail pr\u00e9cise la source et le lieu', () => {
    const f = buildTimeline(EMP, [], [], [], [], [], [f1]).find(e => e.type === 'formation')
    expect(f.detail).toContain('(\u00c9v\u00e9nement)')
    expect(f.detail).toContain('Salle A')
  })

  it('utilise le titre comme titre de l\u2019\u00e9v\u00e9nement', () => {
    expect(buildTimeline(EMP, [], [], [], [], [], [f1]).find(e => e.type === 'formation').title).toBe('Excel avanc\u00e9')
  })

  it('utilise "Formation" si titre absent', () => {
    expect(buildTimeline(EMP, [], [], [], [], [], [{ date: '2022-01-01', source: 'tache' }]).find(e => e.type === 'formation').title).toBe('Formation')
  })
})

describe('buildTimeline \u2014 mesures disciplinaires', () => {
  it('inclut toutes les mesures et utilise le bon label', () => {
    const m = { type_mesure: 'avertissement', date_mesure: '2023-08-15', motif: 'Retard r\u00e9p\u00e9t\u00e9' }
    const events = buildTimeline(EMP, [], [], [], [m], [], [])
    const disc = events.find(e => e.type === 'disciplinaire')
    expect(disc).toBeTruthy()
    expect(disc.title).toBe('Avertissement')
    expect(disc.detail).toBe('Retard r\u00e9p\u00e9t\u00e9')
  })
})
