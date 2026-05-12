import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ClubReview from './ClubReview'

const apiGetMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
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

const CLUBS = [
  { id: 1, nom: 'Club Tennis', type: 'Sports', description: 'Amateur de tennis' },
]

describe('ClubReview', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/api/clubs')) return Promise.resolve({ data: CLUBS })
      return Promise.resolve({ data: [] })
    })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><ClubReview /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows club name', async () => {
    render(<MemoryRouter><ClubReview /></MemoryRouter>)
    expect(await screen.findByText('Club Tennis')).toBeInTheDocument()
  })

  it('header de page : aucun gradient rouge (#ce2b2b)', async () => {
    const { container } = render(<MemoryRouter><ClubReview /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    Array.from(container.querySelectorAll('div[style]'))
      .filter(d => d.style.background && d.style.background.includes('gradient'))
      .forEach(d => { expect(d.style.background).not.toContain('ce2b2b') })
  })
})
