import { formatReemplazoToast } from './formatReemplazoToast'

describe('formatReemplazoToast', () => {
  it('usa el singular cuando el reemplazo tocó a un solo paciente', () => {
    expect(formatReemplazoToast(1)).toBe(
      'Reemplazamos el contenido en 1 paciente y eliminamos el original.',
    )
  })

  it('usa el plural cuando el reemplazo tocó a varios pacientes', () => {
    expect(formatReemplazoToast(3)).toBe(
      'Reemplazamos el contenido en 3 pacientes y eliminamos el original.',
    )
  })

  it('no menciona pacientes cuando el reemplazo no tocó a ninguno', () => {
    expect(formatReemplazoToast(0)).toBe(
      'Reemplazamos el contenido y eliminamos el original.',
    )
  })
})
