import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/employees') {
        return Promise.resolve({
          data: [
            {
              matricule: 1001, prenom: 'Jean', nom: 'Dupont', email: 'jean@test.com',
              statut: 'ACTIF', role: 'EMPLOYE', departement: 'RH', poste: 'Dev',
              genre: 'M', date_embauche: '2022-01-01',
            },
          ],
        })
      }
      return Promise.resolve({ data: [] })
    }),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
    defaults: { baseURL: 'http://localhost:8000' },
  },
}))

// Recharts stub
vi.mock('recharts', () => {
  const React = require('react')
  const Stub = ({ children }) => React.createElement('div', {}, children)
  return {
    ResponsiveContainer: Stub, LineChart: Stub, BarChart: Stub, PieChart: Stub,
    Line: Stub, Bar: Stub, Pie: Stub, Cell: Stub, XAxis: Stub, YAxis: Stub,
    CartesianGrid: Stub, Tooltip: Stub, Legend: Stub,
  }
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: '9001', role: 'RH', prenom: 'RH', nom: 'User' },
    logout: vi.fn(),
  }),
}))

import Employees from '../pages/Employees'

describe('Employee Soft Delete UI', () => {
  it('Supprimer button is not visible for non-ADMIN role (RH)', async () => {
    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.queryByText(/supprimer/i)).not.toBeInTheDocument()
    }, { timeout: 2000 })
  })
})
