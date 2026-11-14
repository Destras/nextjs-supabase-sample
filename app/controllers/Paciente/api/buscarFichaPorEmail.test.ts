import { createClient } from '@/lib/supabase/client'
import { buscarFichaPorEmail } from './buscarFichaPorEmail'

jest.mock('@/lib/supabase/client')

describe('buscarFichaPorEmail', () => {
  let fromMock: jest.Mock
  let selectMock: jest.Mock
  let eqMock: jest.Mock
  let neqMock: jest.Mock
  let maybeSingleMock: jest.Mock

  beforeEach(() => {
    maybeSingleMock = jest.fn().mockResolvedValue({
      data: {
        id: 'pac-1',
        nombre: 'Sofía Rodríguez',
        estados_paciente: { codigo: 'activo' },
        asignaciones_paciente: [{ fecha_hasta: null }],
      },
      error: null,
    })
    const builder = {
      select: jest.fn(),
      eq: jest.fn(),
      neq: jest.fn(),
      maybeSingle: maybeSingleMock,
    }
    selectMock = builder.select.mockReturnValue(builder)
    eqMock = builder.eq.mockReturnValue(builder)
    neqMock = builder.neq.mockReturnValue(builder)
    fromMock = jest.fn().mockReturnValue(builder)
    ;(createClient as jest.Mock).mockReturnValue({ from: fromMock })
  })

  it('returns the mapped ficha when RLS lets the row through', async () => {
    expect(await buscarFichaPorEmail('sofia@example.com', null)).toEqual({
      ficha: {
        id: 'pac-1',
        nombre: 'Sofía Rodríguez',
        dadoDeBaja: false,
        accesible: true,
      },
      error: null,
    })
  })

  it('returns a null ficha when no visible row has that email', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    expect(await buscarFichaPorEmail('ajeno@example.com', null)).toEqual({
      ficha: null,
      error: null,
    })
  })

  it('returns a null ficha and the message when the query fails', async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    })
    expect(await buscarFichaPorEmail('sofia@example.com', null)).toEqual({
      ficha: null,
      error: 'permission denied',
    })
  })

  it('queries the pacientes table', async () => {
    await buscarFichaPorEmail('sofia@example.com', null)
    expect(fromMock).toHaveBeenCalledWith('pacientes')
  })

  it('selects id, nombre, the estado code and the asignaciones that gate the ficha', async () => {
    await buscarFichaPorEmail('sofia@example.com', null)
    expect(selectMock).toHaveBeenCalledWith(
      'id, nombre, estados_paciente ( codigo ), asignaciones_paciente ( fecha_hasta )',
    )
  })

  it('filters by the exact email, without normalizing case', async () => {
    await buscarFichaPorEmail('Sofia@Example.com', null)
    expect(eqMock).toHaveBeenCalledWith('email', 'Sofia@Example.com')
  })

  it('excludes the ficha being edited when an id is given', async () => {
    await buscarFichaPorEmail('sofia@example.com', 'pac-9')
    expect(neqMock).toHaveBeenCalledWith('id', 'pac-9')
  })

  it('does not exclude any ficha when there is no id to exclude', async () => {
    await buscarFichaPorEmail('sofia@example.com', null)
    expect(neqMock).not.toHaveBeenCalled()
  })
})
