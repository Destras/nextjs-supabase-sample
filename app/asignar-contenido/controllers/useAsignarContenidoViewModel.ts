'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useCurrentUserId } from '@/app/controllers/Auth'
import {
  PACIENTE_STATE,
  avisoDeInicio as calcularAvisoDeInicio,
  semanaActual,
  useFetchPacientesByTerapeuta,
  useIniciarTratamiento,
} from '@/app/controllers/Paciente'
import type { AvisoDeInicio, Paciente } from '@/app/controllers/Paciente'
import {
  useFetchPlanContenidoDelTratamientoActivo,
  useSetEntregasPlan,
  mapEntregasToSemanas,
  semanasConContenido as contarSemanasConContenido,
  SLOT_DEFINITIONS,
} from '@/app/controllers/Tratamiento'
import type {
  SemanaContenido,
  FrasesPorSemana,
  SlotKey,
} from '@/app/controllers/Tratamiento'
import { useFetchAllContenido } from '@/app/controllers/Contenido'
import type { Contenido } from '@/app/controllers/Contenido'
import { useUnsavedChangesGuard } from '@/components/navigation'
import { esSemanaPasada as calcularEsSemanaPasada } from './utils/esSemanaPasada'
import { mensajeDeInicio } from './utils/mensajeDeInicio'
import { mensajeDeGuardado } from './utils/mensajeDeGuardado'
import type { TonoDeMensaje } from './utils/mensajeDeGuardado'

interface PacienteCtx {
  readonly modalidadResumen: string | null
  readonly mesActual: number | null
  readonly currentWeek: number | null
}

interface AsignarContenidoViewModel {
  // lists
  readonly pacientes: ReadonlyArray<Paciente>
  // Catalog options per slot, filtered by each slot's `source` tipo
  // (SLOT_DEFINITIONS, slotDefinitions.ts) — widened 2→5 keys in
  // new-media-types/PR4. Reading SLOT_DEFINITIONS directly (instead of
  // hardcoding a tipo check per key) avoids a 3rd copy of the slot map.
  readonly contenidosBySlot: Record<SlotKey, ReadonlyArray<Contenido>>
  // frases (frasesAutomaticas/epic-1, Task 1.2): derived/read-only, never a
  // catalog to choose from — indexed by número de semana so SemanaRow can look
  // up its own week's 3 phrases directly.
  readonly frasesPorSemana: FrasesPorSemana
  // selection
  readonly selectedPacienteId: string | null
  readonly onSelectPaciente: (id: string) => void
  // dirty-guard: patient switch pending confirmation
  readonly pendingPacienteId: string | null
  readonly confirmSwitchPaciente: () => void
  readonly cancelSwitchPaciente: () => void
  // plan
  readonly currentPlan: ReadonlyArray<SemanaContenido>
  readonly setSemana: (idx: number, slot: SlotKey, value: string | null) => void
  // dirty & save
  readonly isDirty: boolean
  readonly canSave: boolean
  readonly onSave: () => Promise<void>
  readonly isSaving: boolean
  readonly saveError: string | null
  // true only right after a successful save (until the next edit / patient switch)
  readonly justSaved: boolean
  // derived content count ("Contenido en N de M semanas")
  readonly semanasConContenido: number
  readonly totalSemanas: number
  // semana en curso del tratamiento (sin tope); null si todavía no empezó
  readonly semanaEnCurso: number | null
  // las semanas que ya pasaron quedan en solo lectura
  readonly esSemanaPasada: (semana: number) => boolean
  // iniciar tratamiento
  readonly puedeIniciar: boolean
  readonly isIniciarOpen: boolean
  readonly setIniciarOpen: (open: boolean) => void
  readonly avisoDeInicio: AvisoDeInicio
  readonly onIniciar: () => Promise<void>
  readonly isIniciando: boolean
  // context
  readonly weeks: number
  readonly etapaId: string | null
  readonly pacienteCtx: PacienteCtx | null
  readonly semanasPorNivel: number
  // loading / error
  readonly isInitialLoading: boolean
  readonly isPlanLoading: boolean
  readonly error: string | null
}

// ---------------------------------------------------------------------------
// ViewModel
// ---------------------------------------------------------------------------

