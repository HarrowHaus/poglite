import { expect, test } from '@playwright/test'

test('project Pages root loads the playable table', async ({ page }) => {
  await page.goto('./')

  await expect(page).toHaveTitle('Poglite')
  await expect(page.getByRole('heading', { name: 'Hall Monitor' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByText('GRAB SLAMMER · PULL BACK · RELEASE')).toBeVisible()
})

test('stack navigation stays inside the /poglite Pages base', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('link', { name: /STACK/ }).click()

  await expect(page).toHaveURL(/\/poglite\/stack$/)
  await expect(page.getByRole('heading', { name: 'Build the stack.' })).toBeVisible()

  await page.getByRole('link', { name: 'BACK TO TABLE' }).click()
  await expect(page).toHaveURL(/\/poglite\/$/)
})

test('binder route renders from the production base', async ({ page }) => {
  await page.goto('./binder')

  await expect(page).toHaveURL(/\/poglite\/binder$/)
  await expect(page.getByRole('heading', { name: 'The Binder' })).toBeVisible()
  await expect(page.getByText(/8\/20 POGs/)).toBeVisible()
})
