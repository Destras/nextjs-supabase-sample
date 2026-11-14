import { renderHook } from '@testing-library/react'
import { buscarFichaPorEmail } from './buscarFichaPorEmail'
import { useBuscarFichaPorEmail } from './useBuscarFichaPorEmail'

jest.mock('./buscarFichaPorEmail')

describe('useBuscarFichaPorEmail', () => {
  beforeEach(() => {
    ;(buscarFichaPorEmail as jest.Mock).mockResolvedValue({
      ficha: null,
      error: null,
    })
  })

  it('resolves the result from buscarFichaPorEmail', async () => {
    ;(buscarFichaPorEmail as jest.Mock).mockResolvedValue({
      ficha: {
        id: 'pac-1',
        nombre: 'Sofía Rodríguez',
        dadoDeBaja: false,
        accesible: true,
      },
      error: null,
    })
    const { result } = renderHook(() => useBuscarFichaPorEmail())
    await expect(
      result.current.buscar('sofia@example.com', null),
    ).resolves.toEqual({
      ficha: {
        id: 'pac-1',
        nombre: 'Sofía Rodríguez',
        dadoDeBaja: false,
        accesible: true,
      },
      error: null,
    })
  })

  it('forwards email and excluirPacienteId to buscarFichaPorEmail', async () => {
    const { result } = renderHook(() => useBuscarFichaPorEmail())
    await result.current.buscar('sofia@example.com', 'pac-9')
    expect(buscarFichaPorEmail).toHaveBeenCalledWith(
      'sofia@example.com',
      'pac-9',
    )
  })

  it('keeps the same buscar reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useBuscarFichaPorEmail())
    const first = result.current.buscar
    rerender()
    expect(result.current.buscar).toBe(first)
  })
})
