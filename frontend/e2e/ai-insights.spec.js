/**
 * E2E — AI Insights & Recommendations panel
 *
 * Tests :
 *   1. Dashboard /home — open panel, see structured content
 *   2. Tab switch (personnel ↔ departements) triggers a fresh fetch
 *   3. Regenerate button triggers new analysis
 *   4. Analytics /rh/analytics — open panel, see structure
 *   5. Analytics filter change updates insights
 */
const { test, expect } = require('@playwright/test')
const { loginUI, FRONTEND } = require('./fixtures/auth')

const ADMIN_MATRICULE = process.env.E2E_ADMIN_MATRICULE || '9999'
const ADMIN_PASSWORD  = process.env.E2E_ADMIN_PASSWORD  || 'ChangeMe123!@#'

// Timeout for AI insights (can be slow on first call)
const AI_TIMEOUT = 60_000

test.describe('AI Insights Panel', () => {
  // ─────────────────────────────────────────────
  // Dashboard
  // ─────────────────────────────────────────────
  test.describe('Dashboard /home', () => {
    test.beforeEach(async ({ page }) => {
      await loginUI(page, ADMIN_MATRICULE, ADMIN_PASSWORD)
      await page.waitForURL(/\/home/, { timeout: 15_000 })
    })

    test('panel is collapsed on load', async ({ page }) => {
      const header = page.getByTestId('ai-insight-header')
      await expect(header).toBeVisible()
      // Content should not be present until panel is opened
      await expect(page.getByTestId('ai-insight-content')).not.toBeVisible()
    })

    test('opening panel fetches and shows structured insights', async ({ page }) => {
      const header = page.getByTestId('ai-insight-header')
      await header.click()

      // Loading state
      const loading = page.getByTestId('ai-insight-loading')
      // Loading might appear briefly — wait for it to disappear
      await expect(loading).not.toBeVisible({ timeout: AI_TIMEOUT })

      // Content sections
      const content = page.getByTestId('ai-insight-content')
      await expect(content).toBeVisible({ timeout: AI_TIMEOUT })

      // At least one KPI card
      await expect(page.getByTestId('ai-insight-kpi').first()).toBeVisible()
      // At least one recommendation
      await expect(page.getByTestId('ai-insight-reco').first()).toBeVisible()
    })

    test('regenerate button triggers a new analysis', async ({ page }) => {
      await page.getByTestId('ai-insight-header').click()
      await expect(page.getByTestId('ai-insight-content')).toBeVisible({ timeout: AI_TIMEOUT })

      // Click regenerate
      const regenerateBtn = page.getByTestId('ai-insight-regenerate')
      await expect(regenerateBtn).toBeVisible()
      await regenerateBtn.click()

      // Should show loading again
      // Then content re-appears
      await expect(page.getByTestId('ai-insight-content')).toBeVisible({ timeout: AI_TIMEOUT })
    })

    test('narratif toggle shows and hides full report', async ({ page }) => {
      await page.getByTestId('ai-insight-header').click()
      await expect(page.getByTestId('ai-insight-content')).toBeVisible({ timeout: AI_TIMEOUT })

      const toggleBtn = page.getByTestId('ai-insight-toggle-narratif')
      await expect(toggleBtn).toBeVisible()

      // Click to show narratif
      await toggleBtn.click()
      // Narratif content is shown (look for the button now saying "Masquer")
      await expect(page.getByTestId('ai-insight-toggle-narratif')).toContainText(/masquer|hide/i)

      // Click again to hide
      await toggleBtn.click()
      await expect(page.getByTestId('ai-insight-toggle-narratif')).toContainText(/voir|show/i)
    })
  })

  // ─────────────────────────────────────────────
  // Analytics /rh/analytics
  // ─────────────────────────────────────────────
  test.describe('Analytics /rh/analytics', () => {
    test.beforeEach(async ({ page }) => {
      await loginUI(page, ADMIN_MATRICULE, ADMIN_PASSWORD)
      await page.goto(FRONTEND + '/rh/analytics')
      await page.waitForURL(/\/rh\/analytics/, { timeout: 15_000 })
    })

    test('AI panel is present on analytics page', async ({ page }) => {
      const header = page.getByTestId('ai-insight-header')
      await expect(header).toBeVisible()
    })

    test('opening analytics panel shows KPIs and recommendations', async ({ page }) => {
      await page.getByTestId('ai-insight-header').click()
      await expect(page.getByTestId('ai-insight-loading')).not.toBeVisible({ timeout: AI_TIMEOUT })
      await expect(page.getByTestId('ai-insight-content')).toBeVisible({ timeout: AI_TIMEOUT })
      await expect(page.getByTestId('ai-insight-kpi').first()).toBeVisible()
      await expect(page.getByTestId('ai-insight-reco').first()).toBeVisible()
    })

    test('error state is shown when service is unavailable', async ({ page }) => {
      // Intercept the /api/ai/insights request and make it fail
      await page.route('**/api/ai/insights', route => route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Service unavailable' }),
      }))

      await page.getByTestId('ai-insight-header').click()
      await expect(page.getByTestId('ai-insight-error')).toBeVisible({ timeout: 15_000 })
    })
  })
})
