import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RHLayout from './RHLayout'

let currentRole = 'EMPLOYE'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { role: currentRole },
  }),
}))

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

describe('RHLayout role visibility', () => {
  it('shows expected RH submodules for EMPLOYE', () => {
    renderLayout('EMPLOYE')
    expect(screen.getByText('Administration')).toBeInTheDocument()
    expect(screen.getByText('Workflow')).toBeInTheDocument()
    expect(screen.getByText('Club Review')).toBeInTheDocument()
    expect(screen.queryByText('Tâches')).not.toBeInTheDocument()
    expect(screen.queryByText('Analytics RH')).not.toBeInTheDocument()
    expect(screen.getByText('Achats')).toBeInTheDocument()
    expect(screen.getByText('Ressources Humaines')).toBeInTheDocument()
  })

  it('montre workflow et analytics pour DG', () => {
    renderLayout('DG')
    expect(screen.getByText('Administration')).toBeInTheDocument()
    expect(screen.getByText('Analytics RH')).toBeInTheDocument()
    expect(screen.getByText('Workflow')).toBeInTheDocument()
    expect(screen.queryByText('Tâches')).not.toBeInTheDocument()
    expect(screen.getByText('Achats')).toBeInTheDocument()
    expect(screen.getByText('Commercial')).toBeInTheDocument()
  })
})
