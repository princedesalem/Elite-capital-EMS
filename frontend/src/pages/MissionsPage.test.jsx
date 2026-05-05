import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MissionsPage from './MissionsPage'

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
const apiPutMock = vi.fn()
const apiDeleteMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    post: (...args) => apiPostMock(...args),
    put: (...args) => apiPutMock(...args),
    delete: (...args) => apiDeleteMock(...args),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: 1001, role: 'EMPLOYE', prenom: 'Jean', nom: 'Test' },
  }),
}))

vi.mock('../components/WorkflowModal', () => ({
  default: ({ isOpen, operationId }) => (isOpen ? <div data-testid="workflow-modal" data-op-id={String(operationId)} /> : null),
}))

describe('MissionsPage cancellation', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()
    apiPutMock.mockReset()
    apiDeleteMock.mockReset()

    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workflow/boite/')) {
        return Promise.resolve({
          data: {
            envoye: [
              {
                id_operation: 42,
                type_demande: 'mission',
                statut: 'en attente',
                date_debut: '2026-03-20',
                date_fin: '2026-03-22',
                motif: 'Mission test',
              },
            ],
            recu: [],
            valide: [],
            refuse: [],
          },
        })
      }
      if (String(url).includes('/api/missions/mes-missions/')) return Promise.resolve({ data: [] })
      if (String(url).includes('/api/conges/solde/')) return Promise.resolve({ data: { solde_conges: 10 } })
      return Promise.resolve({ data: [] })
    })

    apiDeleteMock.mockResolvedValue({ data: {} })

    window.confirm = vi.fn(() => true)
  })

  it('uses operations delete endpoint when cancelling a mission request', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <MissionsPage />
        </MemoryRouter>
      )
    })

    const cancelBtn = await screen.findByRole('button', { name: 'Annuler' })
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(apiDeleteMock).toHaveBeenCalledWith('/api/operations/42')
    })
  })

  it('ouvre WorkflowModal avec le bon operationId au clic sur une ligne (premier vu)', async () => {
    await act(async () => {
      render(<MemoryRouter><MissionsPage /></MemoryRouter>)
    })

    const cancelBtn = await screen.findByRole('button', { name: 'Annuler' })
    const row = cancelBtn.closest('tr')
    expect(row).toBeTruthy()
    fireEvent.click(row)

    await waitFor(() => {
      const modal = screen.getByTestId('workflow-modal')
      expect(modal.getAttribute('data-op-id')).toBe('42')
    })
  })
})

describe('MissionsPage rapport column badge', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()

    window.confirm = vi.fn(() => true)
  })

  const makeMission = (extraFields = {}) => ({
    id_operation: 99,
    type_demande: 'mission',
    statut: 'validé',
    date_debut: '2026-03-01',
    date_fin: '2026-03-05',
    motif: 'Rapport Test Mission',
    rapport_televerse: false,
    ...extraFields,
  })

  const setupMocks = (mission) => {
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/missions/mes-missions/'))
        return Promise.resolve({ data: [mission] })
      if (String(url).includes('/api/missions/en-tant-que-missionnaire/'))
        return Promise.resolve({ data: [] })
      if (String(url).includes('/api/workflow/boite/'))
        return Promise.resolve({ data: { envoye: [mission], recu: [], valide: [], refuse: [] } })
      if (String(url).includes(`/api/missions/${mission.id_operation}/statut-mission`))
        return Promise.resolve({
          data: {
            rapport_televerse: mission.rapport_televerse || false,
            date_telechargement_rapport: mission.date_telechargement_rapport || null,
          },
        })
      return Promise.resolve({ data: [] })
    })
  }

  it('shows green Téléversé badge when rapport_televerse is true', async () => {
    const mission = makeMission({ rapport_televerse: true })
    setupMocks(mission)

    await act(async () => {
      render(<MemoryRouter><MissionsPage /></MemoryRouter>)
    })

    expect(await screen.findByText('✓ Téléversé')).toBeTruthy()
  })

  it('shows dash when rapport not uploaded', async () => {
    const mission = makeMission({ rapport_televerse: false })
    setupMocks(mission)

    await act(async () => {
      render(<MemoryRouter><MissionsPage /></MemoryRouter>)
    })

    // Badge must NOT be present
    expect(screen.queryByText('✓ Téléversé')).toBeNull()
  })

  it('badge title includes upload date when date_telechargement_rapport is set', async () => {
    const dateIso = '2026-01-15T10:30:00'
    const mission = makeMission({ rapport_televerse: true, date_telechargement_rapport: dateIso })
    setupMocks(mission)

    await act(async () => {
      render(<MemoryRouter><MissionsPage /></MemoryRouter>)
    })

    const badge = await screen.findByText('✓ Téléversé')
    const title = badge.getAttribute('title')
    expect(title).toContain('Téléversé le')
  })
})

