import { act, renderHook } from '@testing-library/react'
import { useParams, useSearchParams } from 'next/navigation'
import {
  useFetchEstructuraPaciente,
  useRegistrarMedicion,
  useEditarMedicion,
  EtapaStatus,
} from '@/app/controllers/Tratamiento'
import type {
  CentroEnergetico,
  EstructuraPaciente,
  EtapaEstructura,
  Medicion,
  ValorCentro,
} from '@/app/controllers/Tratamiento'
import { useEstructuraTabViewModel } from './useEstructuraTabViewModel'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useSearchParams: jest.fn(),
}))

jest.mock('@/app/controllers/Tratamiento', () => ({
  ...jest.requireActual('@/app/controllers/Tratamiento'),
  useFetchEstructuraPaciente: jest.fn(),
  useRegistrarMedicion: jest.fn(),
  useEditarMedicion: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const buildCentro = (
  overrides: Partial<CentroEnergetico> = {},
): CentroEnergetico => ({
  id: 'c1',
  codigo: 'CE-01',
  nombre: 'Corona',
  etiquetaPaciente: 'Corona',
  orden: 1,
  ...overrides,
})

const buildValor = (overrides: Partial<ValorCentro> = {}): ValorCentro => ({
  centroId: 'c1',
  codigo: 'CE-01',
  nombre: 'Corona',
  orden: 1,
  activo: true,
  valor: 50,
  delta: null,
  ...overrides,
})

const buildMedicion = (overrides: Partial<Medicion> = {}): Medicion => ({
  id: 'm1',
  etapaId: 'e1',
  momento: 'apertura',
  estructuraGeneral: 50,
  deltaEstructura: null,
  registradaEn: '2026-01-01T00:00:00Z',
  autor: { id: 'u1', nombre: 'Ana' },
  copiadaDe: null,
  esPropia: true,
  editable: true,
  motivoNoEditable: null,
  valores: [buildValor()],
  ...overrides,
})

const buildEtapa = (
  overrides: Partial<EtapaEstructura> = {},
): EtapaEstructura => ({
  id: 'e1',
  ordinal: 1,
  fechaInicio: '2026-01-01',
  fechaFin: null,
  estado: EtapaStatus.EN_CURSO,
  iniciada: true,
  mediciones: [],
  medicionActual: null,
  ...overrides,
})

const buildData = (
  overrides: Partial<EstructuraPaciente> = {},
): EstructuraPaciente => ({
  pacienteId: 'p1',
  puedeMedir: true,
  esAdmin: false,
  centrosActivos: [buildCentro()],
  etapas: [],
  ...overrides,
})

const mockedUseFetch = useFetchEstructuraPaciente as jest.Mock
const mockedUseRegistrar = useRegistrarMedicion as jest.Mock
const mockedUseEditar = useEditarMedicion as jest.Mock
const mockedUseParams = useParams as jest.Mock
const mockedUseSearchParams = useSearchParams as jest.Mock

const setFetchResult = (overrides: Record<string, unknown> = {}) => {
  mockedUseFetch.mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    ...overrides,
  })
}

const buildMutationHook = (submitImpl: jest.Mock, isSubmitting = false) => ({
  submit: submitImpl,
  isSubmitting,
})

beforeEach(() => {
  mockedUseParams.mockReturnValue({ id: 'p1' })
  mockedUseSearchParams.mockReturnValue(new URLSearchParams())
  mockedUseRegistrar.mockReturnValue(buildMutationHook(jest.fn()))
  mockedUseEditar.mockReturnValue(buildMutationHook(jest.fn()))
})

describe('useEstructuraTabViewModel', () => {
  it('selects the open etapa over any closed etapa', () => {
    const abierta = buildEtapa({ id: 'e2', ordinal: 2, fechaFin: null })
    const cerrada = buildEtapa({
      id: 'e1',
      ordinal: 1,
      fechaFin: '2026-02-01',
    })
    setFetchResult({ data: buildData({ etapas: [cerrada, abierta] }) })

    const { result } = renderHook(() => useEstructuraTabViewModel())

    expect(result.current.etapaVigente?.id).toBe('e2')
  })

  it('falls back to the last closed etapa when none is open', () => {
    const primera = buildEtapa({
      id: 'e1',
      ordinal: 1,
      fechaFin: '2026-01-15',
    })
    const segunda = buildEtapa({
      id: 'e2',
      ordinal: 2,
      fechaFin: '2026-03-01',
    })
    setFetchResult({ data: buildData({ etapas: [primera, segunda] }) })

    const { result } = renderHook(() => useEstructuraTabViewModel())

    expect(result.current.etapaVigente?.id).toBe('e2')
  })

  it('precarga en blanco cuando la etapa no tiene mediciones (apertura)', () => {
    const etapa = buildEtapa({ mediciones: [], medicionActual: null })
    setFetchResult({ data: buildData({ etapas: [etapa] }) })

    const { result } = renderHook(() => useEstructuraTabViewModel())

    act(() => result.current.onAbrirNueva())

    expect(result.current.momentoPrevisto).toBe('apertura')
    expect(Object.values(result.current.valores).every((v) => v === '')).toBe(
      true,
    )
  })

  it('precarga con la medición anterior cuando ya existe una (seguimiento)', () => {
    const previa = buildMedicion({ estructuraGeneral: 66 })
    const etapa = buildEtapa({ mediciones: [previa], medicionActual: previa })
    setFetchResult({ data: buildData({ etapas: [etapa] }) })

    const { result } = renderHook(() => useEstructuraTabViewModel())

    act(() => result.current.onAbrirNueva())

    expect(result.current.momentoPrevisto).toBe('seguimiento')
    expect(result.current.valores['c1']).toBe('50')
    expect(result.current.valores['estructura_general']).toBe('66')
  })

  it('expande un solo centro a la vez', () => {
    const etapa = buildEtapa({
      mediciones: [buildMedicion()],
      medicionActual: buildMedicion(),
    })
    setFetchResult({ data: buildData({ etapas: [etapa] }) })

    const { result } = renderHook(() => useEstructuraTabViewModel())

    act(() => result.current.onToggleCentro('c1'))
    expect(result.current.centroAbiertoId).toBe('c1')

    act(() => result.current.onToggleCentro('c2'))
    expect(result.current.centroAbiertoId).toBe('c2')

    act(() => result.current.onToggleCentro('c2'))
    expect(result.current.centroAbiertoId).toBeNull()
  })

  it('deshabilita el submit cuando hay errores de validación', () => {
    const etapa = buildEtapa({ mediciones: [], medicionActual: null })
    setFetchResult({ data: buildData({ etapas: [etapa] }) })

    const { result } = renderHook(() => useEstructuraTabViewModel())

    act(() => result.current.onAbrirNueva())
    expect(result.current.canSubmit).toBe(false)

    act(() => {
      result.current.onChangeCampo('c1', '50')
      result.current.onChangeCampo('estructura_general', '60')
    })
    expect(result.current.canSubmit).toBe(true)

    act(() => result.current.onChangeCampo('c1', '150'))
    expect(result.current.canSubmit).toBe(false)
  })

  it('en conflicto (PT409) conserva los valores, mantiene el form abierto y refresca', async () => {
    const etapa = buildEtapa({ mediciones: [], medicionActual: null })
    const refresh = jest.fn()
    setFetchResult({ data: buildData({ etapas: [etapa] }), refresh })

    const submit = jest.fn<
      Promise<{
        readonly data: string | null
        readonly error:
          | import('@/app/controllers/Tratamiento').MedicionRpcError
          | null
      }>,
      unknown[]
    >(() =>
      Promise.resolve({
        data: null,
        error: {
          code: 'PT409',
          message: 'conflicto_medicion',
          details: null,
          hint: null,
        },
      }),
    )
    mockedUseRegistrar.mockReturnValue(buildMutationHook(submit))

    const { result } = renderHook(() => useEstructuraTabViewModel())

    act(() => result.current.onAbrirNueva())
    act(() => {
      result.current.onChangeCampo('c1', '77')
      result.current.onChangeCampo('estructura_general', '80')
    })
    act(() => result.current.onPedirConfirmacion())
    expect(result.current.confirmacionAbierta).toBe(true)

    await act(async () => {
      await result.current.onConfirmar()
    })

    expect(submit).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalled()
    expect(result.current.modoFormulario).toBe('crear')
    expect(result.current.valores['c1']).toBe('77')
    expect(result.current.valores['estructura_general']).toBe('80')
    expect(result.current.confirmacionAbierta).toBe(false)
    expect(result.current.notices.some((n) => n.tone === 'error')).toBe(true)
  })

  it('en éxito cierra el formulario, limpia los valores y refresca', async () => {
    const etapa = buildEtapa({ mediciones: [], medicionActual: null })
    const refresh = jest.fn()
    setFetchResult({ data: buildData({ etapas: [etapa] }), refresh })

    const submit = jest.fn<
      Promise<{
        readonly data: string | null
        readonly error:
          | import('@/app/controllers/Tratamiento').MedicionRpcError
          | null
      }>,
      unknown[]
    >(() => Promise.resolve({ data: 'm-new', error: null }))
    mockedUseRegistrar.mockReturnValue(buildMutationHook(submit))

    const { result } = renderHook(() => useEstructuraTabViewModel())

    act(() => result.current.onAbrirNueva())
    act(() => {
      result.current.onChangeCampo('c1', '77')
      result.current.onChangeCampo('estructura_general', '80')
    })
    act(() => result.current.onPedirConfirmacion())

    await act(async () => {
      await result.current.onConfirmar()
    })

    expect(result.current.modoFormulario).toBe('cerrado')
    expect(refresh).toHaveBeenCalled()
    expect(
      result.current.notices.some(
        (n) => n.tone === 'ok' && n.texto === 'Medición inicial registrada.',
      ),
    ).toBe(true)
  })

  it('toma editable y puedeMedir del servidor sin recalcularlos', () => {
    const medicion = buildMedicion({ editable: false })
    const etapa = buildEtapa({
      mediciones: [medicion],
      medicionActual: medicion,
    })
    setFetchResult({
      data: buildData({ etapas: [etapa], puedeMedir: false, esAdmin: true }),
    })

    const { result } = renderHook(() => useEstructuraTabViewModel())

    expect(result.current.puedeMedir).toBe(false)
    expect(result.current.esAdminLectura).toBe(true)
    expect(result.current.medicionActual?.editable).toBe(false)
  })

  it('admin de sólo lectura ve únicamente el banner de administrador ante una medición ajena (MED-002)', () => {
    const medicion = buildMedicion({ esPropia: false, editable: false })
    const etapa = buildEtapa({
      mediciones: [medicion],
      medicionActual: medicion,
    })
    setFetchResult({
      data: buildData({ etapas: [etapa], puedeMedir: false, esAdmin: true }),
    })

    const { result } = renderHook(() => useEstructuraTabViewModel())

    expect(result.current.notices.map((n) => n.texto)).toEqual([
      'Vista de sólo lectura: como administrador podés consultar las mediciones, no registrarlas.',
    ])
  })

  it('terapeuta que puede medir ve el banner de medición ajena ante la medición de un colega', () => {
    const medicion = buildMedicion({ esPropia: false, editable: false })
    const etapa = buildEtapa({
      mediciones: [medicion],
      medicionActual: medicion,
    })
    setFetchResult({
      data: buildData({ etapas: [etapa], puedeMedir: true, esAdmin: false }),
    })

    const { result } = renderHook(() => useEstructuraTabViewModel())

    expect(result.current.notices.map((n) => n.texto)).toEqual([
      'Esta medición la registró otro terapeuta. Podés registrar una nueva con tu lectura.',
    ])
  })

  it('resalta la medición indicada por ?medicion= en la URL', () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams('medicion=m-42'))
    setFetchResult({ data: buildData({ etapas: [] }) })

    const { result } = renderHook(() => useEstructuraTabViewModel())

    expect(result.current.medicionResaltadaId).toBe('m-42')
  })
})
