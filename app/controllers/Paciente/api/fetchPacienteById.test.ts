import { createClient } from '@/lib/supabase/client'
import { fetchPacienteById } from './fetchPacienteById'
import { PACIENTE_STATE } from '../PacienteTypes'

jest.mock('@/lib/supabase/client')

describe('fetchPacienteById', () => {
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
      from: () => ({
        select: selectMock,
      }),
    })
  })

  it('pide el estado del paciente embebido desde estados_paciente', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    await fetchPacienteById('p-1')
    expect(selectMock).toHaveBeenCalledWith(
      expect.stringContaining(
        'user_id, bienvenida_entregada_at, estados_paciente ( codigo ),',
      ),
    )
  })

  it('returns an Error when supabase returns an error', async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    })
    expect(await fetchPacienteById('p-1')).toEqual({
      data: null,
      error: new Error('boom'),
    })
  })

  it('returns { data: null, error: null } when no active asignacion exists', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    expect(await fetchPacienteById('p-1')).toEqual({
      data: null,
      error: null,
    })
  })

  it('returns the mapped paciente when supabase succeeds', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: 'asig-1',
        pacientes: { id: 'p-1', nombre: 'Juan', etapas_tratamiento: [] },
      },
      error: null,
    })
    expect(await fetchPacienteById('p-1')).toEqual({
      data: {
        id: 'p-1',
        nombre: 'Juan',
        nivelFinalizado: false,
        mesActual: null,
        mesesTotales: null,
        etapaOrdinal: null,
        evaluaciones: [],
        semanaGlobal: null,
        semanasTotales: null,
        fechaInicioEtapaActiva: null,
        etapaActivaId: null,
        sinIniciar: false,
        modalidadResumen: null,
        causaActual: null,
        bloqueosIdentificados: [],
        algoritmoActual: null,
        alfabetosActuales: [],
        ultimoScore: null,
        tendencia: 'flat',
        tieneAlerta: false,
        ultimaEvaluacion: null,
        proximaEvaluacion: null,
        inicioTratamiento: { estado: 'sin_tratamiento', fecha: null },
        tieneCuenta: false,
        bienvenidaRecibida: false,
        generalInfo: {
          telefono: null,
          email: null,
          fechaNacimiento: null,
          edad: null,
          fechaAlta: null,
        },
        state: PACIENTE_STATE.ACTIVE,
      },
      error: null,
    })
  })
})
