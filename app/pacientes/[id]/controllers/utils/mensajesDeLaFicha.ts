import type {
  ErrorDeInicio,
  IniciarTratamientoResult,
  ResultadoReenvio,
} from '@/app/controllers/Paciente'

type TonoDeMensaje = 'success' | 'warning' | 'error' | 'info'

interface MensajeDeLaFicha {
  readonly tono: TonoDeMensaje
  readonly texto: string
}

const TEXTO_GENERICO = 'No se pudo iniciar el tratamiento. Intentá de nuevo.'

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
  ['desconocido', TEXTO_GENERICO],
])

const mensajeDeInicio = (
  resultado: IniciarTratamientoResult,
): MensajeDeLaFicha => {
  if (!resultado.ok) {
    return {
      tono: 'error',
      texto:
        TEXTO_DE_ERROR.get(resultado.error ?? 'desconocido') ?? TEXTO_GENERICO,
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

const MENSAJE_DE_REENVIO = new Map<ResultadoReenvio, MensajeDeLaFicha>([
  [
    'enviada',
    { tono: 'success', texto: 'Le mandamos la bienvenida por WhatsApp.' },
  ],
  ['innecesaria', { tono: 'info', texto: 'No hizo falta: ya tiene la app.' }],
  [
    'error',
    {
      tono: 'error',
      texto:
        'No se pudo enviar la bienvenida. Probá de nuevo; si sigue fallando, avisale al equipo técnico.',
    },
  ],
])

const MENSAJE_DE_REENVIO_GENERICO: MensajeDeLaFicha = {
  tono: 'error',
  texto:
    'No se pudo enviar la bienvenida. Probá de nuevo; si sigue fallando, avisale al equipo técnico.',
}

const mensajeDeReenvio = (resultado: ResultadoReenvio): MensajeDeLaFicha =>
  MENSAJE_DE_REENVIO.get(resultado) ?? MENSAJE_DE_REENVIO_GENERICO

export { mensajeDeInicio, mensajeDeReenvio }
export type { MensajeDeLaFicha, TonoDeMensaje }
