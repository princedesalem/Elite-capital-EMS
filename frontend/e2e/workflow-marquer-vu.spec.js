// E2E — Marquer-vu : premier clic = date enregistrée, immuable, idempotent
// La suite "contrat backend" n'utilise que l'API (request fixture) — pas besoin de navigateur.
const { test, expect } = require('@playwright/test')
const { loginViaApi, BACKEND, FRONTEND } = require('./fixtures/auth')

const MATRICULE = process.env.E2E_EMPLOYE_MATRICULE || '90001'
const PASSWORD  = process.env.E2E_EMPLOYE_PASSWORD  || 'Test1234!@#'

async function apiLogin(request) {
  const form = new URLSearchParams()
  form.set('matricule', String(MATRICULE))
  form.set('password', PASSWORD)
  const res = await request.post(BACKEND + '/auth/login', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: form.toString(),
  }).catch(() => null)
  if (!res || res.status() !== 200) {
    return null
  }
  return (await res.json()).access_token
}

test.describe('Marquer-vu E2E (contrat backend)', () => {
  test('premier appel = ok/already=false ; deuxième appel = already=true et date_vue immuable', async ({ request }) => {
    const token = await apiLogin(request)
    if (!token) {
      test.skip(true, `Login E2E impossible (matricule=${MATRICULE}) — credentials de test non seedés`)
      return
    }

    const d0 = new Date(); d0.setDate(d0.getDate() + 60)
    const d1 = new Date(); d1.setDate(d1.getDate() + 64)
    const fmt = (d) => d.toISOString().slice(0, 10)

    const create = await request.post(BACKEND + '/api/operations/conges', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        matricule: parseInt(MATRICULE, 10),
        date_debut: fmt(d0),
        date_fin: fmt(d1),
        motif: 'E2E marquer-vu',
      },
    }).catch(() => null)

    if (!create || ![200, 201].includes(create.status())) {
      test.skip(true, `Création congé impossible (${create ? create.status() : 'no response'})`)
      return
    }
    const created = await create.json()
    const idOp = created.id_operation || created.id || created.operation_id
    expect(idOp, 'id_operation absent').toBeTruthy()

    const r1 = await request.post(
      `${BACKEND}/api/workflow/marquer-vu/${idOp}?matricule_observateur=${MATRICULE}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    expect(r1.status()).toBe(200)
    const b1 = await r1.json()
    expect(b1.ok).toBe(true)
    expect(b1.already).toBe(false)
    expect(b1.date_vue).toBeTruthy()

    const r2 = await request.post(
      `${BACKEND}/api/workflow/marquer-vu/${idOp}?matricule_observateur=${MATRICULE}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    expect(r2.status()).toBe(200)
    const b2 = await r2.json()
    expect(b2.ok).toBe(true)
    expect(b2.already).toBe(true)
    expect(b2.date_vue).toBe(b1.date_vue)

    const rp = await request.get(
      `${BACKEND}/api/workflow/progression/${idOp}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    expect(rp.status()).toBe(200)
    const prog = await rp.json()
    expect(Array.isArray(prog.etapes)).toBe(true)
    const hasVu = prog.etapes.some((e) => e.date_vue)
    expect(hasVu, 'aucune étape avec date_vue').toBe(true)
  })
})

test.describe('Marquer-vu E2E (UI)', () => {
  test('clic sur une ligne de la boîte congés déclenche marquer-vu', async ({ page }) => {
    const token = await loginViaApi(page, MATRICULE, PASSWORD)

    const d0 = new Date(); d0.setDate(d0.getDate() + 70)
    const d1 = new Date(); d1.setDate(d1.getDate() + 73)
    const fmt = (d) => d.toISOString().slice(0, 10)

    const create = await page.request.post(BACKEND + '/api/operations/conges', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        matricule: parseInt(MATRICULE, 10),
        date_debut: fmt(d0),
        date_fin: fmt(d1),
        motif: 'E2E UI marquer-vu',
      },
    }).catch(() => null)

    if (!create || ![200, 201].includes(create.status())) {
      test.skip(true, 'Création congé impossible')
      return
    }
    const created = await create.json()
    const idOp = created.id_operation || created.id || created.operation_id

    let marquerVuCalled = false
    page.on('request', (req) => {
      if (req.url().includes(`/api/workflow/marquer-vu/${idOp}`)) {
        marquerVuCalled = true
      }
    })

    await page.goto(FRONTEND + '/rh/conges')
    await page.waitForTimeout(1500)

    const row = page.locator('tr[style*="cursor"]').first()
    if (await row.count() === 0) {
      test.skip(true, 'Aucune ligne cliquable')
      return
    }
    await row.click()
    await page.waitForTimeout(1500)
    expect(marquerVuCalled).toBe(true)
  })
})
