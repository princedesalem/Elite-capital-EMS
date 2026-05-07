import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { baseURL: 'http://localhost:8000' },
  },
}))

import api from '../services/api'
import AIInsightPanel from '../components/AIInsightPanel'

const SAMPLE = {
  synthese: 'Synthèse de test pour 2026.',
  kpis: [
    { label: 'Effectif', value: '20', alert: false },
    { label: 'Congés en attente', value: '13', alert: true },
  ],
  points_attention: ['Volume élevé de congés en attente'],
  recommandations: [
    { priorite: 'haute', action: 'Traiter les congés', cible: 'RH' },
    { priorite: 'moyenne', action: 'Plan d\'écoulement', cible: 'Managers' },
  ],
  narratif: '**1. Synthèse**\nTexte du rapport.',
  source: 'deterministic',
  generated_at: '2026-05-07T08:00:00',
  lang: 'fr',
}

describe('AIInsightPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.post.mockResolvedValue({ data: SAMPLE })
  })

  it('renders header collapsed by default and does not call API', () => {
    render(<AIInsightPanel page="dashboard" tab="personnel" filters={{ annee: 2026 }} />)
    expect(screen.getByTestId('ai-insight-header')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
    expect(screen.queryByTestId('ai-insight-content')).not.toBeInTheDocument()
  })

  it('loads insights on first expand and renders sections', async () => {
    render(<AIInsightPanel page="dashboard" tab="personnel" filters={{ annee: 2026 }} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('ai-insight-header'))
    })
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    expect(api.post).toHaveBeenCalledWith('/api/ai/insights', {
      page: 'dashboard',
      tab: 'personnel',
      filters: { annee: 2026 },
      lang: 'fr',
      depth: 'détaillé',
    })
    await waitFor(() => expect(screen.getByTestId('ai-insight-content')).toBeInTheDocument())
    expect(screen.getByText(/Synthèse de test/)).toBeInTheDocument()
    expect(screen.getAllByTestId('ai-insight-kpi')).toHaveLength(2)
    expect(screen.getAllByTestId('ai-insight-reco')).toHaveLength(2)
    expect(screen.getByTestId('ai-insight-alert')).toBeInTheDocument()
  })

  it('refetches when filters change while open', async () => {
    const { rerender } = render(
      <AIInsightPanel page="dashboard" tab="personnel" filters={{ annee: 2026 }} defaultOpen />
    )
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    rerender(<AIInsightPanel page="dashboard" tab="departements" filters={{ annee: 2026 }} defaultOpen />)
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2))
    expect(api.post.mock.calls[1][1].tab).toBe('departements')
  })

  it('shows priority labels (haute / moyenne)', async () => {
    render(<AIInsightPanel page="dashboard" defaultOpen />)
    await waitFor(() => expect(screen.getByText(/PRIORITÉ HAUTE/)).toBeInTheDocument())
    expect(screen.getByText(/PRIORITÉ MOYENNE/)).toBeInTheDocument()
  })

  it('regenerate button triggers a new API call', async () => {
    render(<AIInsightPanel page="dashboard" defaultOpen />)
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    await act(async () => {
      fireEvent.click(screen.getByTestId('ai-insight-regenerate'))
    })
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2))
  })

  it('renders error state on API failure', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { detail: 'Boom' } } })
    render(<AIInsightPanel page="dashboard" defaultOpen />)
    await waitFor(() => expect(screen.getByTestId('ai-insight-error')).toBeInTheDocument())
    expect(screen.getByText(/Boom/)).toBeInTheDocument()
  })

  it('toggles narratif visibility', async () => {
    render(<AIInsightPanel page="dashboard" defaultOpen />)
    await waitFor(() => expect(screen.getByTestId('ai-insight-toggle-narratif')).toBeInTheDocument())
    expect(screen.getByText(/Texte du rapport/)).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByTestId('ai-insight-toggle-narratif'))
    })
    expect(screen.queryByText(/Texte du rapport/)).not.toBeInTheDocument()
  })

  it('renders English labels when lang=en', async () => {
    render(<AIInsightPanel page="dashboard" lang="en" defaultOpen />)
    await waitFor(() => expect(screen.getByText('AI Insights & Recommendations')).toBeInTheDocument())
    expect(screen.getByText('Executive summary')).toBeInTheDocument()
    expect(screen.getByText(/HIGH PRIORITY/)).toBeInTheDocument()
  })

  it('falls back to legacy GET endpoint when no page prop', async () => {
    api.get.mockResolvedValueOnce({ data: { text: 'Texte legacy', generated_at: '2026-01-01' } })
    render(<AIInsightPanel endpoint="/api/ai/dashboard-insights/1001" defaultOpen />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/ai/dashboard-insights/1001'))
    expect(screen.getByText(/Texte legacy/)).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })
})
