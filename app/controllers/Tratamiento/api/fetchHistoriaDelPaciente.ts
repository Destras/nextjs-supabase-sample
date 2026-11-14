'use client'

import { createClient } from '@/lib/supabase/client'
import type {
  EtapaHistoriaRaw,
  AsignacionRaw,
} from '../utils/mapEtapasToHistoria'
import { mapEtapasToHistoria } from '../utils/mapEtapasToHistoria'
import type { EtapaHistoria, CentroEnergetico } from '../TratamientoTypes'

// Fila cruda de la 3ra query (centros_energeticos), privada a este fetcher —
// tan trivial (1 rename, `etiqueta_paciente` -> `etiquetaPaciente`) que no
// amerita un util/mapper propio, mismo criterio que fetchTiposAlerta.ts
// (Alerta) para catálogos de 1:1 casi directo.
interface CentroEnergeticoRaw {
  readonly id: string
  readonly codigo: string
  readonly nombre: string
  readonly etiqueta_paciente: string
  readonly orden: number
}

const mapCentroEnergetico = (raw: CentroEnergeticoRaw): CentroEnergetico => ({
  id: raw.id,
  codigo: raw.codigo,
  nombre: raw.nombre,
  etiquetaPaciente: raw.etiqueta_paciente,
  orden: raw.orden,
})

interface FetchHistoriaResult {
  readonly etapas: ReadonlyArray<EtapaHistoria>
  readonly centros: ReadonlyArray<CentroEnergetico>
  readonly error: string | null
}

const fetchHistoriaDelPaciente = async (
  pacienteId: string,
): Promise<FetchHistoriaResult> => {
  const supabase = createClient()

  const [etapasResult, asignacionesResult, centrosResult] = await Promise.all([
    supabase
      .from('etapas_tratamiento')
      .select(
        `
        id, fecha_inicio, fecha_finalizacion, motivo_cierre, created_at,
        estados_etapa!inner(codigo),
        causas!inner(id, codigo, nombre, definicion, emociones_esperadas, activo),
        algoritmos!inner(id, codigo, nombre, definicion, comportamiento, activo),
        etapa_bloqueos(bloqueos(id, codigo, nombre, descripcion, activo)),
        etapa_alfabetos(numero, alfabetos(id, nombre, orden)),
        niveles(
          id, numero_nivel, fecha_seguimiento_esperada,
          nivel_evaluacion(id, score, fecha_respuesta)
        ),
        modalidades(nombre, cantidad_niveles, duracion_meses_estimada),
        mediciones_estructura(
          id, momento, estructura_general, registrada_en, registrada_por,
          profiles(nombre),
          medicion_valores(centro_id, valor)
        )
      `,
      )
      .eq('paciente_id', pacienteId)
      .order('fecha_inicio', { ascending: false }),

    supabase
      .from('asignaciones_paciente')
      .select(
        'id, terapeuta_id, fecha_desde, fecha_hasta, motivo, terapeutas(id, profiles(nombre))',
      )
      .eq('paciente_id', pacienteId)
      .order('fecha_desde', { ascending: true }),

    // Catálogo (RLS `using (true)`, design §4.4) — se trae aparte para que
    // el orden de filas de la matriz de Historia sea idéntico entre todas
    // las etapas de un capítulo; embeberlo por medición infla el payload y
    // permite que dos etapas discrepen en el orden.
    supabase
      .from('centros_energeticos')
      .select('id, codigo, nombre, etiqueta_paciente, orden')
      .order('orden'),
  ])

  if (etapasResult.error !== null) {
    return { etapas: [], centros: [], error: etapasResult.error.message }
  }
  if (asignacionesResult.error !== null) {
    return { etapas: [], centros: [], error: asignacionesResult.error.message }
  }
  if (centrosResult.error !== null) {
    return { etapas: [], centros: [], error: centrosResult.error.message }
  }

  const etapas = mapEtapasToHistoria(
    (etapasResult.data ?? []) as unknown as ReadonlyArray<EtapaHistoriaRaw>,
    (asignacionesResult.data ?? []) as unknown as ReadonlyArray<AsignacionRaw>,
  )

  const centros = (
    (centrosResult.data ?? []) as unknown as ReadonlyArray<CentroEnergeticoRaw>
  ).map(mapCentroEnergetico)

  return { etapas, centros, error: null }
}

export { fetchHistoriaDelPaciente }
export type { FetchHistoriaResult }
