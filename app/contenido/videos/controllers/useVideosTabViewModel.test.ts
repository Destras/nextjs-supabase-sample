import { renderHook } from '@testing-library/react'
import { TIPO_CONTENIDO } from '@/app/controllers/Contenido'
import { useContenidoTipoTabViewModel } from '@/app/contenido/controllers/useContenidoTipoTabViewModel'
import { useVideosTabViewModel } from './useVideosTabViewModel'

jest.mock('@/app/contenido/controllers/useContenidoTipoTabViewModel', () => ({
  useContenidoTipoTabViewModel: jest.fn(),
}))

describe('useVideosTabViewModel', () => {
  beforeEach(() => {
    ;(useContenidoTipoTabViewModel as jest.Mock).mockReturnValue({
      items: [],
      isLoading: false,
      error: null,
      isAdmin: false,
    })
  })

  it('delegates to useContenidoTipoTabViewModel with TIPO_CONTENIDO.VIDEO', () => {
    renderHook(() => useVideosTabViewModel())
    expect(useContenidoTipoTabViewModel).toHaveBeenCalledWith(
      TIPO_CONTENIDO.VIDEO,
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
    const { result } = renderHook(() => useVideosTabViewModel())
    expect(result.current).toEqual(vmResult)
  })
})
