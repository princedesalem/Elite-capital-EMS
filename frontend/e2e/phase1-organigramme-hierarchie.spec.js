// Phase 1 — C2 : organigramme — responsable au-dessus des employés.
const { test, expect } = require('@playwright/test')
const { loginUI, FRONTEND } = require('./fixtures/auth')

const ADMIN = process.env.E2E_ADMIN_MATRICULE || '9001'
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'TestAdmin123!'

test.describe('Phase1 — Organigramme hiérarchie', () => {
  test('un nœud responsable a un top inférieur à ses enfants', async ({ page }) => {
    await loginUI(page, ADMIN, PASSWORD)
    await page.goto(FRONTEND + '/organigramme')
    // On attend qu'au moins un nœud .oc-node soit rendu
    const nodes = page.locator('.oc-node')
    await expect(nodes.first()).toBeVisible({ timeout: 15_000 })

    // Cherche un nœud parent ayant des enfants
    const parents = await page.evaluate(() => {
      const ns = Array.from(document.querySelectorAll('.oc-node'))
      const parentsInfo = []
      for (const n of ns) {
        const row = n.querySelector(':scope > .oc-row')
        const box = n.querySelector(':scope > .oc-box')
        if (row && box) {
          const parentRect = box.getBoundingClientRect()
          const childRect = row.getBoundingClientRect()
          parentsInfo.push({ parentTop: parentRect.top, childTop: childRect.top })
        }
      }
      return parentsInfo
    })
    if (parents.length > 0) {
      for (const p of parents) {
        expect(p.parentTop).toBeLessThan(p.childTop)
      }
    }
  })
})
