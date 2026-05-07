// E2E — Nouvelle recrue : le checkbox apparaît dans le formulaire employé (RH)
const { test, expect } = require('@playwright/test')
const { loginUI, FRONTEND } = require('./fixtures/auth')

const MATRICULE = process.env.E2E_RH_MATRICULE || '9999'
const PASSWORD  = process.env.E2E_RH_PASSWORD  || 'ChangeMe123!@#'

test.describe('Nouvelle recrue — checkbox dans formulaire employé', () => {
  test.beforeEach(async ({ page }) => {
    await loginUI(page, MATRICULE, PASSWORD)
  })

  test('le formulaire de création affiche le checkbox "Nouvelle recrue"', async ({ page }) => {
    await page.goto(FRONTEND + '/rh/employees/new')
    // Attendre que le formulaire soit chargé
    await page.waitForSelector('input[type="date"]', { timeout: 10_000 })
    // Le label "Nouvelle recrue" doit être visible
    const label = page.getByText('Nouvelle recrue')
    await expect(label).toBeVisible({ timeout: 8_000 })
  })

  test('le checkbox est décoché par défaut', async ({ page }) => {
    await page.goto(FRONTEND + '/rh/employees/new')
    await page.waitForSelector('input[type="date"]', { timeout: 10_000 })
    const checkbox = page.locator('input[type="checkbox"]').first()
    await expect(checkbox).not.toBeChecked()
  })

  test('le checkbox peut être coché', async ({ page }) => {
    await page.goto(FRONTEND + '/rh/employees/new')
    await page.waitForSelector('input[type="date"]', { timeout: 10_000 })
    const checkbox = page.locator('input[type="checkbox"]').first()
    await checkbox.check()
    await expect(checkbox).toBeChecked()
  })
})
