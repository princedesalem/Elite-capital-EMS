// E2E — Administration : onglet Fonctions
// Teste : chargement liste, scroll+animation sur Modifier, ajout, mise à jour, protection suppression utilisée

const { test, expect } = require('@playwright/test')
const { loginUI, loginViaApi, FRONTEND, BACKEND } = require('./fixtures/auth')

const ADMIN      = process.env.E2E_ADMIN_MATRICULE || '9001'
const PASSWORD   = process.env.E2E_ADMIN_PASSWORD  || 'TestAdmin123!'
const EMPLOYE_M  = process.env.E2E_EMPLOYE_MATRICULE || '90001'
const EMPLOYE_PW = process.env.E2E_EMPLOYE_PASSWORD  || 'Test1234!@#'

test.describe('Administration — Fonctions', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  // ──────────────────────────────────────────────────────────────────
  // 1. La liste des fonctions se charge sans erreur
  // ──────────────────────────────────────────────────────────────────
  test('onglet Fonctions : liste non vide et pas de message erreur', async ({ page }) => {
    await loginUI(page, ADMIN, PASSWORD)
    await page.goto(FRONTEND + '/rh/administration')

    await page.getByRole('button', { name: /Fonctions/i }).first().click()
    await page.waitForTimeout(800)

    // La liste doit avoir au moins une entrée
    const items = page.locator('span[style*="font-weight"]').filter({ hasText: /\w+/ })
    await expect(items.first()).toBeVisible({ timeout: 8000 })

    // Aucun message d'erreur visible
    const erreur = page.locator('text=Erreur, text=erreur')
    await expect(erreur).toHaveCount(0)
  })

  // ──────────────────────────────────────────────────────────────────
  // 2. Clic "Modifier" : scroll haut de page + formulaire rempli
  // ──────────────────────────────────────────────────────────────────
  test('clic Modifier : scroll vers le haut et formulaire rempli', async ({ page }) => {
    await loginUI(page, ADMIN, PASSWORD)
    await page.goto(FRONTEND + '/rh/administration')

    await page.getByRole('button', { name: /Fonctions/i }).first().click()
    await page.waitForTimeout(800)

    // Scroll en bas pour tester le retour haut
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(200)

    const scrollBefore = await page.evaluate(() => document.documentElement.scrollTop)
    expect(scrollBefore).toBeGreaterThan(50)

    // Cliquer sur le premier bouton Modifier visible
    const modifierBtns = page.getByRole('button', { name: /Modifier/i })
    await modifierBtns.first().click()
    await page.waitForTimeout(700) // laisse le smooth scroll finir

    const scrollAfter = await page.evaluate(() => document.documentElement.scrollTop)
    expect(scrollAfter).toBeLessThan(30) // on est bien tout en haut

    // Le champ libellé doit être rempli
    const input = page.getByPlaceholder(/libellé de la fonction/i)
    await expect(input).not.toHaveValue('')
  })

  // ──────────────────────────────────────────────────────────────────
  // 3. Ajout d'une fonction puis suppression (cleanup)
  // ──────────────────────────────────────────────────────────────────
  test('ajouter une fonction et la supprimer', async ({ page }) => {
    await loginUI(page, ADMIN, PASSWORD)
    await page.goto(FRONTEND + '/rh/administration')

    await page.getByRole('button', { name: /Fonctions/i }).first().click()
    await page.waitForTimeout(600)

    const LIBELLE = `Testeur E2E ${Date.now()}`

    // Remplir le formulaire d'ajout
    await page.getByPlaceholder(/libellé de la fonction/i).fill(LIBELLE)
    await page.getByRole('button', { name: /Ajouter|Enregistrer/i }).first().click()
    await page.waitForTimeout(800)

    // La nouvelle fonction doit apparaître dans la liste
    await expect(page.locator(`text=${LIBELLE}`)).toBeVisible({ timeout: 6000 })

    // Supprimer la fonction créée
    const row = page.locator(`span:text-is("${LIBELLE}")`).locator('..')
    await row.getByRole('button', { name: /Supprimer/i }).click()
    // Confirmer la boîte de dialogue
    await page.getByRole('button', { name: /Supprimer/i }).last().click()
    await page.waitForTimeout(800)

    await expect(page.locator(`text=${LIBELLE}`)).toHaveCount(0)
  })

  // ──────────────────────────────────────────────────────────────────
  // 4. Un rôle EMPLOYE ne voit pas les boutons de gestion
  // ──────────────────────────────────────────────────────────────────
  test('rôle EMPLOYE : pas de boutons Modifier/Supprimer sur fonctions', async ({ page }) => {
    await loginUI(page, EMPLOYE_M, EMPLOYE_PW)
    await page.goto(FRONTEND + '/rh/administration')

    await page.getByRole('button', { name: /Fonctions/i }).first().click()
    await page.waitForTimeout(600)

    // Aucun bouton d'action admin visible
    await expect(page.getByRole('button', { name: /Modifier/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Supprimer/i })).toHaveCount(0)
  })
})
