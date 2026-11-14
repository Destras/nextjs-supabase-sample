import { createClient } from '@/lib/supabase/client'
import { fetchTiposAlerta } from './fetchTiposAlerta'

jest.mock('@/lib/supabase/client')

describe('fetchTiposAlerta', () => {
  let orderMock: jest.Mock

  beforeEach(() => {
    orderMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          order: orderMock,
        }),
      }),
    })
  })

  it('returns the mapped catalog rows ordered by orden', async () => {
    orderMock.mockResolvedValue({
      data: [
        {
          codigo: 'score_bajo',
          nombre: 'Score bajo',
          prioridad: 'alta',
          orden: 1,
          icono: '↘',
          descripcion: null,
          activo: true,
        },
      ],
      error: null,
    })
    expect(await fetchTiposAlerta()).toEqual({
      data: [
        {
          codigo: 'score_bajo',
          nombre: 'Score bajo',
          prioridad: 'alta',
          orden: 1,
          icono: '↘',
          descripcion: null,
          activo: true,
        },
      ],
      error: null,
    })
  })

  it('returns an Error when the query fails', async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await fetchTiposAlerta()).toEqual({
      data: null,
      error: new Error('boom'),
    })
  })
})
