import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EmailLoginCallback from './EmailLoginCallback'

const apiGetMock = vi.fn()
const loginWithTokenMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    loginWithToken: loginWithTokenMock,
  }),
}))

describe('EmailLoginCallback', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    loginWithTokenMock.mockReset()
  })

  it('shows error when no token in URL', async () => {
    render(
      <MemoryRouter initialEntries={['/login/email/callback']}>
        <EmailLoginCallback />
      </MemoryRouter>
    )
    expect(await screen.findByText(/token manquant/i)).toBeInTheDocument()
  })

  it('shows loading state when token present', async () => {
    apiGetMock.mockResolvedValue({ data: { access_token: 'abc' } })
    render(
      <MemoryRouter initialEntries={['/login/email/callback?token=validtoken']}>
        <EmailLoginCallback />
      </MemoryRouter>
    )
    expect(screen.getByText(/connexion en cours/i)).toBeInTheDocument()
  })

  it('shows error message on API failure', async () => {
    apiGetMock.mockRejectedValue({ response: { data: { detail: 'Token expiré' } } })
    render(
      <MemoryRouter initialEntries={['/login/email/callback?token=badtoken']}>
        <EmailLoginCallback />
      </MemoryRouter>
    )
    expect(await screen.findByText(/token expiré/i)).toBeInTheDocument()
  })
})
