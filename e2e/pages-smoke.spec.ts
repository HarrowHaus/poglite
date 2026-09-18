import { expect, test, type Page } from '@playwright/test'

async function loadAndAssertRuntime(page: Page, path: string) {
  const failures: string[] = []

  page.on('pageerror', (error) => {
    failures.push('pageerror: ' + error.message)
  })

  page.on('console', (message) => {
    if (message.type() === 'error') {
      failures.push('console: ' + message.text())
    }
  })

  page.on('requestfailed', (request) => {
    failures.push(
      'requestfailed: ' +
        request.url() +
        ' :: ' +
        (request.failure()?.errorText ?? 'unknown'),
    )
  })

  const response = await page.goto(path)
  expect(response?.status()).toBeLessThan(400)

  await page.waitForTimeout(750)

  if (failures.length > 0) {
    throw new Error('Browser runtime failures:\n' + failures.join('\n'))
  }
}

test('project Pages root loads the playable table', async ({ page }) => {
  await loadAndAssertRuntime(page, './')

  await expect(page).toHaveTitle('Poglite')
  await expect(page.getByRole('heading', { name: 'Hall Monitor' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByText('GRAB SLAMMER · PULL BACK · RELEASE')).toBeVisible()
})

test('stack navigation stays inside the /poglite Pages base', async ({ page }) => {
  await loadAndAssertRuntime(page, './')
  await page.getByRole('link', { name: /STACK/ }).click()

  await expect(page).toHaveURL(/\/poglite\/stack$/)
  await expect(page.getByRole('heading', { name: 'Build the stack.' })).toBeVisible()

  await page.getByRole('link', { name: 'BACK TO TABLE' }).click()
  await expect(page).toHaveURL(/\/poglite\/$/)
})

test('binder route renders from the production base', async ({ page }) => {
  await loadAndAssertRuntime(page, './binder')

  await expect(page).toHaveURL(/\/poglite\/binder$/)
  await expect(page.getByRole('heading', { name: 'The Binder' })).toBeVisible()
  await expect(page.getByText(/8\/20 POGs/)).toBeVisible()
})
