import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EventsPage from './EventsPage'

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
    user: { matricule: 1001, role: 'RH', prenom: 'Alice', nom: 'Dupont' },
  }),
}))

const EVENTS = [
  { id: 1, titre: 'Séminaire annuel', type: 'Séminaire', statut: 'approuve', date_debut: '2026-09-01', organisateur: 'RH', capacite: 50 },
  { id: 2, titre: 'Team Building', type: 'Team Building', statut: 'brouillon', date_debut: '2026-10-01', organisateur: 'DG', capacite: 20 },
]

describe('EventsPage', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockResolvedValue({ data: EVENTS })
    apiPostMock.mockResolvedValue({ data: {} })
    apiPutMock.mockResolvedValue({ data: {} })
    apiDeleteMock.mockResolvedValue({ data: {} })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><EventsPage /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('displays event titles after load', async () => {
    render(<MemoryRouter><EventsPage /></MemoryRouter>)
    expect(await screen.findByText('Séminaire annuel')).toBeInTheDocument()
    const teamBuilding = await screen.findAllByText('Team Building')
    expect(teamBuilding.length).toBeGreaterThan(0)
  })

  it('shows create button for event manager', async () => {
    render(<MemoryRouter><EventsPage /></MemoryRouter>)
    expect(await screen.findByText(/créer un événement/i)).toBeInTheDocument()
  })
})
