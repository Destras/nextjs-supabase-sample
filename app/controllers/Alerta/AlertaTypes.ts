// Subsistema de alertas cross-cutting v2: señales derivadas server-side
// (derive_alertas_activas()) que cruzan Paciente + Tratamiento y no
// pertenecen a ninguna entidad existente. Entidad pre-aprobada vía Rule 6
// (precedente AdminDashboard, DEC-E0-4, alertas/epic-0/task-0.4).

enum ALERTA_TIPO {
  SCORE_BAJO = 'score_bajo',
  EVAL_VENCIDA = 'eval_vencida',
  MES_3 = 'mes_3',
  FIN = 'fin',
  REINICIO = 'reinicio',
  MEDICION_CIERRE_PENDIENTE = 'medicion_cierre_pendiente',
}

type AlertaPrioridad = 'alta' | 'media' | 'baja'

interface Alerta {
  readonly tipo: ALERTA_TIPO
  readonly prioridad: AlertaPrioridad
  readonly pacienteId: string
  readonly pacienteNombre: string
  readonly terapeutaId: string
  readonly terapeutaNombre: string | null // null en la vista terapeuta
  readonly nombre: string // label del tipo, resuelto desde el catálogo tipos_alerta
  readonly icono: string // glifo del tipo, resuelto desde el catálogo tipos_alerta
  readonly mensaje: string
  readonly eventoRef: string
  readonly fecha: string | null
  // Señal por-fila para el check "marcar atendida" (DEC-32). Falla CERRADO:
  // resuelto desde tipos_alerta.descartable via mapAlertaRow, nunca inferido
  // acá — un tipo ausente del catálogo NUNCA es descartable.
  readonly descartable: boolean
}

// Fila del catálogo tipos_alerta — metadata de presentación por tipo
// (nombre, prioridad, orden, ícono). Consumido por mapAlertaRow para matar
// el split-brain de v1 que hardcodeaba prioridad/nombre/ícono en TS.
interface TipoAlerta {
  readonly codigo: string
  readonly nombre: string
  readonly prioridad: AlertaPrioridad
  readonly orden: number
  readonly icono: string
  readonly descripcion: string | null
  readonly activo: boolean
  readonly descartable: boolean
}

export type { Alerta, AlertaPrioridad, TipoAlerta }
export { ALERTA_TIPO }
