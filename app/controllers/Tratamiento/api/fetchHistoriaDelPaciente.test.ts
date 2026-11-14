import { createClient } from '@/lib/supabase/client'
import { mapEtapasToHistoria } from '../utils/mapEtapasToHistoria'
import type { EtapaHistoria } from '../TratamientoTypes'
import { EtapaStatus } from '../TratamientoTypes'
import { fetchHistoriaDelPaciente } from './fetchHistoriaDelPaciente'

jest.mock('@/lib/supabase/client')
jest.mock('../utils/mapEtapasToHistoria')

describe('fetchHistoriaDelPaciente', () => {
  let etapaFixture: EtapaHistoria
  let etapasQueryMock: jest.Mock
  let asignacionesQueryMock: jest.Mock
  let centrosQueryMock: jest.Mock

  beforeEach(() => {
    etapaFixture = {
      id: 'etapa-1',
      status: EtapaStatus.EN_CURSO,
      fechaInicio: '2025-01-01',
      fechaFin: null,
      diagnostico: {
        causa: {
          id: 'c-1',
          codigo: 'C',
          nombre: 'Causa',
          definicion: '',
          emocionesEsperadas: [],
          activo: true,
          etapas: [],
        },
        algoritmo: {
          id: 'a-1',
          codigo: 'A',
          nombre: 'Algo',
          definicion: '',
          comportamiento: '',
          comportamientoBadge: '',
          activo: true,
          etapas: [],
        },
        bloqueos: [],
      },
      modalidad: null,
      responsables: [],
      eventos: [],
      duracionMeses: 2,
      deltaScoreEtapa: null,
      motivoCierre: null,
      proximaEvaluacion: null,
      mediciones: [],
      alfabetos: [],
    }

    etapasQueryMock = jest.fn()
    asignacionesQueryMock = jest.fn()
    centrosQueryMock = jest.fn().mockResolvedValue({ data: [], error: null })

    // Q1 chain: from('etapas_tratamiento').select(...).eq('paciente_id', id).order(...)
    // Q2 chain: from('asignaciones_paciente').select(...).eq('paciente_id', id).order(...)
    // Q3 chain: from('centros_energeticos').select(...).order(...) — no .eq(), catalog is using(true)
    ;(createClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        if (table === 'etapas_tratamiento') {
          return {
            select: () => ({
              eq: () => ({
                order: etapasQueryMock,
              }),
            }),
          }
        }
        if (table === 'asignaciones_paciente') {
          return {
            select: () => ({
              eq: () => ({
                order: asignacionesQueryMock,
              }),
            }),
          }
        }
        // centros_energeticos
        return {
          select: () => ({
            order: centrosQueryMock,
          }),
        }
      },
    })
  })

  it('returns mapped etapas when both queries succeed', async () => {
    const rawEtapas = [{ id: 'etapa-1' }]
    const rawAsignaciones = [{ id: 'asig-1' }]
    etapasQueryMock.mockResolvedValue({ data: rawEtapas, error: null })
    asignacionesQueryMock.mockResolvedValue({
      data: rawAsignaciones,
      error: null,
    })
    ;(mapEtapasToHistoria as jest.Mock).mockReturnValue([etapaFixture])

    expect(await fetchHistoriaDelPaciente('p-1')).toEqual({
      etapas: [etapaFixture],
      centros: [],
      error: null,
    })
  })

  it('returns error when Q1 (etapas) fails', async () => {
    etapasQueryMock.mockResolvedValue({
      data: null,
      error: { message: 'etapas exploded' },
    })
    asignacionesQueryMock.mockResolvedValue({ data: [], error: null })

    expect(await fetchHistoriaDelPaciente('p-1')).toEqual({
      etapas: [],
      centros: [],
      error: 'etapas exploded',
    })
  })

  it('returns error when Q2 (asignaciones) fails', async () => {
    etapasQueryMock.mockResolvedValue({ data: [], error: null })
    asignacionesQueryMock.mockResolvedValue({
      data: null,
      error: { message: 'asignaciones exploded' },
    })

    expect(await fetchHistoriaDelPaciente('p-1')).toEqual({
      etapas: [],
      centros: [],
      error: 'asignaciones exploded',
    })
  })

  it('returns error when Q3 (centros_energeticos) fails', async () => {
    etapasQueryMock.mockResolvedValue({ data: [], error: null })
    asignacionesQueryMock.mockResolvedValue({ data: [], error: null })
    centrosQueryMock.mockResolvedValue({
      data: null,
      error: { message: 'centros exploded' },
    })

    expect(await fetchHistoriaDelPaciente('p-1')).toEqual({
      etapas: [],
      centros: [],
      error: 'centros exploded',
    })
  })

  it('returns empty etapas without error when paciente has no etapas', async () => {
    etapasQueryMock.mockResolvedValue({ data: [], error: null })
    asignacionesQueryMock.mockResolvedValue({ data: [], error: null })
    ;(mapEtapasToHistoria as jest.Mock).mockReturnValue([])

    expect(await fetchHistoriaDelPaciente('p-1')).toEqual({
      etapas: [],
      centros: [],
      error: null,
    })
  })

  it('returns the mapped centros catalog on success', async () => {
    etapasQueryMock.mockResolvedValue({ data: [], error: null })
    asignacionesQueryMock.mockResolvedValue({ data: [], error: null })
    centrosQueryMock.mockResolvedValue({
      data: [
        {
          id: 'centro-1',
          codigo: 'CE-01',
          nombre: 'Corona',
          etiqueta_paciente: 'Corona',
          orden: 1,
        },
      ],
      error: null,
    })
    ;(mapEtapasToHistoria as jest.Mock).mockReturnValue([])

    const result = await fetchHistoriaDelPaciente('p-1')
    expect(result.centros).toEqual([
      {
        id: 'centro-1',
        codigo: 'CE-01',
        nombre: 'Corona',
        etiquetaPaciente: 'Corona',
        orden: 1,
      },
    ])
  })
})
