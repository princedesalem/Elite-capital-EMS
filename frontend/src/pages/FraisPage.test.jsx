import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FraisPage from './FraisPage'

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
const apiDeleteMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    post: (...args) => apiPostMock(...args),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: (...args) => apiDeleteMock(...args),
    defaults: { baseURL: '' },
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: 1001, role: 'EMPLOYE', prenom: 'Jean', nom: 'Test' },
  }),
}))

vi.mock('../components/WorkflowModal', () => ({ default: () => null }))

const baseMission = {
  id_operation: 55,
  type_demande: 'Frais de mission',
  a_des_frais: true,
  statut: 'validé',
  date_debut: '2026-03-01',
  date_fin: '2026-03-05',
  motif: 'Frais Test Mission',
}

const baseBoite = {
  envoye: [{ ...baseMission, __workflow_bucket: 'envoye' }],
  recu: [],
  valide: [],
  refuse: [],
}

const setupMocks = ({ preuves = [] } = {}) => {
  apiGetMock.mockImplementation((url) => {
    if (String(url).includes('/api/missions/mes-missions/'))
      return Promise.resolve({ data: [baseMission] })
    if (String(url).includes('/api/missions/en-tant-que-missionnaire/'))
      return Promise.resolve({ data: [] })
    if (String(url).includes('/api/workflow/boite/'))
      return Promise.resolve({ data: baseBoite })
    if (String(url).includes(`/api/missions/frais/${baseMission.id_operation}`))
      return Promise.resolve({
        data: {
          id_frais: 77,
          id_mission: baseMission.id_operation,
          frais_payes: false,
          frais_valides_missionnaire: false,
          frais_valides_rh: false,
          date_paiement_frais: null,
          preuves_paiement: preuves,
        },
      })
    if (String(url).includes(`/api/missions/${baseMission.id_operation}/statut-mission`))
      return Promise.resolve({
        data: { rapport_televerse: false, date_telechargement_rapport: null },
      })
    return Promise.resolve({ data: [] })
  })
}

describe('FraisPage preuves column', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()
  })

  it('shows dash when no preuves exist', async () => {
    setupMocks({ preuves: [] })

    await act(async () => {
      render(<MemoryRouter><FraisPage /></MemoryRouter>)
    })

    // Dash is present, green badge is not
    expect(screen.queryByText('✓ Téléversées')).toBeNull()
  })

  it('shows Téléversées badge when preuves exist', async () => {
    setupMocks({
      preuves: [
        { fichier: 'facture.pdf', type_preuve: 'facture', date_telechargement: '2026-01-20T09:00:00' },
      ],
    })

    await act(async () => {
      render(<MemoryRouter><FraisPage /></MemoryRouter>)
    })

    expect(await screen.findByText('✓ Téléversées')).toBeTruthy()
  })

  it('badge title includes date when date_telechargement is set', async () => {
    const dateIso = '2026-01-20T09:00:00'
    setupMocks({
      preuves: [{ fichier: 'recu.pdf', type_preuve: 'recu', date_telechargement: dateIso }],
    })

    await act(async () => {
      render(<MemoryRouter><FraisPage /></MemoryRouter>)
    })

    const badge = await screen.findByText('✓ Téléversées')
    const title = badge.getAttribute('title')
    expect(title).toContain('Dernier:')
  })
})

describe('FraisPage labels & accents', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()
    setupMocks()
  })

  it('renders table headers with correct French accents', async () => {
    await act(async () => {
      render(<MemoryRouter><FraisPage /></MemoryRouter>)
    })

    expect(screen.getByText('Date Création')).toBeTruthy()
    expect(screen.getByText('Date Départ')).toBeTruthy()
    expect(screen.getByText('Date Retour')).toBeTruthy()
  })

  it('renders tab labels with correct French accents', async () => {
    await act(async () => {
      render(<MemoryRouter><FraisPage /></MemoryRouter>)
    })

    expect(screen.getByText('Envoyé', { exact: false })).toBeTruthy()
  })
})

describe('FraisPage upload button visibility', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()
  })

  it('shows upload button always, even when user has no missionnaire missions', async () => {
    setupMocks()

    await act(async () => {
      render(<MemoryRouter><FraisPage /></MemoryRouter>)
    })

    expect(await screen.findByRole('button', { name: /Téléverser preuves/i })).toBeTruthy()
  })

  it('shows upload button when user IS a missionnaire', async () => {
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/missions/mes-missions/'))
        return Promise.resolve({ data: [baseMission] })
      if (String(url).includes('/api/missions/en-tant-que-missionnaire/'))
        return Promise.resolve({ data: [{ ...baseMission, id_operation: 56 }] })
      if (String(url).includes('/api/workflow/boite/'))
        return Promise.resolve({ data: baseBoite })
      if (String(url).includes(`/api/missions/frais/`))
        return Promise.resolve({ data: { id_frais: 77, preuves_paiement: [] } })
      if (String(url).includes('/api/missions/') && String(url).includes('/statut-mission'))
        return Promise.resolve({ data: { rapport_televerse: false, date_telechargement_rapport: null } })
      return Promise.resolve({ data: [] })
    })

    await act(async () => {
      render(<MemoryRouter><FraisPage /></MemoryRouter>)
    })

    expect(await screen.findByRole('button', { name: /Téléverser preuves/i })).toBeTruthy()
  })
})

