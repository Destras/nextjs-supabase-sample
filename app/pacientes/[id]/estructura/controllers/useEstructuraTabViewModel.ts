'use client'

import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import {
  useFetchEstructuraPaciente,
  useRegistrarMedicion,
  useEditarMedicion,
  validarValoresMedicion,
  serializeValoresMedicion,
  mapMedicionError,
  construirCampos,
} from '@/app/controllers/Tratamiento'
import type {
  CampoMedicion,
  EtapaEstructura,
  Medicion,
  MedicionRpcError,
  MomentoMedicion,
} from '@/app/controllers/Tratamiento'
import { mapCentroHistorico } from './utils/mapCentroHistorico'
import type { CentroHistorico } from './utils/mapCentroHistorico'

interface CentroRowVM {
  readonly centroId: string
  readonly nombre: string
  readonly valor: number
  readonly delta: number | null
}

interface Notice {
  readonly tone: 'info' | 'error' | 'ok'
  readonly texto: string
}

type ModoFormulario = 'cerrado' | 'crear' | 'editar'

interface EstructuraTabViewModel {
  // data
  readonly isLoading: boolean
  readonly error: string | null
  readonly puedeMedir: boolean
  readonly esAdminLectura: boolean
  readonly hayEtapas: boolean
  readonly etapaIniciada: boolean
  readonly etapaVigente: EtapaEstructura | null
  readonly medicionActual: Medicion | null
  readonly medicionPrevia: Medicion | null
  readonly serie: ReadonlyArray<{
    readonly fecha: string
    readonly valor: number
  }>
  readonly centros: ReadonlyArray<CentroRowVM>
  // drill-down (§9.9 — histórico completo, todas las etapas)
  readonly centroAbiertoId: string | null
  readonly centroDetalle: CentroHistorico | null
  readonly onToggleCentro: (centroId: string) => void
  // form
  readonly modoFormulario: ModoFormulario
  readonly campos: ReadonlyArray<CampoMedicion>
  readonly valores: Record<string, string>
  readonly errores: Record<string, string>
  readonly momentoPrevisto: MomentoMedicion
  readonly canSubmit: boolean
  readonly isSubmitting: boolean
  readonly onAbrirNueva: () => void
  readonly onAbrirEdicion: () => void
  readonly onChangeCampo: (key: string, value: string) => void
  readonly onCancelarFormulario: () => void
  // confirmación
  readonly confirmacionAbierta: boolean
  readonly onPedirConfirmacion: () => void
  readonly onConfirmar: () => Promise<void>
  readonly onCancelarConfirmacion: () => void
  // chrome
  readonly notices: ReadonlyArray<Notice>
  readonly onReintentar: () => void
  readonly medicionResaltadaId: string | null
}

