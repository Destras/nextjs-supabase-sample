'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ROLE, useCurrentUserProfile } from '@/app/controllers/Auth'
import {
  useBuscarFichaPorEmail,
  useCheckTelefonoEnOtraFicha,
  useFetchPacienteEditData,
  useUpdatePacienteIdentidad,
  useUpdateEtapaDiagnostico,
  useSetEtapaAlfabetos,
} from '@/app/controllers/Paciente'
import type {
  AlfabetoConNumeros,
  PacienteEditData,
  UpdatePacienteResult,
} from '@/app/controllers/Paciente'
import { useFetchAllDiagnosticos } from '@/app/controllers/Diagnostico'
import type { AllDiagnosticos } from '@/app/controllers/Diagnostico'
import { toggleIdInArray } from '@/app/pacientes/nuevo/controllers/utils/toggleIdInArray'
import {
  parseFechaNacimiento,
  formatFechaNacimiento,
  FECHA_NACIMIENTO_MIN_DATE,
  fechaNacimientoMaxDate,
} from '@/app/pacientes/nuevo/controllers/utils/fechaNacimientoCodec'
import type {
  FieldPath,
  FormStateShape,
} from '@/app/pacientes/nuevo/controllers/utils/validators'
import {
  FIELD_VALIDATORS,
  validateStep,
} from '@/app/pacientes/nuevo/controllers/utils/validators'
import {
  AVISO_TELEFONO_DUPLICADO,
  mapIdentidadRpcError,
  resolverEmailDuplicado,
} from '@/lib/identidadMessages'
import type { FichaDuplicada } from '@/lib/identidadMessages'
import { mapAlfabetosRpcError } from '@/lib/alfabetosMessages'
import { normalizarTelefonoAr, sinPrefijoAr } from '@/lib/telefonoAr'
import {
  useNavigationGuard,
  useUnsavedChangesGuard,
} from '@/components/navigation'
import type { PasoView } from '@/app/pacientes/nuevo/controllers/utils/pasos'
import { computePasos } from '@/app/pacientes/nuevo/controllers/utils/pasos'

interface IdentidadForm {
  readonly nombre: string
  readonly fechaNacimiento: string | null
  readonly email: string
  readonly telefono: string
}

interface DiagnosticoForm {
  readonly causaId: string | null
  readonly algoritmoId: string | null
  readonly modalidadId: string | null
  readonly bloqueoIds: ReadonlyArray<string>
  readonly alfabetos: ReadonlyArray<AlfabetoConNumeros>
}

// Qué guardado ofrece el footer en el paso actual (`null` = sin footer): datos en
// el paso 1, diagnóstico completo con la etapa fresca, y solo alfabetos en el
// paso 3 con el diagnóstico bloqueado (DEC-09).
type FooterAction = 'identidad' | 'diagnostico' | 'alfabetos'

