import type { AllDiagnosticos } from '../DiagnosticoTypes'

type Bloqueo = AllDiagnosticos['bloqueos'][number]

interface BloqueoRowRaw {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  activo: boolean
}

const mapBloqueoRow = (raw: BloqueoRowRaw): Bloqueo => ({
  id: raw.id,
  codigo: raw.codigo,
  nombre: raw.nombre,
  descripcion: raw.descripcion ?? '',
  activo: raw.activo,
})

export type { BloqueoRowRaw }
export { mapBloqueoRow }
