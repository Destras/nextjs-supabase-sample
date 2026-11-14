'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ROLE, useCurrentUserProfile } from '@/app/controllers/Auth'
import { useFetchAllDiagnosticos } from '@/app/controllers/Diagnostico'
import type { AllDiagnosticos } from '@/app/controllers/Diagnostico'
import {
  useBuscarFichaPorEmail,
  useCheckTelefonoEnOtraFicha,
  useRegisterPaciente,
} from '@/app/controllers/Paciente'
import type { AlfabetoConNumeros } from '@/app/controllers/Paciente'
import { computeEdad } from '@/app/controllers/Paciente/utils/computeEdad'
import {
  withCausa,
  withBloqueoToggled,
  withAlgoritmo,
  withModalidad,
  withAlfabetos,
} from './utils/formStateTransitions'
import { formatAlfabetosResumen } from './utils/alfabetoListUtils'
import {
  parseFechaNacimiento,
  formatFechaNacimiento,
  FECHA_NACIMIENTO_MIN_DATE,
  fechaNacimientoMaxDate,
} from './utils/fechaNacimientoCodec'
import { hayCambiosEnWizard } from './utils/hayCambiosEnWizard'
import type { PasoView } from './utils/pasos'
import { computePasos } from './utils/pasos'
import type { FieldPath } from './utils/validators'
import { FIELD_VALIDATORS, validateStep, isStepValid } from './utils/validators'
import {
  mapIdentidadRpcError,
  resolverEmailDuplicado,
  AVISO_TELEFONO_DUPLICADO,
} from '@/lib/identidadMessages'
import { mapAlfabetosRpcError } from '@/lib/alfabetosMessages'
import type { FichaDuplicada } from '@/lib/identidadMessages'
import { normalizarTelefonoAr } from '@/lib/telefonoAr'
import {
  useNavigationGuard,
  useUnsavedChangesGuard,
} from '@/components/navigation'

interface FormStateIdentidad {
  readonly nombre: string
  readonly fechaNacimiento: string | null
  readonly email: string
  readonly telefono: string
}

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
  readonly paso: 1 | 2 | 3
  readonly identidad: FormStateIdentidad
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

interface NuevoPacienteViewModel {
  readonly formState: FormState
  readonly errores: Readonly<Record<string, string>>
  readonly catalogos: AllDiagnosticos | null
  readonly isLoadingCatalogos: boolean
  readonly catalogosError: string | null
  readonly isSubmitting: boolean
  readonly submitError: string | null
  // La ficha propia que ya tiene el email (ADR 0010); la vista la usa para linkear
  // el nombre. `null` si el error no es un email duplicado o la ficha es ajena.
  readonly fichaDuplicada: FichaDuplicada | null
  readonly puedeAvanzar: boolean
  readonly pasos: ReadonlyArray<PasoView>
  readonly confirmationSummary: ConfirmationSummary
  readonly avisoTelefono: string | null
  readonly setIdentidadField: (
    field: keyof FormStateIdentidad,
    value: string | null,
  ) => void
  readonly fechaNacimientoDate: Date | undefined
  readonly fechaNacimientoMin: Date
  readonly fechaNacimientoMax: Date
  readonly onSelectFechaNacimiento: (date: Date | null) => void
  readonly setCausa: (id: string) => void
  readonly toggleBloqueo: (id: string) => void
  readonly setAlgoritmo: (id: string) => void
  readonly setModalidad: (id: string) => void
  readonly setAlfabetos: (next: ReadonlyArray<AlfabetoConNumeros>) => void
  readonly onBlurField: (path: string) => void
  readonly goNext: () => void
  readonly goBack: () => void
  readonly jumpToStep: (paso: 1 | 2 | 3) => void
  readonly submit: () => Promise<void>
  readonly cancel: () => void
  readonly dismissSubmitError: () => void
}

