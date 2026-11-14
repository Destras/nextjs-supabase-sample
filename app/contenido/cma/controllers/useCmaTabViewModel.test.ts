import { renderHook } from '@testing-library/react'
import { TIPO_CONTENIDO } from '@/app/controllers/Contenido'
import { useContenidoTipoTabViewModel } from '@/app/contenido/controllers/useContenidoTipoTabViewModel'
import { useCmaTabViewModel } from './useCmaTabViewModel'

jest.mock('@/app/contenido/controllers/useContenidoTipoTabViewModel', () => ({
  useContenidoTipoTabViewModel: jest.fn(),
}))

describe('useCmaTabViewModel', () => {
  beforeEach(() => {
    ;(useContenidoTipoTabViewModel as jest.Mock).mockReturnValue({
      items: [],
      isLoading: false,
      error: null,
      isAdmin: false,
    })
  })

  it('delegates to useContenidoTipoTabViewModel with TIPO_CONTENIDO.CMA', () => {
    renderHook(() => useCmaTabViewModel())
    expect(useContenidoTipoTabViewModel).toHaveBeenCalledWith(
      TIPO_CONTENIDO.CMA,
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
    const { result } = renderHook(() => useCmaTabViewModel())
    expect(result.current).toEqual(vmResult)
  })
})