describe('MissionsPage labels & accents', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()

    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/missions/mes-missions/'))
        return Promise.resolve({ data: [{ id_operation: 1, type_demande: 'mission', statut: 'en attente', date_debut: '2026-04-01', date_fin: '2026-04-03', motif: 'Test' }] })
      if (String(url).includes('/api/missions/en-tant-que-missionnaire/'))
        return Promise.resolve({ data: [] })
      if (String(url).includes('/api/workflow/boite/'))
        return Promise.resolve({ data: { envoye: [{ id_operation: 1, type_demande: 'mission', statut: 'en attente', date_debut: '2026-04-01', date_fin: '2026-04-03', motif: 'Test' }], recu: [], valide: [], refuse: [] } })
      return Promise.resolve({ data: [] })
    })
  })

  it('renders table headers with correct French accents', async () => {
    await act(async () => {
      render(<MemoryRouter><MissionsPage /></MemoryRouter>)
    })

    expect(screen.getByText('Date Création')).toBeTruthy()
    expect(screen.getByText('Date Départ')).toBeTruthy()
    expect(screen.getByText('Date Retour')).toBeTruthy()
    expect(screen.getByText('Durée')).toBeTruthy()
    expect(screen.getByText('État')).toBeTruthy()
  })

  it('renders tab labels with correct French accents', async () => {
    await act(async () => {
      render(<MemoryRouter><MissionsPage /></MemoryRouter>)
    })

    expect(screen.getByText('Envoyé', { exact: false })).toBeTruthy()
  })
})

describe('MissionsPage upload buttons visibility', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()
  })

  it('shows upload buttons even when user has no missionnaire missions', async () => {
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/missions/mes-missions/'))
        return Promise.resolve({ data: [] })
      if (String(url).includes('/api/missions/en-tant-que-missionnaire/'))
        return Promise.resolve({ data: [] })
      if (String(url).includes('/api/workflow/boite/'))
        return Promise.resolve({ data: { envoye: [], recu: [], valide: [], refuse: [] } })
      return Promise.resolve({ data: [] })
    })

    await act(async () => {
      render(<MemoryRouter><MissionsPage /></MemoryRouter>)
    })

    expect(await screen.findByRole('button', { name: /Téléverser rapport/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Téléverser preuves frais/i })).toBeTruthy()
  })

  it('shows upload buttons when user IS a missionnaire', async () => {
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/missions/mes-missions/'))
        return Promise.resolve({ data: [] })
      if (String(url).includes('/api/missions/en-tant-que-missionnaire/'))
        return Promise.resolve({ data: [{ id_operation: 10, type_demande: 'mission', statut: 'validé', date_debut: '2026-04-01', date_fin: '2026-04-03', motif: 'Missionnaire test' }] })
      if (String(url).includes('/api/workflow/boite/'))
        return Promise.resolve({ data: { envoye: [], recu: [], valide: [], refuse: [] } })
      return Promise.resolve({ data: [] })
    })

    await act(async () => {
      render(<MemoryRouter><MissionsPage /></MemoryRouter>)
    })

    expect(await screen.findByRole('button', { name: /Téléverser rapport/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Téléverser preuves frais/i })).toBeTruthy()
  })
})

