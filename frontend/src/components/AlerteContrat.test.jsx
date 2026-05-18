import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import AlerteContrat from './AlerteContrat'

// ── mocks ────────────────────────────────────────────────────────────────────

vi.mock('../services/api', () => ({
  default: {
    get:  vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('./ui/bridge', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

vi.mock('./SignatureCanvas', () => ({
  default: ({ onSave }) => (
    <button data-testid="mock-canvas" onClick={() => onSave('data:image/png;base64,abc')}>
      Canvas
    </button>
  ),
}))

// Web Audio API stub — no longer used but kept for env safety
globalThis.AudioContext = undefined

import api from '../services/api'
import { toast } from './ui/bridge'

// ── helpers ───────────────────────────────────────────────────────────────────

const ALERTE_J2 = {
  id: 1, employe_id: 9038, nom: 'Jean BOBO', fonction: 'Analyste',
  type_contrat: 'CDD', type_alerte: 'J2', date_fin_contrat: '2026-05-20',
  statut: 'ACTIVE',
}

const ALERTE_J7 = {
  id: 2, employe_id: 9039, nom: 'Marie DUPONT', fonction: 'RH',
  type_contrat: 'CDD', type_alerte: 'J7', date_fin_contrat: '2026-05-25',
  statut: 'ACTIVE',
}

function setup(alertes = []) {
  // api.get : /api/contrats/alertes → alertes ; /employees/xxx → profil sans signature
  api.get.mockImplementation((url) => {
    if (url === '/api/contrats/alertes') return Promise.resolve({ data: alertes })
    if (url.startsWith('/employees/'))  return Promise.resolve({ data: { signature_url: null } })
    return Promise.resolve({ data: [] })
  })
  return render(<AlerteContrat userMatricule="1001" />)
}

// Clique sur le bouton d'en-tête pour dérouler la liste
function expandList() {
  fireEvent.click(screen.getByRole('button', { name: /contrat imminente/i }))
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AlerteContrat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche rien quand aucune alerte', async () => {
    api.get.mockResolvedValue({ data: [] })
    const { container } = render(<AlerteContrat userMatricule="1001" />)
    await act(async () => {})
    expect(container.firstChild).toBeNull()
  })

  it('affiche un résumé J-2 (en-tête accordéon)', async () => {
    setup([ALERTE_J2])
    await act(async () => {})
    expect(screen.getByText(/1 fin de contrat imminente/i)).toBeInTheDocument()
    expect(screen.getByText(/urgente/i)).toBeInTheDocument()
  })

  it('affiche le nom de l\'employé après déroulage', async () => {
    setup([ALERTE_J2])
    await act(async () => {})
    expandList()
    expect(screen.getByText('Jean BOBO')).toBeInTheDocument()
    expect(screen.getByText('2026-05-20')).toBeInTheDocument()
  })

  it('affiche une bannière J-7 après déroulage', async () => {
    setup([ALERTE_J7])
    await act(async () => {})
    expandList()
    expect(screen.getByText('Marie DUPONT')).toBeInTheDocument()
  })

  it('n\'affiche pas de bouton fermer (×)', async () => {
    setup([ALERTE_J2])
    await act(async () => {})
    expect(screen.queryByText('×')).not.toBeInTheDocument()
  })

  it('ouvre le modal au clic sur Traiter', async () => {
    setup([ALERTE_J2])
    await act(async () => {})
    expandList()
    fireEvent.click(screen.getByRole('button', { name: 'Traiter' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Traitement du contrat')).toBeInTheDocument()
  })

  it('affiche les 3 options d\'action dans le modal', async () => {
    setup([ALERTE_J2])
    await act(async () => {})
    expandList()
    fireEvent.click(screen.getByRole('button', { name: 'Traiter' }))
    expect(screen.getByText('Renouveler le contrat')).toBeInTheDocument()
    expect(screen.getByText('Mettre fin au contrat')).toBeInTheDocument()
    expect(screen.getByText('Confirmer en CDI')).toBeInTheDocument()
  })

  it('affiche le champ date si renouvellement sélectionné', async () => {
    setup([ALERTE_J2])
    await act(async () => {})
    expandList()
    fireEvent.click(screen.getByRole('button', { name: 'Traiter' }))
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[0]) // renouvellement
    expect(await screen.findByText(/nouvelle date de fin de contrat/i)).toBeInTheDocument()
  })

  it('appelle POST /api/contrats/action lors de la confirmation', async () => {
    api.post.mockResolvedValue({ data: {} })
    api.get.mockImplementation((url) => {
      if (url === '/api/contrats/alertes')
        return Promise.resolve({ data: [ALERTE_J2] })
      if (url.startsWith('/employees/'))
        return Promise.resolve({ data: { signature_url: null } })
      return Promise.resolve({ data: [] })
    })
    render(<AlerteContrat userMatricule="1001" />)
    await act(async () => {})

    expandList()
    fireEvent.click(screen.getByRole('button', { name: 'Traiter' }))
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[1]) // arret

    // after submit, fetch returns empty
    api.get.mockResolvedValue({ data: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/contrats/action/9038',
        expect.objectContaining({ action: 'arret', fait_par: '1001' }),
      )
    })
    expect(toast.success).toHaveBeenCalledWith('Action enregistrée avec succès')
  })

  it('ferme le modal si Annuler est cliqué', async () => {
    setup([ALERTE_J2])
    await act(async () => {})
    expandList()
    fireEvent.click(screen.getByRole('button', { name: 'Traiter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('affiche le résumé correct avec J2 et J7 simultanées', async () => {
    setup([ALERTE_J2, ALERTE_J7])
    await act(async () => {})
    expect(screen.getByText(/2 fins de contrat imminentes/i)).toBeInTheDocument()
    expandList()
    expect(screen.getByText('Jean BOBO')).toBeInTheDocument()
    expect(screen.getByText('Marie DUPONT')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Traiter' })).toHaveLength(2)
  })

  it('affiche une erreur si l\'action échoue', async () => {
    api.post.mockRejectedValue(new Error('Server error'))
    setup([ALERTE_J2])
    await act(async () => {})
    expandList()
    fireEvent.click(screen.getByRole('button', { name: 'Traiter' }))
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[1]) // arret
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Erreur lors de l'enregistrement de l'action")
    })
  })
})