// R7 (design §4.5) — el `useEstructuraTabViewModel` NUNCA reseeda `valores`
// desde `medicionActual` vía un efecto: la precarga sucede una única vez, en
// `onAbrirNueva`/`onAbrirEdicion`. `campos[].valorAnterior` (verdad del
// servidor, se refresca en el camino PT409 vía `refrescarHints`) y `valores`
// (lo tipeado, nunca se refresca) son estados distintos a propósito.
const useEstructuraTabViewModel = (): EstructuraTabViewModel => {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()

  const { data, isLoading, error, refresh } = useFetchEstructuraPaciente(
    params.id,
  )
  const registrar = useRegistrarMedicion()
  const editar = useEditarMedicion()

  const [modoFormulario, setModoFormulario] =
    useState<ModoFormulario>('cerrado')
  const [campos, setCampos] = useState<ReadonlyArray<CampoMedicion>>([])
  const [valores, setValores] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [confirmacionAbierta, setConfirmacionAbierta] = useState(false)
  const [centroAbiertoId, setCentroAbiertoId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const etapaVigente = useMemo<EtapaEstructura | null>(() => {
    if (data === null || data.etapas.length === 0) return null
    const abierta = data.etapas.find((e) => e.fechaFin === null)
    return abierta ?? data.etapas[data.etapas.length - 1]
  }, [data])

  const medicionActual = etapaVigente?.medicionActual ?? null
  const medicionPrevia = useMemo<Medicion | null>(() => {
    const mediciones = etapaVigente?.mediciones ?? []
    return mediciones.length > 1 ? mediciones[mediciones.length - 2] : null
  }, [etapaVigente])

  const serie = useMemo(
    () =>
      (etapaVigente?.mediciones ?? []).map((m) => ({
        fecha: m.registradaEn,
        valor: m.estructuraGeneral,
      })),
    [etapaVigente],
  )

  const centros = useMemo<ReadonlyArray<CentroRowVM>>(() => {
    if (medicionActual === null) return []
    return [...medicionActual.valores]
      .sort((a, b) => a.orden - b.orden)
      .map((v) => ({
        centroId: v.centroId,
        nombre: v.nombre,
        valor: v.valor,
        delta: v.delta,
      }))
  }, [medicionActual])

  const centroDetalle = useMemo<CentroHistorico | null>(() => {
    if (centroAbiertoId === null || data === null) return null
    return mapCentroHistorico(data.etapas, centroAbiertoId)
  }, [data, centroAbiertoId])

  const onToggleCentro = (centroId: string) =>
    setCentroAbiertoId((prev) => (prev === centroId ? null : centroId))

  const momentoPrevisto: MomentoMedicion =
    modoFormulario === 'editar'
      ? (medicionActual?.momento ?? 'seguimiento')
      : (etapaVigente?.mediciones.length ?? 0) === 0
        ? 'apertura'
        : 'seguimiento'

  const erroresCompletos = useMemo(
    () => validarValoresMedicion(valores, campos),
    [valores, campos],
  )
  // Sólo se muestran los errores de campos "tocados" (con al menos un
  // onChange) — MedicionForm no tiene estado propio (design §5.3), así que
  // el touch-tracking vive acá. canSubmit, en cambio, mira TODOS los errores
  // — el botón se deshabilita aunque el usuario no haya tocado un campo.
  const errores = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(erroresCompletos).filter(([key]) => touched[key]),
      ),
    [erroresCompletos, touched],
  )
  const canSubmit =
    campos.length > 0 && Object.keys(erroresCompletos).length === 0

  const isSubmitting =
    modoFormulario === 'editar' ? editar.isSubmitting : registrar.isSubmitting

  const abrirFormulario = (
    medicionBase: Medicion | null,
    modo: ModoFormulario,
  ) => {
    if (data === null) return
    const camposNuevos = construirCampos(data.centrosActivos, medicionBase)
    setCampos(camposNuevos)
    setValores(
      Object.fromEntries(
        camposNuevos.map((c) => [
          c.key,
          medicionBase === null ? '' : String(c.valorAnterior ?? ''),
        ]),
      ),
    )
    setTouched({})
    setNotice(null)
    setModoFormulario(modo)
  }

  // "Nueva medición": precarga con la medición actual (seguimiento) o vacío
  // (apertura, sin medicionActual) — DevSpec §7.2 intro copy.
  const onAbrirNueva = () => abrirFormulario(medicionActual, 'crear')

  // "Editar esta medición": precarga con los valores de la propia
  // medicionActual (§9.4 — sólo la última medición del autor es editable).
  const onAbrirEdicion = () => {
    if (medicionActual === null) return
    abrirFormulario(medicionActual, 'editar')
  }

  const onChangeCampo = (key: string, value: string) => {
    setValores((prev) => ({ ...prev, [key]: value }))
    setTouched((prev) => ({ ...prev, [key]: true }))
  }

  const onCancelarFormulario = () => {
    setModoFormulario('cerrado')
    setValores({})
    setTouched({})
    setCampos([])
  }

  const onPedirConfirmacion = () => {
    if (!canSubmit) return
    setConfirmacionAbierta(true)
  }
  const onCancelarConfirmacion = () => setConfirmacionAbierta(false)

  const successMessage = (): string => {
    if (modoFormulario === 'editar') return 'Medición actualizada.'
    return momentoPrevisto === 'apertura'
      ? 'Medición inicial registrada.'
      : 'Medición registrada.'
  }

  const handleMutationResult = (result: {
    readonly error: MedicionRpcError | null
  }): void => {
    setConfirmacionAbierta(false)

    if (result.error !== null) {
      const mapped = mapMedicionError(result.error)

      if (mapped.debeRefetchear) {
        // PT409 (design §4.5, paso a paso): conservar `valores` byte-for-
        // byte, mantener el form abierto, refrescar SOLO los hints de
        // `campos` (nunca `valores`) desde la nueva medicionActual.
        refresh()
        if (data !== null) {
          const nuevaBase =
            etapaVigente?.medicionActual ?? medicionActual ?? null
          setCampos(construirCampos(data.centrosActivos, nuevaBase))
        }
        setNotice({ tone: 'error', texto: mapped.mensaje })
        return
      }

      setNotice({ tone: 'error', texto: mapped.mensaje })
      return
    }

    setModoFormulario('cerrado')
    setValores({})
    setTouched({})
    setCampos([])
    setNotice({ tone: 'ok', texto: successMessage() })
    refresh()
  }

  const onConfirmar = async (): Promise<void> => {
    if (data === null || etapaVigente === null) return
    const wire = serializeValoresMedicion(valores, campos)

    if (modoFormulario === 'crear') {
      const result = await registrar.submit({
        etapaId: etapaVigente.id,
        valores: wire,
        medicionPreviaId: etapaVigente.medicionActual?.id ?? null,
      })
      handleMutationResult(result)
      return
    }

    if (modoFormulario === 'editar' && medicionActual !== null) {
      const result = await editar.submit({
        medicionId: medicionActual.id,
        valores: wire,
      })
      handleMutationResult(result)
    }
  }

  const puedeMedir = data?.puedeMedir ?? false
  const esAdminLectura = (data?.esAdmin ?? false) && !puedeMedir

  const notices = useMemo<ReadonlyArray<Notice>>(() => {
    const list: Notice[] = []
    if (notice !== null) list.push(notice)
    if (puedeMedir && medicionActual !== null && !medicionActual.esPropia) {
      list.push({
        tone: 'info',
        texto:
          'Esta medición la registró otro terapeuta. Podés registrar una nueva con tu lectura.',
      })
    }
    if (esAdminLectura) {
      list.push({
        tone: 'info',
        texto:
          'Vista de sólo lectura: como administrador podés consultar las mediciones, no registrarlas.',
      })
    }
    return list
  }, [notice, medicionActual, puedeMedir, esAdminLectura])

  return {
    isLoading,
    error,
    puedeMedir,
    esAdminLectura,
    hayEtapas: (data?.etapas.length ?? 0) > 0,
    etapaIniciada: etapaVigente?.iniciada ?? false,
    etapaVigente,
    medicionActual,
    medicionPrevia,
    serie,
    centros,
    centroAbiertoId,
    centroDetalle,
    onToggleCentro,
    modoFormulario,
    campos,
    valores,
    errores,
    momentoPrevisto,
    canSubmit,
    isSubmitting,
    onAbrirNueva,
    onAbrirEdicion,
    onChangeCampo,
    onCancelarFormulario,
    confirmacionAbierta,
    onPedirConfirmacion,
    onConfirmar,
    onCancelarConfirmacion,
    notices,
    onReintentar: refresh,
    medicionResaltadaId: searchParams.get('medicion'),
  }
}

export { useEstructuraTabViewModel }
export type { EstructuraTabViewModel, CentroRowVM, Notice, ModoFormulario }
