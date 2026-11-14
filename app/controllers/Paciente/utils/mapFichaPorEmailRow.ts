import type { FichaPorEmail } from '../PacienteTypes'

interface FichaPorEmailRowRaw {
  readonly id: string
  readonly nombre: string
  readonly estados_paciente: { readonly codigo: string } | null
  readonly asignaciones_paciente: ReadonlyArray<{
    readonly fecha_hasta: string | null
  }>
}

const ESTADO_BAJA_VOLUNTARIA = 'baja_voluntaria'

const mapFichaPorEmailRow = (raw: FichaPorEmailRowRaw): FichaPorEmail => ({
  id: raw.id,
  nombre: raw.nombre,
  dadoDeBaja: raw.estados_paciente?.codigo === ESTADO_BAJA_VOLUNTARIA,
  // Mismo criterio que fetchPacienteById: el detalle solo abre si quien pregunta ve
  // una asignación abierta. Las RLS de `pacientes` no miran `fecha_hasta`, así que
  // una ficha con la asignación cerrada se encuentra pero ya no se puede abrir.
  accesible: raw.asignaciones_paciente.some((a) => a.fecha_hasta === null),
})

export type { FichaPorEmailRowRaw }
export { mapFichaPorEmailRow }
