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


test('pull-and-release gesture resolves a turn in the production camera', async ({ page }) => {
  await loadAndAssertRuntime(page, './')

  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')

  // Projection of the known slammer anchor (0, 1.35, 1.8) for the current
  // 34° camera at (0, 7.41, 8.19), looking at (0, 0.12, 0).
  // We start near the visual slammer center and pull screen-down (toward camera),
  // so the slingshot release launches toward the POG stack.
  const startX = box.x + box.width * 0.5
  const startY = box.y + box.height * 0.63

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY + box.height * 0.13, { steps: 12 })
  await page.mouse.up()

  await expect(page.locator('.player-status div').nth(2).locator('strong')).toHaveText('2', {
    timeout: 5_000,
  })
})


test('snap-slam experiment route loads beside the current mechanic', async ({ page }) => {
  await loadAndAssertRuntime(page, './dev/snap')

  await expect(page).toHaveURL(/\/poglite\/dev\/snap$/)
  await expect(page.getByRole('heading', { name: 'Strike, don\'t throw.' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
})
