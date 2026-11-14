import { act, renderHook } from '@testing-library/react'
import { editarMedicion } from './editarMedicion'
import { useEditarMedicion } from './useEditarMedicion'

jest.mock('./editarMedicion')

describe('useEditarMedicion', () => {
  it('calls editarMedicion with the submitted payload', async () => {
    ;(editarMedicion as jest.Mock).mockResolvedValue({
      data: null,
      error: null,
    })
    const { result } = renderHook(() => useEditarMedicion())

    const payload = {
      medicionId: 'med-1',
      valores: { estructura_general: 60, centros: [] },
    }
    await act(async () => {
      await result.current.submit(payload)
    })

    expect(editarMedicion).toHaveBeenCalledWith(payload)
  })

  it('returns isSubmitting false initially', () => {
    const { result } = renderHook(() => useEditarMedicion())
    expect(result.current.isSubmitting).toBe(false)
  })
})
