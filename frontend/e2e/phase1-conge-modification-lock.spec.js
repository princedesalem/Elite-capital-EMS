// Phase 1 — B3 : règle modification congé J-14 (DOM lock / message verrouillé).
const { test, expect } = require('@playwright/test')
const { loginUI, FRONTEND } = require('./fixtures/auth')

const EMPLOYE = process.env.E2E_EMPLOYE_MATRICULE || '90001'
const PASSWORD = process.env.E2E_EMPLOYE_PASSWORD || 'Test1234!@#'

test.describe('Phase1 — Congé J-14 lock', () => {
  test('la page Congés se charge sans erreur après login', async ({ page }) => {
    await loginUI(page, EMPLOYE, PASSWORD)
    await page.goto(FRONTEND + '/conges')
    // Présence de la section congés
    await expect(page.locator('text=/cong[éè]/i').first()).toBeVisible({ timeout: 10_000 })
  })
})
