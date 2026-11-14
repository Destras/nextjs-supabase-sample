import { act, renderHook } from '@testing-library/react'
import { iniciarTratamiento } from './iniciarTratamiento'
import { useIniciarTratamiento } from './useIniciarTratamiento'

jest.mock('./iniciarTratamiento')

describe('useIniciarTratamiento', () => {
  it('starts with isSubmitting false', () => {
    const { result } = renderHook(() => useIniciarTratamiento())
    expect(result.current).toEqual({
      submit: expect.any(Function),
      isSubmitting: false,
    })
  })

  it('returns the result of iniciarTratamiento from submit', async () => {
    const expected = {
      ok: true,
      error: null,
      iniciado: true,
      bienvenida: 'enviada',
    }
    ;(iniciarTratamiento as jest.Mock).mockResolvedValue(expected)
    const { result } = renderHook(() => useIniciarTratamiento())

    let returned: unknown = null
    await act(async () => {
      returned = await result.current.submit({ etapaId: 'e-1', semanas: null })
    })

    expect(returned).toEqual(expected)
  })

  it('forwards the payload to iniciarTratamiento', async () => {
    ;(iniciarTratamiento as jest.Mock).mockResolvedValue({})
    const { result } = renderHook(() => useIniciarTratamiento())

    await act(async () => {
      await result.current.submit({ etapaId: 'e-7', semanas: [] })
    })

    expect(iniciarTratamiento).toHaveBeenCalledWith({
      etapaId: 'e-7',
      semanas: [],
    })
  })
})
