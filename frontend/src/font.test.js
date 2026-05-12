import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('font globale', () => {
  it("index.css charge Century Gothic via @font-face et l'applique globalement", () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, 'index.css'),
      'utf-8'
    )
    // Embed via @font-face
    expect(css).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Century Gothic'/)
    // Doit pointer sur le fichier TTF embarqué
    expect(css).toContain('/fonts/CenturyGothic.ttf')
    // body/#root commence par 'Century Gothic'
    const bodyRule = css.match(/body,#root\{[^}]+\}/)?.[0] ?? ''
    expect(bodyRule).toMatch(/font-family:\s*'Century Gothic'/)
    // Sélecteur global *
    expect(css).toMatch(/\*\s*,\s*\*::before\s*,\s*\*::after\s*\{[^}]*font-family:\s*'Century Gothic'/)
  })
})
