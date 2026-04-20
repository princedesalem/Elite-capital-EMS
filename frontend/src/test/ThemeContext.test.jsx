import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ThemeProvider, useTheme } from '../contexts/ThemeContext'

// Helper component that reads the current theme
function ThemeDisplay() {
  const { theme } = useTheme()
  return <div data-testid="theme">{theme}</div>
}

// Helper component that toggles theme
function ThemeToggler() {
  const { theme, setTheme } = useTheme()
  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <button onClick={() => setTheme(theme === 'clair' ? 'sombre' : 'clair')}>Toggle</button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeContext', () => {
  it('renders with default theme "clair"', () => {
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>
    )
    expect(screen.getByTestId('theme').textContent).toBe('clair')
  })

  it('reads initial theme from localStorage', () => {
    localStorage.setItem('ems_theme', 'sombre')
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>
    )
    expect(screen.getByTestId('theme').textContent).toBe('sombre')
  })

  it('sets data-theme attribute on documentElement when theme changes', () => {
    localStorage.setItem('ems_theme', 'sombre')
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>
    )
    expect(document.documentElement.getAttribute('data-theme')).toBe('sombre')
  })

  it('setTheme persists to localStorage', () => {
    const { getByRole } = render(
      <ThemeProvider>
        <ThemeToggler />
      </ThemeProvider>
    )
    act(() => {
      getByRole('button').click()
    })
    expect(localStorage.getItem('ems_theme')).toBe('sombre')
  })

  it('setTheme updates the document attribute', () => {
    const { getByRole } = render(
      <ThemeProvider>
        <ThemeToggler />
      </ThemeProvider>
    )
    act(() => {
      getByRole('button').click()
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('sombre')
  })

  it('toggling back to clair removes sombre attribute', () => {
    localStorage.setItem('ems_theme', 'sombre')
    const { getByRole } = render(
      <ThemeProvider>
        <ThemeToggler />
      </ThemeProvider>
    )
    act(() => {
      getByRole('button').click() // sombre -> clair
    })
    const attr = document.documentElement.getAttribute('data-theme')
    // Either attribute removed or set to 'clair'
    expect(attr === null || attr === 'clair').toBe(true)
  })
})
