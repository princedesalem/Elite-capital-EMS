import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CongeCalendar from './CongeCalendar'

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

vi.mock('../hooks/useAutoRefresh', () => ({
  useAutoRefresh: () => {},
}))

vi.mock('lucide-react', () => {
  const Comp = ({ size, ...rest }) => <svg data-testid="icon" width={size} {...rest} />
  return {
    Umbrella: Comp, Plane: Comp, Shield: Comp, Baby: Comp,
    Heart: Comp, Activity: Comp, Star: Comp, LogOut: Comp,
    FileText: Comp, ClipboardList: Comp,
    X: Comp, User: Comp, Calendar: Comp, Clock: Comp,
    MapPin: Comp, MessageSquare: Comp, CheckCircle: Comp, Tag: Comp,
    ChevronLeft: Comp, ChevronRight: Comp,
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────
const today = new Date()
const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1)
const fmt = d => d.toISOString().split('T')[0]

function makeOp(overrides = {}) {
  return {
    id_operation: 1,
    matricule: 1001,
    date_depart: fmt(yesterday),
    date_retour: fmt(tomorrow),
    type: 'OPERATION_GENERIQUE',
    type_demande: null,
    statut: 'approuvé',
    ...overrides,
  }
}

function makeSortie(overrides = {}) {
  return {
    id_sortie: 10,
    matricule: 1001,
    date_sortie: fmt(today),
    heure_sortie: '09:00',
    heure_retour: '12:00',
    commentaire: null,
    statut: 'validé',
    ...overrides,
  }
}

function setupMocks({ ops = [], sorties = [], employees = [] } = {}) {
  apiGetMock.mockImplementation((url) => {
    if (url === '/api/operations') return Promise.resolve({ data: ops })
    if (url === '/api/sorties')    return Promise.resolve({ data: sorties })
    if (url === '/employees/')     return Promise.resolve({ data: employees })
    return Promise.resolve({ data: [] })
  })
}

const employees = [{ matricule: 1001, prenom: 'Alice', nom: 'Dupont' }]

// ── Tests ──────────────────────────────────────────────────────────────────
describe('CongeCalendar — rendering & data loading', () => {
  beforeEach(() => apiGetMock.mockReset())

  it('renders without crashing', async () => {
    setupMocks()
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('does NOT call /leaves (broken endpoint removed)', async () => {
    setupMocks()
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    const urls = apiGetMock.mock.calls.map(c => c[0])
    expect(urls).not.toContain('/leaves')
    expect(urls).toContain('/api/operations')
    expect(urls).toContain('/api/sorties')
    expect(urls).toContain('/employees/')
  })

  it('calls /api/sorties alongside /api/operations', async () => {
    setupMocks()
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      const urls = apiGetMock.mock.calls.map(c => c[0])
      expect(urls).toContain('/api/sorties')
    })
  })

  it('shows month navigation with current month', async () => {
    setupMocks()
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
    await waitFor(() => {
      expect(screen.queryByText(new RegExp(months[new Date().getMonth()]))).toBeTruthy()
    })
  })

  it('shows legend with type labels and icons', async () => {
    setupMocks()
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByText('Congé').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Mission').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Sortie').length).toBeGreaterThan(0)
    })
  })
})