interface EditarPacienteViewModel {
  readonly isLoading: boolean
  readonly loadError: string | null
  readonly notFound: boolean
  readonly catalogos: AllDiagnosticos | null
  readonly isLoadingCatalogos: boolean
  readonly catalogosError: string | null
  readonly paso: 1 | 2 | 3
  readonly pasos: ReadonlyArray<PasoView>
  readonly jumpToStep: (paso: 1 | 2 | 3) => void
  readonly identidad: IdentidadForm
  readonly identidadErrors: Readonly<Record<string, string>>
  readonly identidadDirty: boolean
  readonly isSavingIdentidad: boolean
  readonly identidadSaveError: string | null
  // La ficha propia que ya tiene el email (ADR 0010); la vista linkea su nombre.
  // `null` si el error no es un email duplicado, o si la ficha es ajena o de baja.
  readonly fichaDuplicada: FichaDuplicada | null
  readonly avisoTelefono: string | null
  // El paciente ya activó su cuenta: el email de la ficha no se puede cambiar
  // desde la edición (BETA-030). La vista deshabilita el campo y explica por qué.
  readonly emailBloqueado: boolean
  readonly setIdentidadField: (
    field: keyof IdentidadForm,
    value: string | null,
  ) => void
  readonly onBlurIdentidad: (path: string) => void
  readonly fechaNacimientoDate: Date | undefined
  readonly fechaNacimientoMin: Date
  readonly fechaNacimientoMax: Date
  readonly onSelectFechaNacimiento: (date: Date | null) => void
  readonly saveIdentidad: () => Promise<void>
  readonly etapaFresca: boolean
  readonly tieneEtapaActiva: boolean
  // Los alfabetos se corrigen siempre que haya etapa abierta, aun con el resto
  // del diagnóstico bloqueado (la vista no deduce la regla).
  readonly alfabetosEditables: boolean
  readonly diagnostico: DiagnosticoForm
  readonly diagnosticoErrors: Readonly<Record<string, string>>
  readonly diagnosticoDirty: boolean
  readonly isSavingDiagnostico: boolean
  readonly diagnosticoSaveError: string | null
  readonly setCausa: (id: string) => void
  readonly setAlgoritmo: (id: string) => void
  readonly toggleBloqueo: (id: string) => void
  readonly setModalidad: (id: string) => void
  readonly setAlfabetos: (next: ReadonlyArray<AlfabetoConNumeros>) => void
  readonly onBlurDiagnostico: (path: string) => void
  readonly saveDiagnostico: () => Promise<void>
  readonly isSavingAlfabetos: boolean
  readonly saveAlfabetos: () => Promise<void>
  readonly footerAction: FooterAction | null
  readonly cancel: () => void
}

const EMPTY_IDENTIDAD: IdentidadForm = {
  nombre: '',
  fechaNacimiento: null,
  email: '',
  telefono: '',
}

const EMPTY_DIAGNOSTICO: DiagnosticoForm = {
  causaId: null,
  algoritmoId: null,
  modalidadId: null,
  bloqueoIds: [],
  alfabetos: [],
}

// Maps the RPC error codes (raised by update_paciente_identidad /
// update_etapa_diagnostico) to user-facing Spanish messages. Map y no un objeto,
// por lo mismo que RPC_ERROR_MESSAGES en lib/identidadMessages: indexar un objeto
// con un código crudo devuelve lo que herede de Object.prototype (`constructor`,
// `toString`, …), que no es nullish y por lo tanto se cuela por el `??`.
const ERROR_MESSAGES = new Map<string, string>([
  ['no_autorizado', 'No tenés permiso para editar este paciente'],
  ['paciente_inexistente', 'No se encontró el paciente'],
  [
    'etapa_activa_no_encontrada',
    'El paciente no tiene una etapa de tratamiento activa',
  ],
  [
    'etapa_con_progreso',
    'No se puede corregir el diagnóstico: el tratamiento del paciente ya arrancó',
  ],
  ['modalidad_inexistente', 'La modalidad seleccionada no es válida'],
])

const friendlyError = (raw: string | null, fallback: string): string =>
  raw !== null
    ? (mapIdentidadRpcError(raw) ??
      mapAlfabetosRpcError(raw) ??
      ERROR_MESSAGES.get(raw) ??
      raw)
    : fallback

interface SectionSaveConfig {
  readonly isSubmitting: boolean
  readonly validate: () => Record<string, string>
  readonly setErrors: (errors: Record<string, string>) => void
  readonly setSaveError: (message: string | null) => void
  readonly submit: () => Promise<UpdatePacienteResult>
  // Solo la sección de identidad puede chocar con el email único: resuelve el
  // mensaje buscando la ficha que lo tiene. Sin él, `email_duplicado` cae al
  // genérico de friendlyError.
  readonly onEmailDuplicado?: () => Promise<string>
  readonly onSuccess: () => void
  readonly fallbackMsg: string
  readonly successMsg: string
  // Aviso de que la OTRA sección sigue con cambios sin guardar (BETA-019): va
  // como description del toast. `null` si la otra sección está limpia.
  readonly avisoOtraSeccion: string | null
}

