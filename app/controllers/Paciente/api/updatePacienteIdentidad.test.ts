import { createClient } from '@/lib/supabase/client'
import type { UpdatePacienteIdentidadPayload } from '../PacienteTypes'
import { updatePacienteIdentidad } from './updatePacienteIdentidad'

jest.mock('@/lib/supabase/client')

describe('updatePacienteIdentidad', () => {
  let rpcMock: jest.Mock
  let payload: UpdatePacienteIdentidadPayload

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ rpc: rpcMock })

    payload = {
      pacienteId: 'paciente-uuid-1',
      nombre: 'Ana García',
      fechaNacimiento: '1990-05-15',
      email: 'ana@example.com',
      telefono: '+34600000000',
    }
  })

  it('returns no error when the RPC resolves successfully', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    expect(await updatePacienteIdentidad(payload)).toEqual({ error: null })
  })

  it('returns the error message when the RPC returns an error', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado' },
    })
    expect(await updatePacienteIdentidad(payload)).toEqual({
      error: 'no_autorizado',
    })
  })

  it('maps camelCase payload to snake_case RPC parameters', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    await updatePacienteIdentidad(payload)
    expect(rpcMock).toHaveBeenCalledWith('update_paciente_identidad', {
      p_paciente_id: 'paciente-uuid-1',
      p_nombre: 'Ana García',
      p_fecha_nacimiento: '1990-05-15',
      p_email: 'ana@example.com',
      p_telefono: '+34600000000',
    })
  })
})
