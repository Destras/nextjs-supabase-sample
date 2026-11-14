import type { SetEntregasPlanResult } from '@/app/controllers/Tratamiento'

/**
 * mensajeDeGuardado — qué se le dice al terapeuta después de guardar el plan.
 *
 * Es una función pura sobre el resultado del RPC para poder fijar cada texto con
 * un test: el copy envejeció una vez en silencio (ACT-003) porque vivía dentro
 * de un `useCallback` y ningún test lo miraba.
 *
 * Guardar el plan no arranca el tratamiento ni manda la bienvenida
 * (planBorrador): eso lo hace iniciarTratamiento (ver mensajeDeInicio).
 */
type TonoDeMensaje = 'success' | 'warning' | 'error' | 'info'

interface MensajeDeGuardado {
  readonly tono: TonoDeMensaje
  readonly texto: string
}

type ResultadoDeGuardado = Pick<SetEntregasPlanResult, 'ok' | 'semanaPasada'>

const mensajeDeGuardado = (
  resultado: ResultadoDeGuardado,
  sinIniciar: boolean,
): MensajeDeGuardado => {
  if (!resultado.ok) {
    if (resultado.semanaPasada !== null) {
      return {
        tono: 'error',
        texto: `La semana ${resultado.semanaPasada} ya pasó; no se puede modificar.`,
      }
    }
    return {
      tono: 'error',
      texto: 'No se pudo guardar el plan. Intentá de nuevo.',
    }
  }

  return sinIniciar
    ? {
        tono: 'success',
        texto: 'Plan guardado. El tratamiento todavía no empezó.',
      }
    : { tono: 'success', texto: 'Plan guardado.' }
}

export type { MensajeDeGuardado, TonoDeMensaje }
export { mensajeDeGuardado }
