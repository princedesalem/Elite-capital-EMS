// Phase 1 — C1 : scroll horizontal sur tableaux.
const { test, expect } = require('@playwright/test')
const { loginUI, FRONTEND } = require('./fixtures/auth')

const ADMIN = process.env.E2E_ADMIN_MATRICULE || '9001'
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'TestAdmin123!'

test.describe('Phase1 — Tables scroll horizontal', () => {
  test.use({ viewport: { width: 1024, height: 768 } })

  test('liste employés scrolle horizontalement', async ({ page }) => {
    await loginUI(page, ADMIN, PASSWORD)
    await page.goto(FRONTEND + '/employees')
    const wrapper = page.locator('.table-wrapper, .table-scroll').first()
    if (await wrapper.count()) {
      const scrollable = await wrapper.evaluate((el) => {
        const cs = getComputedStyle(el)
        return cs.overflowX === 'auto' || cs.overflowX === 'scroll'
      })
      expect(scrollable).toBeTruthy()
    } else {
      // Fallback : vérifier qu'au moins une table a un parent scrollable
      const ok = await page.evaluate(() => {
        const tables = Array.from(document.querySelectorAll('table'))
        return tables.some((t) => {
          let p = t.parentElement
          while (p) {
            const cs = getComputedStyle(p)
            if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return true
            p = p.parentElement
          }
          return false
        })
      })
      expect(ok).toBeTruthy()
    }
  })
})
