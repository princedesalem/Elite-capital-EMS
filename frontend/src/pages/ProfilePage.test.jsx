import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProfilePage from './ProfilePage'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockUser = { matricule: 'EMP01', role: 'EMPLOYE' }
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

const mockProfile = {
  matricule: 'EMP01',
  nom: 'Dupont',
  prenom: 'Jean',
  email: 'jean.dupont@test.com',
  telephone: '+33612345678',
  role: 'EMPLOYE',
  fonction: 'Développeur',
  entite: 'ELITE CAPITAL',
  direction: 'DSI',
  departement: 'Développement',
  date_embauche: '2022-01-01',
  statut_employe: 'ACTIF',
  photo_url: null,
}

const renderPage = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ProfilePage />
    </MemoryRouter>
  )

describe('ProfilePage', () => {
  beforeEach(async () => {
    const api = (await import('../services/api')).default
    api.get.mockResolvedValue({ data: mockProfile })
  })

  it('renders profile info after loading', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Jean Dupont')).toBeInTheDocument()
    })
    expect(screen.getByText('EMP01')).toBeInTheDocument()
    expect(screen.getByText('jean.dupont@test.com')).toBeInTheDocument()
  })

  it('shows initials when no photo', async () => {
    renderPage()
    await waitFor(() => {
      // Initials: J (prenom) + D (nom)
      expect(screen.getByText('JD')).toBeInTheDocument()
    })
  })

  it('renders Changer le mot de passe link', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /mot de passe/i })).toBeInTheDocument()
    })
  })

  it('renders Configurer MFA link', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /mfa/i })).toBeInTheDocument()
    })
  })

  it('renders Ajouter une photo button when no photo', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ajouter une photo/i })).toBeInTheDocument()
    })
  })

  it('shows photo when photo_url is set', async () => {
    const api = (await import('../services/api')).default
    api.get.mockResolvedValueOnce({ data: { ...mockProfile, photo_url: '/uploads/EMP01.webp' } })
    renderPage()
    await waitFor(() => {
      const img = screen.getByAltText('Photo de profil')
      expect(img).toBeInTheDocument()
      expect(img.src).toContain('/uploads/EMP01.webp')
    })
  })

  it('shows delete button when photo_url is set', async () => {
    const api = (await import('../services/api')).default
    api.get.mockResolvedValueOnce({ data: { ...mockProfile, photo_url: '/uploads/EMP01.webp' } })
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /supprimer/i })).toBeInTheDocument()
    })
  })

  it('shows success message after photo upload', async () => {
    const api = (await import('../services/api')).default
    api.post.mockResolvedValueOnce({ data: { photo_url: '/uploads/EMP01.webp' } })

    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /ajouter une photo/i }))

    // Simulate file input change
    const input = document.querySelector('input[type="file"]')
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'test.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByText(/photo mise à jour/i)).toBeInTheDocument()
    })
  })

  it('shows error on upload failure', async () => {
    const api = (await import('../services/api')).default
    api.post.mockRejectedValueOnce(new Error('Network error'))

    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /ajouter une photo/i }))

    const input = document.querySelector('input[type="file"]')
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'test.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByText(/erreur lors de l'upload/i)).toBeInTheDocument()
    })
  })
})
