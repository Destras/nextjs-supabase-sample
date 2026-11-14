import { createClient } from '@/lib/supabase/client'
import { fetchAllContenido } from './fetchAllContenido'
import { TIPO_CONTENIDO } from '../ContenidoTypes'

jest.mock('@/lib/supabase/client')

describe('fetchAllContenido', () => {
  let eqMock: jest.Mock
  let selectMock: jest.Mock

  beforeEach(() => {
    eqMock = jest.fn()
    selectMock = jest.fn().mockReturnValue({ eq: eqMock })
    ;(createClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: selectMock,
      }),
    })
  })

  it('requests the embedded contenido_imagenes(path, orden) select', async () => {
    eqMock.mockResolvedValue({ data: [], error: null })
    await fetchAllContenido()
    expect(selectMock).toHaveBeenCalledWith(
      `id, tipo, titulo, descripcion, recurso_ref, duracion_seg, contenido_imagenes(path, orden)`,
    )
  })

  it('returns imagenes sorted by orden ascending', async () => {
    eqMock.mockResolvedValue({
      data: [
        {
          id: 'c-1',
          tipo: 'cma',
          titulo: 'Galería',
          descripcion: null,
          recurso_ref: null,
          duracion_seg: null,
          contenido_imagenes: [
            { path: 'cma/b.jpg', orden: 2 },
            { path: 'cma/a.jpg', orden: 1 },
          ],
        },
      ],
      error: null,
    })
    const { data } = await fetchAllContenido()
    expect(data?.[0]?.imagenes).toEqual([
      { path: 'cma/a.jpg', orden: 1 },
      { path: 'cma/b.jpg', orden: 2 },
    ])
  })

  it('returns an Error when supabase returns an error', async () => {
    eqMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await fetchAllContenido()).toEqual({
      data: null,
      error: new Error('boom'),
    })
  })

  it('returns the mapped Contenido list, skipping non-media rows (texto/unknown)', async () => {
    eqMock.mockResolvedValue({
      data: [
        {
          id: 'c-1',
          tipo: 'video',
          titulo: 'V',
          descripcion: null,
          recurso_ref: null,
          duracion_seg: null,
        },
        {
          id: 'c-2',
          tipo: 'texto',
          titulo: 'T',
          descripcion: null,
          recurso_ref: null,
          duracion_seg: null,
        },
        {
          id: 'c-3',
          tipo: 'desconocido',
          titulo: 'X',
          descripcion: null,
          recurso_ref: null,
          duracion_seg: null,
        },
      ],
      error: null,
    })
    expect(await fetchAllContenido()).toEqual({
      data: [
        {
          id: 'c-1',
          tipo: TIPO_CONTENIDO.VIDEO,
          titulo: 'V',
          descripcion: null,
          contenido: { recursoRef: null, duracion: null },
          imagenes: [],
        },
      ],
      error: null,
    })
  })
})
