import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('font globale', () => {
  it("index.css déclare uniquement 'Century Gothic' sans police de repli", () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, 'index.css'),
      'utf-8'
    )
    // Doit contenir 'Century Gothic'
    expect(css).toContain("'Century Gothic'")
    // Ne doit pas contenir d'autre famille de polices dans la règle body/#root
    const fontFamilyRule = css.match(/body,#root\{[^}]+\}/)?.[0] ?? ''
    // Pas de virgule après 'Century Gothic' => pas de fallback
    expect(fontFamilyRule).toMatch(/font-family:'Century Gothic'[^,]/)
  })
})
