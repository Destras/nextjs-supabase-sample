import type {
  CentroEnergetico,
  EstructuraPaciente,
  EtapaEstructura,
  Medicion,
  MedicionNoEditableMotivo,
  MomentoMedicion,
  ValorCentro,
} from '../TratamientoTypes'
import { EtapaStatus } from '../TratamientoTypes'

// ---------------------------------------------------------------------------
// Private raw jsonb shape — mirrors get_estructura_paciente's envelope
// (design part 1 §1.5) exactly. Never exported from the barrel (Rule 5).
// ---------------------------------------------------------------------------

interface CentroEnergeticoRaw {
  readonly id: string
  readonly codigo: string
  readonly nombre: string
  readonly etiqueta_paciente: string
  readonly orden: number
}

interface ValorCentroRaw {
  readonly centro_id: string
  readonly codigo: string
  readonly nombre: string
  readonly orden: number
  readonly activo: boolean
  readonly valor: number
}

interface MedicionRaw {
  readonly id: string
  readonly momento: string
  readonly estructura_general: number
  readonly registrada_en: string
  readonly registrada_por: {
    readonly id: string
    readonly nombre: string
  } | null
  readonly copiada_de: string | null
  readonly es_propia: boolean
  readonly editable: boolean
  readonly editable_motivo: string | null
  readonly valores: ReadonlyArray<ValorCentroRaw>
}

interface EtapaEstructuraRaw {
  readonly id: string
  readonly ordinal: number
  readonly fecha_inicio: string | null
  readonly fecha_finalizacion: string | null
  readonly estado: string
  readonly iniciada: boolean
  readonly mediciones: ReadonlyArray<MedicionRaw>
}

interface EstructuraPacienteRaw {
  readonly paciente_id: string
  readonly puede_medir: boolean
  readonly es_admin: boolean
  readonly centros_activos: ReadonlyArray<CentroEnergeticoRaw>
  readonly etapas: ReadonlyArray<EtapaEstructuraRaw>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const resolveEtapaStatus = (estado: string): EtapaStatus => {
  if (estado === 'pendiente') return EtapaStatus.PENDIENTE
  if (estado === 'activa') return EtapaStatus.EN_CURSO
  if (estado === 'finalizada') return EtapaStatus.FINALIZADA
  if (estado === 'abandonada') return EtapaStatus.ABANDONADA
  return EtapaStatus.EN_CURSO
}

// `apertura` and `cierre_automatico` never show a delta: apertura has no
// baseline by construction, and cierre_automatico is a COPY of the last real
// reading (design §1.4) — showing a delta there would imply a measurement
// that never happened.
const suppressesDelta = (momento: string): boolean =>
  momento === 'apertura' || momento === 'cierre_automatico'

const mapMediciones = (
  medicionesRaw: ReadonlyArray<MedicionRaw>,
  etapaId: string,
): ReadonlyArray<Medicion> =>
  medicionesRaw.map((raw, index) => {
    const previous = index > 0 ? medicionesRaw[index - 1] : null
    const suppress = previous === null || suppressesDelta(raw.momento)

    const deltaEstructura = suppress
      ? null
      : raw.estructura_general - previous!.estructura_general

    const valores: ReadonlyArray<ValorCentro> = raw.valores.map((v) => {
      const prevValor = suppress
        ? undefined
        : previous!.valores.find((pv) => pv.centro_id === v.centro_id)
      return {
        centroId: v.centro_id,
        codigo: v.codigo,
        nombre: v.nombre,
        orden: v.orden,
        activo: v.activo,
        valor: v.valor,
        delta: prevValor !== undefined ? v.valor - prevValor.valor : null,
      }
    })

    return {
      id: raw.id,
      etapaId,
      momento: raw.momento as MomentoMedicion,
      estructuraGeneral: raw.estructura_general,
      deltaEstructura,
      registradaEn: raw.registrada_en,
      autor: raw.registrada_por,
      copiadaDe: raw.copiada_de,
      esPropia: raw.es_propia,
      editable: raw.editable,
      motivoNoEditable: raw.editable_motivo as MedicionNoEditableMotivo | null,
      valores,
    }
  })

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

const mapEstructuraPaciente = (
  raw: EstructuraPacienteRaw,
): EstructuraPaciente => {
  const centrosActivos: ReadonlyArray<CentroEnergetico> =
    raw.centros_activos.map((c) => ({
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      etiquetaPaciente: c.etiqueta_paciente,
      orden: c.orden,
    }))

  const etapas: ReadonlyArray<EtapaEstructura> = raw.etapas.map((e) => {
    const mediciones = mapMediciones(e.mediciones, e.id)
    return {
      id: e.id,
      ordinal: e.ordinal,
      fechaInicio: e.fecha_inicio,
      fechaFin: e.fecha_finalizacion,
      estado: resolveEtapaStatus(e.estado),
      iniciada: e.iniciada,
      mediciones,
      medicionActual:
        mediciones.length > 0 ? mediciones[mediciones.length - 1] : null,
    }
  })

  return {
    pacienteId: raw.paciente_id,
    puedeMedir: raw.puede_medir,
    esAdmin: raw.es_admin,
    centrosActivos,
    etapas,
  }
}

export type { EstructuraPacienteRaw }
export { mapEstructuraPaciente }
