import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Navbar from './Navbar'

const apiGetMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: 1001, role: 'EMPLOYE' },
    logout: vi.fn(),
  }),
}))

describe('Navbar', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/employees/1001')) return Promise.resolve({ data: { photo_url: null } })
      if (String(url).includes('/api/notifications/compteur/1001')) return Promise.resolve({ data: { non_lues: 3 } })
      return Promise.resolve({ data: {} })
    })
  })

  it('affiche une cloche de notifications avec badge et lien vers le centre', async () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )

    const link = await screen.findByRole('link', { name: 'Notifications' })
    expect(link).toHaveAttribute('href', '/rh/notifications')

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })
})
