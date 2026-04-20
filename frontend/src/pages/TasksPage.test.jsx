import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TasksPage from './TasksPage'

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

const TASKS = [
  { id: 1, titre: 'Préparer le rapport', priorite: 'haute', statut: 'a_faire', description: '', date_echeance: '', assigne_a: null },
  { id: 2, titre: 'Réunion avec RH', priorite: 'moyenne', statut: 'en_cours', description: '', date_echeance: '', assigne_a: 1001 },
]

describe('TasksPage', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/tasks/')) return Promise.resolve({ data: TASKS })
      if (String(url).includes('/employees/')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    apiPostMock.mockResolvedValue({ data: {} })
    apiPutMock.mockResolvedValue({ data: {} })
    apiDeleteMock.mockResolvedValue({ data: {} })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('displays task titles after load', async () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>)
    expect(await screen.findByText('Préparer le rapport')).toBeInTheDocument()
    expect(await screen.findByText('Réunion avec RH')).toBeInTheDocument()
  })

  it('shows "Nouvelle tâche" button for admin', async () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>)
    expect(await screen.findByText(/nouvelle tâche/i)).toBeInTheDocument()
  })
})
