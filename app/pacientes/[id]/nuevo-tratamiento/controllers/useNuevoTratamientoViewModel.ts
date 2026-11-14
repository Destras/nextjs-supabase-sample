'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { mapAlfabetosRpcError } from '@/lib/alfabetosMessages'
import { useFetchAllDiagnosticos } from '@/app/controllers/Diagnostico'
import type { AllDiagnosticos } from '@/app/controllers/Diagnostico'
import {
  hasEtapaActiva,
  useFetchPacienteById,
  useIniciarNuevaEtapa,
} from '@/app/controllers/Paciente'
import type { AlfabetoConNumeros } from '@/app/controllers/Paciente'
import {
  useNavigationGuard,
  useUnsavedChangesGuard,
} from '@/components/navigation'
import {
  withAlgoritmo,
  withAlfabetos,
  withBloqueoToggled,
  withCausa,
  withModalidad,
} from '@/app/pacientes/nuevo/controllers/utils/formStateTransitions'
import { formatAlfabetosResumen } from '@/app/pacientes/nuevo/controllers'
import { hayCambiosEnWizard } from '@/app/pacientes/nuevo/controllers/utils/hayCambiosEnWizard'
import type {
  PasoNumero,
  PasoStatus,
  PasoView,
} from '@/app/pacientes/nuevo/controllers/utils/pasos'
import type { FormStateShape } from '@/app/pacientes/nuevo/controllers/utils/validators'
import { validateStep } from '@/app/pacientes/nuevo/controllers/utils/validators'

interface FormStateDiagnostico {
  readonly causaId: string | null
  readonly bloqueoIds: ReadonlyArray<string>
  readonly algoritmoId: string | null
}

interface FormStatePlan {
  readonly modalidadId: string | null
  readonly alfabetos: ReadonlyArray<AlfabetoConNumeros>
}

interface FormState {
  readonly paso: PasoNumero
  readonly diagnostico: FormStateDiagnostico
  readonly plan: FormStatePlan
}

interface ConfirmationSummary {
  readonly nombreDisplay: string
  readonly edadDisplay: string
  readonly emailDisplay: string
  readonly causaNombre: string
  readonly algoritmoNombre: string
  readonly modalidadNombre: string
  readonly bloqueoCount: number
  readonly alfabetosDisplay: string
}

interface NuevoTratamientoViewModel {
  readonly isLoading: boolean
  readonly loadError: string | null
  readonly notFound: boolean
  readonly tieneEtapaActiva: boolean
  readonly detailHref: string
  readonly catalogos: AllDiagnosticos | null
  readonly formState: FormState
  readonly errores: Readonly<Record<string, string>>
  readonly isSubmitting: boolean
  readonly submitError: string | null
  readonly puedeAvanzar: boolean
  readonly pasos: ReadonlyArray<PasoView>
  readonly confirmationSummary: ConfirmationSummary
  readonly setCausa: (id: string) => void
  readonly toggleBloqueo: (id: string) => void
  readonly setAlgoritmo: (id: string) => void
  readonly setModalidad: (id: string) => void
  readonly setAlfabetos: (next: ReadonlyArray<AlfabetoConNumeros>) => void
  readonly goNext: () => void
  readonly goBack: () => void
  readonly jumpToStep: (paso: PasoNumero) => void
  readonly submit: () => Promise<void>
  readonly cancel: () => void
  readonly dismissSubmitError: () => void
}

// Local 2-step definition: this wizard is the alta wizard cropped to
// diagnóstico + plan (per DEC-23), so it does not reuse the 3-step
// `computePasos` from app/pacientes/nuevo (that one is hardcoded to
// Identidad/Diagnóstico/Plan and is covered by its own test suite). We only
// borrow the `PasoNumero`/`PasoStatus`/`PasoView` types so this stays
// structurally compatible with `WizardStepper`.
interface PasoDef {
  readonly n: PasoNumero
  readonly label: string
  readonly title: string
  readonly description: string
}

const PASOS_DEF: ReadonlyArray<PasoDef> = [
  {
    n: 1,
    label: 'PASO 01',
    title: 'Diagnóstico',
    description: 'Causa raíz, bloqueos, algoritmo',
  },
  {
    n: 2,
    label: 'PASO 02',
    title: 'Plan',
    description: 'Modalidad y alfabetos',
  },
]

