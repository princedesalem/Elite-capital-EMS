/**
 * Tests vitest pour AIAssistantPage — vérifie le renommage en "EMS Chat".
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { baseURL: 'http://localhost:8000' },
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: '9999', role: 'RH', nom: 'Admin', prenom: 'Super' },
    logout: vi.fn(),
  }),
}))

import AIAssistantPage from '../pages/AIAssistantPage'

describe('AIAssistantPage — EMS Chat rename', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom ne supporte pas scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('affiche le titre "EMS Chat"', () => {
    render(
      <MemoryRouter>
        <AIAssistantPage />
      </MemoryRouter>
    )
    expect(screen.getByText('EMS Chat')).toBeTruthy()
  })

  it('ne contient plus "Assistant IA RH"', () => {
    render(
      <MemoryRouter>
        <AIAssistantPage />
      </MemoryRouter>
    )
    expect(screen.queryByText('Assistant IA RH')).toBeNull()
  })

  it('contient le message de bienvenue EMS Chat', () => {
    render(
      <MemoryRouter>
        <AIAssistantPage />
      </MemoryRouter>
    )
    const matches = screen.getAllByText(/EMS Chat/)
    expect(matches.length).toBeGreaterThan(0)
  })
})
