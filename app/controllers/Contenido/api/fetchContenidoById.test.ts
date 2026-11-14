import { createClient } from '@/lib/supabase/client'
import { fetchContenidoById } from './fetchContenidoById'
import { TIPO_CONTENIDO } from '../ContenidoTypes'

jest.mock('@/lib/supabase/client')

describe('fetchContenidoById', () => {
  let maybeSingleMock: jest.Mock
  let selectMock: jest.Mock

  beforeEach(() => {
    maybeSingleMock = jest.fn()
    selectMock = jest.fn().mockReturnValue({
      eq: () => ({
        eq: () => ({
          maybeSingle: maybeSingleMock,
        }),
      }),
    })
    ;(createClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: selectMock,
      }),
    })
  })

  it('requests the embedded contenido_imagenes(path, orden) select', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    await fetchContenidoById('c-1')
    expect(selectMock).toHaveBeenCalledWith(
      `id, tipo, titulo, descripcion, recurso_ref, duracion_seg, contenido_imagenes(path, orden)`,
    )
  })

  it('returns imagenes sorted by orden ascending', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
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
      error: null,
    })
    const { data } = await fetchContenidoById('c-1')
    expect(data?.imagenes).toEqual([
      { path: 'cma/a.jpg', orden: 1 },
      { path: 'cma/b.jpg', orden: 2 },
    ])
  })

  it('returns an Error when supabase returns an error', async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    })
    expect(await fetchContenidoById('c-1')).toEqual({
      data: null,
      error: new Error('boom'),
    })
  })

  it('returns { data: null, error: null } when no row', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    expect(await fetchContenidoById('c-1')).toEqual({
      data: null,
      error: null,
    })
  })

  it('returns { data: null, error: null } when tipo is unknown', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: 'c-1',
        tipo: 'desconocido',
        titulo: 'T',
        descripcion: null,
        recurso_ref: null,
        duracion_seg: null,
      },
      error: null,
    })
    expect(await fetchContenidoById('c-1')).toEqual({
      data: null,
      error: null,
    })
  })

  it('returns the mapped Contenido when supabase succeeds', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: 'c-1',
        tipo: 'video',
        titulo: 'V',
        descripcion: 'd',
        recurso_ref: 'r',
        duracion_seg: 100,
      },
      error: null,
    })
    expect(await fetchContenidoById('c-1')).toEqual({
      data: {
        id: 'c-1',
        tipo: TIPO_CONTENIDO.VIDEO,
        titulo: 'V',
        descripcion: 'd',
        contenido: { recursoRef: 'r', duracion: 100 },
        imagenes: [],
      },
      error: null,
    })
  })
})