// Shared skeleton for the two per-section saves (identidad / diagnóstico):
// dedup guard → validate → submit → (map error + toast) | (commit baseline +
// toast). Keeps the divergence to the per-section config, not copy-paste.
// Guardar no navega (BETA-019): la pantalla sigue abierta con la otra sección
// intacta; si el guardado falla, el form y el baseline no se tocan.
const runSectionSave = async (config: SectionSaveConfig): Promise<void> => {
  if (config.isSubmitting) return
  const errors = config.validate()
  if (Object.keys(errors).length > 0) {
    config.setErrors(errors)
    return
  }
  config.setErrors({})
  config.setSaveError(null)

  let result
  try {
    result = await config.submit()
  } catch (e) {
    const message = e instanceof Error ? e.message : config.fallbackMsg
    config.setSaveError(message)
    toast.error(message)
    return
  }

  if (result.error) {
    const message =
      result.error === 'email_duplicado' && config.onEmailDuplicado
        ? await config.onEmailDuplicado()
        : friendlyError(result.error, config.fallbackMsg)
    config.setSaveError(message)
    toast.error(message)
  } else {
    config.onSuccess()
    if (config.avisoOtraSeccion === null) {
      toast.success(config.successMsg)
    } else {
      toast.success(config.successMsg, {
        description: config.avisoOtraSeccion,
      })
    }
  }
}

const toIdentidadForm = (d: PacienteEditData['identidad']): IdentidadForm => ({
  nombre: d.nombre,
  fechaNacimiento: d.fechaNacimiento,
  email: d.email ?? '',
  // El campo muestra el '+54' como prefijo fijo (ACT-001), así que lo guardado en
  // forma canónica se hidrata sin él para no repetirlo.
  telefono: sinPrefijoAr(d.telefono ?? ''),
})

const toDiagnosticoForm = (
  d: PacienteEditData['diagnostico'],
): DiagnosticoForm => ({
  causaId: d.causaId,
  algoritmoId: d.algoritmoId,
  modalidadId: d.modalidadId,
  bloqueoIds: [...d.bloqueoIds],
  alfabetos: [...d.alfabetos],
})

const identidadEqual = (a: IdentidadForm, b: IdentidadForm): boolean =>
  a.nombre === b.nombre &&
  a.fechaNacimiento === b.fechaNacimiento &&
  a.email === b.email &&
  a.telefono === b.telefono

