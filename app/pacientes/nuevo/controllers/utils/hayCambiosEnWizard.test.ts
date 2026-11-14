import { hayCambiosEnWizard } from './hayCambiosEnWizard'

describe('hayCambiosEnWizard', () => {
  let inicial: {
    paso: number
    identidad: { nombre: string; fechaNacimiento: string | null }
    diagnostico: { causaId: string | null; bloqueoIds: string[] }
  }

  beforeEach(() => {
    inicial = {
      paso: 1,
      identidad: { nombre: '', fechaNacimiento: null },
      diagnostico: { causaId: null, bloqueoIds: [] },
    }
  })

  it('no hay cambios con el estado inicial', () => {
    expect(hayCambiosEnWizard(inicial, inicial)).toBe(false)
  })

  it('no hay cambios con una copia idéntica del estado inicial', () => {
    expect(
      hayCambiosEnWizard(
        {
          paso: 1,
          identidad: { nombre: '', fechaNacimiento: null },
          diagnostico: { causaId: null, bloqueoIds: [] },
        },
        inicial,
      ),
    ).toBe(false)
  })

  it('cambiar de paso no cuenta como cambio', () => {
    expect(hayCambiosEnWizard({ ...inicial, paso: 2 }, inicial)).toBe(false)
  })

  it('hay cambios al escribir un campo', () => {
    expect(
      hayCambiosEnWizard(
        { ...inicial, identidad: { nombre: 'Ana', fechaNacimiento: null } },
        inicial,
      ),
    ).toBe(true)
  })

  it('hay cambios al elegir una opción', () => {
    expect(
      hayCambiosEnWizard(
        { ...inicial, diagnostico: { causaId: 'c-1', bloqueoIds: [] } },
        inicial,
      ),
    ).toBe(true)
  })

  it('hay cambios al sumar un elemento a una lista', () => {
    expect(
      hayCambiosEnWizard(
        { ...inicial, diagnostico: { causaId: null, bloqueoIds: ['b-1'] } },
        inicial,
      ),
    ).toBe(true)
  })
})
