import type { AllDiagnosticos } from '../DiagnosticoTypes'

type Alfabeto = AllDiagnosticos['alfabetos'][number]

interface AlfabetoRowRaw {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  rango_max: number
  orden: number
  activo: boolean
}

const mapAlfabetoRow = (raw: AlfabetoRowRaw): Alfabeto => ({
  id: raw.id,
  codigo: raw.codigo,
  nombre: raw.nombre,
  descripcion: raw.descripcion,
  rangoMax: raw.rango_max,
  orden: raw.orden,
  activo: raw.activo,
})

export type { AlfabetoRowRaw }
export { mapAlfabetoRow }
