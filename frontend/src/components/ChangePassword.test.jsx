import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ChangePassword from './ChangePassword'

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}))

const renderComponent = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ChangePassword />
    </MemoryRouter>
  )

describe('ChangePassword', () => {
  it('renders the form fields', () => {
    renderComponent()
    expect(screen.getByPlaceholderText('Matricule')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ancien mot de passe')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nouveau mot de passe')).toBeInTheDocument()
  })

  it('renders Enregistrer and Annuler buttons', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /annuler/i })).toBeInTheDocument()
  })

  it('shows success message after successful password change', async () => {
    const api = (await import('../services/api')).default
    api.post.mockResolvedValueOnce({ data: {} })
    renderComponent()

    fireEvent.change(screen.getByPlaceholderText('Matricule'), { target: { value: 'EMP01' } })
    fireEvent.change(screen.getByPlaceholderText('Ancien mot de passe'), { target: { value: 'OldPass1!' } })
    fireEvent.change(screen.getByPlaceholderText('Nouveau mot de passe'), { target: { value: 'NewPass1!' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(screen.getByText(/mot de passe chang/i)).toBeInTheDocument()
    })
  })

  it('shows error message on API failure', async () => {
    const api = (await import('../services/api')).default
    api.post.mockRejectedValueOnce({ response: { data: { detail: 'Mot de passe incorrect' } } })
    renderComponent()

    fireEvent.change(screen.getByPlaceholderText('Matricule'), { target: { value: 'EMP01' } })
    fireEvent.change(screen.getByPlaceholderText('Ancien mot de passe'), { target: { value: 'wrong' } })
    fireEvent.change(screen.getByPlaceholderText('Nouveau mot de passe'), { target: { value: 'NewPass1!' } })
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(screen.getByText(/mot de passe incorrect/i)).toBeInTheDocument()
    })
  })
})