const INITIAL_FORM_STATE: FormState = {
  paso: 1,
  identidad: {
    nombre: '',
    fechaNacimiento: null,
    email: '',
    telefono: '',
  },
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

const useNuevoPacienteViewModel = (): NuevoPacienteViewModel => {
  const router = useRouter()
  const {
    diagnosticos,
    isLoading: isLoadingCatalogos,
    error: catalogosError,
  } = useFetchAllDiagnosticos()
  const register = useRegisterPaciente()
  const { check: checkTelefonoEnOtraFicha } = useCheckTelefonoEnOtraFicha()
  const { buscar: buscarFichaPorEmail } = useBuscarFichaPorEmail()
  // Un admin ve todas las fichas (RLS), así que el aviso de email duplicado se las
  // nombra siempre; mientras el perfil no resolvió se lo trata como terapeuta.
  const { profile } = useCurrentUserProfile()
  const veTodasLasFichas = profile?.role === ROLE.ADMIN

  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE)
  // Cambios sin guardar (BETA-047): con algo cargado, salir por el shell o
  // por "Cancelar" pide confirmación. Tras un alta exitosa el formulario
  // vuelve al estado inicial, así que ir a Asignar contenido no pregunta.
  useUnsavedChangesGuard(hayCambiosEnWizard(formState, INITIAL_FORM_STATE))
  const { guardNavigation } = useNavigationGuard()

  const [errores, setErrores] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fichaDuplicada, setFichaDuplicada] = useState<FichaDuplicada | null>(
    null,
  )
  const [avisoTelefono, setAvisoTelefono] = useState<string | null>(null)
  // Mirrors the latest typed telefono outside of the async `check(...)`
  // closure so the `.then` callback can tell a fresh response from a stale
  // one (the user kept typing while the RPC was in flight).
  const telefonoRef = useRef(formState.identidad.telefono)

  const setIdentidadField = (
    field: keyof FormStateIdentidad,
    value: string | null,
  ): void => {
    if (field === 'telefono') {
      telefonoRef.current = value ?? ''
      setAvisoTelefono(null)
    }
    setFormState((prev) => ({
      ...prev,
      identidad: {
        ...prev.identidad,
        [field]: value,
      },
    }))
  }

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

  const onBlurField = (path: string): void => {
    const validator = FIELD_VALIDATORS[path as FieldPath]
    const error = validator ? validator(formState) : null

    setErrores((prevErrors) => {
      if (error === null) {
        const next = { ...prevErrors }
        delete next[path]
        return next
      }
      return { ...prevErrors, [path]: error }
    })

    if (path === 'identidad.telefono' && error === null) {
      const telefono = formState.identidad.telefono.trim()
      const requested = normalizarTelefonoAr(telefono)
      checkTelefonoEnOtraFicha(telefono, null).then((result) => {
        if (result.error !== null) return
        // The response may belong to a phone the therapist has since edited
        // past (blur fired, then more typing happened before the RPC
        // returned) — only the still-current request gets to set the aviso.
        const current = normalizarTelefonoAr(telefonoRef.current.trim())
        if (current !== requested) return
        setAvisoTelefono(result.enOtraFicha ? AVISO_TELEFONO_DUPLICADO : null)
      })
    }
  }

  const goNext = (): void => {
    setFormState((prev) => {
      if (prev.paso === 1 || prev.paso === 2) {
        const errors = validateStep(prev.paso, prev)
        if (Object.keys(errors).length > 0) {
          setErrores(errors)
          return prev
        }
        setErrores({})
        return { ...prev, paso: (prev.paso + 1) as 1 | 2 | 3 }
      }
      return prev
    })
  }

  const goBack = (): void => {
    setFormState((prev) => {
      if (prev.paso === 2) return { ...prev, paso: 1 }
      if (prev.paso === 3) return { ...prev, paso: 2 }
      return prev
    })
  }

  const jumpToStep = (target: 1 | 2 | 3): void => {
    setFormState((prev) => {
      if (target >= prev.paso) return prev
      return { ...prev, paso: target }
    })
  }

  // Único punto de salida del camino de error del alta: traduce el código crudo y,
  // si es un email duplicado, busca la ficha que lo tiene con la sesión del
  // terapeuta (ADR 0010) — las RLS deciden si la puede nombrar.
  const reportarErrorDeAlta = async (
    raw: string | null,
    email: string,
  ): Promise<void> => {
    if (raw === 'email_duplicado') {
      const { ficha } = await buscarFichaPorEmail(email, null)
      const aviso = resolverEmailDuplicado(ficha, veTodasLasFichas)
      setFichaDuplicada(aviso.fichaDuplicada)
      setSubmitError(aviso.mensaje)
      toast.error(aviso.mensaje)
      return
    }
    const message =
      (raw !== null
        ? (mapIdentidadRpcError(raw) ?? mapAlfabetosRpcError(raw))
        : null) ??
      raw ??
      'No se pudo cargar el paciente'
    setSubmitError(message)
    toast.error(message)
  }

  const submit = async (): Promise<void> => {
    // VM-side guard: suppress duplicate toast/router.push side effects on
    // re-entry. The hook's ref-lock prevents a duplicate RPC; this guard
    // prevents duplicate UI side effects when the same in-flight promise
    // resolves for callers that didn't share the in-flight state.
    if (register.isSubmitting) return

    const allErrors = {
      ...validateStep(1, formState),
      ...validateStep(2, formState),
      ...validateStep(3, formState),
    }

    if (Object.keys(allErrors).length > 0) {
      setErrores(allErrors)
      return
    }

    setSubmitError(null)
    setFichaDuplicada(null)
    const email = formState.identidad.email.trim()
    let result
    try {
      result = await register.submit({
        nombre: formState.identidad.nombre.trim(),
        fechaNacimiento: formState.identidad.fechaNacimiento,
        email,
        telefono: formState.identidad.telefono.trim(),
        causaId: formState.diagnostico.causaId!,
        algoritmoId: formState.diagnostico.algoritmoId!,
        modalidadId: formState.plan.modalidadId!,
        bloqueoIds: formState.diagnostico.bloqueoIds,
        alfabetos: formState.plan.alfabetos,
      })
    } catch (e) {
      await reportarErrorDeAlta(e instanceof Error ? e.message : null, email)
      return
    }

    if (result.pacienteId) {
      // Reset wizard state BEFORE navigating so the next `/pacientes/nuevo`
      // visit starts clean (PAC-004). React 18 + App Router may reuse the
      // component instance between redirect-and-back, so useState defaults
      // are not enough — we have to wipe explicitly on success.
      setFormState(INITIAL_FORM_STATE)
      setErrores({})
      setSubmitError(null)
      toast.success('Paciente cargado')
      router.push(`/asignar-contenido?paciente=${result.pacienteId}`)
    } else {
      await reportarErrorDeAlta(result.error, email)
    }
  }

  const dismissSubmitError = (): void => {
    setSubmitError(null)
    setFichaDuplicada(null)
  }

  const cancel = (): void => {
    guardNavigation(() => router.push('/pacientes'))
  }

  const puedeAvanzar = isStepValid(formState.paso, formState)

  const pasos = computePasos(formState.paso)

  const fechaNacimientoDate = parseFechaNacimiento(
    formState.identidad.fechaNacimiento,
  )
  const fechaNacimientoMin = FECHA_NACIMIENTO_MIN_DATE
  // Stable across renders so the Calendar atom does not see a new identity
  // on every keystroke in the parent form.
  const fechaNacimientoMax = useMemo(() => fechaNacimientoMaxDate(), [])
  const onSelectFechaNacimiento = useCallback((date: Date | null): void => {
    setFormState((prev) => ({
      ...prev,
      identidad: {
        ...prev.identidad,
        fechaNacimiento: formatFechaNacimiento(date),
      },
    }))
  }, [])

  const confirmationSummary: ConfirmationSummary = (() => {
    const { identidad, diagnostico, plan } = formState
    const nombreDisplay = identidad.nombre.trim() || 'Nuevo paciente'
    const edad = computeEdad(identidad.fechaNacimiento)
    const edadDisplay = edad === null ? '—' : String(edad)
    const emailDisplay = identidad.email.trim()
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

  // Never show the duplicado aviso on top of a current validation error on
  // the same field — a single derived read, so every code path that sets
  // `avisoTelefono` doesn't also have to remember to clear it here.
  const avisoTelefonoExpuesto = errores['identidad.telefono']
    ? null
    : avisoTelefono

  return {
    formState,
    errores,
    catalogos: diagnosticos,
    isLoadingCatalogos,
    catalogosError,
    isSubmitting: register.isSubmitting,
    submitError,
    fichaDuplicada,
    dismissSubmitError,
    puedeAvanzar,
    pasos,
    confirmationSummary,
    avisoTelefono: avisoTelefonoExpuesto,
    setIdentidadField,
    fechaNacimientoDate,
    fechaNacimientoMin,
    fechaNacimientoMax,
    onSelectFechaNacimiento,
    setCausa,
    toggleBloqueo,
    setAlgoritmo,
    setModalidad,
    setAlfabetos,
    onBlurField,
    goNext,
    goBack,
    jumpToStep,
    submit,
    cancel,
  }
}

export type { NuevoPacienteViewModel, FormState }
export { useNuevoPacienteViewModel }
