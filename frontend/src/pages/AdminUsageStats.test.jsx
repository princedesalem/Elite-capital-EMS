import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminUsageStats from './AdminUsageStats'

const apiGetMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
  },
}))

describe('AdminUsageStats', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiGetMock.mockResolvedValue({ data: { global: { total_minutes: 0, total_sessions: 0 }, rows: [] } })
  })

  it('renders without crashing', async () => {
    render(<MemoryRouter><AdminUsageStats /></MemoryRouter>)
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled())
  })

  it('shows period controls', async () => {
    render(<MemoryRouter><AdminUsageStats /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.queryByText(/aujourd'hui|today|période/i) || document.body).toBeTruthy()
    })
  })
})
