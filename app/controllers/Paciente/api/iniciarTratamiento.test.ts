import { createClient } from '@/lib/supabase/client'
import { serializeEntregasPlan } from '@/app/controllers/Tratamiento'
import { dispararInvitacion } from './dispararInvitacion'
import { iniciarTratamiento } from './iniciarTratamiento'

jest.mock('@/lib/supabase/client')
jest.mock('@/app/controllers/Tratamiento', () => ({
  serializeEntregasPlan: jest.fn(),
}))
jest.mock('./dispararInvitacion')

describe('iniciarTratamiento', () => {
  let rpcMock: jest.Mock
  const semanas = [
    {
      semana: 1,
      meditacion: 'c-1',
      mantra: null,
      egregor: null,
      cma: null,
      ic: null,
    },
  ]
  const rows = [{ semana: 1, orden: 1, contenido_id: 'c-1' }]

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ rpc: rpcMock })
    ;(serializeEntregasPlan as jest.Mock).mockReturnValue(rows)
    ;(dispararInvitacion as jest.Mock).mockReset()
  })

  it('sends the serialized plan when semanas is provided', async () => {
    rpcMock.mockResolvedValue({
      data: { iniciado: false, pacienteId: 'p-1' },
      error: null,
    })
    await iniciarTratamiento({ etapaId: 'e-1', semanas })
    expect(rpcMock).toHaveBeenCalledWith('iniciar_tratamiento', {
      p_etapa_id: 'e-1',
      p_entregas_plan: rows,
    })
  })

  it('sends null when semanas is null', async () => {
    rpcMock.mockResolvedValue({
      data: { iniciado: false, pacienteId: 'p-1' },
      error: null,
    })
    await iniciarTratamiento({ etapaId: 'e-1', semanas: null })
    expect(rpcMock).toHaveBeenCalledWith('iniciar_tratamiento', {
      p_etapa_id: 'e-1',
      p_entregas_plan: null,
    })
  })

  it('does not call the edge function when iniciado is false', async () => {
    rpcMock.mockResolvedValue({
      data: { iniciado: false, pacienteId: 'p-1' },
      error: null,
    })
    await iniciarTratamiento({ etapaId: 'e-1', semanas: null })
    expect(dispararInvitacion).not.toHaveBeenCalled()
  })

  it('returns not started with bienvenida desconocida when iniciado is false', async () => {
    rpcMock.mockResolvedValue({
      data: { iniciado: false, pacienteId: 'p-1' },
      error: null,
    })
    expect(await iniciarTratamiento({ etapaId: 'e-1', semanas: null })).toEqual(
      { ok: true, error: null, iniciado: false, bienvenida: 'desconocida' },
    )
  })

  it('invokes the invitation with the pacienteId when iniciado is true', async () => {
    rpcMock.mockResolvedValue({
      data: { iniciado: true, pacienteId: 'p-9' },
      error: null,
    })
    ;(dispararInvitacion as jest.Mock).mockResolvedValue({
      ok: true,
      enviadas: 1,
      error: null,
    })
    await iniciarTratamiento({ etapaId: 'e-1', semanas: null })
    expect(dispararInvitacion).toHaveBeenCalledWith('p-9')
  })

  it.each([
    [1, 'enviada'],
    [0, 'innecesaria'],
    [null, 'desconocida'],
  ])('maps enviadas %s to bienvenida %s', async (enviadas, bienvenida) => {
    rpcMock.mockResolvedValue({
      data: { iniciado: true, pacienteId: 'p-9' },
      error: null,
    })
    ;(dispararInvitacion as jest.Mock).mockResolvedValue({
      ok: true,
      enviadas,
      error: null,
    })
    expect(await iniciarTratamiento({ etapaId: 'e-1', semanas: null })).toEqual(
      { ok: true, error: null, iniciado: true, bienvenida },
    )
  })

  it('reports bienvenida fallida with ok true when the invocation fails', async () => {
    rpcMock.mockResolvedValue({
      data: { iniciado: true, pacienteId: 'p-9' },
      error: null,
    })
    ;(dispararInvitacion as jest.Mock).mockResolvedValue({
      ok: false,
      enviadas: null,
      error: 'boom',
    })
    expect(await iniciarTratamiento({ etapaId: 'e-1', semanas: null })).toEqual(
      { ok: true, error: null, iniciado: true, bienvenida: 'fallida' },
    )
  })

  it.each(['etapa_cerrada', 'paciente_dado_de_baja', 'semana_pasada'])(
    'maps the %s RPC error to its code without inviting',
    async (message) => {
      rpcMock.mockResolvedValue({ data: null, error: { message } })
      expect(
        await iniciarTratamiento({ etapaId: 'e-1', semanas: null }),
      ).toEqual({
        ok: false,
        error: message,
        iniciado: false,
        bienvenida: 'desconocida',
      })
      expect(dispararInvitacion).not.toHaveBeenCalled()
    },
  )

  it('maps an unknown RPC error to desconocido', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado' },
    })
    expect(await iniciarTratamiento({ etapaId: 'e-1', semanas: null })).toEqual(
      {
        ok: false,
        error: 'desconocido',
        iniciado: false,
        bienvenida: 'desconocida',
      },
    )
  })
})
