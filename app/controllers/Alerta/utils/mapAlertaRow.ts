import type { Alerta, AlertaPrioridad, TipoAlerta } from '../AlertaTypes'
import { ALERTA_TIPO } from '../AlertaTypes'

// Forma cruda de una fila devuelta por derive_alertas_activas() (RPC interna
// del motor de alertas, ver supabase/schemas/65_alertas.sql). Privado a esta
// entidad — no se re-exporta desde index.ts (Rule 5).
interface AlertaRow {
  paciente_id: string
  paciente_nombre: string
  terapeuta_id: string
  terapeuta_nombre: string | null
  tipo: string
  evento_ref: string
  valor: number | null
  fecha: string | null
}

const FALLBACK_PRIORIDAD: AlertaPrioridad = 'media'
const FALLBACK_ICONO = '?'

const buildMensaje = (tipo: string, valor: number | null): string => {
  switch (tipo) {
    case ALERTA_TIPO.SCORE_BAJO:
      return `score ${valor} · última evaluación`
    case ALERTA_TIPO.EVAL_VENCIDA:
      return 'evaluación vencida'
    case ALERTA_TIPO.MES_3:
      return 'entra en mes 3'
    case ALERTA_TIPO.FIN:
      return 'cerca del cierre'
    case ALERTA_TIPO.REINICIO:
      return 'reinició tratamiento'
    case ALERTA_TIPO.MEDICION_CIERRE_PENDIENTE:
      // Copy verbatim de DevSpec medir-chakras §7.2 "Alerta — título".
      return 'Última semana de la etapa: cerrala con su medición'
    default:
      return 'alerta pendiente de revisión'
  }
}

const mapAlertaRow = (
  row: AlertaRow,
  catalogo: ReadonlyArray<TipoAlerta>,
): Alerta => {
  const tipoAlerta = catalogo.find((item) => item.codigo === row.tipo)

  return {
    tipo: row.tipo as ALERTA_TIPO,
    prioridad: tipoAlerta?.prioridad ?? FALLBACK_PRIORIDAD,
    pacienteId: row.paciente_id,
    pacienteNombre: row.paciente_nombre,
    terapeutaId: row.terapeuta_id,
    terapeutaNombre: row.terapeuta_nombre,
    nombre: tipoAlerta?.nombre ?? row.tipo,
    icono: tipoAlerta?.icono ?? FALLBACK_ICONO,
    mensaje: buildMensaje(row.tipo, row.valor),
    eventoRef: row.evento_ref,
    fecha: row.fecha,
    // Falla CERRADO como el `coalesce(..., false)` de marcar_alerta_atendida
    // (DEC-32): un tipo ausente del catálogo NUNCA es descartable.
    descartable: tipoAlerta?.descartable ?? false,
  }
}

export type { AlertaRow }
export { mapAlertaRow }
