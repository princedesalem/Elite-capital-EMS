import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../contexts/AuthContext'

describe('ProtectedRoute', () => {
  it('redirects to /login when no user', () => {
    useAuth.mockReturnValue({ user: null })
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute><div>Protected content</div></ProtectedRoute>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renders children when user is authenticated', () => {
    useAuth.mockReturnValue({ user: { role: 'EMPLOYE' } })
    render(
      <MemoryRouter>
        <ProtectedRoute><div>Protected content</div></ProtectedRoute>
      </MemoryRouter>
    )
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('shows access denied when role not in allowedRoles', () => {
    useAuth.mockReturnValue({ user: { role: 'EMPLOYE' } })
    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['RH', 'ADMIN']}><div>Admin page</div></ProtectedRoute>
      </MemoryRouter>
    )
    expect(screen.getByText('Accès refusé')).toBeInTheDocument()
    expect(screen.queryByText('Admin page')).not.toBeInTheDocument()
  })

  it('renders children when user has allowed role', () => {
    useAuth.mockReturnValue({ user: { role: 'RH' } })
    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={['RH', 'ADMIN']}><div>RH Dashboard</div></ProtectedRoute>
      </MemoryRouter>
    )
    expect(screen.getByText('RH Dashboard')).toBeInTheDocument()
  })

  it('renders children when allowedRoles is empty (no restriction)', () => {
    useAuth.mockReturnValue({ user: { role: 'EMPLOYE' } })
    render(
      <MemoryRouter>
        <ProtectedRoute allowedRoles={[]}><div>Open page</div></ProtectedRoute>
      </MemoryRouter>
    )
    expect(screen.getByText('Open page')).toBeInTheDocument()
  })

  // ── Tests fix : loading state — ne pas rediriger pendant la vérification auth ──

  it('ne redirige pas vers /login quand loading=true (même si user est null)', () => {
    useAuth.mockReturnValue({ user: null, loading: true })
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute><div>Protected content</div></ProtectedRoute>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    )
    // Pendant le chargement : ni le contenu protégé ni la page login ne doit s'afficher
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('redirige vers /login quand loading=false et user=null', () => {
    useAuth.mockReturnValue({ user: null, loading: false })
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute><div>Protected content</div></ProtectedRoute>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('affiche le contenu quand loading=false et user renseigné', () => {
    useAuth.mockReturnValue({ user: { role: 'EMPLOYE' }, loading: false })
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute><div>Protected content</div></ProtectedRoute>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Protected content')).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })
})
