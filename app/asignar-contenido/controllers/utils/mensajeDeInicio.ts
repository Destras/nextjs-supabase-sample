import type {
  ErrorDeInicio,
  IniciarTratamientoResult,
} from '@/app/controllers/Paciente'
import type { MensajeDeGuardado } from './mensajeDeGuardado'

/**
 * mensajeDeInicio — qué se le dice al terapeuta después de "Iniciar
 * tratamiento". Pura sobre el resultado de `iniciarTratamiento`.
 */
const TEXTO_DE_ERROR = new Map<ErrorDeInicio, string>([
  ['etapa_cerrada', 'El tratamiento está cerrado; no se puede iniciar.'],
  [
    'paciente_dado_de_baja',
    'El paciente se dio de baja; no se le puede iniciar el tratamiento.',
  ],
  [
    'semana_pasada',
    'Hay una semana que ya pasó; no se puede modificar. Revisá el plan.',
  ],
  ['desconocido', 'No se pudo iniciar el tratamiento. Intentá de nuevo.'],
])

const mensajeDeInicio = (
  resultado: IniciarTratamientoResult,
): MensajeDeGuardado => {
  if (!resultado.ok) {
    return {
      tono: 'error',
      texto:
        TEXTO_DE_ERROR.get(resultado.error ?? 'desconocido') ??
        'No se pudo iniciar el tratamiento. Intentá de nuevo.',
    }
  }
  if (!resultado.iniciado) {
    return { tono: 'info', texto: 'El tratamiento ya estaba iniciado.' }
  }
  if (resultado.bienvenida === 'fallida') {
    return {
      tono: 'warning',
      texto:
        'El tratamiento se inició, pero no se pudo enviar la bienvenida por WhatsApp.',
    }
  }
  return { tono: 'success', texto: 'Tratamiento iniciado.' }
}

export { mensajeDeInicio }
