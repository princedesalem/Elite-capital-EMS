/**
 * Tests — bouton Œil (Voir détails) style ghost
 * Vérifie que le bouton œil dans chaque page de gestion utilise
 * la classe CSS btn-ghost-primary et non un fond indigo solide.
 */
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PAGES = [
  'CongesPage.jsx',
  'PermissionsPage.jsx',
  'MissionsPage.jsx',
  'FraisPage.jsx',
  'SortiesPage.jsx',
]

describe('bouton œil — charte ghost (btn-ghost-primary)', () => {
  PAGES.forEach(filename => {
    it(`${filename} : eyeBtn utilise className="btn-ghost-primary"`, () => {
      const src = fs.readFileSync(
        path.resolve(__dirname, filename),
        'utf-8'
      )

      // Doit contenir btn-ghost-primary sur la ligne eyeBtn
      const eyeLines = src
        .split('\n')
        .filter(l => l.includes('eyeBtn') && l.includes('<button') && l.includes('Eye size'))

      expect(eyeLines.length).toBeGreaterThan(0)

      eyeLines.forEach(line => {
        expect(line).toContain('btn-ghost-primary')
        // Ne doit plus contenir le fond indigo solide
        expect(line).not.toContain("background: '#6366f1'")
        expect(line).not.toContain('background:#6366f1')
      })
    })
  })

  it('buttons.css définit .btn-ghost-primary avec background transparent', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../styles/buttons.css'),
      'utf-8'
    )
    expect(css).toContain('.btn-ghost-primary')
    expect(css).toContain('background: transparent')
    expect(css).toContain('border:')
  })
})
