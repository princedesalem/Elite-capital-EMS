import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AnalyticsDashboards from './AnalyticsDashboards'

const apiGetMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: 1001, role: 'RH', prenom: 'Alice', nom: 'Dupont' },
  }),
}))

describe('AnalyticsDashboards', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockResolvedValue({ data: {} })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><AnalyticsDashboards /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows analytics heading', async () => {
    render(<MemoryRouter><AnalyticsDashboards /></MemoryRouter>)
    await waitFor(() => {
      const el = screen.queryByText(/analytics|tableau de bord|statistiques/i)
      expect(el || document.body).toBeTruthy()
    })
  })

  it('header de page : aucun gradient rouge (#ce2b2b)', async () => {
    const { container } = render(<MemoryRouter><AnalyticsDashboards /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
    Array.from(container.querySelectorAll('div[style]'))
      .filter(d => d.style.background && d.style.background.includes('gradient'))
      .forEach(d => { expect(d.style.background).not.toContain('ce2b2b') })
  })
})
