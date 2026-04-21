const { test, expect } = require('@playwright/test')

const FRONTEND = process.env.FRONTEND_URL || 'http://host.docker.internal:5173'
const BACKEND  = process.env.BACKEND_URL  || 'http://host.docker.internal:8000'

test.describe('Health checks — site running', () => {
  test('frontend répond sur ' + FRONTEND, async ({ page }) => {
    const response = await page.goto(FRONTEND)
    expect(response.status()).toBe(200)
  })

  test('frontend affiche la page de connexion', async ({ page }) => {
    await page.goto(FRONTEND)
    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
    // Un input doit être visible (formulaire de connexion)
    const inputs = page.locator('input')
    await expect(inputs.first()).toBeVisible({ timeout: 10_000 })
  })

  test('backend /health répond 200 avec status ok', async ({ request: apiCtx }) => {
    const resp = await apiCtx.get(BACKEND + '/health')
    expect(resp.status()).toBe(200)
    const json = await resp.json()
    expect(json.status).toBe('ok')
  })

  test('backend / répond avec message Backend running', async ({ request: apiCtx }) => {
    const resp = await apiCtx.get(BACKEND + '/')
    expect(resp.status()).toBe(200)
    const json = await resp.json()
    expect(json.message).toBe('Backend running')
  })

  test('backend API login endpoint accessible (POST /auth/login)', async ({ request: apiCtx }) => {
    // 422 = validation error = endpoint présent et opérationnel
    const resp = await apiCtx.post(BACKEND + '/auth/login', { data: {} })
    expect([200, 401, 422]).toContain(resp.status())
  })
})
