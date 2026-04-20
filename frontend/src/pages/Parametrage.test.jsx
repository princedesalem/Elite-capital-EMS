import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Parametrage from './Parametrage'

describe('Parametrage', () => {
  it('renders without crashing', () => {
    render(<MemoryRouter><Parametrage /></MemoryRouter>)
  })

  it('shows section menu items', () => {
    render(<MemoryRouter><Parametrage /></MemoryRouter>)
    const generals = screen.getAllByText('Général')
    expect(generals.length).toBeGreaterThan(0)
    expect(screen.getAllByText('Apparence').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Notifications').length).toBeGreaterThan(0)
  })

  it('switches section on click', () => {
    render(<MemoryRouter><Parametrage /></MemoryRouter>)
    fireEvent.click(screen.getByText('Apparence'))
    expect(screen.getByText('Affichage')).toBeInTheDocument()
  })
})
