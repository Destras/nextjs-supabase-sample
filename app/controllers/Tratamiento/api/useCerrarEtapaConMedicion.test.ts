import { act, renderHook } from '@testing-library/react'
import { cerrarEtapaConMedicion } from './cerrarEtapaConMedicion'
import { useCerrarEtapaConMedicion } from './useCerrarEtapaConMedicion'

jest.mock('./cerrarEtapaConMedicion')

describe('useCerrarEtapaConMedicion', () => {
  it('calls cerrarEtapaConMedicion with the submitted payload', async () => {
    ;(cerrarEtapaConMedicion as jest.Mock).mockResolvedValue({
      data: 'med-cierre',
      error: null,
    })
    const { result } = renderHook(() => useCerrarEtapaConMedicion())

    const payload = {
      pacienteId: 'p-1',
      motivo: null,
      valores: { estructura_general: 90, centros: [] },
      medicionPreviaId: null,
    }
    await act(async () => {
      await result.current.submit(payload)
    })

    expect(cerrarEtapaConMedicion).toHaveBeenCalledWith(payload)
  })

  it('returns isSubmitting false initially', () => {
    const { result } = renderHook(() => useCerrarEtapaConMedicion())
    expect(result.current.isSubmitting).toBe(false)
  })
})
