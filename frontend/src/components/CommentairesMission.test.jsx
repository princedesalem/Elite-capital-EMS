import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CommentairesMission from './CommentairesMission'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import api from '../services/api'

const mockCommentaires = [
  {
    id_commentaire: 1,
    mission_id: 10,
    matricule: 'EMP001',
    commentaire: 'Premier commentaire de test',
    created_at: '2024-01-15T10:00:00Z',
    lu_par: ['EMP001'],
  },
  {
    id_commentaire: 2,
    mission_id: 10,
    matricule: 'EMP002',
    commentaire: 'Deuxième commentaire',
    created_at: '2024-01-15T11:00:00Z',
    lu_par: [],
  },
]

describe('CommentairesMission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: {} })
  })

  it('renders the Commentaires de mission heading', async () => {
    render(<CommentairesMission idMission={10} matricule="EMP001" />)
    expect(screen.getByText('Commentaires de mission')).toBeInTheDocument()
  })

  it('loads and displays commentaires on mount', async () => {
    api.get.mockResolvedValue({ data: mockCommentaires })
    render(<CommentairesMission idMission={10} matricule="EMP001" />)
    await screen.findByText('Premier commentaire de test')
    expect(screen.getByText('Deuxième commentaire')).toBeInTheDocument()
  })

  it('marks unread commentaires as read', async () => {
    api.get.mockResolvedValue({ data: mockCommentaires })
    render(<CommentairesMission idMission={10} matricule="EMP001" />)
    await screen.findByText('Deuxième commentaire')
    // EMP002's comment has empty lu_par, so mark-read should be called for it
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/missions/commentaires/2/marquer-lu',
        null,
        { params: { matricule: 'EMP001' } }
      )
    })
  })

  it('adds a new commentaire on form submit', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: {} })
    render(<CommentairesMission idMission={10} matricule="EMP001" />)

    const textarea = screen.getByPlaceholderText(/commentaire/i)
    fireEvent.change(textarea, { target: { value: 'Nouveau commentaire' } })
    fireEvent.submit(textarea.closest('form'))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/missions/commentaires/creer',
        { id_mission: 10, matricule: 'EMP001', commentaire: 'Nouveau commentaire' }
      )
    })
  })

  it('shows success message after adding commentaire', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: {} })
    render(<CommentairesMission idMission={10} matricule="EMP001" />)

    const textarea = screen.getByPlaceholderText(/commentaire/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.submit(textarea.closest('form'))

    await screen.findByText(/commentaire ajouté/i)
  })

  it('shows error message on submit failure', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockRejectedValue({ response: { data: { detail: 'Mission introuvable' } } })
    render(<CommentairesMission idMission={10} matricule="EMP001" />)

    const textarea = screen.getByPlaceholderText(/commentaire/i)
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.submit(textarea.closest('form'))

    await screen.findByText('Mission introuvable')
  })

  it('does not fetch when idMission is falsy', () => {
    render(<CommentairesMission idMission={null} matricule="EMP001" />)
    expect(api.get).not.toHaveBeenCalled()
  })
})
