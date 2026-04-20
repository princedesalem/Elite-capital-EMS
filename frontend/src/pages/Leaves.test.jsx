import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Leaves from './Leaves'

const apiGetMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

const LEAVES = [
  { id_conge: 1, matricule: 1001, type: 'Congé annuel', date_debut: '2026-07-01', date_fin: '2026-07-10', statut: 'APPROUVE' },
  { id_conge: 2, matricule: 2001, type: 'Maladie', date_debut: '2026-08-01', date_fin: '2026-08-03', statut: 'EN_ATTENTE' },
]

describe('Leaves', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockResolvedValue({ data: LEAVES })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><Leaves /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows page heading', () => {
    render(<MemoryRouter><Leaves /></MemoryRouter>)
    expect(screen.getByText(/congés/i)).toBeInTheDocument()
  })

  it('shows leave entries after load', async () => {
    render(<MemoryRouter><Leaves /></MemoryRouter>)
    expect(await screen.findByText('Congé annuel')).toBeInTheDocument()
    expect(await screen.findByText('Maladie')).toBeInTheDocument()
  })

  it('shows "Nouvelle demande" link', () => {
    render(<MemoryRouter><Leaves /></MemoryRouter>)
    expect(screen.getByText('Nouvelle demande')).toBeInTheDocument()
  })
})
