import path from 'node:path'
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

type SeedRole =
  | 'admin'
  | 'adminTerapeuta'
  | 'terapeuta1'
  | 'terapeuta2'
  | 'paciente1'

interface SeedUser {
  readonly email: string
  readonly password: string
}

/**
 * The five seed roles available on a freshly reset local Supabase stack
 * (`supabase/seed.sql`). Password is always `local-seed-cgGqBIrprZGocA9r5Jxm` for every seed user.
 */
const SEED_USERS: Record<SeedRole, SeedUser> = {
  admin: {
    email: 'admin@clienteapp.test',
    password: 'local-seed-cgGqBIrprZGocA9r5Jxm',
  },
  adminTerapeuta: {
    email: 'admin.terapeuta@clienteapp.test',
    password: 'local-seed-cgGqBIrprZGocA9r5Jxm',
  },
  terapeuta1: {
    email: 'terapeuta1@clienteapp.test',
    password: 'local-seed-cgGqBIrprZGocA9r5Jxm',
  },
  terapeuta2: {
    email: 'terapeuta2@clienteapp.test',
    password: 'local-seed-cgGqBIrprZGocA9r5Jxm',
  },
  paciente1: {
    email: 'paciente1@clienteapp.test',
    password: 'local-seed-cgGqBIrprZGocA9r5Jxm',
  },
}

const storageStatePathFor = (role: SeedRole): string =>
  path.join(process.cwd(), 'playwright', '.auth', `${role}.json`)

/**
 * Authenticates through the real `/auth/login` form. Canonical selectors
 * per `app/auth/login/LoginView.tsx`: labels "Correo profesional" /
 * "Contraseña", submit button "Entrar al panel →". `#email` / `#password`
 * remain valid fallback selectors. The `playwright-uat` skill's older
 * reference to a "Login" button label is stale — do not use it here.
 */
const loginViaUI = async (
  page: Page,
  email: string,
  password: string,
): Promise<void> => {
  await page.goto('/auth/login')

  const emailField = page.getByLabel('Correo profesional')
  const passwordField = page.getByLabel('Contraseña')

  await (
    (await emailField.count()) > 0 ? emailField : page.locator('#email')
  ).fill(email)
  await (
    (await passwordField.count()) > 0
      ? passwordField
      : page.locator('#password')
  ).fill(password)

  await page.getByRole('button', { name: 'Entrar al panel →' }).click()

  await expect(page).not.toHaveURL(/\/auth\/(login|error)/)
}

export type { SeedRole, SeedUser }
export { SEED_USERS, storageStatePathFor, loginViaUI }
