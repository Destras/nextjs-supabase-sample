import { createClient } from '@/lib/supabase/client'
import { fetchPacientesSinIniciar } from './fetchPacientesSinIniciar'

jest.mock('@/lib/supabase/client')

describe('fetchPacientesSinIniciar', () => {
  let isMock: jest.Mock

  beforeEach(() => {
    isMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            is: isMock,
          }),
        }),
      }),
    })
  })

  it('returns an Error when supabase returns an error', async () => {
    isMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await fetchPacientesSinIniciar('t-1')).toEqual({
      data: null,
      error: new Error('boom'),
    })
  })

  it('includes a paciente whose active etapa has fecha_inicio null (partial plan or never started)', async () => {
    isMock.mockResolvedValue({
      data: [
        {
          pacientes: {
            id: 'p-1',
            nombre: 'Juan',
            etapas_tratamiento: [
              { fecha_finalizacion: null, fecha_inicio: null },
            ],
          },
        },
      ],
      error: null,
    })
    expect(await fetchPacientesSinIniciar('t-1')).toEqual({
      data: [{ id: 'p-1', nombre: 'Juan' }],
      error: null,
    })
  })

  it('excludes a paciente whose active etapa already started (DEC-5: started + plan later deleted is NOT onboarding)', async () => {
    isMock.mockResolvedValue({
      data: [
        {
          pacientes: {
            id: 'p-1',
            nombre: 'Juan',
            etapas_tratamiento: [
              { fecha_finalizacion: null, fecha_inicio: '2026-01-01' },
            ],
          },
        },
      ],
      error: null,
    })
    expect(await fetchPacientesSinIniciar('t-1')).toEqual({
      data: [],
      error: null,
    })
  })

  it('excludes a paciente with no active etapa (all finalizadas)', async () => {
    isMock.mockResolvedValue({
      data: [
        {
          pacientes: {
            id: 'p-1',
            nombre: 'Juan',
            etapas_tratamiento: [
              { fecha_finalizacion: '2026-01-01', fecha_inicio: '2025-09-01' },
            ],
          },
        },
      ],
      error: null,
    })
    expect(await fetchPacientesSinIniciar('t-1')).toEqual({
      data: [],
      error: null,
    })
  })

  it('sorts the result by nombre', async () => {
    isMock.mockResolvedValue({
      data: [
        {
          pacientes: {
            id: 'p-2',
            nombre: 'Zoe',
            etapas_tratamiento: [
              { fecha_finalizacion: null, fecha_inicio: null },
            ],
          },
        },
        {
          pacientes: {
            id: 'p-1',
            nombre: 'Ana',
            etapas_tratamiento: [
              { fecha_finalizacion: null, fecha_inicio: null },
            ],
          },
        },
      ],
      error: null,
    })
    expect(
      (await fetchPacientesSinIniciar('t-1')).data?.map((p) => p.nombre),
    ).toEqual(['Ana', 'Zoe'])
  })

  it('does not throw when a paciente has no etapas_tratamiento embed', async () => {
    isMock.mockResolvedValue({
      data: [{ pacientes: { id: 'p-1', nombre: 'Juan' } }],
      error: null,
    })
    expect(await fetchPacientesSinIniciar('t-1')).toEqual({
      data: [],
      error: null,
    })
  })

  it('returns an empty array when data is null and there is no error', async () => {
    isMock.mockResolvedValue({ data: null, error: null })
    expect(await fetchPacientesSinIniciar('t-1')).toEqual({
      data: [],
      error: null,
    })
  })
})
