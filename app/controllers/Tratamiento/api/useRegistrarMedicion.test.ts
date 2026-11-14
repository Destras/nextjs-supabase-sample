import { act, renderHook } from '@testing-library/react'
import { registrarMedicion } from './registrarMedicion'
import { useRegistrarMedicion } from './useRegistrarMedicion'

jest.mock('./registrarMedicion')

describe('useRegistrarMedicion', () => {
  it('calls registrarMedicion with the submitted payload', async () => {
    ;(registrarMedicion as jest.Mock).mockResolvedValue({
      data: 'med-1',
      error: null,
    })
    const { result } = renderHook(() => useRegistrarMedicion())

    const payload = {
      etapaId: 'etapa-1',
      valores: { estructura_general: 55, centros: [] },
      medicionPreviaId: null,
    }
    await act(async () => {
      await result.current.submit(payload)
    })

    expect(registrarMedicion).toHaveBeenCalledWith(payload)
  })

  it('returns isSubmitting false initially', () => {
    const { result } = renderHook(() => useRegistrarMedicion())
    expect(result.current.isSubmitting).toBe(false)
  })
})
