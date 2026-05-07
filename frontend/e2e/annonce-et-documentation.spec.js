// E2E — Annonce dans Espace Équipe + Documentation dans la navbar
const { test, expect } = require('@playwright/test')
const { loginUI, FRONTEND } = require('./fixtures/auth')

const MATRICULE = process.env.E2E_RH_MATRICULE || '9999'
const PASSWORD  = process.env.E2E_RH_PASSWORD  || 'ChangeMe123!@#'

test.describe('Annonce — Espace Équipe', () => {
  test.beforeEach(async ({ page }) => {
    await loginUI(page, MATRICULE, PASSWORD)
    await page.goto(FRONTEND + '/rh/home')
    await page.waitForLoadState('networkidle')
  })

  test('le bouton "Annonce" est visible dans l\'Espace Équipe', async ({ page }) => {
    await expect(page.getByRole('button', { name: /annonce/i })).toBeVisible({ timeout: 10_000 })
  })

  test('cliquer sur Annonce affiche le formulaire', async ({ page }) => {
    await page.getByRole('button', { name: /annonce/i }).click()
    await expect(page.getByPlaceholder(/titre de l'annonce/i)).toBeVisible({ timeout: 6_000 })
  })

  test('publier une annonce la fait apparaître dans le fil', async ({ page }) => {
    await page.getByRole('button', { name: /annonce/i }).click()
    await page.getByPlaceholder(/titre de l'annonce/i).fill('Test E2E Annonce')
    await page.getByPlaceholder(/contenu de l'annonce/i).fill('Ceci est une annonce de test E2E.')
    await page.getByRole('button', { name: /diffuser/i }).click()
    await page.waitForTimeout(1500)
    await expect(page.getByText('Test E2E Annonce')).toBeVisible({ timeout: 8_000 })
  })

  test('le filtre "Annonces" est présent dans la barre de filtres', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^annonces$/i })).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('Documentation — onglet navbar', () => {
  test.beforeEach(async ({ page }) => {
    await loginUI(page, MATRICULE, PASSWORD)
  })

  test('le lien Documentation est visible dans la navbar', async ({ page }) => {
    await page.goto(FRONTEND + '/rh/home')
    await expect(page.getByRole('link', { name: /documentation/i })).toBeVisible({ timeout: 8_000 })
  })

  test('naviguer vers /rh/documentation affiche la page', async ({ page }) => {
    await page.goto(FRONTEND + '/rh/documentation')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /documentation/i })).toBeVisible({ timeout: 10_000 })
  })

  test('la page Documentation contient les onglets Articles et Fichiers', async ({ page }) => {
    await page.goto(FRONTEND + '/rh/documentation')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Articles')).toBeVisible()
    await expect(page.getByText('Fichiers')).toBeVisible()
  })

  test('l\'onglet Fichiers affiche la zone d\'upload', async ({ page }) => {
    await page.goto(FRONTEND + '/rh/documentation')
    await page.waitForLoadState('networkidle')
    await page.getByText('Fichiers').click()
    await expect(page.getByText(/choisir un fichier/i)).toBeVisible({ timeout: 6_000 })
  })
})
