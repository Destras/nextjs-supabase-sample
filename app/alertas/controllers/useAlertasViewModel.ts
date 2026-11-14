'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  useFetchAlertasTerapeuta,
  useMarcarAlertaAtendida,
  ALERTA_TIPO,
} from '@/app/controllers/Alerta'
import type { Alerta, TipoAlerta } from '@/app/controllers/Alerta'
import { useAlertasCountValue } from '@/components/alertas'

// Orden del inbox: alta, luego media, luego baja (`reinicio` — aviso
// informativo, no un problema a resolver). Ni derive_alertas_activas() ni
// list_alertas_terapeuta ordenan el resultado (el `select` final no tiene
// `order by`), así que el desempate dentro de una misma prioridad es 100%
// responsabilidad del cliente. `compararAlertas` lo hace determinista y
// estable: prioridad → fecha desc (fechas null al final) → eventoRef asc como
// desempate final. Sin ese desempate el orden intra-prioridad queda a merced
// del plan de ejecución de Postgres y la UI "salta" entre lecturas (ALE-006).
const PRIORIDAD_ORDEN: Record<Alerta['prioridad'], number> = {
  alta: 0,
  media: 1,
  baja: 2,
}

// Comparador total y determinista de dos alertas para el orden del inbox.
const compararAlertas = (a: Alerta, b: Alerta): number => {
  const porPrioridad =
    PRIORIDAD_ORDEN[a.prioridad] - PRIORIDAD_ORDEN[b.prioridad]
  if (porPrioridad !== 0) return porPrioridad

  // fecha desc, con las fechas null empujadas al final.
  if (a.fecha !== b.fecha) {
    if (a.fecha === null) return 1
    if (b.fecha === null) return -1
    return a.fecha < b.fecha ? 1 : -1
  }

  // Desempate estable final: eventoRef asc (única clave siempre presente).
  if (a.eventoRef === b.eventoRef) return 0
  return a.eventoRef < b.eventoRef ? -1 : 1
}

type CountsPorTipo = Readonly<Partial<Record<ALERTA_TIPO, number>>>

// Clave del estado optimista `dismissed`. Refleja la identidad real de un
// dismissal en DB — `unique (tipo, evento_ref, paciente_id)` en
// `supabase/schemas/64_alertas_atendidas.sql` — para que dos alertas que
// compartan `eventoRef` (distinto tipo o paciente) no colisionen al marcarse.
const dismissKey = (alerta: Alerta): string =>
  `${alerta.tipo}:${alerta.eventoRef}:${alerta.pacienteId}`

interface AlertasViewModel {
  readonly alertas: ReadonlyArray<Alerta>
  readonly tipos: ReadonlyArray<TipoAlerta>
  readonly filtroTipo: ALERTA_TIPO | null
  readonly onFiltrar: (tipo: ALERTA_TIPO | null) => void
  readonly countsPorTipo: CountsPorTipo
  readonly onMarcar: (alerta: Alerta) => Promise<void>
  readonly isLoading: boolean
  readonly error: string | null
  readonly onOpenPaciente: (pacienteId: string, alerta?: Alerta) => void
}

// ViewModel page-local del inbox de alertas (mismo para terapeuta/admin, sin
// role-branch). Compone las entidades Alerta (Rule 5 — nunca llama a
// `supabase` directo). El count compartido (campana + badge del sidebar,
// AlertasCountProvider) se ajusta optimísticamente acá via `adjust()`: -1 al
// marcar, +1 si el RPC falla (rollback) o si el usuario deshace desde el
// toast. El estado local (`dismissed`) sigue siendo la fuente de verdad del
// inbox; `adjust()` solo mantiene sincronizado el número que ven la campana y
// el sidebar mientras el próximo fetch/focus/route-change no llegó.
const useAlertasViewModel = (): AlertasViewModel => {
  const router = useRouter()
  const { alertas, tipos, isLoading, error } = useFetchAlertasTerapeuta()
  const { marcar, desmarcar } = useMarcarAlertaAtendida()
  const { adjust } = useAlertasCountValue()

  const [filtroTipo, setFiltroTipo] = useState<ALERTA_TIPO | null>(null)
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())

  const onFiltrar = (tipo: ALERTA_TIPO | null): void => {
    setFiltroTipo(tipo)
  }

  const readdAlerta = (alerta: Alerta): void => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.delete(dismissKey(alerta))
      return next
    })
  }

  const removeAlerta = (alerta: Alerta): void => {
    setDismissed((prev) => new Set(prev).add(dismissKey(alerta)))
  }

  // Caseload visible del terapeuta menos lo optimísticamente marcado — base
  // tanto de `countsPorTipo` (conteo del caseload completo, sin el filtro de
  // tipo aplicado) como del orden/filtro que consume la View.
  const visibles = useMemo<ReadonlyArray<Alerta>>(
    () => alertas.filter((a) => !dismissed.has(dismissKey(a))),
    [alertas, dismissed],
  )

  const countsPorTipo = useMemo<CountsPorTipo>(() => {
    const counts: Partial<Record<ALERTA_TIPO, number>> = {}
    for (const a of visibles) {
      counts[a.tipo] = (counts[a.tipo] ?? 0) + 1
    }
    return counts
  }, [visibles])

  const ordenadas = useMemo<ReadonlyArray<Alerta>>(
    () => [...visibles].sort(compararAlertas),
    [visibles],
  )

  const filtradas = useMemo<ReadonlyArray<Alerta>>(() => {
    if (filtroTipo === null) return ordenadas
    return ordenadas.filter((a) => a.tipo === filtroTipo)
  }, [ordenadas, filtroTipo])

  const onMarcar = async (alerta: Alerta): Promise<void> => {
    removeAlerta(alerta)
    adjust(-1)

    const { error: marcarError } = await marcar(
      alerta.tipo,
      alerta.eventoRef,
      alerta.pacienteId,
    )

    if (marcarError) {
      readdAlerta(alerta)
      adjust(1)
      toast.error('No pudimos marcar la alerta. Intentá de nuevo.')
      return
    }

    toast('Alerta marcada como atendida.', {
      action: {
        label: 'Deshacer',
        onClick: () => {
          readdAlerta(alerta)
          adjust(1)
          desmarcar(alerta.tipo, alerta.eventoRef, alerta.pacienteId)
        },
      },
    })
  }

  // medicion_cierre_pendiente lleva directo al diálogo de finalización
  // (`?finalizar=1`, leído por TratamientoActions) en vez del tab Camino —
  // se apunta a `/camino` explícito (no a `/pacientes/${id}` bare) porque ese
  // bare route hace un `redirect()` server-side que no preserva el query
  // string.
  const onOpenPaciente = (pacienteId: string, alerta?: Alerta): void => {
    if (alerta?.tipo === ALERTA_TIPO.MEDICION_CIERRE_PENDIENTE) {
      router.push(`/pacientes/${pacienteId}/camino?finalizar=1`)
      return
    }
    router.push(`/pacientes/${pacienteId}/camino`)
  }

  return {
    alertas: filtradas,
    tipos,
    filtroTipo,
    onFiltrar,
    countsPorTipo,
    onMarcar,
    isLoading,
    error,
    onOpenPaciente,
  }
}

export type { AlertasViewModel }
export { useAlertasViewModel }
