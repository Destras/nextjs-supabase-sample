import type {
  EstadoInicioTratamiento,
  Paciente,
} from '@/app/controllers/Paciente'
import { MES_LABEL } from '@/lib/clinicalLabels'

// Qué dice el encabezado de la ficha sobre el tratamiento (pulidoBeta /
// BETA-048). Un texto por estado de `inicioTratamiento`; los datos que no
// existen (modalidad, mes, semana cuando no hay etapa abierta) se omiten en
// vez de mostrarse como "—".

type DatosDelEncabezado = Pick<
  Paciente,
  | 'modalidadResumen'
  | 'mesActual'
  | 'mesesTotales'
  | 'semanaGlobal'
  | 'nivelFinalizado'
  | 'inicioTratamiento'
>

interface EncabezadoTratamiento {
  // null: no hay etapa abierta de la que mostrar la modalidad.
  readonly modalidad: string | null
  readonly estado: string
}

// En `Map`, no objeto literal (ver feedback de mapas de copy).
const ESTADO_LABEL: ReadonlyMap<EstadoInicioTratamiento, string> = new Map([
  ['sin_iniciar', 'Tratamiento sin iniciar'],
  ['en_curso', 'Tratamiento en curso'],
  ['finalizado', 'Tratamiento finalizado'],
  ['sin_tratamiento', 'Sin tratamiento'],
])

const SIN_TRATAMIENTO = 'Sin tratamiento'

const labelDe = (estado: EstadoInicioTratamiento): string =>
  ESTADO_LABEL.get(estado) ?? SIN_TRATAMIENTO

// "Mes de tratamiento 2/4 · Semana 5"; con todos los niveles cerrados y la
// etapa todavía abierta, "Mes de tratamiento 4/4 — Finalizado".
const progresoEnCurso = (paciente: DatosDelEncabezado): string => {
  const { mesActual, mesesTotales, semanaGlobal, nivelFinalizado } = paciente
  if (mesActual === null || mesesTotales === null) return labelDe('en_curso')

  const mes = `${MES_LABEL} ${mesActual}/${mesesTotales}`
  if (nivelFinalizado) return `${mes} — Finalizado`
  return semanaGlobal === null ? mes : `${mes} · Semana ${semanaGlobal}`
}

const encabezadoTratamiento = (
  paciente: DatosDelEncabezado,
): EncabezadoTratamiento => {
  const { estado } = paciente.inicioTratamiento
  return {
    modalidad: paciente.modalidadResumen,
    estado: estado === 'en_curso' ? progresoEnCurso(paciente) : labelDe(estado),
  }
}

// Título de la "Vista del camino" cuando no hay una etapa que dibujar.
const tituloSinEtapaAbierta = (estado: EstadoInicioTratamiento): string =>
  labelDe(estado)

export type { EncabezadoTratamiento }
export { encabezadoTratamiento, tituloSinEtapaAbierta }
