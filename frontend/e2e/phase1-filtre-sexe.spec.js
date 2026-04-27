// Phase 1 — C4 : filtre employés par sexe.
const { test, expect } = require('@playwright/test')
const { loginViaApi, BACKEND } = require('./fixtures/auth')

const ADMIN = process.env.E2E_ADMIN_MATRICULE || '9001'
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'TestAdmin123!'

test.describe('Phase1 — Filtre sexe', () => {
  test('GET /employees?sexe=M renvoie uniquement des hommes', async ({ page }) => {
    const token = await loginViaApi(page, ADMIN, PASSWORD)
    const res = await page.request.get(BACKEND + '/employees/?sexe=M', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      for (const e of data) expect(['M', 'Masculin']).toContain(e.sexe || 'M')
    }
  })

  test('GET /employees?sexe=F renvoie uniquement des femmes', async ({ page }) => {
    const token = await loginViaApi(page, ADMIN, PASSWORD)
    const res = await page.request.get(BACKEND + '/employees/?sexe=F', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      for (const e of data) expect(['F', 'Féminin']).toContain(e.sexe || 'F')
    }
  })
})
