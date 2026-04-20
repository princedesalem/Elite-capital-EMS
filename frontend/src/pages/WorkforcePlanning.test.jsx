import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import WorkforcePlanning from './WorkforcePlanning'

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

const POSITIONS = [
  { id: 1, titre: 'Chef de projet', trimestre: 'T2', annee: '2026', priorite: 'haute', statut: 'planifie', budget: 60000, direction: 'DSI' },
]

describe('WorkforcePlanning', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/workforce/positions')) return Promise.resolve({ data: POSITIONS })
      return Promise.resolve({ data: [] })
    })
    apiPostMock.mockResolvedValue({ data: {} })
    apiPutMock.mockResolvedValue({ data: {} })
    apiDeleteMock.mockResolvedValue({ data: {} })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><WorkforcePlanning /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('displays page heading', async () => {
    render(<MemoryRouter><WorkforcePlanning /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    // Heading 'Workforce Planning' may be split by icon element
    expect(document.body.textContent).toMatch(/Workforce Planning|Planification/)
  })

  it('shows position title', async () => {
    render(<MemoryRouter><WorkforcePlanning /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    // Click the 'Postes planifiés' tab button to see position items
    const tabButtons = screen.getAllByText('Postes planifiés')
    // Tab buttons are <button> elements; find the one inside the tab bar
    const tabBtn = tabButtons.find(el => el.tagName === 'BUTTON')
    fireEvent.click(tabBtn)
    expect(await screen.findByText('Chef de projet')).toBeInTheDocument()
  })
})
