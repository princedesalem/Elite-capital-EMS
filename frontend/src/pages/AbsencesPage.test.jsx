import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AbsencesPage from './AbsencesPage'

// AbsencesPage is a tab wrapper around CongesPage, PermissionsPage, SortiesPage, RemplacantsPage
vi.mock('./CongesPage', () => ({ default: () => <div>CongesPage</div> }))
vi.mock('./PermissionsPage', () => ({ default: () => <div>PermissionsPage</div> }))
vi.mock('./SortiesPage', () => ({ default: () => <div>SortiesPage</div> }))
vi.mock('./RemplacantsPage', () => ({ default: () => <div>RemplacantsPage</div> }))

describe('AbsencesPage', () => {
  it('renders without crashing', () => {
    render(<MemoryRouter><AbsencesPage /></MemoryRouter>)
  })

  it('shows Absences heading', () => {
    render(<MemoryRouter><AbsencesPage /></MemoryRouter>)
    expect(screen.getByText('Gestion des Absences')).toBeInTheDocument()
  })

  it('defaults to Congés tab', () => {
    render(<MemoryRouter><AbsencesPage /></MemoryRouter>)
    expect(screen.getByText('CongesPage')).toBeInTheDocument()
  })

  it('switches to Permissions tab', () => {
    render(<MemoryRouter><AbsencesPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('Permissions'))
    expect(screen.getByText('PermissionsPage')).toBeInTheDocument()
  })

  it('switches to Sorties tab', () => {
    render(<MemoryRouter><AbsencesPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('Demandes de Sorties'))
    expect(screen.getByText('SortiesPage')).toBeInTheDocument()
  })

  it('switches to Remplaçants tab', () => {
    render(<MemoryRouter><AbsencesPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('Remplaçants'))
    expect(screen.getByText('RemplacantsPage')).toBeInTheDocument()
  })

  it('header de page : aucun gradient rouge (#ce2b2b)', () => {
    const { container } = render(<MemoryRouter><AbsencesPage /></MemoryRouter>)
    Array.from(container.querySelectorAll('div[style]'))
      .filter(d => d.style.background && d.style.background.includes('gradient'))
      .forEach(d => { expect(d.style.background).not.toContain('ce2b2b') })
  })
})
