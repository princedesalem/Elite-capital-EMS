import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

const loginMock = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login: loginMock }),
}))

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

describe('Login', () => {
  beforeEach(() => {
    loginMock.mockReset()
  })

  it('renders login form', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    expect(screen.getByPlaceholderText('Matricule')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Mot de passe')).toBeInTheDocument()
  })

  it('shows password policy error for weak password', async () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText('Matricule'), { target: { value: '1001' } })
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'weak' } })
    fireEvent.click(screen.getByText('Se connecter'))
    expect(await screen.findByText(/14 caractères|majuscule|minuscule|chiffre|spécial/i)).toBeInTheDocument()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('calls login on valid credentials', async () => {
    loginMock.mockResolvedValueOnce({})
    render(<MemoryRouter><Login /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText('Matricule'), { target: { value: '1001' } })
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'ValidPass1234!X' } })
    fireEvent.click(screen.getByText('Se connecter'))
    await waitFor(() => expect(loginMock).toHaveBeenCalledWith({ matricule: '1001', password: 'ValidPass1234!X', mfaCode: '' }))
  })

  it('shows error on login failure', async () => {
    loginMock.mockRejectedValueOnce({ response: { data: { detail: 'Identifiants invalides' } } })
    render(<MemoryRouter><Login /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText('Matricule'), { target: { value: '1001' } })
    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'ValidPass1234!X' } })
    fireEvent.click(screen.getByText('Se connecter'))
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/Identifiants invalides/)
    })
  })
})
