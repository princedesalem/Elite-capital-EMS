import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MissionDetailModal from './MissionDetailModal'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}))

import api from '../services/api'

const mockMission = {
  id_mission: 10,
  motif: 'Réunion partenaires',
  email_mission: 'mission@elite.ga',
  statut: 'En cours',
  rapport_televerse: false,
  segments: [
    { id: 1, lieu_depart: 'Libreville', lieu_arrivee: 'Paris', date_depart: '2024-02-01' },
  ],
  missionnaires: [
    { matricule: 'EMP001', nom: 'Doe', prenom: 'John' },
  ],
}

describe('MissionDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <MissionDetailModal isOpen={false} missionId={10} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows loading state while fetching', async () => {
    api.get.mockResolvedValue({ data: mockMission })
    render(<MissionDetailModal isOpen={true} missionId={10} onClose={vi.fn()} />)
    expect(screen.getByText('Chargement...')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Chargement...')).not.toBeInTheDocument())
  })

  it('displays mission details after loading', async () => {
    api.get.mockResolvedValue({ data: mockMission })
    render(<MissionDetailModal isOpen={true} missionId={10} onClose={vi.fn()} />)
    await screen.findByText('Réunion partenaires')
    expect(screen.getByText('mission@elite.ga')).toBeInTheDocument()
    expect(screen.getByText('En cours')).toBeInTheDocument()
  })

  it('renders the mission title with id', async () => {
    api.get.mockResolvedValue({ data: mockMission })
    render(<MissionDetailModal isOpen={true} missionId={10} onClose={vi.fn()} />)
    expect(screen.getByText('Détails de la Mission #10')).toBeInTheDocument()
  })

  it('shows error message when API fails', async () => {
    api.get.mockRejectedValue({ response: { data: { detail: 'Mission introuvable' } } })
    render(<MissionDetailModal isOpen={true} missionId={99} onClose={vi.fn()} />)
    await screen.findByText('Mission introuvable')
  })

  it('calls onClose when the close button is clicked', async () => {
    api.get.mockResolvedValue({ data: mockMission })
    const onClose = vi.fn()
    render(<MissionDetailModal isOpen={true} missionId={10} onClose={onClose} />)
    await screen.findByText('Réunion partenaires')
    fireEvent.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalled()
  })

  it('fetches correct API endpoint', async () => {
    api.get.mockResolvedValue({ data: mockMission })
    render(<MissionDetailModal isOpen={true} missionId={10} onClose={vi.fn()} />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/missions/10'))
  })

  it('does not fetch when missionId is null', () => {
    render(<MissionDetailModal isOpen={true} missionId={null} onClose={vi.fn()} />)
    expect(api.get).not.toHaveBeenCalled()
  })
})
