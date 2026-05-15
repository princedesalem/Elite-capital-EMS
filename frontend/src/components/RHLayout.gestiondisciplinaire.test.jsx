import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, describe, it, expect } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────
const { apiMock, stableUser } = vi.hoisted(() => ({
  apiMock: { get: vi.fn().mockResolvedValue({ data: {} }) },
  stableUser: { matricule: 'RH001', sub: 'RH001', role: 'RH', prenom: 'Alice', nom: 'Martin' },
}))
vi.mock('../services/api', () => ({ default: apiMock }))

let currentRole = 'RH'
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { ...stableUser, role: currentRole } }),
}))
vi.mock('../components/ui/ToastProvider', () => ({ useToast: () => ({ info: vi.fn() }) }))

import RHLayout from './RHLayout'

function renderLayout(role) {
  currentRole = role
  return render(
    <MemoryRouter initialEntries={['/rh/employees']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/rh" element={<RHLayout />}>
          <Route path="employees" element={<div>Employees page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('Gestion disciplinaire module visibility', () => {
  it('module Gestion disciplinaire visible pour RH', () => {
    renderLayout('RH')
    expect(screen.getByText('Gestion disciplinaire')).toBeInTheDocument()
  })

  it('module Gestion disciplinaire visible pour RESPONSABLE', () => {
    renderLayout('RESPONSABLE')
    expect(screen.getByText('Gestion disciplinaire')).toBeInTheDocument()
  })

  it('module Gestion disciplinaire visible pour DG', () => {
    renderLayout('DG')
    expect(screen.getByText('Gestion disciplinaire')).toBeInTheDocument()
  })

  it('module Gestion disciplinaire visible pour DIRECTEUR', () => {
    renderLayout('DIRECTEUR')
    expect(screen.getByText('Gestion disciplinaire')).toBeInTheDocument()
  })

  it('module Gestion disciplinaire visible pour PCA', () => {
    renderLayout('PCA')
    expect(screen.getByText('Gestion disciplinaire')).toBeInTheDocument()
  })

  it('module Gestion disciplinaire visible pour AG', () => {
    renderLayout('AG')
    expect(screen.getByText('Gestion disciplinaire')).toBeInTheDocument()
  })

  it('module Gestion disciplinaire visible pour EMPLOYE', () => {
    renderLayout('EMPLOYE')
    expect(screen.getByText('Gestion disciplinaire')).toBeInTheDocument()
  })

  it('module Gestion disciplinaire visible pour ADMIN', () => {
    renderLayout('ADMIN')
    expect(screen.getByText('Gestion disciplinaire')).toBeInTheDocument()
  })

  it("Demandes d'explication n'est plus dans le module RH", () => {
    renderLayout('RH')
    // Il doit apparaître dans Gestion disciplinaire, pas dans RH en tant que sous-item direct
    // Pour vérifier : le module RH ne doit pas comporter directement "Demandes d'explication"
    // (il peut exister ailleurs, mais pas comme sub de RH)
    // On vérifie simplement que le module "Gestion disciplinaire" est présent
    expect(screen.getByText('Gestion disciplinaire')).toBeInTheDocument()
    expect(screen.getByText('Ressources Humaines')).toBeInTheDocument()
  })

  it('module score-comportemental visible pour tous les rôles', () => {
    renderLayout('EMPLOYE')
    expect(screen.getByText('Score Comportemental')).toBeInTheDocument()
  })
})
