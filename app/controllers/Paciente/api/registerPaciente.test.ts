import { createClient } from '@/lib/supabase/client'
import { registerPaciente } from './registerPaciente'

jest.mock('@/lib/supabase/client')

describe('registerPaciente', () => {
  let rpcMock: jest.Mock
  let payload: Parameters<typeof registerPaciente>[0]

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      rpc: rpcMock,
    })

    payload = {
      nombre: 'Ana García',
      fechaNacimiento: '1990-05-15',
      email: 'ana@example.com',
      telefono: '+34600000000',
      causaId: 'causa-uuid-1',
      algoritmoId: 'algoritmo-uuid-1',
      modalidadId: 'modalidad-uuid-1',
      bloqueoIds: ['bloqueo-uuid-1', 'bloqueo-uuid-2'],
      alfabetos: [{ alfabetoId: 'alfabeto-uuid-1', numeros: [3] }],
    }
  })

  it('returns pacienteId when RPC resolves successfully', async () => {
    rpcMock.mockResolvedValue({
      data: 'paciente-uuid-abc',
      error: null,
    })

    expect(await registerPaciente(payload)).toEqual({
      pacienteId: 'paciente-uuid-abc',
      error: null,
    })
  })

  it('returns error message when RPC returns an error', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'modalidad_inexistente' },
    })

    expect(await registerPaciente(payload)).toEqual({
      pacienteId: null,
      error: 'modalidad_inexistente',
    })
  })

  it('returns email_duplicado when the RPC hits the unique email constraint', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "pacientes_email_key"',
      },
    })

    expect(await registerPaciente(payload)).toEqual({
      pacienteId: null,
      error: 'email_duplicado',
    })
  })

  it('maps camelCase payload to snake_case RPC parameters', async () => {
    rpcMock.mockResolvedValue({ data: 'paciente-uuid-abc', error: null })

    await registerPaciente(payload)

    expect(rpcMock).toHaveBeenCalledWith('register_paciente', {
      p_nombre: 'Ana García',
      p_fecha_nacimiento: '1990-05-15',
      p_email: 'ana@example.com',
      p_telefono: '+34600000000',
      p_causa_id: 'causa-uuid-1',
      p_algoritmo_id: 'algoritmo-uuid-1',
      p_modalidad_id: 'modalidad-uuid-1',
      p_bloqueo_ids: ['bloqueo-uuid-1', 'bloqueo-uuid-2'],
      p_alfabetos: [{ alfabeto_id: 'alfabeto-uuid-1', numero: 3 }],
    })
  })

  it('sends one row per number', async () => {
    rpcMock.mockResolvedValue({ data: 'paciente-uuid-abc', error: null })

    await registerPaciente({
      ...payload,
      alfabetos: [{ alfabetoId: 'alfabeto-uuid-1', numeros: [1, 2] }],
    })

    expect(rpcMock).toHaveBeenCalledWith(
      'register_paciente',
      expect.objectContaining({
        p_alfabetos: [
          { alfabeto_id: 'alfabeto-uuid-1', numero: 1 },
          { alfabeto_id: 'alfabeto-uuid-1', numero: 2 },
        ],
      }),
    )
  })

  it('passes empty arrays for bloqueoIds and alfabetos when both are empty', async () => {
    rpcMock.mockResolvedValue({ data: 'paciente-uuid-abc', error: null })

    await registerPaciente({
      ...payload,
      bloqueoIds: [],
      alfabetos: [],
    })

    expect(rpcMock).toHaveBeenCalledWith('register_paciente', {
      p_nombre: 'Ana García',
      p_fecha_nacimiento: '1990-05-15',
      p_email: 'ana@example.com',
      p_telefono: '+34600000000',
      p_causa_id: 'causa-uuid-1',
      p_algoritmo_id: 'algoritmo-uuid-1',
      p_modalidad_id: 'modalidad-uuid-1',
      p_bloqueo_ids: [],
      p_alfabetos: [],
    })
  })
})
