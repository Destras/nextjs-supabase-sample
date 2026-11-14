import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import type { PatientSeed } from './factory'

/**
 * Page object for the intake wizard at `/pacientes/nuevo`. Selectors
 * verified against `IdentidadStep.tsx`, `DiagnosticoStep.tsx`,
 * `PlanStep.tsx` and `WizardFooter.tsx`.
 *
 * Only the identity fields are driven by the caller's `PatientSeed` —
 * the clinical selections (causa, algoritmo, modalidad) pick the first
 * available option in each list, since the smoke test only needs a
 * valid combination, not a specific clinical scenario.
 */
const goToNuevoPaciente = async (page: Page): Promise<void> => {
  await page.goto('/pacientes/nuevo')
}

const fillIdentidadStep = async (
  page: Page,
  seed: PatientSeed,
): Promise<void> => {
  const [year, month, day] = seed.fechaNacimiento.split('-').map(Number)

  await page.getByLabel('Nombre completo').fill(seed.nombre)
  await page.getByLabel('Teléfono').fill(seed.telefono)
  await page.getByLabel('Email').fill(seed.email)

  await page.getByRole('button', { name: /Seleccionar/ }).click()
  await page.getByLabel('Choose the Year').selectOption(String(year))
  // react-day-picker month dropdown value is the 0-based JS month index.
  await page.getByLabel('Choose the Month').selectOption(String(month - 1))
  await page
    .locator('[role="gridcell"]:not([data-outside]) button', {
      hasText: new RegExp(`^${day}$`),
    })
    .click()

  await page.getByRole('button', { name: 'Continuar' }).click()
}

const selectFirstDiagnosticoStep = async (page: Page): Promise<void> => {
  // DiagnosticoStep renders every causa card as `role="radio"`, followed
  // (further down the DOM) by every algoritmo card, also `role="radio"`
  // (bloqueos are `role="checkbox"` and are not matched here). Rather than
  // assuming a fixed causa/algoritmo split, `.first()` always lands on a
  // causa (the causa section renders first) and `.last()` always lands on
  // an algoritmo (the algoritmo section renders last) — valid regardless
  // of how many options either catalog has.
  const radios = page.getByRole('radio')
  await radios.first().click()
  await radios.last().click()

  await page.getByRole('button', { name: 'Continuar' }).click()
}

const selectFirstPlanStep = async (page: Page): Promise<void> => {
  await page.getByRole('radio').first().click()
  await page.getByRole('button', { name: 'Confirmar y crear paciente' }).click()
}

/**
 * Drives the full intake wizard: fills identity, picks the first
 * available causa/algoritmo/modalidad, and confirms. On success the app
 * redirects to `/asignar-contenido?paciente=<id>` — callers that only
 * need the created patient (e.g. the smoke spec) should navigate to
 * `/pacientes` afterwards to assert the row.
 */
const createPatientViaWizard = async (
  page: Page,
  seed: PatientSeed,
): Promise<void> => {
  await goToNuevoPaciente(page)
  await fillIdentidadStep(page, seed)
  await selectFirstDiagnosticoStep(page)
  await selectFirstPlanStep(page)
  await expect(page).toHaveURL(/\/asignar-contenido/)
}

export {
  goToNuevoPaciente,
  fillIdentidadStep,
  selectFirstDiagnosticoStep,
  selectFirstPlanStep,
  createPatientViaWizard,
}