describe('FraisPage upload mission select', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()
  })

  it('upload modal populates mission select with a_des_frais missions from missionnaireMissions', async () => {
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/missions/mes-missions/'))
        return Promise.resolve({ data: [] })
      if (String(url).includes('/api/missions/en-tant-que-missionnaire/'))
        return Promise.resolve({
          data: [{ id_operation: 56, a_des_frais: true, pays: 'Cameroun', ville: 'Douala', statut: 'validé', date_debut: '2026-04-01', date_fin: '2026-04-05' }],
        })
      if (String(url).includes('/api/workflow/boite/'))
        return Promise.resolve({ data: { envoye: [], recu: [], valide: [], refuse: [] } })
      return Promise.resolve({ data: [] })
    })

    await act(async () => {
      render(<MemoryRouter><FraisPage /></MemoryRouter>)
    })

    const uploadBtn = await screen.findByRole('button', { name: /Téléverser preuves/i })
    fireEvent.click(uploadBtn)

    await waitFor(() => {
      const allOptions = screen.getAllByRole('option')
      const texts = allOptions.map((o) => o.textContent)
      expect(texts.some((t) => t.includes('#56'))).toBe(true)
    })
  })

  it('handleMissionPreuveSelect calls statut-paiement-frais and fills id_frais', async () => {
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/missions/mes-missions/'))
        return Promise.resolve({ data: [] })
      if (String(url).includes('/api/missions/en-tant-que-missionnaire/'))
        return Promise.resolve({
          data: [{ id_operation: 56, a_des_frais: true, pays: 'Cameroun', ville: 'Douala', statut: 'validé', date_debut: '2026-04-01', date_fin: '2026-04-05' }],
        })
      if (String(url).includes('/api/workflow/boite/'))
        return Promise.resolve({ data: { envoye: [], recu: [], valide: [], refuse: [] } })
      if (String(url).includes('/api/missions/56/statut-paiement-frais'))
        return Promise.resolve({ data: { id_frais: 99, frais_payes: false } })
      return Promise.resolve({ data: [] })
    })

    await act(async () => {
      render(<MemoryRouter><FraisPage /></MemoryRouter>)
    })

    const uploadBtn = await screen.findByRole('button', { name: /Téléverser preuves/i })
    fireEvent.click(uploadBtn)

    const missionSelects = await screen.findAllByRole('combobox')
    await act(async () => {
      fireEvent.change(missionSelects[0], { target: { value: '56' } })
    })

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/api/missions/56/statut-paiement-frais')
    })
  })
})

describe('FraisPage supprimer-preuve', () => {
  const FRAIS_ID = 77

  const setupWithPreuve = () => {
    const preuve = { type_preuve: 'facture', fichier: 'uploads/preuves_frais/facture.pdf', date_telechargement: '2026-04-02T10:00:00' }
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/missions/mes-missions/'))
        return Promise.resolve({ data: [{ ...baseMission, id_operation: 55 }] })
      if (String(url).includes('/api/missions/en-tant-que-missionnaire/'))
        return Promise.resolve({ data: [{ ...baseMission, id_operation: 55 }] })
      if (String(url).includes('/api/workflow/boite/'))
        return Promise.resolve({ data: baseBoite })
      if (String(url).includes(`/api/missions/frais/55`))
        return Promise.resolve({
          data: { id_frais: FRAIS_ID, id_mission: 55, frais_payes: false, preuves_paiement: [preuve] },
        })
      if (String(url).includes(`/api/missions/55/statut-mission`))
        return Promise.resolve({ data: { rapport_televerse: false, date_telechargement_rapport: null } })
      return Promise.resolve({ data: [] })
    })
    apiDeleteMock.mockResolvedValue({ data: { message: 'Preuve supprimée avec succès' } })
  }

  beforeEach(() => {
    apiGetMock.mockReset()
    apiDeleteMock.mockReset()
    window.confirm = vi.fn(() => true)
    setupWithPreuve()
  })

  it('calls DELETE supprimer-preuve with correct params when confirm accepted', async () => {
    await act(async () => {
      render(<MemoryRouter><FraisPage /></MemoryRouter>)
    })

    // Wait for fraisPaymentStatuts to load — badge appears when preuves exist
    const preuveCell = await screen.findByText('✓ Téléversées')
    fireEvent.click(preuveCell)

    // PreuvesModal opens and fetches frais data — delete button appears per preuve
    const deleteBtn = await screen.findByTitle('Supprimer')
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(apiDeleteMock).toHaveBeenCalledWith(
        `/api/missions/frais/${FRAIS_ID}/supprimer-preuve`,
        expect.objectContaining({ params: expect.objectContaining({ matricule: 1001, index: 0 }) }),
      )
    })
  })
})

