import { createClient } from '@/lib/supabase/client'
import type { TipoAlerta } from '../AlertaTypes'
import { ALERTA_TIPO } from '../AlertaTypes'
import { fetchAlertasByTerapeuta } from './fetchAlertasByTerapeuta'

jest.mock('@/lib/supabase/client')

describe('fetchAlertasByTerapeuta', () => {
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

  it('calls list_alertas_admin scoped to the given terapeutaId', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    await fetchAlertasByTerapeuta('t-1', catalogo)
    expect(rpcMock).toHaveBeenCalledWith('list_alertas_admin', {
      p_terapeuta_id: 't-1',
    })
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
    expect(await fetchAlertasByTerapeuta('t-1', catalogo)).toEqual({
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
    expect(await fetchAlertasByTerapeuta('t-1', catalogo)).toEqual({
      data: null,
      error: new Error('boom'),
    })
  })

  // list_alertas_admin(p_terapeuta_id) filtra derive_alertas_activas() por el
  // mismo terapeuta_id que alimenta el count de list_terapeutas.alertas_activas
  // (validado por psql en Task 2.1: los dos counts coinciden). A nivel unitario
  // esto se traduce en: el largo del array mapeado es exactamente el de las
  // filas devueltas por la RPC para ese terapeuta — sin fugas ni duplicados.
  it('returns exactly as many alertas as the terapeuta has active (same source as list_terapeutas.alertas_activas)', async () => {
    const rows = [
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
      {
        paciente_id: 'p-2',
        paciente_nombre: 'Maria',
        terapeuta_id: 't-1',
        terapeuta_nombre: 'Ana',
        tipo: 'eval_vencida',
        evento_ref: 'eval-2',
        valor: null,
        fecha: '2026-07-02',
      },
      {
        paciente_id: 'p-3',
        paciente_nombre: 'Pedro',
        terapeuta_id: 't-1',
        terapeuta_nombre: 'Ana',
        tipo: 'mes_3',
        evento_ref: 'etapa-3',
        valor: null,
        fecha: '2026-07-03',
      },
    ]
    rpcMock.mockResolvedValue({ data: rows, error: null })
    const { data } = await fetchAlertasByTerapeuta('t-1', catalogo)
    expect(data).toHaveLength(rows.length)
  })
})
