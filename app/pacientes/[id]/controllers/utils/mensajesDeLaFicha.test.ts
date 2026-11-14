import { mensajeDeInicio, mensajeDeReenvio } from './mensajesDeLaFicha'

const ok = {
  ok: true,
  error: null,
  iniciado: true,
  bienvenida: 'enviada' as const,
}

describe('mensajeDeInicio', () => {
  it('confirma el inicio', () => {
    expect(mensajeDeInicio(ok)).toEqual({
      tono: 'success',
      texto: 'Tratamiento iniciado.',
    })
  })

  it('avisa que ya estaba iniciado', () => {
    expect(mensajeDeInicio({ ...ok, iniciado: false })).toEqual({
      tono: 'info',
      texto: 'El tratamiento ya estaba iniciado.',
    })
  })

  it('avisa si la bienvenida falló', () => {
    expect(mensajeDeInicio({ ...ok, bienvenida: 'fallida' })).toEqual({
      tono: 'warning',
      texto:
        'El tratamiento se inició, pero no se pudo enviar la bienvenida por WhatsApp.',
    })
  })

  it('traduce el error por código', () => {
    expect(
      mensajeDeInicio({ ...ok, ok: false, error: 'etapa_cerrada' }),
    ).toEqual({
      tono: 'error',
      texto: 'El tratamiento está cerrado; no se puede iniciar.',
    })
  })

  it('usa el texto genérico sin código', () => {
    expect(mensajeDeInicio({ ...ok, ok: false })).toEqual({
      tono: 'error',
      texto: 'No se pudo iniciar el tratamiento. Intentá de nuevo.',
    })
  })
})

describe('mensajeDeReenvio', () => {
  it('enviada', () => {
    expect(mensajeDeReenvio('enviada')).toEqual({
      tono: 'success',
      texto: 'Le mandamos la bienvenida por WhatsApp.',
    })
  })

  it('innecesaria', () => {
    expect(mensajeDeReenvio('innecesaria')).toEqual({
      tono: 'info',
      texto: 'No hizo falta: ya tiene la app.',
    })
  })

  it('error', () => {
    expect(mensajeDeReenvio('error')).toEqual({
      tono: 'error',
      texto:
        'No se pudo enviar la bienvenida. Probá de nuevo; si sigue fallando, avisale al equipo técnico.',
    })
  })
})
