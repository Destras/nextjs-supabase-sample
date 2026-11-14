import { createClient } from '@/lib/supabase/client'
import { fetchPacientesByTerapeuta } from './fetchPacientesByTerapeuta'
import { PACIENTE_STATE } from '../PacienteTypes'

jest.mock('@/lib/supabase/client')

describe('fetchPacientesByTerapeuta', () => {
  let isMock: jest.Mock
  let selectMock: jest.Mock

  beforeEach(() => {
    isMock = jest.fn()
    selectMock = jest.fn(() => ({
      eq: () => ({
        is: isMock,
      }),
    }))
    ;(createClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: selectMock,
      }),
    })
  })

  it('pide el estado del paciente embebido desde estados_paciente', async () => {
    isMock.mockResolvedValue({ data: [], error: null })
    await fetchPacientesByTerapeuta('t-1')
    expect(selectMock).toHaveBeenCalledWith(
      expect.stringContaining(
        'user_id, bienvenida_entregada_at, estados_paciente ( codigo ),',
      ),
    )
  })

  it('devuelve el estado real del paciente que trae la base', async () => {
    isMock.mockResolvedValue({
      data: [
        {
          id: 'asig-1',
          pacientes: {
            id: 'p-1',
            nombre: 'Juan',
            estados_paciente: { codigo: 'pausado' },
            etapas_tratamiento: [],
          },
        },
      ],
      error: null,
    })
    const { data } = await fetchPacientesByTerapeuta('t-1')
    expect(data?.map((p) => p.state)).toEqual([PACIENTE_STATE.PAUSED])
  })

  it('returns an Error when supabase returns an error', async () => {
    isMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await fetchPacientesByTerapeuta('t-1')).toEqual({
      data: null,
      error: new Error('boom'),
    })
  })

  it('returns the mapped pacientes when supabase succeeds', async () => {
    isMock.mockResolvedValue({
      data: [
        {
          id: 'asig-1',
          pacientes: {
            id: 'p-1',
            nombre: 'Juan',
            etapas_tratamiento: [],
          },
        },
      ],
      error: null,
    })
    expect(await fetchPacientesByTerapeuta('t-1')).toEqual({
      data: [
        {
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
      ],
      error: null,
    })
  })
})
