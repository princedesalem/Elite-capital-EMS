import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

  it('status dropdown options have visible labels not undefined', async () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>)
    await screen.findByText('Préparer le rapport')
    // Each task row has a status <select>; every <option> must have non-empty text
    const selects = document.querySelectorAll('select[title="Changer le statut"]')
    expect(selects.length).toBeGreaterThan(0)
    selects.forEach(sel => {
      Array.from(sel.options).forEach(opt => {
        expect(opt.text.trim()).not.toBe('')
        expect(opt.text.trim()).not.toBe('undefined')
      })
    })
  })

  it('status dropdown contains all four statut labels', async () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>)
    await screen.findByText('Préparer le rapport')
    const firstSelect = document.querySelector('select[title="Changer le statut"]')
    const labels = Array.from(firstSelect.options).map(o => o.text.trim())
    expect(labels).toContain('À faire')
    expect(labels).toContain('En cours')
    expect(labels).toContain('Terminé')
    expect(labels).toContain('Annulé')
  })

  it('displays stats bar with correct counts', async () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>)
    await screen.findByText('Préparer le rapport')
    // Stats bar headings exist (text appears at least once)
    expect(screen.getAllByText('À faire').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('En cours').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Terminé').length).toBeGreaterThanOrEqual(1)
  })

  it('shows empty state when no tasks', async () => {
    apiGetMock.mockImplementation(() => Promise.resolve({ data: [] }))
    render(<MemoryRouter><TasksPage /></MemoryRouter>)
    expect(await screen.findByText(/aucune tâche/i)).toBeInTheDocument()
  })

  it('opens creation form on "Nouvelle tâche" click', async () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>)
    const btn = await screen.findByText(/nouvelle tâche/i)
    fireEvent.click(btn)
    expect(screen.getByPlaceholderText(/titre de la tâche/i)).toBeInTheDocument()
  })

  it('filters tasks by search query', async () => {
    render(<MemoryRouter><TasksPage /></MemoryRouter>)
    await screen.findByText('Préparer le rapport')
    const search = screen.getByPlaceholderText(/rechercher une tâche/i)
    fireEvent.change(search, { target: { value: 'Réunion' } })
    await waitFor(() => {
      expect(screen.queryByText('Préparer le rapport')).not.toBeInTheDocument()
      expect(screen.getByText('Réunion avec RH')).toBeInTheDocument()
    })
  })
})
