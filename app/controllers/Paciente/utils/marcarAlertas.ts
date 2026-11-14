import type { Paciente } from '../PacienteTypes'
import type { Alerta } from '../../Alerta'

/**
 * Marca qué pacientes tienen una alerta activa, según el motor de alertas.
 *
 * El mapper NO puede resolver esto: la entidad Paciente se arma desde
 * `asignaciones_paciente` y no ve `derive_alertas_activas()`. Antes lo aproximaba
 * con el score (`isLowScore`), y esa aproximación era falsa en las dos
 * direcciones:
 *
 *   - Un paciente con una alerta de `mes_3`, `fin` o `eval_vencida` NO aparecía
 *     marcado (la campana decía 15 y la lista decía "Con alerta · 0").
 *   - Un paciente con score bajo cuya alerta ya fue ATENDIDA seguía marcado,
 *     porque el score no cambia al marcar la alerta.
 *
 * El motor es la única fuente de verdad, y ya resta las alertas atendidas.
 */
const marcarAlertas = (
  pacientes: ReadonlyArray<Paciente>,
  alertas: ReadonlyArray<Alerta>,
): ReadonlyArray<Paciente> => {
  const conAlerta = new Set(alertas.map((a) => a.pacienteId))

  return pacientes.map((p) => ({ ...p, tieneAlerta: conAlerta.has(p.id) }))
}

export { marcarAlertas }
