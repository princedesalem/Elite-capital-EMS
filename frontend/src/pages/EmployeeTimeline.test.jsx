import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EmployeeTimeline from './EmployeeTimeline'

const apiGetMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
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

const EMPLOYEE = {
  matricule: 1001, prenom: 'Alice', nom: 'Dupont', statut: 'ACTIF',
  fonction: 'Analyste', date_embauche: '2022-01-15',
}

describe('EmployeeTimeline', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/employees/1001')) return Promise.resolve({ data: EMPLOYEE })
      return Promise.resolve({ data: [] })
    })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter initialEntries={['/?matricule=1001']}><EmployeeTimeline /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows timeline heading', async () => {
    render(<MemoryRouter initialEntries={['/?matricule=1001']}><EmployeeTimeline /></MemoryRouter>)
    // Heading text may be split across icon+text nodes; check document contains the keyword
    await waitFor(() => {
      const matches = screen.queryAllByText(/timeline|historique|parcours/i)
      expect(matches.length + (document.body.textContent.match(/parcours|timeline|historique/i) ? 1 : 0)).toBeGreaterThan(0)
    })
  })
})
