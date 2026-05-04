import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

const loginMock = vi.fn()
const silentLogoutMock = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login: loginMock, silentLogout: silentLogoutMock }),
}))

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

describe('Login', () => {
  beforeEach(() => {
    loginMock.mockReset()
    silentLogoutMock.mockReset()
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

  it('affiche le logo ECG SA', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    const logo = screen.getByAltText('ELITE CAPITAL Group S.A')
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', '/logo-ecg.png')
  })

  it('affiche le titre ELITE CAPITAL ENTERPRISE MANAGEMENT SYSTEM', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    expect(screen.getByTestId('login-title')).toBeInTheDocument()
    expect(screen.getByTestId('login-title').textContent).toMatch(/ELITE CAPITAL/)
  })

  it("affiche le slogan avec point d'exclamation", () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    const slogan = screen.getByTestId('login-slogan')
    expect(slogan.textContent).toMatch(/Le march.*des capitaux.*!/)
  })

  it('bascule vers le formulaire email', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    fireEvent.click(screen.getByText(/Mot de passe oublié/))
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
  })

  it('revient au formulaire matricule depuis email', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    fireEvent.click(screen.getByText(/Mot de passe oublié/))
    fireEvent.click(screen.getByText(/Retour à la connexion/))
    expect(screen.getByPlaceholderText('Matricule')).toBeInTheDocument()
  })

  it('appelle silentLogout au montage', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    expect(silentLogoutMock).toHaveBeenCalled()
  })

  it('titre complet contient Bienvenue sur et SYSTEM', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    const title = screen.getByTestId('login-title')
    expect(title.textContent).toMatch(/Bienvenue sur/)
    expect(title.textContent).toMatch(/MANAGEMENT/)
    expect(title.textContent).toMatch(/SYSTEM/)
    expect(title.textContent).toMatch(/EMS/)
  })

  it('slogan contient le texte correct avec point exclamation et guillemets', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    const slogan = screen.getByTestId('login-slogan')
    expect(slogan.textContent).toMatch(/march.*des capitaux/)
    expect(slogan.textContent).toContain('!')
    expect(slogan.textContent).toMatch(/\u00ab/)
    expect(slogan.textContent).toMatch(/\u00bb/)
  })

  it('la page de login est rendue', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  it('affiche Votre ERP de gestion', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    expect(screen.getByText(/Votre ERP de gestion/i)).toBeInTheDocument()
  })

  it('champ MFA present', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    expect(screen.getByPlaceholderText('Code MFA (si requis)')).toBeInTheDocument()
  })

  it('bouton mot de passe oublie sans espace insecable avant ?', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    const btn = screen.getByText(/Mot de passe oubli/i)
    // le texte ne doit pas contenir U+00A0 avant ?
    expect(btn.textContent).not.toMatch(/\u00a0\?/)
    expect(btn.textContent).toContain('?')
  })

  it('slogan sans espace insecable avant !', () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    const slogan = screen.getByTestId('login-slogan')
    expect(slogan.textContent).not.toMatch(/\u00a0!/)
    expect(slogan.textContent).toContain('!')
  })
})

