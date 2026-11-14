import { createClient } from '@/lib/supabase/client'
import type { TipoAlerta } from '../AlertaTypes'
import { ALERTA_TIPO } from '../AlertaTypes'
import { fetchAlertasTerapeuta } from './fetchAlertasTerapeuta'

jest.mock('@/lib/supabase/client')

describe('fetchAlertasTerapeuta', () => {
  let rpcMock: jest.Mock
  let catalogo: ReadonlyArray<TipoAlerta>

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ rpc: rpcMock })
    catalogo = [
      {
        codigo: 'score_bajo',
        nombre: 'Score bajo',
        prioridad: 'alta',
        orden: 1,
        icono: '↘',
        descripcion: null,
        activo: true,
        descartable: true,
      },
    ]
  })

  it('returns the mapped alertas on success', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          paciente_id: 'p-1',
          paciente_nombre: 'Juan',
          terapeuta_id: 't-1',
          terapeuta_nombre: 'Ana',
          tipo: 'score_bajo',
          evento_ref: 'nivel-1',
          valor: 2,
          fecha: '2026-07-01',
        },
      ],
      error: null,
    })
    expect(await fetchAlertasTerapeuta(catalogo)).toEqual({
      data: [
        {
          tipo: ALERTA_TIPO.SCORE_BAJO,
          prioridad: 'alta',
          pacienteId: 'p-1',
          pacienteNombre: 'Juan',
          terapeutaId: 't-1',
          terapeutaNombre: 'Ana',
          nombre: 'Score bajo',
          icono: '↘',
          mensaje: 'score 2 · última evaluación',
          eventoRef: 'nivel-1',
          fecha: '2026-07-01',
          descartable: true,
        },
      ],
      error: null,
    })
  })

  it('returns an Error when the rpc fails', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await fetchAlertasTerapeuta(catalogo)).toEqual({
      data: null,
      error: new Error('boom'),
    })
  })
})
