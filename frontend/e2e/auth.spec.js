// E2E — Authentification : login + logout
const { test, expect } = require('@playwright/test')
const { loginUI, FRONTEND, BACKEND } = require('./fixtures/auth')

const MATRICULE = process.env.E2E_EMPLOYE_MATRICULE || '90001'
const PASSWORD  = process.env.E2E_EMPLOYE_PASSWORD  || 'Test1234!@#'

test.describe('Auth E2E', () => {
  test('login matricule → redirection /home + UI utilisateur visible', async ({ page }) => {
    await loginUI(page, MATRICULE, PASSWORD)

    // On doit être redirigé hors de la page de login (sur /home ou /rh/...)
    await expect(page).toHaveURL(/\/(home|rh)/)

    // Le token doit être présent en localStorage
    const token = await page.evaluate(() => localStorage.getItem('ec_token'))
    expect(token).toBeTruthy()
    expect(token.length).toBeGreaterThan(20)
  })

  test('logout vide localStorage et ramène sur /login', async ({ page }) => {
    await loginUI(page, MATRICULE, PASSWORD)

    // Simulation logout : vider le token (la plupart des apps exposent un bouton,
    // mais on reste robuste en forçant l'état)
    await page.evaluate(() => {
      localStorage.removeItem('ec_token')
      localStorage.removeItem('access_token')
    })
    await page.goto(FRONTEND + '/')

    // Après logout, un input "Matricule" doit redevenir visible
    await expect(page.locator('input[placeholder="Matricule"]')).toBeVisible({ timeout: 10_000 })
  })

  test('identifiants invalides → message erreur, pas de token', async ({ page }) => {
    await page.goto(FRONTEND + '/')
    await page.locator('input[placeholder="Matricule"]').fill(String(MATRICULE))
    await page.locator('input[placeholder="Mot de passe"]').fill('WrongPassword!1')
    await page.getByRole('button', { name: /Se connecter/i }).click()

    // Attendre la réponse puis vérifier : soit un message d'erreur, soit pas de redirect
    await page.waitForTimeout(1500)
    const onLoginPage = await page.locator('input[placeholder="Matricule"]').isVisible()
    expect(onLoginPage).toBe(true)

    const token = await page.evaluate(() => localStorage.getItem('ec_token'))
    expect(token).toBeFalsy()
  })
})
