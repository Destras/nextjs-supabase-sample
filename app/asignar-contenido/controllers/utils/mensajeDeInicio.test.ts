import { mensajeDeInicio } from './mensajeDeInicio'

const ok = {
  ok: true,
  error: null,
  iniciado: true,
  bienvenida: 'enviada' as const,
}

describe('mensajeDeInicio', () => {
  it('reports etapa_cerrada', () => {
    expect(
      mensajeDeInicio({ ...ok, ok: false, error: 'etapa_cerrada' }).tono,
    ).toBe('error')
  })

  it('reports paciente_dado_de_baja', () => {
    expect(
      mensajeDeInicio({ ...ok, ok: false, error: 'paciente_dado_de_baja' })
        .texto,
    ).toMatch(/baja/)
  })

  it('reports semana_pasada', () => {
    expect(
      mensajeDeInicio({ ...ok, ok: false, error: 'semana_pasada' }).texto,
    ).toMatch(/ya pasó/)
  })

  it('reports an unknown error', () => {
    expect(mensajeDeInicio({ ...ok, ok: false, error: 'desconocido' })).toEqual(
      {
        tono: 'error',
        texto: 'No se pudo iniciar el tratamiento. Intentá de nuevo.',
      },
    )
  })

  it('is info when it was already started', () => {
    expect(mensajeDeInicio({ ...ok, iniciado: false })).toEqual({
      tono: 'info',
      texto: 'El tratamiento ya estaba iniciado.',
    })
  })

  it('warns when the welcome failed', () => {
    expect(mensajeDeInicio({ ...ok, bienvenida: 'fallida' })).toEqual({
      tono: 'warning',
      texto:
        'El tratamiento se inició, pero no se pudo enviar la bienvenida por WhatsApp.',
    })
  })

  it('succeeds otherwise', () => {
    expect(mensajeDeInicio(ok)).toEqual({
      tono: 'success',
      texto: 'Tratamiento iniciado.',
    })
  })
})
