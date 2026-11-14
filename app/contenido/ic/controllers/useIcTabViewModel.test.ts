import { renderHook } from '@testing-library/react'
import { TIPO_CONTENIDO } from '@/app/controllers/Contenido'
import { useContenidoTipoTabViewModel } from '@/app/contenido/controllers/useContenidoTipoTabViewModel'
import { useIcTabViewModel } from './useIcTabViewModel'

jest.mock('@/app/contenido/controllers/useContenidoTipoTabViewModel', () => ({
  useContenidoTipoTabViewModel: jest.fn(),
}))

describe('useIcTabViewModel', () => {
  beforeEach(() => {
    ;(useContenidoTipoTabViewModel as jest.Mock).mockReturnValue({
      items: [],
      isLoading: false,
      error: null,
      isAdmin: false,
    })
  })

  it('delegates to useContenidoTipoTabViewModel with TIPO_CONTENIDO.IC', () => {
    renderHook(() => useIcTabViewModel())
    expect(useContenidoTipoTabViewModel).toHaveBeenCalledWith(TIPO_CONTENIDO.IC)
  })

  it('returns the same envelope as useContenidoTipoTabViewModel', () => {
    const vmResult = {
      items: [],
      isLoading: false,
      error: null,
      isAdmin: true,
    }
    ;(useContenidoTipoTabViewModel as jest.Mock).mockReturnValue(vmResult)
    const { result } = renderHook(() => useIcTabViewModel())
    expect(result.current).toEqual(vmResult)
  })
})