const computePasos = (pasoActual: PasoNumero): ReadonlyArray<PasoView> =>
  PASOS_DEF.map((p) => ({
    ...p,
    status: (p.n < pasoActual
      ? 'done'
      : p.n === pasoActual
        ? 'active'
        : 'upcoming') as PasoStatus,
  }))

// The shared validators (`FIELD_VALIDATORS`/`validateStep`) operate over the
// alta wizard's `FormStateShape`, which requires an `identidad` block this
// flow does not collect (per DEC-23, there is no identity step here). None of
// the diagnostico/plan validators read `identidad`, so a fixed, always-valid
// stand-in lets us reuse the exact same validation rules without duplicating
// them. Our paso 1 (diagnóstico) maps to the shared wizard's paso 2; our
// paso 2 (plan) maps to the shared wizard's paso 3.
const DUMMY_IDENTIDAD: FormStateShape['identidad'] = {
  nombre: 'placeholder',
  fechaNacimiento: '2000-01-01',
  email: 'placeholder@example.com',
  telefono: '+5491155550070',
}

const toFormStateShape = (state: FormState): FormStateShape => ({
  paso: state.paso,
  identidad: DUMMY_IDENTIDAD,
  diagnostico: state.diagnostico,
  plan: state.plan,
})

const INITIAL_FORM_STATE: FormState = {
  paso: 1,
  diagnostico: {
    causaId: null,
    bloqueoIds: [],
    algoritmoId: null,
  },
  plan: {
    modalidadId: null,
    alfabetos: [],
  },
}

// --- Hook ---

