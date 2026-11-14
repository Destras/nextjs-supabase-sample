import { test, expect } from '@playwright/test'
import { storageStatePathFor } from './utils/auth'
import { newRunToken, uniquePatient } from './utils/factory'
import { registerCleanup, assertTokenPurged } from './utils/cleanup'
import { createPatientViaWizard } from './utils/wizard'

test.use({ storageState: storageStatePathFor('terapeuta1') })

test('proves the harness end-to-end: create a patient, see it, clean it up', async ({
  page,
}) => {
  const cleanup = registerCleanup()
  const token = cleanup.track(newRunToken())
  const seed = uniquePatient(token)

  await createPatientViaWizard(page, seed)

  await page.goto('/pacientes')
  await expect(
    page.getByRole('row', { name: new RegExp(seed.nombre) }),
  ).toBeVisible()

  await cleanup.purge()
  await assertTokenPurged(token)

  await page.goto('/pacientes')
  await expect(
    page.getByRole('row', { name: new RegExp(seed.nombre) }),
  ).toHaveCount(0)
})
