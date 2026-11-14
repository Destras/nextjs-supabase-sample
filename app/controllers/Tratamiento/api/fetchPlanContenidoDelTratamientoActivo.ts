'use client'

import { createClient } from '@/lib/supabase/client'
import type {
  EtapaConEntregasRow,
  FrasesPorSemanaRawRow,
} from '../utils/mapEtapaToTratamientoConEntregas'
import { mapEtapaToTratamientoConEntregas } from '../utils/mapEtapaToTratamientoConEntregas'
import type { Tratamiento, FrasesPorSemana } from '../TratamientoTypes'

interface FetchPlanContenidoResult {
  readonly tratamiento: Tratamiento | null
  readonly semanasTotales: number | null
  readonly cantidadNiveles: number | null
  readonly frasesPorSemana: FrasesPorSemana
  readonly error: string | null
}

const fetchPlanContenidoDelTratamientoActivo = async (
  pacienteId: string,
): Promise<FetchPlanContenidoResult> => {
  const supabase = createClient()

  // The plan query and the frases RPC are independent (DEC-0-6): run them in
  // parallel. A failure of the frases RPC must never block the plan — video
  // and mantra are what unblocks the treatment, frases are derived/secondary.
  const [etapaResult, frasesResult] = await Promise.all([
    supabase
      .from('etapas_tratamiento')
      .select(
        `
      id, fecha_inicio, fecha_finalizacion, motivo_cierre, notas_diagnostico,
      estados_etapa!inner(codigo),
      causas!inner(id, codigo, nombre, definicion, emociones_esperadas, activo),
      algoritmos!inner(id, codigo, nombre, definicion, comportamiento, activo),
      etapa_bloqueos(bloqueos(id, codigo, nombre, descripcion, activo)),
      modalidades!inner(cantidad_niveles),
      entregas_plan(dia_offset, orden, contenido:contenidos(id, tipo, titulo, descripcion, recurso_ref, duracion_seg))
    `,
      )
      .eq('paciente_id', pacienteId)
      // Etapa ABIERTA = fecha_finalizacion is null. NUNCA el código de estado:
      // desde inicioTratamiento una etapa abierta puede estar `pendiente` (creada,
      // sin arrancar porque le falta el contenido) o `activa` (ya arrancó). Filtrar
      // por estado = 'activa' dejaría al asignador CIEGO justo a los pacientes a los
      // que hay que cargarles contenido — y sin contenido nunca arrancan. Círculo cerrado.
      .is('fecha_finalizacion', null)
      .maybeSingle(),
    supabase.rpc('get_frases_del_tratamiento_activo', {
      p_paciente_id: pacienteId,
    }),
  ])

  const { data, error } = etapaResult
  if (error !== null)
    return {
      tratamiento: null,
      semanasTotales: null,
      cantidadNiveles: null,
      frasesPorSemana: {},
      error: error.message,
    }
  if (data === null)
    return {
      tratamiento: null,
      semanasTotales: null,
      cantidadNiveles: null,
      frasesPorSemana: {},
      error: null,
    }

  // Degradation: an error (or null data) from the frases RPC never propagates —
  // it just means every semana merges frases: [] (see mapEtapaToTratamientoConEntregas).
  const frasesPorSemana: ReadonlyArray<FrasesPorSemanaRawRow> =
    frasesResult.error === null && frasesResult.data !== null
      ? (frasesResult.data as unknown as ReadonlyArray<FrasesPorSemanaRawRow>)
      : []

  const {
    tratamiento,
    semanasTotales,
    cantidadNiveles,
    frasesPorSemana: frasesPorSemanaMapeadas,
  } = mapEtapaToTratamientoConEntregas(
    data as unknown as EtapaConEntregasRow,
    frasesPorSemana,
  )
  return {
    tratamiento,
    semanasTotales,
    cantidadNiveles,
    frasesPorSemana: frasesPorSemanaMapeadas,
    error: null,
  }
}

export { fetchPlanContenidoDelTratamientoActivo }
export type { FetchPlanContenidoResult }
