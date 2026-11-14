import { renderHook } from '@testing-library/react'
import { TIPO_CONTENIDO } from '@/app/controllers/Contenido'
import { useContenidoTipoTabViewModel } from '@/app/contenido/controllers/useContenidoTipoTabViewModel'
import { useEgregoresTabViewModel } from './useEgregoresTabViewModel'

jest.mock('@/app/contenido/controllers/useContenidoTipoTabViewModel', () => ({
  useContenidoTipoTabViewModel: jest.fn(),
}))

describe('useEgregoresTabViewModel', () => {
  beforeEach(() => {
    ;(useContenidoTipoTabViewModel as jest.Mock).mockReturnValue({
      items: [],
      isLoading: false,
      error: null,
      isAdmin: false,
    })
  })

  it('delegates to useContenidoTipoTabViewModel with TIPO_CONTENIDO.EGREGOR', () => {
    renderHook(() => useEgregoresTabViewModel())
    expect(useContenidoTipoTabViewModel).toHaveBeenCalledWith(
      TIPO_CONTENIDO.EGREGOR,
    )
  })

  it('returns the same envelope as useContenidoTipoTabViewModel', () => {
    const vmResult = {
      items: [],
      isLoading: false,
      error: null,
      isAdmin: true,
    }
    ;(useContenidoTipoTabViewModel as jest.Mock).mockReturnValue(vmResult)
    const { result } = renderHook(() => useEgregoresTabViewModel())
    expect(result.current).toEqual(vmResult)
  })
})
