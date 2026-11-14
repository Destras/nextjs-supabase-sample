import { renderHook } from '@testing-library/react'
import { checkTelefonoEnOtraFicha } from './checkTelefonoEnOtraFicha'
import { useCheckTelefonoEnOtraFicha } from './useCheckTelefonoEnOtraFicha'

jest.mock('./checkTelefonoEnOtraFicha')

describe('useCheckTelefonoEnOtraFicha', () => {
  beforeEach(() => {
    ;(checkTelefonoEnOtraFicha as jest.Mock).mockResolvedValue({
      enOtraFicha: false,
      error: null,
    })
  })

  it('resolves the result from checkTelefonoEnOtraFicha', async () => {
    ;(checkTelefonoEnOtraFicha as jest.Mock).mockResolvedValue({
      enOtraFicha: true,
      error: null,
    })
    const { result } = renderHook(() => useCheckTelefonoEnOtraFicha())
    await expect(result.current.check('+541151234567', null)).resolves.toEqual({
      enOtraFicha: true,
      error: null,
    })
  })

  it('forwards telefono and excluirPacienteId to checkTelefonoEnOtraFicha', async () => {
    const { result } = renderHook(() => useCheckTelefonoEnOtraFicha())
    await result.current.check('+541151234567', 'paciente-uuid-1')
    expect(checkTelefonoEnOtraFicha).toHaveBeenCalledWith(
      '+541151234567',
      'paciente-uuid-1',
    )
  })

  it('keeps the same check reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useCheckTelefonoEnOtraFicha())
    const first = result.current.check
    rerender()
    expect(result.current.check).toBe(first)
  })
})
