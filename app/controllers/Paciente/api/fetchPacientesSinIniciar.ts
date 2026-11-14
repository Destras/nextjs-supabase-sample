'use client'

import { createClient } from '@/lib/supabase/client'
import type { PacienteSinIniciar } from '../PacienteTypes'

interface EtapaRaw {
  fecha_finalizacion: string | null
  fecha_inicio: string | null
}

interface AsignacionRaw {
  pacientes: {
    id: string
    nombre: string
    etapas_tratamiento: EtapaRaw[]
  } | null
}

// Pacientes activos del terapeuta cuya etapa activa (sin fecha_finalizacion)
// todavía no arrancó (fecha_inicio null) — per DEC-6c. No pregunta más "¿tiene
// cero entregas?": esa era la mejor aproximación disponible antes de que
// `fecha_inicio` existiera como nullable, y colaba dos falsos: un plan a medio
// cargar (10/16 semanas, sí tiene entregas, no arrancó) quedaba invisible, y un
// paciente que arrancó y después le borraron el plan (cero entregas, sí
// arrancó) aparecía como si necesitara onboarding. Fetch dedicado del
// dashboard: no pasa por mapAsignacionToPaciente ni toca el agregado
// Paciente. Un paciente sin etapa activa no aplica (no está en tratamiento en
// curso).
const fetchPacientesSinIniciar = async (
  terapeutaId: string,
): Promise<{ data: PacienteSinIniciar[] | null; error: Error | null }> => {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('asignaciones_paciente')
    .select(
      `pacientes ( id, nombre, etapas_tratamiento ( fecha_finalizacion, fecha_inicio ) )`,
    )
    .eq('terapeuta_id', terapeutaId)
    .is('fecha_hasta', null)

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  const sinIniciar = ((data as unknown as AsignacionRaw[]) ?? [])
    .map((row) => row.pacientes)
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .filter((p) => {
      const etapaActiva = (p.etapas_tratamiento ?? []).find(
        (e) => e.fecha_finalizacion === null,
      )
      return etapaActiva != null && etapaActiva.fecha_inicio === null
    })
    .map((p) => ({ id: p.id, nombre: p.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  return { data: sinIniciar, error: null }
}

export { fetchPacientesSinIniciar }