describe('MissionsPage upload modals', () => {
  const missionItem = {
    id_operation: 10,
    type_demande: 'mission',
    activation_complete: true,
    a_des_frais: true,
    pays: 'Cameroun',
    ville: 'Douala',
    motif: 'Test item',
    statut: 'validé',
    date_debut: '2026-04-01',
    date_fin: '2026-04-05',
  }
  const missionnaireItem = {
    id_operation: 20,
    type_demande: 'mission',
    activation_complete: true,
    a_des_frais: true,
    pays: 'Gabon',
    ville: 'Libreville',
    motif: 'Test missionnaire',
    statut: 'validé',
    date_debut: '2026-04-01',
    date_fin: '2026-04-05',
  }

  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()

    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/missions/mes-missions/'))
        return Promise.resolve({ data: [missionItem] })
      if (String(url).includes('/api/missions/en-tant-que-missionnaire/'))
        return Promise.resolve({ data: [missionnaireItem] })
      if (String(url).includes('/api/workflow/boite/'))
        return Promise.resolve({ data: { envoye: [missionItem], recu: [], valide: [], refuse: [] } })
      return Promise.resolve({ data: [] })
    })
  })

  it('rapport modal dropdown includes missions from both items and workflowMissionnaire', async () => {
    await act(async () => {
      render(<MemoryRouter><MissionsPage /></MemoryRouter>)
    })

    const btns = await screen.findAllByRole('button', { name: /Téléverser rapport/i })
    fireEvent.click(btns[0])

    await waitFor(() => {
      const allOptions = screen.getAllByRole('option')
      const texts = allOptions.map((o) => o.textContent)
      expect(texts.some((t) => t.includes('#10'))).toBe(true)
      expect(texts.some((t) => t.includes('#20'))).toBe(true)
    })
  })

  it('preuves modal shows a mission select (not a raw id_frais input)', async () => {
    await act(async () => {
      render(<MemoryRouter><MissionsPage /></MemoryRouter>)
    })

    const btns = await screen.findAllByRole('button', { name: /Téléverser preuves frais/i })
    fireEvent.click(btns[0])

    await waitFor(() => {
      // The modal should have at least one combobox (mission select)
      const combos = screen.getAllByRole('combobox')
      expect(combos.length).toBeGreaterThan(0)
      // And options including both missions with frais
      const allOptions = screen.getAllByRole('option')
      const texts = allOptions.map((o) => o.textContent)
      expect(texts.some((t) => t.includes('#10'))).toBe(true)
      expect(texts.some((t) => t.includes('#20'))).toBe(true)
    })
  })
})

describe('MissionsPage supprimer-rapport', () => {
  const setupWithRapport = () => {
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/missions/mes-missions/'))
        return Promise.resolve({
          data: [{ id_operation: 77, type_demande: 'mission', statut: 'validé', date_debut: '2026-04-01', date_fin: '2026-04-05', motif: 'Test' }],
        })
      if (String(url).includes('/api/missions/en-tant-que-missionnaire/'))
        return Promise.resolve({
          data: [{ id_operation: 77, type_demande: 'mission', statut: 'validé', date_debut: '2026-04-01', date_fin: '2026-04-05', motif: 'Test' }],
        })
      if (String(url).includes('/api/workflow/boite/'))
        return Promise.resolve({ data: { envoye: [{ id_operation: 77, type_demande: 'mission', statut: 'validé', date_debut: '2026-04-01', date_fin: '2026-04-05', motif: 'Test' }], recu: [], valide: [], refuse: [] } })
      if (String(url).includes('/api/missions/77/rapport'))
        return Promise.resolve({
          data: {
            rapport_televerse: true,
            fichier: { chemin: 'uploads/rapports_missions/rapport.pdf', nom_fichier: 'rapport.pdf', url: '/uploads/rapports_missions/rapport.pdf' },
            date: '2026-04-02T10:00:00',
          },
        })
      return Promise.resolve({ data: [] })
    })
    apiDeleteMock.mockResolvedValue({ data: { message: 'Rapport supprimé avec succès' } })
  }

  beforeEach(() => {
    apiGetMock.mockReset()
    apiDeleteMock.mockReset()
    window.confirm = vi.fn(() => true)
    setupWithRapport()
  })

  it('calls DELETE supprimer-rapport with correct matricule when confirm accepted', async () => {
    await act(async () => {
      render(<MemoryRouter><MissionsPage /></MemoryRouter>)
    })

    // Click the rapport cell to open RapportModal (not the upload button)
    const rapportCell = await screen.findByTitle('Cliquez pour téléverser le rapport')
    fireEvent.click(rapportCell)

    // Wait for the modal to load rapport data and show the delete button
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(expect.stringContaining('/api/missions/77/rapport'))
    })

    const deleteBtn = await screen.findByTitle('Supprimer')
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(apiDeleteMock).toHaveBeenCalledWith(
        '/api/missions/77/supprimer-rapport',
        expect.objectContaining({ params: expect.objectContaining({ matricule: 1001 }) }),
      )
    })
  })

  it('does NOT call API when confirm is cancelled', async () => {
    window.confirm = vi.fn(() => false)

    await act(async () => {
      render(<MemoryRouter><MissionsPage /></MemoryRouter>)
    })

    const rapportCell = await screen.findByTitle('Cliquez pour téléverser le rapport')
    fireEvent.click(rapportCell)

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(expect.stringContaining('/api/missions/77/rapport'))
    })

    const deleteBtn = await screen.findByTitle('Supprimer')
    fireEvent.click(deleteBtn)

    expect(apiDeleteMock).not.toHaveBeenCalledWith(
      expect.stringContaining('supprimer-rapport'),
      expect.anything(),
    )
  })
})
