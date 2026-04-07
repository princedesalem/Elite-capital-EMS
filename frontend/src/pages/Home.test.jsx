import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home'

// hoisted so it's available inside vi.mock factory closures
const { mockUser } = vi.hoisted(() => ({
  mockUser: { matricule: '1001', role: 'EMPLOYE', prenom: 'Jean', nom: 'Test' },
}))

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
  }),
}))

const renderHome = async () => {
  let result
  await act(async () => {
    result = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Home />
      </MemoryRouter>
    )
    // flush all microtasks (mocked API calls) so component settles
    await Promise.resolve()
  })
  return result
}

describe('Home — Demander un congé modal', () => {
  it('shows the Demander un congé button', async () => {
    await renderHome()
    expect(screen.getByRole('button', { name: /demander un cong/i })).toBeInTheDocument()
  })

  it('opens the leave modal when clicking the button', async () => {
    await renderHome()
    fireEvent.click(screen.getByRole('button', { name: /demander un cong/i }))
    expect(screen.getByText('Nouvelle demande de congé')).toBeInTheDocument()
  })

  it('modal has Date de début, Date de fin, Durée and Motif fields', async () => {
    await renderHome()
    fireEvent.click(screen.getByRole('button', { name: /demander un cong/i }))
    expect(screen.getByText(/date de d.but/i)).toBeInTheDocument()
    expect(screen.getByText(/date de fin/i)).toBeInTheDocument()
    expect(screen.getByText(/dur.e \(jours\)/i)).toBeInTheDocument()
    expect(screen.getByText(/motif/i)).toBeInTheDocument()
  })

  it('modal has Annuler and Soumettre la demande buttons', async () => {
    await renderHome()
    fireEvent.click(screen.getByRole('button', { name: /demander un cong/i }))
    expect(screen.getAllByRole('button', { name: /annuler/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /soumettre la demande/i })).toBeInTheDocument()
  })

  it('Annuler button closes the modal', async () => {
    await renderHome()
    fireEvent.click(screen.getByRole('button', { name: /demander un cong/i }))
    expect(screen.getByText('Nouvelle demande de congé')).toBeInTheDocument()
    const annulerBtns = screen.getAllByRole('button', { name: /annuler/i })
    fireEvent.click(annulerBtns[annulerBtns.length - 1])
    expect(screen.queryByText('Nouvelle demande de congé')).not.toBeInTheDocument()
  })

  it('submits leave request and calls API correctly', async () => {
    const api = (await import('../services/api')).default
    api.post.mockResolvedValueOnce({ data: {} })

    await renderHome()
    fireEvent.click(screen.getByRole('button', { name: /demander un cong/i }))
    expect(screen.getByText('Nouvelle demande de congé')).toBeInTheDocument()

    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-04-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-04-05' } })

    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/api/conges/demande',
      null,
      expect.objectContaining({
        params: expect.objectContaining({
          matricule: '1001',
          date_debut: '2026-04-01',
          date_fin: '2026-04-05',
        }),
      })
    ))
  })

  it('shows error message when API fails', async () => {
    const api = (await import('../services/api')).default
    api.post.mockRejectedValueOnce({ response: { data: { detail: 'Solde insuffisant' } } })

    await renderHome()
    fireEvent.click(screen.getByRole('button', { name: /demander un cong/i }))
    expect(screen.getByText('Nouvelle demande de congé')).toBeInTheDocument()

    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-04-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-04-05' } })

    fireEvent.submit(document.querySelector('form'))

    await waitFor(() => expect(screen.getByText(/solde insuffisant/i)).toBeInTheDocument())
  })
})
