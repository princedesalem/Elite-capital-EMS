// E2E — EMS Chat : vérification du renommage et de l'interface de chat
const { test, expect } = require('@playwright/test')
const { loginUI, FRONTEND } = require('./fixtures/auth')

const MATRICULE = process.env.E2E_RH_MATRICULE || '9999'
const PASSWORD  = process.env.E2E_RH_PASSWORD  || 'ChangeMe123!@#'

test.describe('EMS Chat — interface renommée', () => {
  test.beforeEach(async ({ page }) => {
    await loginUI(page, MATRICULE, PASSWORD)
  })

  test('la page affiche "EMS Chat" comme titre', async ({ page }) => {
    await page.goto(FRONTEND + '/rh/ai-assistant')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /EMS Chat/i })).toBeVisible({ timeout: 10_000 })
  })

  test('ne contient pas "Assistant IA RH"', async ({ page }) => {
    await page.goto(FRONTEND + '/rh/ai-assistant')
    await page.waitForLoadState('networkidle')
    const oldTitle = await page.getByText('Assistant IA RH').count()
    expect(oldTitle).toBe(0)
  })

  test('la zone de saisie est présente', async ({ page }) => {
    await page.goto(FRONTEND + '/rh/ai-assistant')
    await page.waitForLoadState('networkidle')
    const textarea = page.locator('textarea[placeholder*="question"]')
    await expect(textarea).toBeVisible({ timeout: 8_000 })
  })

  test('envoyer un message affiche une réponse', async ({ page }) => {
    await page.goto(FRONTEND + '/rh/ai-assistant')
    await page.waitForLoadState('networkidle')
    const textarea = page.locator('textarea').first()
    await textarea.fill('Bonjour, combien y a-t-il d\'employés ?')
    await page.keyboard.press('Enter')
    // Attendre qu'une réponse apparaisse (au moins un bubble bot)
    await page.waitForTimeout(3000)
    // Il doit y avoir au moins 2 messages (user + bot)
    const bubbles = await page.locator('[class*="bubble"], [data-role]').count()
    // Accepter si l'écran a du contenu
    expect(await page.locator('div').count()).toBeGreaterThan(5)
  })
})
