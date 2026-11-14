import { act, renderHook } from '@testing-library/react'
import type { AlfabetoConNumeros } from '@/app/controllers/Paciente'
import type { CatalogoAlfabetos } from './utils/alfabetoListUtils'
import { useAlfabetosPicker } from './useAlfabetosPicker'

const makeAlfabeto = (
  id: string,
  nombre: string,
  orden: number,
  rangoMax: number,
): CatalogoAlfabetos[number] => ({
  id,
  codigo: id,
  nombre,
  descripcion: null,
  rangoMax,
  orden,
  activo: true,
})

const handlers = {
  onAgregarOpenChange: expect.any(Function),
  onEditarOpenChange: expect.any(Function),
  onElegirAlfabeto: expect.any(Function),
  onChangeBorrador: expect.any(Function),
  onListo: expect.any(Function),
  onQuitarNumero: expect.any(Function),
  onQuitarAlfabeto: expect.any(Function),
}

describe('useAlfabetosPicker', () => {
  let catalogo: CatalogoAlfabetos
  let value: ReadonlyArray<AlfabetoConNumeros>
  let onChange: jest.Mock

  beforeEach(() => {
    catalogo = [
      makeAlfabeto('exo', 'Iota', 1, 32),
      makeAlfabeto('telu', 'Sigma', 2, 3),
      makeAlfabeto('ign', 'Ígneo', 3, 10),
    ]
    value = [{ alfabetoId: 'telu', numeros: [2] }]
    onChange = jest.fn()
  })

  const render = () =>
    renderHook(() => useAlfabetosPicker({ catalogo, value, onChange }))

  const filaTelu = {
    alfabetoId: 'telu',
    nombre: 'Sigma',
    rangoLabel: '(1–3)',
    numeros: [2],
    editando: false,
  }
  const opciones = [
    { id: 'exo', etiqueta: 'Iota (1–32)' },
    { id: 'ign', etiqueta: 'Ígneo (1–10)' },
  ]

  it('starts closed, with one row per chosen alfabeto and the rest offered in catalog order', () => {
    const { result } = render()
    expect(result.current).toEqual({
      filas: [
        {
          alfabetoId: 'telu',
          nombre: 'Sigma',
          rangoLabel: '(1–3)',
          numeros: [2],
          editando: false,
        },
      ],
      opcionesParaAgregar: [
        { id: 'exo', etiqueta: 'Iota (1–32)' },
        { id: 'ign', etiqueta: 'Ígneo (1–10)' },
      ],
      agregarAbierto: false,
      grilla: null,
      borrador: [],
      ...handlers,
    })
  })

  it('shows the id and no range for a chosen alfabeto missing from the catalog', () => {
    value = [{ alfabetoId: 'viejo', numeros: [1] }]
    const { result } = render()
    expect(result.current.filas).toEqual([
      {
        alfabetoId: 'viejo',
        nombre: 'viejo',
        rangoLabel: null,
        numeros: [1],
        editando: false,
      },
    ])
  })

  it('offers nothing to add when every alfabeto is chosen', () => {
    value = [
      { alfabetoId: 'exo', numeros: [1] },
      { alfabetoId: 'telu', numeros: [2] },
      { alfabetoId: 'ign', numeros: [3] },
    ]
    const { result } = render()
    expect(result.current.opcionesParaAgregar).toEqual([])
  })

  it('opening Agregar shows the list of alfabetos (no grid yet)', () => {
    const { result } = render()
    act(() => result.current.onAgregarOpenChange(true))
    expect(result.current).toEqual({
      filas: [filaTelu],
      opcionesParaAgregar: opciones,
      agregarAbierto: true,
      grilla: null,
      borrador: [],
      ...handlers,
    })
  })

  it('choosing an alfabeto shows its grid of numbers', () => {
    const { result } = render()
    act(() => result.current.onAgregarOpenChange(true))
    act(() => result.current.onElegirAlfabeto('ign'))
    expect(result.current.grilla).toEqual({
      nombre: 'Ígneo',
      rangoMax: 10,
      opciones: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    })
  })

  it('Listo applies the draft sorted, keeping catalog order', () => {
    const { result } = render()
    act(() => result.current.onAgregarOpenChange(true))
    act(() => result.current.onElegirAlfabeto('exo'))
    act(() => result.current.onChangeBorrador([32, 15, 21]))
    act(() => result.current.onListo())
    expect(onChange).toHaveBeenCalledWith([
      { alfabetoId: 'exo', numeros: [15, 21, 32] },
      { alfabetoId: 'telu', numeros: [2] },
    ])
  })

  it('closing Agregar (Escape / click outside) also applies the draft', () => {
    const { result } = render()
    act(() => result.current.onAgregarOpenChange(true))
    act(() => result.current.onElegirAlfabeto('ign'))
    act(() => result.current.onChangeBorrador([4]))
    act(() => result.current.onAgregarOpenChange(false))
    expect(onChange).toHaveBeenCalledWith([
      { alfabetoId: 'telu', numeros: [2] },
      { alfabetoId: 'ign', numeros: [4] },
    ])
  })

  it('closing Agregar with an empty draft does not add the alfabeto', () => {
    const { result } = render()
    act(() => result.current.onAgregarOpenChange(true))
    act(() => result.current.onElegirAlfabeto('ign'))
    act(() => result.current.onAgregarOpenChange(false))
    expect(onChange).toHaveBeenCalledWith([
      { alfabetoId: 'telu', numeros: [2] },
    ])
  })

  it('closing Agregar before choosing an alfabeto changes nothing', () => {
    const { result } = render()
    act(() => result.current.onAgregarOpenChange(true))
    act(() => result.current.onAgregarOpenChange(false))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closing resets the popover and the draft', () => {
    const { result } = render()
    act(() => result.current.onAgregarOpenChange(true))
    act(() => result.current.onElegirAlfabeto('ign'))
    act(() => result.current.onChangeBorrador([4]))
    act(() => result.current.onListo())
    expect(result.current).toEqual({
      filas: [filaTelu],
      opcionesParaAgregar: opciones,
      agregarAbierto: false,
      grilla: null,
      borrador: [],
      ...handlers,
    })
  })

  it('opening Editar on a row marks it as editing, with its numbers as draft and its grid', () => {
    const { result } = render()
    act(() => result.current.onEditarOpenChange('telu', true))
    expect(result.current).toEqual({
      filas: [{ ...filaTelu, editando: true }],
      opcionesParaAgregar: opciones,
      agregarAbierto: false,
      grilla: { nombre: 'Sigma', rangoMax: 3, opciones: [1, 2, 3] },
      borrador: [2],
      ...handlers,
    })
  })

  it('opening Editar on an alfabeto missing from the catalog shows an empty grid', () => {
    value = [{ alfabetoId: 'viejo', numeros: [1] }]
    const { result } = render()
    act(() => result.current.onEditarOpenChange('viejo', true))
    expect(result.current.grilla).toEqual({
      nombre: 'viejo',
      rangoMax: 0,
      opciones: [],
    })
  })

  it('opening Editar for an alfabeto that is not chosen starts with an empty draft', () => {
    const { result } = render()
    act(() => result.current.onEditarOpenChange('ign', true))
    expect(result.current.borrador).toEqual([])
  })

  it('closing Editar with every number unchecked removes the alfabeto', () => {
    const { result } = render()
    act(() => result.current.onEditarOpenChange('telu', true))
    act(() => result.current.onChangeBorrador([]))
    act(() => result.current.onEditarOpenChange('telu', false))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('onQuitarNumero removes one number from the row', () => {
    value = [{ alfabetoId: 'telu', numeros: [1, 2] }]
    const { result } = render()
    act(() => result.current.onQuitarNumero('telu', 1))
    expect(onChange).toHaveBeenCalledWith([
      { alfabetoId: 'telu', numeros: [2] },
    ])
  })

  it('onQuitarAlfabeto removes the whole row', () => {
    const { result } = render()
    act(() => result.current.onQuitarAlfabeto('telu'))
    expect(onChange).toHaveBeenCalledWith([])
  })
})