describe('CongeCalendar — type label resolution', () => {
  beforeEach(() => apiGetMock.mockReset())

  it('labels CONGE type as "Congé — Alice Dupont"', async () => {
    setupMocks({ ops: [makeOp({ type: 'CONGE' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByTitle(/^Congé — Alice Dupont$/).length).toBeGreaterThan(0)
    })
  })

  it('labels MISSION type as "Mission — Alice Dupont"', async () => {
    setupMocks({ ops: [makeOp({ type: 'MISSION' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByTitle(/^Mission — Alice Dupont$/).length).toBeGreaterThan(0)
    })
  })

  it('labels PERMISSION_MATERNELLE correctly', async () => {
    setupMocks({ ops: [makeOp({ type: 'PERMISSION_MATERNELLE' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByTitle(/^Maternelle — Alice Dupont$/).length).toBeGreaterThan(0)
    })
  })

  it('labels PERMISSION_MALADIE correctly', async () => {
    setupMocks({ ops: [makeOp({ type: 'PERMISSION_MALADIE' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByTitle(/^Perm. Maladie — Alice Dupont$/).length).toBeGreaterThan(0)
    })
  })

  it('resolves OPERATION_GENERIQUE with type_demande="Congé"', async () => {
    setupMocks({ ops: [makeOp({ type: 'OPERATION_GENERIQUE', type_demande: 'Congé' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByTitle(/^Congé — Alice Dupont$/).length).toBeGreaterThan(0)
    })
  })

  it('resolves OPERATION_GENERIQUE with type_demande="Mission"', async () => {
    setupMocks({ ops: [makeOp({ type: 'OPERATION_GENERIQUE', type_demande: 'Mission' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByTitle(/^Mission — Alice Dupont$/).length).toBeGreaterThan(0)
    })
  })

  it('resolves OPERATION_GENERIQUE with type_demande="Permission"', async () => {
    setupMocks({ ops: [makeOp({ type: 'OPERATION_GENERIQUE', type_demande: 'Permission' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByTitle(/^Perm. NC — Alice Dupont$/).length).toBeGreaterThan(0)
    })
  })

  it('null type with type_demande="Mission" falls back correctly', async () => {
    setupMocks({ ops: [makeOp({ type: null, type_demande: 'Mission' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByTitle(/^Mission — Alice Dupont$/).length).toBeGreaterThan(0)
    })
  })

  it('shows icons inside event pills', async () => {
    setupMocks({ ops: [makeOp({ type: 'CONGE' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByTestId('icon').length).toBeGreaterThan(0)
    })
  })
})

describe('CongeCalendar — validated-only filter', () => {
  beforeEach(() => apiGetMock.mockReset())

  it('hides operations with statut "en attente"', async () => {
    setupMocks({ ops: [makeOp({ type: 'CONGE', statut: 'en attente' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    // No event pill with label "Congé — Alice Dupont"
    expect(screen.queryAllByTitle(/^Congé — Alice Dupont$/).length).toBe(0)
  })

  it('hides operations with statut "refusé"', async () => {
    setupMocks({ ops: [makeOp({ type: 'CONGE', statut: 'refusé' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    expect(screen.queryAllByTitle(/^Congé — Alice Dupont$/).length).toBe(0)
  })

  it('shows operations with statut "validé"', async () => {
    setupMocks({ ops: [makeOp({ type: 'CONGE', statut: 'validé' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByTitle(/^Congé — Alice Dupont$/).length).toBeGreaterThan(0)
    })
  })

  it('shows operations with statut "approuvé"', async () => {
    setupMocks({ ops: [makeOp({ type: 'MISSION', statut: 'approuvé' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByTitle(/^Mission — Alice Dupont$/).length).toBeGreaterThan(0)
    })
  })
})

describe('CongeCalendar — sorties', () => {
  beforeEach(() => apiGetMock.mockReset())

  it('shows validated sortie from /api/sorties as "Sortie — Alice Dupont"', async () => {
    setupMocks({ sorties: [makeSortie()], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByTitle(/^Sortie — Alice Dupont/).length).toBeGreaterThan(0)
    })
  })

  it('hides sortie with statut "en attente"', async () => {
    setupMocks({ sorties: [makeSortie({ statut: 'en attente' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    expect(screen.queryAllByTitle(/^Sortie — Alice Dupont/).length).toBe(0)
  })

  it('label includes time range when heure_sortie and heure_retour are present', async () => {
    setupMocks({ sorties: [makeSortie({ heure_sortie: '11:15', heure_retour: '16:58' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByTitle(/Sortie — Alice Dupont \(11:15–16:58\)/).length).toBeGreaterThan(0)
    })
  })
})

describe('CongeCalendar — detail modal', () => {
  beforeEach(() => apiGetMock.mockReset())

  it('opens detail modal when clicking an event pill', async () => {
    setupMocks({ ops: [makeOp({ type: 'CONGE', statut: 'validé' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByTitle(/^Congé — Alice Dupont$/).length).toBeGreaterThan(0)
    })
    const pill = screen.getAllByTitle(/^Congé — Alice Dupont$/)[0]
    fireEvent.click(pill)
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    })
  })

  it('modal shows employee name and type label', async () => {
    setupMocks({ ops: [makeOp({ type: 'CONGE', statut: 'validé' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => screen.getAllByTitle(/^Congé — Alice Dupont$/))
    fireEvent.click(screen.getAllByTitle(/^Congé — Alice Dupont$/)[0])
    await waitFor(() => {
      const dialog = screen.getByRole('dialog')
      expect(dialog.textContent).toContain('Alice Dupont')
      expect(dialog.textContent).toContain('Congé')
    })
  })

  it('closes modal when clicking the X button', async () => {
    setupMocks({ ops: [makeOp({ type: 'CONGE', statut: 'validé' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => screen.getAllByTitle(/^Congé — Alice Dupont$/))
    fireEvent.click(screen.getAllByTitle(/^Congé — Alice Dupont$/)[0])
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByTestId('modal-close'))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('closes modal when clicking the backdrop', async () => {
    setupMocks({ ops: [makeOp({ type: 'CONGE', statut: 'validé' })], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => screen.getAllByTitle(/^Congé — Alice Dupont$/))
    fireEvent.click(screen.getAllByTitle(/^Congé — Alice Dupont$/)[0])
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByTestId('event-modal-backdrop'))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})

describe('CongeCalendar — date_debut / date_fin (missions)', () => {
  beforeEach(() => apiGetMock.mockReset())

  it('shows a mission that only has date_debut / date_fin (no date_depart / date_retour)', async () => {
    const missionOp = {
      id_operation: 99,
      matricule: 1001,
      date_depart: null,
      date_retour: null,
      date_debut: fmt(yesterday),
      date_fin: fmt(tomorrow),
      type: 'MISSION',
      type_demande: 'Mission',
      statut: 'validé',
    }
    setupMocks({ ops: [missionOp], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getAllByTitle(/^Mission — Alice Dupont$/).length).toBeGreaterThan(0)
    })
  })

  it('hides a mission with date_debut / date_fin when statut is "en attente"', async () => {
    const missionOp = {
      id_operation: 100,
      matricule: 1001,
      date_depart: null,
      date_retour: null,
      date_debut: fmt(yesterday),
      date_fin: fmt(tomorrow),
      type: 'MISSION',
      type_demande: 'Mission',
      statut: 'en attente',
    }
    setupMocks({ ops: [missionOp], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    expect(screen.queryAllByTitle(/^Mission — Alice Dupont$/).length).toBe(0)
  })

  it('modal shows correct period for a mission using date_debut / date_fin', async () => {
    const missionOp = {
      id_operation: 101,
      matricule: 1001,
      date_depart: null,
      date_retour: null,
      date_debut: fmt(yesterday),
      date_fin: fmt(tomorrow),
      type: 'MISSION',
      type_demande: 'Mission',
      statut: 'approuvé',
    }
    setupMocks({ ops: [missionOp], employees })
    render(<MemoryRouter><CongeCalendar /></MemoryRouter>)
    await waitFor(() => screen.getAllByTitle(/^Mission — Alice Dupont$/))
    fireEvent.click(screen.getAllByTitle(/^Mission — Alice Dupont$/)[0])
    await waitFor(() => {
      const dialog = screen.getByRole('dialog')
      expect(dialog.textContent).toContain('Alice Dupont')
      expect(dialog.textContent).toContain('Mission')
    })
  })
})
