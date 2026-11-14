import { mensajeDeGuardado } from './mensajeDeGuardado'

describe('mensajeDeGuardado', () => {
  it('reports the save failure when the plan did not save', () => {
    expect(mensajeDeGuardado({ ok: false, semanaPasada: null }, true)).toEqual({
      tono: 'error',
      texto: 'No se pudo guardar el plan. Intentá de nuevo.',
    })
  })

  it('names the week that already passed', () => {
    expect(mensajeDeGuardado({ ok: false, semanaPasada: 2 }, false)).toEqual({
      tono: 'error',
      texto: 'La semana 2 ya pasó; no se puede modificar.',
    })
  })

  it('says the treatment has not started when saved before starting', () => {
    expect(mensajeDeGuardado({ ok: true, semanaPasada: null }, true)).toEqual({
      tono: 'success',
      texto: 'Plan guardado. El tratamiento todavía no empezó.',
    })
  })

  it('confirms the save when the treatment already started', () => {
    expect(mensajeDeGuardado({ ok: true, semanaPasada: null }, false)).toEqual({
      tono: 'success',
      texto: 'Plan guardado.',
    })
  })
})