const TOAST_POR_TONO: Record<TonoDeMensaje, (texto: string) => void> = {
  info: toast.info,
  success: toast.success,
  warning: toast.warning,
  error: toast.error,
}

const useAsignarContenidoViewModel = (): AsignarContenidoViewModel => {
  const searchParams = useSearchParams()
  const paramPacienteId = searchParams.get('paciente')

  // Auth
  const { userId: terapeutaId } = useCurrentUserId()

  // Entity hooks
  const {
    pacientes,
    isLoading: pacientesLoading,
    error: pacientesError,
    refresh: refreshPacientes,
  } = useFetchPacientesByTerapeuta(terapeutaId)

  const { contenidos, isLoading: contenidosLoading } = useFetchAllContenido()
  const { submit, isSubmitting } = useSetEntregasPlan()
  const { submit: iniciar, isSubmitting: isIniciando } = useIniciarTratamiento()

  // Derive catalogs per slot — memoized so their identity is stable across
  // re-renders that don't change the source catalog (e.g. every setSemana),
  // which keeps the options passed to the rows referentially stable. Built
  // from SLOT_DEFINITIONS (not a hardcoded per-key tipo check) so this stays
  // in sync with the 5-slot map by construction.
  const contenidosBySlot = useMemo(
    (): Record<SlotKey, ReadonlyArray<Contenido>> =>
      SLOT_DEFINITIONS.reduce(
        (acc, def) => ({
          ...acc,
          [def.key]: contenidos.filter((c) => c.tipo === def.source),
        }),
        {} as Record<SlotKey, ReadonlyArray<Contenido>>,
      ),
    [contenidos],
  )

  // Selected patient — initialized from query param or first in list
  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(
    paramPacienteId ?? null,
  )

  // Default to first paciente once loaded (only if no explicit selection)
  const defaultApplied = useRef(false)
  useEffect(() => {
    if (
      !defaultApplied.current &&
      selectedPacienteId === null &&
      pacientes.length > 0
    ) {
      defaultApplied.current = true
      setSelectedPacienteId(pacientes[0].id)
    }
  }, [pacientes, selectedPacienteId])

  // Plan read
  const {
    tratamiento,
    semanasTotales,
    cantidadNiveles,
    frasesPorSemana,
    isLoading: planLoading,
    error: planError,
    refresh,
  } = useFetchPlanContenidoDelTratamientoActivo(selectedPacienteId)

  const etapaId = tratamiento?.id ?? null
  const weeks = semanasTotales ?? 0

  // Track whether catalogs are ready — frases are no longer a catalog to load
  // (they come derived from the plan fetch itself, see frasesPorSemana above).
  const catalogsReady = !contenidosLoading

  // Single-patient draft (DEC-07): replaced on patient change
  const [draft, setDraft] = useState<ReadonlyArray<SemanaContenido>>([])
  const [isDirty, setIsDirty] = useState(false)
  // Unsaved-changes guard: leaving through the shell (sidebar, bell, logout,
  // "Volver a pacientes") asks for confirmation, and closing/reloading the tab
  // triggers the browser's own warning.
  useUnsavedChangesGuard(isDirty)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  // Dirty-guard: pending patient switch (DEC-10)
  const [pendingPacienteId, setPendingPacienteId] = useState<string | null>(
    null,
  )

  // Track last seeded patient+weeks to avoid re-seeding on unrelated re-renders
  const seededKey = useRef<string>('')

  // When patient or plan changes, always replace the draft.
  // When weeks === 0 (no active etapa), clear the draft to [].
  useEffect(() => {
    if (!selectedPacienteId || !catalogsReady) return

    if (weeks === 0) {
      // Patient has no active etapa — clear the draft so stale content is not shown
      const key = `${selectedPacienteId}:0:none`
      if (seededKey.current === key) return
      seededKey.current = key
      setDraft([])
      setIsDirty(false)
      return
    }

    const key = `${selectedPacienteId}:${weeks}:${etapaId ?? 'none'}`
    if (seededKey.current === key) return

    seededKey.current = key

    let seed: ReadonlyArray<SemanaContenido>
    if (tratamiento && tratamiento.entregasSemanales.length > 0) {
      seed = mapEntregasToSemanas(tratamiento.entregasSemanales, weeks)
    } else {
      // An empty plan is just every week with all slots null — exactly what
      // mapEntregasToSemanas produces for zero entregas.
      seed = mapEntregasToSemanas([], weeks)
    }

    setDraft(seed)
    setIsDirty(false)
  }, [selectedPacienteId, tratamiento, weeks, catalogsReady, etapaId])

  // DEC-09: tras un `semana_pasada` se recarga el plan y, cuando llega, se
  // repone en el borrador SOLO la semana rechazada con lo que dice el servidor.
  // El efecto de arriba no re-siembra (su clave no cambia con un refresh), así
  // que la reposición es explícita.
  const semanaARestaurar = useRef<number | null>(null)
  useEffect(() => {
    const semana = semanaARestaurar.current
    if (semana === null || !tratamiento || weeks === 0) return
    semanaARestaurar.current = null
    const delServidor = mapEntregasToSemanas(
      tratamiento.entregasSemanales,
      weeks,
    )[semana - 1]
    if (!delServidor) return
    setDraft((prev) => prev.map((s, i) => (i === semana - 1 ? delServidor : s)))
  }, [tratamiento, weeks])

  const currentPlan: ReadonlyArray<SemanaContenido> = draft

  // setSemana
  const setSemana = useCallback(
    (idx: number, slot: SlotKey, value: string | null) => {
      setDraft((prev) => {
        const plan = [...prev]
        const row = plan[idx]
        if (!row) return prev
        plan[idx] = { ...row, [slot]: value }
        return plan
      })
      setIsDirty(true)
      setJustSaved(false)
    },
    [],
  )

  // Internal: apply patient switch immediately (resets seededKey so next effect re-seeds)
  const applySwitch = useCallback((id: string) => {
    seededKey.current = ''
    setSelectedPacienteId(id)
    setIsDirty(false)
    setJustSaved(false)
  }, [])

  // onSelectPaciente — no-op if same patient; if dirty, hold as pending and wait for confirmation (DEC-10)
  const onSelectPaciente = useCallback(
    (id: string) => {
      if (id === selectedPacienteId) return
      if (isDirty) {
        setPendingPacienteId(id)
      } else {
        applySwitch(id)
      }
    },
    [isDirty, selectedPacienteId, applySwitch],
  )

  // Sync with the ?paciente query param when it CHANGES (e.g. the "Editar plan"
  // deep-link from another patient's content tab). useState only seeds the
  // initial value at mount, so a later param change would otherwise be ignored
  // and the selector would stay stuck on the first patient. Route the change
  // through onSelectPaciente so the dirty-guard (DEC-10) still applies.
  const lastSyncedParam = useRef<string | null>(paramPacienteId)
  useEffect(() => {
    if (paramPacienteId && paramPacienteId !== lastSyncedParam.current) {
      lastSyncedParam.current = paramPacienteId
      onSelectPaciente(paramPacienteId)
    }
  }, [paramPacienteId, onSelectPaciente])

  // confirmSwitchPaciente — user confirmed: discard draft and switch
  const confirmSwitchPaciente = useCallback(() => {
    if (pendingPacienteId !== null) {
      applySwitch(pendingPacienteId)
      setPendingPacienteId(null)
    }
  }, [pendingPacienteId, applySwitch])

  // cancelSwitchPaciente — user cancelled: keep current patient
  const cancelSwitchPaciente = useCallback(() => {
    setPendingPacienteId(null)
  }, [])

  const semanasConContenido = contarSemanasConContenido(currentPlan)
  const totalSemanas = weeks

  const selectedPaciente = pacientes.find((p) => p.id === selectedPacienteId)

  // DEC-10: semana en curso SIN tope (semanaGlobal topa en semanasTotales);
  // null mientras el tratamiento no empezó.
  const fechaInicio = selectedPaciente?.fechaInicioEtapaActiva ?? null
  const semanaEnCurso =
    fechaInicio === null ? null : semanaActual(fechaInicio, new Date())
  const esSemanaPasada = useCallback(
    (semana: number) => calcularEsSemanaPasada(semana, semanaEnCurso),
    [semanaEnCurso],
  )

  const sinIniciar = selectedPaciente?.sinIniciar ?? false

  // canSave: un plan parcial se guarda (planBorrador revierte DEC-05).
  const canSave = isDirty && !isSubmitting && catalogsReady

  // Synchronous re-entrancy guards: `isSubmitting` is async React state, so two
  // fast clicks in the same frame would both pass the disabled button.
  const savingRef = useRef(false)
  const iniciandoRef = useRef(false)

  const [isIniciarOpen, setIniciarOpen] = useState(false)

  const recargar = useCallback(() => {
    refresh()
    // La cabecera (mes, semana) y `sinIniciar` salen de la lista de pacientes
    // (BETA-046): se vuelve a pedir en segundo plano, sin tocar la selección.
    void refreshPacientes()
  }, [refresh, refreshPacientes])

  const onSave = useCallback(async () => {
    if (savingRef.current) return
    if (!selectedPacienteId || !etapaId) return

    savingRef.current = true
    setSaveError(null)
    try {
      const result = await submit(etapaId, draft)
      const mensaje = mensajeDeGuardado(result, sinIniciar)
      TOAST_POR_TONO[mensaje.tono](mensaje.texto)

      if (result.ok) {
        setIsDirty(false)
        setJustSaved(true)
      } else {
        setSaveError(result.error ?? 'Error al guardar el plan.')
        if (result.semanaPasada !== null) {
          semanaARestaurar.current = result.semanaPasada
        }
      }
      // Después de guardar y ante cualquier rechazo: la pantalla puede estar
      // vieja y lo importante lo protege la base.
      recargar()
    } finally {
      savingRef.current = false
    }
  }, [selectedPacienteId, etapaId, draft, submit, sinIniciar, recargar])

  const onIniciar = useCallback(async () => {
    if (iniciandoRef.current) return
    if (!selectedPacienteId || !etapaId) return

    iniciandoRef.current = true
    try {
      const result = await iniciar({
        etapaId,
        semanas: isDirty ? draft : null,
      })
      const mensaje = mensajeDeInicio(result)
      TOAST_POR_TONO[mensaje.tono](mensaje.texto)
      if (result.ok) {
        setIsDirty(false)
        setJustSaved(false)
        setIniciarOpen(false)
      }
      recargar()
    } finally {
      iniciandoRef.current = false
    }
  }, [selectedPacienteId, etapaId, isDirty, draft, iniciar, recargar])

  const puedeIniciar =
    sinIniciar &&
    selectedPaciente?.state !== PACIENTE_STATE.BAJA &&
    !isSubmitting &&
    !isIniciando

  const avisoDeInicio: AvisoDeInicio = selectedPaciente
    ? calcularAvisoDeInicio(selectedPaciente)
    : 'bienvenida'

  const pacienteCtx: PacienteCtx | null = selectedPaciente
    ? {
        modalidadResumen: selectedPaciente.modalidadResumen,
        mesActual: selectedPaciente.mesActual,
        // semanaGlobal represents the current global week in the treatment plan
        currentWeek: selectedPaciente.semanaGlobal ?? null,
      }
    : null

  // semanasPorNivel — guard against division by zero when cantidadNiveles is 0 or null
  const niveles = cantidadNiveles ?? 0
  const semanasPorNivel = niveles > 0 ? Math.ceil(weeks / niveles) : weeks

  // isInitialLoading: true only while pacientes list is loading (page skeleton gate)
  const isInitialLoading = pacientesLoading
  const error = pacientesError ?? planError

  return {
    pacientes,
    contenidosBySlot,
    frasesPorSemana,
    selectedPacienteId,
    onSelectPaciente,
    pendingPacienteId,
    confirmSwitchPaciente,
    cancelSwitchPaciente,
    currentPlan,
    setSemana,
    isDirty,
    canSave,
    onSave,
    isSaving: isSubmitting,
    saveError,
    justSaved,
    semanasConContenido,
    totalSemanas,
    semanaEnCurso,
    esSemanaPasada,
    puedeIniciar,
    isIniciarOpen,
    setIniciarOpen,
    avisoDeInicio,
    onIniciar,
    isIniciando,
    weeks,
    etapaId,
    pacienteCtx,
    semanasPorNivel,
    isInitialLoading,
    isPlanLoading: planLoading,
    error,
  }
}

export { useAsignarContenidoViewModel }
export type { AsignarContenidoViewModel, PacienteCtx }
