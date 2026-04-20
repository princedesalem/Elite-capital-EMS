import React from 'react'
import { render, screen } from '@testing-library/react'
import AvatarCircle from './AvatarCircle'

describe('AvatarCircle', () => {
  it('renders initials when no photoUrl', () => {
    render(<AvatarCircle letter="A" />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('uppercases the letter', () => {
    render(<AvatarCircle letter="m" />)
    expect(screen.getByText('M')).toBeInTheDocument()
  })

  it('shows ? when no letter given', () => {
    render(<AvatarCircle />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('renders img when photoUrl is provided', () => {
    render(<AvatarCircle photoUrl="http://example.com/photo.jpg" letter="A" />)
    const img = document.querySelector('img')
    expect(img).toBeInTheDocument()
    expect(img.src).toContain('example.com')
  })

  it('falls back to initials on image error', async () => {
    render(<AvatarCircle photoUrl="http://bad-url/broken.jpg" letter="Z" />)
    const img = document.querySelector('img')
    // trigger error
    img.dispatchEvent(new Event('error'))
    expect(await screen.findByText('Z')).toBeInTheDocument()
  })

  it('applies custom size', () => {
    render(<AvatarCircle letter="B" size={60} />)
    const container = screen.getByText('B').closest('div')
    expect(container?.style?.width).toBe('60px')
  })
})
