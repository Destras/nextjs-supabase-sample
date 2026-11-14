import { test as setup } from '@playwright/test'
import { assertPreflight } from './utils/preflight'

setup('preflight', async () => {
  await assertPreflight()
})
