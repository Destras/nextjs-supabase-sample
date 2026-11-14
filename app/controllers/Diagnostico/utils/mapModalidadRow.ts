import type { AllDiagnosticos } from '../DiagnosticoTypes'

type Modalidad = AllDiagnosticos['modalidades'][number]

interface ModalidadRowRaw {
  id: string
  codigo: string
  nombre: string
  cantidad_sesiones: number | null
  cantidad_niveles: number
  duracion_meses_estimada: number | null
  activo: boolean
  tipos_disco: { nombre: string } | null
}

const mapModalidadRow = (raw: ModalidadRowRaw): Modalidad => {
  const sesionesDisplay = raw.cantidad_sesiones ?? '—'
  return {
    id: raw.id,
    codigo: raw.codigo,
    nombre: raw.nombre,
    tipoDiscoNombre: raw.tipos_disco?.nombre ?? null,
    cantidadSesiones: raw.cantidad_sesiones,
    cantidadNiveles: raw.cantidad_niveles,
    duracionMesesEstimada: raw.duracion_meses_estimada,
    descripcionCorta: `${sesionesDisplay} discos · ${raw.cantidad_niveles} niveles`,
    activo: raw.activo,
  }
}

export type { ModalidadRowRaw }
export { mapModalidadRow }
