/**
 * Helpers d'authentification pour les tests E2E Playwright.
 *
 * Utilisation :
 *   const { loginUI, loginViaApi } = require('./fixtures/auth');
 *   await loginUI(page, '9001', 'TestAdmin123!');
 */
const { expect } = require('@playwright/test')

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173'
const BACKEND  = process.env.BACKEND_URL  || 'http://localhost:8000'

/**
 * Login via UI : navigue sur /, remplit le formulaire, clique Se connecter.
 * Attend la redirection vers /home (ou /rh).
 */
async function loginUI(page, matricule, password, mfaCode = '') {
  await page.goto(FRONTEND + '/')
  await page.locator('input[placeholder="Matricule"]').fill(String(matricule))
  await page.locator('input[placeholder="Mot de passe"]').fill(password)
  if (mfaCode) {
    await page.locator('input[placeholder*="MFA"]').fill(mfaCode)
  }
  await page.getByRole('button', { name: /Se connecter/i }).click()
  await page.waitForURL(/\/(home|rh)/, { timeout: 15_000 })
}

/**
 * Login via API directe : POST /auth/login, stocke le token en localStorage.
 * Plus rapide, mais ne remplit pas le formulaire UI.
 */
async function loginViaApi(page, matricule, password) {
  const form = new URLSearchParams()
  form.set('matricule', String(matricule))
  form.set('password', password)

  const res = await page.request.post(BACKEND + '/auth/login', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: form.toString(),
  })
  expect(res.status(), `login failed for ${matricule}: ${await res.text()}`).toBe(200)
  const { access_token } = await res.json()

  await page.goto(FRONTEND + '/')
  await page.evaluate((token) => {
    localStorage.setItem('ec_token', token)
    localStorage.setItem('access_token', token)
  }, access_token)
  return access_token
}

async function logout(page) {
  await page.goto(FRONTEND + '/')
  await page.evaluate(() => {
    localStorage.removeItem('ec_token')
    localStorage.removeItem('access_token')
  })
  await page.goto(FRONTEND + '/')
}

module.exports = { loginUI, loginViaApi, logout, FRONTEND, BACKEND }
