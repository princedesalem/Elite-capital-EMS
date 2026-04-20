import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// Mock api
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    defaults: { baseURL: 'http://localhost:8000' },
  },
}))

// Mock AuthContext with a user who has a matricule
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: '1001', role: 'EMPLOYE', prenom: 'Test', nom: 'User' },
    logout: vi.fn(),
  }),
}))

// Mock recharts to avoid SVG rendering issues
vi.mock('recharts', () => {
  const React = require('react')
  const Stub = ({ children }) => React.createElement('div', {}, children)
  return {
    ResponsiveContainer: Stub, LineChart: Stub, BarChart: Stub, PieChart: Stub,
    Line: Stub, Bar: Stub, Pie: Stub, Cell: Stub, XAxis: Stub, YAxis: Stub,
    CartesianGrid: Stub, Tooltip: Stub, Legend: Stub,
  }
})

import Dashboard from '../pages/Dashboard'

beforeEach(() => {
  localStorage.clear()
})

describe('Dashboard Widget Config', () => {
  it('renders the Widgets button', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )
    expect(screen.getByText(/widgets/i)).toBeInTheDocument()
  })

  it('opens the widget config panel when Widgets button is clicked', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )
    const btn = screen.getByText(/widgets/i)
    fireEvent.click(btn)
    expect(screen.getByText(/afficher \/ masquer/i)).toBeInTheDocument()
  })

  it('shows all 6 widget checkboxes in the config panel', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/widgets/i))
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThanOrEqual(6)
  })

  it('persists widget toggle to localStorage', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/widgets/i))
    // Toggle the first checkbox
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    // Some widget key should be saved in localStorage
    const keys = Object.keys(localStorage)
    const widgetKey = keys.find(k => k.startsWith('ems_widgets_'))
    expect(widgetKey).toBeDefined()
  })
})
