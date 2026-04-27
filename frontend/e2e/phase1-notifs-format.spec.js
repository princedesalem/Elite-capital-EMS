// Phase 1 — A1/A2/A4 : format des notifications + toast bleu charte.
const { test, expect } = require('@playwright/test')
const { loginUI, FRONTEND } = require('./fixtures/auth')

const EMPLOYE = process.env.E2E_EMPLOYE_MATRICULE || '90001'
const PASSWORD = process.env.E2E_EMPLOYE_PASSWORD || 'Test1234!@#'

test.describe('Phase1 — Notifications format', () => {
  test('aucun titre/message ne contient "en tant que" ni "multi-destinations"', async ({ page }) => {
    await loginUI(page, EMPLOYE, PASSWORD)
    await page.goto(FRONTEND + '/notifications')
    // attendre un éventuel chargement
    await page.waitForLoadState('networkidle').catch(() => {})
    const text = (await page.content()).toLowerCase()
    expect(text.includes('en tant que ')).toBeFalsy()
    expect(text.includes('multi-destinations')).toBeFalsy()
  })
})
