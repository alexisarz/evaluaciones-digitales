import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
})

test('muestra el formulario de acceso y oculta la contraseña', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Evaluación Digital' })).toBeVisible()
  await expect(page.getByText('Ingresá con tu legajo y contraseña.')).toBeVisible()
  await expect(page.getByLabel('Legajo')).toBeVisible()
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'password')
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
})

test('exige los campos obligatorios sin enviar el formulario', async ({ page }) => {
  await page.getByRole('button', { name: 'Ingresar' }).click()
  expect(await page.getByLabel('Legajo').evaluate((input) => input.validity.valid)).toBe(false)
  await expect(page).toHaveURL(/\/login$/)
})

test('permite alternar al primer ingreso y volver al login', async ({ page }) => {
  await page.getByRole('button', { name: 'Es mi primer ingreso' }).click()
  await expect(page.getByText('Definí tu contraseña para activar la cuenta.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Activar cuenta' })).toBeVisible()
  await page.getByRole('button', { name: 'Ya tengo contraseña' }).click()
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
})

test('muestra y cierra las instrucciones de recupero', async ({ page }) => {
  await page.getByRole('button', { name: 'Olvidé mi contraseña' }).click()
  const dialog = page.getByRole('dialog', { name: 'Recupero de contraseña' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('link', { name: /@evaluacionesuade\.com\.ar/ })).toHaveAttribute('href', /^mailto:/)
  await dialog.getByRole('button', { name: 'Aceptar' }).click()
  await expect(dialog).toBeHidden()
})

test('sólo permite dígitos en el legajo y no consulta Firebase si queda vacío', async ({ page }) => {
  await page.getByLabel('Legajo').fill('abc12-3')
  await expect(page.getByLabel('Legajo')).toHaveValue('123')
  await page.getByLabel('Legajo').fill('abc-!?')
  await expect(page.getByLabel('Legajo')).toHaveValue('')
  await page.getByLabel('Contraseña', { exact: true }).fill('clave123')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  expect(await page.getByLabel('Legajo').evaluate((input) => input.validity.valid)).toBe(false)
  await expect(page).toHaveURL(/\/login$/)
})

test('permite mostrar y volver a ocultar la contraseña', async ({ page }) => {
  const password = page.getByLabel('Contraseña', { exact: true })
  await password.fill('clave123')
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Ocultar contraseña' }).click()
  await expect(password).toHaveAttribute('type', 'password')
  await expect(password).toHaveValue('clave123')
})
