import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RHLayout from './RHLayout'

let currentRole = 'RH'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: currentRole } }),
}))

function renderLayout(role) {
  currentRole = role
  return render(
    <MemoryRouter
      initialEntries={['/rh/employees']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/rh" element={<RHLayout />}>
          <Route path="employees" element={<div>Employees</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('RHLayout — entrée Fiche de poste', () => {
  it('affiche "Fiches de poste" dans le menu RH pour un RH', () => {
    renderLayout('RH')
    expect(screen.getByText('Fiches de poste')).toBeInTheDocument()
  })

  it('affiche "Fiches de poste" pour un EMPLOYE', () => {
    renderLayout('EMPLOYE')
    expect(screen.getByText('Fiches de poste')).toBeInTheDocument()
  })
})
