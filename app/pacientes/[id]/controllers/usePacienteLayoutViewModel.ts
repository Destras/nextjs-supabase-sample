'use client'

import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  PACIENTE_STATE,
  avisoDeInicio,
  isBienvenidaPendiente,
  marcarAlertas,
  useFetchPacienteById,
  useIniciarTratamiento,
  useReenviarBienvenida,
} from '@/app/controllers/Paciente'
import type { AvisoDeInicio, Paciente } from '@/app/controllers/Paciente'
import {
  mapEntregasToSemanas,
  semanasConContenido as contarSemanasConContenido,
  useFetchPlanContenidoDelTratamientoActivo,
} from '@/app/controllers/Tratamiento'
import { useFetchAlertasTerapeuta } from '@/app/controllers/Alerta'
import { useAlertasCountValue } from '@/components/alertas'
import { mensajeDeInicio, mensajeDeReenvio } from './utils/mensajesDeLaFicha'
import type { TonoDeMensaje } from './utils/mensajesDeLaFicha'

interface PacienteLayoutViewModel {
  readonly paciente: Paciente | null
  readonly isLoading: boolean
  readonly error: string | null
  readonly refetch: () => void
  readonly puedeIniciar: boolean
  readonly isIniciarOpen: boolean
  readonly setIniciarOpen: (open: boolean) => void
  readonly semanasConContenido: number
  readonly totalSemanas: number
  readonly aviso: AvisoDeInicio
  readonly onIniciar: () => Promise<void>
  readonly isIniciando: boolean
  readonly bienvenidaPendiente: boolean
  readonly onReenviarBienvenida: () => Promise<void>
  readonly isReenviando: boolean
}

const TOAST_POR_TONO: Record<TonoDeMensaje, (texto: string) => void> = {
  info: toast.info,
  success: toast.success,
  warning: toast.warning,
  error: toast.error,
}

// `skip` lets the layout opt out of the paciente fetch on routes that render
// their own chrome (e.g. the /editar segment), avoiding a wasted fetch whose
// result the layout discards.
const usePacienteLayoutViewModel = (options?: {
  readonly skip?: boolean
}): PacienteLayoutViewModel => {
  const params = useParams<{ id: string }>()
  const {
    paciente: pacienteCrudo,
    isLoading,
    error,
    refetch: refetchPaciente,
  } = useFetchPacienteById(options?.skip ? null : params.id)

  // La etiqueta "alerta abierta" del header sale del motor de alertas (las
  // mismas de la bandeja, ya sin las atendidas), no del score. No se suma su
  // isLoading/error: la ficha no espera a las alertas; mientras cargan, o si
  // su fetch falla, queda sin marcar. No se saltea con `skip`: el hook no lo
  // soporta y list_alertas_terapeuta() ya escopea por auth.uid().
  const { alertas, refetch: refetchAlertas } = useFetchAlertasTerapeuta()
  const { refetch: refetchCount } = useAlertasCountValue()

  // Cerrar un tratamiento (o iniciar uno nuevo) apaga unas alertas y puede
  // encender otras, y deja al terapeuta en la misma pantalla: recargar solo al
  // paciente dejaba la etiqueta "alerta abierta" y la campana con el dato viejo
  // hasta recargar la página. Se reconcilia contra el servidor porque el delta
  // no se conoce de antemano.
  const refetch = useCallback((): void => {
    refetchPaciente()
    refetchAlertas()
    refetchCount()
  }, [refetchPaciente, refetchAlertas, refetchCount])

  const paciente = useMemo(
    () => (pacienteCrudo ? marcarAlertas([pacienteCrudo], alertas)[0] : null),
    [pacienteCrudo, alertas],
  )

  const [isIniciarOpen, setIniciarOpen] = useState(false)
  const { submit: iniciar, isSubmitting: isIniciando } = useIniciarTratamiento()
  const { reenviar, isSending: isReenviando } = useReenviarBienvenida()

  const puedeIniciar =
    paciente !== null &&
    paciente.sinIniciar &&
    paciente.state !== PACIENTE_STATE.BAJA
  const bienvenidaPendiente =
    paciente !== null && isBienvenidaPendiente(paciente)

  // El plan solo se pide mientras el tratamiento no arrancó (DEC-14): sirve
  // para contar las semanas con contenido en el diálogo de confirmación.
  const { tratamiento, semanasTotales: semanasDelPlan } =
    useFetchPlanContenidoDelTratamientoActivo(
      paciente?.sinIniciar ? paciente.id : null,
    )
  const totalSemanas = semanasDelPlan ?? paciente?.semanasTotales ?? 0
  const semanasConContenido = useMemo(
    () =>
      tratamiento === null
        ? 0
        : contarSemanasConContenido(
            mapEntregasToSemanas(tratamiento.entregasSemanales, totalSemanas),
          ),
    [tratamiento, totalSemanas],
  )

  const onIniciar = async (): Promise<void> => {
    if (paciente === null || paciente.etapaActivaId === null) return
    const resultado = await iniciar({
      etapaId: paciente.etapaActivaId,
      semanas: null,
    })
    const mensaje = mensajeDeInicio(resultado)
    TOAST_POR_TONO[mensaje.tono](mensaje.texto)
    setIniciarOpen(false)
    refetch()
  }

  const onReenviarBienvenida = async (): Promise<void> => {
    if (paciente === null) return
    const resultado = await reenviar(paciente.id)
    const mensaje = mensajeDeReenvio(resultado)
    TOAST_POR_TONO[mensaje.tono](mensaje.texto)
    refetch()
  }

  return {
    paciente,
    isLoading,
    error,
    refetch,
    puedeIniciar,
    isIniciarOpen,
    setIniciarOpen,
    semanasConContenido,
    totalSemanas,
    aviso: avisoDeInicio(
      paciente ?? { tieneCuenta: false, bienvenidaRecibida: false },
    ),
    onIniciar,
    isIniciando,
    bienvenidaPendiente,
    onReenviarBienvenida,
    isReenviando,
  }
}

export { usePacienteLayoutViewModel }
export type { PacienteLayoutViewModel }
