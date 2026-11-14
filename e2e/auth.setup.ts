import { test as setup } from '@playwright/test'
import { SEED_USERS, storageStatePathFor, loginViaUI } from './utils/auth'

const roles = Object.keys(SEED_USERS) as Array<keyof typeof SEED_USERS>

for (const role of roles) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const { email, password } = SEED_USERS[role]
    await loginViaUI(page, email, password)
    await page.context().storageState({ path: storageStatePathFor(role) })
  })
}
