import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime, dateTitle } from './dates'

describe('utils/dates', () => {
  it('formatDate renders a French short date', () => {
    const out = formatDate('2026-04-21T10:15:00Z')
    // fr-FR locale in jsdom renders 21/04/2026
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })

  it('formatDate returns placeholder for invalid / empty', () => {
    expect(formatDate('')).toBe('')
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
    expect(formatDate('not-a-date')).toBe('')
  })

  it('formatDateTime includes time portion', () => {
    const out = formatDateTime('2026-04-21T10:15:45Z')
    expect(out).toMatch(/\d{2}[:h]\d{2}/)
  })

  it('dateTitle returns empty string for null', () => {
    expect(dateTitle(null)).toBe('')
    expect(dateTitle('')).toBe('')
  })

  it('dateTitle returns a non-empty string for valid date', () => {
    const out = dateTitle('2026-04-21T10:15:00Z')
    expect(out).not.toBe('')
    expect(out.length).toBeGreaterThan(8)
  })

  it('formatDate accepts a Date object', () => {
    const d = new Date(2026, 3, 21)
    expect(formatDate(d)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })
})
