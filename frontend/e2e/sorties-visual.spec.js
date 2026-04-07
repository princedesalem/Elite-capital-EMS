const { test, expect } = require('@playwright/test')

const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtYXRyaWN1bGUiOjEyMywicm9sZSI6IlJIIiwicHJlbm9tIjoiSmVhbiIsIm5vbSI6IkR1cG9udCIsImV4cCI6NDA3MDkwODgwMH0.signature'

const workflowBoite = {
  envoye: [
    {
      id_operation: 1,
      type_demande: 'sortie',
      statut: 'en attente',
      date_demande: '2026-03-20',
      date_debut: '2026-03-20',
      date_fin: '2026-03-20',
      motif: 'Sortie client',
      demandeur: { prenom: 'Jean', nom: 'Dupont' },
    },
  ],
  recu: [
    {
      id_operation: 2,
      type_demande: 'sortie',
      statut: 'en attente',
      date_demande: '2026-03-20',
      date_debut: '2026-03-20',
      date_fin: '2026-03-20',
      motif: 'Validation mission',
      demandeur: { prenom: 'Aline', nom: 'Martin' },
    },
  ],
  valide: [],
  refuse: [],
}

const sorties = [
  {
    id_operation: 1,
    date_sortie: '2026-03-20',
    heure_sortie: '08:00:00',
    heure_retour: '18:00:00',
    commentaire: 'Client HQ',
  },
  {
    id_operation: 2,
    date_sortie: '2026-03-20',
    heure_sortie: '09:00:00',
    heure_retour: '17:00:00',
    commentaire: 'Validation terrain',
  },
]

test.beforeEach(async ({ page }) => {
  await page.route('**/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: AUTH_TOKEN }),
    })
  })

  await page.route('**/employees/sessions/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id_session: 1 }),
    })
  })

  await page.route('**/api/workflow/boite/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(workflowBoite) })
  })

  await page.route('**/api/sorties/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sorties) })
  })

  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })

  await page.route('**/employees/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })

  await page.goto('/login')
  await page.getByPlaceholder('Matricule').fill('123')
  await page.getByPlaceholder('Mot de passe').fill('PasswordTemp123!')
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await page.getByRole('link', { name: 'Accueil' }).click()
  await page.waitForURL('**/rh/home')

  await page.goto('/rh/sorties')
  await page.waitForURL('**/rh/sorties')
  await expect(page.getByRole('heading', { name: 'Gestion des sorties' })).toBeVisible()
})

const widths = [360, 768, 1024, 1440]

for (const width of widths) {
  test(`sorties table has no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })

    const table = page.locator('table').first()
    await expect(table).toBeVisible()

    const metrics = await page.evaluate(() => ({
      docClientWidth: document.documentElement.clientWidth,
      docScrollWidth: document.documentElement.scrollWidth,
    }))

    expect(metrics.docScrollWidth).toBeLessThanOrEqual(metrics.docClientWidth + 1)

    const screenshotName = `sorties-${width}.png`
    await page.screenshot({ path: `test-results/${screenshotName}`, fullPage: true })
  })
}
