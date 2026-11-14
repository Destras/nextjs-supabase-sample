import { format, parseISO, subDays } from 'date-fns'
import { getServiceRoleClient } from './supabase'

/**
 * Backdates the treatment clock for `etapaId` by `weeks * 7` days.
 *
 * The treatment clock is half-derived, half-materialized: shifting only
 * `etapas_tratamiento.fecha_inicio` covers the derived weekly-plan reads
 * (`get_mi_plan_semanal`, `semanaActual`, the month-granular alerts), but
 * NOT `eval_vencida` / `get_mi_evaluacion_vigente` / `proximaEvaluacion`,
 * which read the materialized `niveles.fecha_seguimiento_esperada`. This
 * util shifts BOTH columns by the same interval so the two clocks stay
 * coherent — shifting only `fecha_inicio` would pass the util's own
 * "it ran" check without actually moving anything a spec can observe.
 *
 * Deliberately NOT written: `niveles.fecha_seguimiento_real` (only ever
 * tested `is null`), `entregas_plan.dia_offset` (relative, not absolute),
 * `entregas_plan.fecha_entregada` / `fecha_consumida` (no read path
 * compares them to `current_date`), `alertas_atendidas` (time-independent,
 * keyed by `evento_ref`).
 *
 * Known limitation: `mes_actual`-derived alerts (`mes_3`, `fin`) are
 * computed via month-granular `age()`, not a day count, so a weeks-only
 * signature cannot reliably target them. Callers targeting those alerts
 * must choose a week count that provably crosses the month boundary.
 *
 * Throws if `fecha_inicio` is null — the stage never started, and
 * backdating would incorrectly resurrect a "sin_etapa_activa" gate.
 */
const advanceClock = async (etapaId: string, weeks: number): Promise<void> => {
  const supabase = getServiceRoleClient()
  const dayShift = weeks * 7

  const { data: etapa, error: etapaError } = await supabase
    .from('etapas_tratamiento')
    .select('id, fecha_inicio')
    .eq('id', etapaId)
    .single()

  if (etapaError) {
    throw new Error(
      `advanceClock: could not read etapa ${etapaId}: ${etapaError.message}`,
    )
  }
  if (!etapa.fecha_inicio) {
    throw new Error(
      `advanceClock: etapa ${etapaId} has fecha_inicio = null — the stage never started, refusing to backdate it.`,
    )
  }

  const shiftedFechaInicio = format(
    subDays(parseISO(etapa.fecha_inicio as string), dayShift),
    'yyyy-MM-dd',
  )

  const { error: updateEtapaError } = await supabase
    .from('etapas_tratamiento')
    .update({ fecha_inicio: shiftedFechaInicio })
    .eq('id', etapaId)

  if (updateEtapaError) {
    throw new Error(
      `advanceClock: could not update fecha_inicio for etapa ${etapaId}: ${updateEtapaError.message}`,
    )
  }

  const { data: niveles, error: nivelesError } = await supabase
    .from('niveles')
    .select('id, fecha_seguimiento_esperada')
    .eq('etapa_id', etapaId)
    .not('fecha_seguimiento_esperada', 'is', null)

  if (nivelesError) {
    throw new Error(
      `advanceClock: could not read niveles for etapa ${etapaId}: ${nivelesError.message}`,
    )
  }

  for (const nivel of niveles ?? []) {
    const shiftedFechaSeguimiento = format(
      subDays(parseISO(nivel.fecha_seguimiento_esperada as string), dayShift),
      'yyyy-MM-dd',
    )

    const { error: updateNivelError } = await supabase
      .from('niveles')
      .update({ fecha_seguimiento_esperada: shiftedFechaSeguimiento })
      .eq('id', nivel.id)

    if (updateNivelError) {
      throw new Error(
        `advanceClock: could not update fecha_seguimiento_esperada for nivel ${nivel.id}: ${updateNivelError.message}`,
      )
    }
  }
}

export { advanceClock }
