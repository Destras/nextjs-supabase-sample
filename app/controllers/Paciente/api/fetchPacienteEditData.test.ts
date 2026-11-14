import { createClient } from '@/lib/supabase/client'
import { fetchPacienteEditData } from './fetchPacienteEditData'

jest.mock('@/lib/supabase/client')

describe('fetchPacienteEditData', () => {
  let maybeSingleMock: jest.Mock
  let selectMock: jest.Mock

  beforeEach(() => {
    maybeSingleMock = jest.fn()
    selectMock = jest.fn(() => ({
      eq: () => ({
        is: () => ({
          maybeSingle: maybeSingleMock,
        }),
      }),
    }))
    ;(createClient as jest.Mock).mockReturnValue({
      from: () => ({ select: selectMock }),
    })
  })

  it('asks for user_id so the edit screen knows whether the paciente activated the account', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    await fetchPacienteEditData('p-1')
    expect(selectMock).toHaveBeenCalledWith(
      expect.stringMatching(/pacientes \([^)]*\buser_id\b/),
    )
  })

  it('asks for the alfabeto catalog orden so the form starts in catalog order', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    await fetchPacienteEditData('p-1')
    expect(selectMock).toHaveBeenCalledWith(
      expect.stringContaining(
        'etapa_alfabetos ( alfabeto_id, numero, alfabetos ( orden ) )',
      ),
    )
  })

  it('returns an Error when supabase returns an error', async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    })
    expect(await fetchPacienteEditData('p-1')).toEqual({
      data: null,
      error: new Error('boom'),
    })
  })

  it('returns { data: null, error: null } when no active asignacion exists', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    expect(await fetchPacienteEditData('p-1')).toEqual({
      data: null,
      error: null,
    })
  })

  it('returns the mapped editable data when supabase succeeds', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        pacientes: {
          nombre: 'Juan',
          telefono: '111',
          email: 'j@example.com',
          fecha_nacimiento: '1990-05-01',
          user_id: 'user-1',
          etapas_tratamiento: [
            {
              id: 'etapa-activa',
              causa_id: 'causa-1',
              algoritmo_id: 'algo-1',
              modalidad_id: 'modalidad-1',
              fecha_finalizacion: null,
              etapa_bloqueos: [{ bloqueo_id: 'b-1' }],
              etapa_alfabetos: [
                { alfabeto_id: 'a-1', numero: 3 },
                { alfabeto_id: 'a-1', numero: 1 },
              ],
              niveles: [
                { fecha_seguimiento_real: null, nivel_evaluacion: null },
              ],
              entregas_plan: [],
            },
          ],
        },
      },
      error: null,
    })
    expect(await fetchPacienteEditData('p-1')).toEqual({
      data: {
        identidad: {
          nombre: 'Juan',
          fechaNacimiento: '1990-05-01',
          email: 'j@example.com',
          telefono: '111',
        },
        diagnostico: {
          causaId: 'causa-1',
          algoritmoId: 'algo-1',
          modalidadId: 'modalidad-1',
          bloqueoIds: ['b-1'],
          alfabetos: [{ alfabetoId: 'a-1', numeros: [1, 3] }],
        },
        etapaId: 'etapa-activa',
        etapaFresca: true,
        tieneCuenta: true,
      },
      error: null,
    })
  })
})
