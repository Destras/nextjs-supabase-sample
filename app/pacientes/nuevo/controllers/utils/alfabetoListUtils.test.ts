import {
  alfabetosDisponibles,
  setNumerosDeAlfabeto,
  quitarNumero,
  quitarAlfabeto,
  formatAlfabetosResumen,
} from './alfabetoListUtils'

const makeAlfabeto = (id: string, nombre: string, orden: number) => ({
  id,
  codigo: id,
  nombre,
  descripcion: null,
  rangoMax: 40,
  orden,
  activo: true,
})

describe('alfabetoListUtils', () => {
  let catalogo: ReturnType<typeof makeAlfabeto>[]

  beforeEach(() => {
    catalogo = [
      makeAlfabeto('exo', 'Iota', 1),
      makeAlfabeto('telu', 'Sigma', 2),
      makeAlfabeto('agua', 'Agua', 3),
    ]
  })

  describe('alfabetosDisponibles', () => {
    it('returns the whole catalog when nothing is selected', () => {
      expect(alfabetosDisponibles(catalogo, [])).toEqual(catalogo)
    })

    it('excludes the selected alfabetos and keeps catalog order', () => {
      const value = [{ alfabetoId: 'telu', numeros: [1] }]
      expect(alfabetosDisponibles(catalogo, value).map((a) => a.id)).toEqual([
        'exo',
        'agua',
      ])
    })
  })

  describe('setNumerosDeAlfabeto', () => {
    it('adds an alfabeto with sorted, deduplicated numbers', () => {
      expect(
        setNumerosDeAlfabeto([], catalogo, 'exo', [21, 15, 21, 3]),
      ).toEqual([{ alfabetoId: 'exo', numeros: [3, 15, 21] }])
    })

    it('replaces the numbers of an existing alfabeto', () => {
      const value = [{ alfabetoId: 'exo', numeros: [1, 2] }]
      expect(setNumerosDeAlfabeto(value, catalogo, 'exo', [9])).toEqual([
        { alfabetoId: 'exo', numeros: [9] },
      ])
    })

    it('removes the alfabeto when the numbers are empty', () => {
      const value = [
        { alfabetoId: 'exo', numeros: [1] },
        { alfabetoId: 'telu', numeros: [2] },
      ]
      expect(setNumerosDeAlfabeto(value, catalogo, 'exo', [])).toEqual([
        { alfabetoId: 'telu', numeros: [2] },
      ])
    })

    it('orders the result by catalog order', () => {
      const value = [{ alfabetoId: 'agua', numeros: [4] }]
      expect(
        setNumerosDeAlfabeto(value, catalogo, 'exo', [5]).map(
          (a) => a.alfabetoId,
        ),
      ).toEqual(['exo', 'agua'])
    })

    it('does not mutate the input', () => {
      const value = [{ alfabetoId: 'exo', numeros: [1] }]
      setNumerosDeAlfabeto(value, catalogo, 'exo', [2])
      expect(value).toEqual([{ alfabetoId: 'exo', numeros: [1] }])
    })
  })

  describe('quitarNumero', () => {
    it('removes one number and keeps the alfabeto', () => {
      const value = [{ alfabetoId: 'exo', numeros: [1, 2] }]
      expect(quitarNumero(value, 'exo', 1)).toEqual([
        { alfabetoId: 'exo', numeros: [2] },
      ])
    })

    it('removes the alfabeto when it was the last number', () => {
      const value = [
        { alfabetoId: 'exo', numeros: [1] },
        { alfabetoId: 'telu', numeros: [2] },
      ]
      expect(quitarNumero(value, 'exo', 1)).toEqual([
        { alfabetoId: 'telu', numeros: [2] },
      ])
    })
  })

  describe('quitarAlfabeto', () => {
    it('removes the whole alfabeto', () => {
      const value = [
        { alfabetoId: 'exo', numeros: [1, 2] },
        { alfabetoId: 'telu', numeros: [2] },
      ]
      expect(quitarAlfabeto(value, 'exo')).toEqual([
        { alfabetoId: 'telu', numeros: [2] },
      ])
    })
  })

  describe('formatAlfabetosResumen', () => {
    it('returns the empty text when nothing is selected', () => {
      expect(formatAlfabetosResumen([], catalogo, 'Sin alfabetos')).toBe(
        'Sin alfabetos',
      )
    })

    it('joins alfabetos in catalog order with their numbers', () => {
      const value = [
        { alfabetoId: 'telu', numeros: [17] },
        { alfabetoId: 'exo', numeros: [15, 21, 32] },
      ]
      expect(formatAlfabetosResumen(value, catalogo, 'Sin alfabetos')).toBe(
        'Iota 15, 21, 32 · Sigma 17',
      )
    })
  })
})
