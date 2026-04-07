import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MFASetup from './MFASetup'

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}))

const renderComponent = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <MFASetup />
    </MemoryRouter>
  )

describe('MFASetup', () => {
  it('renders matricule input and Generate button', () => {
    renderComponent()
    expect(screen.getByPlaceholderText(/matricule/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /g.n.rer secret/i })).toBeInTheDocument()
  })

  it('renders an Annuler button', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /annuler/i })).toBeInTheDocument()
  })

  it('displays MFA secret after successful setup', async () => {
    const api = (await import('../services/api')).default
    api.post.mockResolvedValueOnce({
      data: { secret: 'JBSWY3DPEHPK3PXP', otpauth: 'otpauth://totp/EMS:EMP01?secret=JBSWY3DPEHPK3PXP' },
    })
    renderComponent()

    fireEvent.change(screen.getByPlaceholderText(/matricule/i), { target: { value: 'EMP01' } })
    fireEvent.click(screen.getByRole('button', { name: /g.n.rer secret/i }))

    await waitFor(() => {
      expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()
    })
  })

  it('does not show secret section before form submission', () => {
    renderComponent()
    expect(screen.queryByText(/secret:/i)).not.toBeInTheDocument()
  })
})