const useNuevoTratamientoViewModel = (): NuevoTratamientoViewModel => {
  const params = useParams<{ id: string }>()
  const pacienteId = params.id
  const router = useRouter()

  // Same App Router workaround as `useEditarPacienteViewModel`: navigate to
  // the `camino` tab, not the bare `/pacientes/[id]` index (a server
  // component that `redirect()`s and breaks client-side navigation).
  const detailHref = `/pacientes/${pacienteId}/camino`

  const {
    diagnosticos,
    isLoading: isLoadingCatalogos,
    error: catalogosError,
  } = useFetchAllDiagnosticos()
  const {
    paciente,
    isLoading: isLoadingPaciente,
    error: pacienteError,
  } = useFetchPacienteById(pacienteId ?? null)
  const iniciarNuevaEtapa = useIniciarNuevaEtapa()

  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  // true desde que el tratamiento se inició: lo elegido ya está guardado, así
  // que salir (a Asignar contenido) no debe pedir confirmación.
  const [iniciado, setIniciado] = useState(false)

  // Cambios sin guardar (BETA-047): con algo elegido, salir por el shell o
  // por "Volver al detalle" pide confirmación.
  useUnsavedChangesGuard(
    !iniciado && hayCambiosEnWizard(formState, INITIAL_FORM_STATE),
  )
  const { guardNavigation } = useNavigationGuard()

  const isLoading = isLoadingCatalogos || isLoadingPaciente
  const loadError = catalogosError ?? pacienteError
  const notFound = !isLoading && loadError === null && paciente === null
  const tieneEtapaActiva = paciente !== null && hasEtapaActiva(paciente)

  const setCausa = (id: string): void => {
    setFormState((prev) => withCausa(prev, id))
  }

  const toggleBloqueo = (id: string): void => {
    setFormState((prev) => withBloqueoToggled(prev, id))
  }

  const setAlgoritmo = (id: string): void => {
    setFormState((prev) => withAlgoritmo(prev, id))
  }

  const setModalidad = (id: string): void => {
    setFormState((prev) => withModalidad(prev, id))
  }

  const setAlfabetos = (next: ReadonlyArray<AlfabetoConNumeros>): void => {
    setFormState((prev) => withAlfabetos(prev, next))
  }

  const goNext = (): void => {
    setFormState((prev) => {
      if (prev.paso !== 1) return prev
      const shapeErrors = validateStep(2, toFormStateShape(prev))
      if (Object.keys(shapeErrors).length > 0) {
        setErrores(shapeErrors)
        return prev
      }
      setErrores({})
      return { ...prev, paso: 2 }
    })
  }

  const goBack = (): void => {
    setFormState((prev) => (prev.paso === 2 ? { ...prev, paso: 1 } : prev))
  }

  const jumpToStep = (target: PasoNumero): void => {
    setFormState((prev) => {
      if (target >= prev.paso) return prev
      return { ...prev, paso: target }
    })
  }

  const submit = async (): Promise<void> => {
    if (iniciarNuevaEtapa.isSubmitting) return

    const shape = toFormStateShape(formState)
    const allErrors = {
      ...validateStep(2, shape),
      ...validateStep(3, shape),
    }

    if (Object.keys(allErrors).length > 0) {
      setErrores(allErrors)
      return
    }

    // The shared validators above already guarantee these three fields are
    // non-null (validateStep(2)/(3) fail otherwise), but their type is
    // `string | null` on FormState. Narrow explicitly instead of asserting
    // with `!` so a future validator regression fails loudly here rather
    // than silently passing `null` into the RPC payload.
    const { causaId, algoritmoId } = formState.diagnostico
    const { modalidadId } = formState.plan
    if (causaId === null || algoritmoId === null || modalidadId === null) {
      setSubmitError('No se pudo iniciar el tratamiento')
      return
    }

    setSubmitError(null)
    let result
    try {
      result = await iniciarNuevaEtapa.submit({
        pacienteId,
        causaId,
        algoritmoId,
        modalidadId,
        bloqueoIds: formState.diagnostico.bloqueoIds,
        alfabetos: formState.plan.alfabetos,
      })
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'No se pudo iniciar el tratamiento'
      setSubmitError(message)
      toast.error(message)
      return
    }

    if (result.etapaId) {
      setIniciado(true)
      toast.success('Tratamiento iniciado')
      router.push(`/asignar-contenido?paciente=${pacienteId}`)
    } else {
      const message =
        (result.error !== null ? mapAlfabetosRpcError(result.error) : null) ??
        result.error ??
        'No se pudo iniciar el tratamiento'
      setSubmitError(message)
      toast.error(message)
    }
  }

  const dismissSubmitError = (): void => setSubmitError(null)

  const cancel = (): void => {
    guardNavigation(() => router.push(detailHref))
  }

  const puedeAvanzar =
    Object.keys(
      validateStep(formState.paso === 1 ? 2 : 3, toFormStateShape(formState)),
    ).length === 0

  const pasos = computePasos(formState.paso)

  const confirmationSummary: ConfirmationSummary = (() => {
    const { diagnostico, plan } = formState
    const nombreDisplay = paciente?.nombre ?? '—'
    const edad = paciente?.generalInfo.edad ?? null
    const edadDisplay = edad === null ? '—' : String(edad)
    const emailDisplay = paciente?.generalInfo.email ?? ''
    const causaNombre =
      diagnosticos?.causa.find((c) => c.id === diagnostico.causaId)?.nombre ??
      '—'
    const algoritmoNombre =
      diagnosticos?.algoritmo.find((a) => a.id === diagnostico.algoritmoId)
        ?.nombre ?? '—'
    const modalidadNombre =
      diagnosticos?.modalidades.find((m) => m.id === plan.modalidadId)
        ?.nombre ?? '—'
    const alfabetosDisplay = formatAlfabetosResumen(
      plan.alfabetos,
      diagnosticos?.alfabetos ?? [],
      'Sin alfabetos',
    )
    return {
      nombreDisplay,
      edadDisplay,
      emailDisplay,
      causaNombre,
      algoritmoNombre,
      modalidadNombre,
      bloqueoCount: diagnostico.bloqueoIds.length,
      alfabetosDisplay,
    }
  })()

  return {
    isLoading,
    loadError,
    notFound,
    tieneEtapaActiva,
    detailHref,
    catalogos: diagnosticos,
    formState,
    errores,
    isSubmitting: iniciarNuevaEtapa.isSubmitting,
    submitError,
    puedeAvanzar,
    pasos,
    confirmationSummary,
    setCausa,
    toggleBloqueo,
    setAlgoritmo,
    setModalidad,
    setAlfabetos,
    goNext,
    goBack,
    jumpToStep,
    submit,
    cancel,
    dismissSubmitError,
  }
}

export type { NuevoTratamientoViewModel, FormState }
export { useNuevoTratamientoViewModel }