const sameIds = (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): boolean => {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

// Los `numeros` ya vienen ordenados de menor a mayor (agruparAlfabetos y
// setNumerosDeAlfabeto), así que se comparan posición a posición.
const sameAlfabetos = (
  a: ReadonlyArray<AlfabetoConNumeros>,
  b: ReadonlyArray<AlfabetoConNumeros>,
): boolean => {
  if (a.length !== b.length) return false
  const byId = (x: AlfabetoConNumeros, y: AlfabetoConNumeros): number =>
    x.alfabetoId.localeCompare(y.alfabetoId)
  const sa = [...a].sort(byId)
  const sb = [...b].sort(byId)
  return sa.every(
    (v, i) =>
      v.alfabetoId === sb[i].alfabetoId &&
      v.numeros.length === sb[i].numeros.length &&
      v.numeros.every((n, j) => n === sb[i].numeros[j]),
  )
}

const diagnosticoEqual = (a: DiagnosticoForm, b: DiagnosticoForm): boolean =>
  a.causaId === b.causaId &&
  a.algoritmoId === b.algoritmoId &&
  a.modalidadId === b.modalidadId &&
  sameIds(a.bloqueoIds, b.bloqueoIds) &&
  sameAlfabetos(a.alfabetos, b.alfabetos)

const resolverFooterAction = (
  paso: 1 | 2 | 3,
  etapaFresca: boolean,
  alfabetosEditables: boolean,
): FooterAction | null => {
  if (paso === 1) return 'identidad'
  if (etapaFresca) return 'diagnostico'
  if (paso === 3 && alfabetosEditables) return 'alfabetos'
  return null
}

const useEditarPacienteViewModel = (): EditarPacienteViewModel => {
  const params = useParams<{ id: string }>()
  const pacienteId = params.id
  const router = useRouter()
  const { guardNavigation } = useNavigationGuard()

  // Volvemos al detalle apuntando a la tab `camino`, NO al índice bare
  // `/pacientes/[id]` (que es un server component con `redirect()` a /camino):
  // seguir ese redirect durante una navegación client-side rompe el App Router
  // de Next 16 ("Cannot use 'in' ... headCacheNode in null") y deja el detalle
  // en blanco. Navegar directo a la tab evita el salto de redirect.
  const detailHref = `/pacientes/${pacienteId}/camino`

  const {
    data,
    isLoading,
    error: loadError,
  } = useFetchPacienteEditData(pacienteId ?? null)
  const {
    diagnosticos,
    isLoading: isLoadingCatalogos,
    error: catalogosError,
  } = useFetchAllDiagnosticos()
  const updateIdentidad = useUpdatePacienteIdentidad()
  const updateDiagnostico = useUpdateEtapaDiagnostico()
  const setAlfabetosMutation = useSetEtapaAlfabetos()
  const { check: checkTelefonoEnOtraFicha } = useCheckTelefonoEnOtraFicha()
  const { buscar: buscarFichaPorEmail } = useBuscarFichaPorEmail()
  // Un admin ve todas las fichas (RLS), así que el aviso de email duplicado se las
  // nombra siempre; mientras el perfil no resolvió se lo trata como terapeuta.
  const { profile } = useCurrentUserProfile()
  const veTodasLasFichas = profile?.role === ROLE.ADMIN

  const [identidad, setIdentidad] = useState<IdentidadForm>(EMPTY_IDENTIDAD)
  const [diagnostico, setDiagnostico] =
    useState<DiagnosticoForm>(EMPTY_DIAGNOSTICO)
  const [baselineIdentidad, setBaselineIdentidad] =
    useState<IdentidadForm>(EMPTY_IDENTIDAD)
  const [baselineDiagnostico, setBaselineDiagnostico] =
    useState<DiagnosticoForm>(EMPTY_DIAGNOSTICO)
  const [hydrated, setHydrated] = useState(false)
  const [paso, setPaso] = useState<1 | 2 | 3>(1)

  const [identidadErrors, setIdentidadErrors] = useState<
    Record<string, string>
  >({})
  const [diagnosticoErrors, setDiagnosticoErrors] = useState<
    Record<string, string>
  >({})
  const [identidadSaveError, setIdentidadSaveError] = useState<string | null>(
    null,
  )
  const [diagnosticoSaveError, setDiagnosticoSaveError] = useState<
    string | null
  >(null)
  const [fichaDuplicada, setFichaDuplicada] = useState<FichaDuplicada | null>(
    null,
  )
  const [avisoTelefono, setAvisoTelefono] = useState<string | null>(null)
  // Mirrors the latest typed telefono outside of the async `check(...)`
  // closure so the `.then` callback can tell a fresh response from a stale
  // one (the user kept typing while the RPC was in flight).
  const telefonoRef = useRef(identidad.telefono)

  // Runs the non-blocking duplicate check (Task 2.4) and, when the response
  // is still current for `telefonoRef`, publishes/clears the aviso. Shared by
  // the hydration effect (once, excluding the ficha's own id) and every blur
  // of a validation-clean phone.
  const checkTelefonoDuplicado = (telefono: string): void => {
    const trimmed = telefono.trim()
    const requested = normalizarTelefonoAr(trimmed)
    checkTelefonoEnOtraFicha(trimmed, pacienteId).then((result) => {
      if (result.error !== null) return
      const current = normalizarTelefonoAr(telefonoRef.current.trim())
      if (current !== requested) return
      setAvisoTelefono(result.enOtraFicha ? AVISO_TELEFONO_DUPLICADO : null)
    })
  }

  useEffect(() => {
    if (data && !hydrated) {
      const id = toIdentidadForm(data.identidad)
      const diag = toDiagnosticoForm(data.diagnostico)
      setIdentidad(id)
      setDiagnostico(diag)
      setBaselineIdentidad(id)
      setBaselineDiagnostico(diag)
      setHydrated(true)
      telefonoRef.current = id.telefono

      const telefonoShape: FormStateShape = {
        paso: 1,
        identidad: { ...id },
        diagnostico: { causaId: null, bloqueoIds: [], algoritmoId: null },
        plan: { modalidadId: null, alfabetos: [] },
      }
      if (FIELD_VALIDATORS['identidad.telefono'](telefonoShape) === null) {
        checkTelefonoDuplicado(id.telefono)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hidrata una sola vez por paciente: sumar checkTelefonoDuplicado/FIELD_VALIDATORS a las deps re-dispararía el chequeo en cada render
  }, [data, hydrated])

  // Re-hydrate when the route switches to a different paciente: the App Router
  // can reuse this component instance across [id] values, so resetting hydrated
  // lets the effect above run again once the new paciente's data arrives. The
  // fetch hook nulls `data` in the meantime, so we never hydrate stale data.
  useEffect(() => {
    setHydrated(false)
  }, [pacienteId])

  const etapaFresca = data?.etapaFresca ?? false
  const emailBloqueado = data?.tieneCuenta ?? false
  const tieneEtapaActiva = (data?.etapaId ?? null) !== null
  const alfabetosEditables = tieneEtapaActiva
  const notFound = !isLoading && loadError === null && data === null

  const toFormStateShape = (step: 1 | 2 | 3): FormStateShape => ({
    paso: step,
    identidad: {
      nombre: identidad.nombre,
      fechaNacimiento: identidad.fechaNacimiento,
      email: identidad.email,
      telefono: identidad.telefono,
    },
    diagnostico: {
      causaId: diagnostico.causaId,
      bloqueoIds: diagnostico.bloqueoIds,
      algoritmoId: diagnostico.algoritmoId,
    },
    plan: {
      modalidadId: diagnostico.modalidadId,
      alfabetos: diagnostico.alfabetos,
    },
  })

  // Navegación libre entre los 3 pasos (como tabs): los datos ya vienen
  // cargados, así que no hay gate de validación al moverse. La validación vive
  // en los saves por sección (saveIdentidad / saveDiagnostico).
  const jumpToStep = (target: 1 | 2 | 3): void => {
    setPaso(target)
  }

  const setIdentidadField = (
    field: keyof IdentidadForm,
    value: string | null,
  ): void => {
    // Con la cuenta activada el email no se edita (BETA-030): ignorar el cambio
    // deja el form igual al baseline, así la sección no queda sucia por un campo
    // que el RPC rechazaría (email_bloqueado_por_cuenta).
    if (field === 'email' && emailBloqueado) return
    if (field === 'telefono') {
      telefonoRef.current = value ?? ''
      setAvisoTelefono(null)
    }
    setIdentidad((prev) => ({ ...prev, [field]: value }))
  }

  const onBlurIdentidad = (path: string): void => {
    const validator = FIELD_VALIDATORS[path as FieldPath]
    const error = validator ? validator(toFormStateShape(1)) : null
    setIdentidadErrors((prev) => {
      const next = { ...prev }
      if (error === null) delete next[path]
      else next[path] = error
      return next
    })

    if (path === 'identidad.telefono' && error === null) {
      checkTelefonoDuplicado(identidad.telefono)
    }
  }

  const onSelectFechaNacimiento = (date: Date | null): void => {
    setIdentidad((prev) => ({
      ...prev,
      fechaNacimiento: formatFechaNacimiento(date),
    }))
  }

  const setCausa = (id: string): void => {
    setDiagnostico((prev) => ({ ...prev, causaId: id }))
  }

  const setAlgoritmo = (id: string): void => {
    setDiagnostico((prev) => ({ ...prev, algoritmoId: id }))
  }

  const setModalidad = (id: string): void => {
    setDiagnostico((prev) => ({ ...prev, modalidadId: id }))
  }

  const toggleBloqueo = (id: string): void => {
    setDiagnostico((prev) => ({
      ...prev,
      bloqueoIds: toggleIdInArray(prev.bloqueoIds, id),
    }))
  }

  const setAlfabetos = (next: ReadonlyArray<AlfabetoConNumeros>): void => {
    setDiagnostico((prev) => ({ ...prev, alfabetos: next }))
  }

  const onBlurDiagnostico = (path: string): void => {
    const validator = FIELD_VALIDATORS[path as FieldPath]
    const error = validator ? validator(toFormStateShape(2)) : null
    setDiagnosticoErrors((prev) => {
      const next = { ...prev }
      if (error === null) delete next[path]
      else next[path] = error
      return next
    })
  }

  const identidadDirty = useMemo(
    () => !identidadEqual(identidad, baselineIdentidad),
    [identidad, baselineIdentidad],
  )
  const diagnosticoDirty = useMemo(
    () => !diagnosticoEqual(diagnostico, baselineDiagnostico),
    [diagnostico, baselineDiagnostico],
  )

  // Guardar una sección no sale de la pantalla (BETA-019), así que cualquiera de
  // las dos puede quedar con cambios pendientes: salir por el shell, por "Volver
  // al detalle" o por el link de la ficha duplicada pide confirmación.
  useUnsavedChangesGuard(identidadDirty || diagnosticoDirty)

  const saveIdentidad = (): Promise<void> => {
    // Snapshot CRUDO del form al enviar: es el nuevo baseline si el guardado
    // sale bien. No el trimmeado — con espacios de más la sección quedaría sucia
    // contra un baseline que no es lo que hay en pantalla.
    const identidadEnviada = identidad
    const email = identidad.email.trim()
    return runSectionSave({
      isSubmitting: updateIdentidad.isSubmitting,
      validate: () => validateStep(1, toFormStateShape(1)),
      setErrors: setIdentidadErrors,
      // La ficha duplicada vive y muere con el error de la sección: cada intento
      // la limpia, y solo `onEmailDuplicado` la vuelve a publicar.
      setSaveError: (message) => {
        if (message === null) setFichaDuplicada(null)
        setIdentidadSaveError(message)
      },
      submit: () =>
        updateIdentidad.submit({
          pacienteId,
          nombre: identidad.nombre.trim(),
          fechaNacimiento: identidad.fechaNacimiento,
          email: email || null,
          telefono: identidad.telefono.trim() || null,
        }),
      // Excluye la ficha en edición: el choque es siempre con OTRA ficha (ADR 0010).
      onEmailDuplicado: async () => {
        const { ficha } = await buscarFichaPorEmail(email, pacienteId)
        const aviso = resolverEmailDuplicado(ficha, veTodasLasFichas)
        setFichaDuplicada(aviso.fichaDuplicada)
        return aviso.mensaje
      },
      onSuccess: () => setBaselineIdentidad(identidadEnviada),
      fallbackMsg: 'No se pudieron guardar los datos',
      successMsg: 'Datos actualizados',
      avisoOtraSeccion: diagnosticoDirty
        ? 'El diagnóstico todavía tiene cambios sin guardar.'
        : null,
    })
  }

  const saveDiagnostico = (): Promise<void> => {
    if (!etapaFresca) return Promise.resolve()
    const diagnosticoEnviado = diagnostico
    return runSectionSave({
      isSubmitting: updateDiagnostico.isSubmitting,
      validate: () => ({
        ...validateStep(2, toFormStateShape(2)),
        ...validateStep(3, toFormStateShape(3)),
      }),
      setErrors: setDiagnosticoErrors,
      setSaveError: setDiagnosticoSaveError,
      submit: () =>
        updateDiagnostico.submit({
          pacienteId,
          causaId: diagnostico.causaId!,
          algoritmoId: diagnostico.algoritmoId!,
          modalidadId: diagnostico.modalidadId!,
          bloqueoIds: diagnostico.bloqueoIds,
          alfabetos: diagnostico.alfabetos,
        }),
      onSuccess: () => setBaselineDiagnostico(diagnosticoEnviado),
      fallbackMsg: 'No se pudo guardar el diagnóstico',
      successMsg: 'Diagnóstico actualizado',
      avisoOtraSeccion: identidadDirty
        ? 'Los datos personales todavía tienen cambios sin guardar.'
        : null,
    })
  }

  // Con el diagnóstico bloqueado lo único que puede cambiar son los alfabetos,
  // así que `diagnosticoDirty` ya es "hay alfabetos sin guardar" (DEC-09).
  const saveAlfabetos = (): Promise<void> => {
    if (etapaFresca || !alfabetosEditables) return Promise.resolve()
    const diagnosticoEnviado = diagnostico
    return runSectionSave({
      isSubmitting: setAlfabetosMutation.isSubmitting,
      validate: () => ({}),
      setErrors: setDiagnosticoErrors,
      setSaveError: setDiagnosticoSaveError,
      submit: () =>
        setAlfabetosMutation.submit({
          pacienteId,
          alfabetos: diagnostico.alfabetos,
        }),
      onSuccess: () => setBaselineDiagnostico(diagnosticoEnviado),
      fallbackMsg: 'No se pudieron guardar los alfabetos. Intentá de nuevo.',
      successMsg: 'Alfabetos actualizados.',
      avisoOtraSeccion: identidadDirty
        ? 'Los datos personales todavía tienen cambios sin guardar.'
        : null,
    })
  }

  // Salir pasa por el guard del shell: con cambios sin guardar en cualquiera de
  // las dos secciones pide confirmación antes de volver a la ficha.
  const cancel = (): void => {
    guardNavigation(() => router.push(detailHref))
  }

  const fechaNacimientoDate = parseFechaNacimiento(identidad.fechaNacimiento)
  const fechaNacimientoMin = FECHA_NACIMIENTO_MIN_DATE
  const fechaNacimientoMax = useMemo(() => fechaNacimientoMaxDate(), [])

  // Never show the duplicado aviso on top of a current validation error on
  // the same field — a single derived read, so every code path that sets
  // `avisoTelefono` doesn't also have to remember to clear it here.
  const avisoTelefonoExpuesto = identidadErrors['identidad.telefono']
    ? null
    : avisoTelefono

  return {
    isLoading,
    loadError,
    notFound,
    catalogos: diagnosticos,
    isLoadingCatalogos,
    catalogosError,
    paso,
    // En edición todos los pasos están "completos" (datos pre-cargados): los
    // marcamos como done salvo el activo, para que el stepper los deje
    // clickeables y se pueda saltar libremente entre los 3.
    pasos: computePasos(paso).map((p) =>
      p.status === 'upcoming' ? { ...p, status: 'done' as const } : p,
    ),
    jumpToStep,
    identidad,
    identidadErrors,
    identidadDirty,
    isSavingIdentidad: updateIdentidad.isSubmitting,
    identidadSaveError,
    fichaDuplicada,
    avisoTelefono: avisoTelefonoExpuesto,
    emailBloqueado,
    setIdentidadField,
    onBlurIdentidad,
    fechaNacimientoDate,
    fechaNacimientoMin,
    fechaNacimientoMax,
    onSelectFechaNacimiento,
    saveIdentidad,
    etapaFresca,
    tieneEtapaActiva,
    alfabetosEditables,
    diagnostico,
    diagnosticoErrors,
    diagnosticoDirty,
    isSavingDiagnostico: updateDiagnostico.isSubmitting,
    diagnosticoSaveError,
    setCausa,
    setAlgoritmo,
    toggleBloqueo,
    setModalidad,
    setAlfabetos,
    onBlurDiagnostico,
    saveDiagnostico,
    isSavingAlfabetos: setAlfabetosMutation.isSubmitting,
    saveAlfabetos,
    footerAction: resolverFooterAction(paso, etapaFresca, alfabetosEditables),
    cancel,
  }
}

export type {
  EditarPacienteViewModel,
  IdentidadForm,
  DiagnosticoForm,
  FooterAction,
}
export { useEditarPacienteViewModel }
